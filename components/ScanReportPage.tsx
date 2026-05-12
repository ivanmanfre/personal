// components/ScanReportPage.tsx — build-id: nudge-2026-05-12-1
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, animate, AnimatePresence, useInView, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import {
  ExternalLink, CheckCircle, XCircle, AlertCircle, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { useScan } from '../hooks/useScan';
import { ScoreBar } from './scan/ScoreBar';
import { OpportunityCard } from './scan/OpportunityCard';
import type { ReportJson, AdCreative, Opportunity } from '../lib/scanTypes';
import { gradeColor } from '../lib/scanApi';

const CALENDLY_BASE = 'https://calendly.com/im-ivanmanfredi/30min';

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';
const EASE = [0.22, 0.84, 0.36, 1] as const;

// ── Editorial primitives ──────────────────────────────────────────────────────

// Section masthead. Each section starts with this so the reader always knows
// "I am now in section X". Hard-to-miss kicker + sage accent rule.
const Kicker: React.FC<{ children: React.ReactNode; section?: string | number }> = ({ children, section }) => (
  <div className="mb-1">
    {/* Sage accent rule + section label sit on the same baseline above the kicker text */}
    {section != null && (
      <div className="flex items-center gap-3 mb-2">
        <span aria-hidden style={{ display: 'inline-block', height: 1, width: 28, background: 'var(--color-accent)' }} />
        <span style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 600 }}>
          §{section}
        </span>
      </div>
    )}
    <p style={{
      fontFamily: MONO,
      fontSize: '13px',
      letterSpacing: '0.28em',
      textTransform: 'uppercase',
      color: 'var(--color-accent)',
      fontWeight: 600,
    }}>
      {children}
    </p>
  </div>
);

// SectionAnswer — bold lede sentence after the headline. Pyramid principle:
// answer-first per section so a scanner gets the gist in 3 seconds without reading body.
// Sized between headline (40-56px) and body (17px) — a "deck" in magazine layout terms.
const SectionAnswer: React.FC<{ children: React.ReactNode; tone?: 'paper' | 'dark' }> = ({ children, tone = 'paper' }) => (
  <p className="mt-4 mb-8 max-w-3xl" style={{
    fontFamily: BODY_SERIF, fontWeight: 600,
    fontSize: 'clamp(1.125rem, 1.7vw, 1.375rem)', lineHeight: 1.45,
    letterSpacing: '-0.005em',
    color: tone === 'dark' ? 'rgba(247,244,239,0.88)' : '#1A1A1A',
  }}>
    {children}
  </p>
);

// CardPanel — subtle cream-darker container that groups related content (Gestalt proximity).
// Used for stats, tech stack, cost block, bar chart preview. Reads as "this is one thing,
// not floating elements."
const CardPanel: React.FC<{ children: React.ReactNode; className?: string; tone?: 'paper' | 'dark' }> = ({ children, className = '', tone = 'paper' }) => (
  <div
    className={`${className}`}
    style={{
      background: tone === 'dark' ? 'rgba(247,244,239,0.04)' : '#ECE7DC',
      border: tone === 'dark' ? '1px solid rgba(247,244,239,0.10)' : '1px solid rgba(26,26,26,0.06)',
      padding: 'clamp(20px, 2.2vw, 32px)',
    }}
  >
    {children}
  </div>
);

// OpportunityBarChart — at-a-glance preview of the 5 opp $-values. Dual coding: visual
// companion to the text list below. Sorted by cost descending so the loss-magnitude
// distribution is read in 2 seconds.
const OpportunityBarChart: React.FC<{ opps: Opportunity[] }> = ({ opps }) => {
  const reduceMotion = useReducedMotion();
  // Keep Claude's order (build-readiness, not $-value) so the bars match the card list below.
  // The first bar IS the top priority — same labeling as the prominent card.
  const max = Math.max(...opps.map(o => o.estimated_monthly_cost || 0));
  if (max <= 0) return null;
  return (
    <CardPanel className="mb-12">
      <p className="mb-5" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)', fontWeight: 600 }}>
        {opps.length} opportunities at a glance · ranked by build-readiness
      </p>
      <div className="space-y-3">
        {opps.map((o, i) => {
          const pct = (o.estimated_monthly_cost || 0) / max;
          const isTop = i === 0;
          return (
            <div key={i} className="flex items-center gap-4">
              <p className="flex-shrink-0 flex items-center gap-2" style={{
                width: 'clamp(160px, 24vw, 260px)',
                fontFamily: BODY_SERIF, fontSize: '14px', color: '#1A1A1A', lineHeight: 1.3,
              }}>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: isTop ? 'var(--color-accent)' : 'rgba(26,26,26,0.45)', fontWeight: 600 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{o.title.length > 32 ? o.title.slice(0, 30) + '…' : o.title}</span>
              </p>
              <div className="flex-1" style={{ height: 18, background: 'rgba(26,26,26,0.06)', position: 'relative' }}>
                <motion.div
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  whileInView={{ scaleX: pct }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.08 }}
                  style={{ height: '100%', background: isTop ? 'var(--color-accent)' : 'rgba(76,110,61,0.5)', transformOrigin: 'left' }}
                />
              </div>
              <p className="flex-shrink-0 text-right" style={{
                width: '110px',
                fontFamily: SERIF, fontStyle: 'italic', fontSize: '20px',
                color: isTop ? 'var(--color-accent)' : 'rgba(26,26,26,0.7)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                ${(o.estimated_monthly_cost || 0).toLocaleString()}<span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(26,26,26,0.5)', fontStyle: 'normal', marginLeft: 2 }}>/mo</span>
              </p>
            </div>
          );
        })}
      </div>
    </CardPanel>
  );
};

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

// Transition — bridge between sections. Visually marked as a CHAPTER BREAK
// (sage left rule + indented kicker + italic prose) so the reader feels the
// handoff instead of seeing isolated body copy.
const Transition: React.FC<{ children: React.ReactNode; tone?: 'paper' | 'sage' }> = ({ children, tone = 'paper' }) => {
  const reduceMotion = useReducedMotion();
  const accent = tone === 'sage' ? 'var(--color-accent)' : 'rgba(26,26,26,0.45)';
  const proseColor = tone === 'sage' ? 'rgba(76,110,61,0.9)' : 'rgba(26,26,26,0.72)';
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.6, ease: EASE }}
      className="py-10 lg:py-14 max-w-2xl"
      style={{
        borderLeft: `2px solid ${accent}`,
        paddingLeft: 'clamp(16px, 1.6vw, 22px)',
      }}
    >
      <p style={{
        fontFamily: MONO, fontSize: '10px', letterSpacing: '0.24em',
        textTransform: 'uppercase', color: accent,
        marginBottom: 10, fontWeight: 600,
      }}>
        ▸ Next
      </p>
      <p style={{
        fontFamily: SERIF, fontWeight: 400,
        fontSize: 'clamp(1.25rem, 1.9vw, 1.5rem)', lineHeight: 1.4,
        letterSpacing: '-0.012em', color: proseColor,
      }}>
        {children}
      </p>
    </motion.div>
  );
};

// ReframeBand — sage-tinted full-bleed band for the load-bearing "but here's what you missed"
// section (§3). Designed to be the visual hinge — different palette, different rhythm than
// surrounding paper sections, so the reader feels the chapter break before reading it.
const ReframeBand: React.FC<{ kicker: string; children: React.ReactNode; id?: string }> = ({ kicker, children, id }) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      id={id}
      initial={reduceMotion ? false : { opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, ease: EASE }}
      className="py-20 lg:py-28"
      style={{
        background: 'linear-gradient(180deg, rgba(76,110,61,0.06) 0%, rgba(76,110,61,0.10) 100%)',
        borderTop: '1px solid rgba(76,110,61,0.18)',
        borderBottom: '1px solid rgba(76,110,61,0.18)',
        scrollMarginTop: 80,
      }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div className="mb-8">
          <Kicker section={3}>{kicker}</Kicker>
        </div>
        {children}
      </div>
    </motion.section>
  );
};

const Section: React.FC<{ kicker: string; title: React.ReactNode; children: React.ReactNode; id?: string; section?: string | number }> = ({
  kicker, title, children, id, section,
}) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section id={id} {...inViewProps} className="py-20 lg:py-28" style={{ scrollMarginTop: 80 }}>
      <div className="mb-12 lg:mb-16 space-y-3">
        <Kicker section={section}>{kicker}</Kicker>
        <RevealHeadline
          style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: 'clamp(2.5rem, 4.5vw, 3.5rem)',
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
      // W2.4 — cap line length at ~68ch per Visual spec (Tufte/Refactoring UI optimal). Callers
      // that pass max-w-* override via Tailwind cascade. Without this, long-form paragraphs
      // (one_liner, AI adoption description) ran 95-110ch on 1440 desktop.
      maxWidth: '68ch',
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

