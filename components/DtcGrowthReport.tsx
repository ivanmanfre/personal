// components/DtcGrowthReport.tsx
// Rendered IN PLACE OF the generic report when matched_offer === 'dtc_growth'.
//
// Rise-DTC-branded teardown of a Shopify brand's PUBLIC data, staged as a premium editorial
// long-read: dramatic Sora display heads, an asymmetric magazine grid, generous whitespace,
// pull-quote findings. Wears Rise's own brand
// (gold #ffc71d as rule lines / chip dots / CTA only, Sora/Manrope, Rise logo, Rise booking
// link) — NEVER Ivan/InboundOnSteroids chrome.
//
// Correctness spine (unchanged from the floor): every data section gates on
// `SignalMeta.status === 'present'` (or `'empty'` for a genuine negative), never on
// payload-presence. A `blocked`/`error`/`absent` signal collapses silently and emits NO
// number — a WAF-blocked source must never read as "they have zero". Empty is an honest
// negative, not a fabricated zero. Every rendered numeral comes verbatim from the data.
//
// 2026-09-26: the Profit Gap calculator (profit-per-order angle) is retired for RISE and no
// longer renders on any row, old or new. `profit_gap` on older rows is ignored.
//
// Receipt elevation (2026-07-31): three drawn instruments sit on top of that spine.
//   1. The sourced vitals receipt after the hero: one line per public fact, and a line only
//      renders when the fact is BOUND — i.e. a rendered finding below cites it. Fewer than
//      three bound lines and the whole band collapses, so a blocked-heavy scan never ships
//      an empty shell.
//   2. Margin data tags beside each finding: numeral tokens lifted VERBATIM out of that
//      finding's own grounded prose by a pattern whitelist. Nothing is invented or reformatted.
// Store facts (tech_stack app names, growth_score, pagespeed, peer comparisons) are
// deliberately NOT rendered as standalone display anywhere.
import React, { useEffect, useState } from 'react';
import './DtcGrowthReport.css';
import { casesFor, caseUrl } from './riseCases';
import { useMetadata } from '../hooks/useMetadata';
import { useGoogleFonts } from '../hooks/useGoogleFonts';
import type { DtcPromiseBlock, DtcPromiseItem, ReportJson, Scan } from '../lib/scanTypes';

const LEVER_LABEL: Record<string, string> = {
  paid_media: 'Paid media',
  performance_creative: 'Performance creative',
  cro: 'Conversion',
};

// The credibility line names ONLY sources actually read (status present or empty). Fixed order,
// number-free labels: a source WAS read means it can be named, never a store-fact or a numeral.
const READ_SOURCE_LABELS: Array<[string, string]> = [
  ['signup', 'your storefront'],
  ['reviews', 'your product pages'],
  ['shopify', 'your public catalog'],
  ['ads.meta', 'the Meta Ad Library'],
  ['tech_stack', 'your homepage source'],
];

// Every rendered data string passes through this. It strips em/en dashes (Rise copy rule:
// zero em-dashes anywhere on the page) WITHOUT touching numerals, so grounded numbers stay
// verbatim while punctuation is normalized to a clean comma break. A dash between two digits
// is a range ("3–6 pack") and becomes a hyphen, never "3, 6".
function clean(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .replace(/(\d)\s*[—–]\s*(?=\d)/g, '$1-')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s*,(\s*,)+/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^,\s*|,$/g, '');
}

// Retired 2026-09-26: the profit-per-order angle, "engine" wording, and paid wording on a store
// with no active Meta ads. Pre-builder rows still carry them in their stored finding prose, so
// the legacy path scrubs that prose before it renders: a finding whose title IS the retired
// point is dropped, any other sentence carrying it is cut. Nothing is reworded into a new claim.
const RETIRED_PROFIT = /profit gap|contribution profit|profit per order|where (your|the) (margin|profit) is going/i;
const RETIRED_ENGINE = /\bpaid engine\b/i;
const PAID_WORDING = /\bpaid (traffic|clicks?|landing)\b|\bon paid\b|traffic you already pay for|\bthe ads point to\b|\byour ads land\b/i;

function scrubProse(s: string | null | undefined, paidOk: boolean): string {
  if (!s) return '';
  return s
    .replace(/([.!?])\s+/g, '$1\u0000')
    .split('\u0000')
    .filter((t) => !RETIRED_PROFIT.test(t) && !RETIRED_ENGINE.test(t) && (paidOk || !PAID_WORDING.test(t)))
    .join(' ')
    .trim();
}

function scrubLegacyFinding<F extends { title?: string; evidence?: string; week_one?: string | null }>(f: F, paidOk: boolean): F | null {
  const title = paidOk
    ? String(f.title || '')
    : String(f.title || '').replace(/\bon the page paid traffic hits\b/i, 'on your product page').replace(/\bon the pages your ads land on\b/i, 'on your product pages');
  if (RETIRED_PROFIT.test(title) || RETIRED_ENGINE.test(title) || (!paidOk && PAID_WORDING.test(title))) return null;
  const evidence = scrubProse(f.evidence, paidOk);
  if (!evidence) return null;
  return { ...f, title, evidence, week_one: f.week_one ? scrubProse(f.week_one, paidOk) || null : f.week_one };
}

// Number-free source-link label derived from the finding's source URL, so the link says
// where the reader will land instead of a generic "read from your store".
// `sentenceStart`: the label follows a full stop, so it opens a sentence and is capitalized.
function sourceLabel(url: string, sentenceStart = false): string {
  let label = 'see this on your storefront';
  try {
    const u = new URL(url);
    if (u.hostname.includes('facebook.com')) label = 'see this in the Meta Ad Library';
    else if (u.pathname.endsWith('.js') || u.pathname.includes('/products/')) label = 'see this on your product page';
  } catch {}
  return sentenceStart ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}

// Where the PROOF LINK sends a human. `source_url` is provenance and must stay verbatim in the
// evidence table ("products.json" is the honest answer to "where did you read this"), but it is
// the wrong thing to put behind "see this on your storefront": the Safecourt scan (2026-08-15)
// pointed four findings at a 430KB raw JSON payload that a founder's browser either renders as
// a wall of text or downloads. Same read, human surface: /collections/all is the standard
// Shopify route showing the same catalogue with prices, sale badges and sold-out states, which
// is exactly what the discount, price-band and out-of-stock findings claim. A per-product `.js`
// URL gets the same treatment: strip the extension and it is that product's page.
function proofHref(url: string): string | undefined {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
    if (u.pathname.endsWith('/products.json')) return `${u.origin}/collections/all`;
    // 2026-09-18 (StrollAir, first WooCommerce scan shipped): the collector reads Woo stores
    // through `/wp-json/wc/store/v1/products`, which no branch below matched, so three findings
    // sent the founder at a raw JSON payload, the exact Safecourt defect this function exists to
    // stop. Woo has no guaranteed catalogue route (`/shop` is a default, not a promise), so the
    // honest landing is the storefront itself, which is also what the link text says.
    if (u.pathname.includes('/wp-json/')) return u.origin;
    if (u.pathname.endsWith('.js') && u.pathname.includes('/products/')) {
      return `${u.origin}${u.pathname.replace(/\.js$/, '')}`;
    }
    if (u.pathname.endsWith('.json') && u.pathname.includes('/products/')) {
      return `${u.origin}${u.pathname.replace(/\.json$/, '')}`;
    }
    if (/sitemap[^/]*\.xml$/.test(u.pathname)) return u.origin;
  } catch { return undefined; }
  return url;
}

// Mattan photo, used in the hero byline card and the close-band signature row. Remote asset
// only. Rendered as a rounded rectangle, NEVER a circle.
const MATTAN_PHOTO = 'https://resources.risedtc.com/tools/assets/mattan.jpg';

// Height of the docked booking bar; the page reserves it as bottom padding.
const STICKY_BAR_H = 64;

// The store's own currency, read off its storefront by the collector. A EUR catalogue printed
// in dollars is the tell that costs the reader's trust before he reaches a finding (B.me,
// 2026-08-12: a Dutch founder got "$11.90 to $200" for a €-priced range). Falls back to "$"
// so every pre-currency scan row renders byte-identical to what it already shipped.
const CUR_SYMBOL: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', NZD: 'NZ$', JPY: '¥', CHF: 'CHF ',
  SEK: 'SEK ', NOK: 'NOK ', DKK: 'DKK ', PLN: 'PLN ', INR: '₹', BRL: 'R$', MXN: 'MX$', ZAR: 'R',
};
function curSymbol(code?: string | null): string {
  if (!code) return '$';
  return CUR_SYMBOL[code.toUpperCase()] || code.toUpperCase() + ' ';
}

// Receipt price formatting: whole prices stay whole, fractional prices get two decimals,
// thousands get separators, so the receipt states a value the way the findings prose does
// ("$1,285", never "$1285").
function fmtPrice(v: number, sym = '$'): string {
  return sym + v.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(v) ? 0 : 2 });
}

// "Tina Cassaday Creations'" never "Creations's".
function possessive(name: string): string {
  return /s$/i.test(name.trim()) ? `${name.trim()}'` : `${name.trim()}'s`;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Binding test for a receipt line: is this exact fact cited in the prose the reader will
// actually see? Boundary-aware so "42" never matches inside "42.7" or "142". This is what
// makes the receipt's own foot line ("every line above backs a finding below") true by
// construction rather than by assertion.
function cited(hay: string, needle: string): boolean {
  if (!hay || !needle) return false;
  try {
    return new RegExp(`(?<![\\w.])${escapeRe(needle)}(?![\\w.])`, 'i').test(hay);
  } catch {
    return hay.toLowerCase().includes(needle.toLowerCase());
  }
}

// A dollar amount can be written "$1,285", "$1285" or "$1285.00" in findings prose; a line
// binds if any faithful spelling of the same number is cited.
function citedAmount(hay: string, v: number): boolean {
  const forms = new Set<string>([
    String(v),
    v.toFixed(2),
    v.toLocaleString('en-US', { maximumFractionDigits: 2 }),
    v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  ]);
  return Array.from(forms).some((f) => cited(hay, f));
}

// Findings margin tags: numeral tokens are lifted VERBATIM out of the finding's own text by
// this ordered whitelist, first pattern wins the span, max two per finding. Nothing is
// reformatted, so a margin figure is always a substring of grounded prose.
const MARGIN_NUMERAL_PATTERNS: string[] = [
  '\\b\\d+ of \\d+\\b',                                                  // counts
  '\\$\\d[\\d,]*(?:\\.\\d+)?(?:\\s+to\\s+\\$\\d[\\d,]*(?:\\.\\d+)?)?',   // money, optional range
  '\\b\\d+(?:\\.\\d+)?%',                                                // percent
  '\\b\\d\\.\\d\\b',                                                     // rating-style decimal
  '\\b\\d[\\d,]{2,}\\b',                                                 // large counts
];

function marginFigures(text: string): string[] {
  const claimed: Array<[number, number]> = [];
  const out: string[] = [];
  for (const source of MARGIN_NUMERAL_PATTERNS) {
    if (out.length >= 2) break;
    const rx = new RegExp(source, 'g');
    let m: RegExpExecArray | null;
    while ((m = rx.exec(text)) !== null) {
      if (out.length >= 2) break;
      const start = m.index;
      const end = start + m[0].length;
      if (claimed.some(([cs, ce]) => start < ce && end > cs)) continue;
      claimed.push([start, end]);
      if (!out.includes(m[0])) out.push(m[0]);
    }
  }
  return out;
}

// Where each signal was read from. Small-caps source line under a finding's margin figures.
// 2026-09-26: human words only. Endpoint names ("products.json", "product .js", the Store API
// path) read as a machine report to a founder, and they never told her where to look anyway.
const MARGIN_SOURCE: Record<string, string> = {
  shopify: 'your catalog',
  reviews: 'your product page',
  signup: 'your storefront',
  'ads.meta': 'Meta Ad Library',
  tech_stack: 'your homepage',
};

// One line of the sourced vitals receipt. `signal` is what binds it to a finding (and picks
// the single gold flag line); `none` switches the value to the honest-negative treatment.
type ReceiptLine = {
  signal: string;
  label: string;
  value: string;
  source: string;
  none?: boolean;
};

// ══ audit v3 additions ═══════════════════════════════════════════════════════════════
// Everything below is ADDITIVE and presence-gated. A pre-v3 row carries no bucket, no
// google block, no meta_sweep, no competitors and no screenshots, so every surface here is
// born-absent and the old render is byte-identical to the floor.

// Dates are the whole argument of the evidence spread, so they are parsed as calendar days
// in UTC and never re-derived from a local clock: a rendered age is always (read date minus
// record date), which is what the source itself supports.
function isoDay(s?: string | null): string | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
function dayMs(s?: string | null): number | null {
  const d = isoDay(s);
  if (!d) return null;
  const [y, mo, da] = d.split('-').map(Number);
  return Date.UTC(y, mo - 1, da);
}
function checkedAt(s?: string | null): string | null {
  if (!s || !Number.isFinite(Date.parse(s))) return null;
  const date = new Date(s);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    + ' at ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}

// Storage paths are reused on rebuilds; the capture timestamp selects the matching image version.
function datedScreenshots(shots: any): any {
  if (!shots?.captured_at) return shots;
  const dated = (url?: string | null) => {
    if (!url) return url;
    try { const u = new URL(url); u.searchParams.set('captured_at', shots.captured_at); return u.href; } catch { return url; }
  };
  return { ...shots, homepage_url: dated(shots.homepage_url), pdp_url: dated(shots.pdp_url) };
}

// b minus a in whole days. Null when either end is unreadable, so an age is never guessed.
function daysBetween(a?: string | null, b?: string | null): number | null {
  const A = dayMs(a);
  const B = dayMs(b);
  if (A == null || B == null) return null;
  return Math.round((B - A) / 86400000);
}
// A capped read can only ever state a floor. capped=true renders "at least N", never N.
function countParts(n: number, capped?: boolean): { pre: string | null; n: string } {
  return { pre: capped ? 'at least' : null, n: String(n) };
}

// Image fallback chain for an ad creative: stored copy, then the source image, then the
// preview. A preview that is a script endpoint (Google serves some video previews as
// content.js) is not an image and is refused here rather than rendered as a broken tile.
function creativeImageSrc(c: any): string | null {
  for (const u of [c?.stored_url, c?.image_url, c?.preview_url]) {
    if (typeof u === 'string' && u.length > 0 && !/\.js(\?|$)/i.test(u)) return u;
  }
  return null;
}

// One evidence tile. No src, or a src that fails to decode, falls through to the caller's
// dated text tile: never a broken img, never a placeholder box.
function EvidenceImg({
  src,
  alt,
  ratio,
  fallback,
}: {
  src: string | null;
  alt: string;
  ratio: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const usable = !!src && !failed;
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: ratio,
        overflow: 'hidden',
        borderRadius: 3,
        background: 'rgba(255,255,255,.05)',
        border: '1px solid rgba(255,255,255,.14)',
      }}
    >
      {usable ? (
        <img
          src={src as string}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', display: 'block' }}
        />
      ) : (
        fallback
      )}
    </div>
  );
}

