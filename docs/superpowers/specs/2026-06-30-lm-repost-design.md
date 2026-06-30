# Lead-Magnet Repost — Design Spec

**Date:** 2026-06-30
**Status:** Approved design, pre-plan
**Author:** Ivan + Claude (brainstorming)
**Scope:** Dashboard feature to re-post an already-published lead magnet with fresh, fully-filtered promo copy into the next open slot.

---

## Problem

Some lead magnets are good resources but underperformed on their first post. Today there is no way to give one a second run: published items are read-only on the calendar, and the only path is to ask Claude to do it manually. Ivan wants a self-serve **Repost** action.

Motivating case: **"The Agency Operating System for Claude Code"** (`lm_drafts_v2.id = cafcec96-5d15-4fd4-a4d8-ef6ed83997bc`, format `AI Kit`, slug `the-agency-operating-system-for-claude-code`). Posted once on 2026-06-24 13:00 (`scheduled_posts.id = 0124728c-...`, status `posted`), underperformed. The resource itself is live and good.

## Goal

One-click **Repost** that:
1. Keeps the **same** lead-magnet resource (no change to `resource_html`, `cover_url`, `slug`, or the live page).
2. Generates **fresh** LinkedIn promo copy (new angle, not the old hook).
3. Runs that copy through **all** the normal copy filters (same stack as the main Post Generation pipeline).
4. Queues it into the **next open slot** as an **editable** pending post (editable on the calendar AND in the LM editor).

**Non-goals (now):** regular text/carousel/video posts (LMs only this round); cloning the resource; bulk repost; auto-scheduling a recurring repost cadence.

---

## Decisions (locked)

| Decision | Choice |
|---|---|
| Copy on repost | Fresh angle, regenerated (not verbatim) |
| Copy quality | Must pass **all** copy filters (lint + QA), same as post-gen |
| Editable after | Yes — on the calendar and in the LM edit view |
| Scope | Lead magnets only (for now) |
| Placement | Calendar (published chip) **and** LM editor / library |
| Slot | Next open slot via `findNextSlot()` |
| Recency guard | **Warn only** ("last posted N days ago"), never block |
| Resource | Untouched — same asset, new doorway |

---

## Chosen approach: A — promo-only regenerate + schedule

Rejected alternatives:
- **B (clone + full regenerate):** re-runs the whole generator, producing a new slug/live page — that is not "the same lead magnet."
- **C (re-queue verbatim copy):** fails the "fresh copy through the filters" requirement and risks LinkedIn duplicate-content suppression.

---

## Architecture

### Frontend

- **Calendar** (`components/dashboard/PostCalendarView.tsx` + `components/dashboard-v2/sections/Calendar.tsx`):
  - Today, `posted` chips are effectively read-only. Add: clicking a `posted` **LM** chip opens a small panel with a **Repost** button.
  - Confirm copy: "Generate a fresh promo for this lead magnet and queue it for the next slot?" plus the warn-only recency line.
  - On success: toast + a new **pending** chip appears at the computed next slot (editable/draggable per existing `pending`/`queued_v2` rules in `calendarItems.ts`).
- **LM editor** (`components/dashboard/LeadMagnetEditor.tsx`): add a **Repost** button in the action bar, enabled when status ∈ {`published`, `scheduled`, `posted`}. Same confirm + recency warning.
- **LM library** (`components/dashboard/LeadMagnetStudioPanel.tsx`): optional row-level Repost action (secondary; editor button is primary).

### Backend — promo-only regen path

A focused path that takes `draft_id` and regenerates **only** the promo copy. Preferred implementation: a new `phase: 'repost'` (a.k.a. promo-only) branch in the existing LM generation workflow so it **reuses the promoter node and the lint house-pattern** rather than duplicating prompt wiring. Exact home (n8n branch in the LM gen workflow vs. a small dedicated edge function) is resolved during planning; the contract below is fixed.

**Input:** `{ draft_id }`

