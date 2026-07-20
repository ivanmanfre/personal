// components/DtcGrowthReport.tsx
// Rendered IN PLACE OF the generic report when matched_offer === 'dtc_growth'.
//
// Rise-DTC-branded teardown of a Shopify brand's PUBLIC data. Wears Rise's own brand
// (gold #ffc71d, Sora/Manrope, Rise logo, Rise booking link) — NEVER Ivan/InboundOnSteroids
// chrome. Correctness spine: every section gates on `SignalMeta.status === 'present'`
// (or `'empty'` for a genuine negative), never on payload-presence. A `blocked`/`error`/
// `absent` signal collapses silently and emits NO number — a WAF-blocked signal must never
// read as "they have zero". Degradation-first: every non-present section renders nothing,
// not a placeholder.
import React, { useState } from 'react';
import { useMetadata } from '../hooks/useMetadata';
import type { ReportJson, Scan, DtcSignalStatus } from '../lib/scanTypes';

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

// One provenance chip per signal. This is what makes degradation read as HONEST rather
// than apologetic: present = real signal, empty = we looked and found nothing, and
// blocked/absent/error = we simply could not read it (never implies zero).
function ProvenanceChip({ signal, status, accent, ink }: { signal: string; status: DtcSignalStatus; accent: string; ink: string }) {
  const label = SIGNAL_LABEL[signal] || signal;
  if (status === 'present') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border" style={{ borderColor: `${accent}66`, color: ink }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
        {label}
      </span>
    );
  }
  if (status === 'empty') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border opacity-70" style={{ borderColor: `${ink}33`, color: ink }}>
        <span className="w-1.5 h-1.5 rounded-full border" style={{ borderColor: ink }} />
        {label} · none found
      </span>
    );
  }
  // blocked / absent / error — honest "could not read", NEVER a zero.
  return (
    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border opacity-40" style={{ borderColor: `${ink}22`, color: ink }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ink }} />
      {label} · not readable
    </span>
  );
}

