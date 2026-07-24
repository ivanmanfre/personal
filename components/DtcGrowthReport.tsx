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
import React, { useState } from 'react';
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

function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

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
  bookingUrl,
}: {
  seedAov: number | null;
  sourceNote: string;
  accent: string;
  ink: string;
  surface: string;
  headingFont: string;
  bookingUrl: string;
}) {
  const [aov, setAov] = useState(seedAov ?? 68);
  const [cogsPct, setCogsPct] = useState(35);
  const [returnsPct, setReturnsPct] = useState(8);
  const [shipping, setShipping] = useState(6);
  const [procPct, setProcPct] = useState(2.9);
  const [cac, setCac] = useState(28);

  const returnsRate = returnsPct / 100;
  const cogsRate = cogsPct / 100;
  const procFrac = procPct / 100;
  const contribution = (1 - returnsRate) * aov * (1 - cogsRate) - shipping - (procFrac * aov + 0.3);
  const profitPerOrder = contribution - cac;

  const sliders: Array<{ key: string; label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; fmt: (v: number) => string }> = [
    { key: 'aov', label: 'AOV', value: aov, set: setAov, min: 10, max: 300, step: 1, fmt: (v) => fmtMoney(v) },
    { key: 'cogs', label: 'COGS', value: cogsPct, set: setCogsPct, min: 5, max: 80, step: 1, fmt: (v) => `${v}%` },
    { key: 'returns', label: 'Returns', value: returnsPct, set: setReturnsPct, min: 0, max: 40, step: 1, fmt: (v) => `${v}%` },
    { key: 'shipping', label: 'Shipping', value: shipping, set: setShipping, min: 0, max: 30, step: 0.5, fmt: (v) => fmtMoney(v) },
    { key: 'proc', label: 'Processing', value: procPct, set: setProcPct, min: 1, max: 6, step: 0.1, fmt: (v) => `${v.toFixed(1)}%` },
    { key: 'cac', label: 'CAC', value: cac, set: setCac, min: 0, max: 150, step: 1, fmt: (v) => fmtMoney(v) },
  ];

  const profitNegative = profitPerOrder < 0;

  return (
    <section aria-label="The Profit Gap" style={{ background: ink, color: surface }}>
      <div className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-20 sm:py-28">
        <div className="flex items-center gap-3 mb-8">
          <span className="h-px w-10" style={{ background: accent }} />
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: accent }}>Profit per order</span>
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
              This is the first number RISE looks at. Revenue can hold while contribution profit
              slips underneath it. Type your real numbers over the public seed and watch the real
              profit per order move.
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
              <div className="mt-4 inline-flex items-center gap-2.5 rounded-full px-4 py-2" style={{ border: `1px solid ${surface}33` }} data-calc="1">
                <span className="text-[0.8rem] uppercase tracking-[0.16em]" style={{ color: surface, opacity: 0.7 }} data-calc="1">Contribution per order</span>
                <span className="text-[1.0625rem] font-bold tabular-nums" style={{ color: surface }} data-calc="1">{fmtMoney(contribution)}</span>
              </div>
            </div>
          </div>

          {/* Right: the editable inputs */}
          <div className="lg:col-span-5" data-calc="1">
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
            <p className="mt-4 text-[0.85rem] leading-relaxed" style={{ color: surface, opacity: 0.55 }}>
              {clean(sourceNote)}
            </p>
          </div>
        </div>

        <div className="mt-14 flex flex-col sm:flex-row sm:items-center gap-4">
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-[0.95rem] font-bold transition-transform hover:-translate-y-0.5"
            style={{ background: accent, color: ink }}
          >
            See it on your real numbers
          </a>
          <span className="text-[0.95rem]" style={{ color: surface, opacity: 0.6 }}>
            A live look picks up the inputs a public scan cannot reach.
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

  // Stat band: proof-of-work numerals, each source-gated on status === 'present' and a real
  // value. Blocked/absent/error contributes nothing. Renders ONLY when >= 2 stats qualify.
  const statBand: { value: string; label: string }[] = [];
  const adsMeta = d.ads?.meta;
  if (adsMeta?.status === 'present' && adsMeta.data) {
    const a = adsMeta.data;
    if (typeof a.active_ad_count === 'number' && a.active_ad_count > 0)
      statBand.push({ value: a.active_ad_count.toLocaleString('en-US'), label: 'active Meta ads' });
    if (typeof a.oldest_active_run_days === 'number' && a.oldest_active_run_days > 0)
      statBand.push({ value: a.oldest_active_run_days.toLocaleString('en-US'), label: 'days your oldest ad has been running' });
    if (typeof a.distinct_angles === 'number' && a.distinct_angles > 1)
      statBand.push({ value: a.distinct_angles.toLocaleString('en-US'), label: 'creative angles live' });
  }
  const shop = d.shopify;
  if (shop?.status === 'present' && shop.data) {
    const s = shop.data;
    if (typeof s.catalog_size === 'number' && s.catalog_size > 0)
      statBand.push({ value: s.catalog_size.toLocaleString('en-US'), label: 'products in the catalog' });
    if (typeof s.oos_pct === 'number' && s.oos_pct > 0)
      statBand.push({ value: `${s.oos_pct}%`, label: 'of variants out of stock' });
  }
  const showStatBand = statBand.length >= 2;

  const thinRead = findings.length === 0;

  const findingVariant = (i: number): 'lead' | 'split' | 'offset' => (['lead', 'split', 'offset'] as const)[i % 3];

  return (
    <div style={{ background: surface, color: ink, fontFamily: bodyFont, minHeight: '100vh' }}>
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          .cedt-anim { transition: none !important; }
        }
      `}</style>

      {/* Masthead */}
      <header style={{ borderBottom: `1px solid ${ink}14` }}>
        <div className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-4 flex items-center justify-between gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={wordmark} className="h-6 sm:h-7 w-auto" />
          ) : (
            <span className="font-extrabold text-lg tracking-tight" style={{ fontFamily: headingFont, color: ink }}>{wordmark}</span>
          )}
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-[0.72rem] uppercase tracking-[0.22em]" style={{ color: ink, opacity: 0.55 }}>Growth Scan · Confidential</span>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cedt-anim text-[0.85rem] font-bold px-4 py-2 rounded-full whitespace-nowrap transition-transform hover:-translate-y-0.5"
              style={{ background: accent, color: ink }}
            >
              Book a call
            </a>
          </div>
        </div>
      </header>

      {/* Chapter — Cover / hook */}
      <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 pt-16 sm:pt-24 pb-14">
        <div className="grid lg:grid-cols-12 gap-y-8 lg:gap-x-12 items-end">
          <div className="lg:col-span-9">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-px w-10" style={{ background: accent }} />
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
            <div className="text-[0.95rem] leading-relaxed" style={{ color: ink, opacity: 0.7 }}>
              <div className="font-bold" style={{ color: ink, opacity: 1 }}>Prepared by {wordmark}</div>
              <div className="mt-1">A growth read of {companyName}'s store and the levers that move it.</div>
              {credibilityLine ? (
                <div className="mt-3 text-[0.8rem] leading-relaxed" style={{ color: ink, opacity: 0.55 }}>{credibilityLine}</div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Chapter — The store, in numbers (proof-of-work stat band; renders only with >= 2 stats) */}
      {showStatBand ? (
        <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 pb-16">
          <div className="flex items-center gap-3 mb-10">
            <span className="h-px w-10" style={{ background: accent }} />
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>
              The store, in numbers
            </span>
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-12">
            {statBand.map((s, i) => (
              <div key={i} className="basis-[calc(50%-1.25rem)] sm:basis-auto sm:flex-1 sm:min-w-[150px] sm:max-w-[240px]">
                <div
                  className="font-extrabold tabular-nums leading-none tracking-[-0.03em]"
                  style={{ fontFamily: headingFont, fontSize: 'clamp(2.75rem, 6vw, 4.5rem)', color: ink }}
                >
                  {s.value}
                </div>
                <div className="mt-3 text-[0.72rem] font-semibold uppercase tracking-[0.16em] leading-snug" style={{ color: ink, opacity: 0.55 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Chapter — Where the growth is (findings, worst-first, varied rhythm) */}
      {findings.length > 0 ? (
        <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-16" style={{ borderTop: `1px solid ${ink}14` }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px w-10" style={{ background: accent }} />
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
                  style={{ border: `1px solid ${accent}`, color: ink }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                  {LEVER_LABEL[f.lever] || f.lever}
                </span>
              );
              const sourceLink = f.source_url ? (
                <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-[0.85rem] font-semibold underline underline-offset-4" style={{ color: ink, opacity: 0.6 }}>
                  read from your store
                </a>
              ) : null;

              if (variant === 'lead') {
                // Lead / worst-first: pull-quote spread, biggest scale.
                return (
                  <article key={i} className="grid lg:grid-cols-12 gap-y-5 lg:gap-x-12">
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
                  </article>
                );
              }

              if (variant === 'split') {
                return (
                  <article key={i} className="grid lg:grid-cols-12 gap-y-4 lg:gap-x-12 items-start" style={{ borderTop: `1px solid ${ink}14`, paddingTop: '2.5rem' }}>
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
                  </article>
                );
              }

              // offset: narrower measure, pushed right, card treatment.
              return (
                <article key={i} className="grid lg:grid-cols-12 gap-y-4" style={{ borderTop: `1px solid ${ink}14`, paddingTop: '2.5rem' }}>
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
              <span className="h-px w-10" style={{ background: accent }} />
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
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cedt-anim inline-flex mt-8 items-center rounded-full px-6 py-3 text-[0.95rem] font-bold transition-transform hover:-translate-y-0.5"
              style={{ background: accent, color: ink }}
            >
              Book a call
            </a>
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
          bookingUrl={bookingUrl}
        />
      ) : null}

      {/* Chapter — Rise close */}
      <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-20" style={{ borderTop: `1px solid ${ink}14` }}>
        <div className="grid lg:grid-cols-12 gap-y-8 lg:gap-x-12 items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-px w-10" style={{ background: accent }} />
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>The next step</span>
            </div>
            <h2 className="font-extrabold tracking-[-0.02em]" style={{ fontFamily: headingFont, fontSize: 'clamp(2rem, 4.6vw, 3.25rem)', color: ink, lineHeight: 1.03 }}>
              How RISE runs growth
            </h2>
            <p className="mt-6 max-w-xl text-[1.2rem] leading-relaxed" style={{ color: ink, opacity: 0.8 }}>
              Paid media and performance creative that compound, plus a Financial Health view that tracks
              contribution profit on every order. A live look picks up what a public scan cannot reach.
            </p>

            {/* How RISE charges: $0 base fee, pure performance basis. Sub-strip near the CTA. */}
            <div className="mt-8 inline-flex max-w-xl flex-col gap-2 rounded-2xl px-5 py-4" style={{ border: `1px solid ${ink}1f` }}>
              <div className="flex items-center gap-2.5">
                <span className="h-px w-8" style={{ background: accent }} />
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]" style={{ color: ink, opacity: 0.7 }}>How RISE charges</span>
              </div>
              <p className="text-[1.0625rem] font-semibold leading-snug" style={{ color: ink }}>
                $0 base fee. We work on a pure performance basis, so a growth read costs you nothing.
              </p>
            </div>
          </div>
          <div className="lg:col-span-4 lg:text-right">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="cedt-anim inline-flex items-center rounded-full px-6 py-3 text-[0.95rem] font-bold transition-transform hover:-translate-y-0.5"
              style={{ background: accent, color: ink }}
            >
              Book a call
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-12" style={{ borderTop: `1px solid ${ink}14` }}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt={wordmark} className="h-5 w-auto opacity-70" />
          ) : (
            <span className="font-bold" style={{ fontFamily: headingFont, color: ink, opacity: 0.7 }}>{wordmark}</span>
          )}
          <p className="text-[0.85rem]" style={{ color: ink, opacity: 0.55 }}>
            Prepared for {companyName} · confidential
          </p>
        </div>
      </footer>

      {/* Sticky mini-CTA — kills the mid-page CTA-free gap the baseline had at 90% of height */}
      <a
        href={bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="cedt-anim fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full px-5 py-3 text-[0.85rem] font-bold shadow-lg transition-transform hover:-translate-y-0.5"
        style={{ background: accent, color: ink, boxShadow: `0 8px 30px ${ink}26` }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: ink }} />
        Book a call
      </a>
    </div>
  );
}
