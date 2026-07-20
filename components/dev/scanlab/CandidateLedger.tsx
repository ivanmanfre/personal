// components/dev/scanlab/CandidateLedger.tsx
// Tournament candidate — DIRECTION: Brutalist receipt-ledger.
//
// The scan rendered as an itemized accounting of where the prospect's profit is going.
// A printed ledger blown up to editorial scale: thick ruled lines, every section an
// itemized entry (label left, THE number right in huge tabular Sora), a running
// "subtotal" of what was read (completeness.present_count/scored_of only — never summed),
// findings as debit-style line items with their key numeral pulled to the ledger column
// at display scale, the Profit Gap as the BOTTOM LINE — the heaviest, gold-highlighted,
// double-ruled invoice total.
//
// Correctness spine preserved verbatim from DtcGrowthReport: every entry gates on
// SignalMeta.status === 'present' (or 'empty' for an honest negative). blocked/absent/error
// emit NO number, NO placeholder, NO zero — a ledger line with a fabricated zero is the
// cardinal sin. Self-contained; no import from the floor component.
import React, { useState } from 'react';
import { useMetadata } from '../../../hooks/useMetadata';
import { useGoogleFonts } from '../../../hooks/useGoogleFonts';
import type { ReportJson, Scan, DtcSignalStatus } from '../../../lib/scanTypes';

const LEVER_LABEL: Record<string, string> = {
  paid_media: 'Paid media',
  performance_creative: 'Performance creative',
  profit_visibility: 'Profit visibility',
  cro: 'Conversion',
};

const SIGNAL_LABEL: Record<string, string> = {
  shopify: 'Shopify catalog',
  'ads.meta': 'Meta ads',
  tech_stack: 'Tech stack',
  reviews: 'Reviews',
  pagespeed: 'Page speed',
  signup: 'Email capture',
};

function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Kill em-dashes / en-dashes in any DATA-derived string before it renders (the fixtures
// carry U+2014 inside evidence + source_note). Replacing the dash with a comma touches
// NO numeral, so every figure stays verbatim; the em-dash gate stays clean.
function clean(s: string): string {
  return (s || '').replace(/\s*[—–]\s*/g, ', ');
}

// Pull the finding's key numeral into the ledger column. Returns the FIRST numeric token
// verbatim from the evidence string (findings are written number-first), or null when the
// finding carries no numeral — in which case NO figure is fabricated for the ledger column.
function firstFigure(s: string): string | null {
  const m = (s || '').match(/\$?\d[\d,]*(?:\.\d+)?%?/);
  return m ? m[0] : null;
}

// ── One itemized ledger line: label hard-left, THE number hard-right at display scale.
// Stacks label-over-number at 390 so alignment never breaks and nothing overflows.
function LedgerLine({
  kicker,
  label,
  figure,
  ink,
  scale = 'md',
}: {
  kicker?: string;
  label: string;
  figure: string | null;
  ink: string;
  scale?: 'sm' | 'md' | 'lg';
}) {
  const figCls =
    scale === 'lg'
      ? 'text-[3.5rem] sm:text-8xl'
      : scale === 'md'
      ? 'text-[3rem] sm:text-7xl'
      : 'text-[2.25rem] sm:text-5xl';
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
      <div className="min-w-0">
        {kicker ? (
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.14em] opacity-70" style={{ color: ink }}>
            {kicker}
          </div>
        ) : null}
        <div className="text-base sm:text-lg font-semibold leading-snug break-words" style={{ color: ink }}>
          {label}
        </div>
      </div>
      {figure ? (
        <div
          className={`${figCls} font-extrabold leading-[0.9] tabular-nums shrink-0 sm:text-right`}
          style={{ color: ink }}
        >
          {figure}
        </div>
      ) : null}
    </div>
  );
}

