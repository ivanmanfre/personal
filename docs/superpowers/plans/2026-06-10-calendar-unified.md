# Unified Content Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every LinkedIn post (including plain `scheduled_posts` rows with no draft and no LM CTA) appear on the dashboard calendar, openable/editable in place, and draggable between days.

**Architecture:** The calendar gains a third item source. A pure `buildCalendarItems(posts, queue, lmDraftIds)` function merges `carousel_drafts` posts + LM-pattern `scheduled_posts` + plain LinkedIn `scheduled_posts`, deduping queue rows already shown as posts. `Calendar.tsx` wires three open targets (CarouselEditor / LeadMagnetEditor / new ScheduledPostEditor) and routes reschedule by kind. Drag already works via `@dnd-kit`.

**Tech Stack:** React 19, TypeScript, Vite, Supabase JS, `@dnd-kit/core`, vitest (added in Task 1).

**Worktree:** `/tmp/ps-calendar` on branch `feat/calendar-unified` (isolated — personal-site `main` has live automation committing concurrently).

---

## File Structure

- **Create** `vitest.config.ts` — minimal vitest config (jsdom not needed; pure-function tests only).
- **Create** `components/dashboard-v2/sections/calendarItems.ts` — pure source-merge logic + shared `CalendarItem`-building types. Single responsibility: turn raw rows into calendar items.
- **Create** `components/dashboard-v2/sections/calendarItems.test.ts` — unit tests for the merge/dedup/filter logic.
- **Create** `components/dashboard/ScheduledPostEditor.tsx` — editor Sheet for one `scheduled_posts` row (body + media + schedule + cancel).
- **Modify** `components/dashboard/PostCalendarView.tsx` — add `'post-queue'` kind (glyph + palette).
- **Modify** `components/dashboard-v2/sections/Calendar.tsx` — use `buildCalendarItems`, add LM/queue editors, route reschedule by kind, `queued_v2` tone.
- **Modify** `package.json` — add `"test"` script + vitest devDeps.

---

## Task 1: Add vitest (test infra)

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `components/dashboard-v2/sections/__smoke__.test.ts` (temporary smoke test, deleted in Step 5)

- [ ] **Step 1: Install vitest**

Run:
```bash
cd /tmp/ps-calendar && npm install -D vitest@^2
```
Expected: adds `vitest` to devDependencies, exits 0.

- [ ] **Step 2: Add config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
```

- [ ] **Step 3: Add test script**

In `package.json` `"scripts"`, add after `"preview": "vite preview"`:
```json
    "preview": "vite preview",
    "test": "vitest run"
```
(Add the comma after the `preview` line.)

- [ ] **Step 4: Smoke test**

Create `components/dashboard-v2/sections/__smoke__.test.ts`:
```ts
import { test, expect } from 'vitest';
test('vitest runs', () => { expect(1 + 1).toBe(2); });
```
Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 5: Remove smoke test + commit**

```bash
cd /tmp/ps-calendar && rm components/dashboard-v2/sections/__smoke__.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for pure-logic unit tests"
```

---

## Task 2: Pure source-merge function (TDD)

This is the bug-prone core — the dedup/filter logic that caused the original coverage gap. Test it directly.

**Files:**
- Create: `components/dashboard-v2/sections/calendarItems.ts`
- Test: `components/dashboard-v2/sections/calendarItems.test.ts`

- [ ] **Step 1: Write the failing test**

Create `components/dashboard-v2/sections/calendarItems.test.ts`:
```ts
import { test, expect } from 'vitest';
import { buildCalendarItems, type PostRow, type QueueRow } from './calendarItems';

const post = (over: Partial<PostRow> = {}): PostRow => ({
  id: 'd1', title: 'Draft post', status: 'approved', scheduledAt: '2026-06-12T12:00:00Z', ...over,
});
const q = (over: Partial<QueueRow> = {}): QueueRow => ({
  id: 'q1', clickupTaskId: 'x', postText: 'hello world', platform: 'linkedin',
  status: 'pending', scheduledAt: '2026-06-12T12:00:00Z', ...over,
});

test('carousel-backed posts render as post chips', () => {
  const items = buildCalendarItems([post()], []);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ id: 'd1', kind: 'post' });
});

test('posts with no scheduledAt are excluded', () => {
  expect(buildCalendarItems([post({ scheduledAt: null })], [])).toHaveLength(0);
});

