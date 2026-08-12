// components/DtcGrowthReport.tsx
// Rendered IN PLACE OF the generic report when matched_offer === 'dtc_growth'.
//
// Rise-DTC-branded teardown of a Shopify brand's PUBLIC data, staged as a premium editorial
// long-read: dramatic Sora display heads, an asymmetric magazine grid, generous whitespace,
// pull-quote findings, and the Profit Gap as the climactic spread. Wears Rise's own brand
// (gold #ffc71d as rule lines / chip dots / CTA only, Sora/Manrope, Rise logo, Rise booking
// link) — NEVER Ivan/InboundOnSteroids chrome.
//
// Correctness spine (unchanged from the floor): every data section gates on
// `SignalMeta.status === 'present'` (or `'empty'` for a genuine negative), never on
// payload-presence. A `blocked`/`error`/`absent` signal collapses silently and emits NO
// number — a WAF-blocked source must never read as "they have zero". Empty is an honest
// negative, not a fabricated zero. Every rendered numeral comes verbatim from the data; the
// only editable/derived numerals live in the Profit Gap calculator and carry data-calc tags.
//
// Receipt elevation (2026-07-31): three drawn instruments sit on top of that spine.
//   1. The sourced vitals receipt after the hero: one line per public fact, and a line only
//      renders when the fact is BOUND — i.e. a rendered finding below cites it, or it seeds
//      the Profit Gap. Fewer than three bound lines and the whole band collapses, so a
//      blocked-heavy scan never ships an empty shell.
//   2. Margin data tags beside each finding: numeral tokens lifted VERBATIM out of that
//      finding's own grounded prose by a pattern whitelist. Nothing is invented or reformatted.
//   3. The contribution waterfall inside the Profit Gap: the component's own arithmetic
//      decomposition of the live slider state (segments sum to AOV exactly), so it is all
//      calculator-derived and every numeral node carries data-calc="1".
// Store facts (tech_stack app names, growth_score, pagespeed, peer comparisons) are
// deliberately NOT rendered as standalone display anywhere.
import React, { useEffect, useState } from 'react';
import { useMetadata } from '../hooks/useMetadata';
import { useGoogleFonts } from '../hooks/useGoogleFonts';
import type { ReportJson, Scan } from '../lib/scanTypes';

const LEVER_LABEL: Record<string, string> = {
  paid_media: 'Paid media',
  performance_creative: 'Performance creative',
  profit_visibility: 'Profit visibility',
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
// verbatim while punctuation is normalized to a clean comma break.
function clean(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();
}

// Number-free source-link label derived from the finding's source URL, so the link says
// where the reader will land instead of a generic "read from your store".
function sourceLabel(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.includes('facebook.com')) return 'see this in the Meta Ad Library';
    if (u.pathname.includes('/products/')) return 'see this on your product page';
  } catch {}
  return 'see this on your storefront';
}

// Mattan photo, used in the hero byline card and the close-band signature row. Remote asset
// only. Rendered as a rounded rectangle, NEVER a circle.
const MATTAN_PHOTO = 'https://resources.risedtc.com/tools/assets/mattan.jpg';

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

