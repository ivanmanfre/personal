// 2026-11-20: one pooled line from RISE's own past scans, written by the builder (dtc_ad_pool.py)
// from verified Meta counts only. A page shows it only beside the Meta count it names, and only while
// the Meta block on the page still carries the builder's ownership proof, so a repaired or re-read row
// whose count or proof changed never carries a stale comparison.
const TRUSTED_VIA = ['homepage_link', 'operator_override', 'link_domain_search'];
const META_OWNERSHIP = 'store-host-2026-11-16';   // dtc_scan.META_OWNERSHIP

function provenMeta(meta: any): boolean {
  if (!meta || typeof meta !== 'object') return false;
  if (meta.status === 'empty') return meta.page_confirmed === true || String(meta.page_confirmed).toLowerCase() === 'true'
    || /(?:isn't|is not) currently running ads.*declared page zero/i.test(String(meta.reason || ''));
  if (meta.status !== 'present') return false;
  return TRUSTED_VIA.includes(meta.resolved_via) || (meta.resolved_via === 'search_match' && meta.ownership === META_OWNERSHIP);
}

export function adPoolLine(pool: any, meta: any, shownMetaCount: number | null | undefined): string | null {
  if (!pool || typeof pool.line !== 'string' || !pool.line.trim() || !Number.isInteger(pool.store_count)) return null;
  if (!provenMeta(meta) || shownMetaCount !== pool.store_count) return null;
  return pool.line.replace(/\s*[—–]\s*/g, ', ');
}
