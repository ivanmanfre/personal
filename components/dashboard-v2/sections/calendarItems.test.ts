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

test('LM pattern matches curly “” quotes (real LinkedIn copy-paste)', () => {
  const items = buildCalendarItems([], [q({ id: 'q10', postText: 'Want it? comment “GROWTH” below' })]);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({ id: 'q10', kind: 'lm' });
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
