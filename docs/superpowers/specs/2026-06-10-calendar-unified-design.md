# Unified Content Calendar — design

**Date:** 2026-06-10
**Branch:** `feat/calendar-unified`
**Component:** `components/dashboard-v2/sections/Calendar.tsx` (+ `PostCalendarView`, new `ScheduledPostEditor`)

## Problem

Posts are publishing that never appear on the dashboard calendar. Root cause is a
**calendar coverage gap**, not a scheduling bug — every post fires at its correct
time (`posted_at ≈ scheduled_at`, no drift; this is distinct from the 2026-06-06
bridge-reschedule-desync incident).

`Calendar.tsx` renders exactly two kinds of chips:

1. `carousel_drafts` rows with a `scheduled_at` (post chips), and
2. `scheduled_posts` rows whose text matches the `comment "KEYWORD"` LM pattern (LM chips).

Anything that lives **only** in `scheduled_posts` — no `carousel_drafts` row and no
"comment X" CTA — publishes normally but is **invisible**. Evidence (last ~60h): of 8
published posts, 3 were invisible (plain text/image LinkedIn posts). 3 more upcoming
posts are also invisible, including one publishing the same day.

Secondary asks:
- LM chips can't be opened/edited from the calendar — clicking redirects to another
  section (`?section=content&sub=leadmagnets&open=<id>`).
- Want to drag chips between days. (The drag engine already exists — see below — but
  invisible posts can't be dragged because they aren't rendered.)

## Decisions (locked)

- **Approach A — calendar becomes the unified surface.** Treat `scheduled_posts` as a
  first-class calendar source. No n8n or schema changes. (Approach B — make generators
  write `carousel_drafts` rows — rejected: invasive, risky, ignores the LM/drag asks.)
- **LinkedIn only** on the calendar. Instagram rows in `scheduled_posts` stay out. No
  platform badges, no LI/IG twin-merging.
- **Plain queue posts get full edit** (body + media + schedule).
- **Image editing** in the new sheet = view + remove + replace-by-upload.
- **Cancel** on a queue post marks the row `status = 'cancelled'` (keeps the record);
  it does **not** delete.

## Existing building blocks (no rebuild needed)

- `useContentLibrary` → `carousel_drafts` (posts), with `applyOptimistic`/`refresh`.
- `useContentPipeline` → already fetches **all** `scheduled_posts` (`select('*')`).
- `PostCalendarView` → already has full drag-and-drop via `@dnd-kit` (`useDraggable`/
  `useDroppable`, `onDragEnd` → `onReschedule(item, isoDate)`), and renders chips by
  `item.kind` + `tone`.
- `CarouselEditor` (post editor), `LeadMagnetEditor` (LM editor), `Sheet` (right panel).

## Design

### 1. Item sources (in `Calendar.tsx` `items` memo)

All three sources are filtered to **LinkedIn only**.

| kind        | source                                                                 | shown as            |
|-------------|------------------------------------------------------------------------|---------------------|
| `post`      | `carousel_drafts` with `scheduledAt` *(unchanged)*                     | Post chip           |
| `lm`        | `scheduled_posts`, LinkedIn, matches `LM_PATTERN` *(unchanged)*        | LM chip             |
| `post-queue`| `scheduled_posts`, LinkedIn, **not** LM-pattern, **not** carousel-backed | Queue post chip   |

**Dedup:** build `draftIds = new Set(posts.map(p => p.id))`. A `scheduled_posts` row
whose `clickupTaskId` is in `draftIds` is already a `post` chip → excluded from
`post-queue`. (Post-migration, `scheduled_posts.clickup_task_id` holds the
`carousel_drafts.id`.) Order of precedence: `post` > `lm` > `post-queue`.

**Platform filter:** `q.platform === 'linkedin'` (or null/undefined treated as
linkedin for safety) applied to both `lm` and `post-queue`.

### 2. Status → tone

Extend `SP_STATUS_TO_TONE` so `queued_v2 → 'scheduled'` (currently falls through to the
default). Existing mappings unchanged.

### 3. Open / edit (click chip → Sheet)