**Steps:**
1. Load the LM (`topic`, `format`, `spec`, existing `resource_html` summary) and the **previously-posted** `post_text` (most recent `posted` `scheduled_posts` row for this `draft_id`).
2. Generate fresh promo copy with **anti-repeat steering** (prompt receives the prior `post_text` and is instructed to take a different angle/hook).
3. Run the fresh copy through the **full filter stack**, mirroring post-gen:
   - blocked-moves injection (`content-lint` `{preview:true}`),
   - forbidden-language + author-voice + structural-move-budget prompts,
   - **blocking** `content-lint` gate on the **`post`** profile (this is a LinkedIn feed post), regen-on-fail up to 2 attempts,
   - QA scorer with the AI_TELLS hard floor.
4. On pass: write fresh `post_body` to `lm_drafts_v2`; record a repost marker in `lm_drafts_v2.spec` (see Data).
5. Compute `findNextSlot()` and create a **new** `scheduled_posts` row: `clickup_task_id = draft_id`, `post_text =` fresh copy, `post_format = 'text'`, `scheduled_at =` next slot, `status = 'pending'`, `platform = 'linkedin'`.

**Untouched:** `resource_html`, `cover_url`, `og_url`, `slug`, the live page.

### Publish

No change. The existing **Scheduled Post Publisher** (`0Ym6bP7gEmskPJZn`) picks up the new `pending` row when `scheduled_at <= now()` and posts it.

---

## Data & source of truth

- **`scheduled_posts.post_text`** on the new pending row is the canonical thing that posts and is what the calendar editor (`ScheduledPostEditor.tsx`) edits.
- **`lm_drafts_v2.post_body`** is overwritten with the fresh copy. The **original** posted copy is preserved on the old `posted` `scheduled_posts` row, so nothing is lost.
- **Sync:** an edit to `post_body` in the LM editor while a repost is pending must propagate to the pending row's `post_text` (and vice-versa) so the two don't diverge. This mirrors the existing LM-editor → scheduled-row relationship; planning confirms the exact write path (likely `lm-schedule` / row update).
- **Repost marker:** append to `lm_drafts_v2.spec.reposts` an entry `{ source_posted_id, requested_at }` so future analytics can measure whether reposts perform.

---

## Recency guard (warn only)

Before firing, look up the most recent `posted` row for the LM. Show "last posted N days ago" in the confirm dialog. Never block. (For the motivating case: posted 2026-06-24, next slot ≈ 2026-07-01 ≈ 7 days — fine.)

---

## Failure modes

| Failure | Behavior |
|---|---|
| Lint give-up after 2 regens | Nothing scheduled; surface `LINT_FAIL` note on the LM; no `scheduled_posts` row created. |
| Claude proxy down on a failing draft | Fail-closed; toast error; no row created. |
| `content-lint` endpoint down | Fail-open (`lint_skipped`) — consistent with post-gen house pattern. |
| No slot within 30 days | `findNextSlot()` fallback (~36h out); row still created. |
| Double-click / duplicate fire | Guard against creating two pending rows for the same LM (check for an existing non-posted row first). |

---

## Testing

- **Unit:** anti-repeat steering produces copy distinct from the prior `post_text`; repost marker written to `spec`.
- **Filter:** fresh copy passes the `post`-profile `content-lint` gate; a deliberately bad generation triggers regen then give-up cleanly.
- **Scheduling:** new row lands at `findNextSlot()` time with status `pending`; appears as an editable chip on the calendar; editing it on the calendar updates `post_text`.
- **Idempotency:** second Repost click while one is pending does not create a duplicate.
- **End-to-end (dry):** run against the motivating LM in a non-publishing window; verify the resource/slug/live page are untouched.

---

## Open items for planning

1. Confirm whether the promo-only path is best as a `phase` branch in the LM gen workflow vs. a dedicated `lm-repost` edge function (reuse vs. isolation).
2. Confirm the exact write path that keeps `post_body` ↔ pending `scheduled_posts.post_text` in sync (extend `lm-schedule`?).
3. Confirm the `content-lint` profile for LM promo copy is `post` (feed) and that the gate is wired into the repost path.
4. Worktree + refspec push plan for landing this on personal-site `main` safely (per concurrent-git-hazard).
