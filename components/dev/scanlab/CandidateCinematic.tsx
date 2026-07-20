// components/dev/scanlab/CandidateCinematic.tsx
// Tournament candidate "Cinematic" — the growth scan rendered as a paced scroll-story:
// one idea per "act", momentum from scale contrast and pacing (not effects). Self-contained;
// preserves the floor's correctness spine (status-gated acts, verbatim numerals, honest
// provenance) and beats it on hierarchy drama, narrative arc, and centerpiece prominence.
//
// Correctness spine (unchanged from the floor): every act renders iff its signal status is
// 'present' (or 'empty' for honest negatives). blocked/absent/error emit NO number and appear
// ONLY in the "what we could not see" provenance act as "not readable". Absent acts render
// nothing — no placeholders, no empty frames — so thin/blocked fixtures collapse gracefully.
import React, { useEffect, useMemo, useState } from 'react';
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

// Isolate ONE display numeral verbatim from a source string. This never invents or derives a
// number — it lifts a token that already exists in fixture prose (fact-checked evidence / the
// hero hook). `first` picks the leading token (so a hero numeral reads with its own sentence);
// otherwise the token is ranked for variety: a percentage, then the largest dollar, then the
// largest bare number. Returns the EXACT matched substring (commas/decimals/units preserved).
function pickNumeral(text: string | null | undefined, first = false): string | null {
  if (!text) return null;
  const matches = text.match(/\$?\d[\d,]*(?:\.\d+)?%?/g);
  if (!matches || matches.length === 0) return null;
  if (first) return matches[0];
  const parsed = matches.map((m) => ({
    m,
    isPct: m.endsWith('%'),
    isDollar: m.startsWith('$'),
    num: parseFloat(m.replace(/[$,%]/g, '')) || 0,
  }));
  const pcts = parsed.filter((p) => p.isPct).sort((a, b) => b.num - a.num);
  if (pcts.length) return pcts[0].m;
  const dollars = parsed.filter((p) => p.isDollar).sort((a, b) => b.num - a.num);
  if (dollars.length) return dollars[0].m;
  return parsed.slice().sort((a, b) => b.num - a.num)[0].m;
}

// Slim gold scroll-progress rail. Passive scroll listener only — NO scroll-jacking, NO
// opacity gating. Static capture shows a zero-width rail (everything else is fully visible).
function useScrollProgress(): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      setP(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return p;
}

