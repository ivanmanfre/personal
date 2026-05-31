# Signal Clusters — Cross-Conversation Intelligence

**Date:** 2026-05-31
**Status:** Design approved, pending spec review
**Origin:** Insight from Dan Carey (Anthropic Labs) talk "Designing with Claude: From prompt to production" — *"Have Claude do the cross-conversation analysis: find commonalities across conversations no single human would connect, but don't put it between you and the users."*

## Problem

Ivan's qualitative signal — what prospects/clients actually ask, struggle with, and object to — is scattered across silos that no one reads in aggregate:

- **Call transcripts** (`transcripts`, 21 rows) — discovery/sales calls: pain points, objections, buyer language
- **Inbound LinkedIn DM replies** (`outreach_messages WHERE direction='inbound'`, ~15 rows) — questions, objections
- **Inbound email** (Gmail inbox — *not currently ingested anywhere*) — client/prospect threads

No tool clusters these to surface recurring themes. Two distinct values are being left on the table:
1. **Content topics** — recurring questions/pains → what to post about, in buyers' own words
2. **Sales intelligence** — recurring objections/patterns across deals → positioning + objection handling

## Goal

A weekly, unattended workflow that ingests all three sources, clusters them with Claude into two separate buckets (Content / Sales), persists the clusters, and surfaces them in a dashboard panel. Lifts recurring signal that's currently invisible.

**Non-goals (YAGNI):**
- Not real-time. Weekly batch is enough at this volume.
- Not replacing the human in conversations — Claude only does post-hoc aggregate analysis.
- Not including LinkedIn comments (capture tables empty, engagement near-zero — no signal).
- Not including assessment intakes/diagnostics in v1 (forms, not conversations; trivial to add later).
- No alerting/automation off clusters in v1 — read-only surfacing.

## Architecture

```
[Gmail node]            ┐
[Supabase: transcripts] ├─► [Normalize Code node] ─► [Fetch ClickUp prompt]
[Supabase: inbound DMs] ┘                                      │
                                                               ▼
                              [HTTP → Railway proxy /v1/messages]  (standalone text-gen)
                                                               │
                                                               ▼
                              [Parse + strip fences] ─► [Write signal_clusters]
                                                               │
                                                               ▼
                              Dashboard: SignalClustersPanel (reads signal_clusters)
```

**Chosen approach: n8n workflow (not a Claude skill).** Rationale:
- Runs unattended on cron; no manual ritual.
- Gmail OAuth persists server-side (no interactive re-auth, unlike the Gmail MCP).
- Clustering prompt lives in a ClickUp prompt page (project hard rule) → fast iteration with zero n8n edits, neutralizing the usual "n8n LLM clustering is painful" objection.
- Clustering call uses the Railway proxy `/v1/messages` via **HTTP Request node** — the documented-safe proxy use (safe for standalone text-gen; only breaks on `lmChatAnthropic` agent chains). Free on Max plan.

