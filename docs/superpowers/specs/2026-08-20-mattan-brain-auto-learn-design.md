# Mattan Brain Auto-Learn — Design

**Status:** approved by Ivan 2026-08-20
**Plan:** `docs/superpowers/plans/2026-08-20-mattan-brain-auto-learn.md`

## Problem

The RISE reply drafter (n8n `uee9FUFHxdRrhjMB`) already learns Mattan's **voice** from his
hand-typed LinkedIn sends. It does not learn his **facts**, and the loop that detects a missing
fact has no path for the answer to come back.

Verified live on 2026-08-20:

1. `refresh_reply_exemplars()` (pg_cron, daily 05:30 UTC) harvests the last 8 `manual_mirror`
   outbound rows per client into `content_prompts.rise-reply-exemplars` (v18 at time of writing).
   Its header says: *"any factual claim still comes ONLY from the company-facts section."*
2. `content_prompts.rise-company-facts` is v5, `updated_at` **2026-07-31** — hand-maintained,
   20 days stale. It contains **no minimum-ad-spend line**. Its ICP line is a `$20k+/mo revenue`
   floor, a different axis.
3. On 2026-08-20 Mattan hand-typed to Jeremy Karp: *"No minimums on spend actually. We partner
   with brands starting with 5-10k a month."* That is a new fact. It is in the exemplar corpus as
   **style only**, and the drafter is explicitly forbidden from using it as a fact.
4. The drafter already runs a coverage judge (`COV_SYS`) that stamps `outreach_messages.context_gap`
   when it answers something facts do not cover, renders an "unverified answer" band with an
   **Ask Mattan** button, and pings WhatsApp. So the system detects the gap, asks Mattan, Mattan
   answers by hand on LinkedIn — and the answer dies as style. The loop is open.

### Defect found while verifying

`refresh_reply_exemplars()` pairs each reply with the preceding inbound using
`i.created_at < m.sent_at` — **insert time compared against send time**. Mirrored rows are
backfilled in batches, so `created_at` ordering inside a batch is arbitrary. Live proof:

| row | `sent_at` | `created_at` |
|---|---|---|
| INB "What is the minimum spend?" | 03:10:56 | 03:15:55.714 |
| OUT "No minimums on spend…"      | 03:12:42 | 03:15:55.446 |

The inbound's `created_at` is 0.27s *after* the reply's, so the query walked back six days and
paired the answer with `"Please do."`. Diffing the current 8 pairs against a `sent_at`-based
pairing: **2 of 8 are mispaired**. `ivan-reply-exemplars` shares the function and the bug.

## Design

### 1. One source of truth for exemplar pairs

New `reply_exemplar_pairs(p_client_id, p_limit)` returns structured pairs, pairing on
`coalesce(sent_at, created_at)` and excluding reactions. `refresh_reply_exemplars()` is rewritten
to build its blob from that function, so the prompt row and the evidence the drafter records can
never drift.

### 2. Facts are learned, never auto-written to canon

New `learned_facts` table. A new n8n workflow (**Outreach - Fact Learner**) scans recent
`manual_mirror` replies, pairs them correctly, and asks whether the reply states something about
RISE that is not already covered. Candidates land `status='pending'` and ping WhatsApp. Ivan
approves or rejects in the Client Ops inbox. Canon (`rise-company-facts`) is never rewritten by a
machine.

Approved facts are injected into the drafter as a block **below** RISE FACTS, labelled as newer
and outranking it. The same block is fed to the coverage judge so a known fact stops being
flagged as uncovered.

### 3. Recency priority (Ivan, 2026-08-20)

*"Most recent manual replies from Mattan should take knowledge priority."* Implemented three ways:

- Each fact carries a `topic` key. The drafter injects `distinct on (topic)` ordered by
  `source_sent_at desc` — for any topic, only Mattan's newest statement reaches the model.
- Approving a candidate marks any older approved fact on the same `topic` as `superseded`.
- The injected block is explicitly labelled as outranking `rise-company-facts` on conflict.

### 4. Evidence is logged, not self-reported

New `outreach_messages.draft_evidence` jsonb, written by the drafter, rendered as a `<details>`
collapsible under the draft body. The drafter records **what it injected** — facts row version,
which learned facts, which exemplar pairs (with real prospect + send date), store fact, anchor,
scan finding, operator note, voice row versions.

This is deterministic. A model asked "which sources did you use?" confabulates; logging the
inputs cannot. The collapsible answers Ivan's question — *"is this from Mattan's by-hand DM two
months ago, and is it correct?"* — with the original date, prospect, and verbatim quote.

## Non-goals

- No automatic write to `content_prompts`. Canon stays hand-approved.
- No change to send gating. Approving a draft is untouched; the evidence panel is read-only.
- The Fact Learner is enabled for `risedtc` only in this pass. The table is `client_id`-keyed so
  `ivan` can be switched on later without schema change.
