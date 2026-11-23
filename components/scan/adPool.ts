// 2026-11-20: one pooled line from RISE's own past scans, written by the builder (dtc_ad_pool.py)
// from verified Meta counts only. A page shows it only beside the Meta count it names, and only while
// the Meta block on the page still carries the builder's ownership proof, so a repaired or re-read row
// whose count or proof changed never carries a stale comparison.
const TRUSTED_VIA = ['homepage_link', 'operator_override', 'link_domain_search'];
const META_OWNERSHIP = 'store-host-2026-11-16';   // dtc_scan.META_OWNERSHIP
// 2026-11-21: a zero counts only when the builder stamped how it was verified (dtc_scan.META_ZERO_VERIFIED).
// Older zeros carry the same reason text whether or not the cross-check search ran, so they show no line.
const META_ZERO_VERIFIED = 'page-zero+search-nomatch-2026-11-21';

// 2026-11-23: the ONE test for "this store's Facebook page runs no ads". A page_confirmed empty read without the
// stamp could not be cross-checked, so every page prints it as not checked, never as 0 or "no active ads".
export function metaZeroVerified(meta: any): boolean {
  return !!meta && typeof meta === 'object' && meta.status === 'empty' && meta.page_confirmed === true
    && meta.zero_verified === META_ZERO_VERIFIED;
}

function provenMeta(meta: any): boolean {
  if (!meta || typeof meta !== 'object') return false;
  if (meta.status === 'empty') return metaZeroVerified(meta);
  if (meta.status !== 'present') return false;
  return TRUSTED_VIA.includes(meta.resolved_via) || (meta.resolved_via === 'search_match' && meta.ownership === META_OWNERSHIP);
}

export function adPoolLine(pool: any, meta: any, shownMetaCount: number | null | undefined): string | null {
  if (!pool || typeof pool.line !== 'string' || !pool.line.trim() || !Number.isInteger(pool.store_count)) return null;
  if (!provenMeta(meta) || shownMetaCount !== pool.store_count) return null;
  // Same split as dtc_ad_pool.verified_count: a present read proves a positive count, only a page zero proves 0.
  if (meta.status === 'present' ? !(Number.isInteger(shownMetaCount) && shownMetaCount! > 0) : shownMetaCount !== 0) return null;
  return pool.line.replace(/\s*[—–]\s*/g, ', ');
}
