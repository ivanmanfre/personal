/** NIGHT MOCKUP (local only, 2026-09-29): true when the board URL carries `?night`.
 *  ClientBoardPage flips the desk tokens dark on the same flag; surfaces use this to swap
 *  in the perf-kit look without touching the light desk. */
/** Every desk board opens dark (Ivan 2026-09-29: "styling should be same across all boards",
 *  per-board accent). `?light` forces the light board, `?night` forces dark. ClientBoardPage
 *  decides once per render (it knows the skin) and publishes the answer through setBoardNight, so
 *  surfaces never guess from the URL on their own. */
let boardNight: boolean | null = null;
export function setBoardNight(v: boolean): void { boardNight = v; }

/** The board page's default: dark unless the URL says `?light`. */
export function isNightUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return !new URLSearchParams(window.location.search).has('light');
}

/** Surfaces rendered outside a board page (tests, previews) only go dark on an explicit flag. */
function explicitNight(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  return !q.has('light') && (q.has('night') || q.has('quiet'));
}

export function useNight(): boolean {
  return boardNight ?? explicitNight();
}

/** QUIET MOCKUP (local only, 2026-09-29): `?quiet` renders the night board's layout and words on
 *  a light ground with no decoration (Ivan: "private-bank quiet, receipts first"). Same components
 *  as night; colours flip through --nt-fg and the desk tokens. */
export function useQuiet(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('quiet');
}
