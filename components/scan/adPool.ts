// 2026-11-20: one pooled line from RISE's own past scans, written by the builder (dtc_ad_pool.py)
// from verified Meta counts only. A page shows it only beside the Meta count it names, and only while
// the Meta block on the page still carries the builder's ownership proof, so a repaired or re-read row
// whose count or proof changed never carries a stale comparison.
const TRUSTED_VIA = ['homepage_link', 'operator_override', 'link_domain_search'];
const META_OWNERSHIP = 'store-host-2026-11-16';   // dtc_scan.META_OWNERSHIP
// 2026-11-21: a zero counts only when the builder stamped how it was verified (dtc_scan.META_ZERO_VERIFIED).
// Older zeros carry the same reason text whether or not the cross-check search ran, so they show no line.
const META_ZERO_VERIFIED = 'page-zero+search-nomatch-2026-11-21';

// 2026-11-23 (Ivan): the only Meta zero a page prints is a verified read: the builder's page-zero stamp. An empty read
// without it (an older row, a failed cross-check, a keyword sample) was not checked, so it is never shown as 0.
export function metaZeroVerified(meta: any): boolean {
  return !!meta && typeof meta === 'object' && meta.status === 'empty' && meta.page_confirmed === true
    && meta.zero_verified === META_ZERO_VERIFIED && metaZeroConsistent(meta);
}

// 2026-11-24 (R5 sweep): a stamped zero still fails closed when its own block is missing its date or source, or
// carries ad evidence that contradicts the 0 (records, a sampled count, a cap, a positive domain count, or a
// domain cross-check that did not finish with no ads). Shared by the page zero and the domain-link zero.
const isDate = (v: any) => typeof v === 'string' && Number.isFinite(Date.parse(v));
const isWebUrl = (v: any) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) && !u.username && !u.password; } catch { return false; } };
export function metaZeroConsistent(meta: any): boolean {
  const d = meta?.data;
  if (!d || typeof d !== 'object' || d.active_ad_count !== 0 || d.capped === true) return false;
  if (d.records != null && !(Array.isArray(d.records) && d.records.length === 0)) return false;
  if (d.sampled_ads != null && d.sampled_ads !== 0) return false;
  if (meta.domain_count != null && meta.domain_count?.count !== 0) return false;
  if (meta.link_domain_fallback != null && meta.link_domain_fallback !== 'no_ads') return false;
  return isDate(meta.fetched_at) && isWebUrl(meta.source_url);
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
  // 2026-11-23 (Sol r2): a verified zero covers the identified Facebook page only. Older stored lines end with the
  // builder's old fixed sentence (dtc_ad_pool.line_text), so that exact sentence is scoped here too.
  const line = shownMetaCount === 0 ? pool.line.replace(/Yours was running none\.$/, 'Your identified Facebook page was running none.') : pool.line;
  return line.replace(/\s*[—–]\s*/g, ', ');
}
