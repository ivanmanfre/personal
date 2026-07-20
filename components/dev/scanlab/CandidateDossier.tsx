// components/dev/scanlab/CandidateDossier.tsx
// Tournament candidate "Dossier" — the Rise DTC Growth Scan rendered as a confidential
// analyst intelligence file compiled on the prospect's public store data.
//
// DIRECTION: classification-style masthead, a real source-log TABLE (the provenance strip
// elevated into a dossier's read/none-found/not-readable log), findings as numbered
// Exhibits with the key figure isolated LARGE in a data panel, and the Profit Gap as the
// dossier's climactic ASSESSMENT with the biggest data panel on the page. Monospace accents
// (IBM Plex Mono, already loaded) for labels/values/stamps against Sora display heads and
// Manrope body. Hairline rules organize everything; Rise gold only as stamp/accent/CTA.
//
// CORRECTNESS SPINE (preserved verbatim from the floor): every section gates on
// SignalMeta.status, never on payload-presence. blocked/absent/error emit NO number and NO
// placeholder — an unreadable source appears ONLY in the source log as "not readable".
import React, { useState } from 'react';
import { useMetadata } from '../../../hooks/useMetadata';
import { useGoogleFonts } from '../../../hooks/useGoogleFonts';
import type { ReportJson, Scan, DtcSignalStatus } from '../../../lib/scanTypes';

const MONO = "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace";

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

// Short, number-free descriptor of WHAT was read for each source. Never a store-fact.
const READ_FROM: Record<string, string> = {
  shopify: 'products.json',
  'ads.meta': 'Meta ad library',
  tech_stack: 'homepage source',
  reviews: 'product page',
  pagespeed: 'field data',
  signup: 'homepage',
};

const SIGNAL_ORDER = ['shopify', 'ads.meta', 'tech_stack', 'reviews', 'pagespeed', 'signup'];