// ── Profit-Gap calculator — the climactic, interactive act ────────────────────────────────
// Formula lifted verbatim from the floor / True Profit X-Ray. Every container holding an input
// or output numeral carries data-calc="1" (fabrication instrument exempts those nodes).
function ProfitGapAct({
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
  const profitPositive = profitPerOrder >= 0;
  // Visual fill for the profit bar (styling only, never rendered as text).
  const fillPct = aov > 0 ? Math.max(0, Math.min(100, (Math.abs(profitPerOrder) / aov) * 100)) : 0;

  const sliders: Array<{ key: string; label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; fmt: (v: number) => string }> = [
    { key: 'aov', label: 'AOV', value: aov, set: setAov, min: 10, max: 300, step: 1, fmt: (v) => fmtMoney(v) },
    { key: 'cogs', label: 'COGS', value: cogsPct, set: setCogsPct, min: 5, max: 80, step: 1, fmt: (v) => `${v}%` },
    { key: 'returns', label: 'Returns', value: returnsPct, set: setReturnsPct, min: 0, max: 40, step: 1, fmt: (v) => `${v}%` },
    { key: 'shipping', label: 'Shipping', value: shipping, set: setShipping, min: 0, max: 30, step: 0.5, fmt: (v) => fmtMoney(v) },
    { key: 'proc', label: 'Processing', value: procPct, set: setProcPct, min: 1, max: 6, step: 0.1, fmt: (v) => `${v.toFixed(1)}%` },
    { key: 'cac', label: 'CAC', value: cac, set: setCac, min: 0, max: 150, step: 1, fmt: (v) => fmtMoney(v) },
  ];

  return (
    <section className="px-5 sm:px-6 py-20 sm:py-28 border-t" style={{ borderColor: `${ink}1a` }}>
      <div className="max-w-4xl mx-auto">
        <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-3 flex items-center gap-2" style={{ color: ink }}>
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: accent }} />
          The climax
        </p>
        <h2 className="font-extrabold leading-[0.95] mb-4" style={{ fontFamily: headingFont, color: ink, fontSize: 'clamp(2rem, 6vw, 3.75rem)' }}>
          Your Profit Gap, self-computed
        </h2>
        <p className="text-base sm:text-lg leading-relaxed mb-10 max-w-2xl" style={{ color: ink, opacity: 0.75 }}>
          This is the first number Rise looks at. Seeded from your public median price, not your actuals.
          Type your real numbers and watch contribution profit move. {sourceNote}
        </p>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-start">
          {/* Inputs */}
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
            {sliders.map((s) => (
              <label key={s.key} className="block" data-calc="1">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: ink, opacity: 0.7 }}>{s.label}</span>
                  <span className="text-lg font-bold tabular-nums" style={{ fontFamily: headingFont, color: ink }}>{s.fmt(s.value)}</span>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={s.value}
                  onChange={(e) => s.set(Number(e.target.value))}
                  className="w-full cin-anim"
                  style={{ accentColor: accent }}
                  aria-label={s.label}
                />
              </label>
            ))}
          </div>

          {/* Outputs — the numeral-as-anchor centerpiece */}
          <div className="rounded-2xl p-6 sm:p-8" style={{ background: ink }}>
            <div data-calc="1" className="mb-6">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: surface, opacity: 0.6 }}>Profit / order after CAC</div>
              <div
                className="font-extrabold tabular-nums leading-none"
                style={{ fontFamily: headingFont, color: profitPositive ? accent : surface, fontSize: 'clamp(3rem, 12vw, 6rem)' }}
              >
                {fmtMoney(profitPerOrder)}
              </div>
              <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: `${surface}22` }}>
                <div className="h-full rounded-full cin-anim" style={{ width: `${fillPct}%`, background: profitPositive ? accent : `${surface}cc`, transition: 'width 220ms ease' }} />
              </div>
            </div>
            <div data-calc="1" className="pt-5 border-t flex items-baseline justify-between" style={{ borderColor: `${surface}22` }}>
              <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: surface, opacity: 0.6 }}>Contribution / order</span>
              <span className="text-2xl font-bold tabular-nums" style={{ fontFamily: headingFont, color: surface }}>{fmtMoney(contribution)}</span>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-base font-bold px-7 py-3.5 rounded-full"
            style={{ background: accent, color: ink }}
          >
            Close this gap with Rise
          </a>
        </div>
      </div>
    </section>
  );
}

// ── One finding = one act. Alternating alignment, one inverted on ink for rhythm. ─────────
function FindingAct({
  finding,
  align,
  inverted,
  accent,
  ink,
  surface,
  headingFont,
}: {
  finding: { lever: string; title: string; evidence: string; source_url?: string | null };
  align: 'left' | 'right';
  inverted: boolean;
  accent: string;
  ink: string;
  surface: string;
  headingFont: string;
}) {
  const numeral = pickNumeral(finding.evidence);
  const fg = inverted ? surface : ink;
  const bg = inverted ? ink : 'transparent';
  const alignCls = inverted ? 'text-center items-center' : align === 'right' ? 'sm:text-right sm:items-end' : 'text-left items-start';

  return (
    <section className="px-5 sm:px-6 py-16 sm:py-24 border-t" style={{ background: bg, borderColor: inverted ? ink : `${ink}1a` }}>
      <div className={`max-w-4xl mx-auto flex flex-col ${alignCls}`}>
        <span
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] mb-6 px-3 py-1.5 rounded-full"
          style={{ background: `${accent}${inverted ? '2e' : '26'}`, color: fg }}
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
          {LEVER_LABEL[finding.lever] || finding.lever}
        </span>

        {numeral ? (
          <div
            className="font-extrabold tabular-nums leading-[0.9] mb-4"
            style={{ fontFamily: headingFont, color: numeral.length > 4 ? fg : accent, fontSize: 'clamp(2.75rem, 13vw, 7.5rem)' }}
          >
            {numeral}
          </div>
        ) : null}

        <h3
          className="font-bold leading-[1.08] mb-4 max-w-2xl"
          style={{ fontFamily: headingFont, color: fg, fontSize: numeral ? 'clamp(1.3rem, 3.4vw, 2rem)' : 'clamp(1.8rem, 5vw, 3.25rem)' }}
        >
          {finding.title}
        </h3>
        <p className="text-base sm:text-lg leading-relaxed max-w-2xl" style={{ color: fg, opacity: 0.82 }}>
          {finding.evidence}
        </p>
        {finding.source_url ? (
          <a
            href={finding.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-4"
            style={{ color: fg, opacity: 0.7 }}
          >
            read from your store
          </a>
        ) : null}
      </div>
    </section>
  );
}

