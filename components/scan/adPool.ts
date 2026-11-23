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

// 2026-11-23: the builder's two fixed no-ads findings (dtc_scan "You're not running paid social right now" and
// PIXEL_NO_ADS_TITLE). They show only beside a stamped page zero, whatever the Meta status. Matched by title: this is
// structured builder output, never model copy (model copy never states a Meta count; the Railway editor checks it).
const NO_ADS_TITLES = ["you're not running paid social right now", 'your meta pixel is installed, and your facebook page runs no ads'];
export function metaNoAdsFinding(title: unknown): boolean {
  if (typeof title !== 'string') return false;
  const key = title.normalize('NFKC').replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim().replace(/[ .!]+$/, '').toLowerCase();
  return NO_ADS_TITLES.includes(key);
}

// 2026-11-23 (Sol r1 #1): model-written copy (story, tests) prints only after the Railway final editor checked it for
// Meta count claims (dtc.meta_claim_check, written with a clean passed review or by the checked backfill). A page whose
// copy was never checked, or whose last review flagged a claim, shows its builder-only sections until it passes.
const META_CLAIM_CHECKS = ['meta-claims-editor-2026-11-23', 'meta-claims-backfill-2026-11-23'];
export function modelCopyChecked(dtc: any): boolean {
  const c = dtc?.meta_claim_check;
  return !!c && typeof c === 'object' && META_CLAIM_CHECKS.includes(c.version);
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