test('LM-pattern queue rows render as lm chips with editId = clickupTaskId', () => {
  const items = buildCalendarItems([], [q({ id: 'q9', clickupTaskId: 'lm-draft-9', postText: 'Want it? comment "GROWTH" below' })]);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ id: 'q9', kind: 'lm', editId: 'lm-draft-9' });
  expect(items[0].title.startsWith('GROWTH')).toBe(true);
});

test('plain LinkedIn queue rows render as post-queue chips', () => {
  const items = buildCalendarItems([], [q({ id: 'q2', postText: 'A plain hot take' })]);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ id: 'q2', kind: 'post-queue' });
});

test('queue row already shown as a post is deduped (clickupTaskId matches a draft id)', () => {
  const items = buildCalendarItems([post({ id: 'd5' })], [q({ id: 'q5', clickupTaskId: 'd5' })]);
  expect(items.filter((i) => i.kind === 'post-queue')).toHaveLength(0);
  expect(items.filter((i) => i.kind === 'post')).toHaveLength(1);
});

test('non-linkedin queue rows are excluded', () => {
  expect(buildCalendarItems([], [q({ platform: 'instagram' })])).toHaveLength(0);
});

test('null platform is treated as linkedin', () => {
  expect(buildCalendarItems([], [q({ platform: null })])).toHaveLength(1);
});