// ── Bucket contract ────────────────────────────────────────────────────────────────────
// Labels are LOCKED copy. `cells` drives a two-square glyph that repeats on every chip and
// in the week-one panel, so the division of labor is drawn wherever it is named.
type BucketKey = 'rise' | 'split' | 'yours' | 'asset';
type Cell = 'accent' | 'ink' | 'open';
const BUCKETS: Record<BucketKey, { label: string; cells: [Cell, Cell]; dashed?: boolean }> = {
  rise: { label: 'RISE takes this over', cells: ['accent', 'accent'] },
  split: { label: 'Split', cells: ['accent', 'open'] },
  yours: { label: 'On your side', cells: ['open', 'open'], dashed: true },
  asset: { label: 'Working asset', cells: ['ink', 'ink'] },
};
const BUCKET_ORDER: BucketKey[] = ['rise', 'split', 'yours', 'asset'];
function bucketOf(f: any): BucketKey | null {
  const b = f?.bucket;
  return b === 'rise' || b === 'split' || b === 'yours' || b === 'asset' ? b : null;
}
function BucketGlyph({ b, accent, ink, size = 8 }: { b: BucketKey; accent: string; ink: string; size?: number }) {
  const cfg = BUCKETS[b];
  return (
    <span className="inline-flex items-center" style={{ gap: 3 }} aria-hidden="true">
      {cfg.cells.map((c, i) => (
        <span
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: 1.5,
            background: c === 'accent' ? accent : c === 'ink' ? ink : 'transparent',
            border: c === 'open' ? `1px ${cfg.dashed ? 'dashed' : 'solid'} ${ink}66` : undefined,
          }}
        />
      ))}
    </span>
  );
}

// ── Evidence-first dark spread ─────────────────────────────────────────────────────────
// The other-advertisers instrument's frame. Condensed, its content sits behind one
// disclosure line naming the keywords; otherwise it renders open, as it always has.
function CompWrap({
  condensed,
  keywords,
  surface,
  headingFont,
  children,
}: {
  condensed: boolean;
  keywords?: string[];
  surface: string;
  headingFont: string;
  children: React.ReactNode;
}) {
  const frame = { borderTop: '1px solid rgba(255,255,255,.16)' };
  if (!condensed) return <div className="mt-16 pt-10" style={frame}>{children}</div>;
  const kw = Array.isArray(keywords) ? keywords.slice(0, 3).map((k) => `"${clean(k)}"`) : [];
  return (
    <details className="mt-12 pt-4" style={frame} data-comp-disclosure="1">
      <summary
        className="cursor-pointer inline-flex items-center min-h-[44px] text-[0.95rem] font-bold underline underline-offset-4"
        style={{ fontFamily: headingFont, color: surface }}
      >
        {kw.length ? `See who else advertises on ${kw.join(', ')}` : 'See who else advertises on your keywords'}
      </summary>
      <div className="mt-8">{children}</div>
    </details>
  );
}

// "1 day", never "1 DAYS" (the units render uppercase).
function dayWord(n: number): string {
  return n === 1 ? 'day' : 'days';
}

// The marker label is centred on its marker, except near an end of the axis, where it hangs
// inward so it never runs off the screen ("VEST, 1066 DAYS" at 390px, 09-26).
function mklShift(pos: number): string {
  return pos < 30 ? 'translateX(0)' : pos > 70 ? 'translateX(-100%)' : 'translateX(-50%)';
}

// The competitor tiles a page may show: named advertisers, most direct substitute first (the
// judge's `relevance`, when the row carries it), then most recent. Fewer than 2 is not a
// competitive set, so the strip is omitted outright (round 4, 09-26), old rows included.
function compStrip(competitors: any): any[] {
  const data = competitors?.status === 'present' ? competitors.data : null;
  const cs: any[] = Array.isArray(data?.creatives) ? data.creatives.filter((c: any) => c && c.advertiser) : [];
  if (cs.length < 2) return [];
  const rel = (c: any) => (typeof c.relevance === 'number' ? c.relevance : -1);
  const age = (c: any) => (typeof c.age_days === 'number' ? c.age_days : Infinity);
  return cs
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rel(b.c) - rel(a.c) || age(a.c) - age(b.c) || a.i - b.i)
    .map((x) => x.c);
}