// Profit-Gap self-compute — Rise's differentiator centerpiece. Formula lifted verbatim from
// the True Profit X-Ray (~/Desktop/resources/rise-dtc-true-profit-x-ray/app.js). Seeded from
// the prospect's own public median price (never asserted as their real margin) so the
// prospect types their real numbers on top of an honest starting point.
function ProfitGapCalculator({
  seedAov,
  sourceNote,
  accent,
  ink,
  headingFont,
}: {
  seedAov: number | null;
  sourceNote: string;
  accent: string;
  ink: string;
  headingFont: string;
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
    <section className="max-w-3xl mx-auto px-5 sm:px-6 py-14 border-t" style={{ borderColor: `${ink}1a` }}>
      <h2 className="text-2xl sm:text-3xl font-bold mb-2" style={{ fontFamily: headingFont, color: ink }}>
        Your Profit Gap, self-computed
      </h2>
      <p className="text-sm opacity-70 mb-8" style={{ color: ink }}>
        Type your real numbers. This is seeded from your public median price, not your actuals. {sourceNote}
      </p>
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5 mb-8">
        {sliders.map((s) => (
          <label key={s.key} className="block text-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="opacity-70" style={{ color: ink }}>{s.label}</span>
              <span className="font-semibold tabular-nums" style={{ color: ink }}>{s.fmt(s.value)}</span>
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
            />
          </label>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="border rounded-lg p-4" style={{ borderColor: `${ink}22` }}>
          <div className="text-xs uppercase tracking-wide opacity-60 mb-1" style={{ color: ink }}>Contribution / order</div>
          <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: headingFont, color: ink }}>{fmtMoney(contribution)}</div>
        </div>
        <div className="border rounded-lg p-4" style={{ borderColor: `${ink}22` }}>
          <div className="text-xs uppercase tracking-wide opacity-60 mb-1" style={{ color: ink }}>Profit / order (after CAC)</div>
          <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: headingFont, color: ink }}>{fmtMoney(profitPerOrder)}</div>
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
  const wordmark = brand.wordmark || 'Rise DTC';

  // Per-scan share metadata — Rise's own hook, never Ivan/IOS copy.
  useMetadata({
    title: `A growth scan for ${companyName}`,
    description: d.hero_hook || `A public read of ${companyName}'s store, and where the growth is.`,
    canonical: `${import.meta.env.VITE_SCAN_ORIGIN || 'https://ivanmanfredi.com'}/scan/${scan.company_slug}`,
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

  return (
    <div style={{ background: surface, color: ink, fontFamily: bodyFont, minHeight: '100vh' }}>
      {/* 1. Header — Rise's own chrome, no Ivan/IOS wordmark, no Calendly. */}
      <header className="border-b" style={{ borderColor: `${ink}1a` }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="Rise DTC" className="h-6 sm:h-7 w-auto" />
          ) : (
            <span className="font-bold text-lg" style={{ fontFamily: headingFont, color: ink }}>{wordmark}</span>
          )}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs uppercase tracking-wide opacity-60">Growth Scan · Confidential</span>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold px-4 py-2 rounded-full whitespace-nowrap"
              style={{ background: accent, color: ink }}
            >
              Book a call
            </a>
          </div>
        </div>
      </header>

      {/* 2. Hero — real-fact hook, big editorial numeral treatment. */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 pt-14 pb-10">
        <p className="text-xs uppercase tracking-widest opacity-60 mb-3">{companyName}</p>
        <h1
          className="text-3xl sm:text-5xl font-bold leading-[1.08] tabular-nums"
          style={{ fontFamily: headingFont, color: ink }}
        >
          {d.hero_hook}
        </h1>
      </section>

      {/* 3. "What I looked at" provenance strip — the honesty spine. */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 pb-10">
        <p className="text-xs uppercase tracking-wide opacity-60 mb-3">What I looked at</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {signalEntries.map(([signal, status]) => (
            <ProvenanceChip key={signal} signal={signal} status={status} accent={accent} ink={ink} />
          ))}
        </div>
        <p className="text-xs opacity-60">
          {presentCount} of {scoredOf} signals read{tier ? ` · ${capitalize(tier)} read` : ''}
        </p>
      </section>

      {/* 4. Growth Scorecard — Partial score, collapses entirely when null. */}
      {hasScorecard ? (
        <section className="max-w-3xl mx-auto px-5 sm:px-6 py-10 border-t" style={{ borderColor: `${ink}1a` }}>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-5xl sm:text-6xl font-bold tabular-nums" style={{ fontFamily: headingFont, color: ink }}>
              {d.growth_score}
            </span>
            <span className="text-lg opacity-50">/100</span>
          </div>
          <p className="text-sm opacity-70 mb-6">
            scored across {breakdownEntries.length} of your levers we could read
          </p>
          <div className="space-y-4">
            {breakdownEntries.map(([lever, b]) => (
              <div key={lever}>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="font-semibold">{LEVER_LABEL[lever] || lever}</span>
                  <span className="tabular-nums opacity-70">{b.value}/{b.max}</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: `${ink}14` }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (b.value / b.max) * 100))}%`, background: accent }} />
                </div>
                <p className="text-xs opacity-60 mt-1.5">{b.rationale}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 5. Findings — worst-first, ladder to a Rise-sold lever only. */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-10 border-t" style={{ borderColor: `${ink}1a` }}>
        <h2 className="text-2xl sm:text-3xl font-bold mb-6" style={{ fontFamily: headingFont, color: ink }}>
          Where the growth is
        </h2>
        {findings.length > 0 ? (
          <div className="space-y-8">
            {findings.map((f, i) => (
              <div key={i}>
                <span
                  className="inline-block text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded mb-2"
                  style={{ background: `${accent}33`, color: ink }}
                >
                  {LEVER_LABEL[f.lever] || f.lever}
                </span>
                <h3 className="text-lg sm:text-xl font-bold mb-1.5" style={{ fontFamily: headingFont, color: ink }}>
                  {f.title}
                </h3>
                <p className="text-sm opacity-80 leading-relaxed mb-1.5">{f.evidence}</p>
                {f.source_url ? (
                  <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="text-xs underline opacity-60">
                    read from your store
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm opacity-80 leading-relaxed">
            A public read only surfaced the basics. The full teardown comes off a live look together.
          </p>
        )}
      </section>

      {/* 6. Profit-Gap self-compute — collapses entirely when the seed is absent. */}
      {pg ? (
        <ProfitGapCalculator seedAov={pg.seed_aov} sourceNote={pg.source_note} accent={accent} ink={ink} headingFont={headingFont} />
      ) : null}

      {/* 7. Rise close — Rise's own pitch (generic positioning is fine here; it's a claim
          about Rise, not a claim about the prospect). */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-14 border-t" style={{ borderColor: `${ink}1a` }}>
        <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={{ fontFamily: headingFont, color: ink }}>
          How Rise runs growth
        </h2>
        <p className="text-sm opacity-80 leading-relaxed mb-6 max-w-xl">
          Paid media and performance creative that compound, paired with a real Financial Health
          view of every order: contribution profit, not top-line vanity. That's the read a live
          look together gets you past a public scan.
        </p>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-semibold px-5 py-2.5 rounded-full"
          style={{ background: accent, color: ink }}
        >
          Book a call
        </a>
      </section>

      {/* 8. CTA footer */}
      <footer className="max-w-3xl mx-auto px-5 sm:px-6 py-10 border-t text-center" style={{ borderColor: `${ink}1a` }}>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-semibold px-5 py-2.5 rounded-full mb-4"
          style={{ background: accent, color: ink }}
        >
          Book a call
        </a>
        <p className="text-xs opacity-50">
          Prepared for {companyName} · public-data scan · confidential
        </p>
      </footer>
    </div>
  );
}
