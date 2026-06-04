# CRM Spine — Unified Lead Record

**Date:** 2026-06-04
**Status:** Design approved (spine = Approach C, person-first grain)
**Surface:** personal-site dashboard, Reach & Pipeline section
**Supabase project:** `bjbvqvzbzczjbatgmccb`

---

## Problem

A single human (e.g. Henner @ 4 Creatives) currently has **no single record**. Their cold-outreach row, inbound DM thread, proposal, meeting, and the conversations we have about them live in separate tables with no shared identity. The dashboard surfaces these as six side-by-side sub-tabs (Outreach · Leads · Competitors · Upwork · Meetings · Agent-Ready), so you can never click *a person* and see their whole arc — nor attach a deal stage, note, or next-action that sticks to them.

## Goal

A CRM that does **both**:
1. **Visibility** — open a contact, see their entire arc (every touch across every source) live in one place.
2. **Pipeline** — move contacts through deal stages with notes + next-actions that persist.

…built so **email** bolts on later as just another source, with zero schema change.

## Grain decision

**Person-first.** The contact *is* the human. `company` is a field, not its own table. A self-FK (`referred_by`) captures referral chains (Kyle → Henner) without building an account layer yet. Account grouping is explicitly deferred (YAGNI) but the `company` field + `referred_by` keep the door open.

## Architecture — Approach C: thin canonical spine + live links

Two new tables hold **only identity + the CRM fields you write**. All heavy source data (Apollo enrichment, DM threads, proposals, transcripts) **stays in its source table and is joined live** when you open a record. Nothing is duplicated; nothing goes stale. A bad match is fixed by re-pointing a link, not unscrambling copied data.

Rejected alternatives:
- **Full ETL / materialized sync** — duplicates all enrichment + message history, goes stale between syncs, heavy. ❌
- **Pure read-time SQL view** — always live but no stable writable row to hang stage/notes/next-action on; can't do the pipeline half. ❌

---

## Data model

### `contacts` — one row per human

```
id              uuid pk default gen_random_uuid()
name            text not null
company         text
linkedin_url    text unique          -- primary match key (nullable: assessment-only contacts lack it)
email           text                 -- secondary match key (citext-normalized lower)
icp_score       int                  -- denormalized best-known score (max non-null across linked sources)
stage           text not null default 'new'   -- CANONICAL crm stage (see Pipeline); operator-owned
next_action     text                 -- free text: "send proposal", "bump — went cold"
next_action_due date
owner_notes     text                 -- private notes; the thing no source table has
referred_by     uuid references contacts(id)  -- referral chain, no account layer needed
merged_into     uuid references contacts(id)  -- soft-delete on merge; NULL = active
created_at      timestamptz default now()
updated_at      timestamptz default now()       -- maintained by trigger
```

Indexes: `unique(linkedin_url) where linkedin_url is not null`, `index(lower(email))`, `index(stage)`, `index(next_action_due)`, `index(merged_into)`.

### `contact_links` — maps a contact to its rows across every source

```
id            uuid pk default gen_random_uuid()
contact_id    uuid not null references contacts(id) on delete cascade
source_type   text not null   -- enum below
source_id     text not null   -- pk in the source (text: handles uuid / stripe_session_id / clickup task id)
source_ref    jsonb           -- cheap denormalized hint for list/timeline render (campaign name, thread subject, proposal amount)
linked_by     text not null default 'resolver'  -- 'resolver' | 'manual'
confidence    text not null default 'exact'     -- 'exact' | 'fuzzy' | 'confirmed'
review_status text not null default 'active'    -- 'active' (counts toward 360) | 'pending' (in review queue) | 'rejected'
created_at    timestamptz default now()
unique(source_type, source_id) where review_status <> 'rejected'  -- a source row belongs to exactly one contact; rejected links don't block re-resolution
```

`source_type` enum (grounded in the real tables):

