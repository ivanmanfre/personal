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

function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

// Receipt price formatting: whole prices stay whole, fractional prices get two decimals,
// thousands get separators, so the receipt states a value the way the findings prose does
// ("$1,285", never "$1285").
function fmtPrice(v: number): string {
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(v) ? 0 : 2 });
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
}: {
  seedAov: number | null;
  sourceNote: string;
  accent: string;
  ink: string;
  surface: string;
  headingFont: string;
  ctaHref: string;
  adsEmpty: boolean;
}) {
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
    { key: 'proc', name: 'Payment processing', sub: `${procPct.toFixed(1)}% plus $0.30`, v: processingSeg, swatch: 'rgba(255,255,255,.46)' },
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
                ? 'This is the first number RISE looks at. The public Meta Ad Library shows no active ads on your brand right now, so the seed carries $0 of paid CAC. Slide CAC to the right and watch how much acquisition cost each order can absorb before contribution profit goes negative. That is the number a paid program on your brand has to clear.'
                : seeded
                  ? 'This is the first number RISE looks at on any brand. AOV is seeded from your public catalog. CAC starts at $0: drag it to what you pay per new customer today, or find the number a paid program would need to beat to stay profit-positive on every order.'
                  : 'This is the first number RISE looks at on any brand. AOV starts at a placeholder, so type your real number in. CAC starts at $0: drag it to what you pay per new customer today, or find the number a paid program would need to beat to stay profit-positive on every order.'}
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
    if (
      band &&
      (citedAmount(haysShopify, band.min) ||
        citedAmount(haysShopify, band.max) ||
        /price band/i.test(haysShopify))
    ) {
      rest.push({ signal: 'shopify', label: 'Price band, low to high', value: `${fmtPrice(band.min)} to ${fmtPrice(band.max)}`, source: 'products.json' });
    }
    // The median is what seeds the calculator, so a rendered Profit Gap binds it on its own.
    if (band && band.median != null && (pgSeeded || citedAmount(haysShopify, band.median))) {
      rest.push({ signal: 'shopify', label: 'Median price', value: fmtPrice(band.median), source: 'products.json' });
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
    paidLines.push({ signal: 'ads.meta', label: 'Meta Ad Library', value: 'no active ads', source: 'meta ad library', none: true });
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
          .cedt-sig-avatar { width: 58px !important; height: 58px !important; border-radius: 16px !important; }
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
                style={{ width: 44, height: 44, objectFit: 'cover', objectPosition: '48% 18%', borderRadius: 12, border: `1px solid ${ink}1f` }}
              />
              <div>
                <div className="font-bold" style={{ color: ink }}>Mattan Danino</div>
                <div className="text-[0.72rem] uppercase tracking-[0.18em]" style={{ color: ink, opacity: 0.55 }}>CEO, RISE DTC</div>
              </div>
            </div>
            <p className="mt-2 text-[0.95rem] leading-relaxed" style={{ color: ink, opacity: 0.7 }}>
              My team ran this scan on {companyName}'s public data. The call puts your live Shopify and ad numbers next to it.
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
                      {chip}
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
                      {chip}
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

              return (
                <article
                  key={i}
                  className="grid lg:grid-cols-12 gap-y-4 lg:gap-x-12 items-start"
                  style={variant === 'lead' ? undefined : { borderTop: `1px solid ${ink}14`, paddingTop: '2.5rem' }}
                >
                  <div className="lg:col-span-9">
                    {content}
                    {plate}
                  </div>
                  {marginAside}
                </article>
              );
            })}
          </div>
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
            From week one we run this on live Shopify and ad data. On the call Mattan walks this exact page with you and runs the Profit Gap on your real CAC and margins.
          </p>

          <div className="my-8 text-left p-6 sm:p-7" style={{ border: '1px solid rgba(255,255,255,.2)', borderRadius: 4 }}>
            <div className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: 'rgba(255,255,255,.6)' }}>How RISE charges</div>
            <p className="mt-4 text-[1rem] leading-relaxed" style={{ color: 'rgba(255,255,255,.85)' }}>
              Growth Model. Base from $2,000 per month plus a percentage of ad spend, senior strategist included.
            </p>
            <p className="mt-3 text-[1rem] leading-relaxed" style={{ color: 'rgba(255,255,255,.85)' }}>
              Performance Model, for qualifying brands only. Low or $0 base fee. RISE earns a share of net growth above an agreed baseline, typically 20%, measured in your own ad account and Shopify. No growth above the baseline means no performance fee.
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
              style={{ width: 66, height: 66, objectFit: 'cover', objectPosition: '48% 18%', borderRadius: 18, border: '1px solid rgba(255,255,255,.18)', flexShrink: 0 }}
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