// ── Sources subtotal row: one honest status token per signal. Gold dot ONLY on a read
// signal; hollow on an honest 'none found'; faint on 'not readable' (blocked/absent/error).
// A not-readable source NEVER emits a number — it lives only here, as a status.
function SourceRow({ signal, status, accent, ink }: { signal: string; status: DtcSignalStatus; accent: string; ink: string }) {
  const label = SIGNAL_LABEL[signal] || signal;
  let token = 'Not readable';
  let dot: React.CSSProperties = { border: `1.5px solid ${ink}`, opacity: 0.35 };
  let rowOpacity = 0.5;
  if (status === 'present') {
    token = 'Read';
    dot = { background: accent };
    rowOpacity = 1;
  } else if (status === 'empty') {
    token = 'None found';
    dot = { border: `1.5px solid ${ink}` };
    rowOpacity = 0.85;
  }
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: `1px dotted ${ink}40`, opacity: rowOpacity }}
    >
      <span className="flex items-center gap-2.5 text-base font-medium" style={{ color: ink }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={dot} />
        {label}
      </span>
      <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: ink }}>
        {token}
      </span>
    </div>
  );
}

function ProfitGapBottomLine({
  seedAov,
  sourceNote,
  accent,
  ink,
  headingFont,
  bookingUrl,
}: {
  seedAov: number | null;
  sourceNote: string;
  accent: string;
  ink: string;
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

  return (
    <section className="mx-auto max-w-4xl px-5 sm:px-8 py-16" style={{ borderTop: `4px solid ${ink}` }}>
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em]" style={{ color: ink }}>
        The bottom line
      </div>
      <h2 className="text-3xl sm:text-5xl font-extrabold leading-[1.02] mb-3" style={{ fontFamily: headingFont, color: ink }}>
        Your Profit Gap, self-computed
      </h2>
      <p className="text-base sm:text-lg leading-relaxed max-w-2xl mb-10" style={{ color: ink, opacity: 0.82 }}>
        Type your real numbers over the public seed. This is the first line Rise reads, contribution
        profit on a single order. {clean(sourceNote)}
      </p>

      {/* Inputs — every displayed numeral is user-editable by design → data-calc="1". */}
      <div className="grid sm:grid-cols-2 gap-x-10 gap-y-6 mb-12">
        {sliders.map((s) => (
          <label key={s.key} className="block">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: ink }}>{s.label}</span>
              <span data-calc="1" className="text-xl font-extrabold tabular-nums" style={{ fontFamily: headingFont, color: ink }}>
                {s.fmt(s.value)}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={s.value}
              onChange={(e) => s.set(Number(e.target.value))}
              className="w-full motion-reduce:transition-none"
              style={{ accentColor: accent }}
              aria-label={s.label}
            />
          </label>
        ))}
      </div>

      {/* Contribution line — plain ledger row. */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6 pb-6" style={{ borderBottom: `1px solid ${ink}33` }}>
        <span className="text-base sm:text-lg font-semibold" style={{ color: ink }}>Contribution per order</span>
        <span data-calc="1" className="text-4xl sm:text-5xl font-extrabold tabular-nums leading-none" style={{ fontFamily: headingFont, color: ink }}>
          {fmtMoney(contribution)}
        </span>
      </div>

      {/* THE TOTAL — invoice bottom-line: gold field, ink text, double-rule box, heaviest moment. */}
      <div className="mt-6" style={{ border: `4px double ${ink}`, background: accent }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between px-6 sm:px-9 py-8">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: ink }}>Bottom line</div>
            <div className="text-base sm:text-lg font-semibold mt-1" style={{ color: ink }}>Profit per order, after CAC</div>
          </div>
          <div data-calc="1" className="text-[3.5rem] sm:text-8xl font-extrabold tabular-nums leading-[0.85] sm:text-right" style={{ fontFamily: headingFont, color: ink }}>
            {fmtMoney(profitPerOrder)}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-bold px-6 py-3 motion-reduce:transition-none"
          style={{ background: accent, color: ink, border: `2px solid ${ink}` }}
        >
          Pressure-test this number with Rise
        </a>
      </div>
    </section>
  );
}

