// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { isNightUrl } from './perf-kit/night';

const at = (search: string) => window.history.replaceState(null, '', `/client/x${search}`);

describe('per-board theme default', () => {
  afterEach(() => at(''));

  it('keeps every board dark when the board sets no theme', () => {
    at('');
    expect(isNightUrl()).toBe(true);
    expect(isNightUrl(undefined)).toBe(true);
    expect(isNightUrl('dark')).toBe(true);
  });

  it('opens a board set to light in light', () => {
    at('?k=abc');
    expect(isNightUrl('light')).toBe(false);
  });

  it('lets the URL override the board setting both ways', () => {
    at('?light');
    expect(isNightUrl()).toBe(false);
    at('?night');
    expect(isNightUrl('light')).toBe(true);
  });
});
