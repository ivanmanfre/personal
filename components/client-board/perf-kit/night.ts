/** NIGHT MOCKUP (local only, 2026-09-29): true when the board URL carries `?night`.
 *  ClientBoardPage flips the desk tokens dark on the same flag; surfaces use this to swap
 *  in the perf-kit look without touching the light desk. */
/** Boards that open dark by default (Ivan 2026-09-29: RISE demos on the dark board). Every
 *  other board stays light. `?light` forces light, `?night` forces dark on any desk board. */
export const NIGHT_BOARDS = ['risedtc-com'];

export function isNightUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  if (q.has('light')) return false;
  if (q.has('night') || q.has('quiet')) return true;
  const m = window.location.pathname.match(/\/client\/([^/?#]+)/);
  return !!m && NIGHT_BOARDS.includes(decodeURIComponent(m[1]));
}

export function useNight(): boolean {
  return isNightUrl();
}

/** QUIET MOCKUP (local only, 2026-09-29): `?quiet` renders the night board's layout and words on
 *  a light ground with no decoration (Ivan: "private-bank quiet, receipts first"). Same components
 *  as night; colours flip through --nt-fg and the desk tokens. */
export function useQuiet(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('quiet');
}