export function CandidateLedger({ report, scan, companyName }: { report: ReportJson; scan: Scan; companyName: string }) {
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
  const wordmark = brand.wordmark || 'Rise DTC';

  // Load the prospect-brand fonts the floor never loaded (real defect fixed here).
  useGoogleFonts([brand.font_heading, brand.font_body]);

  // Per-scan share metadata — prefix "A growth scan for " is load-bearing for prerender.
  useMetadata({
    title: `A growth scan for ${companyName}`,
    description: d.hero_hook || `A public read of ${companyName}'s store, and where the growth is.`,
    canonical: `${(import.meta as { env?: Record<string, string | undefined> }).env?.VITE_SCAN_ORIGIN || 'https://ivanmanfredi.com'}/scan/${scan.company_slug}`,
    ogImage: d.og_image_url || undefined,
    noindex: true,
  });

  const signalEntries = Object.entries(d.completeness?.signals || {}) as [string, DtcSignalStatus][];
  const presentCount = d.completeness?.present_count ?? 0;
  const scoredOf = d.completeness?.scored_of ?? 0;
  const tier = d.completeness?.tier;

  const hasScorecard = d.growth_score != null;
  const breakdownEntries = Object.entries(d.score_breakdown || {});

  const findings = d.findings || [];
  const pg = d.profit_gap;

  const ctaBtn = (labelText: string, filled = true) => (
    <a
      href={bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block text-sm font-bold px-6 py-3 whitespace-nowrap motion-reduce:transition-none"
      style={filled ? { background: accent, color: ink, border: `2px solid ${ink}` } : { color: ink, border: `2px solid ${ink}` }}
    >
      {labelText}
    </a>
  );

  return (
    <div style={{ background: surface, color: ink, fontFamily: bodyFont, minHeight: '100vh' }}>
      {/* 1. Ledger header — thick baseline rule, Rise chrome, a CTA up top. */}
      <header style={{ borderBottom: `3px solid ${ink}` }}>
        <div className="mx-auto max-w-4xl px-5 sm:px-8 py-4 flex items-center justify-between gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={wordmark} className="h-6 sm:h-7 w-auto" />
          ) : (
            <span className="font-extrabold text-lg" style={{ fontFamily: headingFont, color: ink }}>{wordmark}</span>
          )}
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-xs font-bold uppercase tracking-[0.18em]" style={{ color: ink, opacity: 0.6 }}>
              Growth Ledger · Confidential
            </span>
            {ctaBtn('Book a call')}
          </div>
        </div>
      </header>

      {/* 2. Masthead — statement header, company name at display scale, the money hook. */}
      <section className="mx-auto max-w-4xl px-5 sm:px-8 pt-14 pb-10">
        <div className="text-xs font-bold uppercase tracking-[0.22em] mb-4" style={{ color: ink, opacity: 0.65 }}>
          Growth Ledger · Prepared for
        </div>
        <h1 className="text-4xl sm:text-7xl font-extrabold leading-[0.98] tracking-tight break-words" style={{ fontFamily: headingFont, color: ink }}>
          {companyName}
        </h1>
        <p className="mt-6 text-xl sm:text-2xl font-semibold leading-snug max-w-3xl" style={{ color: ink }}>
          {clean(d.hero_hook)}
        </p>
      </section>

      {/* 3. Sources read — the honesty spine, as an itemized subtotal. */}
      <section className="mx-auto max-w-4xl px-5 sm:px-8 pb-12" style={{ borderTop: `1px solid ${ink}22` }}>
        <div className="pt-10 mb-1 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: ink }}>
          Sources read
        </div>
        <div className="mt-4">
          {signalEntries.map(([signal, status]) => (
            <SourceRow key={signal} signal={signal} status={status} accent={accent} ink={ink} />
          ))}
        </div>
        {/* Running subtotal — the ONLY count that may render: signals read (verbatim from data). */}
        <div className="mt-5 pt-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-6" style={{ borderTop: `3px double ${ink}` }}>
          <span className="text-base sm:text-lg font-bold uppercase tracking-[0.1em]" style={{ color: ink }}>
            Signals read{tier ? ` · ${capitalize(tier)}` : ''}
          </span>
          <span className="text-4xl sm:text-6xl font-extrabold tabular-nums leading-none" style={{ fontFamily: headingFont, color: ink }}>
            {presentCount} / {scoredOf}
          </span>
        </div>
      </section>

      {/* 4. Growth score — a ledger line; collapses entirely when null. No fabricated /100. */}
      {hasScorecard ? (
        <section className="mx-auto max-w-4xl px-5 sm:px-8 py-12" style={{ borderTop: `4px solid ${ink}` }}>
          <div className="mb-6 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: ink }}>
            Growth score
          </div>
          <LedgerLine
            label={`Scored across the ${breakdownEntries.length === 1 ? 'lever' : 'levers'} we could read`}
            figure={String(d.growth_score)}
            ink={ink}
            scale="lg"
          />
          <div className="mt-10 space-y-6">
            {breakdownEntries.map(([lever, b]) => (
              <div key={lever}>
                <div className="flex items-baseline justify-between text-sm mb-2">
                  <span className="font-bold uppercase tracking-[0.1em]" style={{ color: ink }}>{LEVER_LABEL[lever] || lever}</span>
                  <span className="tabular-nums text-base font-extrabold" style={{ fontFamily: headingFont, color: ink }}>{b.value} / {b.max}</span>
                </div>
                <div className="h-2.5" style={{ background: `${ink}14` }}>
                  <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, (b.value / b.max) * 100))}%`, background: accent }} />
                </div>
                <p className="text-base mt-2" style={{ color: ink, opacity: 0.75 }}>{clean(b.rationale)}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 5. Line items — findings worst-first, each a debit-style entry, key numeral pulled
          to the ledger column at display scale. First (worst) item runs largest — pacing. */}
      <section className="mx-auto max-w-4xl px-5 sm:px-8 py-12" style={{ borderTop: `4px solid ${ink}` }}>
        <div className="mb-8 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: ink }}>
          Where the profit is going
        </div>
        {findings.length > 0 ? (
          <div>
            {findings.map((f, i) => {
              const fig = firstFigure(f.evidence);
              const scale = i === 0 ? 'lg' : i === 1 ? 'md' : 'sm';
              return (
                <div
                  key={i}
                  className="py-9 first:pt-0"
                  style={i === 0 ? undefined : { borderTop: `1px solid ${ink}22` }}
                >
                  <LedgerLine
                    kicker={LEVER_LABEL[f.lever] || f.lever}
                    label={f.title}
                    figure={fig}
                    ink={ink}
                    scale={scale}
                  />
                  <p className="text-base sm:text-lg leading-relaxed mt-4 max-w-2xl" style={{ color: ink, opacity: 0.82 }}>
                    {clean(f.evidence)}
                  </p>
                  {f.source_url ? (
                    <a
                      href={f.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 text-xs font-bold uppercase tracking-[0.12em] underline"
                      style={{ color: ink, opacity: 0.7 }}
                    >
                      Read from your store
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-base sm:text-lg leading-relaxed max-w-2xl" style={{ color: ink, opacity: 0.85 }}>
            A public read only surfaced the basics. The full teardown, every line item, comes off a live
            look at your store together.
          </p>
        )}
        {/* Mid-page CTA — kills the baseline's 90% CTA-free gap. */}
        <div className="mt-12 pt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ borderTop: `1px dotted ${ink}40` }}>
          <span className="text-base sm:text-lg font-semibold max-w-md" style={{ color: ink }}>
            A live look picks up what a public scan can't reach.
          </span>
          {ctaBtn('Book a call')}
        </div>
      </section>

      {/* 6. The bottom line — Profit Gap, heaviest moment; collapses when the seed is absent. */}
      {pg ? (
        <ProfitGapBottomLine
          seedAov={pg.seed_aov}
          sourceNote={pg.source_note}
          accent={accent}
          ink={ink}
          headingFont={headingFont}
          bookingUrl={bookingUrl}
        />
      ) : null}

      {/* 7. Close — Rise's own pitch + CTA. */}
      <section className="mx-auto max-w-4xl px-5 sm:px-8 py-16" style={{ borderTop: `4px solid ${ink}` }}>
        <div className="mb-3 text-xs font-bold uppercase tracking-[0.2em]" style={{ color: ink }}>
          How Rise runs growth
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold leading-[1.02] mb-4" style={{ fontFamily: headingFont, color: ink }}>
          Paid growth that compounds. Profit you can see.
        </h2>
        <p className="text-base sm:text-lg leading-relaxed max-w-2xl mb-8" style={{ color: ink, opacity: 0.82 }}>
          Paid media and performance creative that compound, plus a Financial Health view that tracks
          contribution profit on every order. The scan reads the outside; a live look reads the rest.
        </p>
        {ctaBtn('Book a call')}
      </section>

      {/* 8. Footer — invoice-style closing rule. */}
      <footer className="mx-auto max-w-4xl px-5 sm:px-8 py-12" style={{ borderTop: `4px double ${ink}` }}>
        <div className="mb-6">{ctaBtn('Book a call')}</div>
        <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: ink, opacity: 0.6 }}>
          Prepared for {companyName} · public-data scan · confidential
        </p>
      </footer>
    </div>
  );
}

export default CandidateLedger;