| source_type | source table | source_id | identity key | resolution |
|---|---|---|---|---|
| `outreach_prospect` | `outreach_prospects` | `id` (uuid) | `linkedin_url` + `email` | **auto** (Phase 1) |
| `lead` | `leads` | `id` (uuid) | `linkedin_url` (no email col) | **auto** (Phase 1) |
| `transcript` | `transcripts` | `id` (uuid) | `participants[]` (freeform names) | manual P1 → fuzzy auto P2 |
| `proposal_clickup` | ClickUp task (no Supabase table) | clickup task id | task name | manual P1 → name-suggest P2 |
| `paid_assessment` | `paid_assessments` | `stripe_session_id` | `email` | manual P1 → email auto P2 |
| `email_thread` | Gmail (Phase 3) | gmail thread id | `email` | auto P3 |

**Inbound DMs are not a source_type.** `outreach_messages` already hangs off `outreach_prospects.prospect_id`; the DM thread is pulled live through the `outreach_prospect` link. One fewer thing to resolve.

### Denormalization (the one deliberate copy)

`contacts.icp_score` and `contacts.name`/`company`/`linkedin_url`/`email` are copied from sources so the **list view** can search/sort/filter 200+ contacts without joins. On merge, take the **non-null max** for `icp_score` and the most-complete value for identity fields. Everything else (enrichment, messages, transcripts, proposals) stays linked-live.

---

## Identity resolver

A Postgres function does the matching (keeps it out of n8n Code nodes — avoids the binary/loop/`pairedItem` traps from prior incidents). A thin n8n **Schedule Trigger → call RPC → notify-on-error** workflow drives it (visible in n8nClaw health monitoring, house style), plus an on-demand "Resolve now" button in the dashboard.

### Matching cascade (per unlinked source row)

For each source row not yet present in `contact_links`:

1. **Exact `linkedin_url`** vs `contacts.linkedin_url` → link, `confidence='exact'`.
2. **Exact `email`** (lower) vs `contacts.email` → link, `confidence='exact'`.
3. **Fuzzy `name` (+ `company` when present)** via `pg_trgm` `similarity()` ≥ threshold (start 0.55 name, require company token overlap when both have company):
   - single strong candidate → **review queue** (`confidence='fuzzy'`, *not* auto-linked).
   - no candidate → **create new contact** from the source row's identity fields.
4. **Conflict** (linkedin matches contact A, email matches contact B) → review queue (likely a merge; or data error).

**Phase 1 only runs steps 1–2 + new-contact creation for `outreach_prospect` and `lead`.** Fuzzy (step 3) populates the review queue but never auto-links. The messy sources (`transcript`, `proposal_clickup`, `paid_assessment`) are **manual-attach only** in Phase 1.

### Review queue

Fuzzy candidates are written as `contact_links` rows with `confidence='fuzzy'`, `review_status='pending'` — surfaced as a dashboard "N matches need review" strip. Pending links do **not** count toward the 360° record until confirmed. You **Confirm** (→ `review_status='active'`, `confidence='confirmed'`) or **Reject** (→ `review_status='rejected'`; the partial unique index lets the resolver create a fresh separate contact next run). Nothing fuzzy is ever silently fused — this is the discipline that keeps two different people from merging.

### Merge / split

- **Merge** B into A: re-point all of B's `contact_links` to A, copy non-null CRM fields where A is empty, set `B.merged_into = A.id`. Cheap because source data isn't duplicated.
- **Split**: delete the offending link; resolver re-creates or re-queues it next run.

---

## Dashboard view

