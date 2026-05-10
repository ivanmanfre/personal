// components/ScanReportPage.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, animate, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {
  ExternalLink, CheckCircle, XCircle, AlertCircle, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { useScan } from '../hooks/useScan';
import { ScoreBar } from './scan/ScoreBar';
import { OpportunityCard } from './scan/OpportunityCard';
import type { ReportJson, AdCreative } from '../lib/scanTypes';

const CALENDLY_BASE = 'https://calendly.com/im-ivanmanfredi/30min';

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';
const EASE = [0.22, 0.84, 0.36, 1] as const;

// ── Editorial primitives ──────────────────────────────────────────────────────

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p
    style={{
      fontFamily: MONO,
      fontSize: '11px',
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: 'rgba(26,26,26,0.65)', // bumped from 0.5 — fails AA at this size
    }}
  >
    {children}
  </p>
);

// Helper: image onError that swaps to a no-preview block. Kills broken images everywhere.
const fallbackOnError: React.ReactEventHandler<HTMLImageElement> = (e) => {
  (e.target as HTMLImageElement).style.display = 'none';
};

// Scramble-on-enter — like a slot machine settling. Scrambles digit chars in any string.
// Non-digit chars (commas, $, %, #, letters) stay put. Triggers once when in view.
export const Scramble: React.FC<{ value: string; duration?: number; className?: string; style?: React.CSSProperties }> = ({
  value, duration = 0.7, className, style,
}) => {
  const hasDigits = /\d/.test(value);
  const [display, setDisplay] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });
  const reduceMotion = useReducedMotion();
  const ran = useRef(false);

  useEffect(() => {
    if (!inView || reduceMotion || ran.current || !hasDigits) return;
    ran.current = true;
    const steps = Math.floor(duration * 30);
    let step = 0;
    const id = setInterval(() => {
      if (step >= steps) {
        setDisplay(value);
        clearInterval(id);
        return;
      }
      const lockedCount = Math.floor((step / steps) * value.length);
      const scrambled = value.split('').map((c, i) =>
        i < lockedCount ? c : (/\d/.test(c) ? Math.floor(Math.random() * 10).toString() : c)
      ).join('');
      setDisplay(scrambled);
      step++;
    }, 1000 / 30);
    return () => clearInterval(id);
  }, [inView, value, duration, reduceMotion, hasDigits]);

  return <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>{display}</span>;
};

// Document-level scroll progress bar — thin sage line at top of viewport, fills as user scrolls.
const ScrollProgress: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <motion.div
      aria-hidden
      style={{
        scaleX: scrollYProgress,
        transformOrigin: 'left',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: 'var(--color-accent)',
        zIndex: 50,
        opacity: 0.7,
      }}
    />
  );
};

// Renders **markdown bold** segments as <strong>. Per audit: scan page had 0 bold instances → no skim layer.
// Claude prompt now instructs it to wrap key phrases (dollar amounts, hour counts, key terms) in **double asterisks**.
export const Emphasized: React.FC<{ children: string }> = ({ children }) => {
  if (!children || typeof children !== 'string') return <>{children}</>;
  const parts = children.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**')) {
          return <strong key={i} style={{ fontWeight: 600, color: '#1A1A1A' }}>{p.slice(2, -2)}</strong>;
        }
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
};

// Motion presets — match landing page vocabulary.
// Sections render fully visible by default; subtle decoration only.
// (Earlier version used opacity:0 reveals — caused below-fold sections to vanish on slower viewports.)
const inViewProps = {
  initial: { y: 14 },
  whileInView: { y: 0 },
  viewport: { once: true, margin: '-100px' } as const,
  transition: { duration: 0.7, ease: EASE },
};

// Blur-in headline on scroll — same as landing page RevealH2
const RevealHeadline: React.FC<{ children: React.ReactNode; as?: 'h2' | 'h3'; style?: React.CSSProperties }> = ({
  children, as = 'h2', style,
}) => {
  const reduceMotion = useReducedMotion();
  const Tag = as === 'h2' ? motion.h2 : motion.h3;
  return (
    <Tag
      initial={reduceMotion ? false : { y: 12 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: EASE }}
      style={style}
    >
      {children}
    </Tag>
  );
};

// Media-query hook (desktop-only effects; mobile gets the static version)
const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return matches;
};

// Animated counter — counts from 0 to value when in view
const Counter: React.FC<{ value: number; style?: React.CSSProperties }> = ({ value, style }) => {
  const [displayed, setDisplayed] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isInView) return;
    if (reduceMotion) { setDisplayed(value); return; }
    const controls = animate(0, value, {
      duration: 1.2,
      ease: EASE as unknown as [number, number, number, number],
      onUpdate: (v) => setDisplayed(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, isInView, reduceMotion]);

  return <span ref={ref} style={style}>{displayed}</span>;
};

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2
    style={{
      fontFamily: SERIF,
      fontWeight: 400,
      fontSize: 'clamp(1.875rem, 3.4vw, 2.75rem)',
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      color: '#1A1A1A',
    }}
  >
    {children}
  </h2>
);

const Section: React.FC<{ kicker: string; title: React.ReactNode; children: React.ReactNode }> = ({
  kicker, title, children,
}) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section {...inViewProps} className="py-16 lg:py-24">
      {/* Hairline sweep — paints in left-to-right when section enters viewport. */}
      <motion.div
        aria-hidden
        initial={reduceMotion ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.8, ease: EASE }}
        style={{ height: 1, background: 'var(--color-hairline)', transformOrigin: 'left', marginBottom: '4rem' }}
      />
      <div className="mb-12 lg:mb-16 space-y-3">
        <Kicker>{kicker}</Kicker>
        <RevealHeadline
          style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: 'clamp(2rem, 4vw, 3.25rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: '#1A1A1A',
          }}
        >
          {title}
        </RevealHeadline>
      </div>
      {children}
    </motion.section>
  );
};

// Highlight: matches landing-page Hero pattern exactly. Marker-sweep animation, sage strip behind text.
const Italic: React.FC<{ children: React.ReactNode; highlight?: boolean }> = ({ children, highlight = false }) => {
  const reduceMotion = useReducedMotion();
  if (!highlight) {
    return <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>{children}</span>;
  }
  return (
    <span style={{ fontStyle: 'italic', position: 'relative', color: '#1A1A1A' }}>
      {children}
      <motion.span
        aria-hidden
        initial={reduceMotion ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: '-30px' }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
        style={{
          position: 'absolute',
          left: '-2%',
          right: '-2%',
          bottom: '0.18em',
          height: '0.42em',
          backgroundColor: 'var(--color-accent)',
          transformOrigin: 'left',
          opacity: 0.25,
          zIndex: -1,
        }}
      />
    </span>
  );
};

