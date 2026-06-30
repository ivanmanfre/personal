import { test, expect } from 'vitest';
import { daysSinceLastPosted } from './repostRecency';

test('returns whole days between last post and now', () => {
  expect(daysSinceLastPosted('2026-06-24T13:00:00Z', '2026-07-01T13:00:00Z')).toBe(7);
});

test('floors partial days', () => {
  expect(daysSinceLastPosted('2026-06-24T13:00:00Z', '2026-06-30T20:00:00Z')).toBe(6);
});

test('returns null when never posted', () => {
  expect(daysSinceLastPosted(null, '2026-07-01T00:00:00Z')).toBeNull();
});

test('returns null for an unparseable date', () => {
  expect(daysSinceLastPosted('not-a-date', '2026-07-01T00:00:00Z')).toBeNull();
});