function fmtMoneyBase(n: number, sym = '$'): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}${sym}${Math.abs(n).toFixed(2)}`;
}

// Receipt price formatting: whole prices stay whole, fractional prices get two decimals,
// thousands get separators, so the receipt states a value the way the findings prose does
// ("$1,285", never "$1285").
function fmtPrice(v: number, sym = '$'): string {
  return sym + v.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(v) ? 0 : 2 });
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
const MARGIN_SOURCE: Record<string, string> = {
  shopify: 'shopify products.json',
  reviews: 'product page',
  signup: 'storefront',
  'ads.meta': 'meta ad library',
  tech_stack: 'homepage source',
  profit_gap: 'public catalog',
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

// The climactic spread. Formula lifted verbatim from the floor / True Profit X-Ray. Seeded
// from the prospect's public median price (never asserted as their real margin). EVERY node
// holding a calculator input/output numeral carries data-calc="1" — those are user-editable
// by design and derive from user inputs, so they are exempt from the fabrication instrument.
function ProfitGapSpread({
  seedAov,
  sourceNote,
  accent,
  ink,
  surface,
  headingFont,
  ctaHref,
  adsEmpty,
  metaSweepZero,
  currency,
}: {
  seedAov: number | null;
  sourceNote: string;
  accent: string;
  ink: string;
  surface: string;
  headingFont: string;
  ctaHref: string;
  adsEmpty: boolean;
  // audit v3: true only when a brand-wide meta_sweep proved the zero. Gates the wording so a
  // pre-v3 row (no sweep) keeps the exact original sentence, byte-identical to the floor.
  metaSweepZero?: boolean;
  currency?: string | null;
}) {
  // Local shadow so every fmtMoney call in this component prints the store's own currency
  // without threading a symbol through thirteen call sites.
  const _sym = curSymbol(currency);
  const fmtMoney = (n: number) => fmtMoneyBase(n, _sym);
  const [aov, setAov] = useState(seedAov ?? 68);
  // seed_aov is number|null and the 68 above is a placeholder, so every "seeded from your
  // catalog" sentence gates on this: prose must never claim a public seed that was not read.
  const seeded = seedAov != null;
  const [cogsPct, setCogsPct] = useState(35);
  const [returnsPct, setReturnsPct] = useState(8);
  const [shipping, setShipping] = useState(6);
  const [procPct, setProcPct] = useState(2.9);
  const [cac, setCac] = useState(0);

  const returnsRate = returnsPct / 100;
  const cogsRate = cogsPct / 100;
  const procFrac = procPct / 100;
  const contribution = (1 - returnsRate) * aov * (1 - cogsRate) - shipping - (procFrac * aov + 0.3);
  const profitPerOrder = contribution - cac;
  // 2026-08-05: break-even ROAS is the number DTC founders actually speak in ("1.4 ROAS means
  // losing £5 per sale, I needed 1.9 just to break even" — rise-buyer-pain-taxonomy v2). The
  // page already had every input it needs, it just never printed the threshold.
  // Break-even is CAC = contribution, and ROAS = revenue / ad spend = AOV / CAC, so the
  // threshold is AOV / contribution. Null when contribution <= 0: an order that loses money
  // before a cent of ad spend has no ad efficiency that rescues it.
  const breakEvenRoas = contribution > 0 ? aov / contribution : null;

  const sliders: Array<{ key: string; label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; fmt: (v: number) => string }> = [
    { key: 'aov', label: 'AOV', value: aov, set: setAov, min: 10, max: 300, step: 1, fmt: (v) => fmtMoney(v) },
    { key: 'cogs', label: 'COGS', value: cogsPct, set: setCogsPct, min: 5, max: 80, step: 1, fmt: (v) => `${v}%` },
    { key: 'returns', label: 'Returns', value: returnsPct, set: setReturnsPct, min: 0, max: 40, step: 1, fmt: (v) => `${v}%` },
    { key: 'shipping', label: 'Shipping', value: shipping, set: setShipping, min: 0, max: 30, step: 0.5, fmt: (v) => fmtMoney(v) },
    { key: 'proc', label: 'Processing', value: procPct, set: setProcPct, min: 1, max: 6, step: 0.1, fmt: (v) => `${v.toFixed(1)}%` },
    { key: 'cac', label: 'CAC', value: cac, set: setCac, min: 0, max: 150, step: 1, fmt: (v) => fmtMoney(v) },
  ];

  const profitNegative = profitPerOrder < 0;

  // ── Drawn contribution waterfall ────────────────────────────────────────────────────
  // The component's own arithmetic decomposition of the LIVE slider state. The six segments
  // sum to AOV exactly, so a segment's width is the same fact as its ledger row. All of it is
  // calculator-derived, so every node holding one of these numerals carries data-calc="1".
  const safeAov = aov > 0 ? aov : 1;
  const returnsSeg = returnsRate * aov;
  const cogsSeg = (1 - returnsRate) * aov * cogsRate;
  const shippingSeg = shipping;
  const processingSeg = procFrac * aov + 0.3;
  const profitSeg = profitPerOrder;
  const pctOf = (v: number) => Math.max(0, (v / safeAov) * 100);
  const HATCH_CSS = 'repeating-linear-gradient(45deg,rgba(255,255,255,.55) 0 1.4px,rgba(255,255,255,.10) 1.4px 4.2px)';
  // One sub-line for every state: the intro prose already explains WHY CAC starts at $0
  // (ads-empty read), so this row never restates it (slop pass, 07-31).
  const cacSub = 'set this to what a new customer costs you';

  type WfSeg = { key: string; short: string; name: string; v: number; fill: string };
  const barSegs: WfSeg[] = [
    { key: 'returns', short: 'Returns', name: 'Returns allowance', v: returnsSeg, fill: 'rgba(255,255,255,.20)' },
    { key: 'cogs', short: 'COGS', name: 'Cost of goods', v: cogsSeg, fill: 'url(#cedt-wf-hatch)' },
    { key: 'shipping', short: 'Shipping', name: 'Shipping', v: shippingSeg, fill: 'rgba(255,255,255,.30)' },
    { key: 'processing', short: 'Processing', name: 'Payment processing', v: processingSeg, fill: 'rgba(255,255,255,.46)' },
  ];
  if (cac > 0) barSegs.push({ key: 'cac', short: 'CAC', name: 'CAC', v: cac, fill: 'rgba(255,255,255,.62)' });
  if (profitSeg > 0) barSegs.push({ key: 'profit', short: 'Contribution', name: 'Contribution per order', v: profitSeg, fill: accent });

  // Mobile strip fills mirror the SVG fills; the hatch becomes a CSS gradient.
  const mobileFill = (key: string) => {
    if (key === 'cogs') return HATCH_CSS;
    const s = barSegs.find((b) => b.key === key);
    return s ? s.fill : 'transparent';
  };

  const r2 = (n: number) => Math.round(n * 100) / 100;
  let wfCum = 0;
  const drawn = barSegs.map((s) => {
    const w = r2(Math.max(0, (s.v / safeAov) * 960));
    const x = r2(20 + Math.max(0, (wfCum / safeAov) * 960));
    wfCum += Math.max(0, s.v);
    return { seg: s, x, w, center: r2(x + w / 2), p: pctOf(s.v) };
  });
  // A segment under 4% of the bar gets no in-drawing label; the ledger below carries it. The
  // profit segment is never labelled up here either: the gold answer line below IS its label.
  const labeled = drawn.filter((dd) => dd.p >= 4 && dd.seg.key !== 'profit');
  const profitDrawn = drawn.find((dd) => dd.seg.key === 'profit');
  const wfAria =
    `Contribution waterfall: one order of ${fmtMoney(aov)} splits into ` +
    barSegs.map((s) => `${s.name} ${fmtMoney(s.v)}`).join(', ') + '.';

  const ledgerRows: Array<{ key: string; name: string; sub: string; v: number; swatch: string; dashed?: boolean; gold?: boolean }> = [
    { key: 'returns', name: 'Returns allowance', sub: `${returnsPct}% of orders come back`, v: returnsSeg, swatch: 'rgba(255,255,255,.20)' },
    { key: 'cogs', name: 'Cost of goods', sub: `${cogsPct}% after returns`, v: cogsSeg, swatch: HATCH_CSS },
    { key: 'shipping', name: 'Shipping', sub: 'flat per order', v: shippingSeg, swatch: 'rgba(255,255,255,.30)' },
    { key: 'proc', name: 'Payment processing', sub: `${procPct.toFixed(1)}% plus ${_sym}0.30`, v: processingSeg, swatch: 'rgba(255,255,255,.46)' },
    { key: 'contribution', name: 'Contribution per order', sub: 'before any ad spend', v: contribution, swatch: accent, gold: true },
    { key: 'cac', name: 'CAC', sub: cacSub, v: cac, swatch: 'transparent', dashed: true },
  ];

  return (
    <section aria-label="The Profit Gap" data-densepanel="1" style={{ background: ink, color: surface }}>
      <div className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-20 sm:py-28">
        <div className="flex items-center gap-3 mb-8">
          <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: 'rgba(255,255,255,.35)' }} />
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: surface, opacity: 0.65 }}>Profit per order</span>
        </div>

        <div className="grid lg:grid-cols-12 gap-y-12 lg:gap-x-12 items-end">
          {/* Left: the story + the hero numeral */}
          <div className="lg:col-span-7">
            <h2
              className="font-extrabold leading-[0.95] tracking-[-0.02em]"
              style={{ fontFamily: headingFont, fontSize: 'clamp(2.75rem, 8vw, 5.5rem)', color: surface }}
            >
              The Profit Gap
            </h2>
            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed" style={{ color: surface, opacity: 0.8 }}>
              {adsEmpty
                ? metaSweepZero
                  ? `This is the first number RISE looks at. The public Meta Ad Library shows zero ads on record for your brand, so the seed carries ${_sym}0 of paid CAC. Slide CAC to the right and watch how much acquisition cost each order can absorb before contribution profit goes negative. That is the number a paid program on your brand has to clear.`
                  : `This is the first number RISE looks at. The public Meta Ad Library shows no active ads on your brand right now, so the seed carries ${_sym}0 of paid CAC. Slide CAC to the right and watch how much acquisition cost each order can absorb before contribution profit goes negative. That is the number a paid program on your brand has to clear.`
                : seeded
                  ? `This is the first number RISE looks at on any brand. AOV is seeded from your public catalog. CAC starts at ${_sym}0: drag it to what you pay per new customer today, or find the number a paid program would need to beat to stay profit-positive on every order.`
                  : `This is the first number RISE looks at on any brand. AOV starts at a placeholder, so type your real number in. CAC starts at ${_sym}0: drag it to what you pay per new customer today, or find the number a paid program would need to beat to stay profit-positive on every order.`}
            </p>

            <div className="mt-10" data-calc="1">
              <div className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]" style={{ color: surface, opacity: 0.65 }} data-calc="1">
                Profit per order, after CAC
              </div>
              <div
                className="mt-1 font-extrabold tabular-nums leading-none tracking-[-0.03em]"
                style={{ fontFamily: headingFont, fontSize: 'clamp(3.5rem, 13vw, 8rem)', color: profitNegative ? accent : surface }}
                data-calc="1"
              >
                {fmtMoney(profitPerOrder)}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2.5" data-calc="1">
                <div className="inline-flex items-center gap-2.5 rounded-full px-4 py-2" style={{ border: `1px solid ${surface}33` }} data-calc="1">
                  <span className="text-[0.8rem] uppercase tracking-[0.16em]" style={{ color: surface, opacity: 0.7 }} data-calc="1">Contribution per order</span>
                  <span className="text-[1.0625rem] font-bold tabular-nums" style={{ color: surface }} data-calc="1">{fmtMoney(contribution)}</span>
                </div>
                <div className="inline-flex items-center gap-2.5 rounded-full px-4 py-2" style={{ border: `1px solid ${surface}33` }} data-calc="1">
                  <span className="text-[0.8rem] uppercase tracking-[0.16em]" style={{ color: surface, opacity: 0.7 }} data-calc="1">Break-even ROAS</span>
                  <span className="text-[1.0625rem] font-bold tabular-nums" style={{ color: breakEvenRoas === null ? accent : surface }} data-calc="1">
                    {breakEvenRoas === null ? 'unreachable' : `${breakEvenRoas.toFixed(2)}x`}
                  </span>
                </div>
              </div>
              {/* The threshold is only as good as the cost mix behind it, and five of the six
                  inputs seed from defaults rather than their data. Framing it as a comparison
                  keeps the page from asserting a break-even we cannot know. */}
              <p className="mt-3 text-[0.9rem] leading-relaxed" style={{ color: surface, opacity: 0.6 }} data-calc="1">
                Set your real COGS, then compare it to the ROAS on your dashboard this week.
              </p>
            </div>
          </div>

          {/* Right: the editable inputs */}
          <div className="lg:col-span-5" data-calc="1">
            <div className="mb-3 font-bold text-[0.9rem]" style={{ color: surface, opacity: 0.9 }}>
              {seeded ? 'Seeded from public data. Every input is editable.' : 'Every input is editable.'}
            </div>
            <div className="rounded-2xl p-6 sm:p-7" style={{ background: `${surface}0d`, border: `1px solid ${surface}1f` }} data-calc="1">
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5" data-calc="1">
                {sliders.map((s) => (
                  <label key={s.key} className="block" data-calc="1">
                    <div className="flex items-center justify-between mb-2" data-calc="1">
                      <span className="text-[0.8rem] uppercase tracking-[0.14em]" style={{ color: surface, opacity: 0.65 }} data-calc="1">{s.label}</span>
                      <span className="text-[1rem] font-bold tabular-nums" style={{ color: surface }} data-calc="1">{s.fmt(s.value)}</span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={s.value}
                      onChange={(e) => s.set(Number(e.target.value))}
                      className="w-full"
                      style={{ accentColor: accent }}
                      data-calc="1"
                      aria-label={s.label}
                    />
                  </label>
                ))}
              </div>
            </div>
            <p className="mt-4 text-[0.85rem] leading-relaxed" style={{ color: surface, opacity: 0.65 }}>
              {clean(sourceNote)}
            </p>
          </div>
        </div>

        {/* The drawn waterfall: one order, split. Widths are the ledger, drawn. */}
        <div className="mt-16">
          <svg
            className="cedt-wfsvg"
            viewBox="0 0 1000 210"
            role="img"
            aria-label={wfAria}
            data-calc="1"
          >
            <defs>
              <pattern id="cedt-wf-hatch" width="4.6" height="4.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="4.6" stroke="#ffffff" strokeWidth="1.15" opacity=".55" />
              </pattern>
              <clipPath id="cedt-wf-clip">
                <rect x="20" y="104" width="960" height="52" rx="5" />
              </clipPath>
            </defs>

            {/* Total bracket. Two separate anchored text nodes, never one run-on label. */}
            <text className="lbm" x="20" y="14" data-calc="1">{`AOV ${fmtMoney(aov)}`}</text>
            <text className="lbm" x="980" y="14" textAnchor="end" data-calc="1">100% of the order</text>
            <line className="ld" x1="20" y1="26" x2="980" y2="26" />
            <line className="ld" x1="20" y1="20" x2="20" y2="32" />
            <line className="ld" x1="980" y1="20" x2="980" y2="32" />

            {/* Dollar labels lead, staggered on two rows, leaders down to the segment center. */}
            {labeled.map((dd, i) => {
              const y = i % 2 === 0 ? 58 : 88;
              const startAnchored = i === 0 && dd.center < 90;
              const tx = startAnchored ? 20 : Math.min(980, Math.max(20, dd.center));
              return (
                <g key={dd.seg.key}>
                  <text
                    className="lb"
                    x={tx}
                    y={y}
                    textAnchor={startAnchored ? undefined : 'middle'}
                    data-calc="1"
                  >
                    {`${dd.seg.short} ${fmtMoney(dd.seg.v)}`}
                  </text>
                  <line className="ld" x1={dd.center} y1={y + 6} x2={dd.center} y2={104} />
                </g>
              );
            })}

            <g clipPath="url(#cedt-wf-clip)">
              {drawn.map((dd, si) => (
                <g key={dd.seg.key}>
                  {dd.seg.key === 'cogs' ? (
                    <rect x={dd.x} y={104} width={dd.w} height={52} fill="rgba(255,255,255,.10)" />
                  ) : null}
                  <rect x={dd.x} y={104} width={dd.w} height={52} fill={dd.seg.fill} />
                  {si > 0 ? (
                    <line x1={dd.x} y1={104} x2={dd.x} y2={156} stroke={ink} strokeWidth="1.2" opacity=".35" />
                  ) : null}
                </g>
              ))}
            </g>
            <rect x="20" y="104" width="960" height="52" rx="5" fill="none" stroke="rgba(255,255,255,.34)" strokeWidth="1" />

            {/* The gold answer: what one order carries. */}
            {profitDrawn ? (
              <g>
                <line x1={profitDrawn.x} y1={168} x2={980} y2={168} stroke={accent} strokeWidth="2" />
                <text className="lb g" x={profitDrawn.x} y={192} data-calc="1">
                  {cac > 0
                    ? `Profit per order ${fmtMoney(profitPerOrder)}`
                    : `Contribution per order ${fmtMoney(contribution)}`}
                </text>
              </g>
            ) : null}
          </svg>

          {/* Under 760px the in-drawing labels stop being legible: same widths, labels move
              to the ledger. Marker row is two separate nodes for the same run-on reason. */}
          <div className="cedt-wfmk" data-calc="1">
            <span data-calc="1">{`AOV ${fmtMoney(aov)}`}</span>
            <span data-calc="1">100% of the order</span>
          </div>
          <div className="cedt-wfbar-m" data-calc="1" aria-hidden="true">
            {drawn.map((dd) => (
              <span
                key={dd.seg.key}
                data-wfseg={dd.seg.key}
                style={{ width: `${dd.p.toFixed(2)}%`, background: mobileFill(dd.seg.key) }}
              />
            ))}
          </div>

          {/* Legend states the drawing's invariant and nothing else: the seed story and the
              call push already live in the intro prose and the CTA (slop pass, 07-31). */}
          <p className="mt-4 text-[0.84rem] leading-relaxed" style={{ color: surface, opacity: 0.5, maxWidth: '66ch' }}>
            Segment widths are proportional to the ledger below.
          </p>

          {/* The ledger: swatch, name, dollar, percent of the order. */}
          <div className="mt-8" style={{ borderTop: '2px solid rgba(255,255,255,.85)' }} data-calc="1">
            {ledgerRows.map((r) => (
              <div
                key={r.key}
                className="cedt-lgd"
                data-calc="1"
                style={{ borderBottom: '1px solid rgba(255,255,255,.12)' }}
              >
                <span
                  className="sw"
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 3,
                    background: r.swatch,
                    border: r.dashed ? '1px dashed rgba(255,255,255,.4)' : undefined,
                  }}
                />
                <span className="text-[0.94rem]" style={{ color: 'rgba(255,255,255,.86)' }}>
                  {r.name}
                  <span className="block mt-0.5 text-[0.84rem]" style={{ color: 'rgba(255,255,255,.45)' }} data-calc="1">{r.sub}</span>
                </span>
                <span
                  className="font-bold tabular-nums text-right"
                  style={{ fontFamily: headingFont, color: r.gold ? accent : surface }}
                  data-calc="1"
                >
                  {fmtMoney(r.v)}
                </span>
                <span className="pc font-semibold tabular-nums text-right text-[0.86rem]" style={{ fontFamily: headingFont, color: 'rgba(255,255,255,.5)' }} data-calc="1">
                  {`${pctOf(r.v).toFixed(1)}%`}
                </span>
              </div>
            ))}
            <div className="cedt-lgd mt-1 pt-3" data-calc="1" style={{ borderTop: '1px solid rgba(255,255,255,.4)' }}>
              <span className="sw" style={{ width: 13, height: 13, borderRadius: 3, background: 'transparent' }} />
              <span className="text-[0.94rem] font-bold" style={{ color: surface }}>Profit per order, after CAC</span>
              <span className="font-bold tabular-nums text-right text-[1.15rem]" style={{ fontFamily: headingFont, color: accent }} data-calc="1">
                {fmtMoney(profitPerOrder)}
              </span>
              <span className="pc" />
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col sm:flex-row sm:items-center gap-4">
          <a
            href={ctaHref}
            data-cta="profitgap"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-[0.95rem] font-bold transition-transform hover:-translate-y-0.5"
            style={{ background: accent, color: ink }}
          >
            See it on your real numbers
          </a>
          <span className="text-[0.95rem]" style={{ color: surface, opacity: 0.6 }}>
            30 minutes with Mattan, on your live ad account and P&amp;L. This page stays yours either way.
          </span>
        </div>
      </div>
    </section>
  );
}

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
function longDay(s?: string | null): string | null {
  const ms = dayMs(s);
  if (ms == null) return null;
  return new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
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
// A sibling of the Profit Gap band: same ink-on-surface flip, same drawn-first discipline.
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
}: {
  google: any;
  metaPage: any;
  metaSweep: any;
  competitors: any;
  accent: string;
  ink: string;
  surface: string;
  headingFont: string;
}) {
  const g = google?.status === 'present' && google.data ? google.data : null;
  // Meta zero is provable two ways: the brand page read, and the brand-wide keyword sweep.
  // Either one alone is honest; the statement below names whichever was actually read.
  const sweep = metaSweep?.status === 'empty' && metaSweep.data ? metaSweep.data : null;
  const pageZero = metaPage?.status === 'empty';
  const metaReadDate = longDay(sweep?.checked_at || metaPage?.fetched_at);
  const showMeta = (pageZero || sweep) && metaReadDate;
  const comp = competitors?.status === 'present' && competitors.data ? competitors.data : null;
  const compCreatives: any[] = Array.isArray(comp?.creatives) ? comp.creatives.filter((c: any) => c && c.advertiser) : [];

  if (!g && !showMeta && !compCreatives.length) return null;

  const gRead = isoDay(g?.checked_at) || isoDay(google?.fetched_at);
  const gReadLong = longDay(g?.checked_at || google?.fetched_at);
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
  const compShown = compCreatives.slice(0, 3);
  const compAges = compShown.map((c) => (typeof c.age_days === 'number' ? c.age_days : null)).filter((n): n is number => n != null);
  const maxAge = compAges.length ? Math.max(...compAges, newestAge ?? 0) : newestAge ?? 0;
  const axisMax = Math.max(7, Math.ceil((maxAge + 4) / 5) * 5);
  const agePos = (d: number) => Math.max(0, Math.min(100, (1 - d / axisMax) * 100));
  const fresherThanBrand = newestAge != null ? compAges.filter((a) => a < newestAge).length : null;
  const compReadLong = longDay(comp?.checked_at || competitors?.fetched_at);
  const gCount = g && typeof g.ads_found === 'number' ? countParts(g.ads_found, g.capped) : null;

  const eyebrow = (t: string) => (
    <div className="flex items-center gap-3 mb-6">
      <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: 'rgba(255,255,255,.35)' }} />
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: surface, opacity: 0.65 }}>{t}</span>
    </div>
  );

  const Stat = ({ pre, n, unit, label }: { pre?: string | null; n: string; unit?: string; label: string }) => (
    <div>
      {pre ? (
        <div className="text-[0.66rem] font-bold uppercase tracking-[0.22em]" style={{ color: surface, opacity: 0.55 }}>{pre}</div>
      ) : null}
      <div className="flex items-baseline gap-2">
        <span
          className="font-extrabold tabular-nums leading-none tracking-[-0.03em]"
          style={{ fontFamily: headingFont, fontSize: 'clamp(2.9rem, 6vw, 4.5rem)', color: surface }}
        >
          {n}
        </span>
        {unit ? (
          <span className="text-[0.9rem] font-bold uppercase tracking-[0.16em]" style={{ fontFamily: headingFont, color: surface, opacity: 0.6 }}>{unit}</span>
        ) : null}
      </div>
      <div className="mt-2 text-[0.86rem] leading-snug" style={{ color: surface, opacity: 0.62, maxWidth: '22ch' }}>{label}</div>
    </div>
  );

  return (
    <section aria-label="Public ad records" data-densepanel="1" data-adspread="1" style={{ background: ink, color: surface }}>
      <div className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-20 sm:py-24">
        {eyebrow('Public ad records')}
        <div className="grid lg:grid-cols-12 gap-y-6 lg:gap-x-12 items-end">
          <div className="lg:col-span-8">
            <h2
              className="font-extrabold leading-[0.98] tracking-[-0.02em]"
              style={{ fontFamily: headingFont, fontSize: 'clamp(2.4rem, 6.4vw, 4.6rem)', color: surface }}
            >
              {g && gCount ? (
                <>
                  {gCount.pre ? `${gCount.pre} ` : ''}
                  {gCount.n} on Google.{' '}
                </>
              ) : null}
              {/* The headline absolute is page-confirmed-only (same rule as the statement below). */}
              {pageZero ? <span style={{ color: accent }}>Zero on Meta.</span> : null}
            </h2>
          </div>
          <div className="lg:col-span-4">
            <p className="text-[0.98rem] leading-relaxed" style={{ color: surface, opacity: 0.7 }}>
              {gReadLong && metaReadDate
                ? `Two public ad archives, read on ${gReadLong}. Every date below is theirs, not ours.`
                : `A public ad archive, read on ${gReadLong || metaReadDate}. Every date below is theirs, not ours.`}
            </p>
          </div>
        </div>

        {/* ── Instrument 1: the dated Google strip ───────────────────────────────── */}
        {g ? (
          <div className="mt-16 pt-10" style={{ borderTop: '1px solid rgba(255,255,255,.16)' }}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-9">
              <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em]" style={{ fontFamily: headingFont, color: accent }}>
                Google Ads Transparency
              </span>
              {g.advertiser ? (
                <span className="text-[0.86rem]" style={{ color: surface, opacity: 0.62 }}>
                  {clean(String(g.advertiser))}{g.region ? `, region ${g.region}` : ''}
                </span>
              ) : null}
            </div>

            <div className="grid sm:grid-cols-3 gap-y-9 sm:gap-x-8">
              {gCount ? <Stat pre={gCount.pre} n={gCount.n} label="creatives on record for this advertiser" /> : null}
              {newestAge != null && g.newest_first_shown ? (
                <Stat n={String(newestAge)} unit="days" label={`since the newest first-shown date, ${isoDay(g.newest_first_shown)}`} />
              ) : null}
              {lastAge != null && g.latest_last_shown ? (
                <Stat n={String(lastAge)} unit="days" label={`since the most recent last-shown date, ${isoDay(g.latest_last_shown)}`} />
              ) : null}
            </div>

            {/* The read, STATED (Ivan, 08-07: "what's the point of telling them what they
                already know") — an archive dump is vanilla; the page's job is the claim the
                dates add up to. Deterministic, from the two ages already on screen, and only
                rendered when they actually carry an argument (a brand with fresh creative
                gets no manufactured drama). */}
            {newestAge != null && lastAge != null && newestAge >= 60 && lastAge <= 14 ? (
              <p className="mt-9 text-[1.2rem] sm:text-[1.35rem] leading-[1.45] font-medium" style={{ color: surface, paddingLeft: '1.25rem', borderLeft: `3px solid ${accent}`, maxWidth: '58ch' }}>
                {`The record shows ads served as recently as ${lastAge === 0 ? 'today' : `${lastAge} days ago`} and nothing new entering it for ${newestAge} days. The spend is riding on creative from ${isoDay(g.newest_first_shown)} or older.`}
              </p>
            ) : null}

            {/* Format split, drawn against its own sum. */}
            {fmts.length > 0 && fmtTotal > 0 ? (
              <div className="mt-12">
                <div className="text-[0.62rem] font-bold uppercase tracking-[0.24em] mb-3" style={{ fontFamily: headingFont, color: surface, opacity: 0.5 }}>
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
                      <span className="text-[0.8rem] uppercase tracking-[0.14em]" style={{ color: surface, opacity: 0.6 }}>{f.label}</span>
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
                      <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em]" style={{ fontFamily: headingFont, color: surface, opacity: 0.75 }}>
                        {String(c.format || 'ad')}
                      </span>
                      {first ? (
                        <span className="text-[0.72rem] font-bold tabular-nums mt-1" style={{ fontFamily: headingFont, color: surface, opacity: 0.85 }}>{first}</span>
                      ) : null}
                    </span>
                  );
                  return (
                    <figure key={i} style={{ margin: 0 }}>
                      <EvidenceImg src={src} alt={`${String(c.format || 'ad')} creative first shown ${first || ''}`} ratio="4 / 3" fallback={fallback} />
                      <figcaption className="mt-2 text-[0.6rem] font-bold uppercase tracking-[0.14em] tabular-nums" style={{ fontFamily: headingFont, color: surface, opacity: 0.55 }}>
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

        {/* ── Instrument 2: the brand-wide Meta zero ─────────────────────────────── */}
        {showMeta ? (
          <div className="mt-16 pt-10" style={{ borderTop: '1px solid rgba(255,255,255,.16)' }}>
            <div className="grid lg:grid-cols-12 gap-y-8 lg:gap-x-12 items-start">
              <div className="lg:col-span-4">
                <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em]" style={{ fontFamily: headingFont, color: accent }}>
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
                    ? `Meta's Ad Library shows zero ads for this brand as of ${metaReadDate}.`
                    : `A Meta Ad Library sweep on ${metaReadDate} traced none of the sampled ads to this brand.`}
                </p>
                <div className="mt-8" style={{ borderTop: '1px solid rgba(255,255,255,.28)' }}>
                  {pageZero ? (
                    <div className="cedt-mrow">
                      <span className="nm">Brand page read</span>
                      <span className="vl">0 ads returned</span>
                      <span className="dt">{metaReadDate}</span>
                    </div>
                  ) : null}
                  {sweep ? (
                    <div className="cedt-mrow">
                      <span className="nm">
                        {`Keyword sweep, ${countParts(sweep.sampled_items || 0, sweep.capped).pre ? `${countParts(sweep.sampled_items || 0, sweep.capped).pre} ` : ''}${sweep.sampled_items} ads read`}
                      </span>
                      <span className="vl">{`${sweep.identity_matched_ads ?? 0} traced to this brand`}</span>
                      <span className="dt">{longDay(sweep.checked_at) || metaReadDate}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* ── Instrument 3: the counterpoint ─────────────────────────────────────── */}
        {compCreatives.length > 0 ? (
          <div className="mt-16 pt-10" style={{ borderTop: '1px solid rgba(255,255,255,.16)' }}>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-8">
              <span className="text-[0.68rem] font-bold uppercase tracking-[0.24em]" style={{ fontFamily: headingFont, color: accent }}>
                The same keywords, other advertisers
              </span>
              {Array.isArray(comp?.keywords) ? (
                <span className="flex flex-wrap gap-2">
                  {comp.keywords.slice(0, 3).map((k: string) => (
                    <span
                      key={k}
                      className="text-[0.72rem] font-semibold px-2.5 py-1 rounded-full"
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
              {compAges.length > 0 ? (
                <Stat n={String(Math.min(...compAges))} unit="days" label="since the most recent competitor start date" />
              ) : null}
            </div>

            <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {compShown.map((c, i) => {
                const src = creativeImageSrc(c);
                const start = isoDay(c.start_date);
                const fallback = (
                  <span className="absolute inset-0 flex flex-col justify-end p-2.5" style={{ background: 'rgba(255,255,255,.05)' }}>
                    <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em]" style={{ fontFamily: headingFont, color: surface, opacity: 0.75 }}>ad</span>
                    {start ? <span className="text-[0.72rem] font-bold tabular-nums mt-1" style={{ fontFamily: headingFont, color: surface, opacity: 0.85 }}>{start}</span> : null}
                  </span>
                );
                return (
                  <figure key={i} style={{ margin: 0 }}>
                    <EvidenceImg src={src} alt={`Ad from ${clean(String(c.advertiser))}`} ratio="4 / 5" fallback={fallback} />
                    <figcaption className="mt-2">
                      {typeof c.age_days === 'number' ? (
                        <span className="flex items-baseline gap-1.5">
                          <span className="font-extrabold tabular-nums leading-none" style={{ fontFamily: headingFont, fontSize: '1.55rem', color: surface }}>{c.age_days}</span>
                          <span className="text-[0.62rem] font-bold uppercase tracking-[0.16em]" style={{ fontFamily: headingFont, color: surface, opacity: 0.55 }}>days</span>
                        </span>
                      ) : null}
                      <span className="block mt-1 text-[0.78rem] font-bold leading-tight" style={{ color: surface, opacity: 0.9 }}>{clean(String(c.advertiser))}</span>
                      {start ? <span className="block mt-0.5 text-[0.68rem] tabular-nums" style={{ color: surface, opacity: 0.5 }}>{start}</span> : null}
                      {c.keyword ? (
                        <span className="block mt-1.5 text-[0.6rem] font-bold uppercase tracking-[0.12em]" style={{ fontFamily: headingFont, color: accent, opacity: 0.85 }}>{clean(String(c.keyword))}</span>
                      ) : null}
                    </figcaption>
                  </figure>
                );
              })}
            </div>

            {/* Shared recency axis: the counterpoint, drawn. */}
            {compAges.length > 0 ? (
              <div className="mt-14">
                <div className="text-[0.62rem] font-bold uppercase tracking-[0.24em] mb-4" style={{ fontFamily: headingFont, color: surface, opacity: 0.5 }}>
                  Start dates, drawn back from the read
                </div>
                <div className="cedt-axis">
                  {compShown.map((c, i) =>
                    typeof c.age_days === 'number' ? (
                      <span key={i} className="dot" style={{ left: `${agePos(c.age_days)}%` }} title={`${clean(String(c.advertiser))}, ${c.age_days} days`} />
                    ) : null,
                  )}
                  {newestAge != null ? (
                    <span className="mkr" style={{ left: `${agePos(newestAge)}%`, background: accent }} />
                  ) : null}
                  <span className="ln" />
                  <span className="end l">{`${axisMax} days back`}</span>
                  <span className="end r">{compReadLong ? `read ${compReadLong}` : 'read date'}</span>
                  {newestAge != null ? (
                    <span className="mkl" style={{ left: `${agePos(newestAge)}%`, color: accent }}>{`your newest, ${newestAge} days`}</span>
                  ) : null}
                </div>
                {fresherThanBrand != null && newestAge != null ? (
                  <p className="mt-7 text-[1.05rem] leading-relaxed" style={{ color: surface, opacity: 0.82, maxWidth: '66ch' }}>
                    {`${fresherThanBrand} of the ${compShown.length} competitor creatives shown carry a start date more recent than your newest first-shown date, which is ${newestAge} days back.`}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
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
  if (total === 0) return null;
  const present = BUCKET_ORDER.filter((b) => byBucket[b].length > 0);
  const segFill = (b: BucketKey) =>
    b === 'rise' ? accent : b === 'split' ? `repeating-linear-gradient(45deg, ${accent} 0 3px, ${ink}14 3px 8px)` : b === 'asset' ? ink : `${ink}0f`;

  const column = (b: BucketKey) => (
    <div>
      <div className="flex items-center gap-2.5">
        <BucketGlyph b={b} accent={accent} ink={ink} size={9} />
        <span className="text-[0.68rem] font-bold uppercase tracking-[0.2em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.75 }}>
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
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>Week one</span>
      </div>
      <h3 className="font-extrabold tracking-[-0.02em] mb-9" style={{ fontFamily: headingFont, fontSize: 'clamp(1.75rem, 4vw, 2.9rem)', color: ink, lineHeight: 1.04 }}>
        Who does what
      </h3>

      {/* The whole read in one glance: every finding, sized by side. */}
      <div className="cedt-splitbar" aria-hidden="true">
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
      </div>

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
                <span className="text-[0.68rem] font-bold uppercase tracking-[0.2em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.75 }}>
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
            <span className="text-[0.68rem] font-bold uppercase tracking-[0.2em]" style={{ fontFamily: headingFont, color: surface, opacity: 0.8 }}>
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
  const d = report.dtc;
  if (!d) return null;

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

  // Scan date from the row itself. Never fabricated: absent field renders no date at all.
  const scanDate = scan.created_at
    ? new Date(scan.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  // Genuine ads-empty (source reached, zero active ads) switches the calculator intro.
  const adsEmpty = d.ads?.meta?.status === 'empty';

  // REAL DEFECT the floor never fixed: the brand fonts were declared but never loaded. Load them.
  useGoogleFonts([brand.font_heading, brand.font_body]);

  useMetadata({
    title: `A growth scan for ${companyName}`,
    description: clean(d.hero_hook) || `A public read of ${companyName}'s store, and where the growth is.`,
    canonical: `${(import.meta as any).env?.VITE_SCAN_ORIGIN || 'https://ivanmanfredi.com'}/scan/${scan.company_slug}`,
    ogImage: d.og_image_url || brand.og_image_url || undefined,
    noindex: true,
  });

  const findings = d.findings || [];
  const pg = d.profit_gap;

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
  const thinRead = findings.length === 0;

  // Dated storefront capture: present ONLY after a human QA pass wrote it to the row.
  // Attaches under the finding named by attach_signal, defaulting to the lead finding.
  const capture = d.evidence_capture && d.evidence_capture.url ? d.evidence_capture : null;
  const captureDate = capture?.captured_at
    ? new Date(capture.captured_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  const captureAttachIndex = capture
    ? Math.max(0, findings.findIndex((f) => f.signal === capture.attach_signal))
    : -1;

  const findingVariant = (i: number): 'lead' | 'split' | 'offset' => (['lead', 'split', 'offset'] as const)[i % 3];

  // ── audit v3 evidence blocks (all optional, all presence-gated) ─────────────────────
  const dAny = d as any;
  const gAds = dAny.ads?.google;
  const metaSweep = dAny.ads?.meta_sweep;
  const competitors = dAny.competitors;
  // The brand-wide sweep is what upgrades "this page runs nothing" into a brand-wide zero.
  const sweepZero = metaSweep?.status === 'empty' && !!metaSweep.data;
  const hasAdEvidence =
    gAds?.status === 'present' ||
    sweepZero ||
    (competitors?.status === 'present' && Array.isArray(competitors.data?.creatives) && competitors.data.creatives.length > 0);

  // Dated storefront plates. A URL with no capture date, or a capture date with no URL,
  // renders nothing: an undated screenshot is not evidence.
  const shots = dAny.screenshots;
  const shotDate = longDay(shots?.captured_at);
  const shotPlates: Array<{ idx: number; url: string; label: string }> = [];
  if (shots && shotDate) {
    const homeIdx = findings.findIndex((f) => f.signal === 'shopify');
    const pdpIdx = findings.findIndex((f) => f.signal === 'reviews');
    if (shots.homepage_url && homeIdx >= 0) shotPlates.push({ idx: homeIdx, url: shots.homepage_url, label: 'Your homepage' });
    if (shots.pdp_url) {
      const at = pdpIdx >= 0 ? pdpIdx : findings.map((f, i) => (f.signal === 'shopify' ? i : -1)).filter((i) => i >= 0 && i !== homeIdx)[0];
      if (at != null && at >= 0) shotPlates.push({ idx: at, url: shots.pdp_url, label: 'Your product page' });
    }
  }

  const anyBucket = findings.some((f) => bucketOf(f) !== null);

  // ── Sourced vitals receipt ──────────────────────────────────────────────────────────
  // Two gates per line: the signal status has to allow it (correctness spine) AND the fact
  // has to be BOUND, meaning a rendered finding cites it or it seeds the Profit Gap. Binding
  // hay is the prose the reader actually sees, per signal.
  const hayFor = (sig: string) =>
    findings.filter((f) => f.signal === sig).map((f) => `${clean(f.title)} ${clean(f.evidence)}`).join(' ');
  const hasFinding = (sig: string) => findings.some((f) => f.signal === sig);
  const haysShopify = hayFor('shopify');
  const pgRenders = !!pg;
  const pgSeeded = !!pg && pg.seed_aov != null;

  const catalogLines: ReceiptLine[] = [];
  const shopData = shop?.status === 'present' && shop.data ? shop.data : null;
  if (shopData) {
    const rest: ReceiptLine[] = [];
    const depthCited = shopData.discount_depth_pct != null && cited(haysShopify, `${shopData.discount_depth_pct}%`);
    if (
      typeof shopData.products_on_discount === 'number' &&
      typeof shopData.catalog_size === 'number' &&
      (cited(haysShopify, String(shopData.products_on_discount)) || depthCited)
    ) {
      rest.push({ signal: 'shopify', label: 'On discount', value: `${shopData.products_on_discount} of ${shopData.catalog_size}`, source: 'products.json' });
    }
    if (shopData.discount_depth_pct != null && depthCited) {
      rest.push({ signal: 'shopify', label: 'Average discount depth', value: `${shopData.discount_depth_pct}%`, source: 'products.json' });
    }
    const band = shopData.price_band;
    const shopSym = curSymbol(shopData.currency);
    if (
      band &&
      (citedAmount(haysShopify, band.min) ||
        citedAmount(haysShopify, band.max) ||
        /price band/i.test(haysShopify))
    ) {
      rest.push({ signal: 'shopify', label: 'Price band, low to high', value: `${fmtPrice(band.min, shopSym)} to ${fmtPrice(band.max, shopSym)}`, source: 'products.json' });
    }
    // The median is what seeds the calculator, so a rendered Profit Gap binds it on its own.
    if (band && band.median != null && (pgSeeded || citedAmount(haysShopify, band.median))) {
      rest.push({ signal: 'shopify', label: 'Median price', value: fmtPrice(band.median, shopSym), source: 'products.json' });
    }
    if (shopData.oos_pct != null && (cited(haysShopify, `${shopData.oos_pct}%`) || /out[- ]of[- ]stock/i.test(haysShopify))) {
      rest.push({ signal: 'shopify', label: 'Out of stock', value: `${shopData.oos_pct}%`, source: 'products.json' });
    }
    if (shopData.has_subscription === false && /subscri/i.test(haysShopify)) {
      rest.push({ signal: 'shopify', label: 'Subscription option', value: 'none found', source: 'products.json', none: true });
    } else if (shopData.has_subscription === true && /subscri/i.test(haysShopify)) {
      rest.push({ signal: 'shopify', label: 'Subscription option', value: 'live', source: 'products.json' });
    }
    // Catalog size renders ONLY when a finding cites the count itself, exactly like every
    // other line, so the foot's binding claim stays true by construction (slop pass, 07-31).
    if (typeof shopData.catalog_size === 'number' && cited(haysShopify, String(shopData.catalog_size))) {
      catalogLines.push({ signal: 'shopify', label: 'Products live', value: String(shopData.catalog_size), source: 'products.json' });
    }
    catalogLines.push(...rest);
  }

  const pageLines: ReceiptLine[] = [];
  const rev = d.reviews;
  if (rev?.status === 'present' && rev.data && rev.data.rating != null && rev.data.review_count != null && hasFinding('reviews')) {
    // Ratings read "5.0", never "5": one decimal is how the PDP itself states them.
    pageLines.push({ signal: 'reviews', label: 'Product page rating', value: `${rev.data.rating.toFixed(1)} from ${rev.data.review_count}`, source: 'product page' });
  } else if (rev?.status === 'empty' && hasFinding('reviews')) {
    pageLines.push({ signal: 'reviews', label: 'Product page reviews', value: 'none visible', source: 'product page', none: true });
  }
  const sig = d.signup;
  const markers = sig?.data?.capture_markers || [];
  if (sig?.status === 'present' && sig.data?.has_capture_markers && markers.length > 0 && hasFinding('signup')) {
    pageLines.push({ signal: 'signup', label: 'Email capture', value: markers.join(', '), source: 'storefront' });
  } else if (sig?.status === 'empty' && hasFinding('signup')) {
    pageLines.push({ signal: 'signup', label: 'Email capture', value: 'none found', source: 'storefront', none: true });
  }

  const paidLines: ReceiptLine[] = [];
  if (adsMeta?.status === 'empty' && (hasFinding('ads.meta') || pgRenders)) {
    // The $0 CAC seed under the calculator rests on this read, which is what binds it.
    // With the brand-wide sweep on the row the line can state the dated record instead of a
    // status, which is what the evidence spread argues from. Without it, the pre-v3 wording
    // stands untouched, so an old row's receipt is byte-identical to the floor.
    paidLines.push(
      sweepZero
        ? { signal: 'ads.meta', label: 'Meta Ad Library', value: 'zero ads on record', source: 'meta ad library', none: true }
        : { signal: 'ads.meta', label: 'Meta Ad Library', value: 'no active ads', source: 'meta ad library', none: true },
    );
  } else if (
    adsMeta?.status === 'present' && adsMeta.data &&
    typeof adsMeta.data.active_ad_count === 'number' && adsMeta.data.active_ad_count > 0 &&
    hasFinding('ads.meta')
  ) {
    paidLines.push({ signal: 'ads.meta', label: 'Meta Ad Library', value: `${adsMeta.data.active_ad_count} active`, source: 'meta ad library' });
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

  // Sticky pill collision: while a dense panel (receipt card, Profit Gap band) sits in the
  // bottom band of the viewport, the pill steps out of the way. SSR renders it visible.
  const [pillHidden, setPillHidden] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || typeof document === 'undefined') return;
    const nodes = Array.from(document.querySelectorAll('[data-densepanel]'));
    if (nodes.length === 0) return;
    const hits = new Set<Element>();
    const topInset = Math.max(0, (typeof window !== 'undefined' ? window.innerHeight : 800) - 160);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) hits.add(e.target);
          else hits.delete(e.target);
        }
        setPillHidden(hits.size > 0);
      },
      { root: null, rootMargin: `-${topInset}px 0px 0px 0px`, threshold: 0 },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [showReceipt, pgRenders]);

  return (
    <div style={{ background: surface, color: ink, fontFamily: bodyFont, minHeight: '100vh', ['--cedt-hair' as any]: `${ink}14` } as React.CSSProperties}>
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
        .cedt-rcl { display: grid; grid-template-columns: minmax(0,1fr) auto 132px; align-items: baseline; column-gap: 14px; padding: 7px 0; }
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
        /* Waterfall: drawn at width, proportional strip under 760px. */
        .cedt-wfsvg { display: block; width: 100%; height: auto; overflow: visible; }
        .cedt-wfsvg .lb { font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; letter-spacing: .06em; fill: rgba(255,255,255,.8); }
        .cedt-wfsvg .lb.g { fill: ${accent}; font-size: 17px; }
        .cedt-wfsvg .lbm { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .12em; fill: rgba(255,255,255,.45); }
        .cedt-wfsvg .ld { stroke: rgba(255,255,255,.3); stroke-width: 1; }
        .cedt-wfbar-m, .cedt-wfmk { display: none; }
        @media (max-width: 760px) {
          .cedt-wfsvg { display: none; }
          .cedt-wfmk { display: flex; justify-content: space-between; font-family: 'Sora', sans-serif; font-size: .62rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,.45); margin: 0 0 7px; }
          .cedt-wfbar-m { display: flex; height: 34px; border-radius: 5px; overflow: hidden; border: 1px solid rgba(255,255,255,.34); }
          .cedt-wfbar-m span { height: 100%; flex: 0 0 auto; border-right: 1px solid rgba(17,17,17,.35); }
          .cedt-wfbar-m span:last-child { border-right: none; }
        }
        /* Ledger row: swatch, name, dollar, percent of the order. */
        .cedt-lgd { display: grid; grid-template-columns: 14px minmax(0,1fr) 92px 78px; align-items: center; column-gap: 12px; padding: 11px 0; }
        @media (max-width: 640px) {
          .cedt-lgd { grid-template-columns: 14px minmax(0,1fr) 76px; column-gap: 10px; }
          .cedt-lgd .pc { display: none; }
        }
        .cedt-sticky { transition: opacity .18s ease, transform .18s ease; }

        /* ── audit v3: evidence spread instruments ─────────────────────────────── */
        /* Format split: one strip, segments proportional to their own sum. */
        .cedt-fmtbar { display: flex; height: 30px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,.3); }
        .cedt-fmtbar span { height: 100%; flex: 0 0 auto; border-right: 1px solid rgba(17,17,17,.4); }
        .cedt-fmtbar span:last-child { border-right: none; }
        /* Dated strip: format tag, then a track carrying one bar between two dates. */
        .cedt-gan { display: grid; grid-template-columns: 74px minmax(0,1fr); align-items: center; column-gap: 16px; padding: 5px 0; }
        .cedt-gan .lbl { font-family: 'Sora', sans-serif; font-size: .58rem; font-weight: 700; text-transform: uppercase; letter-spacing: .16em; color: rgba(255,255,255,.5); }
        .cedt-gan .trk { position: relative; display: block; height: 26px; border-radius: 3px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); }
        .cedt-gan .bar { position: absolute; top: 4px; bottom: 4px; border-radius: 2px; min-width: 3px; }
        .cedt-gan .dts { position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 8px; pointer-events: none; }
        .cedt-gan .dts b { font-family: 'Sora', sans-serif; font-size: .62rem; font-weight: 700; letter-spacing: .04em; color: rgba(255,255,255,.62); font-variant-numeric: tabular-nums; }
        .cedt-gan-head .trk, .cedt-gan-foot .trk { height: 18px; background: transparent; border: none; }
        .cedt-gan-head .yr { position: absolute; top: 0; transform: translateX(-50%); font-family: 'Sora', sans-serif; font-size: .62rem; font-weight: 700; letter-spacing: .14em; color: rgba(255,255,255,.4); }
        .cedt-gan-head .yr::after { content: ""; position: absolute; left: 50%; top: 15px; width: 1px; height: 7px; background: rgba(255,255,255,.22); }
        .cedt-gan-foot .trk b { position: absolute; top: 4px; font-family: 'Sora', sans-serif; font-size: .62rem; font-weight: 700; letter-spacing: .1em; color: rgba(255,255,255,.5); font-variant-numeric: tabular-nums; }
        @media (max-width: 640px) {
          .cedt-gan { grid-template-columns: minmax(0,1fr); row-gap: 3px; padding: 7px 0; }
          .cedt-gan .dts b { font-size: .56rem; }
        }
        /* Meta ledger row. */
        .cedt-mrow { display: grid; grid-template-columns: minmax(0,1fr) auto 160px; align-items: baseline; column-gap: 16px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,.14); }
        .cedt-mrow .nm { font-size: .94rem; color: rgba(255,255,255,.8); }
        .cedt-mrow .vl { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 1rem; color: #fff; font-variant-numeric: tabular-nums; }
        .cedt-mrow .dt { font-family: 'Sora', sans-serif; font-size: .6rem; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; text-align: right; color: rgba(255,255,255,.45); }
        @media (max-width: 640px) {
          .cedt-mrow { grid-template-columns: minmax(0,1fr) auto; row-gap: 3px; }
          .cedt-mrow .dt { grid-column: 1 / -1; text-align: left; }
        }
        /* Recency axis: older on the left, the read date on the right. */
        .cedt-axis { position: relative; height: 96px; }
        .cedt-axis .ln { position: absolute; left: 0; right: 0; top: 52px; height: 1px; background: rgba(255,255,255,.28); }
        .cedt-axis .dot { position: absolute; top: 45px; width: 15px; height: 15px; margin-left: -7.5px; border-radius: 50%; background: rgba(255,255,255,.62); border: 1px solid rgba(17,17,17,.5); }
        .cedt-axis .mkr { position: absolute; top: 30px; height: 44px; width: 3px; margin-left: -1.5px; }
        .cedt-axis .mkl { position: absolute; top: 4px; transform: translateX(-50%); white-space: nowrap; font-family: 'Sora', sans-serif; font-size: .66rem; font-weight: 700; text-transform: uppercase; letter-spacing: .12em; }
        .cedt-axis .end { position: absolute; top: 74px; font-family: 'Sora', sans-serif; font-size: .6rem; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; color: rgba(255,255,255,.45); }
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
            <span className="hidden sm:inline text-[0.72rem] uppercase tracking-[0.22em]" style={{ color: ink, opacity: 0.55 }}>
              {scanDate ? `Growth Scan · ${scanDate}` : 'Growth Scan'}
            </span>
            <a
              href={ctaUrl('header')}
              data-cta="header"
              target="_blank"
              rel="noopener noreferrer"
              className="cedt-anim text-[0.85rem] font-bold px-4 py-2 rounded-full whitespace-nowrap transition-transform hover:-translate-y-0.5"
              style={{ background: accent, color: ink }}
            >
              Book 30 min with Mattan
            </a>
          </div>
        </div>
      </header>

      {/* Chapter — Cover / hook */}
      <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 pt-16 sm:pt-24 pb-14">
        <div className="grid lg:grid-cols-12 gap-y-8 lg:gap-x-12 items-end">
          <div className="lg:col-span-9">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: ink, opacity: 0.25 }} />
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>
                A RISE DTC growth feature
              </span>
            </div>
            <p className="text-[1rem] font-semibold uppercase tracking-[0.2em] mb-5" style={{ color: ink, opacity: 0.55 }}>{companyName}</p>
            <h1
              className="font-extrabold tracking-[-0.02em]"
              style={{ fontFamily: headingFont, fontSize: 'clamp(2.25rem, 6.4vw, 5rem)', lineHeight: 1.02, color: ink }}
            >
              {clean(d.hero_hook)}
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
                <div className="text-[0.72rem] uppercase tracking-[0.18em]" style={{ color: ink, opacity: 0.55 }}>CEO, RISE DTC</div>
              </div>
            </div>
            <p className="mt-2 text-[0.95rem] leading-relaxed" style={{ color: ink, opacity: 0.7 }}>
              My team ran this scan on {companyName}'s public data. The call puts your live store and ad numbers next to it.
            </p>
            <a href="https://risedtc.com" target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-[0.8rem] underline underline-offset-4" style={{ color: ink, opacity: 0.55 }}>
              risedtc.com
            </a>
            {credibilityLine ? (
              <div className="mt-3 text-[0.8rem] leading-relaxed" style={{ color: ink, opacity: 0.55 }}>{credibilityLine}</div>
            ) : null}
            <p className="mt-3 text-[0.85rem] leading-relaxed" style={{ color: ink, opacity: 0.6 }}>
              For qualifying brands, RISE gets paid on performance: low or $0 base fee, with the fee a share of growth above an agreed baseline. The terms are at the end of this page.
            </p>
          </div>
        </div>
      </section>

      {/* Chapter — Evidence-first dark spread. Sits straight after the hook because the ad
          record is the one thing on this page the reader cannot argue with: it is dated, it
          is public, and it was read without them. Born-absent on a pre-v3 row. */}
      {hasAdEvidence ? (
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
          finding below cites or the Profit Gap runs on, which is what the foot line claims.
          Under three bound lines the whole band collapses. */}
      {showReceipt ? (
        <section
          aria-label="Sourced vitals"
          style={{ background: '#f6f7f8', borderTop: `1px solid ${ink}14`, borderBottom: `1px solid ${ink}14` }}
        >
          <div className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-14 sm:py-16">
            {/* The receipt reads as a centered document, proof-strip measure, not a leftover column. */}
            <div className="mx-auto w-full max-w-[680px]">
            <div className="flex items-center gap-3 mb-7">
              <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: ink, opacity: 0.25 }} />
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>
                Everything we read, and where
              </span>
            </div>

            <div
              data-densepanel="1"
              className="w-full"
              style={{ background: surface, border: `1px solid ${ink}14`, borderRadius: 4 }}
            >
              <div className="flex items-baseline justify-between gap-3 px-[22px] py-4" style={{ borderBottom: `1px solid ${ink}` }}>
                <span className="font-extrabold text-[1.02rem] tracking-[-0.01em]" style={{ fontFamily: headingFont, color: ink }}>
                  Store vitals
                </span>
                <span className="text-[0.66rem] font-bold uppercase tracking-[0.18em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.45 }}>
                  {scan.domain}
                </span>
              </div>

              {receiptGroups.map((g, gi) => (
                <div key={g.label} className="px-[22px] pt-1.5 pb-3" style={gi > 0 ? { borderTop: `1px solid ${ink}0f` } : undefined}>
                  <div className="pt-3 pb-2 text-[0.6rem] font-bold uppercase tracking-[0.24em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.45 }}>
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
                          className="vl tabular-nums whitespace-nowrap font-bold"
                          style={{
                            fontFamily: headingFont,
                            color: ink,
                            opacity: l.none ? 0.6 : 1,
                            fontSize: l.none ? '0.86rem' : isFlag ? '1.12rem' : '1rem',
                          }}
                        >
                          {l.value}
                        </span>
                        <span className="sr text-[0.58rem] font-bold uppercase tracking-[0.16em] text-right whitespace-nowrap" style={{ fontFamily: headingFont, color: ink, opacity: 0.45 }}>
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
                style={{ borderTop: '1px dashed #dfe3e7', color: ink, opacity: 0.55 }}
              >
                {scanDate ? `Read ${scanDate} from public pages, with no login and nothing you sent us. ` : ''}
                Every line above backs a finding below or feeds the Profit Gap.
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
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>What we found</span>
          </div>
          <h2 className="font-extrabold tracking-[-0.02em] mb-12" style={{ fontFamily: headingFont, fontSize: 'clamp(2rem, 5vw, 3.5rem)', color: ink, lineHeight: 1.03 }}>
            Where the growth is
          </h2>

          <div className="space-y-16">
            {findings.map((f, i) => {
              const variant = findingVariant(i);
              const chip = (
                <span
                  className="inline-flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.16em] px-3 py-1.5 rounded-full"
                  style={{ border: `1px solid ${ink}33`, color: ink }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                  {LEVER_LABEL[f.lever] || f.lever}
                </span>
              );
              // Bucket chip: the deal shape, on the finding it applies to. Locked copy, and
              // the same two-square glyph the week-one panel uses, so a chip and the panel
              // read as one instrument. Bucket null renders no chip at all.
              const bk = bucketOf(f);
              const bucketChip = bk ? (
                <span
                  data-bucket={bk}
                  className="inline-flex items-center gap-2 text-[0.72rem] font-bold uppercase tracking-[0.14em] px-3 py-1.5 rounded-full whitespace-nowrap"
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
                    <span className="block text-[0.6rem] font-bold uppercase tracking-[0.22em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.5 }}>
                      Week one
                    </span>
                    {f.bucket_pillar ? (
                      <span className="block mt-1.5 text-[0.62rem] font-bold uppercase tracking-[0.12em]" style={{ fontFamily: headingFont, color: ink, opacity: 0.75 }}>
                        {clean(String(f.bucket_pillar))}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[1.02rem] leading-[1.55] font-medium" style={{ color: ink }}>{weekOne}</p>
                </div>
              ) : null;

              const sourceLink = f.source_url ? (
                <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-[0.85rem] font-semibold underline underline-offset-4" style={{ color: ink, opacity: 0.6 }}>
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
                          className="src block text-[0.58rem] font-bold uppercase tracking-[0.16em] mt-2.5 pt-2"
                          style={{ fontFamily: headingFont, color: ink, opacity: 0.45, borderTop: '1px dashed #dfe3e7' }}
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
                    className="mt-2.5 text-[0.62rem] font-bold uppercase tracking-[0.16em]"
                    style={{ fontFamily: headingFont, color: ink, opacity: 0.5 }}
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
                      className="mt-2.5 text-[0.62rem] font-bold uppercase tracking-[0.16em]"
                      style={{ fontFamily: headingFont, color: ink, opacity: 0.5 }}
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
          {anyBucket ? (
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
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>The read</span>
            </div>
            <h2 className="font-extrabold tracking-[-0.02em]" style={{ fontFamily: headingFont, fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', color: ink, lineHeight: 1.05 }}>
              The public read gave us the basics
            </h2>
            <p className="mt-5 text-[1.2rem] leading-relaxed" style={{ color: ink, opacity: 0.8 }}>
              The public surfaces we read gave us the basics. The full teardown, catalog economics and
              the Profit Gap, comes off a live look together.
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
            <p className="mt-3 text-[0.85rem]" style={{ color: ink, opacity: 0.55 }}>
              30 minutes with Mattan Danino, CEO of RISE DTC. We go through your store live.
            </p>
          </div>
        </section>
      ) : null}

      {/* Chapter — Profit Gap climax (collapses when the seed is absent) */}
      {pg ? (
        <ProfitGapSpread
          seedAov={pg.seed_aov}
          sourceNote={pg.source_note}
          accent={accent}
          ink={ink}
          surface={surface}
          headingFont={headingFont}
          ctaHref={ctaUrl('profitgap')}
          adsEmpty={adsEmpty}
          metaSweepZero={sweepZero}
          currency={(d.shopify?.data as any)?.currency ?? null}
        />
      ) : null}

      {/* Chapter: proof strip. Static, number-verbatim work RISE has already run. No images,
          no logos, no data dependency. Client names deliberately withheld: Mattan's 07-27
          ruling bans brand names in ALL Rise case-study copy (risedtc-casestudy-anonymization),
          vertical descriptors only. Numerals verbatim from content_prompts rise-company-facts.
          risedtc.com names these brands itself, which is why the foot line can point there. */}
      <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-16" style={{ borderTop: `1px solid ${ink}14`, background: surface }}>
        <div className="mx-auto w-full max-w-[820px]">
          <div className="flex items-center gap-3 mb-8">
            <span className="h-px w-10" data-eyebrow-rule="1" style={{ background: ink, opacity: 0.25 }} />
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>Work RISE has run</span>
          </div>
          <div>
            <p className="py-5 text-[1.0625rem] leading-relaxed" style={{ borderTop: `1px solid ${ink}14`, color: ink, opacity: 0.85 }}>
              <span style={{ fontFamily: headingFont, fontWeight: 700, color: ink }}>A heritage workwear brand.</span>{' '}
              RISE ran paid for their women's line launch: $1M+ in profitable ad spend, CPA down 40%.
            </p>
            <p className="py-5 text-[1.0625rem] leading-relaxed" style={{ borderTop: `1px solid ${ink}14`, color: ink, opacity: 0.85 }}>
              <span style={{ fontFamily: headingFont, fontWeight: 700, color: ink }}>An apparel accessories brand.</span>{' '}
              RISE ran the Google program: 800%+ ROAS, monthly revenue from $30k to $100k+.
            </p>
            <p className="py-5 text-[1.0625rem] leading-relaxed" style={{ borderTop: `1px solid ${ink}14`, borderBottom: `1px solid ${ink}14`, color: ink, opacity: 0.85 }}>
              <span style={{ fontFamily: headingFont, fontWeight: 700, color: ink }}>A women's activewear brand.</span>{' '}
              With RISE running paid: $2.2M to $6.5M+ in 24 months.
            </p>
          </div>
          <p className="mt-6 text-[0.85rem]" style={{ color: ink, opacity: 0.55 }}>
            Ask Mattan for the mechanism behind any of these on the call. Full case studies at risedtc.com.
          </p>
        </div>
      </section>

      {/* Chapter: close band. Ink-on-white flips to white-on-ink, mirroring the tools-hub
          ctaband + signature-card pattern. Fee card keeps the qualifying-brands gate: RISE's
          own pricing page publishes TWO models, and the Performance Model is gated, never
          universal (see content_prompts rise-company-facts). */}
      <section style={{ background: ink, color: surface, position: 'relative', overflow: 'hidden' }}>
        <img
          src="https://resources.risedtc.com/tools/assets/rise-sun-wht.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={{ position: 'absolute', bottom: '-60px', left: '50%', transform: 'translateX(-50%)', width: 420, opacity: 0.07, pointerEvents: 'none' }}
        />
        <div className="mx-auto w-full max-w-[820px] px-6 text-center" style={{ position: 'relative', padding: '70px 24px 74px' }}>
          <div className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: 'rgba(255,255,255,.6)' }}>Ready when you are</div>
          <h2
            className="mt-4 font-extrabold tracking-[-0.02em]"
            style={{ fontFamily: headingFont, fontSize: 'clamp(1.9rem, 4.6vw, 3.2rem)', lineHeight: 1.05, color: surface }}
          >
            Want this math on <span style={{ color: accent }}>your real numbers?</span>
          </h2>
          <p className="mx-auto mt-5 text-[1.0625rem] leading-relaxed" style={{ color: 'rgba(255,255,255,.74)', maxWidth: '52ch' }}>
            From week one we run this on live store and ad data. On the call Mattan walks this exact page with you and runs the Profit Gap on your real CAC and margins.
          </p>

          <div className="my-8 text-left p-6 sm:p-7" style={{ border: '1px solid rgba(255,255,255,.2)', borderRadius: 4 }}>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: 'rgba(255,255,255,.6)' }}>How RISE charges</div>
            {/* Performance leads and carries the accent: it is the model this page is selling.
                The qualifying gate stays — RISE's own pricing publishes it as gated, never
                universal (content_prompts rise-company-facts). */}
            <div className="mt-5 p-5 sm:p-6" style={{ background: 'rgba(255,199,29,.09)', borderLeft: `3px solid ${accent}`, borderRadius: 2 }}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[1.05rem]" style={{ fontFamily: headingFont, fontWeight: 800, color: accent }}>Performance Model</span>
                <span className="text-[0.68rem] font-bold uppercase tracking-[0.18em]" style={{ fontFamily: headingFont, color: 'rgba(255,255,255,.55)' }}>for qualifying brands</span>
              </div>
              <p className="mt-2.5 text-[1rem] leading-relaxed" style={{ color: 'rgba(255,255,255,.92)' }}>
                Low or $0 base fee. RISE earns a share of growth above your baseline, typically 20%, measured in your own ad account and store backend. No growth, no performance fee.
              </p>
            </div>
            <p className="mt-4 text-[0.95rem] leading-relaxed" style={{ color: 'rgba(255,255,255,.7)' }}>
              <span style={{ fontFamily: headingFont, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>Growth Model.</span>{' '}
              Base from $2,000 per month plus a percentage of ad spend, senior strategist included.
            </p>
            <p className="mt-4 text-[0.875rem]" style={{ color: 'rgba(255,255,255,.55)' }}>
              Which model fits your brand gets settled on the call.
            </p>
          </div>

          <p className="text-[0.84rem]" style={{ color: 'rgba(255,255,255,.55)' }}>
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
              <div style={{ fontFamily: headingFont, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.18em', color: 'rgba(255,255,255,.5)' }}>CEO, RISE DTC</div>
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

          <p className="mx-auto mt-6 text-[0.9rem] leading-relaxed text-left" style={{ color: 'rgba(255,255,255,.6)', maxWidth: '60ch' }}>
            RISE DTC is run by Mattan Danino and Matt Moore. Mattan has 15+ years in DTC, with work published by HubSpot, Inc. Magazine, Klaviyo and Shopify, and guest lectures at UCLA. RISE is selective: when a brand qualifies, platform work starts within 48 hours of onboarding.
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
          <p className="text-[0.85rem]" style={{ color: ink, opacity: 0.55 }}>
            Prepared for {companyName}. Unlisted link, shared with you only.
          </p>
        </div>
      </footer>

      {/* Sticky mini-CTA — kills the mid-page CTA-free gap the baseline had at 90% of height */}
      <a
        href={ctaUrl('sticky')}
        data-cta="sticky"
        target="_blank"
        rel="noopener noreferrer"
        className="cedt-anim cedt-sticky fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full px-5 py-3 text-[0.85rem] font-bold shadow-lg transition-transform hover:-translate-y-0.5"
        style={{
          background: accent,
          color: ink,
          boxShadow: `0 8px 30px ${ink}26`,
          opacity: pillHidden ? 0 : 1,
          pointerEvents: pillHidden ? 'none' : undefined,
          transform: pillHidden ? 'translateY(8px)' : undefined,
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: ink }} />
        30 min with Mattan
      </a>
    </div>
  );
}
