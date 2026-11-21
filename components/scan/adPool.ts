// 2026-11-20: one pooled line from RISE's own past scans, written by the builder (dtc_ad_pool.py)
// from verified Meta counts only. A page shows it only beside the Meta count it names, so a
// repaired or re-read row whose count changed never carries a stale comparison.
export function adPoolLine(pool: any, shownMetaCount: number | null | undefined): string | null {
  if (!pool || typeof pool.line !== 'string' || !pool.line.trim() || !Number.isInteger(pool.store_count)) return null;
  return shownMetaCount === pool.store_count ? pool.line.replace(/\s*[—–]\s*/g, ', ') : null;
}
