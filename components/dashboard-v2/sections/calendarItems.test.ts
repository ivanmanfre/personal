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

test('queue rows whose clickupTaskId is a real lm_drafts_v2 id render as lm chips', () => {
  const items = buildCalendarItems(
    [], [q({ id: 'q9', clickupTaskId: 'lm-draft-9', postText: 'Want it? comment "GROWTH" below' })],
    ['lm-draft-9'],
  );
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ id: 'q9', kind: 'lm', editId: 'lm-draft-9' });
  expect(items[0].title.startsWith('GROWTH')).toBe(true);
});

test('lm chip keyword label matches curly “” quotes (real LinkedIn copy-paste)', () => {
  const items = buildCalendarItems(
    [], [q({ id: 'q10', clickupTaskId: 'lm-draft-10', postText: 'Want it? comment “GROWTH” below' })],
    ['lm-draft-10'],
  );
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ id: 'q10', kind: 'lm' });
  expect(items[0].title.startsWith('GROWTH')).toBe(true);
});

test('a comment-gated post that is NOT an lm draft renders as post-queue (not lm)', () => {
  // Regular posts often carry a "comment X" CTA but have no lm_drafts_v2 row;
  // routing them to the LM editor would silently fail to open.
  const items = buildCalendarItems(
    [], [q({ id: 'q3', clickupTaskId: '86ahmzd4f', postText: 'Grab it — comment "READY" and I\'ll send it' })],
    [], // no lm draft ids
  );
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ id: 'q3', kind: 'post-queue' });
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

// reschedulable: a chip can only be dragged if its underlying row can still be
// re-timed. Queue rows (lm/post-queue) re-time only while pending/queued_v2;
// carousel posts re-time until published. Anything already out / cancelled is
// locked — otherwise a drag silently no-ops (DB guard) and snaps back.
test('post-queue is reschedulable only while pending/queued_v2', () => {
  const pending = buildCalendarItems([], [q({ id: 'a', status: 'pending' })])[0];
  const queued = buildCalendarItems([], [q({ id: 'b', status: 'queued_v2' })])[0];
  const posted = buildCalendarItems([], [q({ id: 'c', status: 'posted' })])[0];
  const cancelled = buildCalendarItems([], [q({ id: 'd', status: 'cancelled' })])[0];
  expect(pending.reschedulable).toBe(true);
  expect(queued.reschedulable).toBe(true);
  expect(posted.reschedulable).toBe(false);
  expect(cancelled.reschedulable).toBe(false);
});

test('lm chip follows the same reschedulable rule as post-queue', () => {
  const live = buildCalendarItems([], [q({ id: 'l1', clickupTaskId: 'lm1', status: 'pending' })], ['lm1'])[0];
  const dead = buildCalendarItems([], [q({ id: 'l2', clickupTaskId: 'lm2', status: 'cancelled' })], ['lm2'])[0];
  expect(live).toMatchObject({ kind: 'lm', reschedulable: true });
  expect(dead).toMatchObject({ kind: 'lm', reschedulable: false });
});

test('carousel posts are reschedulable until published', () => {
  const approved = buildCalendarItems([post({ id: 'p1', status: 'approved' })], [])[0];
  const published = buildCalendarItems([post({ id: 'p2', status: 'published' })], [])[0];
  expect(approved.reschedulable).toBe(true);
  expect(published.reschedulable).toBe(false);
});

test('repost queue row whose clickup_task_id is an LM draft id is marked isRepost', () => {
  const items = buildCalendarItems(
    [],
    [q({ id: 'sp-1', clickupTaskId: 'lm-1', status: 'pending', isRepost: true })],
    ['lm-1'],
  );
  const chip = items.find((i) => i.id === 'sp-1');
  expect(chip).toMatchObject({ kind: 'lm', tone: 'scheduled', isRepost: true });
});