- `post` → `CarouselEditor` in the existing full Sheet *(unchanged)*.
- `lm` → open `LeadMagnetEditor` in a Sheet **in place** (remove the URL redirect in
  `onOpenItem`). Editor keys off the `lm_drafts_v2`/scheduled_posts id it already uses.
- `post-queue` → new **`ScheduledPostEditor`** Sheet.

#### `ScheduledPostEditor` (new component)

- **Props:** `postId: string`, `onClose`, `onSaved`.
- **Loads** the `scheduled_posts` row by id (or receives it from the already-loaded
  `queue` array — preferred, avoids a fetch).
- **Fields:**
  - `post_text` — textarea.
  - media — render `media_urls[]` thumbnails; per-image **remove**; **replace/add via
    upload** to the same Supabase storage bucket the dashboard already uses for post
    media (reuse the existing upload helper; if none is shared, lift the one
    `CarouselEditor` uses). Writes the resulting public URL back into `media_urls`.
  - `scheduled_at` — date + time control (reuse the calendar's local-tz convention).
- **Actions:**
  - **Save** → `update scheduled_posts set post_text, media_urls, scheduled_at where id`.
  - **Cancel post** → `update scheduled_posts set status = 'cancelled' where id`
    (confirmation prompt; keeps the record).
  - On save/cancel → `refreshQueue()` + close.
- **Guard:** if `status` is `posted`/`posting`, fields are read-only (can't edit a post
  that already went out) — show a notice.

### 4. Reschedule handlers (drag + sheet date change)

- `post` → existing `reschedulePost` (writes `carousel_drafts.scheduled_at` + syncs the
  pending `scheduled_posts` twin). Unchanged.
- `lm` and `post-queue` → both write `scheduled_posts.scheduled_at` by row id. The
  existing `rescheduleLm` already does exactly this; generalize/rename it to
  `rescheduleQueueRow` and route both kinds to it. Preserves time-of-day, defaults
  09:00 local when the row had none.

`onReschedule` routing: `item.kind === 'post' ? reschedulePost : rescheduleQueueRow`.

### 5. Chip kind indicator

Small text/glyph prefix per kind so the three are distinguishable at a glance
(e.g. `Post` / `LM` / `Queue`, or a single-letter badge). Keep within the existing
chip styling in `PostCalendarView.ItemChip`.

### 6. Realtime

Verify `scheduled_posts` is in the `supabase_realtime` publication so queue chips
live-update like `carousel_drafts`/`lm_drafts_v2` (added 2026-06-04). If absent:
`ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_posts;`. The
`useContentPipeline` subscription code must exist for this to matter — confirm during
implementation; otherwise `refreshQueue()` after edits covers correctness.

## Components & boundaries

- **`Calendar.tsx`** — orchestrator: builds the 3-source `items` list, routes open +
  reschedule by `kind`, hosts the three editor Sheets. No data fetching of its own.
- **`ScheduledPostEditor.tsx`** (new) — self-contained editor for one `scheduled_posts`
  row. Depends on `supabase`, `Sheet`, the shared media-upload helper. Does not know
  about the calendar.
- **`PostCalendarView.tsx`** — presentation + drag only; gains the kind indicator. No
  source/data logic.
- **Hooks** — unchanged (already fetch all rows).

## Out of scope (YAGNI / follow-ups)

- Making n8n generators write `carousel_drafts` rows for queue posts.
- Instagram on the calendar; platform badges; LI/IG twin-merge.
- Bulk reschedule / multi-select.

## Testing

- **Unit (items memo):** given mixed `posts` + `queue` fixtures, assert: carousel-backed
  scheduled_posts row is deduped (one `post` chip, no `post-queue`); LM-pattern row →
  `lm`; plain LinkedIn row → `post-queue`; Instagram row → excluded; `queued_v2` →
  `scheduled` tone.
- **Reschedule routing:** `post` calls carousel update + queue sync; `lm`/`post-queue`
  call scheduled_posts update by id.
- **`ScheduledPostEditor`:** save writes the three fields; cancel sets `cancelled`;
  posted/posting rows render read-only.
- **Manual (self-tested screenshots, per visual-work rule):** the 3 currently-invisible
  posts now appear; open each kind from a chip; drag a queue post to another day and
  confirm both the chip and the DB row move; edit a queue post body + image and confirm
  it persists.
