import { useEffect } from 'react';

const HILITE = 'dv-tour-target';

// Highlights + scrolls to the element matching `selector` while the tour is on `selector`.
// Retries briefly because the target may mount after a section/sub switch.
export function useTourSpotlight(active: boolean, selector: string | undefined) {
  useEffect(() => {
    if (!active || !selector) return;
    let raf = 0;
    let tries = 0;
    let current: HTMLElement | null = null;

    const apply = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        current = el;
        el.classList.add(HILITE);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (tries++ < 30) raf = requestAnimationFrame(apply); // ~0.5s of retries
    };
    apply();

    return () => {
      cancelAnimationFrame(raf);
      current?.classList.remove(HILITE);
    };
  }, [active, selector]);
}