New sub-tab **"CRM"** under Reach & Pipeline, added as the **first** sub-tab and default landing for the section (it's the cross-cutting view; the existing six become drill-downs). Uses the existing `?sub=` param → `?sub=crm`. Inline two-pane (no modal — matches the recent `inbox renders thread inline` fix).

### Left pane — contact list
Reads `contacts` directly (fast: denormalized name/company/icp/stage). Columns: name, company, stage, icp_score, next_action_due, last_touch. Filters: stage, source_type present, ICP band, **needs-review**, **next-action overdue**. Default sort: `next_action_due` asc nulls last (a work queue).

### Right pane — 360° record (inline)
One server call `get_contact_360(contact_id)` (edge function/RPC) does the live fan-out across linked sources and returns a normalized payload. Sections:
- **Header** — name, company, LinkedIn link, ICP, **stage selector**.
- **Timeline** — unified chronological feed merged from all links: outreach touches + DM thread (`outreach_messages`), meetings (`transcripts`), proposal sent/viewed, assessment events, email (P3). Each item deep-links to its source panel.
- **CRM fields** — `stage`, `next_action` + due, `owner_notes` (editable; writes to `contacts` via existing `dashboardActions` optimistic pattern).
- **Sources** — chips for each linked source (e.g. "Outreach: Agency Consultants", "Proposal $10k", "2 meetings"), expandable to live source data. **Manual "+ Attach"** here links a transcript / ClickUp proposal / assessment in Phase 1.
- **Referral** — `referred_by` chain (Kyle → Henner), editable.

Write paths reuse `lib/dashboardActions` (optimistic + toast) exactly as existing panels do.

---

## Pipeline layer

Canonical `contacts.stage` (operator-owned), seeded to match the Fractional sales flow:

`new → engaged → qualified → call_booked → proposal_sent → negotiating → won | lost | nurture`

- Stage is set **manually** in Phase 1.
- Phase 2 adds **suggestions** derived from source micro-stages (`outreach_prospects.stage='replied'` → suggest `engaged`; a linked proposal → suggest `proposal_sent`; a linked future meeting → suggest `call_booked`). Suggestions **never override** a manually-set stage (mirrors the autofix "don't touch what a human set" discipline).
- **Today strip**: contacts with overdue `next_action_due` surface at the top, and feed `morning-triage` + an optional WhatsApp nudge via n8nClaw (WhatsApp, not Telegram, per house rule). Phase 2.

Pipeline display: a **grouped-by-stage list sorted by next_action_due** (a work queue), not a drag-drop kanban — less fiddling for an operator. Stage counts at the top.

---

## Phasing (each phase = its own implementation plan)

### Phase 1 — Spine + Visibility *(buildable now, independently shippable)*
- `contacts` + `contact_links` tables + indexes + `updated_at` trigger.
- Resolver RPC (exact linkedin + exact email + new-contact) for `outreach_prospect` + `lead` only; fuzzy → review queue (no auto-link).
- Thin n8n schedule workflow + "Resolve now" button.
- CRM sub-tab: contact list + inline 360° record (read) via `get_contact_360`.
- Manual writes: stage, next_action(+due), owner_notes, referred_by.
- Manual **Attach** for transcript / ClickUp proposal / paid_assessment.
- Review-queue strip: confirm/reject fuzzy matches + merge.
- **Outcome:** click any person → full arc; outreach-lead duplicates collapse into one record; basic pipeline fields work.

### Phase 2 — Pipeline intelligence
- Auto-resolution of the fuzzy/email sources: `transcript` (participant-name fuzzy), `paid_assessment` (email), `proposal_clickup` (name suggest via ClickUp fetch).
- Stage suggestions from source signals; next-action engine; Today strip; morning-triage + WhatsApp nudges.
- Merge/split UI polish.

### Phase 3 — Email ingestion ⚠️ blocked on Gmail OAuth
- Resolve Gmail OAuth (the dependency that's also blocked signal-clusters since 05-18).
- Ingest threads as `email_thread`, match by `email`, add to timeline. Unblocks signal-clusters as a side effect.

---

## Risks / open items

- **Proposals are ClickUp-only.** No Supabase table; name-match only. Phase 1 handles via manual attach (pick/paste ClickUp task id); Phase 2 adds name-suggestion. A future "mirror proposals to Supabase" would make this auto, but is out of scope here.
- **`leads` has no email** → leads can only bridge to email-keyed sources (paid_assessments) by fuzzy name. Acceptable; goes through review queue.
- **`transcripts.participants` is freeform** → meeting matching is inherently fuzzy/manual until someone records structured attendee identity. Manual attach is the honest Phase 1 answer.
- **personal-site concurrent-git hazard** — feature work must use an isolated git worktree + refspec push, never the shared main tree (a live automation commits to main + switches branches).
- **RLS** — `contacts`/`contact_links` are dashboard-internal (single-password auth, service-role reads). Match the RLS posture of existing dashboard tables (`leads`/`outreach_prospects`).

## Out of scope

Account/company entity layer · multi-user ownership · CRM data export · automated stage transitions that override manual stage · mirroring ClickUp proposals into Supabase.