const SerifBody: React.FC<{ children: React.ReactNode; large?: boolean; className?: string }> = ({
  children, large, className = '',
}) => (
  <p
    className={className}
    style={{
      fontFamily: BODY_SERIF,
      // Bigger on desktop, slightly smaller on mobile so 45+ char/line at 390px
      fontSize: large ? 'clamp(17px, 2.4vw, 19px)' : 'clamp(15.5px, 2.2vw, 17px)',
      lineHeight: 1.65,
      color: '#3D3D3B',
      fontWeight: 400,
    }}
  >
    {children}
  </p>
);

const Chip: React.FC<{ label: string; variant?: 'found' | 'missing' | 'neutral' }> = ({
  label, variant = 'neutral',
}) => {
  const styles =
    variant === 'found' ? { color: 'var(--color-accent)', borderColor: 'rgba(76,110,61,0.25)', background: 'rgba(76,110,61,0.06)' } :
    variant === 'missing' ? { color: '#A85439', borderColor: 'rgba(168,84,57,0.25)', background: 'rgba(168,84,57,0.05)' } :
    { color: 'rgba(26,26,26,0.7)', borderColor: 'rgba(26,26,26,0.12)', background: 'transparent' };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1.5"
      style={{
        fontFamily: MONO,
        fontSize: '11px',
        letterSpacing: '0.04em',
        border: '1px solid',
        ...styles,
      }}
    >
      {variant === 'found' && <CheckCircle className="w-3 h-3" />}
      {variant === 'missing' && <XCircle className="w-3 h-3" />}
      {label}
    </span>
  );
};

// ── Sections ──────────────────────────────────────────────────────────────────

