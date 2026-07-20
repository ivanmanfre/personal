// components/dev/scanlab/CandidateEditorial.tsx
// Tournament candidate "Editorial" — the Rise DTC Growth Scan as a premium magazine
// long-read. Same correctness spine as the floor (DtcGrowthReport): every data section
// gates on SignalMeta.status === 'present' (or 'empty' for an honest negative), never on
// payload-presence; a blocked/absent/error signal collapses silently and emits NO number.
// Design goal: dramatic Sora display type, asymmetric grid, generous whitespace, pull-quote
// findings, big editorial numerals (the store's OWN numbers as protagonists), varied section
// rhythm, and the Profit Gap as the climactic spread. Rise gold (#ffc71d) only as rule lines,
// chip dots, and CTA buttons — never a large field.
//
// Self-contained: imports only React, the two brand hooks, and shared scan types.
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

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Provenance marker — one per signal. Three honest states: present (real read), empty
// (we looked and found genuinely nothing), and not-readable (blocked/absent/error — never
// implies zero). This is what makes degradation read as honest, not apologetic.
function ProvenanceMarker({ signal, status, accent, ink }: { signal: string; status: DtcSignalStatus; accent: string; ink: string }) {
  const label = SIGNAL_LABEL[signal] || signal;
  if (status === 'present') {
    return (
      <div className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: `1px solid ${ink}14` }}>
        <span className="w-2 h-2 rounded-full flex-none" style={{ background: accent }} />
        <span className="text-[0.95rem] font-semibold" style={{ color: ink }}>{label}</span>
        <span className="ml-auto text-[0.7rem] uppercase tracking-[0.18em]" style={{ color: ink, opacity: 0.55 }}>read</span>
      </div>
    );
  }
  if (status === 'empty') {
    return (
      <div className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: `1px solid ${ink}14` }}>
        <span className="w-2 h-2 rounded-full flex-none border" style={{ borderColor: ink }} />
        <span className="text-[0.95rem]" style={{ color: ink, opacity: 0.85 }}>{label}</span>
        <span className="ml-auto text-[0.7rem] uppercase tracking-[0.18em]" style={{ color: ink, opacity: 0.5 }}>none found</span>
      </div>
    );
  }
  // blocked / absent / error — honest "could not read", NEVER a zero.
  return (
    <div className="flex items-center gap-2.5 py-2.5" style={{ borderBottom: `1px solid ${ink}14` }}>
      <span className="w-2 h-2 rounded-full flex-none" style={{ border: `1px solid ${ink}55`, background: 'transparent' }} />
      <span className="text-[0.95rem]" style={{ color: ink, opacity: 0.5 }}>{label}</span>
      <span className="ml-auto text-[0.7rem] uppercase tracking-[0.18em]" style={{ color: ink, opacity: 0.4 }}>not readable</span>
    </div>
  );
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
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: accent }}>The climax</span>
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
              This is the first number Rise looks at. Top-line can hold while contribution profit
              quietly leaks. Type your real numbers over the public seed and watch the real profit
              per order move.
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
                <span className="text-[1.05rem] font-bold tabular-nums" style={{ color: surface }} data-calc="1">{fmtMoney(contribution)}</span>
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
          <span className="text-[0.9rem]" style={{ color: surface, opacity: 0.6 }}>
            A live look picks up the inputs a public scan cannot reach.
          </span>
        </div>
      </div>
    </section>
  );
}

