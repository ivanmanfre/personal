import { useEffect } from 'react';

const HILITE = 'dv-tour-target';

// Highlights + scrolls to the element matching `selector` while the tour is on it.
// Uses a MutationObserver so it still works when the target mounts late
// (React.lazy panels, data-gated renders), with a safety timeout.
export function useTourSpotlight(active: boolean, selector: string | undefined) {
  useEffect(() => {
    if (!active || !selector) return;

    let current: HTMLElement | null = null;
    let observer: MutationObserver | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tryApply = (): boolean => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return false;
      current = el;
      el.classList.add(HILITE);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    };

    if (!tryApply()) {
      observer = new MutationObserver(() => {
        if (tryApply()) {
          observer?.disconnect();
          observer = undefined;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      timeoutId = setTimeout(() => observer?.disconnect(), 8000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer?.disconnect();
      current?.classList.remove(HILITE);
    };
  }, [active, selector]);
}