function Section1CompanyBrief({ report }: { report: ReportJson }) {
  const { company_snapshot, anthropic_verified, openai_verified, tech_stack_assessment, linkedin_summary, github } = report;
  const { domain_age_years, email_infra, company_size, revenue_range } = report;

  const facts: string[] = [];
  if (company_size) facts.push(`${company_size} employees`);
  if (revenue_range) facts.push(`${revenue_range} revenue`);
  if (domain_age_years) facts.push(`${domain_age_years}-year-old domain`);
  if (email_infra === 'google_workspace') facts.push('Google Workspace');
  else if (email_infra === 'microsoft_365') facts.push('Microsoft 365');

  return (
    <Section kicker="The Company" title={<>Who they are, <Italic>what they run on</Italic>.</>}>
      {/* Editorial single-column flow. No more 280px sidebar (chips overflowed, Apollo paragraph wrapped cramped). */}
      <div className="space-y-12 max-w-4xl">
        {/* 1. Description + facts strip */}
        <div className="space-y-5">
          <SerifBody large>{company_snapshot.one_liner}</SerifBody>
          {facts.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-2" style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.04em', color: 'rgba(26,26,26,0.65)' }}>
              {facts.map((f, i) => (<span key={i}>{f}</span>))}
            </div>
          )}
        </div>

        {/* 2. LinkedIn + GitHub presence as a stat strip */}
        {((linkedin_summary && (linkedin_summary.followers || linkedin_summary.posts_30d != null)) || github) && (
          <div className="flex flex-wrap gap-x-12 gap-y-6 pt-6 border-t border-[color:var(--color-hairline)]">
            {linkedin_summary?.followers != null && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>LinkedIn followers</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(2rem, 3.4vw, 2.75rem)', lineHeight: 1, letterSpacing: '-0.02em', color: '#1A1A1A', marginTop: 4 }}>
                  {linkedin_summary.followers.toLocaleString()}
                </p>
              </div>
            )}
            {linkedin_summary?.posts_30d != null && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>Posts / 30d</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(2rem, 3.4vw, 2.75rem)', lineHeight: 1, letterSpacing: '-0.02em', color: '#1A1A1A', marginTop: 4 }}>
                  {linkedin_summary.posts_30d}
                </p>
              </div>
            )}
            {linkedin_summary?.last_post_days != null && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>Last post</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(2rem, 3.4vw, 2.75rem)', lineHeight: 1, letterSpacing: '-0.02em', color: linkedin_summary.last_post_days > 30 ? '#A85439' : '#1A1A1A', marginTop: 4 }}>
                  {linkedin_summary.last_post_days}d ago
                </p>
              </div>
            )}
            {!!linkedin_summary?.ai_mentions && linkedin_summary.ai_mentions > 0 && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>AI mentions</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(2rem, 3.4vw, 2.75rem)', lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--color-accent)', marginTop: 4 }}>
                  {linkedin_summary.ai_mentions}
                </p>
              </div>
            )}
            {github && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>GitHub repos</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(2rem, 3.4vw, 2.75rem)', lineHeight: 1, letterSpacing: '-0.02em', color: '#1A1A1A', marginTop: 4 }}>
                  {github.repos}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 3. DNS verification callout — high signal, deserves prominence */}
        {(anthropic_verified || openai_verified) && (
          <div className="px-6 py-5 border-l-2" style={{ borderColor: 'var(--color-accent)', background: 'rgba(76,110,61,0.05)' }}>
            <SerifBody>
              DNS records confirm active{' '}
              <Italic>
                {anthropic_verified && 'Anthropic'}
                {anthropic_verified && openai_verified && ' + '}
                {openai_verified && 'OpenAI'}
              </Italic>{' '}
              API usage. The gap here isn't awareness. It's <strong style={{ color: '#1A1A1A', fontWeight: 600 }}>deployment</strong>.
            </SerifBody>
          </div>
        )}

        {/* 4. Tech stack — full-width 2-column (confirmed | missing) side-by-side. No more 280px squeeze. */}
        <div className="pt-8 border-t border-[color:var(--color-hairline)]">
          <Kicker>Tech stack</Kicker>
          <div className="grid md:grid-cols-2 gap-8 mt-6">
            <div>
              <p style={{ fontFamily: MONO, fontSize: '10px', color: 'var(--color-accent)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Confirmed</p>
              <div className="flex flex-wrap gap-2">
                {tech_stack_assessment.confirmed_tools.length > 0
                  ? tech_stack_assessment.confirmed_tools.map(t => <Chip key={t} label={t} variant="found" />)
                  : <p style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(26,26,26,0.65)' }}>None detected</p>}
              </div>
            </div>
            <div>
              <p style={{ fontFamily: MONO, fontSize: '10px', color: '#A85439', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Missing</p>
              <div className="flex flex-wrap gap-2">
                {tech_stack_assessment.missing_critical_tools.length > 0
                  ? tech_stack_assessment.missing_critical_tools.slice(0, 6).map(t => <Chip key={t} label={t} variant="missing" />)
                  : <p style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(26,26,26,0.65)' }}>No critical gaps</p>}
              </div>
            </div>
          </div>
          <SerifBody className="mt-8 max-w-3xl">{tech_stack_assessment.sophistication_notes}</SerifBody>
        </div>
      </div>
    </Section>
  );
}

function SectionFundingTraffic({ report }: { report: ReportJson }) {
  const f = report.funding;
  const t = report.traffic;
  // Build the list of stats that ACTUALLY have values — no "—" placeholders ever.
  type Stat = { label: string; display: string };
  const stats: Stat[] = [];

  if (f?.total_funding_usd) {
    const v = f.total_funding_usd;
    stats.push({ label: 'Total raised', display: v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K` });
  }
  if (f?.last_round_type) stats.push({ label: 'Last round', display: f.last_round_type });
  if (f?.last_round_date) stats.push({ label: 'Last round date', display: f.last_round_date });
  if (f && Array.isArray(f.investors) && f.investors.length > 0) {
    stats.push({ label: 'Investors', display: String(f.investors.length) });
  }
  if (t?.monthly_visits) stats.push({ label: 'Monthly visits', display: t.monthly_visits.toLocaleString() });
  if (t?.global_rank) stats.push({ label: 'Global rank', display: `#${t.global_rank.toLocaleString()}` });
  if (t?.bounce_rate != null) stats.push({ label: 'Bounce rate', display: `${(t.bounce_rate * 100).toFixed(0)}%` });
  if (t?.avg_visit_duration) {
    const v = t.avg_visit_duration as unknown;
    let display = '';
    if (typeof v === 'number') {
      // Fast SimilarWeb returns raw seconds (e.g. 53.32). Format as MM:SS.
      const total = Math.round(v);
      const m = Math.floor(total / 60);
      const s = total % 60;
      display = m > 0 ? `${m}m ${s}s` : `${s}s`;
    } else {
      display = String(v);
    }
    stats.push({ label: 'Avg visit', display });
  }
  if (t?.top_country) stats.push({ label: 'Top country', display: t.top_country });

  // New traffic-context blocks (only shown when SimilarWeb returned them)
  const sources = t?.traffic_sources;
  const sourceRows: Array<{ label: string; pct: number; tone: string }> = [];
  if (sources) {
    const push = (label: string, val: number | undefined, tone: string) => {
      if (val != null && val > 0.005) sourceRows.push({ label, pct: val, tone });
    };
    push('Organic search', sources.search, 'var(--color-accent)');
    push('Direct',         sources.direct, '#1A1A1A');
    push('Referrals',      sources.referrals, 'rgba(26,26,26,0.6)');
    push('Social',         sources.social, 'rgba(26,26,26,0.6)');
    push('Paid',           sources.paidReferrals, '#A85439');
    push('Email',          sources.mail, 'rgba(26,26,26,0.6)');
  }
  const topKeywords = (t?.top_keywords || []).slice(0, 5);
  const topCountries = (t?.top_countries || []).slice(0, 3);

  // Hide section entirely if nothing populated
  if (stats.length === 0 && sourceRows.length === 0 && topKeywords.length === 0) return null;

  return (
    <Section kicker="The Numbers" title={<>The signals <Italic>behind the brand</Italic>.</>}>
      {stats.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 mb-16">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ y: 12 }}
              whileInView={{ y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, ease: EASE, delay: i * 0.06 }}
              className="border-l-2 border-[color:var(--color-hairline)] pl-4"
            >
              <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
                {s.label}
              </p>
              <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(2.25rem, 3.6vw, 3.25rem)', lineHeight: 1.05, letterSpacing: '-0.02em', color: '#1A1A1A', marginTop: 8 }}>
                <Scramble value={s.display} />
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Traffic-source breakdown + keyword + country context (only when SimilarWeb returned them) */}
      {(sourceRows.length > 0 || topKeywords.length > 0 || topCountries.length > 0) && (
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16 pt-12 border-t border-[color:var(--color-hairline)]">
          {sourceRows.length > 0 && (
            <div>
              <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
                Where the traffic comes from
              </p>
              <div className="mt-6 space-y-4">
                {sourceRows.map((row) => (
                  <div key={row.label}>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span style={{ fontFamily: BODY_SERIF, fontSize: '15px', color: '#1A1A1A' }}>{row.label}</span>
                      <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '20px', color: row.tone, fontVariantNumeric: 'tabular-nums' }}>
                        {(row.pct * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ height: 2, background: 'rgba(26,26,26,0.08)' }}>
                      <motion.div
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: row.pct }}
                        viewport={{ once: true, margin: '-30px' }}
                        transition={{ duration: 1.0, ease: EASE, delay: 0.1 }}
                        style={{ height: '100%', background: row.tone, transformOrigin: 'left' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-10">
            {topKeywords.length > 0 && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
                  Top search queries
                </p>
                <ul className="mt-4 space-y-2">
                  {topKeywords.map((k) => (
                    <li key={k} style={{ fontFamily: BODY_SERIF, fontSize: '16px', color: '#1A1A1A', fontStyle: 'italic' }}>
                      "{k}"
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {topCountries.length > 0 && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
                  Audience geography
                </p>
                <div className="mt-4 space-y-1.5">
                  {topCountries.map((c) => (
                    <div key={c.countryName} className="flex items-baseline justify-between gap-3">
                      <span style={{ fontFamily: BODY_SERIF, fontSize: '15px', color: '#1A1A1A' }}>{c.countryName}</span>
                      <span style={{ fontFamily: MONO, fontSize: '12px', color: 'rgba(26,26,26,0.6)', fontVariantNumeric: 'tabular-nums' }}>
                        {(c.visitsShare * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Source attribution: trust signal — every stat traces to a real provider */}
      <p className="mt-12" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
        Sources: SimilarWeb (traffic) · Apollo (headcount + revenue) · DNS verification
      </p>
      {f?.crunchbase_url && (
        <a
          href={f.crunchbase_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-4 py-3 -my-3 transition-colors"
          style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.7)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(26,26,26,0.7)')}
        >
          View Crunchbase profile <ArrowRight className="w-3 h-3" />
        </a>
      )}
    </Section>
  );
}

function Section3Opportunities({ report }: { report: ReportJson }) {
  return (
    <Section
      kicker={`${report.opportunities.length} Opportunities`}
      title={<>Where time <Italic>quietly leaks</Italic>.</>}
    >
      <SerifBody className="mb-10 max-w-2xl">
        Each gap below is sourced from a specific signal we observed. No speculation. The dollar values assume mid-tier ops cost.
      </SerifBody>
      <div className="space-y-2">
        {report.opportunities.map((opp, i) => (
          <OpportunityCard key={i} opportunity={opp} index={i} prominent={i === 0} />
        ))}
      </div>
    </Section>
  );
}

function AdCreativeCard({ creative, platform }: { creative: AdCreative; platform: 'google' | 'linkedin' | 'meta' }) {
  const isRenderableImage = (url: string | null | undefined): boolean => {
    if (!url) return false;
    if (/\.(js|html?)(\?|$)/i.test(url)) return false; // Google JS iframes don't render as <img>
    return true;
  };

  const candidateImage = (creative.images && creative.images[0]) || creative.preview_url || null;
  const initialImage = isRenderableImage(candidateImage) ? candidateImage : null;
  const [imgFailed, setImgFailed] = React.useState(false);
  const showImage = initialImage && !imgFailed;
  const realTitle = creative.title || creative.headline || null;
  const body = (creative.body || '').trim();
  const cta = creative.cta_text || null;
  // LinkedIn ads: adLibraryUrl points to the actual ad page (not the company page).
  // Prefer it over advertiser_url which is the company landing page (audit feedback).
  const link = creative.adLibraryUrl || creative.ad_library_url || creative.link_url || creative.ad_url || creative.advertiser_url || null;
  const platformLabel = platform === 'google' ? 'Google' : platform === 'linkedin' ? 'LinkedIn' : 'Meta';

  // Three render modes — chosen by what data the platform actually returns:
  // (a) Image card  — Meta + image-bearing creatives
  // (b) Pull-quote  — LinkedIn ads (rich body, no image)
  // (c) Compact tag — Google text-only ads (no body, only ad_format)
  const mode: 'image' | 'quote' | 'tag' = showImage ? 'image' : (body.length > 30 ? 'quote' : 'tag');

  const platformChip = (
    <div className="flex items-center gap-2">
      <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>{platformLabel}</span>
      {creative.is_active && (
        <span style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>● Active</span>
      )}
    </div>
  );

  if (mode === 'quote') {
    return (
      <div
        className="p-7 flex flex-col gap-4 hover:bg-paper-sunk/30 transition-colors"
        style={{ borderLeft: '2px solid var(--color-accent)' }}
      >
        {platformChip}
        <blockquote
          style={{
            fontFamily: SERIF,
            fontStyle: 'italic',
            fontSize: 'clamp(18px, 2.2vw, 22px)',
            lineHeight: 1.35,
            letterSpacing: '-0.01em',
            color: '#1A1A1A',
          }}
        >
          "{body.length > 220 ? body.slice(0, 217) + '…' : body}"
        </blockquote>
        {realTitle && (
          <p style={{ fontFamily: BODY_SERIF, fontSize: '14px', color: 'rgba(26,26,26,0.65)' }}>from {realTitle}</p>
        )}
        {link && (
          <a href={link} target="_blank" rel="noopener noreferrer"
             style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-accent)' }}
             className="inline-flex items-center gap-1.5 mt-auto py-2 -my-2 hover:underline">
            {cta || 'View ad'} <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  }

  // Google text-only "tag" mode dropped per audit (visually inconsistent next to pull-quote/image cards).
  // Cards with no body, headline, OR image are filtered upstream in SectionAdActivity.
  if (mode === 'tag') return null;

  // mode === 'image'
  return (
    <div className="border border-[color:var(--color-hairline)] hover:border-ink/20 transition-colors flex flex-col min-h-[44px]">
      <div className="aspect-[16/10] overflow-hidden" style={{ background: '#EFEAE2' }}>
        <img src={initialImage!} alt={realTitle ?? `${platformLabel} ad creative`} className="w-full h-full object-cover" loading="lazy" onError={() => setImgFailed(true)} />
      </div>
      <div className="p-5 flex-1 flex flex-col gap-3">
        {platformChip}
        {realTitle && (
          <p style={{ fontFamily: SERIF, fontSize: '17px', lineHeight: 1.25, letterSpacing: '-0.01em', color: '#1A1A1A' }} className="line-clamp-2">{realTitle}</p>
        )}
        {body && <SerifBody className="line-clamp-3"><span style={{ fontSize: '14px' }}>{body}</span></SerifBody>}
        {cta && link && (
          <div className="mt-auto pt-3 border-t border-[color:var(--color-hairline)]">
            <a href={link} target="_blank" rel="noopener noreferrer"
               style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent)' }}
               className="inline-flex items-center gap-1.5 py-1 -my-1 hover:underline">
              {cta} <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionAdActivity({ report }: { report: ReportJson }) {
  const ads = report.ads;
  if (!ads) return null;

  // Frontend safety filter: drop creatives that have NO showable content at all.
  // Body counts as content (LinkedIn ads are body-only), as does image, title, headline.
  // Google text-only ads (no body, no image) still pass via ad_format → "tag" mode.
  const isUsable = (c: AdCreative) => {
    const hasText = !!(c.title || c.headline || (c.body && c.body.trim().length > 5));
    const hasImage = !!((c.images && c.images[0]) || c.preview_url);
    const hasGoogleTag = !!(c.ad_format && (c.first_shown || c.last_shown || c.ad_url));
    return hasText || hasImage || hasGoogleTag;
  };

  const all: Array<{ platform: 'google' | 'linkedin' | 'meta'; creative: AdCreative }> = [];
  (ads.google_ads?.creatives || []).filter(isUsable).slice(0, 3).forEach(c => all.push({ platform: 'google', creative: c }));
  (ads.linkedin_ads?.creatives || []).filter(isUsable).slice(0, 3).forEach(c => all.push({ platform: 'linkedin', creative: c }));
  (ads.meta_ads?.creatives || []).filter(isUsable).slice(0, 3).forEach(c => all.push({ platform: 'meta', creative: c }));
  if (all.length === 0) return null;

  return (
    <Section kicker="Live Ad Activity" title={<>Where their <Italic>spend lands</Italic>.</>}>
      <SerifBody className="mb-10 max-w-2xl">
        Pulled live from Google, Meta, and LinkedIn ad libraries. Look at the rotation cadence and creative variety: that's the test velocity, or absence of it.
      </SerifBody>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {all.map((item, i) => (
          <AdCreativeCard key={i} creative={item.creative} platform={item.platform} />
        ))}
      </div>
    </Section>
  );
}

function Section4AiAdoption({ report }: { report: ReportJson }) {
  const { company_snapshot, anthropic_verified, openai_verified, linkedin_summary } = report;
  const signal = company_snapshot.ai_adoption_signal;

  // P1 #13: "Unknown" reframed as a sales motion (loss-frame) rather than a non-statement
  const meta: Record<string, { label: string; suffix?: string; tone: string; description: string }> = {
    early_adopter: { label: 'Early Adopter.', tone: 'var(--color-accent)', description: 'Actively integrating AI into operations. Ahead of the peer group.' },
    on_par: { label: 'On Par.', tone: '#A85439', description: 'Awareness is there, but deployment lags behind leading firms.' },
    behind: { label: 'Behind.', tone: '#9B2C2C', description: 'No AI tooling detected. Each month of delay compounds the gap.' },
    unknown: {
      label: 'Unknown.',
      suffix: "and that's data.",
      tone: 'rgba(26,26,26,0.85)',
      description: 'No verified AI provider, no LLM tooling in the public stack, no AI-themed posts in the last 30 days. Either the team is still scoping or the work is happening off-site. Both are gaps the Assessment closes.',
    },
  };
  const m = meta[signal] ?? meta.unknown;

  return (
    <Section kicker="AI Adoption" title={<>Where they sit <Italic>on the curve</Italic>.</>}>
      <div className="space-y-6 max-w-2xl">
        <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1, letterSpacing: '-0.02em', color: m.tone }}>
          {m.label}
          {m.suffix && <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}> {m.suffix}</span>}
        </h3>
        <SerifBody large>{m.description}</SerifBody>
        {(anthropic_verified || openai_verified) && (
          <div className="px-5 py-4 border-l-2" style={{ borderColor: 'var(--color-accent)', background: 'rgba(76,110,61,0.04)' }}>
            <SerifBody>
              DNS verification confirms{' '}
              <Italic>
                {anthropic_verified && 'Anthropic'}{anthropic_verified && openai_verified && ' + '}{openai_verified && 'OpenAI'}
              </Italic>{' '}
              API usage. They're not experimenting. They're shipping.
            </SerifBody>
          </div>
        )}
        {!!linkedin_summary?.ai_mentions && linkedin_summary.ai_mentions > 0 && (
          <SerifBody>
            <Italic>{linkedin_summary.ai_mentions}</Italic> LinkedIn posts mentioning AI/automation in the last 30 days.
          </SerifBody>
        )}
      </div>
    </Section>
  );
}

function Section5Competitive({ report }: { report: ReportJson }) {
  const ctx = report.competitive_context || '';
  // Hide if no real data OR if Claude apologized for not analyzing (trust-killer admission per audit).
  const apologized = /not analyzed|wasn'?t analyzed|insufficient|no competit/i.test(ctx);
  const tooThin = ctx.trim().split(/\s+/).length < 30;
  if (!ctx || apologized || (tooThin && (!report.competitors || report.competitors.length === 0))) return null;
  return (
    <Section kicker="Competitive Context" title={<>The <Italic>field they play in</Italic>.</>}>
      <SerifBody large className="mb-8 max-w-2xl">{report.competitive_context}</SerifBody>
      {report.competitors.length > 0 && (
        <div className="space-y-px border-y border-[color:var(--color-hairline)]">
          {report.competitors.map((c, i) => (
            <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
               className="flex items-start gap-4 py-5 hover:bg-[rgba(26,26,26,0.02)] transition-colors group border-b border-[color:var(--color-hairline)] last:border-b-0">
              <div className="flex-1">
                <p style={{ fontFamily: SERIF, fontSize: '20px', letterSpacing: '-0.01em', color: '#1A1A1A' }} className="group-hover:text-accent transition-colors">{c.title}</p>
                {c.description && <SerifBody className="mt-1 line-clamp-2"><span style={{ fontSize: '15px' }}>{c.description}</span></SerifBody>}
              </div>
              <ExternalLink className="w-4 h-4 text-ink-mute mt-1.5 group-hover:text-accent transition-colors shrink-0" />
            </a>
          ))}
        </div>
      )}
    </Section>
  );
}

// ACT 2: Dark full-bleed score reveal — the cinematic moment.
// AI-anchored labels: tech_stack → AI-ready stack, ad_activity → Spend visibility,
// content_engine → Content velocity, ai_signals → AI adoption, traffic_quality → Audience quality.
function SectionScoreRevealDark({ report }: { report: ReportJson }) {
  const sb = report.score_breakdown;
  const reduceMotion = useReducedMotion();
  if (!sb) return null;
  const cats: Array<{ key: keyof NonNullable<ReportJson['score_breakdown']>; label: string }> = [
    { key: 'tech_stack',     label: 'AI-ready stack' },
    { key: 'ai_signals',     label: 'AI adoption' },
    { key: 'content_engine', label: 'Content velocity' },
    { key: 'ad_activity',    label: 'Spend visibility' },
    { key: 'traffic_quality',label: 'Audience quality' },
  ];

  // Sage on dark for high; soft warm for low. Brighter than the light-mode palette so it pops on #0F0F0F.
  const toneFor = (pct: number) =>
    pct >= 70 ? '#7FA868' : pct >= 40 ? '#D89254' : '#C76354';

  return (
    <section
      className="py-20 lg:py-32"
      style={{ background: '#0F0F0F', color: '#F7F4EF' }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        {/* Hairline sweep in sage — paints in left-to-right when section enters viewport */}
        <motion.div
          aria-hidden
          initial={reduceMotion ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.9, ease: EASE }}
          style={{ height: 1, background: 'rgba(247,244,239,0.18)', transformOrigin: 'left', marginBottom: '4rem' }}
        />

        <div className="mb-14 lg:mb-20">
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.55)' }}>
            The AI Verdict
          </p>
          <RevealHeadline
            style={{
              fontFamily: SERIF, fontWeight: 400,
              fontSize: 'clamp(2.25rem, 5vw, 4rem)', lineHeight: 1.02,
              letterSpacing: '-0.025em', color: '#F7F4EF', marginTop: 12,
            }}
          >
            How the <span style={{ fontStyle: 'italic', color: '#7FA868' }}>{report.automation_score}</span> was earned.
          </RevealHeadline>
        </div>

        <div className="grid lg:grid-cols-[auto_1fr] gap-12 lg:gap-20 items-start">
          {/* Left: massive score */}
          <div>
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.55)' }}>
              Automation Opportunity Score
            </p>
            <p style={{
              fontFamily: SERIF, fontWeight: 400, fontStyle: 'italic',
              fontSize: 'clamp(7rem, 14vw, 12rem)', lineHeight: 0.92,
              letterSpacing: '-0.04em', color: '#7FA868', marginTop: 12,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <Scramble value={String(report.automation_score)} duration={1.2} />
            </p>
            <p style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.7)', marginTop: 8 }}>
              / 100  ·  Grade <span style={{ color: '#7FA868' }}>{report.automation_grade}</span>
            </p>
          </div>

          {/* Right: 5 breakdown rows. Wider, calmer than the old version. */}
          <div className="space-y-7 lg:pt-2">
            {cats.map(({ key, label }) => {
              const c = sb[key];
              if (!c) return null;
              const pct = Math.min(100, (c.value / c.max) * 100);
              const tone = toneFor(pct);
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between mb-2 gap-4">
                    <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.7)' }}>
                      {label}
                    </p>
                    <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '22px', lineHeight: 1, color: tone, fontVariantNumeric: 'tabular-nums' }}>
                      {c.value}<span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(247,244,239,0.45)', marginLeft: 6, fontStyle: 'normal' }}>/ {c.max}</span>
                    </p>
                  </div>
                  <div style={{ height: 3, background: 'rgba(247,244,239,0.10)', position: 'relative', overflow: 'hidden' }}>
                    <motion.div
                      initial={reduceMotion ? false : { scaleX: 0 }}
                      whileInView={{ scaleX: pct / 100 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}
                      style={{ height: '100%', background: tone, transformOrigin: 'left' }}
                    />
                  </div>
                  <p className="mt-2.5" style={{ fontFamily: BODY_SERIF, fontSize: '14.5px', color: 'rgba(247,244,239,0.72)', lineHeight: 1.5 }}>
                    {c.rationale}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Peer comparison — only when meaningfully different */}
        <PeerComparisonInlineDark report={report} />
      </div>
    </section>
  );
}

// Dark-mode variant of peer comparison (lives inside the dark band)
function PeerComparisonInlineDark({ report }: { report: ReportJson }) {
  const pm = report.peer_median;
  if (!pm) return null;
  const diff = report.automation_score - pm.score;
  if (diff === 0) return null;
  const tone = diff > 0 ? '#7FA868' : '#D89254';
  const label = diff > 0 ? `+${diff}` : `${diff}`;
  return (
    <div className="mt-16 pt-8" style={{ borderTop: '1px solid rgba(247,244,239,0.12)' }}>
      <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.55)' }}>
        Peer median, {pm.size_tier_compared}
      </p>
      <div className="flex items-baseline gap-5 mt-3">
        <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(2rem, 3vw, 2.75rem)', lineHeight: 1, color: '#F7F4EF', fontVariantNumeric: 'tabular-nums' }}>
          {pm.score}
        </p>
        <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '20px', color: tone }}>
          ({label} vs them)
        </p>
      </div>
      <p className="mt-3 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '17px', lineHeight: 1.55, color: 'rgba(247,244,239,0.78)' }}>
        {pm.interpretation}
      </p>
    </div>
  );
}

// PHASE 1: LinkedIn content sample — show 1-2 actual posts they published.
function SectionContentSample({ report }: { report: ReportJson }) {
  const posts = report.linkedin_summary?.posts;
  if (!posts || posts.length === 0) return null;
  return (
    <Section kicker="Their Voice" title={<>What they're <Italic>publishing</Italic>.</>}>
      <SerifBody className="mb-10 max-w-2xl">
        Two recent LinkedIn posts, verbatim. Cadence matters more than content here.
      </SerifBody>
      <div className="grid md:grid-cols-2 gap-6">
        {posts.slice(0, 2).map((p, i) => (
          <motion.blockquote
            key={i}
            initial={{ y: 12 }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
            className="px-6 py-5 hover:bg-paper-sunk/30 transition-colors"
            style={{ borderLeft: '2px solid var(--color-accent)' }}
          >
            <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(16px, 1.6vw, 18px)', lineHeight: 1.5, color: '#1A1A1A' }}>
              "{p.text.length > 320 ? p.text.slice(0, 317) + '…' : p.text}"
            </p>
            <div className="mt-4 flex items-center gap-4" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)' }}>
              {p.date && <span>{new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
              {p.reactions != null && <span>{p.reactions} reactions</span>}
            </div>
          </motion.blockquote>
        ))}
      </div>
    </Section>
  );
}

// PHASE 2: Hiring signals — open roles tell you what they're trying to scale.
function SectionHiring({ report }: { report: ReportJson }) {
  const h = report.hiring;
  if (!h || (h.open_count === 0 && (!h.sample_titles || h.sample_titles.length === 0))) return null;
  return (
    <Section kicker="Hiring" title={<>What they're <Italic>paying humans</Italic> to do.</>}>
      <SerifBody className="mb-12 max-w-2xl">
        Each open seat is current evidence of a workflow that exists today. Some roles are core human work. Others are repetitive patterns where agents are starting to compete.
      </SerifBody>
      <div className="grid lg:grid-cols-[auto_1fr] gap-12 lg:gap-20 items-start">
        <div>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
            Open roles
          </p>
          <p style={{
            fontFamily: SERIF, fontStyle: 'italic',
            fontSize: 'clamp(5rem, 9vw, 8rem)', lineHeight: 0.9,
            letterSpacing: '-0.04em', color: 'var(--color-accent)', marginTop: 10,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <Scramble value={String(h.open_count)} duration={1.0} />
          </p>
          <p className="mt-3" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
            via LinkedIn jobs
          </p>
        </div>
        {h.sample_titles && h.sample_titles.length > 0 && (
          <div>
            <p className="mb-4" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
              A sample of what they're hiring
            </p>
            <div className="space-y-px border-y border-[color:var(--color-hairline)]">
              {h.sample_titles.slice(0, 5).map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ y: 8 }}
                  whileInView={{ y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.5, ease: EASE, delay: i * 0.06 }}
                  className="py-4 border-b border-[color:var(--color-hairline)] last:border-b-0"
                >
                  <p style={{ fontFamily: SERIF, fontSize: '20px', letterSpacing: '-0.01em', color: '#1A1A1A' }}>
                    {t.replace(/\s*\([^)]*\)\s*$/, '').trim()}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

// PHASE 2: Recent news — momentum signals from the last 90 days.
function SectionNews({ report }: { report: ReportJson }) {
  const news = report.recent_news;
  if (!news || news.length === 0) return null;
  return (
    <Section kicker="Recent Momentum" title={<>What's happened in <Italic>the last 90 days</Italic>.</>}>
      <SerifBody className="mb-10 max-w-2xl">
        Public mentions and announcements. New funding or product launches usually mean new workflows worth automating early.
      </SerifBody>
      <div className="space-y-px border-y border-[color:var(--color-hairline)]">
        {news.slice(0, 3).map((n, i) => (
          <a
            key={i}
            href={n.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-4 py-5 hover:bg-[rgba(26,26,26,0.02)] transition-colors group border-b border-[color:var(--color-hairline)] last:border-b-0"
          >
            <div className="flex-1">
              <p style={{ fontFamily: SERIF, fontSize: '20px', letterSpacing: '-0.01em', color: '#1A1A1A' }} className="group-hover:text-accent transition-colors">{n.title}</p>
              <div className="mt-1 flex items-center gap-3" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)' }}>
                {n.source && <span>{n.source}</span>}
                {n.date && <span>{n.date}</span>}
              </div>
              {n.snippet && <SerifBody className="mt-2 line-clamp-2"><span style={{ fontSize: '15px' }}>{n.snippet}</span></SerifBody>}
            </div>
            <ExternalLink className="w-4 h-4 text-ink-mute mt-1.5 group-hover:text-accent transition-colors shrink-0" />
          </a>
        ))}
      </div>
    </Section>
  );
}

// PHASE 1: Week-1 action card — sage-bordered "if you only do one thing this month" callout before the CTA.
function SectionWeekOneAction({ report }: { report: ReportJson }) {
  const w = report.week_one_action;
  if (!w) return null;
  return (
    <motion.section
      {...inViewProps}
      className="py-16 lg:py-20"
    >
      <div className="max-w-3xl px-6 lg:px-10 py-10 lg:py-12 -mx-6 lg:-mx-10" style={{ background: 'rgba(76,110,61,0.06)', borderLeft: '3px solid var(--color-accent)' }}>
        <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
          If you only do one thing this month
        </p>
        <h3 style={{
          fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.875rem, 3.4vw, 2.75rem)',
          lineHeight: 1.05, letterSpacing: '-0.02em', color: '#1A1A1A', marginTop: 12,
        }}>
          {w.title}
        </h3>
        <SerifBody large className="mt-5"><Emphasized>{w.why}</Emphasized></SerifBody>
        {w.tools && w.tools.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {w.tools.map((t) => <Chip key={t} label={t} variant="found" />)}
          </div>
        )}
        <p className="mt-5" style={{ fontFamily: BODY_SERIF, fontSize: '15px', color: 'rgba(26,26,26,0.7)' }}>
          <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)', marginRight: 8 }}>Outcome:</span>
          <Emphasized>{w.expected_outcome}</Emphasized>
        </p>
      </div>
    </motion.section>
  );
}

function Section6CTA({ report, companyName }: { report: ReportJson; companyName: string }) {
  const calendlyUrl = `${CALENDLY_BASE}?utm_source=scan&utm_content=${encodeURIComponent(companyName)}&a1=${encodeURIComponent(report.top_gap_title)}`;

  return (
    <section className="border-t border-[color:var(--color-hairline)] py-24 lg:py-32">
      <div className="max-w-3xl">
        <Kicker>Your next step</Kicker>
        <h2
          className="mt-6 mb-8"
          style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: 'clamp(2.5rem, 6vw, 5rem)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: '#1A1A1A',
          }}
        >
          Your highest-priority gap is{' '}
          <Italic highlight>{report.top_gap_title}</Italic>.
        </h2>
        <SerifBody large className="mb-3 max-w-xl"><Emphasized>{report.top_gap_summary}</Emphasized></SerifBody>
        <SerifBody className="mb-6 max-w-xl"><span style={{ color: 'rgba(26,26,26,0.55)' }}>In the Agent-Ready Assessment, we turn this into a 90-day implementation plan with tool selection, build sequence, and ROI model specific to your team.</span></SerifBody>

        {/* Authority chain: who Ivan is, why this scan was credible. Audit P1 — page assumed reader already knew. */}
        <div className="mb-10 max-w-xl flex items-start gap-4 py-5 border-t border-b border-[color:var(--color-hairline)]">
          <img
            src="/ivan-portrait-400.webp"
            alt="Ivan Manfredi"
            loading="lazy"
            className="w-12 h-12 object-cover shrink-0"
            style={{ borderRadius: 0 }}
            onError={fallbackOnError}
          />
          <p style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.55, color: 'rgba(26,26,26,0.75)' }}>
            <span style={{ color: '#1A1A1A', fontWeight: 600 }}>Ivan Manfredi</span> builds AI systems for B2B service businesses. Every project pays back in 90 days, or he doesn't build it. This scan is the same diagnostic he runs on every Assessment client.
          </p>
        </div>

        {/* Price disclosure ABOVE the button per audit (avoids sticker shock after click) */}
        <p className="mb-4" style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.85)' }}>
          $2,000 · 1 week · 60-min findings walkthrough
        </p>

        <div className="flex flex-col sm:flex-row items-start gap-3">
          <a
            href={calendlyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-7 py-3.5"
            style={{
              fontFamily: BODY_SERIF,
              fontWeight: 600,
              fontSize: '16px',
              backgroundColor: '#1A1A1A',
              color: '#F7F4EF',
            }}
          >
            Book your Agent-Ready Assessment <ArrowRight size={18} />
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Cinematic Hero (Apple-style scroll-driven pin) ──────────────────────────
// On desktop: hero pins for ~180vh of scroll. Score scales 1 → 2.4x while lede + signals fade out.
// Once user scrolls past, hero releases and sections start.
// Mobile + reduce-motion: static fallback.

// Static editorial hero. The cinematic pin attempt was reverted (visual choreography needed more
// iteration than time allowed — score-scale + fade overlapped content awkwardly during the
// release moment). Will revisit as a dedicated design pass.
const CinematicHero: React.FC<{
  companyName: string;
  report: ReportJson;
  scan: { completed_at: string | null; created_at: string };
  reduceMotion: boolean;
}> = ({ companyName, report, scan, reduceMotion }) => {
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6">
      <div className="pt-10 lg:pt-16 pb-12 lg:pb-20">
        <HeroBylineRow scan={scan} reduceMotion={reduceMotion} />
        <div className="grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-end">
          <div>
            {report.logo_url && (
              <img src={report.logo_url} alt="" loading="lazy" className="w-16 h-16 object-contain mb-6"
                style={{ background: '#fff', border: '1px solid rgba(26,26,26,0.08)', padding: 6 }}
                onError={fallbackOnError} />
            )}
            <motion.h1
              initial={reduceMotion ? false : { y: 10 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.15, duration: 0.7, ease: EASE }}
              style={{
                fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(3rem, 7vw, 6rem)',
                lineHeight: 0.94, letterSpacing: '-0.025em', color: '#1A1A1A', marginBottom: '1.25rem',
              }}
            >
              {companyName}
            </motion.h1>
            <SerifBody large className="max-w-xl"><Emphasized>{report.score_rationale}</Emphasized></SerifBody>
          </div>
          <div className="lg:w-80 lg:shrink-0">
            <Kicker>Automation Opportunity Score</Kicker>
            <div className="mt-4">
              <ScoreBar score={report.automation_score} grade={report.automation_grade} size="lg" />
            </div>
          </div>
        </div>
        <HeroTeaserSignals signals={report.teaser_signals} />
      </div>
    </div>
  );
};

// Shared sub-components for the hero (used in both pinned + static modes)
const HeroBylineRow: React.FC<{ scan: { completed_at: string | null; created_at: string }; reduceMotion: boolean }> = ({ scan, reduceMotion }) => (
  <div className="flex items-center gap-3 mb-8">
    <motion.span
      animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1] }}
      transition={reduceMotion ? undefined : { duration: 2, repeat: Infinity }}
      style={{ color: 'var(--color-accent)', fontSize: '8px' }}
    >●</motion.span>
    <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
      AI Opportunity Scan · {new Date(scan.completed_at ?? scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
    </span>
  </div>
);

const HeroTeaserSignals: React.FC<{ signals: string[] | undefined }> = ({ signals }) => {
  if (!signals || signals.length === 0) return null;
  return (
    <div className="mt-16 grid sm:grid-cols-3 gap-6 lg:gap-10">
      {signals.map((s, i) => (
        <div key={i} className="border-t-2 pt-4" style={{ borderColor: 'var(--color-accent)' }}>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)', marginBottom: 8 }}>
            Signal {String(i + 1).padStart(2, '0')}
          </p>
          <SerifBody>{s.replace(/^⚠\s?/, '')}</SerifBody>
        </div>
      ))}
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

const ScanReportPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { scan, loading, error } = useScan(slug ?? null);
  const reduceMotion = useReducedMotion();

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>Loading report</p>
        </div>
      </div>
    );
  }

  if (error || !scan || !scan.report_json) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="text-center max-w-sm px-6">
          <AlertCircle className="w-12 h-12 text-ink-mute mx-auto mb-4" />
          <h1 style={{ fontFamily: SERIF, fontSize: '32px', color: '#1A1A1A' }} className="mb-2">Report not available</h1>
          <SerifBody className="mb-6">
            {error ?? "This scan report isn't ready yet, or the link may be incorrect."}
          </SerifBody>
          <Link to="/audit" className="inline-flex items-center gap-2 hover:underline"
                style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
            <ArrowLeft className="w-4 h-4" /> Run a new scan
          </Link>
        </div>
      </div>
    );
  }

  const report = scan.report_json;
  const companyName = scan.company_name ?? scan.domain;

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ScrollProgress />
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur-sm border-b border-[color:var(--color-hairline)]" style={{ background: 'rgba(247,244,239,0.9)' }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="transition-colors hover:text-accent"
                style={{ fontFamily: BODY_SERIF, fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>
            Iván Manfredi
          </Link>
          <span className="hidden md:block" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
            AI Opportunity Scan · {companyName}
          </span>
          <a
            href={`https://calendly.com/im-ivanmanfredi/30min?utm_source=scan`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-4"
            style={{
              fontFamily: BODY_SERIF,
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: '#1A1A1A',
              color: '#F7F4EF',
              minHeight: 44,
            }}
          >
            Book your Assessment <ArrowRight size={14} />
          </a>
        </div>
      </header>

      {/* CINEMATIC HERO PIN — Apple-style scroll-driven scale + fade.
         Desktop only (lg+). Mobile + reduced-motion get the static fallback. */}
      <CinematicHero
        companyName={companyName}
        report={report}
        scan={scan}
        reduceMotion={!!reduceMotion}
      />

      {/* ACT 1 → ACT 2: company brief, then full-bleed dark score reveal (the wow beat) */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <Section1CompanyBrief report={report} />
      </div>
      <SectionScoreRevealDark report={report} />

      {/* ACT 3 → ACT 5: gaps, then proof, then action */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6 pb-24">
        <Section3Opportunities report={report} />
        <SectionFundingTraffic report={report} />
        <SectionAdActivity report={report} />
        <SectionHiring report={report} />
        <SectionContentSample report={report} />
        <SectionNews report={report} />
        <Section4AiAdoption report={report} />
        <Section5Competitive report={report} />
        <SectionWeekOneAction report={report} />
        <Section6CTA report={report} companyName={companyName} />
      </div>
    </div>
  );
};

export default ScanReportPage;