// An ink-on-surface band with a drawn-first discipline.
// Three instruments, each one dated at the source. Nothing here states a present-tense ad
// status: a creative carries a first-shown date and a last-shown date, and the gap between
// a date and the read date is stated as a measured number of days.
function AdEvidenceSpread({
  google,
  metaPage,
  metaSweep,
  competitors,
  accent,
  ink,
  surface,
  headingFont,
  condensed,
}: {
  google: any;
  metaPage: any;
  metaSweep: any;
  competitors: any;
  accent: string;
  ink: string;
  surface: string;
  headingFont: string;
  // New-contract rows: the other-advertisers strip folds behind one disclosure line, so the
  // store's own content always leads and other brands' ads are opt-in.
  condensed?: boolean;
}) {
  const g = google?.status === 'present' && google.data ? google.data : null;
  // A confirmed page supports current page activity only; a keyword search is a sample.
  const sweep = metaSweep?.status === 'empty' && metaSweep.data ? metaSweep.data : null;
  const pageZero = metaPage?.status === 'empty' && metaPage?.page_confirmed === true;
  const metaReadDate = checkedAt(pageZero ? metaPage?.fetched_at : sweep?.checked_at || metaSweep?.fetched_at);
  const showMeta = (pageZero || sweep) && metaReadDate;
  const comp = competitors?.status === 'present' && competitors.data ? competitors.data : null;
  const compCreatives: any[] = compStrip(competitors);

  if (!g && !showMeta && !compCreatives.length) return null;

  const gRead = isoDay(g?.checked_at) || isoDay(google?.fetched_at);
  const gReadLong = checkedAt(g?.checked_at || google?.fetched_at);
  const newestAge = g ? daysBetween(g.newest_first_shown, gRead) : null;
  const lastAge = g ? daysBetween(g.latest_last_shown, gRead) : null;

  // Format split. Segments are drawn against their own sum, which is the count on record.
  const fmts: Array<{ k: string; label: string; v: number; fill: string }> = [];
  if (g?.formats) {
    const F = g.formats;
    if (typeof F.text === 'number' && F.text > 0) fmts.push({ k: 'text', label: 'Text', v: F.text, fill: 'rgba(255,255,255,.26)' });
    if (typeof F.image === 'number' && F.image > 0) fmts.push({ k: 'image', label: 'Image', v: F.image, fill: 'rgba(255,255,255,.52)' });
    if (typeof F.video === 'number' && F.video > 0) fmts.push({ k: 'video', label: 'Video', v: F.video, fill: 'rgba(255,255,255,.80)' });
  }
  const fmtTotal = fmts.reduce((a, b) => a + b.v, 0);

  // Tiles carry each creative's own first→last span in the caption (the separate per-creative
  // timeline was cut 08-07 — three renderings of the same six creatives read as padding).
  const gCreatives: any[] = Array.isArray(g?.creatives) ? g.creatives.slice(0, 6) : [];

  // Competitor recency axis: left is the oldest sampled start date, right is the read date.
  // Three tiles carry the point (08-07 length cut); the axis and the fresher-than count stay
  // computed over the SHOWN set so the drawn claim always matches the visible tiles.
  // Tiles arrive ordered most direct substitute first, then most recent (compStrip), so the
  // three shown are the most relevant, not the first three stored (Paleonola hid a 12-day ad).
  const compShown = compCreatives.slice(0, 3);
  const ageList = (cs: any[]) => cs.map((c) => (typeof c.age_days === 'number' ? c.age_days : null)).filter((n): n is number => n != null);
  const compAges = ageList(compShown);
  // "N days since the most recent competitor start" is a claim about EVERY kept tile.
  const compAllAges = ageList(compCreatives);
  // Corpus-level recency claims ("N days since the most recent competitor start", the drawn
  // axis, the fresher-than sentence) need a minimum population of DATED creatives. Noisy Clan
  // (08-17) shipped "504 days since the most recent competitor start date" computed over ONE
  // dated creative while the same archive held starts newer than the brand's own — a
  // most-recent-X over a population of 1 is not a population claim. Below the floor the tiles
  // still render (each states only its own age); the corpus stats render as silence.
  const compDatedEnough = compAges.length >= 3;
  const compAllDatedEnough = compAllAges.length >= 3;
  const maxAge = compAges.length ? Math.max(...compAges, newestAge ?? 0) : newestAge ?? 0;
  const axisMax = Math.max(7, Math.ceil((maxAge + 4) / 5) * 5);
  const agePos = (d: number) => Math.max(0, Math.min(100, (1 - d / axisMax) * 100));
  const fresherThanBrand = newestAge != null ? compAges.filter((a) => a < newestAge).length : null;
  const compReadLong = checkedAt(comp?.checked_at || competitors?.fetched_at);
  const gCount = g && typeof g.ads_found === 'number' ? countParts(g.ads_found, g.capped) : null;
  // Headline counts, biggest first (Meta first on a tie): Rebalance (09-26) led with "1 on Google."
  // while it runs 46 Meta ads.
  const metaN = metaPage?.status === 'present' && typeof metaPage?.data?.active_ad_count === 'number' && metaPage.data.active_ad_count > 0
    ? metaPage.data.active_ad_count as number : null;
  const headCounts = [
    metaN != null ? { k: 'meta', v: metaN, t: `${metaN} on Meta.` } : null,
    // each head count is its own sentence: "At least 100 on Google.", never ". at least"
    g && gCount ? { k: 'google', v: g.ads_found as number, t: `${gCount.pre ? `${gCount.pre.charAt(0).toUpperCase()}${gCount.pre.slice(1)} ` : ''}${gCount.n} on Google.` } : null,
  ].filter((x): x is { k: string; v: number; t: string } => !!x).sort((a, b) => b.v - a.v);

  const eyebrow = (t: string) => (
    <div className="flex items-center gap-3 mb-6">
      <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: 'rgba(255,255,255,.35)' }} />
      <span className="text-[0.75rem] font-semibold uppercase tracking-[0.28em]" style={{ color: surface, opacity: 0.7 }}>{t}</span>
    </div>
  );

  const Stat = ({ pre, n, unit, label }: { pre?: string | null; n: string; unit?: string; label: string }) => (
    <div>
      {pre ? (
        <div className="text-[0.75rem] font-bold uppercase tracking-[0.22em]" style={{ color: surface, opacity: 0.7 }}>{pre}</div>
      ) : null}
      <div className="flex items-baseline gap-2">
        <span
          className="font-extrabold tabular-nums leading-none tracking-[-0.03em]"
          style={{ fontFamily: headingFont, fontSize: 'clamp(2.9rem, 6vw, 4.5rem)', color: surface }}
        >
          {n}
        </span>
        {unit ? (
          <span className="text-[0.9rem] font-bold uppercase tracking-[0.16em]" style={{ fontFamily: headingFont, color: surface, opacity: 0.7 }}>{unit}</span>
        ) : null}
      </div>
      <div className="mt-2 text-[0.86rem] leading-snug" style={{ color: surface, opacity: 0.7, maxWidth: '22ch' }}>{label}</div>
    </div>
  );

  return (
    <section aria-label="Public ad records" data-adspread="1" style={{ background: ink, color: surface }}>
      <div className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-20 sm:py-24">
        {eyebrow('Public ad records')}
        <div className="grid lg:grid-cols-12 gap-y-6 lg:gap-x-12 items-end">
          <div className="lg:col-span-8">
            <h2
              className="font-extrabold leading-[0.98] tracking-[-0.02em]"
              style={{ fontFamily: headingFont, fontSize: 'clamp(2.4rem, 6.4vw, 4.6rem)', color: surface }}
            >
              {headCounts.map((h) => (
                <span key={h.k} data-head-count={h.k}>{h.t}{' '}</span>
              ))}
              {/* The headline absolute is page-confirmed-only (same rule as the statement below). */}
              {pageZero ? <span style={{ color: accent }}>No active ads on the identified Facebook page.</span> : null}
            </h2>
          </div>
          <div className="lg:col-span-4">
            <p className="text-[0.98rem] leading-relaxed" style={{ color: surface, opacity: 0.7 }}>
              {/* Count the archives this section actually RENDERS, not the ones we tried to read.
                  `gReadLong` comes off `google.fetched_at`, which is stamped on every attempt —
                  including the ones that return nothing renderable, where `g` stays null and no
                  Google strip appears. Safecourt (2026-08-15) shipped "Two public ad archives"
                  above a section citing only the Meta Ad Library. Same reason the date now
                  follows the archive being shown: printing the Google fetch date over a
                  Meta-only strip attributes the read to a source the reader cannot see. */}
              {g && showMeta
                ? `Two public ad archives, read on ${gReadLong}. Every date below is theirs, not ours.`
                : `A public ad archive, read on ${(g ? gReadLong : metaReadDate) || gReadLong || metaReadDate}. Every date below is theirs, not ours.`}
            </p>
          </div>
        </div>

        {/* ── Instrument 1: the dated Google strip ───────────────────────────────── */}
        {g ? (
          <div className="mt-16 pt-10" style={{ borderTop: '1px solid rgba(255,255,255,.16)' }}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-9">
              <span className="text-[0.75rem] font-bold uppercase tracking-[0.24em]" style={{ fontFamily: headingFont, color: accent }}>
                Google's public ad library
              </span>
              {g.advertiser ? (
                <span className="text-[0.86rem]" style={{ color: surface, opacity: 0.7 }}>
                  {clean(String(g.advertiser))}{g.region ? `, region ${g.region}` : ''}
                </span>
              ) : null}
            </div>

            <div className="grid sm:grid-cols-3 gap-y-9 sm:gap-x-8">
              {gCount ? <Stat pre={gCount.pre} n={gCount.n} label="creatives on record for this advertiser" /> : null}
              {newestAge != null && g.newest_first_shown ? (
                <Stat n={String(newestAge)} unit={dayWord(newestAge)} label={`since the newest first-shown date, ${isoDay(g.newest_first_shown)}`} />
              ) : null}
              {lastAge != null && g.latest_last_shown ? (
                <Stat n={String(lastAge)} unit={dayWord(lastAge)} label={`since the most recent last-shown date, ${isoDay(g.latest_last_shown)}`} />
              ) : null}
            </div>

            {/* The read, STATED (Ivan, 08-07: "what's the point of telling them what they
                already know") — an archive dump is vanilla; the page's job is the claim the
                dates add up to. Deterministic, from the two ages already on screen, and only
                rendered when they actually carry an argument (a brand with fresh creative
                gets no manufactured drama). */}
            {newestAge != null && lastAge != null && newestAge >= 60 && lastAge <= 14 ? (
              <p className="mt-9 text-[1.2rem] sm:text-[1.35rem] leading-[1.45] font-medium" style={{ color: surface, paddingLeft: '1.25rem', borderLeft: `3px solid ${accent}`, maxWidth: '58ch' }}>
                {`The record shows ads served as recently as ${lastAge === 0 ? 'today' : `${lastAge} ${dayWord(lastAge)} ago`} and nothing new entering it for ${newestAge} ${dayWord(newestAge)}. The spend is riding on creative from ${isoDay(g.newest_first_shown)} or older.`}
              </p>
            ) : null}

            {/* Format split, drawn against its own sum. */}
            {fmts.length > 0 && fmtTotal > 0 ? (
              <div className="mt-12">
                <div className="text-[0.75rem] font-bold uppercase tracking-[0.24em] mb-3" style={{ fontFamily: headingFont, color: surface, opacity: 0.7 }}>
                  Formats on record
                </div>
                <div className="cedt-fmtbar" aria-hidden="true">
                  {fmts.map((f) => (
                    <span key={f.k} style={{ width: `${(f.v / fmtTotal) * 100}%`, background: f.fill }} />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
                  {fmts.map((f) => (
                    <span key={f.k} className="inline-flex items-center gap-2.5">
                      <span style={{ width: 11, height: 11, borderRadius: 2, background: f.fill, display: 'inline-block' }} />
                      <span className="text-[0.8rem] uppercase tracking-[0.14em]" style={{ color: surface, opacity: 0.7 }}>{f.label}</span>
                      <span className="text-[1.05rem] font-bold tabular-nums" style={{ fontFamily: headingFont, color: surface }}>{f.v}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* (The per-creative timeline rows were cut 08-07: formats bar + timeline + tiles
                rendered the same six creatives three times — Ivan: "this goes quite long".
                The tiles below now carry each creative's full first→last span instead.) */}

            {/* The creatives themselves. Imageless ones stay in the strip as dated tiles. */}
            {gCreatives.length > 0 ? (
              <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {gCreatives.map((c, i) => {
                  const src = creativeImageSrc(c);
                  const first = isoDay(c.first_shown);
                  const fallback = (
                    <span
                      className="absolute inset-0 flex flex-col justify-end p-2.5"
                      style={{ background: 'rgba(255,255,255,.05)' }}
                    >
                      <span className="text-[0.75rem] font-bold uppercase tracking-[0.18em]" style={{ fontFamily: headingFont, color: surface, opacity: 0.75 }}>
                        {String(c.format || 'ad')}
                      </span>
                      {first ? (
                        <span className="text-[0.75rem] font-bold tabular-nums mt-1" style={{ fontFamily: headingFont, color: surface, opacity: 0.85 }}>{first}</span>
                      ) : null}
                    </span>
                  );
                  return (
                    <figure key={i} style={{ margin: 0 }}>
                      <EvidenceImg src={src} alt={`${String(c.format || 'ad')} creative first shown ${first || ''}`} ratio="4 / 3" fallback={fallback} />
                      <figcaption className="mt-2 text-[0.75rem] font-bold uppercase tracking-[0.14em] tabular-nums" style={{ fontFamily: headingFont, color: surface, opacity: 0.7 }}>
                        {String(c.format || 'ad')}
                        {first ? (
                          <span className="block mt-0.5" style={{ opacity: 0.85 }}>
                            {first}{isoDay(c.last_shown) && isoDay(c.last_shown) !== first ? ` → ${isoDay(c.last_shown)}` : ''}
                          </span>
                        ) : null}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ── Instrument 2: confirmed page status and keyword sample ─────────────── */}
        {showMeta ? (
          <div className="mt-16 pt-10" style={{ borderTop: '1px solid rgba(255,255,255,.16)' }}>
            <div className="grid lg:grid-cols-12 gap-y-8 lg:gap-x-12 items-start">
              <div className="lg:col-span-4">
                <span className="text-[0.75rem] font-bold uppercase tracking-[0.24em]" style={{ fontFamily: headingFont, color: accent }}>
                  Meta Ad Library
                </span>
                <div
                  className="font-extrabold tabular-nums leading-[0.8] tracking-[-0.04em] mt-3"
                  style={{ fontFamily: headingFont, fontSize: 'clamp(5rem, 15vw, 10rem)', color: accent }}
                >
                  0
                </div>
              </div>
              <div className="lg:col-span-8">
                {/* Claim strength follows evidence strength (SENSE incident, 08-07): the absolute
                    sentence is licensed ONLY by a page-confirmed zero (their identity-confirmed
                    page, Meta's own "isn't running ads"). A sweep-only zero is a sample fact —
                    a generic brand name can hide in a keyword sample — so it states exactly what
                    was measured and nothing more. */}
                <p className="text-[1.35rem] sm:text-[1.6rem] leading-[1.35] font-medium" style={{ color: surface, paddingLeft: '1.25rem', borderLeft: `3px solid ${accent}` }}>
                  {pageZero
                    ? `The identified Facebook page had no active ads at ${metaReadDate}. This does not establish brand-wide or historical ad activity.`
                    : `A Meta Ad Library sweep on ${metaReadDate} traced none of the sampled ads to your brand.`}
                </p>
                {pageZero && proofHref(metaPage.source_url) ? <a href={proofHref(metaPage.source_url)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center underline underline-offset-4 mt-3">View the identified Facebook page</a> : null}
                <div className="mt-8" style={{ borderTop: '1px solid rgba(255,255,255,.28)' }}>
                  {pageZero ? (
                    <div className="cedt-mrow">
                      <span className="nm">Identified page read</span>
                      <span className="vl">0 active ads on this page</span>
                      <span className="dt">{metaReadDate}</span>
                    </div>
                  ) : null}
                  {sweep ? (
                    <div className="cedt-mrow">
                      <span className="nm">
                        {`Keyword sweep, ${countParts(sweep.sampled_items || 0, sweep.capped).pre ? `${countParts(sweep.sampled_items || 0, sweep.capped).pre} ` : ''}${sweep.sampled_items} ads read`}
                      </span>
                      <span className="vl">{`${sweep.identity_matched_ads ?? 0} traced to your brand`}</span>
                      <span className="dt">{checkedAt(sweep.checked_at || metaSweep?.fetched_at) || metaReadDate}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Instrument 3: the counterpoint ─────────────────────────────────────── */}
        {compCreatives.length > 0 ? (
          <CompWrap condensed={!!condensed} keywords={comp?.keywords} surface={surface} headingFont={headingFont}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-8">
              <span className="text-[0.75rem] font-bold uppercase tracking-[0.24em]" style={{ fontFamily: headingFont, color: accent }}>
                The same keywords, other advertisers
              </span>
              {Array.isArray(comp?.keywords) ? (
                <span className="flex flex-wrap gap-2">
                  {comp.keywords.slice(0, 3).map((k: string) => (
                    <span
                      key={k}
                      className="text-[0.75rem] font-semibold px-2.5 py-1 rounded-full"
                      style={{ border: '1px solid rgba(255,255,255,.28)', color: surface, opacity: 0.75 }}
                    >
                      {clean(k)}
                    </span>
                  ))}
                </span>
              ) : null}
            </div>

            <div className="grid sm:grid-cols-3 gap-y-9 sm:gap-x-8">
              {typeof comp?.advertisers_seen === 'number' ? (
                <Stat {...countParts(comp.advertisers_seen, comp.capped)} label="separate advertisers seen on those keywords" />
              ) : null}
              {typeof comp?.sampled_items === 'number' ? (
                <Stat {...countParts(comp.sampled_items, comp.capped)} label="ads read across the sweep" />
              ) : null}
              {compAllDatedEnough ? (
                <Stat n={String(Math.min(...compAllAges))} unit={dayWord(Math.min(...compAllAges))} label="since the most recent competitor start date" />
              ) : null}
            </div>

            <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {compShown.map((c, i) => {
                const src = creativeImageSrc(c);
                const start = isoDay(c.start_date);
                const fallback = (
                  <span className="absolute inset-0 flex flex-col justify-end p-2.5" style={{ background: 'rgba(255,255,255,.05)' }}>
                    <span className="text-[0.75rem] font-bold uppercase tracking-[0.18em]" style={{ fontFamily: headingFont, color: surface, opacity: 0.75 }}>ad</span>
                    {start ? <span className="text-[0.75rem] font-bold tabular-nums mt-1" style={{ fontFamily: headingFont, color: surface, opacity: 0.85 }}>{start}</span> : null}
                  </span>
                );
                return (
                  <figure key={i} style={{ margin: 0 }}>
                    <EvidenceImg src={src} alt={`Ad from ${clean(String(c.advertiser))}`} ratio="4 / 5" fallback={fallback} />
                    <figcaption className="mt-2">
                      {typeof c.age_days === 'number' ? (
                        <span className="flex items-baseline gap-1.5">
                          <span className="font-extrabold tabular-nums leading-none" style={{ fontFamily: headingFont, fontSize: '1.55rem', color: surface }}>{c.age_days}</span>
                          <span className="text-[0.75rem] font-bold uppercase tracking-[0.16em]" style={{ fontFamily: headingFont, color: surface, opacity: 0.7 }}>{dayWord(c.age_days)}</span>
                        </span>
                      ) : null}
                      <span className="block mt-1 text-[0.78rem] font-bold leading-tight" style={{ color: surface, opacity: 0.9 }}>{clean(String(c.advertiser))}</span>
                      {start ? <span className="block mt-0.5 text-[0.75rem] tabular-nums" style={{ color: surface, opacity: 0.7 }}>{start}</span> : null}
                      {c.keyword ? (
                        <span className="block mt-1.5 text-[0.75rem] font-bold uppercase tracking-[0.12em]" style={{ fontFamily: headingFont, color: accent, opacity: 0.85 }}>{clean(String(c.keyword))}</span>
                      ) : null}
                    </figcaption>
                  </figure>
                );
              })}
            </div>

            {/* Shared recency axis: the counterpoint, drawn. */}
            {compDatedEnough ? (
              <div className="mt-14">
                <div className="text-[0.75rem] font-bold uppercase tracking-[0.24em] mb-4" style={{ fontFamily: headingFont, color: surface, opacity: 0.7 }}>
                  Start dates, drawn back from the read
                </div>
                <div className="cedt-axis">
                  {compShown.map((c, i) =>
                    typeof c.age_days === 'number' ? (
                      <span key={i} className="dot" style={{ left: `${agePos(c.age_days)}%` }} title={`${clean(String(c.advertiser))}, ${c.age_days} ${dayWord(c.age_days)}`} />
                    ) : null,
                  )}
                  {newestAge != null ? (
                    <span className="mkr" style={{ left: `${agePos(newestAge)}%`, background: accent }} />
                  ) : null}
                  <span className="ln" />
                  <span className="end l">{`${axisMax} days back`}</span>
                  <span className="end r">{compReadLong ? `read ${compReadLong}` : 'read date'}</span>
                  {newestAge != null ? (
                    <span className="mkl" style={{ left: `${agePos(newestAge)}%`, color: accent, transform: mklShift(agePos(newestAge)) }}>{`your newest, ${newestAge} ${dayWord(newestAge)}`}</span>
                  ) : null}
                </div>
                {fresherThanBrand != null && newestAge != null ? (
                  <p className="mt-7 text-[1.05rem] leading-relaxed" style={{ color: surface, opacity: 0.82, maxWidth: '66ch' }}>
                    {`${fresherThanBrand} of the ${compShown.length} competitor creatives shown carry a start date more recent than your newest first-shown date, which is ${newestAge} ${dayWord(newestAge)} back.`}
                  </p>
                ) : null}
              </div>
            ) : null}
          </CompWrap>
        ) : null}
      </div>
    </section>
  );
}

// ══ 2026-09-26 "deliver the promise" contract ══════════════════════════════════════════
// The DM promises two things: where shoppers drop off, and how to get more of them ordering
// a second time. A row whose builder stamped `builder_version` carries exactly those two
// blocks, and the page leads with them: first screen names one concrete thing on THEIR
// store (their product, its image, the public fact), then one section per promise, then
// RISE's own side (paid media, creative), then the other-advertisers strip, folded.
// Rows without builder_version keep the legacy layout below.
type PromiseItem = DtcPromiseItem;
type PromiseBlock = DtcPromiseBlock;

// A held row (shippable.ok === false, or nothing in either section, e.g. a WooCommerce store
// the builder could only read the homepage of) would render a hero with no headline or a
// promised section with nothing in it: it takes the legacy layout.
function isPromiseRow(d: any): boolean {
  return typeof d?.builder_version === 'string' && d.builder_version.length > 0 && !!d.drop_off && !!d.second_order
    && d.shippable?.ok !== false
    && promiseItems(d.drop_off).length + promiseItems(d.second_order).length > 0;
}

function promiseItems(block?: PromiseBlock | null): PromiseItem[] {
  return Array.isArray(block?.items) ? block!.items.filter((it) => it && it.id !== 'no_new_products' && typeof it.title === 'string' && it.title.trim()) : [];
}

function productPrice(p?: PromiseItem['product']): string | null {
  if (!p || p.price == null) return null;
  const n = typeof p.price === 'number' ? p.price : parseFloat(String(p.price));
  if (!Number.isFinite(n) || n <= 0) return null;
  return fmtPrice(n, curSymbol(p.currency));
}

// "/products/<handle>" of a URL or path, locale and collection prefixes ignored.
function productHandle(u?: string | null): string | null {
  const m = /\/products\/([^/?#]+)/.exec(String(u || ''));
  return m ? decodeURIComponent(m[1]).toLowerCase() : null;
}

function sameProductPage(itemUrl?: string | null, shotPath?: string | null): boolean {
  const a = productHandle(itemUrl);
  return !!a && a === productHandle(shotPath);
}

const INVENTORY_IDS = new Set(['bestseller_sold_out', 'refill_sold_out', 'sold_out', 'high_oos', 'out_of_stock']);
function isInventoryItem(item?: PromiseItem | null): boolean {
  return !!item && INVENTORY_IDS.has(item.id);
}

function InventoryExhibit({ shop }: { shop: any; ink: string; headingFont: string }) {
  const all = shop?.status === 'present' && Array.isArray(shop.catalog_items) ? shop.catalog_items : [];
  if (!all.length) return null;
  const shown = all.slice(0, 12);
  return <div data-inventory-exhibit="1" className="rise-inventory">
    <div className="rise-inventory-heading"><h3>Product and variant availability</h3><p>Showing {shown.length} of {all.length} collected products</p></div>
    <table><caption className="sr-only">Collected product variants, prices and availability</caption><thead><tr><th>Product</th><th>Variant</th><th>Price</th><th>Availability</th></tr></thead>
      {shown.map((product: any, i: number) => {
        const variants = Array.isArray(product.variants) && product.variants.length ? product.variants : [{ title: 'Variant not recorded', available: null }];
        return <tbody data-inventory-product={product.handle || i} data-product-title={clean(product.title)} key={product.handle || i}>
          {variants.slice(0, 8).map((variant: any, j: number) => <tr key={j} data-variant="1">
            {j === 0 ? <th scope="rowgroup" rowSpan={Math.min(variants.length, 8)} className="rise-product-name">{proofHref(product.url) ? <a href={proofHref(product.url)} target="_blank" rel="noopener noreferrer">{clean(product.title)}</a> : clean(product.title)}</th> : null}
            <td className="rise-variant-name">{proofHref(product.url) ? <a href={proofHref(product.url)} target="_blank" rel="noopener noreferrer">{clean(variant.title) || 'Variant not recorded'}</a> : clean(variant.title) || 'Variant not recorded'}</td>
            <td className="rise-price">{variant.price != null && Number.isFinite(Number(variant.price)) && variant.currency ? fmtPrice(Number(variant.price), curSymbol(variant.currency)) : 'Price unknown'}</td>
            <td className="rise-availability"><span data-available={variant.available === true ? 'available' : variant.available === false ? 'sold-out' : 'unknown'}>{variant.available === true ? 'Available' : variant.available === false ? 'Sold out' : 'Availability unknown'}</span></td>
          </tr>)}
        </tbody>;
      })}
    </table>
    {shown.filter((p: any) => Array.isArray(p.variants) && p.variants.length > 8).map((p: any, i: number) => <p key={i} data-variant-cap="1" className="rise-receipt">{clean(p.title)}: First 8 of {p.variants.length} variants shown.</p>)}
    <p className="rise-receipt">Availability is a snapshot, not a live stock feed. {checkedAt(shop.fetched_at) ? `Catalog checked ${checkedAt(shop.fetched_at)}. ` : ''}{proofHref(shop.source_url) ? <a href={proofHref(shop.source_url)} target="_blank" rel="noopener noreferrer">View your catalog</a> : null}</p>

  </div>;
}

function PromiseSection({ d, id, n, title, block, ink, headingFont }: {
  d: any; id: string; n: number; title: string; block?: PromiseBlock | null; accent: string; ink: string; headingFont: string;
}) {
  const items = promiseItems(block);
  if (!items.length) return null;
  const allItems = [...promiseItems(d.drop_off), ...promiseItems(d.second_order)];
  const inventoryItem = allItems.find(isInventoryItem);
  const shots = datedScreenshots(d.screenshots);
  const capturedItem = checkedAt(shots?.captured_at) && shots?.pdp_url
    ? allItems.find((it) => sameProductPage(it.product?.url || it.evidence?.source_url, shots.pdp_path)) : null;
  return (
    <section id={id} aria-label={title} data-promise-section={id} className="rise-findings">
      {items.map((it, i) => {
        const ev = it.evidence;
        return <article key={`${it.id}-${i}`} className="rise-finding" data-promise-item={it.id}>
          <div className="rise-finding-header">
            <div><p className="rise-chapter">Finding {n + i} · {title}</p><h2>{clean(it.title)}</h2>{it.detail ? <p className="rise-detail">{clean(it.detail)}</p> : null}</div>
            {it.fix ? <aside className="rise-action"><h3>Recommended next step</h3><p>{clean(it.fix)}</p></aside> : null}
          </div>
          {ev && (ev.label || ev.value) ? ev.citations && ev.citations.length > 1 ? (
            <div data-promise-evidence="1"><p className="rise-evidence-label">{clean(ev.label)}</p><div className="rise-paired">
              {ev.citations.map((citation, ci) => <blockquote data-promise-citation="1" key={`${citation.url}-${ci}`}>
                <p className="rise-source-label">{it.id === 'refund_policy_mismatch' && ci < 2 ? ['The linked refund destination', 'The separate returns destination'][ci] : `Source ${ci + 1}${proofHref(citation.url) ? ` · ${new URL(citation.url).hostname.replace(/^www\./, '')}` : ''}`}</p>
                <p className="rise-quote">{clean(citation.quote)}</p>
                {proofHref(citation.url) ? <a href={proofHref(citation.url)} target="_blank" rel="noopener noreferrer">Read source {ci + 1}</a> : null}
              </blockquote>)}
            </div></div>
          ) : <p data-promise-evidence="1" className="rise-receipt"><strong>{clean(ev.label)}</strong>{ev.value ? `: ${clean(ev.value)}. ` : '. '}{proofHref(ev.source_url) ? <a href={proofHref(ev.source_url)} target="_blank" rel="noopener noreferrer">{sourceLabel(ev.source_url, true)}</a> : null}</p> : null}
          {it === inventoryItem ? <InventoryExhibit shop={d.shopify} ink={ink} headingFont={headingFont} /> : null}
          {it === capturedItem ? <figure data-promise-capture="1" className="rise-capture">
            <a href={shots.pdp_url} target="_blank" rel="noopener noreferrer"><img src={shots.pdp_url} alt={`${clean(it.product?.title) || 'Source product'} page capture`} data-store-img="1" loading="lazy" className="rise-capture-image" /></a>
            <figcaption><strong>{clean(it.product?.title) || 'Matched product page'}</strong><p>Open the image to inspect the full page.</p><p>Captured {checkedAt(shots.captured_at)}.</p>{proofHref(it.product?.url || ev?.source_url) ? <a href={proofHref(it.product?.url || ev?.source_url)} target="_blank" rel="noopener noreferrer">Open the source page</a> : null}</figcaption>
          </figure> : null}
          {!isInventoryItem(it) && it.product ? <p className="rise-receipt">{clean(it.product.title)}{productPrice(it.product) ? ` · From ${productPrice(it.product)}` : ''}</p> : null}
        </article>;
      })}
      {block?.note ? <p className="rise-coverage" data-promise-note="1">{clean(block.note)}</p> : null}
    </section>
  );
}

function CompactAdRecords({ google, metaPage, metaSweep, competitors }: { google: any; metaPage: any; metaSweep: any; competitors: any }) {
  const g = google?.status === 'present' ? google.data : null;
  const m = metaPage?.status === 'present' ? metaPage.data : null;
  const sweep = ['present', 'empty'].includes(metaSweep?.status) ? metaSweep.data : null;
  const comp = competitors?.status === 'present' ? competitors.data : null;
  const newestAge = g ? daysBetween(g.newest_first_shown, g.checked_at || google.fetched_at) : null;
  const amount = (n: number, capped?: boolean) => `${capped ? 'at least ' : ''}${n}`;
  return <div className="rise-ad-records">
    {metaPage?.status === 'empty' && metaPage.page_confirmed === true ? <p><strong>No active ads on the identified Facebook page.</strong> This check does not establish brand-wide or historical activity.</p> : null}
    {m && typeof m.active_ad_count === 'number' ? <p>Identified Facebook page: {m.active_ad_count} active ads.{typeof m.oldest_active_run_days === 'number' ? ` Oldest active run: ${m.oldest_active_run_days} days.` : ''}</p> : null}
    {sweep ? <p>Meta keyword sample{Array.isArray(sweep.keywords) && sweep.keywords.length ? ` for ${sweep.keywords.map(clean).join(', ')}` : ''}: {typeof sweep.sampled_items === 'number' ? `${amount(sweep.sampled_items, sweep.capped)} ads read. ` : ''}{typeof sweep.identity_matched_ads === 'number' ? `${sweep.identity_matched_ads} identity-matched results.` : ''}</p> : null}
    {g ? <div><h3>Google ad records</h3><p>{typeof g.ads_found === 'number' ? `${amount(g.ads_found, g.capped)} creatives in the returned records. ` : ''}{g.advertiser ? `Advertiser: ${clean(g.advertiser)}. ` : ''}{g.region ? `Region: ${clean(g.region)}.` : ''}</p>
      {g.formats ? <p>{Object.entries(g.formats).filter(([, value]) => typeof value === 'number').map(([key, value]) => `${clean(key)}: ${value}`).join(' · ')}</p> : null}
      {g.newest_first_shown ? <p>Newest first shown: {isoDay(g.newest_first_shown)}{newestAge != null ? `, ${newestAge} ${dayWord(newestAge)} before the check` : ''}.</p> : null}
      {g.oldest_first_shown ? <p>Oldest first shown: {isoDay(g.oldest_first_shown)}.</p> : null}
      {g.latest_last_shown ? <p>Latest last shown: {isoDay(g.latest_last_shown)}.</p> : null}
      <div className="rise-ad-grid">{(Array.isArray(g.creatives) ? g.creatives.slice(0, 6) : []).map((c: any, i: number) => <div key={i}><strong>{clean(c.format) || 'Ad creative'}</strong><p>{c.first_shown ? `First shown ${isoDay(c.first_shown)}. ` : ''}{c.last_shown ? `Last shown ${isoDay(c.last_shown)}.` : ''}</p>{[...new Set([c.ad_url, c.preview_url, creativeImageSrc(c)].filter((url) => url && proofHref(url)))].map((url: any, j) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">{j === 0 ? 'View creative' : 'View source image'}</a>)}</div>)}</div>
    </div> : null}
    {comp ? <div><h3>Competitor sample</h3>{Array.isArray(comp.keywords) && comp.keywords.length ? <p>Keywords: {comp.keywords.map(clean).join(', ')}</p> : null}<p>{typeof comp.advertisers_seen === 'number' ? `${amount(comp.advertisers_seen, comp.capped)} separate advertisers. ` : ''}{typeof comp.sampled_items === 'number' ? `${amount(comp.sampled_items, comp.capped)} ads sampled.` : ''}</p><div className="rise-ad-grid">{compStrip(competitors).slice(0, 6).map((c: any, i: number) => <div key={i}><strong>{clean(c.advertiser)}</strong><p>{c.start_date ? `Started ${isoDay(c.start_date)}. ` : ''}{typeof c.age_days === 'number' ? `${c.age_days} ${dayWord(c.age_days)} before the check.` : ''}</p>{c.keyword ? <p>Keyword: {clean(c.keyword)}</p> : null}{c.opening_text ? <p>{clean(c.opening_text)}</p> : null}{proofHref(c.ad_url || c.snapshot_url || creativeImageSrc(c)) ? <a href={proofHref(c.ad_url || c.snapshot_url || creativeImageSrc(c))} target="_blank" rel="noopener noreferrer">View creative</a> : null}</div>)}</div></div> : null}
  </div>;
}

// ── Week-one panel: the split of labor, drawn ──────────────────────────────────────────
// Closes the findings chapter. Titles only: each finding already carries its own verbatim
// week_one line above, so this panel summarizes rather than repeats.
function WeekOnePanel({
  findings,
  accent,
  ink,
  surface,
  headingFont,
}: {
  findings: any[];
  accent: string;
  ink: string;
  surface: string;
  headingFont: string;
}) {
  const byBucket: Record<BucketKey, any[]> = { rise: [], split: [], yours: [], asset: [] };
  let total = 0;
  for (const f of findings) {
    const b = bucketOf(f);
    if (b) {
      byBucket[b].push(f);
      total++;
    }
  }
  // One finding has no split to show: the panel would only restate it under an empty bar.
  if (total < 2) return null;
  const present = BUCKET_ORDER.filter((b) => byBucket[b].length > 0);
  const segFill = (b: BucketKey) =>
    b === 'rise' ? accent : b === 'split' ? `repeating-linear-gradient(45deg, ${accent} 0 3px, ${ink}14 3px 8px)` : b === 'asset' ? ink : `${ink}0f`;

  const column = (b: BucketKey) => (
    <div>
      <div className="flex items-center gap-2.5">
        <BucketGlyph b={b} accent={accent} ink={ink} size={9} />
        <span className="text-[0.75rem] font-bold uppercase tracking-[0.2em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.75 }}>
          {BUCKETS[b].label}
        </span>
      </div>
      <div
        className="mt-3 font-extrabold tabular-nums leading-none"
        style={{ fontFamily: headingFont, fontSize: 'clamp(2.75rem, 6vw, 4rem)', color: b === 'rise' ? ink : ink, opacity: b === 'yours' ? 0.55 : 1 }}
      >
        {byBucket[b].length}
      </div>
      <ul className="mt-5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {byBucket[b].map((f, i) => (
          <li key={i} className="py-3 text-[0.98rem] leading-snug" style={{ borderTop: `1px solid ${ink}14`, color: ink, opacity: 0.85 }}>
            {clean(f.title)}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="mt-20 pt-12" data-weekone="1" style={{ borderTop: `2px solid ${ink}` }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: ink, opacity: 0.25 }} />
        <span className="text-[0.75rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>Week one</span>
      </div>
      <h3 className="font-extrabold tracking-[-0.02em] mb-9" style={{ fontFamily: headingFont, fontSize: 'clamp(1.75rem, 4vw, 2.9rem)', color: ink, lineHeight: 1.04 }}>
        Who does what
      </h3>

      {/* The whole read in one glance: every finding, sized by side (a one-side bar splits nothing). */}
      {present.length > 1 ? <div className="cedt-splitbar" aria-hidden="true">
        {present.map((b) => (
          <span
            key={b}
            style={{
              width: `${(byBucket[b].length / total) * 100}%`,
              background: segFill(b),
              border: b === 'yours' ? `1px dashed ${ink}59` : undefined,
            }}
          />
        ))}
      </div> : null}

      <div className="mt-10 grid md:grid-cols-2 gap-y-10 md:gap-x-14">
        {byBucket.rise.length > 0 ? column('rise') : null}
        {byBucket.yours.length > 0 ? column('yours') : null}
      </div>

      {byBucket.split.length > 0 ? (
        <div className="mt-12 pt-8" style={{ borderTop: `1px solid ${ink}14` }}>
          <div className="grid md:grid-cols-12 gap-y-4 md:gap-x-10 items-start">
            <div className="md:col-span-3">
              <div className="flex items-center gap-2.5">
                <BucketGlyph b="split" accent={accent} ink={ink} size={9} />
                <span className="text-[0.75rem] font-bold uppercase tracking-[0.2em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.75 }}>
                  {BUCKETS.split.label}
                </span>
              </div>
              <div className="mt-3 font-extrabold tabular-nums leading-none" style={{ fontFamily: headingFont, fontSize: 'clamp(2.75rem, 6vw, 4rem)', color: ink }}>
                {byBucket.split.length}
              </div>
            </div>
            <div className="md:col-span-9">
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {byBucket.split.map((f, i) => (
                  <li key={i} className="py-3 text-[0.98rem] leading-snug" style={{ borderTop: `1px solid ${ink}14`, color: ink, opacity: 0.85 }}>
                    {clean(f.title)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {byBucket.asset.length > 0 ? (
        <div className="mt-12 p-6 sm:p-7" style={{ background: ink, color: surface, borderRadius: 4 }}>
          <div className="flex items-center gap-2.5 mb-4">
            <BucketGlyph b="asset" accent={accent} ink={surface} size={9} />
            <span className="text-[0.75rem] font-bold uppercase tracking-[0.2em]" style={{ fontFamily: headingFont, color: surface, opacity: 0.8 }}>
              {BUCKETS.asset.label}
            </span>
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {byBucket.asset.map((f, i) => (
              <li key={i} className="py-2.5 text-[0.98rem] leading-snug" style={{ borderTop: '1px solid rgba(255,255,255,.16)', color: surface, opacity: 0.88 }}>
                {clean(f.title)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function DtcGrowthReport({ report, scan, companyName }: { report: ReportJson; scan: Scan; companyName: string }) {
  const original = report.dtc;
  if (!original) return null;
  const d = { ...original };
  // Cause deduplication belongs to the builder, which retains complete evidence membership.
  // The renderer only suppresses the retired catalog-age recommendation on older rows.
  for (const key of ['drop_off', 'second_order'] as const) {
    const block = original[key];
    if (!block) continue;
    const items = promiseItems(block);
    d[key] = { ...block, items, note: items.length || !block.items.length ? block.note : '' };
  }
  const [heroBlock, heroIndex] = (original.hero?.item_ref || '').split('.');
  const originalHero = (original as any)[heroBlock]?.items?.[Number(heroIndex) || 0];
  const visibleItems = (['drop_off', 'second_order'] as const).flatMap((key) => promiseItems(d[key]).map((item, i) => ({ item, ref: `${key}.${i}` })));
  const resolvedHero = visibleItems.find(({ item }) => item.id === originalHero?.id) || visibleItems[0];
  if (resolvedHero) d.hero = { headline: originalHero?.id === resolvedHero.item.id ? original.hero?.headline || resolvedHero.item.title : resolvedHero.item.title, item_ref: resolvedHero.ref };


  const brand = d.brand;
  const accent = brand.accent_hex || '#ffc71d';
  const ink = brand.ink_hex || '#111111';
  const surface = brand.surface_hex || '#ffffff';
  const headingFont = brand.font_heading ? `'${brand.font_heading}', sans-serif` : "'Sora', sans-serif";
  const bodyFont = brand.font_body ? `'${brand.font_body}', sans-serif` : "'Manrope', sans-serif";
  const bookingUrl = brand.booking_url;
  const logoUrl = brand.logo_url || undefined;
  const wordmark = brand.wordmark || 'RISE DTC';

  // Per-slot CTA attribution. Appends UTMs without breaking a booking URL that already
  // carries a query string.
  const ctaUrl = (slot: string) =>
    bookingUrl + (bookingUrl.includes('?') ? '&' : '?') +
    'utm_source=scan&utm_medium=cta&utm_campaign=growth-scan&utm_content=' + slot;

  // Approved new-contract rows use the dossier; legacy and held rows retain their existing path.
  const qualityHeld = !!d.quality && (d.quality.version !== 'rise-quality-2026-09-30' || d.quality.approved !== true);
  const promise = !qualityHeld && isPromiseRow(d);
  // Legacy prose scrub (see scrubProse): paid wording only ships when Meta ads were read live.
  const paidOk = d.ads?.meta?.status === 'present';
  // Retired 2026-09-26: the "Email capture is already live" strength card. It rested on
  // substring hits in the homepage HTML (a capture app's script can load with no campaign
  // configured), so it told founders they had something they may not have.
  // New-contract rows carry the store's own gaps in drop_off / second_order, so the findings
  // list keeps only RISE's side (paid media, creative) and never restates an item above it.
  const findings = (d.findings || []).filter(
    (f) =>
      !(f.signal === 'signup' && f.kind === 'strength') &&
      // The sold-out-variants finding (lever paid_media, read off the catalog) is the same fact as
      // the drop-off section's sold-out item, so only ad-read findings survive on promise rows.
      (!promise || ((f.lever === 'paid_media' || f.lever === 'performance_creative') && f.signal !== 'shopify')),
  )
    .map((f) => {
      if (f.signal === 'ads.meta' && d.ads?.meta?.status === 'empty') {
        if (d.ads.meta.page_confirmed !== true) return null;
        // Preserve verified page-scoped observations, including installed tracking facts.
        const pageScoped = /(?:facebook|identified|your|this) page/i.test(f.title) && /(?:facebook|identified|your|this) page/i.test(f.evidence);
        return { ...f,
          title: pageScoped ? f.title : 'No active ads on the identified Facebook page',
          evidence: pageScoped ? f.evidence : `The identified Facebook page had no active ads when checked${checkedAt(d.ads.meta.fetched_at) ? ` on ${checkedAt(d.ads.meta.fetched_at)}` : ''}. This check does not establish brand-wide or historical ad activity.`,
          week_one: f.week_one?.replace(/a first Meta campaign/gi, 'a Meta campaign'),
        };
      }
      return promise ? f : scrubLegacyFinding(f, paidOk);
    })
    .filter((f): f is NonNullable<typeof f> => !!f);

  // A hook that loses a sentence to the scrub reads as a fragment: it takes the default hook.
  // So does a hook whose numbers no rendered finding carries (round 5: 20 legacy hooks led with a
  // discount count whose finding the scrub or the builder had dropped).
  const findingNums = new Set(
    findings.flatMap((f) => `${f.title || ''} ${f.evidence || ''}`.match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/,/g, '')),
  );
  const hookBacked = (clean(d.hero_hook).match(/\d[\d,.]*\d|\d/g) || []).every((n) => findingNums.has(n.replace(/,/g, '')));
  const legacyHook = clean(scrubProse(d.hero_hook, paidOk)) === clean(d.hero_hook) && hookBacked
    ? clean(d.hero_hook)
    : 'A public read of your store, and where the growth is.';

  // Read date from the row itself. Never fabricated: absent field renders no date at all.
  // `dtc.completed_at` is restamped on every build (a rebuild reads the store again), so it
  // wins over the scan row's created_at, which only dates the first build.
  const readIso = (d as any).completed_at || scan.created_at;
  const scanDate = checkedAt(readIso);

  // REAL DEFECT the floor never fixed: the brand fonts were declared but never loaded. Load them.
  useGoogleFonts([brand.font_heading, brand.font_body]);

  useMetadata({
    title: `A growth scan for ${companyName}`,
    description: (qualityHeld ? 'No recommendation qualified from the public pages reviewed.' : null) || (promise && clean((d as any).hero?.headline)) || legacyHook || `A public read of ${possessive(companyName)} store, and where the growth is.`,
    canonical: `${(import.meta as any).env?.VITE_SCAN_ORIGIN || 'https://ivanmanfredi.com'}/scan/${scan.company_slug}`,
    ogImage: d.og_image_url || brand.og_image_url || undefined,
    noindex: true,
  });

  // Credibility line: name ONLY sources that were actually read (present OR empty — empty is an
  // honest negative, the source WAS reached). Fixed order, deduped, pagespeed skipped entirely.
  const readSignals = d.completeness?.signals || {};
  const readLabels: string[] = [];
  for (const [key, label] of READ_SOURCE_LABELS) {
    const st = readSignals[key];
    if ((st === 'present' || st === 'empty') && !readLabels.includes(label)) readLabels.push(label);
  }
  let credibilityLine = '';
  if (readLabels.length === 1) credibilityLine = `Read from ${readLabels[0]}.`;
  else if (readLabels.length > 1) {
    credibilityLine = `Read from ${readLabels.slice(0, -1).join(', ')} and ${readLabels[readLabels.length - 1]}.`;
  }

  // The old proof-of-work stat band ("The store, in numbers") is retired: bare pull-stats
  // carry no argument, and every fact a finding rests on now renders in the receipt where
  // its binding is visible. A fact with no consequence attached does not render.
  const adsMeta = d.ads?.meta;
  const shop = d.shopify;
  const thinRead = !promise && findings.length === 0;

  // Dated storefront capture: present ONLY after a human QA pass wrote it to the row.
  // Attaches under the finding named by attach_signal, defaulting to the lead finding.
  const capture = d.evidence_capture && d.evidence_capture.url ? d.evidence_capture : null;
  const captureDate = checkedAt(capture?.captured_at);
  const captureAttachIndex = capture
    ? Math.max(0, findings.findIndex((f) => f.signal === capture.attach_signal))
    : -1;

  const findingVariant = (i: number): 'lead' | 'split' | 'offset' => (['lead', 'split', 'offset'] as const)[i % 3];

  // ── audit v3 evidence blocks (all optional, all presence-gated) ─────────────────────
  const dAny = d as any;
  const storeFeatures = dAny.public_depth?.status === 'present' && Array.isArray(dAny.public_depth.data?.store_features)
    ? dAny.public_depth.data.store_features.filter((f: any) => f.quote && proofHref(f.source_url)) : [];
  const secondOrderBlock = d.second_order && !promiseItems(d.second_order).length
    ? { ...d.second_order, note: storeFeatures.length
      ? 'Your repeat-order rate needs store data. The public features below show what is already available to shoppers.'
      : 'Your repeat-order rate needs store data to assess.' }
    : d.second_order;
  const riseCases = casesFor([
    ...(Array.isArray(dAny.competitors?.data?.keywords) ? dAny.competitors.data.keywords : []),
    ...(Array.isArray(dAny.bestsellers?.data?.handles) ? dAny.bestsellers.data.handles : []),
    String(dAny.hero?.headline || ''),
  ]);
  const gAds = dAny.ads?.google;
  const metaSweep = dAny.ads?.meta_sweep;
  const competitors = dAny.competitors;
  const hasAdEvidence = [gAds, adsMeta, metaSweep, competitors].some((signal) => signal && signal.status !== 'absent');

  // Dated storefront plates. A URL with no capture date, or a capture date with no URL,
  // renders nothing: an undated screenshot is not evidence.
  const shots = datedScreenshots(dAny.screenshots);
  const shotDate = checkedAt(shots?.captured_at);
  const shotPlates: Array<{ idx: number; url: string; label: string }> = [];
  if (shots && shotDate) {
    const homeIdx = findings.findIndex((f) => f.signal === 'shopify');
    if (shots.homepage_url && homeIdx >= 0) shotPlates.push({ idx: homeIdx, url: shots.homepage_url, label: 'Homepage context only' });
    if (shots.pdp_url) {
      const at = findings.findIndex((f) => sameProductPage(f.source_url, shots.pdp_path));
      if (at != null && at >= 0) shotPlates.push({ idx: at, url: shots.pdp_url, label: 'Your product page' });
    }
  }

  const anyBucket = findings.some((f) => bucketOf(f) !== null);

  // ── Sourced vitals receipt ──────────────────────────────────────────────────────────
  // Two gates per line: the signal status has to allow it (correctness spine) AND the fact
  // has to be BOUND, meaning a rendered finding cites it. Binding
  // hay is the prose the reader actually sees, per signal.
  const hayFor = (sig: string) =>
    findings.filter((f) => f.signal === sig).map((f) => `${clean(f.title)} ${clean(f.evidence)}`).join(' ');
  const hasFinding = (sig: string) => findings.some((f) => f.signal === sig);
  const haysShopify = hayFor('shopify');

  const catalogLines: ReceiptLine[] = [];
  const shopData = shop?.status === 'present' && shop.data ? shop.data : null;
  if (shopData) {
    const rest: ReceiptLine[] = [];
    // Human source words (2026-09-26): the catalog, whichever platform served it.
    const catalogSrc = 'your catalog';
    const depthCited = shopData.discount_depth_pct != null && cited(haysShopify, `${shopData.discount_depth_pct}%`);
    if (
      typeof shopData.products_on_discount === 'number' &&
      typeof shopData.catalog_size === 'number' &&
      (cited(haysShopify, String(shopData.products_on_discount)) || depthCited)
    ) {
      // Merch denominator, matching the finding. Mixing a merch numerator with a raw row count
      // ships "73 of 78" in the rail under "every one of your 73 live products" in the finding,
      // and the reader has to decide which of our own two numbers to believe.
      rest.push({ signal: 'shopify', label: 'On discount', value: `${shopData.products_on_discount} of ${(shopData as any).merch_catalog_size ?? shopData.catalog_size}`, source: catalogSrc });
    }
    if (shopData.discount_depth_pct != null && depthCited) {
      rest.push({ signal: 'shopify', label: 'Average discount depth', value: `${shopData.discount_depth_pct}%`, source: catalogSrc });
    }
    const band = shopData.price_band;
    const shopSym = curSymbol(shopData.currency);
    if (
      band &&
      (citedAmount(haysShopify, band.min) ||
        citedAmount(haysShopify, band.max) ||
        /price band/i.test(haysShopify))
    ) {
      rest.push({ signal: 'shopify', label: 'Price band, low to high', value: `${fmtPrice(band.min, shopSym)} to ${fmtPrice(band.max, shopSym)}`, source: catalogSrc });
    }
    if (band && band.median != null && citedAmount(haysShopify, band.median)) {
      rest.push({ signal: 'shopify', label: 'Median price', value: fmtPrice(band.median, shopSym), source: catalogSrc });
    }
    if (shopData.oos_pct != null && (cited(haysShopify, `${shopData.oos_pct}%`) || /out[- ]of[- ]stock/i.test(haysShopify))) {
      rest.push({ signal: 'shopify', label: 'Out of stock', value: `${shopData.oos_pct}%`, source: catalogSrc });
    }
    // 🔴 products.json has NEVER carried selling_plan_groups at any Shopify version, so the
    // subscription verdict is never sourced to the catalog. It is read from the product pages.
    const subSrc = shopData.subscription_source_url ? 'your product pages' : 'your storefront';
    if (shopData.has_subscription === false && /subscri/i.test(haysShopify)) {
      rest.push({ signal: 'shopify', label: 'Subscription option', value: 'none found', source: subSrc, none: true });
    } else if (shopData.has_subscription === true && /subscri/i.test(haysShopify)) {
      rest.push({ signal: 'shopify', label: 'Subscription option', value: 'live', source: subSrc });
    }
    // Catalog size renders ONLY when a finding cites the count itself, exactly like every
    // other line, so the foot's binding claim stays true by construction (slop pass, 07-31).
    if (typeof shopData.catalog_size === 'number' && cited(haysShopify, String(shopData.catalog_size))) {
      catalogLines.push({ signal: 'shopify', label: 'Products live', value: String(shopData.catalog_size), source: catalogSrc });
    }
    catalogLines.push(...rest);
  }

  const pageLines: ReceiptLine[] = [];
  const rev = d.reviews;
  if (rev?.status === 'present' && rev.data && rev.data.rating != null && rev.data.review_count != null && hasFinding('reviews')) {
    // Ratings read "5.0", never "5": one decimal is how the PDP itself states them.
    pageLines.push({ signal: 'reviews', label: 'Product page rating', value: `${rev.data.rating.toFixed(1)} from ${rev.data.review_count}`, source: 'your product page' });
  } else if (rev?.status === 'empty' && hasFinding('reviews')) {
    pageLines.push({ signal: 'reviews', label: 'Product page reviews', value: 'none visible', source: 'your product page', none: true });
  }
  const sig = d.signup;
  const markers = sig?.data?.capture_markers || [];
  if (sig?.status === 'present' && sig.data?.has_capture_markers && markers.length > 0 && hasFinding('signup')) {
    // Never the raw detector markers ("newsletter, subscribe, privy"): they are substring hits,
    // not words a founder would use, and a long list broke the 390px layout (rnwy, cflwr).
    pageLines.push({ signal: 'signup', label: 'Email sign-up', value: 'on your homepage', source: 'your storefront' });
  } else if (sig?.status === 'empty' && hasFinding('signup')) {
    pageLines.push({ signal: 'signup', label: 'Email sign-up', value: 'none found', source: 'your storefront', none: true });
  }

  const paidLines: ReceiptLine[] = [];
  if (adsMeta?.status === 'empty' && hasFinding('ads.meta')) {
    paidLines.push(
      { signal: 'ads.meta', label: 'Meta Ad Library', value: adsMeta?.page_confirmed === true ? 'no active ads on the identified page' : 'no identity-matched ads in the sample', source: 'Meta Ad Library', none: true },
    );
  } else if (
    adsMeta?.status === 'present' && adsMeta.data &&
    typeof adsMeta.data.active_ad_count === 'number' && adsMeta.data.active_ad_count > 0 &&
    hasFinding('ads.meta')
  ) {
    paidLines.push({ signal: 'ads.meta', label: 'Meta Ad Library', value: `${adsMeta.data.active_ad_count} active`, source: 'Meta Ad Library' });
  }

  const receiptGroups = [
    { label: 'Catalog', lines: catalogLines },
    { label: 'Pages', lines: pageLines },
    { label: 'Paid media', lines: paidLines },
  ].filter((g) => g.lines.length > 0);
  const receiptCount = catalogLines.length + pageLines.length + paidLines.length;
  // Under three bound lines the whole band collapses: no empty shells on blocked-heavy scans.
  const showReceipt = receiptCount >= 3;
  // The receipt's single gold moment: the line whose own value the LEAD finding cites, so
  // gold marks the number the page's argument opens on. Falls back to the first line
  // carrying the lead finding's signal.
  const flagSignal = findings[0]?.signal || null;
  const leadHay = findings[0] ? `${clean(findings[0].title)} ${clean(findings[0].evidence)}` : '';
  const allLines = receiptGroups.flatMap((g) => g.lines);
  const valueTokens = (v: string) => v.match(/\d[\d,]*(?:\.\d+)?%?/g) || [];
  // Rank candidate lines by how many of their own tokens the lead finding cites, so
  // "On discount 59 of 180" (two cited tokens) beats the context line "Products live 180".
  let flagLine: ReceiptLine | null = null;
  if (flagSignal) {
    let best = 0;
    for (const l of allLines) {
      if (l.signal !== flagSignal) continue;
      const hits = valueTokens(l.value).filter((t) => cited(leadHay, t)).length;
      if (hits > best) {
        best = hits;
        flagLine = l;
      }
    }
    if (!flagLine) flagLine = allLines.find((l) => l.signal === flagSignal) || null;
  }

  // Sticky booking bar (2026-09-26). The old floating pill sat over finding headings at 14
  // of 19 phone scroll stops, and its guard only knew about two dense panels. The bar docks
  // to the bottom edge on an opaque ground, the page reserves its height so the last line
  // clears it, and it steps away whenever another booking CTA (masthead, hero, close band)
  // is on screen, so two yellow asks never stack. SSR renders it visible.
  const [pillHidden, setPillHidden] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || typeof document === 'undefined') return;
    const nodes = Array.from(document.querySelectorAll('[data-pill-hide]'));
    if (nodes.length === 0) return;
    const hits = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) hits.add(e.target);
          else hits.delete(e.target);
        }
        setPillHidden(hits.size > 0);
      },
      { root: null, threshold: 0 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);

  if (qualityHeld) return (
    <main className="mx-auto max-w-3xl px-6 py-16" style={{ color: ink, fontFamily: bodyFont }}>
      <a href="https://risedtc.com">{wordmark}</a>
      <h1 className="mt-10 text-3xl font-bold" style={{ fontFamily: headingFont }}>No recommendation qualified</h1>
      <p className="mt-5 leading-relaxed">We could not establish a sufficiently supported issue from the public pages reviewed for {companyName}.</p>
      <p className="mt-4 leading-relaxed">Actual drop-off, repeat orders and ad performance need store and ad-account data.</p>
    </main>
  );

  if (promise) return (
    <div className="rise-report" style={{ ['--rise-ink' as any]: ink, ['--rise-accent' as any]: accent, ['--rise-heading' as any]: headingFont, fontFamily: bodyFont } as React.CSSProperties}>
      <header className="rise-cover">
        <div className="rise-cover-inner">
          <div className="rise-masthead"><a href="https://risedtc.com" target="_blank" rel="noopener noreferrer"><img src={logoUrl || 'https://risedtc.com/wp-content/uploads/2025/04/Rise-DTC-logo-blk-300-alt.png'} alt={wordmark} /></a><a href="#rise-conversation" data-cta="header">Discuss the report ↗</a></div>
          <section data-promise-hero="1" aria-label="Report introduction" className="rise-introduction">
            <div><p className="rise-kicker">Public storefront review</p><h1>A growth scan for <span>{companyName}</span></h1><p className="rise-intro-copy">We reviewed {possessive(companyName)} public storefront and available advertising signals. Here are the observations, the sources behind them, and the next steps to consider.</p></div>
            <aside className="rise-cover-meta"><p><span>Report snapshot</span><strong>{scanDate || 'Date not recorded'}</strong></p><p><span>Store</span><a href={`https://${scan.domain}`} target="_blank" rel="noopener noreferrer">{scan.domain} ↗</a></p></aside>
          </section>
        </div>
      </header>
      <main className="rise-document">
        <nav className="rise-overview" aria-label="Report contents">
          <span>In this review</span>
          {promiseItems(d.drop_off).length ? <a href="#drop-off">Shopper paths <span>↘</span></a> : null}
          {promiseItems(d.second_order).length ? <a href="#second-order">Repeat purchase <span>↘</span></a> : null}
          {storeFeatures.length ? <a href="#store-features">Already in place <span>↘</span></a> : null}
          {findings.length || hasAdEvidence ? <a href="#paid-media">Paid-media check <span>↘</span></a> : null}
        </nav>
        <PromiseSection d={d} id="drop-off" n={1} title="Shopper paths" block={d.drop_off} accent={accent} ink={ink} headingFont={headingFont} />
        <PromiseSection d={d} id="second-order" n={promiseItems(d.drop_off).length + 1} title="Repeat purchase" block={d.second_order} accent={accent} ink={ink} headingFont={headingFont} />
        {storeFeatures.length ? <section id="store-features" className="rise-section" data-store-features="1">
          <div className="rise-section-heading"><h2>Already on your store</h2><p>{!promiseItems(d.second_order).length ? secondOrderBlock?.note : 'Public features to consider when planning the next purchase. Their presence does not establish usage or sales impact.'}</p></div>
          <div className="rise-feature-grid">{storeFeatures.map((feature: any, i: number) => <blockquote key={`${feature.kind}-${i}`} data-store-feature={feature.kind}>
            <h3>{clean(feature.title)}</h3><p>{clean(feature.quote)}</p><a href={proofHref(feature.source_url)} target="_blank" rel="noopener noreferrer">Read source</a>{checkedAt(feature.fetched_at) ? <time dateTime={feature.fetched_at}>Checked {checkedAt(feature.fetched_at)}</time> : null}
            {checkedAt(shots?.captured_at) && sameProductPage(feature.source_url, shots?.pdp_path) && !storeFeatures.slice(0, i).some((prior: any) => sameProductPage(prior.source_url, shots?.pdp_path)) && ![...promiseItems(d.drop_off), ...promiseItems(d.second_order)].some((it) => sameProductPage(it.product?.url || it.evidence?.source_url, shots?.pdp_path)) ? <figure className="rise-feature-capture"><a href={shots.pdp_url} target="_blank" rel="noopener noreferrer"><img src={shots.pdp_url} alt="Captured source product page" className="rise-capture-image" loading="lazy" /></a><figcaption>Captured {checkedAt(shots.captured_at)}</figcaption></figure> : null}
          </blockquote>)}</div>
        </section> : null}
        {!storeFeatures.length && !promiseItems(d.second_order).length ? <p className="rise-empty-coverage">{secondOrderBlock?.note || 'Your repeat-order rate needs store data to assess.'}</p> : null}
        {findings.length || hasAdEvidence ? <section id="paid-media" className="rise-section">
          <p className="rise-chapter">Paid-media check</p>
          {findings.map((f, i) => <article className="rise-media-finding" key={i}><div><h2>{clean(f.title)}</h2><p className="rise-detail">{clean(f.evidence)}</p>{proofHref(f.source_url || '') ? <a className="rise-source-link" href={proofHref(f.source_url || '')} target="_blank" rel="noopener noreferrer">{sourceLabel(f.source_url || '', true)}</a> : null}</div>{f.week_one ? <aside className="rise-action"><h3>Next account check</h3><p>{clean(f.week_one)}</p></aside> : null}</article>)}
          {hasAdEvidence ? <details data-ad-archive="1" className="rise-disclosure"><summary>Supporting public ad records</summary>
          <div data-source-checks="1" className="rise-source-checks">
            {([
              ['Catalog', shop], ['Facebook page', adsMeta], ['Meta keyword search', metaSweep], ['Google advertiser search', gAds], ['Competitor search', competitors],
            ] as Array<[string, any]>).filter(([, signal]) => signal && signal.status !== 'absent').map(([label, signal]) => {
              const at = signal.data?.checked_at || signal.fetched_at;
              const cached = signal.data?.from_cache === true || signal.from_cache === true;
              const age = at && readIso ? (Date.parse(readIso) - Date.parse(at)) / 3600000 : NaN;
              const coverage = label === 'Competitor search' && !compStrip(signal).length
                ? signal.status === 'blocked' || signal.status === 'error' ? 'Check unavailable; competitor activity unknown.' : signal.status === 'present' && signal.data?.creatives?.some((c: any) => c.advertiser) ? 'Too few verified creatives for a comparison.' : 'No verified competitor creatives in this sample.'
                : label === 'Google advertiser search' && signal.status === 'empty' ? 'No identity-matched result in the queries checked.'
                : label === 'Meta keyword search' && signal.status === 'empty' ? 'No identity-matched result in the keyword sample.'
                : signal.status === 'blocked' || signal.status === 'error' ? 'Check unavailable; activity unknown.' : '';
              return <p key={label} className="mt-3"><strong>{label}</strong>{checkedAt(at) ? ` · Checked ${checkedAt(at)}` : ''}{cached ? ` · Cached result${Number.isFinite(age) && age >= 0 ? `, ${age.toFixed(1)} hours before this scan` : ''}` : ''}{coverage ? `. ${coverage}` : ''}{proofHref(signal.source_url) ? <> <a href={proofHref(signal.source_url)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">Source</a></> : null}</p>;
            })}
          </div>

            <CompactAdRecords google={gAds} metaPage={adsMeta} metaSweep={metaSweep} competitors={competitors} />
          </details> : null}
        </section> : null}
        <section className="rise-section rise-proof"><div className="rise-section-heading"><h2>Work RISE has run</h2><p>Published results from separate client engagements.</p></div><div className="rise-case-rows">{riseCases.map((c) => <a key={c.slug} href={caseUrl(c)} data-case={c.slug} target="_blank" rel="noopener noreferrer"><strong>{c.name}</strong><span>{c.headline}</span><span className="rise-case-read">Read the case study ↗</span></a>)}</div><a className="rise-source-link" href="https://risedtc.com/clients/?utm_source=scan&utm_medium=case&utm_campaign=growth-scan&utm_content=all" target="_blank" rel="noopener noreferrer">See all case studies</a></section>
        <section className="rise-closing" id="rise-conversation"><div className="rise-closing-top"><div><h2>Walk through the findings with Mattan.</h2><p>We put the public observations next to your store and ad-account data.</p></div><a href={ctaUrl('close')} data-cta="close" target="_blank" rel="noopener noreferrer" className="rise-booking">30 min with Mattan ↗</a></div>
          <details className="rise-disclosure"><summary>How RISE charges</summary><div className="rise-pricing"><div><h3>Performance Model</h3><p><strong>For qualifying brands.</strong> Lower fixed monthly fee plus a share of net growth above an agreed baseline, after ad spend. Creative, tech and AI included.</p></div><div><h3>Growth Model</h3><p>Base fee plus a percentage of ad spend, senior strategist included.</p></div></div><p>Which model fits your brand gets settled on the call.</p><p>RISE DTC is run by Mattan Danino and Matt Moore. For qualifying brands, platform work starts within 48 hours of onboarding.</p></details>
        </section>
      </main>
      <footer className="rise-footer"><p>{d.public_data_limits || 'A dated review of public pages. Conversion, retention and campaign performance need store and ad-account data.'} Reopening this link does not rerun the research.</p><span>Prepared for {companyName}. Unlisted link, shared with you only.</span></footer>
    </div>
  );

  return (
    <div style={{ background: surface, color: ink, fontFamily: bodyFont, minHeight: '100vh', paddingBottom: `calc(${STICKY_BAR_H}px + env(safe-area-inset-bottom))`, ['--cedt-hair' as any]: `${ink}14` } as React.CSSProperties}>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .cedt-anim { transition: none !important; }
        }
        @media (max-width: 640px) {
          .cedt-sig-row { flex-wrap: wrap; }
          .cedt-close-btn { width: 100%; margin-left: 0 !important; }
          .cedt-sig-avatar { width: 76px !important; height: 76px !important; border-radius: 18px !important; }
        }
        /* Receipt line: label with dotted leader, value, source tag. */
        .cedt-rcl { display: grid; grid-template-columns: minmax(0,1fr) auto 150px; align-items: baseline; column-gap: 14px; padding: 7px 0; }
        .cedt-rcl .lb { position: relative; overflow: hidden; white-space: nowrap; }
        .cedt-rcl .lb::after { content: " ........................................................................"; color: #c9ccd0; letter-spacing: .09em; font-size: .8rem; }
        @media (max-width: 640px) {
          .cedt-rcl { grid-template-columns: minmax(0,1fr) auto; row-gap: 2px; }
          .cedt-rcl .sr { grid-column: 1 / -1; text-align: left; }
          .cedt-rcl .lb { overflow: visible; white-space: normal; }
          .cedt-rcl .lb::after { content: ""; }
        }
        /* Findings data margin: rule on the left at desktop, above on mobile. */
        .cedt-margin { border-top: 1px solid var(--cedt-hair); padding-top: 1rem; margin-top: 1rem; }
        .cedt-margin:empty { border: 0; padding: 0; margin: 0; }
        @media (min-width: 1024px) {
          .cedt-margin { border-top: 0; border-left: 1px solid var(--cedt-hair); padding-left: 1.25rem; padding-top: 0; margin-top: 0; }
        }
        .cedt-sticky { transition: transform .18s ease; }

        /* ── audit v3: evidence spread instruments ─────────────────────────────── */
        /* Format split: one strip, segments proportional to their own sum. */
        .cedt-fmtbar { display: flex; height: 30px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,.3); }
        .cedt-fmtbar span { height: 100%; flex: 0 0 auto; border-right: 1px solid rgba(17,17,17,.4); }
        .cedt-fmtbar span:last-child { border-right: none; }
        /* Dated strip: format tag, then a track carrying one bar between two dates. */
        .cedt-gan { display: grid; grid-template-columns: 74px minmax(0,1fr); align-items: center; column-gap: 16px; padding: 5px 0; }
        .cedt-gan .lbl { font-family: 'Sora', sans-serif; font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .16em; color: rgba(255,255,255,.5); }
        .cedt-gan .trk { position: relative; display: block; height: 26px; border-radius: 3px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); }
        .cedt-gan .bar { position: absolute; top: 4px; bottom: 4px; border-radius: 2px; min-width: 3px; }
        .cedt-gan .dts { position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 8px; pointer-events: none; }
        .cedt-gan .dts b { font-family: 'Sora', sans-serif; font-size: .75rem; font-weight: 700; letter-spacing: .04em; color: rgba(255,255,255,.62); font-variant-numeric: tabular-nums; }
        .cedt-gan-head .trk, .cedt-gan-foot .trk { height: 18px; background: transparent; border: none; }
        .cedt-gan-head .yr { position: absolute; top: 0; transform: translateX(-50%); font-family: 'Sora', sans-serif; font-size: .75rem; font-weight: 700; letter-spacing: .14em; color: rgba(255,255,255,.4); }
        .cedt-gan-head .yr::after { content: ""; position: absolute; left: 50%; top: 15px; width: 1px; height: 7px; background: rgba(255,255,255,.22); }
        .cedt-gan-foot .trk b { position: absolute; top: 4px; font-family: 'Sora', sans-serif; font-size: .75rem; font-weight: 700; letter-spacing: .1em; color: rgba(255,255,255,.5); font-variant-numeric: tabular-nums; }
        @media (max-width: 640px) {
          .cedt-gan { grid-template-columns: minmax(0,1fr); row-gap: 3px; padding: 7px 0; }
          .cedt-gan .dts b { font-size: .75rem; }
        }
        /* Meta ledger row. */
        .cedt-mrow { display: grid; grid-template-columns: minmax(0,1fr) auto 160px; align-items: baseline; column-gap: 16px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,.14); }
        .cedt-mrow .nm { font-size: .94rem; color: rgba(255,255,255,.8); }
        .cedt-mrow .vl { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 1rem; color: #fff; font-variant-numeric: tabular-nums; }
        .cedt-mrow .dt { font-family: 'Sora', sans-serif; font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; text-align: right; color: rgba(255,255,255,.7); }
        @media (max-width: 640px) {
          .cedt-mrow { grid-template-columns: minmax(0,1fr) auto; row-gap: 3px; }
          .cedt-mrow .dt { grid-column: 1 / -1; text-align: left; }
        }
        /* Recency axis: older on the left, the read date on the right. */
        .cedt-axis { position: relative; height: 96px; }
        .cedt-axis .ln { position: absolute; left: 0; right: 0; top: 52px; height: 1px; background: rgba(255,255,255,.28); }
        .cedt-axis .dot { position: absolute; top: 45px; width: 15px; height: 15px; margin-left: -7.5px; border-radius: 50%; background: rgba(255,255,255,.62); border: 1px solid rgba(17,17,17,.5); }
        .cedt-axis .mkr { position: absolute; top: 30px; height: 44px; width: 3px; margin-left: -1.5px; }
        .cedt-axis .mkl { position: absolute; top: 4px; transform: translateX(-50%); white-space: nowrap; font-family: 'Sora', sans-serif; font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; }
        .cedt-axis .end { position: absolute; top: 74px; font-family: 'Sora', sans-serif; font-size: .75rem; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; color: rgba(255,255,255,.7); }
        .cedt-axis .end.l { left: 0; }
        .cedt-axis .end.r { right: 0; }
        /* Week-one split bar. */
        .cedt-splitbar { display: flex; height: 40px; border-radius: 4px; overflow: hidden; border: 1px solid ${ink}33; }
        .cedt-splitbar span { height: 100%; flex: 0 0 auto; }
        /* Bucket chip + week-one action row. */
        .cedt-w1 { display: grid; grid-template-columns: 108px minmax(0,1fr); column-gap: 18px; align-items: start; padding: 14px 0 14px 16px; margin-top: 1.5rem; }
        @media (max-width: 640px) { .cedt-w1 { grid-template-columns: minmax(0,1fr); row-gap: 6px; } }
        /* Evidence plate: a viewport-height crop, not a full-page dump. */
        .cedt-plate { display: block; width: 100%; height: 420px; object-fit: cover; object-position: top center; }
        @media (max-width: 640px) { .cedt-plate { height: 260px; } }
      `}</style>

      {/* Masthead */}
      <header style={{ borderBottom: `1px solid ${ink}14` }}>
        <div className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-4 flex items-center justify-between gap-3">
          <a href="https://risedtc.com" target="_blank" rel="noopener noreferrer">
            {logoUrl ? (
              <img src={logoUrl} alt={wordmark} className="h-6 sm:h-7 w-auto" />
            ) : (
              <span className="font-extrabold text-lg tracking-tight" style={{ fontFamily: headingFont, color: ink }}>{wordmark}</span>
            )}
          </a>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-[0.75rem] uppercase tracking-[0.22em]" style={{ color: ink, opacity: 0.7 }}>
              {scanDate ? `Growth Scan · ${scanDate}` : 'Growth Scan'}
            </span>
            <a
              href={ctaUrl('header')}
              data-cta="header"
              data-pill-hide="1"
              target="_blank"
              rel="noopener noreferrer"
              className="cedt-anim inline-flex items-center min-h-[44px] text-[0.85rem] font-bold px-4 rounded-full whitespace-nowrap transition-transform hover:-translate-y-0.5"
              style={{ background: accent, color: ink }}
            >
              Book 30 min with Mattan
            </a>
          </div>
        </div>
      </header>

      {/* Chapter — Cover / hook (legacy rows) */}
      <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 pt-16 sm:pt-24 pb-14">
        <div className="grid lg:grid-cols-12 gap-y-8 lg:gap-x-12 items-end">
          <div className="lg:col-span-9">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: ink, opacity: 0.25 }} />
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>
                A RISE DTC growth feature
              </span>
            </div>
            <p className="text-[1rem] font-semibold uppercase tracking-[0.2em] mb-5" style={{ color: ink, opacity: 0.7 }}>{companyName}</p>
            <h1
              className="font-extrabold tracking-[-0.02em]"
              style={{ fontFamily: headingFont, fontSize: 'clamp(2.25rem, 6.4vw, 5rem)', lineHeight: 1.02, color: ink }}
            >
              {legacyHook}
            </h1>
          </div>
          <div className="lg:col-span-3">
            {/* Analyst byline card: a named human runs this scan, and the reader sees him again at the close. */}
            <div className="flex items-center gap-3">
              <img
                src={MATTAN_PHOTO}
                alt="Mattan Danino"
                width={900}
                height={639}
                loading="lazy"
                decoding="async"
                style={{ width: 64, height: 64, objectFit: 'cover', objectPosition: '48% 18%', borderRadius: 16, border: `1px solid ${ink}1f` }}
              />
              <div>
                <div className="font-bold" style={{ color: ink }}>Mattan Danino</div>
                <div className="text-[0.75rem] uppercase tracking-[0.18em]" style={{ color: ink, opacity: 0.7 }}>CEO, RISE DTC</div>
              </div>
            </div>
            <p className="mt-2 text-[0.95rem] leading-relaxed" style={{ color: ink, opacity: 0.7 }}>
              My team ran this scan on {possessive(companyName)} public data. The call puts your live store and ad numbers next to it.
            </p>
            <a href="https://risedtc.com" target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-[0.8rem] underline underline-offset-4" style={{ color: ink, opacity: 0.7 }}>
              risedtc.com
            </a>
            {credibilityLine ? (
              <div className="mt-3 text-[0.8rem] leading-relaxed" style={{ color: ink, opacity: 0.7 }}>{credibilityLine}</div>
            ) : null}
            <p className="mt-3 text-[0.85rem] leading-relaxed" style={{ color: ink, opacity: 0.7 }}>
              For qualifying brands, RISE gets paid on performance: a lower fixed fee + a share of growth above an agreed baseline. The terms are at the end of this page.
            </p>
          </div>
        </div>
      </section>

      {/* Chapter — Evidence-first dark spread. Sits straight after the hook because the ad
          record is the one thing on this page the reader cannot argue with: it is dated, it
          is public, and it was read without them. Born-absent on a pre-v3 row. New-contract
          rows render it after RISE's findings instead, folded (below). */}
      {!promise && hasAdEvidence ? (
        <AdEvidenceSpread
          google={gAds}
          metaPage={adsMeta}
          metaSweep={metaSweep}
          competitors={competitors}
          accent={accent}
          ink={ink}
          surface={surface}
          headingFont={headingFont}
        />
      ) : null}

      {/* Chapter — Sourced vitals receipt. Every line is a public fact we read AND that a
          finding below cites, which is what the foot line claims.
          Under three bound lines the whole band collapses. */}
      {!promise && showReceipt ? (
        <section
          aria-label="Sourced vitals"
          style={{ background: '#f6f7f8', borderTop: `1px solid ${ink}14`, borderBottom: `1px solid ${ink}14` }}
        >
          <div className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-14 sm:py-16">
            {/* The receipt reads as a centered document, proof-strip measure, not a leftover column. */}
            <div className="mx-auto w-full max-w-[680px]">
            <div className="flex items-center gap-3 mb-7">
              <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: ink, opacity: 0.25 }} />
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>
                Everything we read, and where
              </span>
            </div>

            <div
             
              className="w-full"
              style={{ background: surface, border: `1px solid ${ink}14`, borderRadius: 4 }}
            >
              <div className="flex items-baseline justify-between gap-3 px-[22px] py-4" style={{ borderBottom: `1px solid ${ink}` }}>
                <span className="font-extrabold text-[1.02rem] tracking-[-0.01em]" style={{ fontFamily: headingFont, color: ink }}>
                  Store vitals
                </span>
                <span className="text-[0.75rem] font-bold uppercase tracking-[0.18em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.7 }}>
                  {scan.domain}
                </span>
              </div>

              {receiptGroups.map((g, gi) => (
                <div key={g.label} className="px-[22px] pt-1.5 pb-3" style={gi > 0 ? { borderTop: `1px solid ${ink}0f` } : undefined}>
                  <div className="pt-3 pb-2 text-[0.75rem] font-bold uppercase tracking-[0.24em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.7 }}>
                    {g.label}
                  </div>
                  {g.lines.map((l) => {
                    const isFlag = l === flagLine;
                    return (
                      <div
                        key={`${l.label}-${l.value}`}
                        className="cedt-rcl"
                        data-rcl="1"
                        data-rcl-flag={isFlag ? '1' : undefined}
                        style={isFlag ? { background: `${accent}1f`, borderLeft: `3px solid ${accent}`, margin: '4px -22px', padding: '10px 22px 10px 19px' } : undefined}
                      >
                        <span className="lb text-[0.94rem]" style={{ color: ink, opacity: isFlag ? 1 : 0.8, fontWeight: isFlag ? 700 : 400 }}>{l.label}</span>
                        <span
                          className="vl tabular-nums font-bold"
                          style={{
                            fontFamily: headingFont,
                            color: ink,
                            overflowWrap: 'anywhere',
                            textAlign: 'right',
                            opacity: l.none ? 0.7 : 1,
                            fontSize: l.none ? '0.86rem' : isFlag ? '1.12rem' : '1rem',
                          }}
                        >
                          {l.value}
                        </span>
                        <span className="sr text-[0.75rem] font-bold uppercase tracking-[0.08em] text-right" style={{ fontFamily: headingFont, color: ink, opacity: 0.7 }}>
                          {l.source}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Sentence-case running prose, never shouted micro-caps (slop pass, 07-31). */}
              <div
                className="px-[22px] py-3 text-[0.78rem] leading-relaxed"
                style={{ borderTop: '1px dashed #dfe3e7', color: ink, opacity: 0.7 }}
              >
                {scanDate ? `Read ${scanDate} from public pages, with no login and nothing you sent us. ` : ''}
                Every line above backs a finding below.
              </div>
            </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Chapter — Where the growth is (findings, worst-first, varied rhythm) */}
      {findings.length > 0 ? (
        <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-16" style={{ borderTop: `1px solid ${ink}14` }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: ink, opacity: 0.25 }} />
            <span className="text-[0.75rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>{promise ? 'What RISE runs' : 'What we found'}</span>
          </div>
          <h2 className="font-extrabold tracking-[-0.02em] mb-12" style={{ fontFamily: headingFont, fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: ink, lineHeight: 1.03 }}>
            {promise ? 'Where RISE comes in' : 'Where the growth is'}
          </h2>

          <div className="space-y-16">
            {findings.map((f, i) => {
              const variant = findingVariant(i);
              // A lever with no label (the retired profit_visibility on older rows) renders no chip.
              const chip = LEVER_LABEL[f.lever] ? (
                <span
                  className="inline-flex items-center gap-2 text-[0.75rem] font-bold uppercase tracking-[0.16em] px-3 py-1.5 rounded-full"
                  style={{ border: `1px solid ${ink}33`, color: ink }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                  {LEVER_LABEL[f.lever]}
                </span>
              ) : null;
              // Bucket chip: the deal shape, on the finding it applies to. Locked copy, and
              // the same two-square glyph the week-one panel uses, so a chip and the panel
              // read as one instrument. Bucket null renders no chip at all.
              const bk = bucketOf(f);
              const bucketChip = bk ? (
                <span
                  data-bucket={bk}
                  className="inline-flex items-center gap-2 text-[0.75rem] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-full whitespace-nowrap"
                  style={
                    bk === 'rise'
                      ? { background: accent, color: ink }
                      : bk === 'asset'
                        ? { background: ink, color: surface }
                        : { border: `1px ${bk === 'yours' ? 'dashed' : 'solid'} ${ink}59`, color: ink, opacity: bk === 'yours' ? 0.75 : 1 }
                  }
                >
                  <BucketGlyph b={bk} accent={bk === 'rise' ? ink : accent} ink={bk === 'asset' ? surface : ink} size={7} />
                  {BUCKETS[bk].label}
                </span>
              ) : null;

              // week_one renders VERBATIM: no clean(), no reflow, never merged with a numeral.
              const weekOne = typeof f.week_one === 'string' && f.week_one.trim() ? f.week_one : null;
              const weekOneRow = weekOne ? (
                <div
                  className="cedt-w1"
                  data-weekone-row="1"
                  style={{
                    borderLeft: `3px ${bk === 'yours' ? 'dashed' : 'solid'} ${bk === 'yours' ? `${ink}40` : accent}`,
                    background: bk === 'rise' ? `${accent}1a` : `${ink}08`,
                  }}
                >
                  <div>
                    <span className="block text-[0.75rem] font-bold uppercase tracking-[0.22em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.7 }}>
                      Week one
                    </span>
                    {f.bucket_pillar && !/profit/i.test(String(f.bucket_pillar)) ? (
                      <span className="block mt-1.5 text-[0.75rem] font-bold uppercase tracking-[0.12em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.75 }}>
                        {clean(String(f.bucket_pillar))}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[1.02rem] leading-[1.55] font-medium" style={{ color: ink }}>{weekOne}</p>
                </div>
              ) : null;

              const sourceLink = f.source_url ? (
                <a href={proofHref(f.source_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-[44px] mt-2 text-[0.85rem] font-semibold underline underline-offset-4" style={{ color: ink, opacity: 0.7 }}>
                  {sourceLabel(f.source_url)}
                </a>
              ) : null;

              // Margin data tags: numeral tokens lifted verbatim out of THIS finding's prose,
              // never invented and never reformatted, plus the source they were read from.
              // A finding with no whitelisted numeral renders NO margin content at all: a
              // source label floating on an empty rail reads as a half-populated component
              // (template-tell pass, 07-31). The source link under the finding carries it.
              const figures = marginFigures(`${clean(f.title)} ${clean(f.evidence)}`);
              const marginSource = MARGIN_SOURCE[f.signal];
              const marginAside = (
                <aside className="cedt-margin lg:col-span-3">
                  {figures.length > 0 ? (
                    <>
                      <span className="block w-full h-px mb-2.5" style={{ background: ink, opacity: 0.85 }} />
                      {figures.map((t, fi) => (
                        <span
                          key={fi}
                          className="fig block font-bold tabular-nums text-[0.95rem] leading-[1.35]"
                          style={{ fontFamily: headingFont, color: ink, marginTop: fi > 0 ? 12 : 0 }}
                        >
                          {t}
                        </span>
                      ))}
                      {marginSource ? (
                        <span
                          className="src block text-[0.75rem] font-bold uppercase tracking-[0.16em] mt-2.5 pt-2"
                          style={{ fontFamily: headingFont, color: ink, opacity: 0.7, borderTop: '1px dashed #dfe3e7' }}
                        >
                          {marginSource}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </aside>
              );

              let content: React.ReactNode;
              if (variant === 'lead') {
                // Lead / worst-first: pull-quote spread, biggest scale.
                content = (
                  <div className="grid lg:grid-cols-12 gap-y-5 lg:gap-x-10">
                    <div className="lg:col-span-5">
                      {bucketChip ? <div className="flex flex-wrap items-center gap-2.5">{chip}{bucketChip}</div> : chip}
                      <h3 className="mt-5 font-extrabold tracking-[-0.02em]" style={{ fontFamily: headingFont, fontSize: 'clamp(1.75rem, 3.6vw, 2.9rem)', color: ink, lineHeight: 1.05 }}>
                        {clean(f.title)}
                      </h3>
                    </div>
                    <div className="lg:col-span-7">
                      <p className="text-[1.2rem] sm:text-[1.35rem] leading-[1.5] font-medium" style={{ color: ink, paddingLeft: '1.25rem', borderLeft: `3px solid ${accent}` }}>
                        {clean(f.evidence)}
                      </p>
                      {sourceLink}
                    </div>
                  </div>
                );
              } else if (variant === 'split') {
                content = (
                  <div className="grid lg:grid-cols-12 gap-y-4 lg:gap-x-10 items-start">
                    <div className="lg:col-span-5">
                      {bucketChip ? <div className="flex flex-wrap items-center gap-2.5">{chip}{bucketChip}</div> : chip}
                      <h3 className="mt-4 font-bold tracking-[-0.01em]" style={{ fontFamily: headingFont, fontSize: 'clamp(1.4rem, 2.6vw, 2rem)', color: ink, lineHeight: 1.1 }}>
                        {clean(f.title)}
                      </h3>
                    </div>
                    <div className="lg:col-span-7">
                      <p className="text-[1.0625rem] sm:text-[1.2rem] leading-[1.6]" style={{ color: ink, opacity: 0.85 }}>
                        {clean(f.evidence)}
                      </p>
                      {sourceLink}
                    </div>
                  </div>
                );
              } else {
                // offset: narrower measure, pushed right, card treatment.
                content = (
                  <div className="grid lg:grid-cols-12 gap-y-4">
                    <div className="lg:col-span-1" />
                    <div className="lg:col-span-11 lg:pl-4">
                      <div className="flex flex-wrap items-center gap-4 mb-3">
                        {chip}
                        {bucketChip}
                        <h3 className="font-bold tracking-[-0.01em]" style={{ fontFamily: headingFont, fontSize: 'clamp(1.35rem, 2.4vw, 1.85rem)', color: ink, lineHeight: 1.1 }}>
                          {clean(f.title)}
                        </h3>
                      </div>
                      <p className="max-w-2xl text-[1.0625rem] sm:text-[1.2rem] leading-[1.6]" style={{ color: ink, opacity: 0.85 }}>
                        {clean(f.evidence)}
                      </p>
                      {sourceLink}
                    </div>
                  </div>
                );
              }

              // Evidence plate: the dated storefront capture, attached under the ONE finding
              // it argues for. Renders only from a QA-passed capture on the row (fail-closed:
              // no capture, no plate, no placeholder).
              const plate = capture && i === captureAttachIndex ? (
                <figure data-evidence-plate="1" className="mt-8" style={{ margin: 0 }}>
                  <div style={{ border: `1px solid ${ink}1f`, borderRadius: 4, overflow: 'hidden', background: surface }}>
                    <img
                      src={capture.url}
                      alt={`${companyName} storefront`}
                      loading="lazy"
                      decoding="async"
                      style={{ display: 'block', width: '100%' }}
                    />
                  </div>
                  <figcaption
                    className="mt-2.5 text-[0.75rem] font-bold uppercase tracking-[0.16em]"
                    style={{ fontFamily: headingFont, color: ink, opacity: 0.7 }}
                  >
                    {captureDate ? `Your storefront, captured ${captureDate}` : 'Your storefront'}
                  </figcaption>
                </figure>
              ) : null;

              // Dated storefront plates: the page paid traffic actually lands on, cropped to
              // a viewport band and stamped with its capture date. No date, no plate.
              const storePlates = shotPlates
                .filter((p) => p.idx === i)
                .map((p) => (
                  <figure key={p.url} data-shot-plate="1" className="mt-8" style={{ margin: 0 }}>
                    <div style={{ border: `1px solid ${ink}1f`, borderRadius: 4, overflow: 'hidden', background: surface }}>
                      <img
                        className="cedt-plate"
                        src={p.url}
                        alt={`${companyName} ${p.label.toLowerCase()}`}
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <figcaption
                      className="mt-2.5 text-[0.75rem] font-bold uppercase tracking-[0.16em]"
                      style={{ fontFamily: headingFont, color: ink, opacity: 0.7 }}
                    >
                      {`${p.label}, captured ${shotDate}`}
                    </figcaption>
                  </figure>
                ));

              return (
                <article
                  key={i}
                  className="grid lg:grid-cols-12 gap-y-4 lg:gap-x-12 items-start"
                  style={variant === 'lead' ? undefined : { borderTop: `1px solid ${ink}14`, paddingTop: '2.5rem' }}
                >
                  <div className="lg:col-span-9">
                    {content}
                    {plate}
                    {storePlates}
                    {weekOneRow}
                  </div>
                  {marginAside}
                </article>
              );
            })}
          </div>

          {/* The chapter closes on the split of labor, drawn: the whole bucket read in one
              glance. Absent entirely when no finding on the row carries a bucket. */}
          {!promise && anyBucket ? (
            <WeekOnePanel findings={findings} accent={accent} ink={ink} surface={surface} headingFont={headingFont} />
          ) : null}
        </section>
      ) : null}

      {/* Honest thin-read note — only when there is genuinely little to show */}
      {thinRead ? (
        <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-16" style={{ borderTop: `1px solid ${ink}14` }}>
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-5">
              <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: ink, opacity: 0.25 }} />
              <span className="text-[0.75rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>The read</span>
            </div>
            <h2 className="font-extrabold tracking-[-0.02em]" style={{ fontFamily: headingFont, fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: ink, lineHeight: 1.05 }}>
              The public read gave us the basics
            </h2>
            <p className="mt-5 text-[1.2rem] leading-relaxed" style={{ color: ink, opacity: 0.8 }}>
              The public surfaces we read gave us the basics. The full teardown comes off a live
              look together.
            </p>
            <a
              href={ctaUrl('thinread')}
              data-cta="thinread"
              target="_blank"
              rel="noopener noreferrer"
              className="cedt-anim inline-flex mt-8 items-center rounded-full px-6 py-3 text-[0.95rem] font-bold transition-transform hover:-translate-y-0.5"
              style={{ background: accent, color: ink }}
            >
              Get the full teardown live
            </a>
            <p className="mt-3 text-[0.85rem]" style={{ color: ink, opacity: 0.7 }}>
              30 minutes with Mattan Danino, CEO of RISE DTC. We go through your store live.
            </p>
          </div>
        </section>
      ) : null}

      {/* Chapter: proof. Real RISE case studies, three picked for the store's category from the
          words its own read gives (riseCases.ts). Each number is verbatim from the brand's case page
          on risedtc.com and each card links there. Ivan 10-08: "way stronger case studies, real
          case studies with the links to them". */}
      <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-16" style={{ borderTop: `1px solid ${ink}14`, background: surface }}>
        <div className="flex items-center gap-3 mb-3">
          <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: ink, opacity: 0.25 }} />
          <span className="text-[0.75rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>Work RISE has run</span>
        </div>
        <h2 className="mb-8 text-[1.6rem] sm:text-[2rem] leading-tight" style={{ fontFamily: headingFont, fontWeight: 700, color: ink }}>
          Brands like yours, with RISE running growth
        </h2>
        {riseCases.slice(0, 1).map((c) => (
          <a key={c.slug} href={caseUrl(c)} data-case={c.slug} target="_blank" rel="noopener noreferrer" className="grid sm:grid-cols-2 gap-5 items-center rounded-xl overflow-hidden" style={{ border: `1px solid ${ink}1f`, color: ink }}>
            <img src={c.image} alt={c.name} loading="lazy" className="w-full aspect-[16/9] object-cover" />
            <div className="p-5 sm:pl-0">
              <h3 className="font-bold text-[1.15rem]" style={{ fontFamily: headingFont }}>{c.name}</h3>
              <p className="mt-1 text-[0.9rem] opacity-75">{c.sells}</p>
              <p className="mt-3 text-[1.3rem] font-bold" style={{ fontFamily: headingFont }}>{c.headline}</p>
              <ul className="mt-2 text-[0.95rem] space-y-1">{c.stats.map((stat) => <li key={stat}>{stat}</li>)}</ul>
              <span className="inline-flex items-center min-h-[44px] mt-2 font-semibold underline underline-offset-4">Read the case study ›</span>
            </div>
          </a>
        ))}
        <details data-additional-cases="1" className="mt-5">
          <summary className="cursor-pointer min-h-[44px] font-semibold">More RISE case studies</summary>
          <div className="grid sm:grid-cols-2 gap-5 mt-3">
            {riseCases.slice(1).map((c) => <a key={c.slug} href={caseUrl(c)} data-case={c.slug} target="_blank" rel="noopener noreferrer" className="p-4 rounded-lg" style={{ border: `1px solid ${ink}1f`, color: ink }}>
              <h3 className="font-bold" style={{ fontFamily: headingFont }}>{c.name}</h3>
              <p className="mt-2">{c.headline}</p>
              <p className="mt-2 text-[0.9rem] opacity-75">{c.sells}</p>
              <span className="inline-flex items-center min-h-[44px] font-semibold underline underline-offset-4">Read the case study ›</span>
            </a>)}
          </div>
        </details>
        <p className="mt-8 text-[0.85rem]" style={{ color: ink, opacity: 0.7 }}>
          Every number comes from the brand's case study on risedtc.com. Ask Mattan how any of them was done on the call.{' '}
          <a href="https://risedtc.com/clients/?utm_source=scan&utm_medium=case&utm_campaign=growth-scan&utm_content=all" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
            See all case studies
          </a>
        </p>
      </section>

      {/* Chapter: close band. Ink-on-white flips to white-on-ink, mirroring the tools-hub
          ctaband + signature-card pattern. Fee card keeps the qualifying-brands gate: RISE's
          own pricing page publishes TWO models, and the Performance Model is gated, never
          universal (see content_prompts rise-company-facts). */}
      <section data-pill-hide="1" style={{ background: ink, color: surface, position: 'relative', overflow: 'hidden' }}>
        <img
          src="https://resources.risedtc.com/tools/assets/rise-sun-wht.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{ position: 'absolute', bottom: '-60px', left: '50%', transform: 'translateX(-50%)', width: 420, opacity: 0.07, pointerEvents: 'none' }}
        />
        <div className="mx-auto w-full max-w-[820px] px-6 text-center" style={{ position: 'relative', padding: '42px 24px' }}>
          <div className="text-[0.75rem] font-semibold uppercase tracking-[0.28em]" style={{ color: 'rgba(255,255,255,.7)' }}>Ready when you are</div>
          <h2
            className="mt-4 font-extrabold tracking-[-0.02em]"
            style={{ fontFamily: headingFont, fontSize: 'clamp(1.9rem, 4.6vw, 3.2rem)', lineHeight: 1.05, color: surface }}
          >
            Want this read on <span style={{ color: accent }}>your live store?</span>
          </h2>
          <p className="mx-auto mt-5 text-[1.0625rem] leading-relaxed" style={{ color: 'rgba(255,255,255,.74)', maxWidth: '52ch' }}>
            On the call Mattan walks this exact page with you, next to your live store numbers.
          </p>

          <details className="my-5 text-left p-4" style={{ border: '1px solid rgba(255,255,255,.2)', borderRadius: 4 }}>
            <summary className="cursor-pointer font-semibold min-h-[44px] flex items-center">How RISE charges</summary>
            {/* Performance leads and carries the accent: it is the model this page is selling.
                The qualifying gate stays — RISE's own pricing publishes it as gated, never
                universal (content_prompts rise-company-facts). */}
            <div className="mt-5 p-5 sm:p-6" style={{ background: 'rgba(255,199,29,.09)', borderLeft: `3px solid ${accent}`, borderRadius: 2 }}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[1.05rem]" style={{ fontFamily: headingFont, fontWeight: 800, color: accent }}>Performance Model</span>
                <span className="text-[0.75rem] font-bold uppercase tracking-[0.18em]" style={{ fontFamily: headingFont, color: 'rgba(255,255,255,.7)' }}>for qualifying brands</span>
              </div>
              <p className="mt-2.5 text-[1rem] leading-relaxed" style={{ color: 'rgba(255,255,255,.92)' }}>
                Lower fixed monthly fee plus a share of net growth above an agreed baseline, after ad spend. Creative, tech and AI included.
              </p>
            </div>
            <p className="mt-4 text-[0.95rem] leading-relaxed" style={{ color: 'rgba(255,255,255,.7)' }}>
              <span style={{ fontFamily: headingFont, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>Growth Model.</span>{' '}
              Base fee plus a percentage of ad spend, senior strategist included.
            </p>
            <p className="mt-4 text-[0.875rem]" style={{ color: 'rgba(255,255,255,.7)' }}>
              Which model fits your brand gets settled on the call.
            </p>
          </details>

          <p className="text-[0.84rem]" style={{ color: 'rgba(255,255,255,.7)' }}>
            Direct with Mattan and the team. No pitch deck.
          </p>

          <div
            className="cedt-sig-row mx-auto mt-6 flex items-center gap-4 text-left"
            style={{ borderTop: '1px solid rgba(255,255,255,.16)', maxWidth: 620, paddingTop: 24 }}
          >
            <img
              className="cedt-sig-avatar"
              src={MATTAN_PHOTO}
              alt="Mattan Danino"
              width={900}
              height={639}
              loading="lazy"
              decoding="async"
              style={{ width: 96, height: 96, objectFit: 'cover', objectPosition: '48% 18%', borderRadius: 22, border: '1px solid rgba(255,255,255,.18)', flexShrink: 0 }}
            />
            <div>
              <div style={{ fontFamily: headingFont, fontWeight: 700, color: '#ffffff' }}>Mattan Danino</div>
              <div style={{ fontFamily: headingFont, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.18em', color: 'rgba(255,255,255,.7)' }}>CEO, RISE DTC</div>
            </div>
            <a
              href={ctaUrl('close')}
              data-cta="close"
              target="_blank"
              rel="noopener noreferrer"
              className="cedt-anim cedt-close-btn inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3 text-[0.95rem] whitespace-nowrap transition-transform hover:-translate-y-0.5"
              style={{ marginLeft: 'auto', background: accent, color: ink, fontFamily: headingFont, fontWeight: 700, boxShadow: '0 6px 0 rgba(255,255,255,.24)' }}
            >
              Walk my scan with Mattan
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center rounded-full"
                style={{ width: 22, height: 22, background: ink, color: accent, fontSize: 14, lineHeight: 1, flexShrink: 0 }}
              >
                ›
              </span>
            </a>
          </div>

          <p className="mx-auto mt-6 text-[0.9rem] leading-relaxed text-left" style={{ color: 'rgba(255,255,255,.7)', maxWidth: '60ch' }}>
            RISE DTC is run by Mattan Danino and Matt Moore. For qualifying brands, platform work starts within 48 hours of onboarding.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-12" style={{ borderTop: `1px solid ${ink}14` }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <a href="https://risedtc.com" target="_blank" rel="noopener noreferrer">
            {logoUrl ? (
              <img src={logoUrl} alt={wordmark} className="h-5 w-auto opacity-70" />
            ) : (
              <span className="font-bold" style={{ fontFamily: headingFont, color: ink, opacity: 0.7 }}>{wordmark}</span>
            )}
          </a>
          <p className="text-[0.85rem]" style={{ color: ink, opacity: 0.7 }}>
            Prepared for {companyName}. Unlisted link, shared with you only.
          </p>
        </div>
      </footer>

      {/* Sticky booking bar: docked, opaque, never over text (see the effect above). */}
      <div
        className="cedt-sticky fixed inset-x-0 bottom-0 z-40"
        data-sticky-bar="1"
        style={{
          background: surface,
          borderTop: `1px solid ${ink}1f`,
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: pillHidden ? 'translateY(110%)' : 'none',
          pointerEvents: pillHidden ? 'none' : undefined,
        }}
      >
        <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-8 flex items-center justify-between gap-3" style={{ height: STICKY_BAR_H }}>
          <span className="text-[0.85rem] leading-tight" style={{ color: ink, opacity: 0.8 }}>
            <span className="font-bold">Mattan Danino</span>, CEO, RISE DTC
          </span>
          <a
            href={ctaUrl('sticky')}
            data-cta="sticky"
            target="_blank"
            rel="noopener noreferrer"
            className="cedt-anim inline-flex items-center justify-center min-h-[44px] rounded-full px-5 text-[0.9rem] font-bold whitespace-nowrap transition-transform hover:-translate-y-0.5"
            style={{ background: accent, color: ink }}
          >
            30 min with Mattan
          </a>
        </div>
      </div>
    </div>
  );
}
