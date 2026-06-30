/** Whole days from lastPostedAt to now (floored). null if never posted or unparseable. */
export function daysSinceLastPosted(lastPostedAtIso: string | null, nowIso: string): number | null {
  if (!lastPostedAtIso) return null;
  const then = new Date(lastPostedAtIso).getTime();
  const now = new Date(nowIso).getTime();
  if (Number.isNaN(then) || Number.isNaN(now)) return null;
  return Math.floor((now - then) / 86_400_000);
}
