// genAge — shared "how long has this been generating" helper for Posts and
// Lead Magnet board rows. Both boards flip a row to status='generating' and
// updated_at tracks the last write, so elapsed-since-timestamp doubles as a
// stuck-row signal. Callers pass the most precise timestamp they have
// (carousel_drafts.taxonomy.generating_started_at when set, else updated_at —
// LM rows have no dedicated start timestamp, so they always pass updated_at).
//
// Extracted from PostStudioPanel's inline elapsed-time calc so the LM board
// gets the same "generating · Nm" chip instead of duplicating the logic.

export const STUCK_MINUTES = 20;

/** Minutes since `iso`, or null when there's no timestamp to measure from. */
export function elapsedMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round(ms / 60_000));
}

/** True once a generating row has been running past the stuck threshold. */
export function isStuckGenerating(iso: string | null | undefined): boolean {
  const m = elapsedMinutes(iso);
  return m !== null && m >= STUCK_MINUTES;
}

/** `generating · 3m` under the threshold; `generating · 24m ⚠` past it;
 *  bare `generating…` when there's no timestamp to measure elapsed from. */
export function generatingChipLabel(iso: string | null | undefined): string {
  const m = elapsedMinutes(iso);
  if (m === null) return 'generating…';
  return m >= STUCK_MINUTES ? `generating · ${m}m ⚠` : `generating · ${m}m`;
}