function fmtMoney(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

// Strip em/en dashes from fixture prose (they violate the zero-em-dash gate) without touching
// any numeral — replace the dash-plus-spaces with a comma so grammar survives.
function clean(text: string): string {
  return (text || '').replace(/\s*(?:—|–|--)\s*/g, ', ');
}

// Pull the first real figure out of a finding's evidence so it can be isolated LARGE.
// It is always a verbatim substring of the fixture's own evidence string (which lives in the
// dtc JSON), so it can never introduce a fabricated numeral. Absent -> the panel drops the figure.
function keyFigure(text: string): string | null {
  const m = (text || '').match(/\$?\d[\d,]*(?:\.\d+)?%?/);
  return m ? m[0] : null;
}

// One stamp per source status. This is the honesty spine: read = real signal,
// none found = reachable genuine zero, not readable = WAF/private/absent (never implies zero).
function statusStamp(status: DtcSignalStatus): { text: string; tone: 'read' | 'empty' | 'none' } {
  if (status === 'present') return { text: 'READ', tone: 'read' };
  if (status === 'empty') return { text: 'NONE FOUND', tone: 'empty' };
  return { text: 'NOT READABLE', tone: 'none' };
}

function signalSourceUrl(d: NonNullable<ReportJson['dtc']>, key: string): string | undefined {
  if (key === 'ads.meta') return d.ads?.meta?.source_url ?? undefined;
  const blk = (d as unknown as Record<string, { source_url?: string | null }>)[key];
  return blk?.source_url ?? undefined;
}

// ── Profit Gap calculator ────────────────────────────────────────────────────
// The dossier's ASSESSMENT and the page's single climax. Formula lifted verbatim from the
// True Profit X-Ray. Seeded from the prospect's own public median price (never asserted as
// their real margin). EVERY container holding a calc input/output numeral carries data-calc="1"
// (those nodes are user-editable / derived, and are exempt from the fabrication instrument).
function AssessmentPanel({
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
  const positive = profitPerOrder >= 0;

  const sliders: Array<{ key: string; label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; fmt: (v: number) => string }> = [
    { key: 'aov', label: 'AOV', value: aov, set: setAov, min: 10, max: 300, step: 1, fmt: (v) => fmtMoney(v) },
    { key: 'cogs', label: 'COGS', value: cogsPct, set: setCogsPct, min: 5, max: 80, step: 1, fmt: (v) => `${v}%` },
    { key: 'returns', label: 'Returns', value: returnsPct, set: setReturnsPct, min: 0, max: 40, step: 1, fmt: (v) => `${v}%` },
    { key: 'shipping', label: 'Shipping', value: shipping, set: setShipping, min: 0, max: 30, step: 0.5, fmt: (v) => fmtMoney(v) },
    { key: 'proc', label: 'Processing', value: procPct, set: setProcPct, min: 1, max: 6, step: 0.1, fmt: (v) => `${v.toFixed(1)}%` },
    { key: 'cac', label: 'CAC', value: cac, set: setCac, min: 0, max: 150, step: 1, fmt: (v) => fmtMoney(v) },
  ];

  return (
    <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-16 pb-4">
      <div className="border-2" style={{ borderColor: ink }}>
        {/* Assessment masthead */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-7 py-3 border-b-2" style={{ borderColor: ink, background: ink }}>
          <span className="text-[11px] sm:text-xs uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: '#ffffff' }}>
            Assessment / Profit Gap
          </span>
          <span className="text-[11px] sm:text-xs uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: accent }}>
            self-computed
          </span>
        </div>

        <div className="px-5 sm:px-7 pt-7 pb-8">
          <h2 className="text-3xl sm:text-5xl font-extrabold leading-[1.02] mb-2" style={{ fontFamily: headingFont, color: ink }}>
            The first number Rise looks at
          </h2>
          <p className="text-base leading-relaxed max-w-2xl mb-8" style={{ color: ink, opacity: 0.82 }}>
            Contribution profit on a single order, seeded from your public median price, not your actuals. Type your real numbers over it. {clean(sourceNote)}
          </p>

          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-12 items-start">
            {/* The peak numeral, isolated */}
            <div className="order-2 lg:order-1">
              <div className="border-t border-b py-6" style={{ borderColor: `${ink}22` }}>
                <div data-calc="1">
                  <div className="text-[11px] uppercase tracking-[0.2em] mb-2" style={{ fontFamily: MONO, color: ink, opacity: 0.7 }}>
                    Profit / order, after CAC
                  </div>
                  <div
                    className="font-extrabold tabular-nums leading-none"
                    style={{ fontFamily: headingFont, color: ink, fontSize: 'clamp(3.25rem, 12vw, 6.5rem)' }}
                  >
                    <span style={{ boxShadow: positive ? `inset 0 -0.28em 0 ${accent}` : 'none' }}>{fmtMoney(profitPerOrder)}</span>
                  </div>
                </div>
                <div data-calc="1" className="mt-5 flex items-baseline gap-3">
                  <span className="text-[11px] uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: ink, opacity: 0.7 }}>
                    Contribution / order
                  </span>
                  <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: headingFont, color: ink }}>
                    {fmtMoney(contribution)}
                  </span>
                </div>
              </div>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-block text-sm font-bold px-6 py-3 transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
                style={{ background: accent, color: '#111111', fontFamily: MONO, letterSpacing: '0.04em' }}
              >
                PRESSURE-TEST THIS WITH RISE
              </a>
            </div>

            {/* Inputs */}
            <div className="order-1 lg:order-2 grid sm:grid-cols-2 gap-x-7 gap-y-5">
              {sliders.map((s) => (
                <label key={s.key} data-calc="1" className="block">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] uppercase tracking-[0.16em]" style={{ fontFamily: MONO, color: ink, opacity: 0.72 }}>{s.label}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ fontFamily: MONO, color: ink }}>{s.fmt(s.value)}</span>
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
                    aria-label={s.label}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CandidateDossier({ report, scan, companyName }: { report: ReportJson; scan: Scan; companyName: string }) {
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

  // The floor never loaded its declared fonts (real defect). Load them.
  useGoogleFonts([brand.font_heading, brand.font_body]);

  useMetadata({
    title: `A growth scan for ${companyName}`,
    description: d.hero_hook || `A public read of ${companyName}'s store, and where the growth is.`,
    canonical: `${(import.meta as unknown as { env?: { VITE_SCAN_ORIGIN?: string } }).env?.VITE_SCAN_ORIGIN || 'https://ivanmanfredi.com'}/scan/${scan.company_slug}`,
    ogImage: d.og_image_url || undefined,
    noindex: true,
  });

  const signals = (d.completeness?.signals || {}) as Record<string, DtcSignalStatus>;
  const sourceRows = SIGNAL_ORDER.filter((k) => k in signals);
  const presentCount = d.completeness?.present_count ?? 0;
  const scoredOf = d.completeness?.scored_of ?? 0;

  const hasScorecard = d.growth_score != null;
  const breakdownEntries = Object.entries(d.score_breakdown || {});
  const findings = d.findings || [];
  const pg = d.profit_gap;

  return (
    <div style={{ background: surface, color: ink, fontFamily: bodyFont, minHeight: '100vh' }}>
      {/* Classified binding rule */}
      <div style={{ height: 3, background: accent }} />

      {/* 1. Masthead — classification style */}
      <header className="border-b-2" style={{ borderColor: ink }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt={wordmark} className="h-6 sm:h-7 w-auto" />
          ) : (
            <span className="font-extrabold text-lg" style={{ fontFamily: headingFont, color: ink }}>{wordmark}</span>
          )}
          <div className="flex items-center gap-4">
            <span className="hidden md:inline text-[11px] uppercase tracking-[0.22em]" style={{ fontFamily: MONO, color: ink, opacity: 0.72 }}>
              Growth Scan · compiled from public data · confidential
            </span>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold px-5 py-2 whitespace-nowrap transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
              style={{ background: accent, color: '#111111', fontFamily: MONO, letterSpacing: '0.03em' }}
            >
              BOOK A CALL
            </a>
          </div>
        </div>
      </header>

      {/* 2. Subject / hook */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-10">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-6 text-[11px] uppercase tracking-[0.2em]" style={{ fontFamily: MONO, color: ink, opacity: 0.72 }}>
          <span>Subject: <span style={{ opacity: 1, fontWeight: 700 }}>{companyName}</span></span>
          <span className="hidden sm:inline" style={{ color: `${ink}55` }}>|</span>
          <span>Method: public-data read</span>
        </div>
        <h1
          className="font-extrabold leading-[1.04] max-w-4xl"
          style={{ fontFamily: headingFont, color: ink, fontSize: 'clamp(2rem, 6.2vw, 4rem)' }}
        >
          {clean(d.hero_hook)}
        </h1>
      </section>

      {/* 3. Source log — the provenance strip as a real dossier table */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-14">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ fontFamily: MONO, color: ink }}>
            Source log
          </span>
          <span className="flex-1 h-px" style={{ background: `${ink}22` }} />
          <span className="text-[11px] uppercase tracking-[0.18em] tabular-nums" style={{ fontFamily: MONO, color: ink, opacity: 0.72 }}>
            {presentCount} of {scoredOf} read
          </span>
        </div>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-y" style={{ borderColor: `${ink}22` }}>
              <th className="text-left py-2 pr-2 w-[42%] text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ fontFamily: MONO, color: ink, opacity: 0.6 }}>Source</th>
              <th className="text-left py-2 px-2 w-[30%] text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ fontFamily: MONO, color: ink, opacity: 0.6 }}>Read from</th>
              <th className="text-right py-2 pl-2 w-[28%] text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ fontFamily: MONO, color: ink, opacity: 0.6 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sourceRows.map((key) => {
              const status = signals[key];
              const stamp = statusStamp(status);
              const label = SIGNAL_LABEL[key] || key;
              const readFrom = READ_FROM[key] || 'public data';
              const href = status === 'present' ? signalSourceUrl(d, key) : undefined;
              const stampColor = stamp.tone === 'read' ? ink : stamp.tone === 'empty' ? ink : ink;
              const stampOpacity = stamp.tone === 'read' ? 1 : stamp.tone === 'empty' ? 0.85 : 0.55;
              return (
                <tr key={key} className="border-b align-middle" style={{ borderColor: `${ink}14` }}>
                  <td className="py-3 pr-2">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-[15px] font-semibold underline decoration-1 underline-offset-2" style={{ color: ink }}>
                        {label}
                      </a>
                    ) : (
                      <span className="text-[15px] font-semibold" style={{ color: ink, opacity: status === 'present' ? 1 : 0.85 }}>{label}</span>
                    )}
                  </td>
                  <td className="py-3 px-2 truncate text-[13px]" style={{ fontFamily: MONO, color: ink, opacity: 0.62 }}>
                    {readFrom}
                  </td>
                  <td className="py-3 pl-1 text-right">
                    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.08em] sm:tracking-[0.14em] font-semibold whitespace-nowrap" style={{ fontFamily: MONO, color: stampColor, opacity: stampOpacity }}>
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{
                          background: stamp.tone === 'read' ? accent : 'transparent',
                          border: stamp.tone === 'read' ? 'none' : `1px solid ${ink}`,
                          opacity: stamp.tone === 'none' ? 0.4 : 1,
                        }}
                      />
                      {stamp.text}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {findings.length === 0 ? (
          <p className="text-base leading-relaxed mt-5 max-w-2xl" style={{ color: ink, opacity: 0.82 }}>
            Most sources on this store were not readable from the outside. The full teardown comes off a live look together, where the private data opens up.
          </p>
        ) : null}
      </section>

      {/* 4. Composite read — partial score, collapses entirely when null */}
      {hasScorecard ? (
        <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-16">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ fontFamily: MONO, color: ink }}>
              Composite read
            </span>
            <span className="flex-1 h-px" style={{ background: `${ink}22` }} />
          </div>
          <div className="grid sm:grid-cols-[auto_1fr] gap-8 sm:gap-12 items-start">
            <div>
              <div className="font-extrabold tabular-nums leading-none" style={{ fontFamily: headingFont, color: ink, fontSize: 'clamp(4rem, 16vw, 7rem)' }}>
                {d.growth_score}
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] mt-2" style={{ fontFamily: MONO, color: ink, opacity: 0.7 }}>
                across readable levers
              </div>
            </div>
            <div className="space-y-5 pt-2">
              {breakdownEntries.map(([lever, b]) => (
                <div key={lever}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold" style={{ color: ink }}>{LEVER_LABEL[lever] || lever}</span>
                    <span className="text-[13px] tabular-nums" style={{ fontFamily: MONO, color: ink, opacity: 0.7 }}>{b.value}/{b.max}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden" style={{ background: `${ink}12` }}>
                    <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, (b.value / b.max) * 100))}%`, background: accent }} />
                  </div>
                  <p className="text-[13px] mt-1.5" style={{ color: ink, opacity: 0.62 }}>{clean(b.rationale)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 5. Exhibits — findings worst-first, each with its key figure isolated LARGE */}
      {findings.length > 0 ? (
        <section className="max-w-5xl mx-auto px-5 sm:px-8 pb-6">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ fontFamily: MONO, color: ink }}>
              Exhibits · where the growth is
            </span>
            <span className="flex-1 h-px" style={{ background: `${ink}22` }} />
          </div>
          <div>
            {findings.map((f, i) => {
              const fig = keyFigure(f.evidence);
              const num = String(i + 1).padStart(2, '0');
              return (
                <article key={i} className="grid sm:grid-cols-[minmax(0,7.5rem)_1fr] md:grid-cols-[minmax(0,10rem)_1fr] gap-x-8 gap-y-4 py-8 border-t" style={{ borderColor: `${ink}22` }}>
                  {/* Figure panel */}
                  <div className="sm:border-r sm:pr-6" style={{ borderColor: `${ink}14` }}>
                    <div className="text-[11px] uppercase tracking-[0.2em] mb-3" style={{ fontFamily: MONO, color: ink, opacity: 0.55 }}>
                      Exhibit {num}
                    </div>
                    {fig ? (
                      <div className="font-extrabold tabular-nums leading-none" style={{ fontFamily: headingFont, color: ink, fontSize: 'clamp(2.5rem, 8vw, 4rem)' }}>
                        {fig}
                      </div>
                    ) : (
                      <div className="text-[11px] uppercase tracking-[0.16em]" style={{ fontFamily: MONO, color: ink, opacity: 0.5 }}>
                        read from store
                      </div>
                    )}
                  </div>
                  {/* Exhibit body */}
                  <div>
                    <span
                      className="inline-block text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-1 mb-3"
                      style={{ fontFamily: MONO, background: ink, color: '#ffffff' }}
                    >
                      {LEVER_LABEL[f.lever] || f.lever}
                    </span>
                    <h3 className="text-xl sm:text-2xl font-bold leading-snug mb-2" style={{ fontFamily: headingFont, color: ink }}>
                      {clean(f.title)}
                    </h3>
                    <p className="text-base leading-relaxed max-w-2xl" style={{ color: ink, opacity: 0.82 }}>
                      {clean(f.evidence)}
                    </p>
                    {f.source_url ? (
                      <a
                        href={f.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-3 text-[12px] uppercase tracking-[0.14em] underline decoration-1 underline-offset-2"
                        style={{ fontFamily: MONO, color: ink, opacity: 0.7 }}
                      >
                        read from your store
                      </a>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 6. Assessment — the Profit Gap climax; collapses entirely when the seed is absent */}
      {pg ? (
        <AssessmentPanel
          seedAov={pg.seed_aov}
          sourceNote={pg.source_note}
          accent={accent}
          ink={ink}
          headingFont={headingFont}
          bookingUrl={bookingUrl}
        />
      ) : null}

      {/* 7. Resolution — what Rise does about it (a claim about Rise, not the prospect) */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 pt-16 pb-14">
        <div className="border-t pt-10" style={{ borderColor: `${ink}22` }}>
          <span className="text-[11px] uppercase tracking-[0.22em] font-semibold" style={{ fontFamily: MONO, color: ink, opacity: 0.7 }}>
            Recommendation
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold leading-tight mt-3 mb-4 max-w-3xl" style={{ fontFamily: headingFont, color: ink }}>
            How Rise runs growth
          </h2>
          <p className="text-base leading-relaxed max-w-2xl mb-7" style={{ color: ink, opacity: 0.82 }}>
            Paid media and performance creative that compound, plus a Financial Health view that tracks contribution profit on every order. A live look picks up what a public scan cannot reach.
          </p>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-sm font-bold px-6 py-3 transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
            style={{ background: accent, color: '#111111', fontFamily: MONO, letterSpacing: '0.04em' }}
          >
            BOOK A CALL
          </a>
        </div>
      </section>

      {/* 8. Footer */}
      <footer className="border-t-2" style={{ borderColor: ink }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ fontFamily: MONO, color: ink, opacity: 0.72 }}>
            Prepared for {companyName} · public-data scan · confidential
          </p>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold px-5 py-2 whitespace-nowrap transition-transform hover:-translate-y-0.5 motion-reduce:transform-none"
            style={{ background: accent, color: '#111111', fontFamily: MONO, letterSpacing: '0.03em' }}
          >
            BOOK A CALL
          </a>
        </div>
      </footer>
    </div>
  );
}
