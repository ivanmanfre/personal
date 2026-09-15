/**
 * Who a LinkedIn post reached: pure math shared by the client board Performance card
 * (components/client-board/DeskPerformanceSurface.tsx) and Ivan's own dashboard
 * (components/dashboard-v2/sections/rebuilt/health/OverviewTab.tsx).
 *
 * Source shape is client_post_metrics.meta: `network` = {in_pct, out_pct, members_reached}
 * and `demographics` = {job_title, seniority, industry, ...}, each a list of {label, pct}.
 * LinkedIn lists only the top buckets per post, so a label missing from a post's list
 * contributes nothing for that post (a floor, never an invented value).
 */

export interface ReachBucket { label: string; pct: number }
export interface ReachNetwork {
  in_pct?: number | null;
  out_pct?: number | null;
  members_reached?: number | null;
  captured_at?: string | null;
}
export interface ReachDemographics {
  job_title?: ReachBucket[] | null;
  seniority?: ReachBucket[] | null;
  industry?: ReachBucket[] | null;
  company_size?: ReachBucket[] | null;
  location?: ReachBucket[] | null;
}
export interface ReachCarrier {
  network?: ReachNetwork | null;
  demographics?: ReachDemographics | null;
}
export type ReachCategory = 'job_title' | 'seniority' | 'industry';

export const isPct = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The split is drawable only when both halves are real numbers. */
export function splitOf(p: ReachCarrier): { inPct: number; outPct: number } | null {
  const n = p.network;
  if (!n || !isPct(n.in_pct) || !isPct(n.out_pct)) return null;
  return { inPct: Math.max(0, Math.min(100, n.in_pct)), outPct: Math.max(0, Math.min(100, n.out_pct)) };
}

/** Members reached, only when it is a real positive number. */
export function reachedOf(p: ReachCarrier): number | null {
  const r = p.network?.members_reached;
  return isPct(r) && r > 0 ? r : null;
}

/** Top buckets of one demographic list, in the order LinkedIn ranks them. */
export function topBuckets(list: ReachBucket[] | undefined | null, n: number): ReachBucket[] {
  return (Array.isArray(list) ? list : [])
    .filter((b) => b && typeof b.label === 'string' && b.label.trim() && isPct(b.pct))
    .slice(0, n);
}

/**
 * Share of members reached per label for one category, across posts.
 * For each post that carries members_reached AND a non-empty list for the category:
 * members in a label = pct / 100 * members_reached. Sum per label, then divide by the
 * summed members_reached of those same posts. Returns the top `n` labels, highest first,
 * with the share rounded to a whole percent; labels that round to 0% are dropped.
 * Null when no post qualifies.
 */
export function reachShares(
  posts: ReachCarrier[], key: ReachCategory, n = 3,
): { labels: { label: string; pct: number }[]; posts: number; reached: number } | null {
  const members = new Map<string, number>();
  let reached = 0;
  let count = 0;
  posts.forEach((p) => {
    const r = reachedOf(p);
    const list = topBuckets(p.demographics?.[key], Infinity);
    if (r == null || !list.length) return;
    reached += r;
    count += 1;
    list.forEach((b) => members.set(b.label, (members.get(b.label) || 0) + (b.pct / 100) * r));
  });
  if (!count || reached <= 0) return null;
  const labels = Array.from(members.entries())
    .map(([label, m]) => ({ label, share: (m / reached) * 100 }))
    .sort((a, b) => b.share - a.share)
    .map((x) => ({ label: x.label, pct: Math.round(x.share) }))
    .filter((x) => x.pct >= 1)
    .slice(0, n);
  if (!labels.length) return null;
  return { labels, posts: count, reached };
}

/** "Founder 18% · Marketing Manager 7%". A middle dot, not a comma: LinkedIn labels carry commas ("Technology, Information and Internet"). */
export const formatShares = (labels: { label: string; pct: number }[]): string =>
  labels.map((l) => `${l.label} ${l.pct}%`).join(' · ');

/**
 * Out-of-network share weighted by a per-post weight (reads on the board, impressions on
 * the dashboard; a post with no weight counts once). Null when no post carries the split.
 */
export function weightedSplit<T extends ReachCarrier>(
  posts: T[], weightOf: (p: T) => number | null | undefined,
): { inPct: number; outPct: number; n: number } | null {
  let wIn = 0, wOut = 0, w = 0, n = 0;
  posts.forEach((p) => {
    const sp = splitOf(p);
    if (!sp) return;
    const raw = weightOf(p);
    const weight = typeof raw === 'number' && raw > 0 ? raw : 1;
    wIn += sp.inPct * weight; wOut += sp.outPct * weight; w += weight; n += 1;
  });
  if (!n || w <= 0) return null;
  return { inPct: Math.round(wIn / w), outPct: Math.round(wOut / w), n };
}