**Auto-research lessons applied** (from `auto-research.md` bug list):
- Small batches; ask for compact structured JSON, not full prose.
- Always strip ` ```json ` fences before parsing.
- Supabase REST writes need BOTH `apikey` AND `Authorization: Bearer` headers.
- ClickUp page content is in `text_content`, fetched via v3 API.
- n8n Code nodes use `this.helpers.httpRequest()`, not `fetch()`.

## Components

### 1. Supabase table: `signal_clusters`

| column | type | notes |
|---|---|---|
| id | uuid pk | default gen_random_uuid() |
| run_date | date | the weekly run this cluster belongs to |
| bucket | text | `'content'` \| `'sales'` |
| theme | text | short cluster label |
| summary | text | 1–2 sentence description |
| frequency | int | # of source items in this cluster |
| quotes | jsonb | array of `{text, source, date}` representative quotes |
| source_mix | jsonb | `{calls: n, dms: n, email: n}` |
| suggested_action | text | content idea (content bucket) or objection-handling note (sales bucket) |
| created_at | timestamptz | default now() |

RLS: anon = SELECT only; service_role = ALL (mirror auto_research_sessions policy). Dashboard reads via anon key.

Optional `signal_runs` (run_date pk, item counts, model, status) — **deferred** unless run metadata is needed; `signal_clusters.run_date` covers display grouping for v1.

### 2. n8n workflow: "Signal Clusters — Weekly"

- **Schedule trigger** — weekly (e.g. Mon 06:00 UTC; avoid the crowded cron slot that OOM'd trackers — see `incident-own-post-tracker-fanout-oom`).
- **Gmail node** (new Google OAuth cred) — inbound messages, last 7d. Strip signatures/quoted replies in normalize step.
- **Supabase HTTP reads** — `transcripts` created last 7d (use `summary` + `topics` if present, else `transcript_text`); `outreach_messages WHERE direction='inbound' AND sent_at > now()-7d`.
- **Normalize (Code node)** — map all to `{source: 'call'|'dm'|'email', date, who, text}`; truncate over-long call transcripts to summary-level to control token size; `executeOnce`-safe.
- **Fetch ClickUp prompt** — new prompt page (see §3) via v3 API, read `text_content`.
- **HTTP Request → Railway proxy** — POST `/v1/messages`, model Opus, system = prompt page, user = JSON of normalized items. Ask for `{content_clusters: [...], sales_clusters: [...]}` matching the table shape.
- **Parse Code node** — strip fences, JSON.parse, flatten to one row per cluster with `bucket` set.
- **Write to Supabase** — insert into `signal_clusters` (both headers). Optional: delete prior rows for same `run_date` to keep idempotent re-runs clean.

### 3. ClickUp clustering prompt page

New page in content prompts doc (`2ky5ezad-...`). Defines: cluster qualitative items into themes; separate content-topic clusters from sales-intel clusters; for each, return theme, summary, frequency, 1–3 representative quotes (verbatim, with source), source_mix, and a suggested_action. Emphasize buyer's-own-words quotes for content; objection/pattern naming for sales. Output strict JSON, no prose, no fences.

### 4. Dashboard: `SignalClustersPanel.tsx` + `useSignalClusters.ts`

- Modeled on `AutoResearchPanel.tsx` / `useAutoResearch.ts`.
- Two tabs: **Content Topics** | **Sales Intelligence** (filter by `bucket`).
- Cluster card: theme, frequency badge, summary, expandable quotes (with source chips), source_mix mini-bar, suggested_action callout.
- Run selector: group by `run_date`, default latest.
- Empty state until first run.
- Registered in the dashboard nav under Systems (icon TBD — e.g. `MessagesSquare`).

## Data Flow

Sources → normalize to uniform items → ClickUp prompt + items → Railway proxy clusters → parse → `signal_clusters` insert → panel reads by latest `run_date`, splits by `bucket`.

## Error Handling

- Gmail/Supabase read failures: `onError=continueRegularOutput` so one dead source doesn't kill the run; log which source returned empty.
- Proxy non-200 or unparseable JSON: catch, log raw response, abort write (don't write partial garbage). No silent field writes (see `incident-post-gen-silent-field-writes`).
- Idempotency: re-running a given `run_date` replaces that date's rows.
- Token guard: cap normalized payload size; prefer transcript `summary` over full `transcript_text`.

## Testing

- **Normalize**: unit-pin sample rows from each source → assert uniform shape, signature stripping.
- **Clustering**: run proxy call against a fixed sample, assert valid JSON matching table schema, both buckets present.
- **Write**: assert rows land with correct `bucket`, `quotes` is valid jsonb, re-run replaces same `run_date`.
- **Panel**: render with seeded `signal_clusters` rows → both tabs populate, quotes expand, empty state when none.
- **E2E**: one real weekly run end-to-end; eyeball cluster quality on the 21 calls + inbound DMs + email.

## Prerequisites

1. Google/Gmail OAuth credential added in `n8n.ivanmanfredi.com` (confirm via n8nac, not n8n-mcp — that MCP is pointed at the wrong instance).
2. Create `signal_clusters` table + RLS.
3. Create ClickUp clustering prompt page.
4. Confirm Railway proxy `/v1/messages` reachable from n8n HTTP node (already used elsewhere).

## Open Risks

- **Low v1 volume** (21 calls + ~15 DMs + email) → early clusters may be thin. Acceptable; value compounds as volume grows. Surface item counts so thin runs are obvious, not silently "complete."
- **Inbound DM volume** is genuinely small — most outreach_messages are outbound. Email may become the richest source once ingested.