test('queued_v2 maps to scheduled tone', () => {
  const items = buildCalendarItems([], [q({ status: 'queued_v2' })]);
  expect(items[0].tone).toBe('scheduled');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './calendarItems'`.

- [ ] **Step 3: Write the implementation**

Create `components/dashboard-v2/sections/calendarItems.ts`:
```ts
import type { CalendarItem, CalendarTone } from '../../dashboard/PostCalendarView';

/** Minimal shape from useContentLibrary (carousel_drafts). */
export interface PostRow {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
}

/** Minimal shape from useContentPipeline (scheduled_posts). */
export interface QueueRow {
  id: string;
  clickupTaskId: string | null;
  postText: string;
  platform: string | null;
  status: string;
  scheduledAt: string | null;
}

const LM_PATTERN = /\bcomment\s+["“”]?(\w+)["“”]?\b/i;

// scheduled_posts.status → calendar tone vocabulary.
const SP_STATUS_TO_TONE: Record<string, CalendarTone> = {
  pending: 'scheduled',
  queued_v2: 'scheduled',
  posting: 'generating',
  posted: 'published',
  failed: 'failed',
  cancelled: 'cancelled',
};

function isLinkedIn(platform: string | null): boolean {
  return !platform || platform === 'linkedin';
}

function queueTitle(postText: string, keyword?: string): string {
  const firstLine = (postText.split('\n').find((l) => l.trim()) || '').trim();
  const base = firstLine.length > 60 ? firstLine.slice(0, 60) + '…' : firstLine;
  if (keyword) return `${keyword} — ${base || keyword}`;
  return base || '(untitled)';
}

/**
 * Merge the three calendar sources into a single chip list:
 *  - `post`       ← carousel_drafts with a scheduledAt
 *  - `lm`         ← LinkedIn scheduled_posts matching the "comment X" CTA
 *  - `post-queue` ← LinkedIn scheduled_posts that are neither LM nor already
 *                   shown as a post (clickupTaskId not in draft ids)
 * LinkedIn-only. Precedence post > lm > post-queue.
 */
export function buildCalendarItems(posts: PostRow[], queue: QueueRow[]): CalendarItem[] {
  const out: CalendarItem[] = [];
  const draftIds = new Set(posts.map((p) => p.id));

  for (const p of posts) {
    if (!p.scheduledAt) continue;
    out.push({
      id: p.id,
      title: p.title,
      kind: 'post',
      scheduledAt: p.scheduledAt,
      tone: (p.status as CalendarTone) || 'scheduled',
      statusLabel: p.status,
    });
  }

  for (const qr of queue) {
    if (!isLinkedIn(qr.platform)) continue;
    // Already represented as a post chip — skip its queue twin.
    if (qr.clickupTaskId && draftIds.has(qr.clickupTaskId)) continue;
    const tone = SP_STATUS_TO_TONE[qr.status] || 'scheduled';
    const lm = qr.postText.match(LM_PATTERN);
    if (lm) {
      out.push({
        id: qr.id,
        title: queueTitle(qr.postText, lm[1].toUpperCase()),
        kind: 'lm',
        editId: qr.clickupTaskId || undefined,
        scheduledAt: qr.scheduledAt,
        tone,
        statusLabel: qr.status,
      });
    } else {
      out.push({
        id: qr.id,
        title: queueTitle(qr.postText),
        kind: 'post-queue',
        scheduledAt: qr.scheduledAt,
        tone,
        statusLabel: qr.status,
      });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS, 8 tests. (This depends on the `CalendarItem.kind`/`editId` type change in Task 3 — if TS complains about `'post-queue'` or `editId`, do Task 3 Step 1 first, then re-run. Vitest transpiles per-file so runtime tests pass regardless, but keep the type source honest.)

- [ ] **Step 5: Commit**

```bash
cd /tmp/ps-calendar && git add components/dashboard-v2/sections/calendarItems.ts components/dashboard-v2/sections/calendarItems.test.ts
git commit -m "feat(calendar): pure source-merge with dedup + LinkedIn filter"
```

---

## Task 3: Extend CalendarItem type + PostCalendarView kind

**Files:**
- Modify: `components/dashboard/PostCalendarView.tsx:35` (the `CalendarItemKind` type + `CalendarItem` interface) and the `ItemChip` glyph/palette (~lines 158-165).

- [ ] **Step 1: Extend the kind + interface**

In `components/dashboard/PostCalendarView.tsx`, change:
```ts
export type CalendarItemKind = 'post' | 'lm';
```
to:
```ts
export type CalendarItemKind = 'post' | 'lm' | 'post-queue';
```
And in the `CalendarItem` interface, add after `statusLabel?: string;`:
```ts
  // For lm chips: the lm_drafts_v2 id used to open the LM editor (the chip's
  // `id` is the scheduled_posts row id, used for drag/reschedule).
  editId?: string;
```

- [ ] **Step 2: Add a glyph import**

In the `lucide-react` import line of `PostCalendarView.tsx`, ensure `Clock` is imported alongside `FileText`/`Magnet` (add `Clock` if absent).

- [ ] **Step 3: Handle the new kind in ItemChip**

Replace these two lines in `ItemChip` (~163-165):
```ts
  const palette = item.kind === 'lm' ? TONE_COLOR_LM : TONE_COLOR_POST;
  const tone = palette[item.tone] || palette.idea;
  const Glyph = item.kind === 'lm' ? Magnet : FileText;
```
with:
```ts
  const palette = item.kind === 'lm' ? TONE_COLOR_LM : TONE_COLOR_POST;
  const tone = palette[item.tone] || palette.idea;
  const Glyph = item.kind === 'lm' ? Magnet : item.kind === 'post-queue' ? Clock : FileText;
```
(Queue posts reuse the post palette but get the Clock glyph so the three kinds are visually distinct.)

- [ ] **Step 4: Typecheck**

Run: `cd /tmp/ps-calendar && npx tsc --noEmit`
Expected: no new errors referencing `PostCalendarView.tsx` or `calendarItems.ts`. (Pre-existing repo errors elsewhere, if any, are out of scope — confirm none are newly introduced by these files.)

- [ ] **Step 5: Commit**

```bash
cd /tmp/ps-calendar && git add components/dashboard/PostCalendarView.tsx
git commit -m "feat(calendar): add post-queue chip kind + editId field"
```

---

## Task 4: Wire Calendar.tsx to the three sources

**Files:**
- Modify: `components/dashboard-v2/sections/Calendar.tsx` (the `items` memo, lines ~28-83).

- [ ] **Step 1: Expose `platform` on the pipeline post type**

`ScheduledPost` from `useContentPipeline` does not currently expose `platform` (the column exists in the DB). Add it first so the merge can filter on it.

In `hooks/useContentPipeline.ts` `mapPost`, add to the returned object:
```ts
    platform: row.platform ?? null,
```
In `types/dashboard.ts`, add to the `ScheduledPost` interface:
```ts
  platform: string | null;
```

- [ ] **Step 2: Replace the inline items logic with buildCalendarItems**

In `Calendar.tsx`, delete the `LM_PATTERN` const (line ~28) and the `SP_STATUS_TO_TONE` const (lines ~31-37) — they now live in `calendarItems.ts`. Add the import near the other imports:
```ts
import { buildCalendarItems } from './calendarItems';
```
Replace the entire `items` memo (lines ~47-83) with:
```ts
  const items: CalendarItem[] = useMemo(
    () => buildCalendarItems(
      posts.map((p) => ({ id: p.id, title: p.title, status: p.status, scheduledAt: p.scheduledAt })),
      queue.map((qr) => ({
        id: qr.id,
        clickupTaskId: qr.clickupTaskId,
        postText: qr.postText,
        platform: qr.platform,
        status: qr.status,
        scheduledAt: qr.scheduledAt,
      })),
    ),
    [posts, queue],
  );
```

- [ ] **Step 3: Typecheck**

Run: `cd /tmp/ps-calendar && npx tsc --noEmit`
Expected: no new errors. `CalendarItem` import already present in Calendar.tsx.

- [ ] **Step 4: Commit**

```bash
cd /tmp/ps-calendar && git add components/dashboard-v2/sections/Calendar.tsx hooks/useContentPipeline.ts types/dashboard.ts
git commit -m "feat(calendar): render all three sources via buildCalendarItems"
```

---

## Task 5: Open LMs in place (LeadMagnetEditor in a Sheet)

**Files:**
- Modify: `components/dashboard-v2/sections/Calendar.tsx` (`onOpenItem`, sheets, hooks).

- [ ] **Step 1: Load LM drafts + add open state**

In `Calendar.tsx`, add imports:
```ts
import { useLeadMagnets } from '../../../hooks/useLeadMagnets';
import LeadMagnetEditor from '../../dashboard/LeadMagnetEditor';
```
In the component body, after the existing hooks:
```ts
  const { drafts: lmDrafts, refresh: refreshLm } = useLeadMagnets();
  const [openLmId, setOpenLmId] = useState<string | null>(null);
  const openLm = useMemo(() => lmDrafts.find((d) => d.id === openLmId) || null, [lmDrafts, openLmId]);
```

- [ ] **Step 2: Replace the LM redirect in onOpenItem**

Replace the `onOpenItem` body so the LM branch opens the editor in place:
```ts
  const onOpenItem = useCallback((item: CalendarItem) => {
    if (item.kind === 'post') {
      setOpenPostId(item.id);
    } else if (item.kind === 'lm') {
      if (item.editId) setOpenLmId(item.editId);
      else toast.error('No lead-magnet draft linked to this post');
    } else {
      setOpenQueueId(item.id); // post-queue → ScheduledPostEditor (Task 6)
    }
  }, []);
```

- [ ] **Step 3: Render the LM sheet**

After the existing post `<Sheet>` (around line 172), add:
```tsx
      <Sheet open={!!openLm} onClose={() => setOpenLmId(null)} size="full"
        title={openLm ? <span className="truncate">{openLm.title || 'Lead magnet'}</span> : ''}>
        {openLm && (
          <LeadMagnetEditor draft={openLm} onClose={() => setOpenLmId(null)} onChanged={() => { refreshLm(); refreshQueue(); }} />
        )}
      </Sheet>
```

- [ ] **Step 4: Typecheck**

Run: `cd /tmp/ps-calendar && npx tsc --noEmit`
Expected: only error remaining is `setOpenQueueId` undefined (defined in Task 6). If you run Task 6 next it resolves.

- [ ] **Step 5: Commit**

```bash
cd /tmp/ps-calendar && git add components/dashboard-v2/sections/Calendar.tsx
git commit -m "feat(calendar): open lead magnets in place instead of redirecting"
```

---

## Task 6: ScheduledPostEditor component

**Files:**
- Create: `components/dashboard/ScheduledPostEditor.tsx`
- Modify: `components/dashboard-v2/sections/Calendar.tsx` (queue open state + sheet)

- [ ] **Step 1: Create the editor**

Create `components/dashboard/ScheduledPostEditor.tsx`:
```tsx
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Save, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ScheduledPost } from '../../types/dashboard';

interface Props {
  post: ScheduledPost;
  onClose: () => void;
  onChanged: () => void;
}

const READONLY_STATUSES = new Set(['posted', 'posting']);

const ScheduledPostEditor: React.FC<Props> = ({ post, onClose, onChanged }) => {
  const readOnly = READONLY_STATUSES.has(post.status);
  const [text, setText] = useState(post.postText);
  const [media, setMedia] = useState<string[]>(post.mediaUrls || []);
  // datetime-local wants "YYYY-MM-DDTHH:mm" in local time.
  const [when, setWhen] = useState(() => {
    if (!post.scheduledAt) return '';
    const d = new Date(post.scheduledAt);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const path = `scheduled/${post.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error } = await supabase.storage.from('post-stills').upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('post-stills').getPublicUrl(path);
      setMedia((m) => [...m, data.publicUrl]);
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message || err}`);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const patch: Record<string, unknown> = { post_text: text, media_urls: media };
      if (when) patch.scheduled_at = new Date(when).toISOString();
      const { error } = await supabase.from('scheduled_posts').update(patch).eq('id', post.id);
      if (error) throw error;
      toast.success('Saved');
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(`Save failed: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  const cancelPost = async () => {
    if (!window.confirm('Cancel this post? It stays as a record but will not publish.')) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('scheduled_posts').update({ status: 'cancelled' }).eq('id', post.id);
      if (error) throw error;
      toast.success('Post cancelled');
      onChanged();
      onClose();
    } catch (err: any) {
      toast.error(`Cancel failed: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4 text-sm">
      {readOnly && (
        <div className="rounded-md bg-amber-500/10 ring-1 ring-amber-500/30 text-amber-300 px-3 py-2">
          This post already went out ({post.status}) — fields are read-only.
        </div>
      )}
      <label className="block">
        <span className="text-zinc-400 text-xs">Post text</span>
        <textarea
          value={text} disabled={readOnly} onChange={(e) => setText(e.target.value)}
          rows={12}
          className="mt-1 w-full rounded-md bg-zinc-900 ring-1 ring-zinc-700 px-3 py-2 text-zinc-100 disabled:opacity-60"
        />
      </label>

      <div>
        <span className="text-zinc-400 text-xs">Media</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {media.map((url) => (
            <div key={url} className="relative">
              <img src={url} alt="" className="h-20 w-20 object-cover rounded-md ring-1 ring-zinc-700" />
              {!readOnly && (
                <button
                  onClick={() => setMedia((m) => m.filter((u) => u !== url))}
                  className="absolute -top-1.5 -right-1.5 bg-zinc-800 ring-1 ring-zinc-600 rounded-full p-0.5"
                  title="Remove"
                ><X className="w-3 h-3" /></button>
              )}
            </div>
          ))}
          {!readOnly && (
            <label className="h-20 w-20 grid place-items-center rounded-md ring-1 ring-dashed ring-zinc-600 cursor-pointer hover:bg-zinc-900">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 text-zinc-400" />}
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.currentTarget.value = ''; }} />
            </label>
          )}
        </div>
      </div>

      <label className="block">
        <span className="text-zinc-400 text-xs">Scheduled time</span>
        <input type="datetime-local" value={when} disabled={readOnly} onChange={(e) => setWhen(e.target.value)}
          className="mt-1 block rounded-md bg-zinc-900 ring-1 ring-zinc-700 px-3 py-2 text-zinc-100 disabled:opacity-60" />
      </label>

      {!readOnly && (
        <div className="flex items-center justify-between pt-2">
          <button onClick={cancelPost} disabled={saving}
            className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs">
            <Trash2 className="w-3.5 h-3.5" /> Cancel post
          </button>
          <button onClick={save} disabled={saving || uploading}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-white">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
          </button>
        </div>
      )}
    </div>
  );
};

export default ScheduledPostEditor;
```

- [ ] **Step 2: Wire queue open state in Calendar.tsx**

Add the import:
```ts
import ScheduledPostEditor from '../../dashboard/ScheduledPostEditor';
```
Add state after `openLm`:
```ts
  const [openQueueId, setOpenQueueId] = useState<string | null>(null);
  const openQueue = useMemo(() => queue.find((q) => q.id === openQueueId) || null, [queue, openQueueId]);
```
Add the sheet after the LM sheet:
```tsx
      <Sheet open={!!openQueue} onClose={() => setOpenQueueId(null)} size="lg"
        title={openQueue ? 'Scheduled post' : ''}>
        {openQueue && (
          <ScheduledPostEditor post={openQueue} onClose={() => setOpenQueueId(null)} onChanged={refreshQueue} />
        )}
      </Sheet>
```

- [ ] **Step 3: Typecheck**

Run: `cd /tmp/ps-calendar && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd /tmp/ps-calendar && git add components/dashboard/ScheduledPostEditor.tsx components/dashboard-v2/sections/Calendar.tsx
git commit -m "feat(calendar): ScheduledPostEditor for plain queue posts"
```

---

## Task 7: Reschedule routing for all kinds

**Files:**
- Modify: `components/dashboard-v2/sections/Calendar.tsx` (`rescheduleLm` → generalize; `onReschedule`).

- [ ] **Step 1: Generalize the queue reschedule handler**

Rename `rescheduleLm` to `rescheduleQueueRow` (its body already updates `scheduled_posts.scheduled_at` by `item.id` — correct for both `lm` and `post-queue`). Keep the dependency array as `[queue, refreshQueue]`.

- [ ] **Step 2: Route both queue kinds**

Change `onReschedule`:
```ts
  const onReschedule = useCallback((item: CalendarItem, isoDate: string) => {
    return item.kind === 'post' ? reschedulePost(item, isoDate) : rescheduleQueueRow(item, isoDate);
  }, [reschedulePost, rescheduleQueueRow]);
```

- [ ] **Step 3: Typecheck**

Run: `cd /tmp/ps-calendar && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
cd /tmp/ps-calendar && git add components/dashboard-v2/sections/Calendar.tsx
git commit -m "feat(calendar): route drag-reschedule for lm + post-queue to scheduled_posts"
```

---

## Task 8: Realtime for scheduled_posts (verify, add if missing)

**Files:** none (DB check) — or a note for the operator.

- [ ] **Step 1: Check publication membership**

Run this SQL against the Supabase project (`bjbvqvzbzczjbatgmccb`):
```sql
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and tablename = 'scheduled_posts';
```
Expected: one row if already present.

- [ ] **Step 2: Add if missing + confirm subscription code exists**

If Step 1 returned nothing AND `useContentPipeline` has no realtime channel, the calendar relies on `refreshQueue()` after edits (correct but not live). Adding realtime is optional polish:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.scheduled_posts;
```
Only run this if Ivan wants live queue updates. Document the outcome; no code change required for correctness.

---

## Task 9: Manual verification (self-tested, per visual-work rule)

**Files:** none (verification only). Use the `playwright-driver` skill (dashboard profile) or local `npm run dev`.

- [ ] **Step 1: Build**

Run: `cd /tmp/ps-calendar && npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 2: Run unit tests**

Run: `npm test`
Expected: PASS, 8 tests.

- [ ] **Step 3: Visual check — coverage**

Launch the dashboard against this branch. Navigate to the Calendar. Confirm the 3 previously-invisible posts now appear:
- 06-10 "See? AI costs more than hiring someone now…" (post-queue, Clock glyph)
- 06-09 "Your AI writes a great proposal…" (post-queue)
- the upcoming 06-10 18:00 / 06-11 / 06-12 image posts (post-queue)
Capture a screenshot.

- [ ] **Step 4: Visual check — open each kind**

Click a `post` chip → CarouselEditor opens. Click an `lm` chip → LeadMagnetEditor opens in place (no navigation away). Click a `post-queue` chip → ScheduledPostEditor opens. Screenshot each.

- [ ] **Step 5: Functional check — edit + drag**

In a `post-queue` editor: change the body text and Save; reopen and confirm it persisted. Upload an image and confirm the thumbnail appears + persists. Drag a `post-queue` chip to another day; confirm the chip moves AND verify the DB row moved:
```sql
select id, scheduled_at, status from scheduled_posts where id = '<dragged row id>';
```
- [ ] **Step 6: Report results with screenshots; do not claim done until all steps pass.**

---

## Notes for the executor

- **Do NOT push to `main`.** When complete, use `superpowers:finishing-a-development-branch` to decide merge/PR. personal-site `main` is written by live automation — push the feature branch with a refspec, never a shared-tree checkout.
- The `editId` on `lm` chips is the `lm_drafts_v2.id` (= `scheduled_posts.clickup_task_id`); the chip `id` stays the `scheduled_posts.id` for drag/reschedule.
- If `npx tsc --noEmit` shows pre-existing errors unrelated to these files, note them but don't fix — out of scope.
