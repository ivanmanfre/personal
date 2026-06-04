# CRM Spine — Phases 2 & 3 Outline

> **Status:** Outline only. Expand into a full TDD-style plan (like `2026-06-04-crm-spine-phase1.md`) once Phase 1 is shipped and its tables/functions are stable. Writing complete code now would be speculative — these phases build on Phase 1 artifacts and Phase 3 is blocked.

**Spec:** `docs/superpowers/specs/2026-06-04-crm-spine-design.md`
**Depends on:** Phase 1 (`contacts`, `contact_links`, `resolve_contacts`, `get_contact_360`, `CrmPanel`).

---

## Phase 2 — Pipeline intelligence

**Goal:** auto-resolve the three messy sources, suggest stage transitions from source signals, and turn the contact list into a daily work queue.

### 2A — Auto-resolve the fuzzy/email sources
- Extend `resolve_contacts()` (or add `resolve_contacts_extended()`) to also sweep:
  - `paid_assessments` — match by `email` (exact); new contact if none. Clean.
  - `transcripts` — for each `participants[]` string that isn't Ivan, fuzzy-match the name → **pending** link (never auto; freeform names are unreliable). Store the matched participant string in `source_ref`.
  - `proposal_clickup` — pull open/won proposal tasks via the ClickUp edge function, fuzzy-match task name / assignee to a contact → **pending** link with `source_ref={amount, status, taskUrl}`.
- All three feed the existing review-queue strip. No new UI primitive needed.
- **Verify:** seed/known assessment email resolves to its existing outreach contact (same person, two links); a transcript with "Henner" participant queues a pending match to the Henner contact.

### 2B — Stage suggestions (never override manual)
- Add `contacts.stage_suggested text` + `stage_source text`. A function derives a suggestion from linked source micro-stages: prospect `replied` → `engaged`; linked proposal → `proposal_sent`; linked future meeting → `call_booked`; `paid_assessment` paid → `won` (or a dedicated `customer` stage).
- Rule: only set `stage_suggested`; surface it in the record as "Suggested: proposal_sent — Accept?". Accepting copies to `stage`. **Never auto-writes `stage`** (mirrors the autofix "don't touch what a human set" discipline).
- **Verify:** a contact with a linked proposal shows the suggestion; accepting updates stage; a manually-set stage is never silently changed by a resolver run.

### 2C — Work-queue + Today strip
- List filters: ICP band, "needs review", "next-action overdue" (the filters stubbed in Phase 1 Task 7).
- "Today" strip at top of CRM tab: contacts with `next_action_due <= today`, sorted, one-click to the record.
- Wire into the `morning-triage` skill (add a CRM section: overdue next-actions) and an optional daily WhatsApp nudge via n8nClaw (Whapi, not Telegram).
- **Verify:** an overdue next-action appears in the Today strip and in morning-triage output.

### 2D — Merge / split UI
- "Looks like a duplicate of…" affordance on the record → calls `merge_contacts(a,b)`; an "unlink" button per source chip (sets that link `review_status='rejected'`, lets resolver re-create separately).
- **Verify:** merging two contacts re-points links and soft-deletes the loser; unlinking a chip removes it and a later resolve re-queues it.

---

## Phase 3 — Email ingestion ⚠️ blocked

**Goal:** Gmail threads appear in the contact timeline, matched by email.

**Blocker:** Gmail OAuth was never wired — the same dependency that has stalled `signal-clusters` since 05-18. **This phase cannot start until OAuth is resolved.** Resolving it unblocks signal-clusters as a side effect (do them together).

### 3A — Gmail OAuth + thread ingest
- Stand up the Gmail OAuth credential (n8n Google OAuth or a Supabase-stored token). Confirm against the `calendar-account` memory (Google account `im@ivanmanfredi.com`).
- n8n workflow: poll Gmail (or push via Gmail watch) → upsert thread metadata (thread id, subject, participant emails, last message ts, snippet) into a new `email_threads` table.

### 3B — Resolve + timeline
- Extend the resolver to sweep `email_threads`: match by participant `email` (exact) → link as `email_thread`; unknown email → optionally create a contact (gate behind a "known-domain only" filter to avoid noise from newsletters/vendors).
- Extend `get_contact_360` timeline with `kind:'email'` events from linked threads.
- **Verify:** an email thread with a known contact's address appears on their timeline newest-first; vendor/newsletter noise does not create junk contacts.

### 3C — Signal-clusters unblock (bonus, same OAuth)
- Once Gmail flows, re-enable the signal-clusters Gmail input that's been erroring since 05-18.

---

## Sequencing note
Phase 2A (auto-resolve) and 2C (work queue) deliver the most marginal value after Phase 1 and have no external blockers — do them first. 2B/2D are polish. Phase 3 waits on OAuth regardless of Phase 2 progress, so it can proceed in parallel the moment OAuth lands.