// Homepage screenshot card — captured by the n8n pipeline via Firecrawl, stored in Supabase.
// Failure mode: if the <img> fails to load (expired URL, deleted asset, captured during bot
// challenge), hide the whole block instead of showing a broken image.
function HomepageScreenshot({ src, domain }: { src: string; domain: string }) {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;
  return (
    <motion.figure
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: EASE }}
      className="space-y-3"
    >
      <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>
        Your homepage, captured today
      </p>
      <div
        className="overflow-hidden"
        style={{
          border: '1px solid rgba(26,26,26,0.12)',
          background: '#EFEAE2',
          boxShadow: '0 8px 32px rgba(26,26,26,0.08)',
        }}
      >
        <img
          src={src}
          alt={`Homepage screenshot of ${domain}`}
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </div>
    </motion.figure>
  );
}

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
    <Section id="company" section={2} kicker="The Company" title="Who you are, what you run on.">
      <SectionAnswer>
        {report.company_snapshot.size_tier === 'micro' ? 'Micro (1-10) ' : report.company_snapshot.size_tier === 'small' ? 'Small (10-50) ' : report.company_snapshot.size_tier === 'mid' ? 'Mid-market ' : 'Large '}
        business {report.company_snapshot.sophistication_tier === 'low' ? 'running a paper-era stack' : report.company_snapshot.sophistication_tier === 'medium' ? 'with baseline ops tooling' : 'with a mature stack'}{domain_age_years ? `, ${domain_age_years} years online` : ''}.
      </SectionAnswer>

      {/* Editorial single-column flow. No more 280px sidebar (chips overflowed, Apollo paragraph wrapped cramped). */}
      <div className="space-y-10 max-w-4xl">
        {/* 1. Description + facts strip */}
        <div className="space-y-5">
          <SerifBody large className="max-w-2xl">{company_snapshot.one_liner}</SerifBody>
          {facts.length > 0 && (
            <div className="flex flex-wrap gap-x-6 gap-y-2" style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.04em', color: 'rgba(26,26,26,0.65)' }}>
              {facts.map((f, i) => (<span key={i}>{f}</span>))}
            </div>
          )}
        </div>

        {/* Homepage screenshot — visual anchor proving we actually looked at their site.
            Renders only when capture succeeded; degrades silently otherwise. */}
        {report.homepage_screenshot_url && (
          <HomepageScreenshot src={report.homepage_screenshot_url} domain={report.company_snapshot.name} />
        )}

        {/* 2. LinkedIn + GitHub presence as a stat strip */}
        {((linkedin_summary && (linkedin_summary.followers || linkedin_summary.posts_30d != null)) || github) && (
          <div className="flex flex-wrap gap-x-12 gap-y-6 pt-2">
            {linkedin_summary?.followers != null && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>LinkedIn followers</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)', lineHeight: 1, letterSpacing: '-0.02em', color: '#1A1A1A', marginTop: 4 }}>
                  {linkedin_summary.followers.toLocaleString()}
                </p>
              </div>
            )}
            {linkedin_summary?.posts_30d != null && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>Posts / 30d</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)', lineHeight: 1, letterSpacing: '-0.02em', color: '#1A1A1A', marginTop: 4 }}>
                  {linkedin_summary.posts_30d}
                </p>
              </div>
            )}
            {linkedin_summary?.last_post_days != null && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>Last post</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)', lineHeight: 1, letterSpacing: '-0.02em', color: linkedin_summary.last_post_days > 30 ? '#A85439' : '#1A1A1A', marginTop: 4 }}>
                  {linkedin_summary.last_post_days}d ago
                </p>
              </div>
            )}
            {!!linkedin_summary?.ai_mentions && linkedin_summary.ai_mentions > 0 && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>AI mentions</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)', lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--color-accent)', marginTop: 4 }}>
                  {linkedin_summary.ai_mentions}
                </p>
              </div>
            )}
            {github && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>GitHub repos</p>
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)', lineHeight: 1, letterSpacing: '-0.02em', color: '#1A1A1A', marginTop: 4 }}>
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
        <div className="pt-4">
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

