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

// Sol r2 (fallback layouts): the standard story's verified Meta rules, shared so a page that withholds its story still
// prints the same verified count. Link zero: no readable page, and no active ad links the store's domain. Domain count:
// the page total is unknown, the exact-domain search counts ads that show the domain.
const urlSafe = (url?: string) => { try { const u = new URL(url!); return /^https?:$/.test(u.protocol) && !u.username && !u.password; } catch { return false; } };
const isDated = (d?: string) => !!d && Number.isFinite(Date.parse(d));
export const META_LINK_ZERO_VERIFIED = 'store-link-search-nomatch-2026-11-23';
export const META_DOMAIN_COUNT_VERIFIED = 'store-link-search-count-2026-11-23';
export function metaLinkZero(block: any): boolean {
  return block?.status === 'empty' && block.zero_verified === META_LINK_ZERO_VERIFIED && block.page_confirmed !== true;
}
export function metaDomainCount(block: any): any {
  const d = block?.domain_count;
  return block?.status === 'present' && (block?.data?.active_ad_count ?? null) === null && d
    && d.verified === META_DOMAIN_COUNT_VERIFIED && Number.isInteger(d.count) && d.count > 0 && isDated(d.fetched_at) && urlSafe(d.source_url) ? d : null;
}
/** The Meta line a page may print: {count, label, atLeast, fetched_at, source_url}, or null for not checked. */
export function metaVerifiedLine(block: any): { count: number; label: string; atLeast: boolean; fetched_at: string; source_url: string } | null {
  const dc = metaDomainCount(block);
  if (dc) return { count: dc.count, label: 'Active Meta ads showing your domain', atLeast: !!dc.at_least, fetched_at: dc.fetched_at, source_url: dc.source_url };
  const v = block?.data?.active_ad_count;
  const ok = ((block?.status === 'present' && v > 0) || (v === 0 && (metaZeroVerified(block) || metaLinkZero(block))))
    && Number.isInteger(v) && v >= 0 && isDated(block.fetched_at) && urlSafe(block.source_url);
  if (!ok) return null;
  return { count: v, label: metaLinkZero(block) ? 'Active Meta ads showing your domain' : 'Active Meta ads', atLeast: !!block.data?.capped,
           fetched_at: block.fetched_at, source_url: block.source_url };
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
