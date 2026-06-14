// Lets the guided tour trigger REAL UI states inside data panels (open the
// compose form, open a draft editor) without prop-drilling through Shell.
//
// Panels subscribe via onTourIntent AND read getTourIntent() on mount, so an
// intent applies regardless of mount timing — lazy-loaded panels, late data,
// or back-navigation into a panel mid-tour all resolve correctly.
//
// Critically, the "reset to null" path only fires on an actual tour transition
// (the event), never on a normal data refresh — so this never fights a user
// who is operating the dashboard outside the tour.
export type TourIntent = 'posts-compose' | 'posts-edit' | null;

let current: TourIntent = null;
const EVENT = 'dv:tour-intent';

export function setTourIntent(intent: TourIntent): void {
  current = intent;
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT));
}

export function getTourIntent(): TourIntent {
  return current;
}

export function onTourIntent(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = () => handler();
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
