import { describe, it, expect } from 'vitest';
import { withinWindow } from './withinWindow';
const NOW = Date.parse('2026-07-03T00:00:00Z');
describe('withinWindow', () => {
  it('accepts a date inside the window', () => {
    expect(withinWindow('2026-06-28T00:00:00Z', 7, NOW)).toBe(true);
  });
  it('rejects a date older than the window', () => {
    expect(withinWindow('2026-06-01T00:00:00Z', 7, NOW)).toBe(false);
  });
  it('rejects null/invalid dates', () => {
    expect(withinWindow(null, 30, NOW)).toBe(false);
    expect(withinWindow('not-a-date', 30, NOW)).toBe(false);
  });
});