// Compressed per CEO audit. Stats grid + geography + monthly-visit redundancy cut.
// Kept: traffic source breakdown (still load-bearing per user) + top search queries.
function SectionFundingTraffic({ report }: { report: ReportJson }) {
  const f = report.funding;
  const t = report.traffic;

  // Funding only — kept as a small inline strip when present (rare for service biz)
  type Stat = { label: string; display: string };
  const fundingStats: Stat[] = [];
  if (f?.total_funding_usd) {
    const v = f.total_funding_usd;
    fundingStats.push({ label: 'Total raised', display: v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K` });
  }
  if (f?.last_round_type) fundingStats.push({ label: 'Last round', display: f.last_round_type });
  if (f?.last_round_date) fundingStats.push({ label: 'Last round date', display: f.last_round_date });
  if (f && Array.isArray(f.investors) && f.investors.length > 0) {
    fundingStats.push({ label: 'Investors', display: String(f.investors.length) });
  }

  // Traffic source breakdown — load-bearing signal: high search + low paid = inbound engine, no AI optimization
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
  }
  const topKeywords = (t?.top_keywords || []).slice(0, 5);

  if (fundingStats.length === 0 && sourceRows.length === 0 && topKeywords.length === 0) return null;

  // Editorial line: data-derived inference about the traffic mix
  const searchPct = sources?.search ?? 0;
  const paidPct = sources?.paidReferrals ?? 0;
  const verdict =
    searchPct > 0.40 && paidPct < 0.05
      ? `${(searchPct * 100).toFixed(0)}% of traffic comes from search. Almost none from paid. Inbound engine running, not bought.`
      : paidPct > 0.20
      ? `${(paidPct * 100).toFixed(0)}% of traffic is paid. The funnel breathes through the wallet.`
      : sourceRows.length > 0
      ? `Traffic mix below. Where the visitors actually come from, not where the marketing budget assumes.`
      : 'Traffic context.';

  return (
    <Section id="numbers" kicker="Traffic Mix" title={<>Where your <Italic>visitors come from</Italic>.</>}>
      <SerifBody className="mb-10 max-w-2xl"><Emphasized>{`**${verdict}**`}</Emphasized></SerifBody>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 lg:gap-16">
        {sourceRows.length > 0 && (
          <div>
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
              Source breakdown
            </p>
            {/* W2.3 — Single FT/Bloomberg-style stacked horizontal bar (was 5 separate sage rectangles
                with zero data-ink per Visual specialist). One thick bar, segmented, labeled inline.
                P0.1 fix: explicit width + flexShrink:0 so segments don't collapse on mobile when the
                first segment is largest (was rendering with sage Organic Search empty at 390px). */}
            <div className="mt-6">
              <div className="flex w-full" style={{ height: 28, background: 'rgba(26,26,26,0.06)' }}>
                {sourceRows.map((row, i) => (
                  <motion.div
                    key={row.label}
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, margin: '-30px' }}
                    transition={{ duration: 0.6, ease: EASE, delay: i * 0.08 }}
                    title={`${row.label}: ${(row.pct * 100).toFixed(1)}%`}
                    style={{
                      width: `${row.pct * 100}%`,
                      flexShrink: 0,
                      background: row.tone,
                      transformOrigin: 'left',
                      borderRight: i < sourceRows.length - 1 ? '1px solid #F7F4EF' : 'none',
                    }}
                  />
                ))}
              </div>
              {/* Inline legend below the bar, mono caps, dot marker matches segment color */}
              <ul className="mt-5 space-y-2.5" style={{ listStyle: 'none', padding: 0 }}>
                {sourceRows.map((row) => (
                  <li key={row.label} className="flex items-baseline gap-3">
                    <span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, background: row.tone, flexShrink: 0 }} />
                    <span style={{ fontFamily: BODY_SERIF, fontSize: '15px', color: '#1A1A1A', flex: 1 }}>
                      {row.label}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: '13px', color: 'rgba(26,26,26,0.7)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {(row.pct * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

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
      </div>

      {/* Funding strip (rare for service biz, hidden when empty) */}
      {fundingStats.length > 0 && (
        <div className="mt-12 pt-8 border-t border-[color:var(--color-hairline)] flex flex-wrap gap-x-10 gap-y-4">
          {fundingStats.map((s) => (
            <div key={s.label}>
              <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>{s.label}</p>
              <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '24px', color: '#1A1A1A', marginTop: 2 }}>{s.display}</p>
            </div>
          ))}
        </div>
      )}

      {f?.crunchbase_url && (
        <a
          href={f.crunchbase_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-6 py-3 -my-3 transition-colors"
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

// Stakes-of-failure block. Compounds opportunity dollar leakage to 12 months.
// Sits right under the dark band as the visceral stakes beat (Conversion specialist's PAS Agitate).
// Quick, oversized number, no preamble.
function SectionStakes({ report }: { report: ReportJson }) {
  const reduceMotion = useReducedMotion();
  const monthly = (report.opportunities || []).reduce((sum, o) => sum + (o.estimated_monthly_cost || 0), 0);
  if (monthly <= 0) return null;
  const annual = monthly * 12;
  const annualDisplay = annual >= 100_000
    ? `$${(annual / 1000).toFixed(0)}K`
    : `$${annual.toLocaleString()}`;
  return (
    <motion.section
      id="stakes"
      initial={reduceMotion ? false : { y: 14 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: EASE }}
      className="py-20 lg:py-28"
      style={{ scrollMarginTop: 80 }}
    >
      <div className="grid lg:grid-cols-[auto_1fr] gap-8 lg:gap-16 items-baseline max-w-5xl">
        <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
          12-month cost of inaction
        </p>
        <div>
          <p style={{
            fontFamily: SERIF, fontStyle: 'italic',
            fontSize: 'clamp(4rem, 8vw, 6.5rem)', lineHeight: 0.92,
            letterSpacing: '-0.035em', color: '#A85439',
            fontVariantNumeric: 'tabular-nums',
          }}>
            <Scramble value={annualDisplay} duration={0.5} />
          </p>
          <SerifBody className="mt-4 max-w-2xl">
            <Emphasized>
              {`If nothing changes in the next 12 months, the gaps below compound to **${annualDisplay}** in unleveraged time and missed conversion. The earlier the system gets built, the less of that bill you actually pay.`}
            </Emphasized>
          </SerifBody>
        </div>
      </div>
    </motion.section>
  );
}

// W1.2 — Priority gap appears immediately after the dark band, before the 5-card enumeration.
function SectionPriorityGap({ report }: { report: ReportJson }) {
  const reduceMotion = useReducedMotion();
  const monthly = (report.opportunities || []).reduce((sum, o) => sum + (o.estimated_monthly_cost || 0), 0);
  const annualCost = monthly * 12;
  const annualDisplay = annualCost >= 100_000 ? `$${(annualCost / 1000).toFixed(0)}K` : `$${annualCost.toLocaleString()}`;
  return (
    <motion.section
      id="priority-gap"
      initial={reduceMotion ? false : { y: 14 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: EASE }}
      className="py-20 lg:py-28"
      style={{ scrollMarginTop: 80 }}
    >
      <div className="max-w-5xl">
        <Kicker section={4}>Your #1 Gap</Kicker>
        <h2 style={{
          fontFamily: SERIF, fontWeight: 400,
          fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05,
          letterSpacing: '-0.025em', color: '#1A1A1A',
          marginTop: 16,
        }}>
          {report.top_gap_title}.
        </h2>
        {annualCost > 0 && (
          <SectionAnswer>
            {annualDisplay} of margin leaks over the next 12 months if this stays unbuilt.
          </SectionAnswer>
        )}
        <SerifBody large className="mt-2 max-w-2xl">
          <Emphasized>{report.top_gap_summary}</Emphasized>
        </SerifBody>

        {/* Hero cost number — co-equal weight with the score in §1. The page now has two
            "moments": the score reveal (good) and the cost of inaction (bad), bracketing the
            emotional arc. Coral italic so it reads as the loss-aversion frame. */}
        {annualCost > 0 && (
          <div className="mt-12 lg:mt-16 pt-10 lg:pt-12 border-t border-[color:var(--color-hairline)]">
            <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
              If nothing changes — 12-month cost
            </p>
            <p style={{
              fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400,
              fontSize: 'clamp(4.5rem, 11vw, 9rem)', lineHeight: 0.92,
              letterSpacing: '-0.04em', color: '#A85439',
              fontVariantNumeric: 'tabular-nums', marginTop: 8,
            }}>
              <Scramble value={annualDisplay} duration={0.6} />
            </p>
            <p className="mt-4 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '17px', lineHeight: 1.5, color: 'rgba(26,26,26,0.7)', fontStyle: 'italic' }}>
              That's the compounding cost across the 5 opportunities below — unleveraged time and missed conversion if nothing in the system changes for 12 months.
            </p>
          </div>
        )}

        <a
          href="#opportunities"
          className="inline-flex items-baseline gap-1.5 mt-10 group"
          style={{
            fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#1A1A1A')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(26,26,26,0.6)')}
        >
          See the {report.opportunities.length} moves below ↓
        </a>
      </div>
    </motion.section>
  );
}

function Section3Opportunities({ report, companyName }: { report: ReportJson; companyName: string }) {
  // W1.1 — Calendly URL for the inline CTA on the prominent (top) card.
  const calendlyUrl = `${CALENDLY_BASE}?utm_source=scan&utm_content=${encodeURIComponent(companyName)}&a1=${encodeURIComponent(report.top_gap_title)}`;
  // P1.6 — Don't sort by dollars (would break top_gap_summary's specific number references).
  // Instead, frame explicitly: "ranked by build-readiness, not dollar size" — addresses the
  // visual "wait, why is #2 a bigger number?" parse without breaking Claude's strategic order.
  const opps = report.opportunities;
  // W1.5 — italic-pivot kept on this section header (restored post-feedback)
  return (
    <Section
      id="opportunities"
      kicker={`${opps.length} Moves`}
      title={<>Ranked by <Italic>leverage</Italic>, not dollar size.</>}
      section={5}
    >
      <SectionAnswer>
        {opps.length} places this is happening today{opps[0]?.time_to_implement ? `. The first ships in ${opps[0].time_to_implement}` : ''}.
      </SectionAnswer>
      <SerifBody className="mb-8 max-w-2xl">
        Each move is sourced from a specific signal we observed. Dollar values assume mid-tier ops cost ($75–$120/hr loaded). Tap any to expand.
      </SerifBody>

      {/* Bar chart preview — all 5 $-values at a glance, sorted by cost, before the cards.
          Dual-coding: visual companion to the text-heavy card list. */}
      <OpportunityBarChart opps={opps} />

      <div className="space-y-2">
        {opps.map((opp, i) => (
          <OpportunityCard
            key={i}
            opportunity={opp}
            index={i}
            prominent={i === 0}
            inlineCtaHref={i === 0 ? calendlyUrl : undefined}
            collapsibleByDefault={i > 0}
            collapsedCount={i === 1 && opps.length > 1 ? opps.length - 1 : undefined}
          />
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

  // Filter for creatives that will ACTUALLY render. Google text-only ads with no body/image
  // currently return null from AdCreativeCard (tag mode dropped per prior audit), so they were
  // filling the slice with empty cards. This keeps only cards with showable content.
  const willRender = (c: AdCreative) => {
    const hasText = !!(c.title || c.headline || (c.body && c.body.trim().length > 30));
    const hasImage = !!((c.images && c.images[0]) || c.preview_url);
    return hasText || hasImage;
  };

  const all: Array<{ platform: 'google' | 'linkedin' | 'meta'; creative: AdCreative }> = [];
  (ads.linkedin_ads?.creatives || []).filter(willRender).slice(0, 2).forEach(c => all.push({ platform: 'linkedin', creative: c }));
  (ads.meta_ads?.creatives || []).filter(willRender).slice(0, 2).forEach(c => all.push({ platform: 'meta', creative: c }));
  (ads.google_ads?.creatives || []).filter(willRender).slice(0, 2).forEach(c => all.push({ platform: 'google', creative: c }));
  // Trim to 2 sample creatives total per CEO audit — they're a sample, not a gallery
  const sample = all.slice(0, 2);
  // If we have NO renderable cards (e.g. only Google text-only ads), hide the section entirely
  // rather than showing the contradictory "6 active creatives. Sample below." with nothing below.
  if (sample.length === 0) return null;

  // Synthesize the verdict line from data we already have. Uses platform counts + total creatives.
  const platforms: string[] = [];
  if (ads.google_ads?.detected || (ads.google_ads?.count ?? 0) > 0) platforms.push('Google');
  if (ads.linkedin_ads?.detected || (ads.linkedin_ads?.count ?? 0) > 0) platforms.push('LinkedIn');
  if (ads.meta_ads?.detected || (ads.meta_ads?.count ?? 0) > 0) platforms.push('Meta');
  const totalCount = (ads.google_ads?.count ?? 0) + (ads.linkedin_ads?.count ?? 0) + (ads.meta_ads?.count ?? 0);
  const platformsLine = platforms.length > 1 ? platforms.slice(0, -1).join(', ') + ' + ' + platforms[platforms.length - 1] : (platforms[0] ?? 'paid channels');
  const cadenceLine = totalCount > 0
    ? `${totalCount} active creatives across ${platformsLine}. Sample below.`
    : `Active on ${platformsLine}. Sample below.`;

  return (
    <Section id="ad-activity" kicker="Live Ad Activity" title="Where your spend lands.">
      <SerifBody className="mb-8 max-w-2xl">
        <Emphasized>{`**${cadenceLine}**`}</Emphasized> Pulled live from public ad libraries. Look for repeated hooks: each rerun is a creative refresh you didn't run.
      </SerifBody>
      <div className={`grid gap-5 ${sample.length === 1 ? 'grid-cols-1 max-w-xl' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {sample.map((item, i) => (
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
    early_adopter: { label: 'Early Adopter.', tone: 'var(--color-accent)', description: 'You are actively integrating AI into operations. Ahead of the peer group.' },
    on_par: { label: 'On Par.', tone: '#A85439', description: 'The awareness is there, but deployment lags behind leading firms in your tier.' },
    behind: { label: 'Behind.', tone: '#9B2C2C', description: 'No AI tooling detected on your side. Each month of delay compounds the gap.' },
    unknown: {
      label: 'Unknown.',
      suffix: "and that's data.",
      tone: 'rgba(26,26,26,0.85)',
      description: 'No verified AI provider, no LLM tooling in your public stack, no AI-themed posts in the last 30 days. Either your team is still scoping or the work is happening off-site. Both are gaps the Assessment closes.',
    },
  };
  const m = meta[signal] ?? meta.unknown;

  return (
    <Section id="ai-adoption" kicker="AI Adoption" title="Where you sit on the curve.">
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
              API usage. You're not experimenting. You're shipping.
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
    <Section id="competitive" kicker="Competitive Context" title="The field you play in.">
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

// Pentagon/radar SVG for the 5-dimension score breakdown.
function PentagonRadarChart({
  sb, cats, toneFor, reduceMotion,
}: {
  sb: NonNullable<ReportJson['score_breakdown']>;
  cats: Array<{ key: keyof NonNullable<ReportJson['score_breakdown']>; label: string }>;
  toneFor: (pct: number) => string;
  reduceMotion: boolean;
}) {
  const cx = 130, cy = 120, maxR = 90;
  const n = cats.length;
  const getAngle = (i: number) => -Math.PI / 2 + i * (2 * Math.PI / n);
  const getPoint = (i: number, r: number) => ({
    x: cx + r * Math.cos(getAngle(i)),
    y: cy + r * Math.sin(getAngle(i)),
  });
  const gridRings = [0.25, 0.5, 0.75, 1.0];
  const scores = cats.map(({ key }) => {
    const c = sb[key];
    return c ? Math.min(1, c.value / c.max) : 0;
  });
  const scorePoints = cats.map((_, i) => getPoint(i, maxR * scores[i]));
  const scorePath = scorePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ' Z';

  return (
    <svg viewBox="0 0 270 255" width="270" height="255" style={{ overflow: 'visible', display: 'block' }}>
      {gridRings.map((ring) => {
        const pts = cats.map((_, i) => getPoint(i, maxR * ring));
        return (
          <polygon
            key={ring}
            points={pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke="rgba(247,244,239,0.12)"
            strokeWidth="1"
          />
        );
      })}
      {cats.map((_, i) => {
        const outer = getPoint(i, maxR);
        return (
          <line key={i}
            x1={cx} y1={cy}
            x2={outer.x.toFixed(1)} y2={outer.y.toFixed(1)}
            stroke="rgba(247,244,239,0.08)" strokeWidth="1"
          />
        );
      })}
      <motion.path
        d={scorePath}
        fill="rgba(127,168,104,0.20)"
        stroke="#7FA868"
        strokeWidth="2"
        strokeLinejoin="round"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.4 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.8, ease: EASE }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {scorePoints.map((p, i) => {
        const pct = scores[i] * 100;
        return (
          <motion.circle
            key={i}
            cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={4}
            fill={toneFor(pct)}
            initial={reduceMotion ? false : { r: 0 }}
            whileInView={{ r: 4 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.06 }}
          />
        );
      })}
      {cats.map(({ label }, i) => {
        const pt = getPoint(i, maxR + 22);
        const isLeft = pt.x < cx - 8;
        const textAnchor = isLeft ? 'end' : pt.x > cx + 8 ? 'start' : 'middle';
        return (
          <text key={i}
            x={pt.x.toFixed(1)} y={pt.y.toFixed(1)}
            textAnchor={textAnchor} dominantBaseline="middle"
            style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, letterSpacing: '0.12em', fill: 'rgba(247,244,239,0.55)', textTransform: 'uppercase' }}
          >
            {label}
          </text>
        );
      })}
    </svg>
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

  // W1.3 — color-lock the dark band score to the SAME color as the hero score.
  // Pre-fix: hero was warm orange (Grade C), dark band was sage green — looked like two different
  // numbers. Now both surfaces use gradeColor() so the score keeps a single visual identity.
  // Lighten gradeColor on the dark background so it stays legible (same hue, brighter for contrast).
  const lightenForDark = (hex: string): string => {
    const map: Record<string, string> = {
      '#4C6E3D': '#7FA868', // A → bright sage
      '#5C8049': '#8FB677', // B → mid sage
      '#B45309': '#E8A23F', // C → warm gold
      '#A85439': '#D89254', // D → warm coral
      '#9B2C2C': '#D26D6D', // F → soft red
    };
    return map[hex] ?? hex;
  };
  const scoreColor = lightenForDark(gradeColor(report.automation_grade));

  // Breakdown bar tones stay independent (high/mid/low) — these are PER-DIMENSION verdicts,
  // not the overall score. Tones SOFTENED per IA spec ("AI ADOPTION 3/20 in coral red competes
  // with the 52 for attention" — louder than the headline). Failed dims now in muted coral instead
  // of bright red, so the headline score keeps its rank as the loudest thing on the band.
  const toneFor = (pct: number) =>
    pct >= 70 ? '#7FA868' : pct >= 40 ? '#C7864E' : '#A8625C';

  return (
    <section
      // W2.4 — bumped vertical padding on mobile from py-20 (5rem = 80px) to py-24 (6rem = 96px) so
      // the score 52 has breathing room from the section edges; desktop unchanged
      className="py-20 lg:py-28"
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
          {/* Dark-band kicker — same pattern as paper sections but inverted (sage on dark stays sage) */}
          <div className="mb-1">
            <div className="flex items-center gap-3 mb-2">
              <span aria-hidden style={{ display: 'inline-block', height: 1, width: 28, background: '#7FA868' }} />
              <span style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#7FA868', fontWeight: 600 }}>
                §1
              </span>
            </div>
            <p style={{ fontFamily: MONO, fontSize: '13px', letterSpacing: '0.28em', textTransform: 'uppercase', color: '#7FA868', fontWeight: 600 }}>
              The Breakdown
            </p>
          </div>
          <RevealHeadline
            style={{
              fontFamily: SERIF, fontWeight: 400,
              fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05,
              letterSpacing: '-0.025em', color: '#F7F4EF', marginTop: 12,
            }}
          >
            Where you're <span style={{ fontStyle: 'italic', color: '#7FA868' }}>winning</span>. Where you're <span style={{ fontStyle: 'italic', color: '#D89254' }}>not</span>.
          </RevealHeadline>
          <SectionAnswer tone="dark">
            You scored {report.automation_score}/100 — Grade {report.automation_grade}. Score below means more humans pasting fields; higher means more systems doing the work.
          </SectionAnswer>
        </div>

        <div className="grid lg:grid-cols-[auto_1fr] gap-12 lg:gap-20 items-start">
          {/* Left: massive score */}
          <div>
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.55)' }}>
              Automation Maturity Score
            </p>
            <p style={{
              fontFamily: SERIF, fontWeight: 400, fontStyle: 'italic',
              // P2.14 — was clamp(7rem, 14vw, 12rem). Hero score caps at 7rem; dark band was 1.7×
              // bigger which read as a re-statement. Now closer to 1.3× — still the visual climax
              // of the dark band, but felt as the same number, not a different one.
              fontSize: 'clamp(5.5rem, 11vw, 9rem)', lineHeight: 0.92,
              letterSpacing: '-0.04em', color: scoreColor, marginTop: 12,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {/* W1.3 — animation capped at 0.4s (was 1.2s) per Doherty Threshold; user reads the
                  real number quickly instead of getting stuck on mid-scramble digits like "94" */}
              <Scramble value={String(report.automation_score)} duration={0.4} />
            </p>
            <p style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.7)', marginTop: 8 }}>
              / 100  ·  Grade <span style={{ color: scoreColor }}>{report.automation_grade}</span>
            </p>
            <p style={{ fontFamily: BODY_SERIF, fontSize: '13px', lineHeight: 1.5, color: 'rgba(247,244,239,0.55)', marginTop: 14, fontStyle: 'italic' }}>
              Higher means more systems doing the work, fewer humans pasting fields.
            </p>
          </div>

          {/* Right: pentagon radar chart + compact dimension legend */}
          <div className="lg:pt-2 flex flex-col gap-6 items-stretch lg:items-start">
            {/* Pentagon centers on mobile (where the auto-flow column is full-width) and
                left-aligns on desktop (where there's a left score column). */}
            <div className="flex justify-center lg:justify-start">
              <PentagonRadarChart sb={sb} cats={cats} toneFor={toneFor} reduceMotion={!!reduceMotion} />
            </div>
            <div className="w-full space-y-4 lg:space-y-3">
              <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.35)' }}>
                <span style={{ color: '#7FA868' }}>● Sage</span> = strength &nbsp; <span style={{ color: '#D89254' }}>● Warm</span> = gap
              </p>
              {cats.map(({ key, label }) => {
                const c = sb[key];
                if (!c) return null;
                const pct = Math.min(100, (c.value / c.max) * 100);
                const tone = toneFor(pct);
                return (
                  <div key={key} className="pb-5" style={{ borderBottom: '1px solid rgba(247,244,239,0.10)' }}>
                    {/* Single horizontal row: label LEFT, bar BRIDGES the gap, score RIGHT.
                        The bar visually connects label to score so the eye reads them as one unit
                        instead of "label on left, score floating in void". Standard dashboard UX. */}
                    <div className="flex items-center gap-5 mb-3">
                      <p style={{
                        fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em',
                        textTransform: 'uppercase', color: 'rgba(247,244,239,0.75)',
                        fontWeight: 600, flexShrink: 0, minWidth: '140px',
                      }}>
                        {label}
                      </p>
                      <div className="flex-1" style={{ height: 4, background: 'rgba(247,244,239,0.10)', position: 'relative' }}>
                        <motion.div
                          initial={reduceMotion ? false : { scaleX: 0 }}
                          whileInView={{ scaleX: pct / 100 }}
                          viewport={{ once: true, margin: '-40px' }}
                          transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
                          style={{ height: '100%', background: tone, transformOrigin: 'left' }}
                        />
                      </div>
                      <p style={{
                        fontFamily: SERIF, fontStyle: 'italic',
                        fontSize: 'clamp(1.75rem, 2.6vw, 2rem)', lineHeight: 1,
                        letterSpacing: '-0.02em', color: tone,
                        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {c.value}<span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(247,244,239,0.4)', marginLeft: 4, fontStyle: 'normal' }}>/{c.max}</span>
                      </p>
                    </div>
                    <p style={{
                      fontFamily: BODY_SERIF, fontSize: '14px',
                      color: 'rgba(247,244,239,0.65)', lineHeight: 1.5,
                      paddingLeft: '160px',  // align with bar start
                    }} className="lg:pl-[160px] pl-0">
                      {c.rationale}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* AI posture — was a standalone section, folded in here per CEO audit (it's just a verdict line, not a full act) */}
        <AiPostureRowDark report={report} />

        {/* W1.6 — Peer comparison hidden until we have real benchmark data.
            Currently `peer_median.score` is a hardcoded estimate per size_tier in the Claude prompt
            (micro: 35, small: 42, mid: 50, large: 58) — not aggregated from prior scans.
            Will rebuild from Supabase aggregation once we have 50+ scans per tier (Week 3+).
            Component kept defined below so re-enabling is a one-line change. */}
        {/* <PeerComparisonInlineDark report={report} /> */}
      </div>
    </section>
  );
}

// Dark-mode AI posture row — folded into the breakdown band.
function AiPostureRowDark({ report }: { report: ReportJson }) {
  const signal = report.company_snapshot.ai_adoption_signal;
  const meta: Record<string, { label: string; tone: string; description: string }> = {
    early_adopter: { label: 'Early Adopter.', tone: '#7FA868', description: 'You are actively integrating AI into operations. Ahead of the peer group.' },
    on_par:        { label: 'On Par.',        tone: '#D89254', description: 'The awareness is there, but deployment lags behind leading firms in your tier.' },
    behind:        { label: 'Behind.',        tone: '#C76354', description: 'No AI tooling detected on your side. Each month of delay compounds the gap.' },
    unknown:       { label: 'Unknown.',       tone: 'rgba(247,244,239,0.85)', description: "No verified AI provider, no LLM tooling in your public stack, no AI-themed posts in the last 30 days. Either your team is still scoping or the work is happening off-site." },
  };
  const m = meta[signal] ?? meta.unknown;
  return (
    <div className="mt-16 pt-8" style={{ borderTop: '1px solid rgba(247,244,239,0.12)' }}>
      <div className="grid lg:grid-cols-[auto_1fr] gap-6 lg:gap-12 items-baseline">
        <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.55)' }}>
          AI Posture
        </p>
        <div>
          <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', lineHeight: 1, color: m.tone }}>
            {m.label}
          </p>
          <p className="mt-2 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.55, color: 'rgba(247,244,239,0.78)' }}>
            {m.description}
          </p>
        </div>
      </div>
    </div>
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
    <Section id="voice" kicker="Your Voice" title="What you're publishing.">
      <SerifBody className="mb-10 max-w-2xl">
        Two of your most recent LinkedIn posts, verbatim. Cadence matters more than content here.
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
    <Section id="hiring" kicker="Hiring" title={<>What you're <Italic>paying humans</Italic> to do.</>}>
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
              A sample of what you're hiring
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
    <Section id="news" kicker="Recent Momentum" title="What's happened in the last 90 days.">
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

// W2.1 — Methodology + sources footer. Collapsible <details> per Owner Decision 4.
// Sits BEFORE the closing arc so a forwarded report's reader (CFO/COO on the buying committee)
// can verify any number before the CTA hits. Trust specialist's load-bearing fix.
function SectionMethodology() {
  const SOURCES = [
    { name: 'BuiltWith',          what: 'Tech stack detection + DNS-verified tools' },
    { name: 'Apollo.io',          what: 'Headcount, revenue range, industry' },
    { name: 'LinkedIn Company',   what: 'Followers, posts, AI mentions, employee count' },
    { name: 'LinkedIn Jobs',      what: 'Open role count + sample titles' },
    { name: 'SimilarWeb',         what: 'Monthly visits, traffic mix, top search queries' },
    { name: 'SerpApi (News)',     what: 'Recent press mentions in the last 90 days' },
    { name: 'SerpApi (Ads)',      what: 'Google Ads detection + cross-platform signals' },
    { name: 'Meta Ad Library',    what: 'Active Facebook + Instagram ad creatives' },
    { name: 'LinkedIn Ad Library',what: 'Active LinkedIn ad creatives' },
    { name: 'Google Ads Transparency', what: 'Active Google ad creatives' },
    { name: 'GitHub',             what: 'Public repository count (engineering signal)' },
    { name: 'Crunchbase',         what: 'Funding rounds + investor signals (when present)' },
    { name: 'Public DNS',         what: 'TXT records (Anthropic, OpenAI, HubSpot, Workspace, etc.)' },
    { name: 'Homepage HTML',      what: 'CDN, frameworks, booking widgets, live chat detection' },
  ];
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <section className="py-12 lg:py-16 max-w-3xl">
      {/* P1.7 — surface the reciprocity payoff. The collapsible was buried; 95% of readers never
          opened it. Always-visible 1-liner names the source count + model so the credibility
          signal lands before the click. The full source breakdown stays behind the disclosure. */}
      <p className="mb-3" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(26,26,26,0.7)' }}>
        Built from <strong style={{ color: '#1A1A1A', fontWeight: 600 }}>14 public sources</strong>.
      </p>
      <details className="group">
        <summary
          className="cursor-pointer inline-flex items-center gap-2 list-none transition-colors"
          style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}
        >
          <span className="transition-transform group-open:rotate-90" aria-hidden style={{ display: 'inline-block', fontSize: '10px' }}>▸</span>
          See sources + what we couldn't see
        </summary>

        <div className="mt-8 space-y-8">
          <div>
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
              How this report was generated
            </p>
            <SerifBody className="mt-3 max-w-2xl">
              We pulled signals from the 14 public sources below. Claude Opus 4.7 synthesized the patterns into the gap analysis and dollar estimates. Ivan reviews every report before it ships. <strong style={{ color: '#1A1A1A', fontWeight: 600 }}>Generated {today}.</strong>
            </SerifBody>
          </div>

          <div>
            <p className="mb-3" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
              Sources pulled
            </p>
            <ul className="space-y-2 border-t border-[color:var(--color-hairline)]" style={{ listStyle: 'none', padding: 0 }}>
              {SOURCES.map((s) => (
                <li key={s.name} className="flex items-baseline gap-4 py-2 border-b border-[color:var(--color-hairline)]">
                  <span className="shrink-0" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.04em', color: '#1A1A1A', fontWeight: 600, minWidth: '180px' }}>
                    {s.name}
                  </span>
                  <span style={{ fontFamily: BODY_SERIF, fontSize: '14px', color: 'rgba(26,26,26,0.7)', lineHeight: 1.5 }}>
                    {s.what}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
              What we couldn't see
            </p>
            <SerifBody className="mt-3 max-w-2xl">
              We can't see internal tools (anything not exposed via DNS, headers, or homepage HTML), private analytics, contracts, headcount roles inside teams, or anything behind authentication. The hour and dollar estimates assume mid-tier ops cost ($75-$120/hr loaded) and are conservative within plausible ranges. Where the data was thin, the report says so explicitly rather than guessing.
            </SerifBody>
          </div>
        </div>
      </details>
    </section>
  );
}

// W2.2 v2 — Single client card for the Track Record strip. Logo via Google s2/favicons (reliable,
// auth-free, ~128px PNG). On image error, fall back to a typeset wordmark so the layout never breaks.
function ClientCard({ name, domain, outcome }: { name: string; domain: string; outcome: React.ReactNode }) {
  const [imgFailed, setImgFailed] = React.useState(false);
  return (
    <div className="space-y-3">
      {imgFailed ? (
        <div
          className="flex items-center justify-center"
          style={{
            width: 44, height: 44, background: '#fff',
            border: '1px solid rgba(26,26,26,0.1)',
            fontFamily: MONO, fontSize: '11px', letterSpacing: '0.05em', color: '#1A1A1A', fontWeight: 600,
          }}
          aria-hidden
        >
          {name.split(' ').map((w) => w[0]).join('').slice(0, 3).toUpperCase()}
        </div>
      ) : (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt={`${name} logo`}
          loading="lazy"
          width={44}
          height={44}
          style={{ width: 44, height: 44, objectFit: 'contain', background: '#fff', border: '1px solid rgba(26,26,26,0.08)', padding: 4 }}
          onError={() => setImgFailed(true)}
        />
      )}
      <p style={{ fontFamily: BODY_SERIF, fontSize: '14px', color: '#1A1A1A', fontWeight: 600, lineHeight: 1.3 }}>
        {name}
      </p>
      <p style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.5, color: 'rgba(26,26,26,0.7)' }}>
        {outcome}
      </p>
    </div>
  );
}

// CLOSING ARC — merged per CEO audit. Was two competing closes (week-1 callout + final CTA);
// now a single block: highest-priority gap (verdict) → Monday move (action) → Ivan + price → CTA.
function SectionClosingArc({ report, companyName }: { report: ReportJson; companyName: string }) {
  const w = report.week_one_action;
  const calendlyUrl = `${CALENDLY_BASE}?utm_source=scan&utm_content=${encodeURIComponent(companyName)}&a1=${encodeURIComponent(report.top_gap_title)}`;

  return (
    <section id="cta" className="border-t border-[color:var(--color-hairline)] py-20 lg:py-28" style={{ scrollMarginTop: 80 }}>
      <div className="max-w-3xl">
        <Kicker section={7}>Your Move</Kicker>

        {/* P1.8 — pivot from "Your highest-priority gap is X" (which restated the priority block
            verbatim) to action framing. The closing arc's job is the move, not the gap re-statement. */}
        <h2
          className="mt-6 mb-6"
          style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: '#1A1A1A',
          }}
        >
          Here's the <Italic highlight>move</Italic>.
        </h2>

        <SerifBody large className="mb-10 max-w-xl">
          <span style={{ color: 'rgba(26,26,26,0.8)' }}>
            Ship the quick win below yourself this week. Or hand us the whole scan and we build the 90-day system around it.
          </span>
        </SerifBody>

        {/* P0.2 — Monday move now framed explicitly as the QUICK WIN, distinct from the
            biggest-gap verdict above. Reader gets two complementary actions: the easiest tactical
            ship + the strategic priority. No more contradiction. */}
        {w && (
          <div className="mb-10 max-w-2xl px-6 lg:px-8 py-7 lg:py-8 -mx-6 lg:-mx-8" style={{ background: 'rgba(76,110,61,0.06)', borderLeft: '3px solid var(--color-accent)' }}>
            <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-accent)' }}>
              Quick win you can ship this week
            </p>
            <h3 style={{
              fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.5rem, 2.6vw, 2rem)',
              lineHeight: 1.1, letterSpacing: '-0.015em', color: '#1A1A1A', marginTop: 10,
            }}>
              {w.title}
            </h3>
            <SerifBody className="mt-3"><Emphasized>{w.why}</Emphasized></SerifBody>
            {(w.approach || (w.tools && w.tools.length > 0)) && (
              <p className="mt-4" style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.5, color: 'rgba(26,26,26,0.65)', fontStyle: 'italic' }}>
                {w.approach ?? w.tools?.join(', ')}
              </p>
            )}
            <p className="mt-5" style={{ fontFamily: BODY_SERIF, fontSize: '14px', color: 'rgba(26,26,26,0.65)', fontStyle: 'italic' }}>
              The full <strong style={{ color: '#1A1A1A', fontWeight: 600, fontStyle: 'normal' }}>build sequence</strong> — what ships first, what depends on what, ROI per phase — lives in the Assessment below.
            </p>
          </div>
        )}

        {/* Authority chain — who Ivan is, why this scan was credible */}
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

        {/* W2.2 — Track Record strip, horizontal layout with logos (per user feedback after first
            vertical version felt too text-heavy). Logos via Google's s2/favicons API with onError
            fallback to a typeset wordmark. 3-column grid on desktop, single column on mobile.
            Compact: each cell is logo + 1-line outcome. No industry tag (logo conveys brand). */}
        <div className="mb-10 max-w-3xl py-7 border-t border-b border-[color:var(--color-hairline)]">
          <p className="mb-6" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>
            Recent builds
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <ClientCard
              name="ProSWPPP"
              domain="proswppp.com"
              outcome="50-state SWPPP docs ship from one interface. Sales follow-up runs zero-touch."
            />
            <ClientCard
              name="Destino Farms"
              domain="destinofarms.com"
              outcome="Supplier menu reconciles itself overnight. No spreadsheet juggling."
            />
            <ClientCard
              name="BNP Paribas Fortis"
              domain="bnpparibasfortis.be"
              outcome="Conversational Ops AI agent for internal teams."
            />
          </div>
        </div>

        {/* P2.13 — price anchor: connect the dollar leakage above to the cost of fixing it.
            Lifts the price line from "$2,000" (which floats) to a value framing the buyer can do
            the math on. The number $2,000 < the lowest opportunity card's monthly cost. */}
        <p className="mb-2" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(26,26,26,0.7)', fontStyle: 'italic' }}>
          Costs less than the smallest opportunity above. Pays back inside the first month if even one ships.
        </p>
        <p className="mb-6" style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.85)' }}>
          $2,000 · 1 week · 60-min findings walkthrough
        </p>

        {/* P1.10 — free-call CTA gets equal visual gravity. Was a tight italic underline tucked
            beside the paid button (read as apology). Now its own line below, with a hairline rule
            separating, in body serif at near-equal weight. Cold prospects deserve a real on-ramp. */}
        <div className="flex flex-col gap-5">
          <a
            href="https://buy.stripe.com/bJe7sDcqLeE130G2D9fEk0J"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center sm:justify-start gap-2.5 px-7 py-4 self-start"
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
          <div className="pt-5 border-t border-[color:var(--color-hairline)] flex flex-col sm:flex-row sm:items-baseline gap-3 sm:gap-5">
            <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)' }}>
              Not ready to commit
            </span>
            <a
              href={`${CALENDLY_BASE}?utm_source=scan&utm_content=free-walkthrough-${encodeURIComponent(companyName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-baseline gap-1.5 group transition-colors self-start"
              style={{
                fontFamily: BODY_SERIF,
                fontWeight: 600,
                fontSize: '16px',
                color: 'var(--color-accent)',
                textDecoration: 'underline',
                textUnderlineOffset: '5px',
                textDecorationColor: 'rgba(76,110,61,0.45)',
              }}
            >
              Book a free 30-min walkthrough <ArrowRight className="w-4 h-4 self-center transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// JawDropSignal — surfaces the single most visually striking verified signal right after
// the company brief. Picks: image ad creative > hiring count > LinkedIn post excerpt.
// ReframeSection — the load-bearing §3 hinge. Sage full-bleed band, oversized type.
// Prefers a Claude-generated reframe (threads to top_gap_title); falls back to a
// deterministic signal pick when Claude didn't produce one or QA dropped it.
function ReframeSection({ report }: { report: ReportJson }) {
  // Prefer Claude's reframe — it's authored to thread with top_gap_title.
  if (report.reframe && report.reframe.emphasis) {
    const { pre, emphasis, post } = report.reframe;
    return (
      <ReframeBand kicker="Here's what most miss" id="reframe">
        <p style={{
          fontFamily: SERIF, fontWeight: 400,
          fontSize: 'clamp(1.75rem, 3.8vw, 3rem)', lineHeight: 1.12,
          letterSpacing: '-0.02em', color: '#1A1A1A',
        }}>
          {pre}
          <em style={{ fontStyle: 'italic', color: 'var(--color-accent)', fontWeight: 500 }}>{emphasis}</em>
          {post}
        </p>
      </ReframeBand>
    );
  }

  // Fallback: deterministic pick if Claude didn't produce a reframe (or QA dropped it).
  const ads = report.ads;
  const totalAds = (ads?.google_ads?.count ?? 0) + (ads?.linkedin_ads?.count ?? 0) + (ads?.meta_ads?.count ?? 0);
  const isImg = (url: string | null | undefined) => !!url && !/\.(js|html?)(\?|$)/i.test(url);
  const adCreative =
    ads?.meta_ads?.creatives?.find(c => isImg(c.images?.[0] || c.preview_url)) ??
    ads?.linkedin_ads?.creatives?.find(c => isImg(c.preview_url));
  const hiringCount = report.hiring?.open_count ?? 0;
  const hiringTitles = report.hiring?.sample_titles || [];
  const topPost = report.linkedin_summary?.posts?.[0];
  const monthlyVisits = report.traffic?.monthly_visits ?? 0;

  type ReframeContent = { reframe_pre: string; reframe_emphasis: React.ReactNode; reframe_post: string; supporting?: React.ReactNode };
  let content: ReframeContent | null = null;

  // 1. Live ad spend with no CRM/booking is the gold-standard reframe — most prospects miss it
  const stack = report.tech_stack_assessment;
  const missingCapture = stack?.missing_critical_tools?.some(t => /crm|booking|live chat|workflow/i.test(t));
  if (totalAds > 0 && missingCapture) {
    const platforms: string[] = [];
    if (ads?.google_ads?.detected) platforms.push('Google');
    if (ads?.linkedin_ads?.detected) platforms.push('LinkedIn');
    if (ads?.meta_ads?.detected) platforms.push('Meta');
    const platformStr = platforms.join(' + ') || 'paid channels';
    content = {
      reframe_pre: "You're paying for clicks on ",
      reframe_emphasis: <em style={{ fontStyle: 'italic', color: 'var(--color-accent)', fontWeight: 500 }}>{platformStr}</em>,
      reframe_post: ` — ${totalAds} active ads running right now — but the path from click to booked meeting goes through a contact form into a Gmail inbox. The most expensive part of the funnel is the part with no system.`,
    };
  }
  // 2. Heavy hiring with no automation roles
  else if (hiringCount >= 3 && hiringTitles.length > 0) {
    const hasAiRole = hiringTitles.some(t => /AI|Automation|ML|Agent|Engineer/i.test(t));
    if (!hasAiRole) {
      content = {
        reframe_pre: 'You have ',
        reframe_emphasis: <em style={{ fontStyle: 'italic', color: 'var(--color-accent)', fontWeight: 500 }}>{hiringCount} open roles</em>,
        reframe_post: ` — ${hiringTitles.slice(0, 2).join(', ')} and more — and zero AI or automation titles among them. The fastest way to scale headcount is to scale systems first.`,
      };
    }
  }
  // 3. Content cadence vs follower count (under-publishing)
  else if (report.linkedin_summary?.followers && report.linkedin_summary?.posts_30d != null) {
    const followers = report.linkedin_summary.followers;
    const posts = report.linkedin_summary.posts_30d;
    if (followers >= 500 && posts < 8) {
      content = {
        reframe_pre: 'You have ',
        reframe_emphasis: <em style={{ fontStyle: 'italic', color: 'var(--color-accent)', fontWeight: 500 }}>{followers.toLocaleString()} followers</em>,
        reframe_post: ` and published ${posts} posts in 30 days. That's an audience that's already opted in — being talked to less often than your competitors' audiences.`,
      };
    }
  }
  // 4. High traffic, no visible conversion path
  else if (monthlyVisits >= 5000 && missingCapture) {
    content = {
      reframe_pre: 'Roughly ',
      reframe_emphasis: <em style={{ fontStyle: 'italic', color: 'var(--color-accent)', fontWeight: 500 }}>{monthlyVisits.toLocaleString()} monthly visitors</em>,
      reframe_post: " hit your site — and the only paths off the page are a contact form and a phone number. Everything in between (qualification, scheduling, follow-up) is human.",
    };
  }

  if (!content) return null;

  return (
    <ReframeBand kicker="Here's what most miss" id="reframe">
      <p style={{
        fontFamily: SERIF, fontWeight: 400,
        fontSize: 'clamp(1.75rem, 3.8vw, 3rem)', lineHeight: 1.12,
        letterSpacing: '-0.02em', color: '#1A1A1A',
      }}>
        {content.reframe_pre}{content.reframe_emphasis}{content.reframe_post}
      </p>
      {content.supporting && (
        <div className="mt-8">{content.supporting}</div>
      )}
    </ReframeBand>
  );
}

function JawDropSignal({ report }: { report: ReportJson }) {
  const reduceMotion = useReducedMotion();
  const totalAds = (report.ads?.google_ads?.count ?? 0) + (report.ads?.linkedin_ads?.count ?? 0) + (report.ads?.meta_ads?.count ?? 0);
  const isRenderableImg = (url: string | null | undefined) => url && !/\.(js|html?)(\?|$)/i.test(url);
  const firstImageCreative =
    report.ads?.meta_ads?.creatives?.find(c => isRenderableImg(c.images?.[0] || c.preview_url)) ??
    report.ads?.linkedin_ads?.creatives?.find(c => isRenderableImg(c.preview_url));
  const hiringCount = report.hiring?.open_count ?? 0;
  const topPost = report.linkedin_summary?.posts?.[0];

  if (totalAds === 0 && hiringCount === 0 && !topPost) return null;

  const wrapperStyle = { fontFamily: BODY_SERIF };

  if (firstImageCreative && totalAds > 0) {
    const imgSrc = firstImageCreative.images?.[0] || firstImageCreative.preview_url;
    const adPlatforms: string[] = [];
    if (report.ads?.google_ads?.detected) adPlatforms.push('Google');
    if (report.ads?.linkedin_ads?.detected) adPlatforms.push('LinkedIn');
    if (report.ads?.meta_ads?.detected) adPlatforms.push('Meta');
    const platformStr = adPlatforms.length > 0 ? adPlatforms.join(' + ') : 'paid channels';
    return (
      <motion.div
        initial={reduceMotion ? false : { y: 12, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: EASE }}
        className="py-12 lg:py-16 border-t border-[color:var(--color-hairline)]"
      >
        <p className="mb-4" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>
          Spotted · Live Signal
        </p>
        <div className="flex gap-6 lg:gap-10 items-start max-w-3xl">
          {imgSrc && (
            <div className="shrink-0 w-20 h-20 lg:w-28 lg:h-28 overflow-hidden" style={{ border: '1px solid rgba(26,26,26,0.1)', background: '#EFEAE2' }}>
              <img src={imgSrc} alt="Active ad creative" className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
          <div style={wrapperStyle}>
            <p style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.4rem, 3vw, 2.25rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
              Running <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>{totalAds}</span> active {totalAds === 1 ? 'ad' : 'ads'} on {platformStr}.
            </p>
            {firstImageCreative.body && firstImageCreative.body.trim().length > 20 && (
              <p className="mt-2 max-w-xl line-clamp-2" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(26,26,26,0.6)', fontStyle: 'italic' }}>
                "{firstImageCreative.body.length > 160 ? firstImageCreative.body.slice(0, 157) + '…' : firstImageCreative.body}"
              </p>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Fallback: paid ads without an image creative — surface count + platforms anyway
  if (totalAds > 0) {
    const adPlatforms: string[] = [];
    if (report.ads?.google_ads?.detected) adPlatforms.push('Google');
    if (report.ads?.linkedin_ads?.detected) adPlatforms.push('LinkedIn');
    if (report.ads?.meta_ads?.detected) adPlatforms.push('Meta');
    const platformStr = adPlatforms.length > 0 ? adPlatforms.join(' + ') : 'paid channels';
    return (
      <motion.div
        initial={reduceMotion ? false : { y: 12, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: EASE }}
        className="py-12 lg:py-16 border-t border-[color:var(--color-hairline)]"
      >
        <p className="mb-4" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>
          Spotted · Live Spend
        </p>
        <div className="max-w-3xl">
          <p style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.4rem, 3vw, 2.25rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
            <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>{totalAds}</span> active {totalAds === 1 ? 'ad' : 'ads'} on {platformStr}.
          </p>
          <p className="mt-2" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(26,26,26,0.65)', fontStyle: 'italic' }}>
            Public ad library confirms current spend — captured today.
          </p>
        </div>
      </motion.div>
    );
  }

  if (hiringCount > 0) {
    return (
      <motion.div
        initial={reduceMotion ? false : { y: 12, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: EASE }}
        className="py-12 lg:py-16 border-t border-[color:var(--color-hairline)]"
      >
        <p className="mb-4" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>
          Spotted · Hiring Signal
        </p>
        <div className="max-w-3xl">
          <p style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.4rem, 3vw, 2.25rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
            <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>{hiringCount}</span> open {hiringCount === 1 ? 'role' : 'roles'} right now.
          </p>
          {report.hiring?.sample_titles && report.hiring.sample_titles.length > 0 && (
            <p className="mt-2" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(26,26,26,0.65)' }}>
              Including: <Italic>{report.hiring.sample_titles[0]}</Italic>
              {report.hiring.sample_titles[1] ? `, ${report.hiring.sample_titles[1]}` : ''}
              {report.hiring.sample_titles.length > 2 ? ` + ${report.hiring.sample_titles.length - 2} more` : ''}.
            </p>
          )}
        </div>
      </motion.div>
    );
  }

  if (topPost) {
    return (
      <motion.div
        initial={reduceMotion ? false : { y: 12, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: EASE }}
        className="py-12 lg:py-16 border-t border-[color:var(--color-hairline)]"
      >
        <p className="mb-4" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>
          Spotted · Recent Post
        </p>
        <blockquote
          className="max-w-2xl"
          style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)', lineHeight: 1.4, color: '#1A1A1A', borderLeft: '2px solid var(--color-accent)', paddingLeft: 16 }}
        >
          "{topPost.text.length > 280 ? topPost.text.slice(0, 277) + '…' : topPost.text}"
        </blockquote>
        {topPost.reactions != null && (
          <p className="mt-3" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>
            {topPost.reactions} reactions
          </p>
        )}
      </motion.div>
    );
  }

  return null;
}

// SupportingEvidenceAccordion — collapses all evidence sections behind a single expand toggle.
// Collapsed by default so the core report (score → gap → opps → CTA) is scannable first.
function SupportingEvidenceAccordion({ report }: { report: ReportJson }) {
  const [open, setOpen] = React.useState(false);

  const hasAnything =
    !!(report.traffic?.monthly_visits) ||
    !!(report.ads?.google_ads?.detected || report.ads?.linkedin_ads?.detected || report.ads?.meta_ads?.detected) ||
    !!(report.hiring?.open_count) ||
    !!(report.linkedin_summary?.posts?.length) ||
    !!(report.recent_news?.length) ||
    !!(report.competitors?.length);

  if (!hasAnything) return null;

  return (
    <div className="py-12 lg:py-16">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ x: 2 }}
        transition={{ duration: 0.2 }}
        className="w-full flex items-center justify-between gap-6 text-left group px-5 lg:px-7 py-5 -mx-5 lg:-mx-7"
        style={{
          background: open ? 'rgba(76,110,61,0.07)' : 'rgba(76,110,61,0.04)',
          borderLeft: '3px solid var(--color-accent)',
          transition: 'background 0.2s ease',
        }}
      >
        <div>
          <Kicker section={6}>Want to verify</Kicker>
          <p className="mt-3" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.25rem, 2.2vw, 1.9rem)', lineHeight: 1.08, letterSpacing: '-0.015em', color: '#1A1A1A' }}>
            See the data behind every claim above.
          </p>
        </div>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          aria-hidden
          style={{ fontSize: '32px', color: 'var(--color-accent)', flexShrink: 0, lineHeight: 1, fontWeight: 300 }}
        >
          +
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="evidence-content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <SectionFundingTraffic report={report} />
            <SectionAdActivity report={report} />
            <SectionHiring report={report} />
            <SectionContentSample report={report} />
            <SectionNews report={report} />
            <Section5Competitive report={report} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
            <Kicker>Automation Maturity Score</Kicker>
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

// ── Sidebar nav ──────────────────────────────────────────────────────────────
// Sticky left rail listing major sections. Active section highlights as user scrolls.
// Only renders sections that are actually present in the DOM (sections that hide when
// data is empty are auto-omitted). Desktop only.

type NavSection = { id: string; label: string };

const SECTION_REGISTRY: NavSection[] = [
  { id: 'hero',         label: 'Overview' },
  { id: 'company',      label: 'The Company' },
  { id: 'breakdown',    label: 'The Breakdown' },
  { id: 'opportunities',label: 'Opportunities' },
  { id: 'numbers',      label: 'The Numbers' },
  { id: 'ad-activity',  label: 'Ad Activity' },
  { id: 'hiring',       label: 'Hiring' },
  { id: 'voice',        label: 'Your Voice' },
  { id: 'news',         label: 'Recent News' },
  { id: 'ai-adoption',  label: 'AI Adoption' },
  { id: 'competitive',  label: 'Competitive' },
  { id: 'week-one',     label: 'The Play' },
  { id: 'cta',          label: 'Book a Call' },
];

const SidebarNav: React.FC = () => {
  const [available, setAvailable] = useState<NavSection[]>([]);
  const [activeId, setActiveId] = useState<string>('hero');

  // Detect which sections are actually rendered (some hide when data is empty)
  useEffect(() => {
    const found = SECTION_REGISTRY.filter((s) => document.getElementById(s.id) !== null);
    setAvailable(found);
  }, []);

  // IntersectionObserver: the section whose top is closest to viewport top + 30% wins
  useEffect(() => {
    if (available.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry that is intersecting AND has its top closest to (but under) viewport top
        const intersecting = entries.filter((e) => e.isIntersecting);
        if (intersecting.length === 0) return;
        const sorted = intersecting.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topVisible = sorted.find((e) => e.boundingClientRect.top <= 100) ?? sorted[0];
        if (topVisible.target.id) setActiveId(topVisible.target.id);
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    available.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [available]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  };

  if (available.length < 3) return null; // don't render for thin reports

  return (
    <nav
      aria-label="Section navigation"
      className="hidden xl:block"
      style={{
        position: 'fixed',
        left: 24,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 25,
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
    >
      <ul className="space-y-1.5" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {available.map((s) => {
          const isActive = activeId === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => handleClick(e, s.id)}
                className="group flex items-center gap-2.5 py-1.5 transition-colors"
                style={{
                  fontFamily: MONO,
                  fontSize: '10px',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: isActive ? 'var(--color-accent)' : 'rgba(26,26,26,0.4)',
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'rgba(26,26,26,0.75)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'rgba(26,26,26,0.4)';
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: isActive ? 18 : 8,
                    height: 1,
                    background: isActive ? 'var(--color-accent)' : 'currentColor',
                    transition: 'width 0.25s ease',
                    flexShrink: 0,
                  }}
                />
                <span>{s.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
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
  const rawName = scan.company_name ?? scan.domain;
  // Apollo sometimes returns names in ALL CAPS — normalize to title case so the H1 doesn't shout.
  // Conservative: only adjusts when the name is entirely uppercase. Preserves intentional caps like "BNP Paribas".
  const companyName = (rawName === rawName.toUpperCase() && rawName.length > 2)
    ? rawName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
    : rawName;

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
          {/* Mobile: tighter CTA so it doesn't compete with the brand H1 below at 390px (Visual flag).
              Desktop: full label. Same destination either way. */}
          <a
            href={`https://calendly.com/im-ivanmanfredi/30min?utm_source=scan`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-3 sm:px-4"
            style={{
              fontFamily: BODY_SERIF,
              fontSize: '14px',
              fontWeight: 600,
              backgroundColor: '#1A1A1A',
              color: '#F7F4EF',
              minHeight: 40,
            }}
          >
            <span className="sm:hidden">Book</span>
            <span className="hidden sm:inline">Book your Assessment</span>
            <ArrowRight size={14} />
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

      {/* ═══════════════════════════════════════════════════════════════════════
          Challenger arc — 8 beats. Each section changes emotional register.
          §1 Answer-first → §2 Warmer → §3 Reframe → §4 Cost → §5 (deferred) →
          §6 New Way → §7 Trust ballast → §8 Solution
          Transitions between beats hand off the reader mentally.
          ═══════════════════════════════════════════════════════════════════════ */}

      {/* §1 — Answer-first. The score reveal. */}
      <SectionScoreRevealDark report={report} />

      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <Transition>
          Before we tell you why — let's confirm we're looking at the same company.
        </Transition>
      </div>

      {/* §2 — Warmer. Earn the right to keep talking. */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <Section1CompanyBrief report={report} />
      </div>

      {/* §3 — Reframe (load-bearing). The "but here's what you missed" hinge. */}
      <ReframeSection report={report} />

      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <Transition>
          It's not just an observation. Here's the math behind what it's costing.
        </Transition>
      </div>

      {/* §4 — Rational Drowning. Priority gap + cost. */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <SectionPriorityGap report={report} />
      </div>

      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <Transition>
          So here's where it's happening — five places, ranked by leverage.
        </Transition>
      </div>

      {/* §6 — New Way. The ranked opportunities. */}
      <div className="max-w-6xl mx-auto px-5 sm:px-6 pb-24">
        <Section3Opportunities report={report} companyName={companyName} />

        <Transition>
          If you want to check our work — every number above traces back to this.
        </Transition>

        {/* §7 — Trust ballast. Quiet, optional. */}
        <SupportingEvidenceAccordion report={report} />
        <SectionMethodology />

        <Transition tone="sage">
          You've now seen what we see. Two ways forward.
        </Transition>

        {/* §8 — Your Solution. CTA. */}
        <SectionClosingArc report={report} companyName={companyName} />
      </div>
    </div>
  );
};

export default ScanReportPage;
