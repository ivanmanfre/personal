import { test, expect } from 'vitest';
import { initialScheduleInput, toDatetimeLocalString } from './findNextSlot';

test('initialScheduleInput returns empty string for missing/invalid times', () => {
  expect(initialScheduleInput(null)).toBe('');
  expect(initialScheduleInput(undefined)).toBe('');
  expect(initialScheduleInput('')).toBe('');
  expect(initialScheduleInput('not-a-date')).toBe('');
});

test('initialScheduleInput renders a valid scheduled_at as a datetime-local seed', () => {
  const iso = '2026-06-11T22:30:00Z';
  const out = initialScheduleInput(iso);
  expect(out).not.toBe('');
  // matches the YYYY-MM-DDTHH:mm shape and the same local conversion the input uses
  expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  expect(out).toBe(toDatetimeLocalString(new Date(iso)));
});