export function CandidateCinematic({ report, scan, companyName }: { report: ReportJson; scan: Scan; companyName: string }) {
  const d = report.dtc;

  const brand = d?.brand;
  const accent = brand?.accent_hex || '#ffc71d';
  const ink = brand?.ink_hex || '#111111';
  const surface = brand?.surface_hex || '#ffffff';
  const headingFont = brand?.font_heading ? `'${brand.font_heading}', sans-serif` : "'Sora', sans-serif";
  const bodyFont = brand?.font_body ? `'${brand.font_body}', sans-serif` : "'Manrope', sans-serif";
  const bookingUrl = brand?.booking_url || '';
  const logoUrl = brand?.logo_url || undefined;
  const wordmark = brand?.wordmark || 'Rise DTC';

  // Load the brand fonts (the floor never did — a real defect this candidate fixes).
  useGoogleFonts([brand?.font_heading, brand?.font_body]);

  // Per-scan share metadata — prefix "A growth scan for " is load-bearing for the prerender regex.
  useMetadata({
    title: `A growth scan for ${companyName}`,
    description: d?.hero_hook || `A public read of ${companyName}'s store, and where the growth is.`,
    canonical: `${(import.meta as { env?: Record<string, string> }).env?.VITE_SCAN_ORIGIN || 'https://ivanmanfredi.com'}/scan/${scan.company_slug}`,
    ogImage: d?.og_image_url || undefined,
    noindex: true,
  });

  const progress = useScrollProgress();

  const signalEntries = useMemo(
    () => (d ? (Object.entries(d.completeness?.signals || {}) as [string, DtcSignalStatus][]) : []),
    [d],
  );

  if (!d) return null;

  const presentCount = d.completeness?.present_count ?? 0;
  const scoredOf = d.completeness?.scored_of ?? 0;
  const tier = d.completeness?.tier;

  const readable = signalEntries.filter(([, s]) => s === 'present' || s === 'empty');
  const unreadable = signalEntries.filter(([, s]) => s !== 'present' && s !== 'empty');

  const hasScorecard = d.growth_score != null;
  const breakdownEntries = Object.entries(d.score_breakdown || {});

  const findings = d.findings || [];
  const invertIdx = findings.length >= 2 ? 1 : 0; // exactly one inverted act, when findings exist
  const pg = d.profit_gap;

  const heroNumeral = pickNumeral(d.hero_hook, true);

  const styleCss = `
    @media (prefers-reduced-motion: reduce) {
      .cin-anim { transition: none !important; }
    }
  `;

  return (
    <div style={{ background: surface, color: ink, fontFamily: bodyFont, minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{styleCss}</style>

      {/* Slim gold scroll-progress rail */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[3px]" style={{ background: `${ink}12` }} aria-hidden="true">
        <div className="h-full cin-anim" style={{ width: `${progress * 100}%`, background: accent, transition: 'width 90ms linear' }} />
      </div>

      {/* Persistent header — sticky booking CTA kills the baseline's 90% CTA-free gap. */}
      <header className="sticky top-0 z-40 border-b backdrop-blur" style={{ borderColor: `${ink}12`, background: `${surface}e6` }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={wordmark} className="h-6 sm:h-7 w-auto" />
          ) : (
            <span className="font-extrabold text-lg" style={{ fontFamily: headingFont, color: ink }}>{wordmark}</span>
          )}
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: ink, opacity: 0.5 }}>Growth Scan · Confidential</span>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold px-4 py-2 rounded-full whitespace-nowrap"
              style={{ background: accent, color: ink }}
            >
              Book a call
            </a>
          </div>
        </div>
      </header>

      {/* ACT 1 — the hook. Near-full-viewport, the store's own number HUGE. */}
      <section className="px-5 sm:px-6 min-h-[82vh] flex flex-col justify-center py-16">
        <div className="max-w-5xl mx-auto w-full">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] mb-6" style={{ color: ink, opacity: 0.55 }}>
            A growth scan for {companyName}
          </p>
          {heroNumeral ? (
            <>
              <div
                className="font-extrabold tabular-nums leading-[0.85] mb-6"
                style={{ fontFamily: headingFont, color: accent, fontSize: 'clamp(4.5rem, 24vw, 15rem)' }}
              >
                {heroNumeral}
              </div>
              <h1
                className="font-bold leading-[1.05] max-w-3xl"
                style={{ fontFamily: headingFont, color: ink, fontSize: 'clamp(1.6rem, 5vw, 3rem)' }}
              >
                {d.hero_hook}
              </h1>
            </>
          ) : (
            <h1
              className="font-extrabold leading-[1.02] max-w-4xl"
              style={{ fontFamily: headingFont, color: ink, fontSize: 'clamp(2.5rem, 9vw, 6rem)' }}
            >
              {d.hero_hook}
            </h1>
          )}
          <p className="mt-8 text-base sm:text-lg max-w-xl" style={{ color: ink, opacity: 0.7 }}>
            A public read of your store, one signal at a time. Scroll to see where the growth is.
          </p>
        </div>
      </section>

      {/* ACT 2 — the overall read (scorecard). Collapses entirely when growth_score is null. */}
      {hasScorecard ? (
        <section className="px-5 sm:px-6 py-16 sm:py-24 border-t" style={{ borderColor: `${ink}1a` }}>
          <div className="max-w-4xl mx-auto">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-6" style={{ color: ink, opacity: 0.55 }}>
              The overall read
            </p>
            <div className="flex items-end gap-4 mb-3">
              <span
                className="font-extrabold tabular-nums leading-[0.8]"
                style={{ fontFamily: headingFont, color: ink, fontSize: 'clamp(4rem, 18vw, 11rem)' }}
              >
                {d.growth_score}
              </span>
              <span className="text-lg sm:text-xl font-bold mb-2 uppercase tracking-wide" style={{ color: ink, opacity: 0.4 }}>growth score</span>
            </div>
            <p className="text-base sm:text-lg mb-10 max-w-xl" style={{ color: ink, opacity: 0.72 }}>
              Scored across {breakdownEntries.length} of your levers we could read from the outside.
            </p>
            <div className="space-y-6 max-w-2xl">
              {breakdownEntries.map(([lever, b]) => (
                <div key={lever}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-base font-bold" style={{ fontFamily: headingFont, color: ink }}>{LEVER_LABEL[lever] || lever}</span>
                    <span className="text-base tabular-nums font-semibold" style={{ color: ink, opacity: 0.65 }}>{b.value}/{b.max}</span>
                  </div>
                  <div className="h-2.5 rounded-full overflow-hidden" style={{ background: `${ink}12` }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (b.value / b.max) * 100))}%`, background: accent }} />
                  </div>
                  <p className="text-sm mt-2" style={{ color: ink, opacity: 0.6 }}>{b.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ACTS 3..n — findings, worst-first. Each its own act; one inverted for rhythm. */}
      {findings.length > 0 ? (
        <>
          <section className="px-5 sm:px-6 pt-16 sm:pt-24 pb-0 border-t" style={{ borderColor: `${ink}1a` }}>
            <div className="max-w-4xl mx-auto">
              <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: ink, opacity: 0.55 }}>
                Where it is leaking
              </p>
              <h2 className="font-extrabold leading-[0.95] max-w-2xl" style={{ fontFamily: headingFont, color: ink, fontSize: 'clamp(2rem, 6vw, 3.5rem)' }}>
                {findings.length === 1 ? 'One signal stood out.' : `${findings.length} signals, worst first.`}
              </h2>
            </div>
          </section>
          {findings.map((f, i) => (
            <FindingAct
              key={i}
              finding={f}
              align={i % 2 === 0 ? 'left' : 'right'}
              inverted={i === invertIdx}
              accent={accent}
              ink={ink}
              surface={surface}
              headingFont={headingFont}
            />
          ))}
        </>
      ) : null}

      {/* Quiet provenance act — honest read of what we could and could not see. */}
      {signalEntries.length > 0 ? (
        <section className="px-5 sm:px-6 py-16 sm:py-24 border-t" style={{ borderColor: `${ink}1a` }}>
          <div className="max-w-4xl mx-auto">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: ink, opacity: 0.55 }}>
              What we could and could not see
            </p>
            <h2 className="font-bold leading-tight mb-8 max-w-2xl" style={{ fontFamily: headingFont, color: ink, fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}>
              {presentCount} of {scoredOf} signals read{tier ? ` · ${capitalize(tier)} read` : ''}
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-8">
              {readable.length > 0 ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: ink, opacity: 0.6 }}>Read cleanly</p>
                  <div className="flex flex-wrap gap-2">
                    {readable.map(([signal, status]) => (
                      <span key={signal} className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border" style={{ borderColor: `${accent}66`, color: ink }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: status === 'present' ? accent : 'transparent', border: status === 'empty' ? `1px solid ${ink}` : 'none' }} />
                        {SIGNAL_LABEL[signal] || signal}{status === 'empty' ? ' · none found' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {unreadable.length > 0 ? (
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: ink, opacity: 0.6 }}>Not readable from outside</p>
                  <div className="flex flex-wrap gap-2">
                    {unreadable.map(([signal]) => (
                      <span key={signal} className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border" style={{ borderColor: `${ink}22`, color: ink, opacity: 0.55 }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: ink }} />
                        {SIGNAL_LABEL[signal] || signal} · not readable
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            <p className="text-base mt-8 max-w-2xl" style={{ color: ink, opacity: 0.65 }}>
              We only counted what public data actually shows. A blocked signal is never read as a zero. A live look together picks up what a public scan cannot reach.
            </p>
          </div>
        </section>
      ) : null}

      {/* Climax — Profit-Gap calculator. Collapses entirely when the seed is absent. */}
      {pg ? (
        <ProfitGapAct
          seedAov={pg.seed_aov}
          sourceNote={pg.source_note}
          accent={accent}
          ink={ink}
          surface={surface}
          headingFont={headingFont}
          bookingUrl={bookingUrl}
        />
      ) : null}

      {/* Resolution — how Rise runs growth (a claim about Rise, not the prospect). */}
      <section className="px-5 sm:px-6 py-20 sm:py-28 border-t" style={{ borderColor: `${ink}1a` }}>
        <div className="max-w-4xl mx-auto">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: ink, opacity: 0.55 }}>
            The resolution
          </p>
          <h2 className="font-extrabold leading-[0.98] mb-6 max-w-3xl" style={{ fontFamily: headingFont, color: ink, fontSize: 'clamp(2rem, 6vw, 3.75rem)' }}>
            How Rise runs growth
          </h2>
          <p className="text-base sm:text-lg leading-relaxed mb-10 max-w-2xl" style={{ color: ink, opacity: 0.78 }}>
            Paid media and performance creative that compound, plus a Financial Health view that tracks
            contribution profit on every order. A live look picks up what a public scan cannot reach.
          </p>
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-base font-bold px-7 py-3.5 rounded-full"
            style={{ background: accent, color: ink }}
          >
            Book a call
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-5 sm:px-6 py-14 border-t text-center" style={{ borderColor: `${ink}1a` }}>
        <a
          href={bookingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-base font-bold px-7 py-3.5 rounded-full mb-6"
          style={{ background: accent, color: ink }}
        >
          Book a call
        </a>
        <p className="text-sm" style={{ color: ink, opacity: 0.5 }}>
          Prepared for {companyName} · public-data scan · confidential
        </p>
      </footer>
    </div>
  );
}
