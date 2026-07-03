// Pure arithmetic for the mobile sub-tab overflow "+N" chip. Extracted out of
// SubTabs so it's unit-testable — jsdom does no layout, so scrollWidth/
// clientWidth/scrollLeft can't be exercised via DOM measurement in tests.
// This is the exact math the component wires to a ResizeObserver + scroll
// listener; see SubTabs.tsx.

export interface RightOverflowInput {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
  tabCount: number;
}

/** Approximate count of tabs fully hidden to the right of the visible
 *  scroll viewport. Returns 0 when there's no overflow (content fits) or
 *  the tablist is scrolled to its end; otherwise clamps to at least 1. */
export function computeRightOverflow({ scrollWidth, clientWidth, scrollLeft, tabCount }: RightOverflowInput): number {
  const remaining = scrollWidth - clientWidth - scrollLeft;
  if (remaining <= 1) return 0;
  const avgTabWidth = scrollWidth / Math.max(1, tabCount);
  return Math.max(1, Math.round(remaining / avgTabWidth));
}
