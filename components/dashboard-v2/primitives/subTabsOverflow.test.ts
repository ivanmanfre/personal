import { describe, it, expect } from 'vitest';
import { computeRightOverflow } from './subTabsOverflow';

describe('computeRightOverflow', () => {
  it('returns 0 when content fits entirely (no overflow)', () => {
    expect(computeRightOverflow({ scrollWidth: 400, clientWidth: 400, scrollLeft: 0, tabCount: 9 })).toBe(0);
    expect(computeRightOverflow({ scrollWidth: 380, clientWidth: 400, scrollLeft: 0, tabCount: 9 })).toBe(0);
  });

  it('returns 0 when scrolled to the end (remaining ~0)', () => {
    // scrollWidth 900, clientWidth 400 -> max scrollLeft ~500
    expect(computeRightOverflow({ scrollWidth: 900, clientWidth: 400, scrollLeft: 500, tabCount: 9 })).toBe(0);
    // one pixel of rounding slack still counts as "at end"
    expect(computeRightOverflow({ scrollWidth: 900, clientWidth: 400, scrollLeft: 499, tabCount: 9 })).toBe(0);
  });

  it('clamps a small partial-scroll remainder to at least 1', () => {
    // remaining is small (10px) relative to avgTabWidth (100px) -> round to 0, clamp to 1
    expect(computeRightOverflow({ scrollWidth: 1000, clientWidth: 400, scrollLeft: 590, tabCount: 10 })).toBe(1);
  });

  it('approximates ~5 hidden tabs for the 9-tab / 4-visible-on-load case', () => {
    // 9 tabs, ~4 visible in 400px viewport -> tab width ~100px, scrollWidth ~900px
    const result = computeRightOverflow({ scrollWidth: 900, clientWidth: 400, scrollLeft: 0, tabCount: 9 });
    expect(result).toBe(5);
  });
});