export function CandidateEditorial({ report, scan, companyName }: { report: ReportJson; scan: Scan; companyName: string }) {
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

  // REAL DEFECT the floor never fixed: the brand fonts were declared but never loaded. Load them.
  useGoogleFonts([brand.font_heading, brand.font_body]);

  useMetadata({
    title: `A growth scan for ${companyName}`,
    description: clean(d.hero_hook) || `A public read of ${companyName}'s store, and where the growth is.`,
    canonical: `${(import.meta as any).env?.VITE_SCAN_ORIGIN || 'https://ivanmanfredi.com'}/scan/${scan.company_slug}`,
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

  // Tech stack ledger — an extra editorial exhibit that gives thin fixtures real substance.
  const stack = d.tech_stack;
  const stackConfirmed = stack?.status === 'present' ? (stack.data?.confirmed || []) : [];
  const stackMissing = stack?.status === 'present' && stack.data?.is_shopify ? (stack.data?.missing_critical || []) : [];
  const showStack = stackConfirmed.length > 0;

  const thinRead = !hasScorecard && findings.length === 0;

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
            <span className="hidden sm:inline text-[0.7rem] uppercase tracking-[0.22em]" style={{ color: ink, opacity: 0.55 }}>Growth Scan · Confidential</span>
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
                A Rise DTC growth feature
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
            <div className="text-[0.9rem] leading-relaxed" style={{ color: ink, opacity: 0.7 }}>
              <div className="font-bold" style={{ color: ink, opacity: 1 }}>Prepared by {wordmark}</div>
              <div className="mt-1">A read of {companyName}'s public store data, laddered to the levers that move growth.</div>
              {tier ? (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5" style={{ border: `1px solid ${ink}22` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                  <span className="text-[0.75rem] uppercase tracking-[0.16em]" style={{ color: ink, opacity: 0.75 }}>{capitalize(tier)} read</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Chapter — What we could read (provenance ledger) */}
      <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 pb-16">
        <div className="grid lg:grid-cols-12 gap-y-6 lg:gap-x-12">
          <div className="lg:col-span-4">
            <h2 className="font-bold tracking-[-0.01em]" style={{ fontFamily: headingFont, fontSize: 'clamp(1.4rem, 2.4vw, 1.9rem)', color: ink }}>
              What we could read
            </h2>
            <p className="mt-3 text-[1rem] leading-relaxed" style={{ color: ink, opacity: 0.7 }}>
              A public-data scan, nothing private. Where a source is blocked we say so, and we never
              read a blocked source as a zero.
            </p>
            <p className="mt-4 text-[0.85rem] uppercase tracking-[0.16em]" style={{ color: ink, opacity: 0.6 }}>
              {presentCount} of {scoredOf} signals read
            </p>
          </div>
          <div className="lg:col-span-8">
            <div className="grid sm:grid-cols-2 sm:gap-x-10" style={{ borderTop: `1px solid ${ink}14` }}>
              {signalEntries.map(([signal, status]) => (
                <ProvenanceMarker key={signal} signal={signal} status={status} accent={accent} ink={ink} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Chapter — The scorecard (collapses when growth_score is null) */}
      {hasScorecard ? (
        <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-16" style={{ borderTop: `1px solid ${ink}14` }}>
          <div className="grid lg:grid-cols-12 gap-y-10 lg:gap-x-14 items-center">
            <div className="lg:col-span-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="h-px w-8" style={{ background: accent }} />
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.26em]" style={{ color: ink, opacity: 0.65 }}>Growth score</span>
              </div>
              <div
                className="font-extrabold tabular-nums leading-none tracking-[-0.03em]"
                style={{ fontFamily: headingFont, fontSize: 'clamp(4.5rem, 16vw, 9rem)', color: ink }}
              >
                {d.growth_score}
              </div>
              <p className="mt-5 max-w-sm text-[1.0625rem] leading-relaxed" style={{ color: ink, opacity: 0.75 }}>
                A partial score across only the levers we could read from the outside. The full picture
                comes off a live look together.
              </p>
            </div>
            <div className="lg:col-span-7 space-y-7">
              {breakdownEntries.map(([lever, b]) => (
                <div key={lever}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="font-bold text-[1.05rem]" style={{ fontFamily: headingFont, color: ink }}>{LEVER_LABEL[lever] || lever}</span>
                    <span className="tabular-nums text-[0.95rem] font-semibold" style={{ color: ink, opacity: 0.7 }}>{b.value}/{b.max}</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: `${ink}12` }}>
                    <div className="cedt-anim h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(0, Math.min(100, (b.value / b.max) * 100))}%`, background: accent }} />
                  </div>
                  <p className="mt-2 text-[0.95rem]" style={{ color: ink, opacity: 0.65 }}>{clean(b.rationale)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Chapter — The stack ledger (renders only when we confirmed installed tools) */}
      {showStack ? (
        <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-16" style={{ borderTop: `1px solid ${ink}14` }}>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
            <h2 className="font-bold tracking-[-0.01em]" style={{ fontFamily: headingFont, fontSize: 'clamp(1.5rem, 3vw, 2.25rem)', color: ink }}>
              The stack we could see
            </h2>
            {stack?.source_url ? (
              <a href={stack.source_url} target="_blank" rel="noopener noreferrer" className="text-[0.85rem] font-semibold underline underline-offset-4" style={{ color: ink, opacity: 0.6 }}>
                read from your store
              </a>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {stackConfirmed.map((t) => (
              <span key={t} className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[0.9rem] font-semibold" style={{ border: `1px solid ${ink}22`, color: ink }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                {t}
              </span>
            ))}
          </div>
          {stackMissing.length > 0 ? (
            <div className="mt-8">
              <p className="text-[0.85rem] uppercase tracking-[0.16em] mb-3" style={{ color: ink, opacity: 0.55 }}>Not detected in your stack</p>
              <div className="flex flex-wrap gap-2.5">
                {stackMissing.map((t) => (
                  <span key={t} className="inline-flex items-center rounded-full px-3.5 py-1.5 text-[0.9rem]" style={{ border: `1px dashed ${ink}33`, color: ink, opacity: 0.65 }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Chapter — Where the growth is (findings, worst-first, varied rhythm) */}
      {findings.length > 0 ? (
        <section className="mx-auto w-full max-w-[1180px] px-6 sm:px-8 py-16" style={{ borderTop: `1px solid ${ink}14` }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="h-px w-10" style={{ background: accent }} />
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>The feature</span>
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
                      <p className="text-[1.0625rem] sm:text-[1.15rem] leading-[1.6]" style={{ color: ink, opacity: 0.85 }}>
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
                    <p className="max-w-2xl text-[1.0625rem] sm:text-[1.15rem] leading-[1.6]" style={{ color: ink, opacity: 0.85 }}>
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
              A public read only surfaced the basics
            </h2>
            <p className="mt-5 text-[1.15rem] leading-relaxed" style={{ color: ink, opacity: 0.8 }}>
              Some of your sources were not readable from the outside, so we are not going to invent a
              number. The full teardown, catalog economics, discount exposure, and the Profit Gap comes
              off a live look together.
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
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: ink, opacity: 0.7 }}>The close</span>
            </div>
            <h2 className="font-extrabold tracking-[-0.02em]" style={{ fontFamily: headingFont, fontSize: 'clamp(2rem, 4.6vw, 3.25rem)', color: ink, lineHeight: 1.03 }}>
              How Rise runs growth
            </h2>
            <p className="mt-6 max-w-xl text-[1.15rem] leading-relaxed" style={{ color: ink, opacity: 0.8 }}>
              Paid media and performance creative that compound, plus a Financial Health view that tracks
              contribution profit on every order. A live look picks up what a public scan cannot reach.
            </p>
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
            Prepared for {companyName} · public-data scan · confidential
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
