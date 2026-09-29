/** NIGHT MOCKUP (local only, 2026-09-29): true when the board URL carries `?night`.
 *  ClientBoardPage flips the desk tokens dark on the same flag; surfaces use this to swap
 *  in the perf-kit look without touching the light desk. */
export function useNight(): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  return q.has('night') || q.has('quiet');
}

/** QUIET MOCKUP (local only, 2026-09-29): `?quiet` renders the night board's layout and words on
 *  a light ground with no decoration (Ivan: "private-bank quiet, receipts first"). Same components
 *  as night; colours flip through --nt-fg and the desk tokens. */
export function useQuiet(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('quiet');
}
