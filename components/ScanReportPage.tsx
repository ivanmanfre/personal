// components/ScanReportPage.tsx — build-id: nudge-2026-05-12-1
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, animate, AnimatePresence, useInView, useReducedMotion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion';
import {
  ExternalLink, CheckCircle, XCircle, AlertCircle, ArrowLeft, ArrowRight,
} from 'lucide-react';
import { useScan } from '../hooks/useScan';
import { useMetadata } from '../hooks/useMetadata';
import { ScoreBar } from './scan/ScoreBar';
import { OpportunityCard } from './scan/OpportunityCard';
import type { ReportJson, AdCreative, Opportunity, CallIntel, ContentSystem, Scan } from '../lib/scanTypes';
import { gradeColor } from '../lib/scanApi';
import { PROMISES, METRICS, SYSTEM_FLOW, LM_FORMATS, LM_PROMISES } from '../lib/contentSystemContent';
import SystemFlowDiagram from './SystemFlowDiagram';
import LinkedInFeedMockup from './ui/LinkedInFeedMockup';
import { buildFeedSpecFromContentSystem } from '../lib/contentSystemFeed';

const CALENDLY_BASE = 'https://calendly.com/im-ivanmanfredi/30min';

const SERIF = '"DM Serif Display", "Bodoni Moda", Georgia, serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"IBM Plex Mono", monospace';
const EASE = [0.22, 0.84, 0.36, 1] as const;

// ── Editorial primitives ──────────────────────────────────────────────────────

// Section masthead. Each section starts with this so the reader always knows
// "I am now in section X". Sage accent rule + zero-padded chapter number + kicker label.
const Kicker: React.FC<{ children: React.ReactNode; section?: string | number }> = ({ children, section }) => (
  <div className="mb-1">
    {section != null && (
      <div className="flex items-center gap-3 mb-2">
        <span aria-hidden style={{ display: 'inline-block', height: 1, width: 28, background: 'var(--color-accent)' }} />
        <span style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 600 }}>
          {typeof section === 'number' ? String(section).padStart(2, '0') : section}
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

// Company logo with a source-fallback chain. report.logo_url is often a Brandfetch CDN URL
// that now 404s without an API key, so we fall back to a Google favicon derived from the
// company domain, then hide entirely if neither resolves (the company name sits right below,
// so a missing logo degrades cleanly to no logo rather than a broken-image tile).
const CompanyLogo: React.FC<{ logoUrl: string | null; domain: string | null }> = ({ logoUrl, domain }) => {
  const sources = React.useMemo(
    () => [logoUrl, domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null].filter(Boolean) as string[],
    [logoUrl, domain],
  );
  const [idx, setIdx] = React.useState(0);
  if (idx >= sources.length) return null;
  return (
    <img
      key={sources[idx]}
      src={sources[idx]}
      alt=""
      loading="lazy"
      className="w-16 h-16 object-contain mb-6"
      style={{ background: '#fff', border: '1px solid rgba(26,26,26,0.08)', padding: 6 }}
      onError={() => setIdx((i) => i + 1)}
    />
  );
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
  const reduceMotion = useReducedMotion();
  const done = useRef(false);

  // Plain rect-based trigger. framer-motion's useInView margin proved flaky on narrow
  // viewports here (counters stuck at 0 on mobile) — a direct getBoundingClientRect + scroll
  // check fires reliably on every device and never leaves the number stranded at 0.
  useEffect(() => {
    if (reduceMotion) { setDisplayed(value); return; }
    const el = ref.current;
    if (!el) return;
    let controls: ReturnType<typeof animate> | undefined;
    const run = () => {
      if (done.current) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      if (r.top < vh * 0.92 && r.bottom > 0) {
        done.current = true;
        window.removeEventListener('scroll', run);
        controls = animate(0, value, {
          duration: 1.2,
          ease: EASE as unknown as [number, number, number, number],
          onUpdate: (v) => setDisplayed(Math.round(v)),
        });
      }
    };
    run();
    window.addEventListener('scroll', run, { passive: true });
    return () => { window.removeEventListener('scroll', run); controls?.stop(); };
  }, [value, reduceMotion]);

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
// Transition — visual SECTION BREAK between major chapters. Distinct from internal
// callouts (which use the sage left rule). Section breaks are centered with horizontal
// rules on each side so they read as "between sections" not "inside a section".
const Transition: React.FC<{ children: React.ReactNode; tone?: 'paper' | 'sage' }> = ({ children, tone = 'paper' }) => {
  const reduceMotion = useReducedMotion();
  const proseColor = tone === 'sage' ? 'rgba(76,110,61,0.85)' : 'rgba(26,26,26,0.65)';
  const ruleColor = tone === 'sage' ? 'rgba(76,110,61,0.3)' : 'rgba(26,26,26,0.15)';
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.6, ease: EASE }}
      className="py-14 lg:py-20"
    >
      {/* Desktop: centered rule + text + rule (chapter-break pattern). Mobile: rule above
          + centered text + rule below (stacked vertically). Text never overflows. */}
      <div className="max-w-3xl mx-auto">
        {/* Mobile-only: single rule above */}
        <div className="sm:hidden mb-6" style={{ height: 1, background: ruleColor }} />
        {/* Desktop: 3-column flex with text in center */}
        <div className="hidden sm:flex items-center gap-6">
          <span aria-hidden style={{ flex: '1 1 0%', height: 1, background: ruleColor }} />
          <p style={{
            fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400,
            fontSize: 'clamp(1.125rem, 1.7vw, 1.375rem)', lineHeight: 1.4,
            letterSpacing: '-0.005em', color: proseColor, textAlign: 'center',
            flexShrink: 1, maxWidth: '480px',
          }}>
            {children}
          </p>
          <span aria-hidden style={{ flex: '1 1 0%', height: 1, background: ruleColor }} />
        </div>
        {/* Mobile-only: text spans full width, centered, no flanking rules */}
        <p className="sm:hidden" style={{
          fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400,
          fontSize: '17px', lineHeight: 1.45,
          letterSpacing: '-0.005em', color: proseColor, textAlign: 'center',
          padding: '0 16px',
        }}>
          {children}
        </p>
        {/* Mobile-only: single rule below */}
        <div className="sm:hidden mt-6" style={{ height: 1, background: ruleColor }} />
      </div>
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
          <div className="mt-12 lg:mt-16">
            <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
              12-month cost of inaction
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
              That's the compounding cost across the 5 opportunities below. Unleveraged time and missed conversion if nothing in the system changes for 12 months.
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

// ── Call-Intelligence variant ─────────────────────────────────────────────────
// Rendered IN PLACE OF Section3Opportunities when matched_offer === 'call_intelligence'.
// The cold DM promised this prospect that nobody reviews what's said across their calls;
// this section delivers on exactly that — an external audit of their call situation, what's
// leaking inside those calls, and the system that surfaces it — instead of a generic ops list.
const CI_ARCHETYPE: Record<CallIntel['archetype'], { kicker: string; sampleKicker: string }> = {
  intake_driven:       { kicker: 'Call Intelligence · Intake',    sampleKicker: 'Sample · flagged intake call' },
  sales_demo_driven:   { kicker: 'Call Intelligence · Pipeline',  sampleKicker: 'Sample · weekly deal signal' },
  cs_retention_driven: { kicker: 'Call Intelligence · Accounts',  sampleKicker: 'Sample · weekly account signal' },
};

function CallIntelSection({ report, companyName }: { report: ReportJson; companyName: string }) {
  const ci = report.call_intel;
  if (!ci) return null;
  const meta = CI_ARCHETYPE[ci.archetype] ?? CI_ARCHETYPE.intake_driven;
  const calendlyUrl = `${CALENDLY_BASE}?utm_source=scan&utm_content=${encodeURIComponent(companyName)}&a1=${encodeURIComponent('call intelligence')}`;
  const hairline = 'var(--color-hairline)';
  // Accent-ink (darker sage) for small text on paper — passes WCAG AA <19px where the brighter accent (3.6:1) fails.
  const accentInk = 'var(--color-accent-ink)';

  return (
    <Section
      id="opportunities"
      kicker={meta.kicker}
      title={<>What your calls are <Italic>hiding</Italic>.</>}
      section={5}
    >
      <SectionAnswer>{ci.thesis}</SectionAnswer>

      {/* ── What we can see from outside (the honest external audit) ── */}
      <div className="mb-14">
        <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
          What we can see from outside
        </p>
        <p style={{
          fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400,
          fontSize: 'clamp(2.75rem, 7vw, 5rem)', lineHeight: 0.95,
          letterSpacing: '-0.03em', color: '#1A1A1A', marginTop: 10,
        }}>
          {ci.volume_estimate.value}
        </p>
        {ci.volume_estimate.basis && (
          <p className="mt-3 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.55, color: 'rgba(26,26,26,0.65)' }}>
            {ci.volume_estimate.basis}
          </p>
        )}
        {/* Self-bordered cards (not a gap-px bg grid) so an odd count leaves clean blank space, not a gray cell. */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {ci.observable_signals.map((s, i) => (
            <div key={i} className="p-5" style={{ border: `1px solid ${hairline}` }}>
              <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>
                {s.label}
              </p>
              <p className="mt-1.5" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.55, color: '#3D3D3B' }}>
                {s.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── What's leaking in those calls (archetype-tailored value) ── */}
      <div className="mb-14">
        <Kicker>What's leaking in those calls</Kicker>
        <div className="mt-6 space-y-2">
          {ci.leaking_signals.map((l, i) => (
            <div key={i} className="flex gap-4 p-5" style={{ border: `1px solid ${hairline}` }}>
              <span aria-hidden style={{
                fontFamily: MONO, fontSize: '13px', color: accentInk, fontWeight: 600,
                lineHeight: 1.5, flexShrink: 0,
              }}>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.25rem, 2.4vw, 1.6rem)', lineHeight: 1.15, letterSpacing: '-0.015em', color: '#1A1A1A' }}>
                  {l.title}
                </p>
                <p className="mt-1.5 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.55, color: '#3D3D3B' }}>
                  {l.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── The system + a tangible sample of its output (the pitch) ── */}
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div>
          <Kicker>The system</Kicker>
          <SerifBody large className="mt-4">{ci.system.summary}</SerifBody>
          <ul className="mt-6 space-y-3">
            {ci.system.capabilities.map((c, i) => (
              <li key={i} className="flex gap-3" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.5, color: '#3D3D3B' }}>
                <span aria-hidden style={{ display: 'inline-block', height: 1, width: 16, background: 'var(--color-accent)', marginTop: '0.7em', flexShrink: 0 }} />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sample output — faux product surface so they can picture the deliverable */}
        <div style={{ border: `1px solid ${hairline}`, background: 'var(--color-paper, #F7F4EF)' }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${hairline}` }}>
            <span aria-hidden style={{ height: 7, width: 7, background: 'var(--color-accent)' }} />
            <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
              {meta.sampleKicker}
            </p>
          </div>
          <div className="p-5">
            <p style={{ fontFamily: SERIF, fontWeight: 400, fontSize: '1.35rem', lineHeight: 1.15, letterSpacing: '-0.015em', color: '#1A1A1A' }}>
              {ci.sample_output.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {ci.sample_output.items.map((it, i) => (
                <li key={i} className="flex gap-2.5" style={{ fontFamily: MONO, fontSize: '13px', lineHeight: 1.5, color: '#3D3D3B' }}>
                  <span aria-hidden style={{ color: accentInk, flexShrink: 0 }}>→</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Revenue math + CTA ── */}
      <div className="mt-14 p-7 lg:p-9" style={{ border: `1px solid ${hairline}` }}>
        <SerifBody large><Emphasized>{ci.revenue_math}</Emphasized></SerifBody>
        <a
          href={calendlyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-6 group"
          style={{
            fontFamily: MONO, fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase',
            color: accentInk, fontWeight: 600, textDecoration: 'none',
          }}
        >
          See what your calls are hiding
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
        </a>
      </div>
    </Section>
  );
}

// ── Call-Intelligence PITCH page (v2) ─────────────────────────────────────────
// Cut-down, outcome-led pitch rendered IN PLACE OF the whole generic report when
// matched_offer === 'call_intelligence'. No automation score, no tech-stack brief,
// no $2k assessment — just: outcome hero -> where close-rate/churn hides ->
// a designed product mock (centerpiece) -> book a call.
const CI_META: Record<CallIntel['archetype'], { tag: string; hiding: string; review: string }> = {
  intake_driven:       { tag: 'Intake',   hiding: 'Where the signed cases are hiding', review: 'Weekly intake review' },
  sales_demo_driven:   { tag: 'Pipeline', hiding: 'Where the close rate is hiding',     review: 'Weekly call review' },
  cs_retention_driven: { tag: 'Accounts', hiding: 'Where the churn is hiding',          review: 'Weekly account review' },
};

// Softened-brand tokens for the call-intel pitch page (Ivan, 2026-06-15: warmer, rounded, soft
// 3D depth — keeps the serif/paper/sage editorial DNA but rounds corners + adds smooth shadows).
const CI_CARD = '#FCFBF7';        // lifts gently off the paper bg
const CI_R = 22;                  // card radius
const CI_R_SM = 13;               // button / chip / small radius
const CI_SHADOW = '0 1px 2px rgba(26,26,26,0.04), 0 10px 28px rgba(26,26,26,0.06)';
const CI_SHADOW_LG = '0 2px 6px rgba(26,26,26,0.05), 0 26px 64px rgba(26,26,26,0.11)';
const CI_CORAL = '#A85439';       // risk / loss accent (brand coral) — used by churn alerts

// The centerpiece — a branded "software" surface so the prospect pictures the deliverable.
// Count-up for a metric value string like "31%", "12", "$40k" — animates the numeric part.
const CICountMetric: React.FC<{ value: string; style?: React.CSSProperties }> = ({ value, style }) => {
  const m = String(value).match(/^(\D*)([\d][\d,.]*)(.*)$/);
  if (!m) return <span style={style}>{value}</span>;
  const num = parseFloat(m[2].replace(/,/g, ''));
  if (!isFinite(num)) return <span style={style}>{value}</span>;
  return <span style={style}>{m[1]}<Counter value={num} />{m[3]}</span>;
};

// The product-mock dashboard — a designed, animated "software" surface (metric tiles,
// rep bars that grow on scroll, flagged-insight rows). Falls back to a list for old scans.
function CallIntelProductMock({ ci, companyName }: { ci: CallIntel; companyName: string }) {
  const meta = CI_META[ci.archetype] ?? CI_META.sales_demo_driven;
  const reduce = useReducedMotion();
  const hairline = 'var(--color-hairline)';
  const accentInk = 'var(--color-accent-ink)';
  const so = ci.sample_output;
  const metrics = so.metrics && so.metrics.length ? so.metrics.slice(0, 3) : null;
  const reps = (so.reps || []).slice(0, 4);
  const flags = so.flags && so.flags.length ? so.flags.slice(0, 3) : null;
  const maxPct = Math.max(1, ...reps.map((r) => r.pct || 0));
  const bestRep = reps.reduce((b, r) => (r.pct > (b?.pct ?? -1) ? r : b), null as null | { name: string; pct: number });

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: EASE }}
      className="overflow-hidden relative"
      style={{ border: `1px solid ${hairline}`, borderRadius: CI_R, boxShadow: CI_SHADOW_LG }}
    >
      <CILoadShimmer />
      {/* window titlebar */}
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: '#1A1A1A' }}>
        <span aria-hidden style={{ height: 7, width: 7, background: 'var(--color-accent)', flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.92)' }}>
          {companyName} · {meta.review}
        </span>
        <span className="ml-auto flex items-center gap-1.5" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.55)' }}>
          <motion.span aria-hidden animate={reduce ? {} : { opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ height: 6, width: 6, background: 'var(--color-accent)' }} />
          Live
        </span>
      </div>

      <div style={{ background: 'var(--color-paper, #F7F4EF)' }}>
        {metrics ? (
          <>
            {flags && flags[0] && (
              <div className="flex items-start gap-2.5 px-5 py-3.5" style={{ borderBottom: `1px solid ${hairline}`, background: 'rgba(42,143,101,0.05)' }}>
                <span style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: accentInk, fontWeight: 600, marginTop: 3, flexShrink: 0 }}>This week</span>
                <span style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.4, color: '#1A1A1A' }}>{flags[0].text}</span>
              </div>
            )}
            {/* metric tiles */}
            <div className="grid grid-cols-3" style={{ borderBottom: `1px solid ${hairline}` }}>
              {metrics.map((m, i) => (
                <div key={i} className="px-5 py-5" style={{ borderLeft: i ? `1px solid ${hairline}` : 'none' }}>
                  <CICountMetric value={m.value} style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(1.9rem, 3vw, 2.6rem)', lineHeight: 1, letterSpacing: '-0.02em', color: i === 0 ? 'var(--color-accent)' : '#1A1A1A', fontVariantNumeric: 'tabular-nums' }} />
                  <p className="mt-2" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>{m.label}</p>
                  {m.delta && <p className="mt-0.5" style={{ fontFamily: MONO, fontSize: '10px', color: accentInk }}>{m.delta}</p>}
                </div>
              ))}
            </div>

            <div className="px-5 lg:px-6 py-6 space-y-6">
              {/* rep bars */}
              {reps.length > 0 && (
                <div>
                  <p className="mb-3" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>Close rate by rep</p>
                  <div className="space-y-2.5">
                    {reps.map((r, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="shrink-0" style={{ width: 96, fontFamily: BODY_SERIF, fontSize: '13px', color: '#3D3D3B' }}>{r.name}</span>
                        <div className="relative flex-1" style={{ height: 7, background: 'rgba(26,26,26,0.07)' }}>
                          <motion.div
                            initial={reduce ? false : { scaleX: 0 }}
                            whileInView={{ scaleX: 1 }}
                            viewport={{ once: true, margin: '-40px' }}
                            transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.1 }}
                            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round((r.pct / maxPct) * 100)}%`, transformOrigin: 'left', background: bestRep && r.name === bestRep.name ? 'var(--color-accent)' : '#1A1A1A' }}
                          />
                        </div>
                        <span className="shrink-0 text-right" style={{ width: 38, fontFamily: MONO, fontSize: '12px', fontWeight: 600, color: bestRep && r.name === bestRep.name ? accentInk : '#1A1A1A', fontVariantNumeric: 'tabular-nums' }}>{r.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* flagged insights */}
              {flags && (
                <div className="space-y-px" style={{ borderTop: `1px solid ${hairline}` }}>
                  {flags.map((f, i) => (
                    <motion.div
                      key={i}
                      initial={reduce ? false : { opacity: 0, x: -8 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: '-30px' }}
                      transition={{ duration: 0.5, ease: EASE, delay: 0.2 + i * 0.08 }}
                      className="flex items-start gap-3 pt-3"
                    >
                      <span className="shrink-0 px-2 py-1" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: accentInk, border: `1px solid ${hairline}`, borderRadius: 8, background: 'rgba(42,143,101,0.06)' }}>{f.tag}</span>
                      <span style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.45, color: '#3D3D3B' }}>{f.text}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // fallback for pre-structured scans
          <div className="p-6 lg:p-7">
            <p style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.35rem, 2.5vw, 1.75rem)', lineHeight: 1.12, letterSpacing: '-0.015em', color: '#1A1A1A' }}>{so.title}</p>
            <ul className="mt-5">
              {so.items.map((it, i) => (
                <li key={i} className="flex gap-3.5" style={{ borderTop: i ? `1px solid ${hairline}` : 'none', paddingTop: i ? '0.85rem' : 0, marginTop: i ? '0.85rem' : 0 }}>
                  <span aria-hidden style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 600, color: accentInk, lineHeight: 1.55, flexShrink: 0, minWidth: 16 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: '#3D3D3B' }}>{it}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Magnetic spring CTA — lifted from the landing-page interaction language.
const CIMagneticCTA: React.FC<{ href: string; label: string; small?: boolean }> = ({ href, label, small }) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0); const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 250, damping: 20 });
  const sy = useSpring(y, { stiffness: 250, damping: 20 });
  return (
    <div ref={ref} style={{ display: 'inline-block' }}
      onMouseMove={(e) => { if (reduce || !ref.current) return; const r = ref.current.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * 0.25); y.set((e.clientY - r.top - r.height / 2) * 0.25); }}
      onMouseLeave={() => { x.set(0); y.set(0); }}>
      <motion.a href={href} target="_blank" rel="noopener noreferrer" className="group"
        style={{ x: sx, y: sy, fontFamily: BODY_SERIF, fontSize: small ? '14px' : '16.5px', fontWeight: 600, background: '#1A1A1A', color: '#F7F4EF', padding: small ? '0 18px' : '16px 30px', minHeight: small ? 42 : 56, borderRadius: small ? 11 : 14, boxShadow: small ? 'none' : '0 2px 6px rgba(26,26,26,0.12), 0 12px 28px rgba(26,26,26,0.16)', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {label}
        <ArrowRight size={small ? 14 : 17} className="transition-transform group-hover:translate-x-1" />
      </motion.a>
    </div>
  );
};

// Thematic animated audio-waveform — call intelligence reads as "live audio being scored".
// Deterministic bar heights, gentle continuous scaleY loop. Used big in the hero + tiny inline.
function CIWaveform({ count = 56, maxH = 56, gap = 3, barW = 2.5, className = '', barColor = 'var(--color-accent)' }: { count?: number; maxH?: number; gap?: number; barW?: number; className?: string; barColor?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className={`flex items-center ${className}`} aria-hidden style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => {
        const base = 0.22 + 0.78 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.45) + Math.sin(i * 0.3) * 0.4);
        return (
          <motion.span key={i} style={{ width: barW, borderRadius: barW, background: barColor, height: Math.max(5, base * maxH), transformOrigin: 'center', flexShrink: 0 }}
            animate={reduce ? {} : { scaleY: [1, 0.32 + (i % 4) * 0.12, 0.88, 0.46, 1] }}
            transition={{ duration: 1.6 + (i % 5) * 0.25, repeat: Infinity, ease: 'easeInOut', delay: (i % 9) * 0.1 }} />
        );
      })}
    </div>
  );
}

// Premium editorial-cover hero for the call-intel pitch — lifts the landing-page craft:
// texture (faint grid + drifting grain), live equalizer byline, expanding sage rule,
// editorial line-mask reveal, mixed-scale type, animated waveform footer, mono spec row.
const CI_HERO: Record<CallIntel['archetype'], { pre: string; hero: string; sub: string; spec: string[] }> = {
  sales_demo_driven: {
    pre: 'From the sales calls you already run,',
    hero: 'close more.',
    sub: 'More revenue from the same calls. No new leads. No bigger team.',
    spec: ['More deals closed', 'Churn caught early', 'Reps coached to your best'],
  },
  cs_retention_driven: {
    pre: 'Before a customer churns,',
    hero: 'catch it early.',
    sub: 'Spot at-risk accounts in time to save them. No surprises at renewal.',
    spec: ['Churn caught early', 'More renewals saved', 'Every account call reviewed'],
  },
  intake_driven: {
    pre: 'From the intake calls you already take,',
    hero: 'sign more.',
    sub: 'More of the right cases say yes. Same calls, same team.',
    spec: ['More cases signed', 'Fewer good leads lost', 'Intake coached to your best'],
  },
};

function CallIntelHero({ ci, companyName, meta, bookUrl }: { ci: CallIntel; companyName: string; meta: { tag: string }; bookUrl: string }) {
  const reduce = useReducedMotion();
  const h = CI_HERO[ci.archetype] ?? CI_HERO.sales_demo_driven;
  const hairline = 'var(--color-hairline)';
  // Editorial line-mask reveal — lines rise out of a clip mask, settle, stop.
  const Reveal: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => (
    <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.18em', marginBottom: '-0.18em' }}>
      <motion.span style={{ display: 'block' }} initial={reduce ? false : { y: '120%' }} animate={{ y: 0 }} transition={{ delay, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}>
        {children}
      </motion.span>
    </span>
  );
  return (
    <section className="relative bg-paper overflow-hidden" style={{ borderBottom: `1px solid ${hairline}` }}>
      {/* faint editorial grid */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundImage: 'linear-gradient(rgba(26,26,26,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(26,26,26,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      {/* slow drifting paper grain */}
      <motion.div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: 0.2, backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.3%22/></svg>")' }} animate={reduce ? {} : { backgroundPosition: ['0px 0px', '120px 120px'] }} transition={{ duration: 90, repeat: Infinity, ease: 'linear' }} />
      {/* expanding sage rule across top */}
      <motion.div initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.1, duration: 1.6, ease: EASE }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--color-accent)', transformOrigin: 'left', opacity: 0.5, zIndex: 5 }} />

      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-6 pt-12 pb-14 lg:pt-16 lg:pb-20 lg:grid lg:grid-cols-[1.22fr_0.78fr] lg:gap-12 lg:items-center">
        <div>
          {/* status byline */}
          <motion.div initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }} className="mb-9 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#5A5752' }}>
            <CIWaveform count={5} maxH={13} gap={2} barW={2} className="mr-0.5" />
            <span>Call Intelligence · {meta.tag}</span>
            <span aria-hidden style={{ color: 'rgba(26,26,26,0.3)' }}>/</span>
            <span style={{ color: 'rgba(26,26,26,0.5)' }}>for {companyName}</span>
          </motion.div>

          {/* benefit-led headline — leads with the outcome, not the mechanism */}
          <h1 className="mb-7" style={{ fontFamily: SERIF, fontWeight: 400, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
            <Reveal delay={0.12}>
              <span style={{ display: 'block', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', lineHeight: 1.1, color: '#3D3D3B' }}>{h.pre}</span>
            </Reveal>
            <Reveal delay={0.26}>
              <span style={{ display: 'block', color: 'var(--color-accent)', fontSize: 'clamp(3.4rem, 8.5vw, 6.4rem)', lineHeight: 0.92, letterSpacing: '-0.045em', marginTop: '0.06em', marginLeft: '-0.015em' }}>{h.hero}</span>
            </Reveal>
          </h1>

          {/* plain benefit subhead — bigger, short, simple */}
          <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.9, ease: EASE }} className="max-w-xl" style={{ fontFamily: BODY_SERIF, fontSize: 'clamp(18px, 2.2vw, 21px)', lineHeight: 1.5, color: '#3D3D3B' }}>
            {h.sub}
          </motion.p>

          {/* mono spec row */}
          <motion.ul initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.92, duration: 0.7, ease: EASE }} className="mt-7 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-2.5 sm:gap-0">
            {h.spec.map((s, i) => (
              <li key={s} className={`flex items-center gap-2.5 sm:px-5 ${i === 0 ? 'sm:pl-0' : 'sm:border-l'}`} style={{ fontFamily: MONO, fontSize: '12.5px', letterSpacing: '0.02em', color: '#2C3A31', borderColor: hairline }}>
                <span className={i === 0 ? '' : 'sm:hidden'} style={{ width: 5, height: 5, background: 'var(--color-accent)', flexShrink: 0 }} aria-hidden />
                {s}
              </li>
            ))}
          </motion.ul>

          <motion.div initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.02, duration: 0.6, ease: EASE }} className="mt-9">
            <CIMagneticCTA href={bookUrl} label="See it on your calls" />
          </motion.div>
        </div>

        {/* RIGHT — a "live call" panel: the waveform moved here as an intentional thematic visual */}
        <motion.div className="hidden lg:block" initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.75, duration: 0.9, ease: EASE }}>
          <div className="px-6 py-7" style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW_LG }}>
            <div className="flex items-center justify-between mb-6" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5A5752' }}>
              <span className="flex items-center gap-2">
                <motion.span aria-hidden animate={reduce ? {} : { opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ width: 6, height: 6, borderRadius: 6, background: 'var(--color-accent)' }} />
                Live call
              </span>
              <span style={{ color: 'rgba(26,26,26,0.4)' }}>scoring</span>
            </div>
            <div className="flex items-center justify-center" style={{ height: 90 }}>
              <CIWaveform count={32} maxH={78} gap={4} barW={3} />
            </div>
            <div className="mt-6 pt-4 flex items-center justify-between" style={{ borderTop: `1px solid ${hairline}`, fontFamily: MONO, fontSize: '11px', letterSpacing: '0.06em', color: '#5A5752' }}>
              <span>0:42 / 0:42</span>
              <span style={{ color: 'var(--color-accent-ink)', fontWeight: 600 }}>analyzing…</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// "Sound familiar?" — the pain/agitation story beat (starborn-style). Short plain lines, one
// idea each, building to "There's a better way." Replaces the dense analytical audit sections.
const CI_PAIN: Record<CallIntel['archetype'], string[]> = {
  sales_demo_driven: [
    'Some reps close them. Some don’t.',
    'And no one has time to listen back and find out why.',
    'So the same mistakes lose you deals, over and over.',
    'Your best rep makes it look easy. The rest of the team never learns how.',
  ],
  cs_retention_driven: [
    'A few of those customers are quietly unhappy.',
    'You won’t find out until they don’t renew.',
    'And by then, it’s too late to fix it.',
    'So good accounts walk, and you never saw it coming.',
  ],
  intake_driven: [
    'Some become clients. Most don’t.',
    'And no one reviews the calls to see what went wrong.',
    'So good leads slip away, every single week.',
    'And the ones who would have signed never get a second look.',
  ],
};

function CallIntelPain({ ci, companyName, receipts, scan }: { ci: CallIntel; companyName: string; receipts: { label: string; value: string }[]; scan: Scan }) {
  const reduce = useReducedMotion();
  const hairline = 'var(--color-hairline)';
  const accentInk = 'var(--color-accent-ink)';
  const painLines = CI_PAIN[ci.archetype] ?? CI_PAIN.sales_demo_driven;
  const volumeClean = (ci.volume_estimate?.value || '').replace(/^~\s*/, '').replace(/\s*\/\s*(month|mo)\b/i, '').trim();
  const opener = ci.archetype === 'cs_retention_driven' ? `${companyName} is on customer calls all week.`
    : ci.archetype === 'intake_driven' ? `${companyName} takes intake calls all day.`
    : `${companyName} runs ${volumeClean || 'sales calls'} a month.`;
  const leaks = (ci.leaking_signals ?? []).slice(0, 3);
  return (
    <section className="max-w-3xl mx-auto px-5 sm:px-6 py-16 lg:py-24">
      <Kicker>Sound familiar?</Kicker>
      <motion.p className="mt-7" initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.6, ease: EASE }}
        style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.7rem, 3.4vw, 2.5rem)', lineHeight: 1.12, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
        {opener}
      </motion.p>
      <div className="mt-6 space-y-4">
        {painLines.map((l, i) => (
          <motion.p key={i} initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.5, ease: EASE, delay: Math.min(i * 0.06, 0.3) }}
            style={{ fontFamily: BODY_SERIF, fontWeight: 400, fontSize: 'clamp(19px, 2.4vw, 24px)', lineHeight: 1.45, color: '#3D3D3B' }}>
            {l}
          </motion.p>
        ))}
      </div>

      {leaks.length > 0 && (
        <motion.div className="mt-12 p-7 lg:p-8" initial={reduce ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.7, ease: EASE }}
          style={{ background: CI_CARD, borderRadius: CI_R, boxShadow: CI_SHADOW, border: `1px solid ${hairline}` }}>
          <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>On {companyName}'s calls, three things stood out</p>
          <ul className="mt-5 space-y-4">
            {leaks.map((l, i) => (
              <li key={i} className="flex gap-4 items-baseline">
                <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--color-accent)', lineHeight: 1, minWidth: 22 }}>{i + 1}</span>
                <span style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.2rem, 2.4vw, 1.5rem)', lineHeight: 1.18, letterSpacing: '-0.01em', color: '#1A1A1A' }}>{l.title}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.h2 className="mt-14" initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.7, ease: EASE }}
        style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', lineHeight: 1.04, letterSpacing: '-0.025em', color: 'var(--color-accent)' }}>
        There's a better way.
      </motion.h2>
      <p className="mt-3" style={{ fontFamily: BODY_SERIF, fontSize: '18px', color: '#5A5752' }}>Here's how it works.</p>

      {receipts.length > 0 && (
        <div className="mt-12 pt-8" style={{ borderTop: `1px solid ${hairline}` }}>
          <p className="mb-4" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>We didn't guess. Pulled from {scan.domain ?? companyName} today</p>
          <div className="flex flex-wrap gap-2.5">
            {receipts.map((r, i) => (
              <span key={i} className="inline-flex items-baseline gap-2 px-3.5 py-2" style={{ background: CI_CARD, border: `1px solid ${hairline}`, borderRadius: CI_R_SM, boxShadow: CI_SHADOW }}>
                <span style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontFamily: MONO, fontSize: '12px', color: '#3D3D3B' }}>{r.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── THE WHOLE SYSTEM — INTERACTIVE animated SVG flow: calls converge into the scoring engine,
// fan out to four outputs. Sage paths draw on (pathLength) + glowing pulses travel them
// (strokeDashoffset). Outputs are hoverable (explanation panel) and clickable (jump to the mock);
// when idle it auto-cycles a guided tour so there's always insightful movement.
const SF_IN = ['Sales call', 'Demo call', 'Customer call', 'Support call'];
const SF_OUT = [
  { label: 'Call analysis', anchor: 'ci-analysis', desc: 'Every sales call, scored on your rubric. The exact moments that cost you the deal, and what to coach next time.' },
  { label: 'Churn alert', anchor: 'ci-alert', accent: true, desc: 'The moment a customer call signals risk, you get a flag with the quote and a save-play. Before the renewal, not after.' },
  { label: 'Weekly digest', anchor: 'ci-digest', desc: "Monday morning: the week's pattern, your reps ranked, the accounts at risk. One scroll, no meeting." },
  { label: 'Control panel', anchor: 'ci-control', desc: 'You set the rubric, the thresholds, and who gets pinged. The system runs the way you sell.' },
];
const SF_ENGINE = { label: 'Scoring engine', desc: 'Transcribes every call, scores it against your rubric, and routes the result to the right place. Nobody has to listen back.' };

// MODULE-LEVEL so they keep a stable identity across re-renders — defining them inside the
// component made every auto-cycle tick remount the whole SVG and replay the draw-on animations
// (the "stuttering / refreshing"). Stable identity → state changes just update props, no remount.
const SFConnector: React.FC<{ d: string; delay: number; active?: boolean; reduce: boolean; sage: string; hairline: string }> = ({ d, delay, active, reduce, sage, hairline }) => (
  <g>
    <path d={d} fill="none" stroke={hairline} strokeWidth={1.25} />
    <motion.path d={d} fill="none" stroke={sage} strokeWidth={active ? 2 : 1.5} strokeOpacity={active ? 0.65 : 0.3}
      initial={reduce ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 1, ease: EASE, delay }} />
    {!reduce && (
      <motion.path d={d} fill="none" stroke={sage} strokeWidth={active ? 3.4 : 2.6} strokeLinecap="round" pathLength={1} strokeDasharray="0.06 0.94"
        animate={{ strokeDashoffset: [1, 0] }} transition={{ duration: active ? 1.5 : 2.4, repeat: Infinity, ease: 'linear', delay: delay + 0.6 }} />
    )}
  </g>
);
const SFNode: React.FC<{ x: number; y: number; w: number; label: string; accent?: boolean; active?: boolean; delay: number; reduce: boolean; sage: string; hairline: string; onEnter?: () => void; onLeave?: () => void; onClick?: () => void }> = ({ x, y, w, label, accent, active, delay, reduce, sage, hairline, onEnter, onLeave, onClick }) => {
  const c = accent ? CI_CORAL : sage;
  return (
    <motion.g initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, ease: EASE, delay }}
      onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {active && <rect x={x - 5} y={y - 27} width={w + 10} height={54} rx={16} fill="none" stroke={c} strokeWidth={1.5} strokeOpacity={0.55} />}
      <rect x={x} y={y - 22} width={w} height={44} rx={12} fill={active ? (accent ? 'rgba(168,84,57,0.08)' : 'rgba(42,143,101,0.09)') : CI_CARD} stroke={active ? c : (accent ? CI_CORAL : hairline)} strokeWidth={active ? 1.5 : 1} style={{ filter: 'drop-shadow(0 6px 14px rgba(26,26,26,0.05))' }} />
      <circle cx={x + 18} cy={y} r={3} fill={c} />
      <text x={x + 32} y={y} dominantBaseline="central" style={{ fontFamily: MONO, fontSize: 14, letterSpacing: '0.04em', fill: '#1A1A1A', fontWeight: active ? 600 : 400 }}>{label}</text>
    </motion.g>
  );
};

function CallIntelSystemFlow() {
  const reduce = useReducedMotion();
  const hairline = 'var(--color-hairline)';
  const accentInk = 'var(--color-accent-ink)';
  const sage = 'var(--color-accent)';
  const [hover, setHover] = useState<number | 'engine' | null>(null);
  const [auto, setAuto] = useState(0);
  useEffect(() => {
    if (hover !== null || reduce) return;
    const t = setInterval(() => setAuto((a) => (a + 1) % 4), 2800);
    return () => clearInterval(t);
  }, [hover, reduce]);
  const activeOut = hover === 'engine' ? -1 : (hover ?? auto);
  const info = hover === 'engine' ? SF_ENGINE : SF_OUT[(hover ?? auto) as number];
  const infoAccent = hover !== 'engine' && (SF_OUT[(hover ?? auto) as number] as any).accent;
  const goTo = (id: string) => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

  const inY = [56, 144, 232, 320];
  const outY = [50, 140, 232, 322];
  const EX1 = 402, EW = 226, EX2 = 628, ECY = 188;
  const inPath = (cy: number) => `M196 ${cy} C 300 ${cy}, 360 ${ECY}, ${EX1} ${ECY}`;
  const outPath = (cy: number) => `M${EX2} ${ECY} C ${EX2 + 90} ${ECY}, 706 ${cy}, 786 ${cy}`;
  const Panel = (
    <div className="mt-6 lg:mt-8 max-w-2xl mx-auto text-center px-4" style={{ minHeight: 92 }}>
      <AnimatePresence mode="wait">
        <motion.div key={hover === 'engine' ? 'engine' : (hover ?? auto)} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE }}>
          <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: infoAccent ? CI_CORAL : accentInk, fontWeight: 600 }}>{info.label}</p>
          <p className="mt-2 mx-auto" style={{ fontFamily: BODY_SERIF, fontSize: '17px', lineHeight: 1.5, color: '#3D3D3B', maxWidth: '46ch' }}>{info.desc}</p>
        </motion.div>
      </AnimatePresence>
      <p className="mt-3" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.35)' }}>Hover to explore · click to jump to it</p>
    </div>
  );
  return (
    <div>
      {/* DESKTOP — full interactive SVG diagram */}
      <div className="hidden lg:block">
        <svg viewBox="0 0 1000 384" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="How the system works: calls flow into a scoring engine and out to four deliverables">
          {inY.map((cy, i) => <SFConnector key={`ic${i}`} d={inPath(cy)} delay={0.1 + i * 0.08} reduce={!!reduce} sage={sage} hairline={hairline} />)}
          {outY.map((cy, i) => <SFConnector key={`oc${i}`} d={outPath(cy)} delay={0.5 + i * 0.08} active={activeOut === i} reduce={!!reduce} sage={sage} hairline={hairline} />)}
          {/* engine */}
          <motion.g initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, ease: EASE, delay: 0.35 }}
            onMouseEnter={() => setHover('engine')} onMouseLeave={() => setHover(null)} style={{ cursor: 'pointer' }}>
            <motion.rect x={EX1 - 8} y={ECY - 74} width={EW + 16} height={148} rx={20} fill="none" stroke={sage} strokeWidth={hover === 'engine' ? 1.5 : 1}
              animate={reduce ? {} : { strokeOpacity: hover === 'engine' ? 0.6 : [0.45, 0.08, 0.45] }} transition={{ duration: 2.6, repeat: hover === 'engine' ? 0 : Infinity, ease: 'easeInOut' }} />
            <rect x={EX1} y={ECY - 66} width={EW} height={132} rx={16} fill="#1A1A1A" style={{ filter: 'drop-shadow(0 14px 34px rgba(26,26,26,0.18))' }} />
            {!reduce && (
              <motion.rect x={EX1 + 12} width={EW - 24} height={1.5} rx={1} fill={sage}
                animate={{ y: [ECY - 52, ECY + 54, ECY - 52], opacity: [0, 0.4, 0] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }} />
            )}
            <circle cx={EX1 + 24} cy={ECY - 38} r={3.5} fill={sage} />
            <text x={EX1 + 36} y={ECY - 38} dominantBaseline="central" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', fill: 'rgba(247,244,239,0.6)' }}>ENGINE</text>
            <text x={EX1 + 24} y={ECY + 6} style={{ fontFamily: SERIF, fontSize: 28, fill: '#F7F4EF' }}>Scoring <tspan fontStyle="italic" fill={sage}>engine</tspan></text>
            <text x={EX1 + 24} y={ECY + 48} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.05em', fill: 'rgba(247,244,239,0.55)' }}>transcribe · score · route</text>
          </motion.g>
          {/* input + output nodes */}
          {SF_IN.map((l, i) => <SFNode key={`in${i}`} x={24} y={inY[i]} w={172} label={l} delay={0.15 + i * 0.07} reduce={!!reduce} sage={sage} hairline={hairline} />)}
          {SF_OUT.map((o, i) => <SFNode key={`out${i}`} x={788} y={outY[i]} w={196} label={o.label} accent={(o as any).accent} active={activeOut === i} delay={0.7 + i * 0.08} reduce={!!reduce} sage={sage} hairline={hairline} onEnter={() => setHover(i)} onLeave={() => setHover(null)} onClick={() => goTo(o.anchor)} />)}
          {/* live counter */}
          <motion.g initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 1.1 }}>
            <motion.circle cx={EX1 + 26} cy={18} r={3} fill={sage} animate={reduce ? {} : { opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
            <text x={EX1 + 36} y={18} dominantBaseline="central" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', fill: 'rgba(26,26,26,0.5)' }}>LIVE · 1,240 calls scored this month</text>
          </motion.g>
          <text x={24} y={366} style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.2em', fill: 'rgba(26,26,26,0.4)' }}>EVERY CALL IN</text>
          <text x={788} y={366} style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.2em', fill: 'rgba(26,26,26,0.4)' }}>WHAT YOU GET</text>
        </svg>
      </div>

      {/* MOBILE — vertical flow, output chips tappable */}
      <div className="lg:hidden flex flex-col items-center">
        <div className="w-full grid grid-cols-2 gap-2.5">
          {SF_IN.map((l) => (
            <div key={l} className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: CI_CARD, borderRadius: CI_R_SM, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW }}>
              <span style={{ width: 5, height: 5, borderRadius: 5, background: sage, flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.04em', color: '#1A1A1A' }}>{l}</span>
            </div>
          ))}
        </div>
        <div className="relative my-3" style={{ width: 2, height: 40, background: hairline }}>
          {!reduce && <motion.span style={{ position: 'absolute', left: -2.5, width: 7, height: 7, borderRadius: 7, background: sage }} animate={{ top: [-4, 40], opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeIn' }} />}
        </div>
        <div className="w-full px-5 py-5 text-center" style={{ background: '#1A1A1A', borderRadius: CI_R, boxShadow: CI_SHADOW_LG }}>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.55)' }}>The engine</p>
          <p style={{ fontFamily: SERIF, fontSize: '1.7rem', lineHeight: 1.05, color: '#F7F4EF', marginTop: 4 }}>Scoring <span style={{ fontStyle: 'italic', color: sage }}>engine</span></p>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(247,244,239,0.5)', marginTop: 6 }}>transcribe · score · route</p>
        </div>
        <div className="relative my-3" style={{ width: 2, height: 40, background: hairline }}>
          {!reduce && <motion.span style={{ position: 'absolute', left: -2.5, width: 7, height: 7, borderRadius: 7, background: sage }} animate={{ top: [-4, 40], opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeIn', delay: 0.4 }} />}
        </div>
        <div className="w-full grid grid-cols-2 gap-2.5">
          {SF_OUT.map((o, i) => (
            <button key={o.label} onClick={() => goTo(o.anchor)} className="flex items-center gap-2 px-3.5 py-2.5 text-left" style={{ background: CI_CARD, borderRadius: CI_R_SM, border: `1px solid ${o.accent ? CI_CORAL : hairline}`, boxShadow: CI_SHADOW }}>
              <span style={{ width: 5, height: 5, borderRadius: 5, background: o.accent ? CI_CORAL : sage, flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.04em', color: '#1A1A1A' }}>{o.label}</span>
            </button>
          ))}
        </div>
      </div>

      {Panel}
    </div>
  );
}

// 1) Post-sales-call analysis — scorecard + what to improve (the SALES-call output).
// One-time "interface loading" shimmer — a sage glint sweeps across a mock as it enters view,
// then clears. Makes the cards read as live software fetching data.
function CILoadShimmer() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div aria-hidden className="absolute inset-0 z-20 pointer-events-none overflow-hidden" style={{ borderRadius: CI_R }}
      initial={{ opacity: 1 }} whileInView={{ opacity: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 1 }}>
      <motion.div className="absolute inset-y-0" style={{ width: '55%', background: 'linear-gradient(90deg, transparent, rgba(42,143,101,0.12), rgba(255,255,255,0.55), rgba(42,143,101,0.12), transparent)' }}
        initial={{ x: '-110%' }} whileInView={{ x: '210%' }} viewport={{ once: true }} transition={{ duration: 1.05, ease: 'easeInOut', delay: 0.05 }} />
    </motion.div>
  );
}

function CICallAnalysis() {
  const reduce = useReducedMotion();
  const hairline = 'var(--color-hairline)';
  const accentInk = 'var(--color-accent-ink)';
  const dims = [{ label: 'Discovery', s: 8 }, { label: 'Objection handling', s: 5 }, { label: 'Next steps set', s: 9 }, { label: 'Pricing confidence', s: 6 }];
  return (
    <motion.div className="overflow-hidden h-full relative" initial={reduce ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.65, ease: EASE }}
      style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW }}>
      <CILoadShimmer />
      <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: `1px solid ${hairline}` }}>
        <span className="flex gap-1" aria-hidden>{[0, 1, 2].map((d) => <span key={d} style={{ width: 7, height: 7, borderRadius: 7, background: 'rgba(26,26,26,0.13)' }} />)}</span>
        <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>Call analysis</span>
        <span className="ml-auto" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.45)' }}>Discovery · Acme Co · 32 min</span>
      </div>
      <div className="p-5 lg:p-6">
        <div className="flex items-baseline gap-2">
          <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 'clamp(2.6rem,5vw,3.4rem)', lineHeight: 0.9, color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}><Counter value={78} /></span>
          <span style={{ fontFamily: MONO, fontSize: '13px', color: 'rgba(26,26,26,0.5)' }}>/100</span>
          <span className="ml-auto" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>overall</span>
        </div>
        <div className="mt-5 space-y-3">
          {dims.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="shrink-0" style={{ width: 132, fontFamily: BODY_SERIF, fontSize: '14px', color: '#3D3D3B' }}>{d.label}</span>
              <div className="relative flex-1" style={{ height: 6, borderRadius: 3, background: 'rgba(26,26,26,0.07)' }}>
                <motion.div initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.08 }}
                  style={{ position: 'absolute', inset: 0, transformOrigin: 'left', width: `${d.s * 10}%`, borderRadius: 3, background: d.s >= 7 ? 'var(--color-accent)' : d.s >= 5 ? '#B8862E' : CI_CORAL }} />
              </div>
              <span className="shrink-0 text-right" style={{ width: 34, fontFamily: MONO, fontSize: '12px', fontWeight: 600, color: '#1A1A1A' }}>{d.s}/10</span>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${hairline}` }}>
          <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>Flagged moment · 18:24</p>
          <p className="mt-1.5" style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: '15px', lineHeight: 1.45, color: '#1A1A1A' }}>"Is pricing per seat or per workspace?" Went unanswered for 40 seconds.</p>
        </div>
        <div className="mt-4">
          <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>What to improve</p>
          <ul className="mt-2 space-y-1.5">
            {['Answer the pricing question head-on. Don’t defer it.', 'Lock a next step on the call. This one ended with no date.'].map((t, i) => (
              <li key={i} className="flex gap-2.5" style={{ fontFamily: BODY_SERIF, fontSize: '14.5px', lineHeight: 1.4, color: '#3D3D3B' }}>
                <span aria-hidden style={{ marginTop: '0.6em', height: 1, width: 12, background: 'var(--color-accent)', flexShrink: 0 }} /><span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

// 2) Churn alert — risk + save-play (the CUSTOMER-call output). Coral, urgent — deliberately
// reads differently from the calm scorecard. The contrast IS the point.
function CIChurnAlert() {
  const reduce = useReducedMotion();
  const hairline = 'var(--color-hairline)';
  const accentInk = 'var(--color-accent-ink)';
  return (
    <motion.div className="overflow-hidden h-full relative" initial={reduce ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.65, ease: EASE, delay: 0.08 }}
      style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${hairline}`, borderLeft: `3px solid ${CI_CORAL}`, boxShadow: CI_SHADOW }}>
      <CILoadShimmer />
      <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: `1px solid ${hairline}` }}>
        <span className="flex gap-1" aria-hidden>{[0, 1, 2].map((d) => <span key={d} style={{ width: 7, height: 7, borderRadius: 7, background: 'rgba(26,26,26,0.13)' }} />)}</span>
        <motion.span aria-hidden animate={reduce ? {} : { opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }} style={{ width: 7, height: 7, borderRadius: 7, background: CI_CORAL, flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: CI_CORAL, fontWeight: 600 }}>At-risk account</span>
        <span className="ml-auto px-2 py-0.5" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: CI_CORAL, borderRadius: 6, background: 'rgba(168,84,57,0.09)' }}>High risk</span>
      </div>
      <div className="p-5 lg:p-6">
        <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>What triggered it · QBR, today 9:12</p>
        <p className="mt-2" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.3rem,2.4vw,1.6rem)', lineHeight: 1.18, letterSpacing: '-0.01em', color: '#1A1A1A' }}>"We're re-evaluating vendors before the renewal."</p>
        <p className="mt-2" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.45, color: '#3D3D3B' }}>Said by their VP of Ops, the economic buyer on the account.</p>
        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${hairline}` }}>
          <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>Recommended save-play</p>
          <ul className="mt-2 space-y-1.5">
            {['Get your founder on a call this week, before they shortlist.', 'Send the ROI recap built from their own usage data.'].map((t, i) => (
              <li key={i} className="flex gap-2.5" style={{ fontFamily: BODY_SERIF, fontSize: '14.5px', lineHeight: 1.4, color: '#3D3D3B' }}>
                <span aria-hidden style={{ marginTop: '0.6em', height: 1, width: 12, background: CI_CORAL, flexShrink: 0 }} /><span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-5" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.1em', color: 'rgba(26,26,26,0.5)' }}>Renewal in 38 days · flagged to you + CS lead</p>
      </div>
    </motion.div>
  );
}

// 3) Control panel — the cockpit (sources, calls tracked, alert routing, rubric).
function CIControlPanel({ companyName }: { companyName: string }) {
  const reduce = useReducedMotion();
  const hairline = 'var(--color-hairline)';
  const accentInk = 'var(--color-accent-ink)';
  const sage = 'var(--color-accent)';
  const Block = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <p style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
  const Check = ({ t }: { t: string }) => (
    <div className="flex items-center gap-2.5 py-1" style={{ fontFamily: BODY_SERIF, fontSize: '15px', color: '#1A1A1A' }}>
      <span style={{ color: sage, fontSize: '13px' }}>✓</span>{t}
    </div>
  );
  const Pill = ({ t }: { t: string }) => (
    <span className="inline-flex px-2.5 py-1 m-0.5" style={{ fontFamily: MONO, fontSize: '11px', color: '#3D3D3B', background: 'rgba(26,26,26,0.04)', borderRadius: CI_R_SM, border: `1px solid ${hairline}` }}>{t}</span>
  );
  return (
    <motion.div className="overflow-hidden" initial={reduce ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.7, ease: EASE }}
      style={{ borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW_LG }}>
      <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ background: '#1A1A1A' }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 7, background: sage, flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.92)' }}>Control panel · {companyName}</span>
        <span className="ml-auto" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.5)' }}>you set the rules</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-10 gap-y-7 p-6 lg:p-8" style={{ background: CI_CARD }}>
        <Block label="Connected sources"><Check t="Fireflies" /><Check t="Zoom" /><Check t="Slack alerts" /></Block>
        <Block label="Calls tracked"><div className="-m-0.5"><Pill t="Sales demos" /><Pill t="Discovery" /><Pill t="Customer QBRs" /><Pill t="Support" /></div></Block>
        <Block label="Churn alerts go to"><Check t="You" /><Check t="CS lead" /><p className="mt-1.5" style={{ fontFamily: BODY_SERIF, fontSize: '13.5px', color: '#5A5752' }}>Threshold: High risk and above</p></Block>
        <Block label="Scoring rubric (editable)"><div className="-m-0.5"><Pill t="Discovery" /><Pill t="Objection handling" /><Pill t="Next steps" /><Pill t="Pricing" /></div></Block>
      </div>
    </motion.div>
  );
}

// Where the flags land — a Slack message mock (the churn alert pinged to your channel).
function CISlackAlert() {
  const reduce = useReducedMotion();
  // Slack dark-mode palette
  const BG = '#1A1D21', LINE = 'rgba(255,255,255,0.09)', TXT = '#E4E5E6', MUT = 'rgba(228,229,230,0.45)';
  const Btn = ({ t }: { t: string }) => (
    <span className="inline-flex items-center px-3 py-1.5" style={{ fontFamily: BODY_SERIF, fontSize: '13px', fontWeight: 600, color: TXT, background: 'transparent', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 8 }}>{t}</span>
  );
  return (
    <motion.div className="overflow-hidden" initial={reduce ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.65, ease: EASE }}
      style={{ background: BG, borderRadius: CI_R, border: `1px solid ${LINE}`, boxShadow: CI_SHADOW_LG }}>
      <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: `1px solid ${LINE}` }}>
        <span style={{ fontFamily: MONO, fontSize: '15px', color: MUT }}>#</span>
        <span style={{ fontFamily: BODY_SERIF, fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>customer-health</span>
        <span className="ml-auto px-2 py-0.5" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', color: MUT, border: `1px solid ${LINE}`, borderRadius: 6 }}>Slack</span>
      </div>
      <div className="flex gap-3.5 px-5 py-4">
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(42,143,101,0.16)', border: '1px solid rgba(42,143,101,0.4)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CIWaveform count={3} maxH={17} gap={2.5} barW={2.5} />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{ fontFamily: BODY_SERIF, fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF' }}>Call Intelligence</span>
            <span className="px-1.5 py-0.5" style={{ fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.08em', textTransform: 'uppercase', color: MUT, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>App</span>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: MUT }}>9:12 AM</span>
          </div>
          <p className="mt-1.5" style={{ fontFamily: BODY_SERIF, fontSize: '15.5px', lineHeight: 1.5, color: TXT }}>
            <span style={{ color: '#E8836B', fontWeight: 600 }}>At-risk: Acme Co.</span> Their VP of Ops said “we’re re-evaluating vendors before the renewal” on today’s QBR. Renewal in 38 days.
          </p>
          <div className="mt-3 flex flex-wrap gap-2"><Btn t="Open account" /><Btn t="See save-play" /></div>
          <div className="mt-2.5 flex gap-1.5">
            {['👀 3', '🔥 2'].map((r) => <span key={r} className="px-2 py-0.5" style={{ fontFamily: MONO, fontSize: '11px', color: TXT, background: 'rgba(42,143,101,0.14)', border: '1px solid rgba(42,143,101,0.32)', borderRadius: 10 }}>{r}</span>)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CallIntelReport({ report, scan, companyName }: { report: ReportJson; scan: Scan; companyName: string }) {
  const ci = report.call_intel;
  if (!ci) return null;
  const meta = CI_META[ci.archetype] ?? CI_META.sales_demo_driven;
  const hairline = 'var(--color-hairline)';
  const accentInk = 'var(--color-accent-ink)';
  const bookUrl = `${CALENDLY_BASE}?utm_source=scan&utm_content=${encodeURIComponent(companyName)}&a1=${encodeURIComponent('call intelligence')}`;
  const reduce = useReducedMotion();

  // The two distinct product surfaces — the system runs on two kinds of calls and they are
  // SEPARATE benefits (don't blend "close more" with "catch churn"). Lead with the prospect's
  // primary archetype.
  const SURFACE_SALES = { tag: 'Sales & demo calls', head: 'Close more of the deals you already pitch', body: 'We score every sales call and show you what loses deals. Then we coach each rep to close like your best one.' };
  const SURFACE_CHURN = { tag: 'Customer & internal calls', head: 'Catch churn before the client walks', body: 'We score every customer call and flag at-risk accounts the next morning, early enough to save them.' };
  const surfaces = ci.archetype === 'cs_retention_driven' ? [SURFACE_CHURN, SURFACE_SALES] : [SURFACE_SALES, SURFACE_CHURN];

  // Verified receipts — real signals that prove the audit is grounded, beside the claim.
  const receipts: { label: string; value: string }[] = [];
  const hires = (report.hiring?.sample_titles ?? []).slice(0, 2);
  if (hires.length) receipts.push({ label: 'Hiring', value: hires.join(' · ') });
  const tools = (report.tech_stack_assessment?.confirmed_tools ?? []).slice(0, 3);
  if (tools.length) receipts.push({ label: 'Verified stack', value: tools.join(' · ') });
  const facts: string[] = [];
  if (report.company_size) facts.push(`${report.company_size} employees`);
  if (report.domain_age_years) facts.push(`${report.domain_age_years}-yr domain`);
  if (report.traffic?.monthly_visits) facts.push(`${report.traffic.monthly_visits.toLocaleString()} visits/mo`);
  if (facts.length) receipts.push({ label: 'Firmographics', value: facts.join(' · ') });

  const BookButton = ({ label, small }: { label: string; small?: boolean }) => (
    <CIMagneticCTA href={bookUrl} label={label} small={small} />
  );

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ScrollProgress />
      <header className="sticky top-0 z-30 backdrop-blur-sm border-b" style={{ borderColor: hairline, background: 'rgba(247,244,239,0.9)' }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="transition-colors hover:text-accent" style={{ fontFamily: BODY_SERIF, fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>Iván Manfredi</Link>
          <span className="hidden md:block" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>Call Intelligence · {companyName}</span>
          <BookButton label="Book a call" small />
        </div>
      </header>

      <CallIntelHero ci={ci} companyName={companyName} meta={meta} bookUrl={bookUrl} />

      <CallIntelPain ci={ci} companyName={companyName} receipts={receipts} scan={scan} />

      {/* THE WHOLE SYSTEM — animated flow diagram */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
        <div className="max-w-2xl">
          <Kicker>The whole system</Kicker>
          <h2 className="mt-4" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(2rem, 3.8vw, 2.9rem)', lineHeight: 1.06, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
            Every call in. <Italic>The right output out.</Italic>
          </h2>
          <p className="mt-4" style={{ fontFamily: BODY_SERIF, fontSize: '18px', lineHeight: 1.5, color: '#3D3D3B' }}>
            Every call your team runs flows through one scoring engine, and comes back as something you can act on.
          </p>
        </div>
        <div className="mt-10 lg:mt-14"><CallIntelSystemFlow /></div>
      </section>

      {/* WHAT YOU GET — the four deliverables, up close */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
        <div className="max-w-2xl">
          <Kicker>What you get</Kicker>
          <h2 className="mt-4" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(2rem, 3.8vw, 2.9rem)', lineHeight: 1.06, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
            Two kinds of calls. <Italic>Two kinds of output.</Italic>
          </h2>
          <p className="mt-4" style={{ fontFamily: BODY_SERIF, fontSize: '18px', lineHeight: 1.5, color: '#3D3D3B' }}>
            One improves the next deal. One saves the account before it's gone.
          </p>
        </div>
        <div className="mt-10 grid gap-7 lg:grid-cols-2 items-stretch">
          {surfaces.map((s, i) => (
            <div key={i} id={s === SURFACE_SALES ? 'ci-analysis' : 'ci-alert'} className="flex flex-col h-full scroll-mt-24">
              <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: s === SURFACE_CHURN ? CI_CORAL : accentInk, fontWeight: 600 }}>{s.tag}</p>
              <p className="mt-2.5 mb-5" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.45rem, 2.6vw, 1.9rem)', lineHeight: 1.12, letterSpacing: '-0.015em', color: '#1A1A1A', minHeight: '2.3em' }}>{s.head}</p>
              <div className="flex-1">{s === SURFACE_SALES ? <CICallAnalysis /> : <CIChurnAlert />}</div>
            </div>
          ))}
        </div>
        {/* and the urgent ones land where your team already works */}
        <div className="mt-12 max-w-2xl mx-auto text-center">
          <p style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.4rem, 2.6vw, 1.85rem)', lineHeight: 1.14, letterSpacing: '-0.015em', color: '#1A1A1A' }}>
            And the urgent ones ping you <Italic>where you already work.</Italic>
          </p>
          <p className="mt-2.5" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.5, color: '#5A5752' }}>No new dashboard to babysit. The flag lands in Slack the moment it happens.</p>
        </div>
        <div className="mt-7 max-w-xl mx-auto"><CISlackAlert /></div>
        <div id="ci-digest" className="mt-14 max-w-3xl mx-auto scroll-mt-24">
          <p className="mb-3.5 text-center" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>Every Monday: the weekly digest</p>
          <CallIntelProductMock ci={ci} companyName={companyName} />
        </div>
        <div id="ci-control" className="mt-14 scroll-mt-24">
          <p className="mb-3.5" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>You stay in control</p>
          <CIControlPanel companyName={companyName} />
        </div>

        {/* MORE — extra capabilities, scannable, no heavy mocks */}
        <div className="mt-16">
          <p className="mb-7 text-center" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.5rem, 2.8vw, 2rem)', lineHeight: 1.12, letterSpacing: '-0.015em', color: '#1A1A1A' }}>
            And it catches more than <Italic>you'd think.</Italic>
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { t: 'Rep performance', d: 'See who is improving and who is stalling, week over week.' },
              { t: 'Coverage gaps', d: 'Get flagged when calls or follow-ups slip through the cracks.' },
              { t: 'Objection library', d: 'The objections killing your deals, ranked by how often they land.' },
              { t: 'Competitor mentions', d: 'Know every time a prospect names a rival on a call.' },
              { t: 'Talk-time ratio', d: 'Catch reps talking when they should be listening.' },
              { t: 'New-rep ramp', d: 'Watch how fast new hires get to your best rep’s bar.' },
            ].map((f, i) => (
              <motion.div key={f.t}
                initial={reduce ? false : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.55, ease: EASE, delay: (i % 3) * 0.07 }}
                className="p-5 lg:p-6" style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW }}>
                <div className="flex items-center gap-2.5">
                  <span aria-hidden style={{ width: 6, height: 6, borderRadius: 6, background: 'var(--color-accent)', flexShrink: 0 }} />
                  <span style={{ fontFamily: SERIF, fontWeight: 400, fontSize: '1.2rem', lineHeight: 1.1, letterSpacing: '-0.01em', color: '#1A1A1A' }}>{f.t}</span>
                </div>
                <p className="mt-2.5" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.45, color: '#3D3D3B' }}>{f.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CASE STUDY — the proof: a system we already shipped */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
        <p className="mb-6" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>Case study · ProvalTech</p>
        <h3 className="max-w-3xl" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.9rem, 3.4vw, 2.7rem)', lineHeight: 1.06, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
          How we turned ProvalTech's existing calls into <Italic>$20K more a month.</Italic>
        </h3>
        <p className="mt-4 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '18px', lineHeight: 1.55, color: '#3D3D3B' }}>
          Same team. Same calls. We scored every one and coached each rep on what lost the deal. Close rate moved 27%.
        </p>

        {/* results stat tiles. ⚠️ PLACEHOLDER: '+$20K/mo' and '+27%' are placeholders — Ivan swaps
            the real ProvalTech figures before sending. '20× more calls reviewed' (5%→100%) is real. */}
        <div className="mt-9 grid grid-cols-1 sm:grid-cols-3 overflow-hidden" style={{ background: CI_CARD, borderRadius: CI_R, boxShadow: CI_SHADOW, border: `1px solid ${hairline}` }}>
          {[
            { pre: '+$', fig: '20', suf: 'K', label: 'a month in new revenue', sub: 'from the calls they already ran', placeholder: true }, // PLACEHOLDER
            { pre: '+', fig: '27', suf: '%', label: 'close rate', sub: 'after coaching on flagged calls', placeholder: true }, // PLACEHOLDER
            { pre: '', fig: '20', suf: '×', label: 'more calls reviewed', sub: '5% sampled by hand → 100% scored' }, // REAL
          ].map((s, i) => (
            <motion.div key={i}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.7, ease: EASE, delay: i * 0.1 }}
              className={`px-7 py-8 ${i ? 'border-t sm:border-t-0 sm:border-l' : ''}`}
              style={{ borderColor: hairline }}
            >
              <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(2.6rem, 4.8vw, 3.6rem)', lineHeight: 0.95, letterSpacing: '-0.02em', color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}>
                {s.pre}<Counter value={Number(s.fig)} />{s.suf}
              </div>
              <p className="mt-3" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.6)' }}>{s.label}</p>
              <p className="mt-1.5" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.4, color: '#5A5752' }}>{s.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* the real product — the dashboard (wide) + a single scored call (narrow companion) */}
        <div className="mt-10 grid gap-4 lg:grid-cols-[1.62fr_0.38fr] lg:items-stretch">
          <motion.figure className="overflow-hidden"
            initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.85, ease: EASE }}
            style={{ border: `1px solid ${hairline}`, borderRadius: CI_R, boxShadow: CI_SHADOW_LG }}>
            <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: '#1A1A1A' }}>
              <span aria-hidden style={{ height: 7, width: 7, background: 'var(--color-accent)', flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.9)' }}>ProvalTech · Call Performance Dashboard</span>
            </div>
            <img src="/cases/provaltech.png" alt="ProvalTech Call Performance Dashboard with per-call scores and trends" loading="lazy" onError={fallbackOnError} style={{ display: 'block', width: '100%', height: 'auto' }} />
          </motion.figure>
          <motion.figure className="overflow-hidden flex flex-col"
            initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.85, ease: EASE, delay: 0.1 }}
            style={{ border: `1px solid ${hairline}`, borderRadius: CI_R, boxShadow: CI_SHADOW }}>
            <div className="flex items-center gap-2 px-3.5 py-3" style={{ background: '#1A1A1A' }}>
              <span aria-hidden style={{ height: 6, width: 6, background: 'var(--color-accent)', flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.85)' }}>A single scored call</span>
            </div>
            <div className="overflow-hidden flex-1" style={{ background: '#FFFFFF' }}>
              <img src="/cases/provaltech-detail.png" alt="An individual scored call with per-criterion scores" loading="lazy" onError={fallbackOnError} style={{ display: 'block', width: '100%', height: 'auto', objectFit: 'cover', objectPosition: 'top' }} />
            </div>
          </motion.figure>
        </div>
        <p className="mt-5" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.14em', color: 'rgba(26,26,26,0.5)' }}>STACK · Fireflies · Airtable · n8n · Claude</p>
      </section>

      {/* REVIEWS — real client testimonials (from the landing page), softened-card styled */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
        <div className="max-w-2xl mb-10">
          <Kicker>What they say</Kicker>
          <h2 className="mt-4" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(2rem, 3.8vw, 2.9rem)', lineHeight: 1.06, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
            The kind of work people <Italic>rehire for.</Italic>
          </h2>
        </div>
        {/* lead quote */}
        <motion.figure initial={reduce ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.7, ease: EASE }}
          className="p-7 lg:p-10 mb-4" style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW_LG }}>
          <blockquote style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.5rem, 2.8vw, 2.1rem)', lineHeight: 1.22, letterSpacing: '-0.015em', color: '#1A1A1A' }}>
            “As a current Meta developer, ex-Amazon, very few things surprise me with AI. Ivan did. One conversation and I already had three things to implement in my workflow.”
          </blockquote>
          <figcaption className="mt-6 flex items-baseline gap-3 flex-wrap">
            <span style={{ fontFamily: BODY_SERIF, fontSize: '16px', fontWeight: 600, color: '#1A1A1A' }}>Adeeb Mohammed</span>
            <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A5752' }}>Software Engineer · ex-Amazon · Meta</span>
          </figcaption>
        </motion.figure>
        {/* supporting quotes */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { q: 'Working with Ivan has been an absolute game-changer. He exceeded all expectations and saved our team countless hours.', a: 'Camille Haas', r: 'Head of Operations' },
            { q: 'His solutions helped uncover opportunities we were missing, directly impacting our bottom line.', a: 'Rodrigo Ibañez', r: 'Managing Director' },
            { q: 'You see how he uses AI and immediately feel like you’ve been doing things the hard way. Walked away with a completely different approach.', a: 'Cristian Trif', r: 'Salesforce Consultant · 9 yrs' },
          ].map((t, i) => (
            <motion.figure key={t.a}
              initial={reduce ? false : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.55, ease: EASE, delay: i * 0.08 }}
              className="p-6 flex flex-col" style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW }}>
              <blockquote className="flex-1" style={{ fontFamily: BODY_SERIF, fontSize: '15.5px', lineHeight: 1.5, color: '#3D3D3B' }}>“{t.q}”</blockquote>
              <figcaption className="mt-5 pt-4" style={{ borderTop: `1px solid ${hairline}` }}>
                <p style={{ fontFamily: BODY_SERIF, fontSize: '14.5px', fontWeight: 600, color: '#1A1A1A' }}>{t.a}</p>
                <p style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A5752', marginTop: 2 }}>{t.r}</p>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      {/* FOUNDER'S NOTE — the human close, right before the ask */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
        <div className="max-w-3xl mx-auto">
          <Kicker>Who's behind this</Kicker>
          <div className="mt-7 flex flex-col sm:flex-row gap-6 sm:gap-8 sm:items-start">
            <img src="/ivan-portrait-400.webp" alt="Ivan Manfredi" loading="lazy" className="w-20 h-20 sm:w-24 sm:h-24 object-cover shrink-0" style={{ borderRadius: 18, boxShadow: CI_SHADOW_LG }} onError={fallbackOnError} />
            <div>
              <p style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.6rem, 3vw, 2.3rem)', lineHeight: 1.1, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
                I'm Ivan. I build the systems agencies <Italic>promise and never ship.</Italic>
              </p>
              <p className="mt-5" style={{ fontFamily: BODY_SERIF, fontSize: '18px', lineHeight: 1.6, color: '#3D3D3B' }}>
                Call intelligence is the one I reach for most, because the money is always hiding in conversations nobody has time to review. I'll build yours, run it on your real calls first, and you'll see exactly what it catches before you commit to anything.
              </p>
              <p className="mt-6" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>Iván Manfredi · Agent-Ready Ops</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA — soft rounded panel, centered */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-20 pt-6 lg:pb-28 lg:pt-10">
        <motion.div className="px-7 py-14 lg:px-14 lg:py-20 text-center"
          initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8, ease: EASE }}
          style={{ background: CI_CARD, borderRadius: 30, boxShadow: CI_SHADOW_LG, border: `1px solid ${hairline}` }}>
          <h2 className="mx-auto" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(2.3rem, 4.6vw, 3.5rem)', lineHeight: 1.04, letterSpacing: '-0.025em', color: '#1A1A1A', maxWidth: '16ch' }}>
            See it running on <Italic>your</Italic> calls.
          </h2>
          <p className="mt-5 mx-auto" style={{ fontFamily: BODY_SERIF, fontSize: '18px', lineHeight: 1.55, color: '#3D3D3B', maxWidth: '40ch' }}>
            15 minutes. Bring a few of your real calls. I'll run them through the system live and show you what it scores, flags, and surfaces.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4">
            <BookButton label="Book a call" />
            <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>No deck. A working demo.</span>
          </div>
        </motion.div>
      </section>

      {/* FOOTER — closing context below the CTA */}
      <footer style={{ borderTop: `1px solid ${hairline}` }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <CIWaveform count={5} maxH={13} gap={2} barW={2} />
            <span style={{ fontFamily: BODY_SERIF, fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>Iván Manfredi</span>
            <span aria-hidden style={{ color: 'rgba(26,26,26,0.25)' }}>·</span>
            <span style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>Call Intelligence</span>
          </div>
          <div className="flex items-center gap-5">
            <a href={bookUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-accent" style={{ fontFamily: BODY_SERIF, fontSize: '15px', color: '#3D3D3B' }}>Book a call</a>
            <a href="https://ivanmanfredi.com" className="transition-colors hover:text-accent" style={{ fontFamily: BODY_SERIF, fontSize: '15px', color: '#3D3D3B' }}>ivanmanfredi.com</a>
          </div>
        </div>
        <p className="max-w-5xl mx-auto px-5 sm:px-6 pb-8" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(26,26,26,0.35)' }}>Prepared for {companyName} · This page was built from a live scan of your site.</p>
      </footer>
    </div>
  );
}

// ── CONTENT SYSTEM REPORT ─────────────────────────────────────────────────────
// Rendered IN PLACE OF the generic report when matched_offer === 'content_system'.
// Bundled offer = organic content engine + lead-magnet capture. A personalized pitch:
// benefit hero -> "Sound familiar?" (their organic gap) -> the fix (the engine) ->
// one idea everywhere -> a content-week mock -> lead magnets -> real proof -> reviews ->
// founder note -> book. Reuses the call-intel design tokens + the landing content modules.
const CS_HERO: Record<ContentSystem['archetype'], { tag: string; pre: string; hero: string; sub: string; spec: string[] }> = {
  silent_founder: { tag: 'Organic',  pre: 'From the audience you already earned,', hero: 'be heard.',     sub: 'Five posts a week in your voice, without writing a word. The followers you worked for finally hear from you, every day.', spec: ['5+ posts a week', 'In your voice', 'You just approve'] },
  inconsistent:   { tag: 'Cadence',  pre: 'Instead of posting in bursts then going quiet,', hero: 'show up daily.', sub: 'A steady voice every day, on autopilot. No more silent weeks, no more starting from zero.', spec: ['5+ posts a week', 'In your voice', 'You just approve'] },
  no_capture:     { tag: 'Capture',  pre: 'From the readers you already reach,', hero: 'make leads.',     sub: 'Turn attention into booked calls. Lead magnets that build themselves, publish themselves, and qualify every signup.', spec: ['Self-building lead magnets', 'Every signup scored', 'Booked calls, not busywork'] },
  invisible:      { tag: 'Presence', pre: 'Starting from quiet on LinkedIn,', hero: 'own your space.',    sub: 'Become the sharpest voice in your niche, every day, without writing a word.', spec: ['5+ posts a week', 'In your voice', 'You just approve'] },
};
const CS_PAIN: Record<ContentSystem['archetype'], string[]> = {
  silent_founder: ["You've built a real audience.", 'But weeks go by with nothing from you.', 'Every quiet week, they forget you a little.', 'And the competitor who posts every day stays top of mind.'],
  inconsistent:   ['You post when you find the time.', 'Then a busy week hits and you go quiet.', 'The momentum you built resets to zero.', 'And starting over every month is exhausting.'],
  no_capture:     ['People read your posts and scroll on.', 'No email, no booking, no way to follow up.', 'You reach hundreds and hear back from none of them.', 'All that attention, and nothing to show for it.'],
  invisible:      ['Your buyers are on LinkedIn every day.', "They're following someone in your space. Just not you.", 'Right now you are invisible where it counts.', 'And the gap grows wider every week you wait.'],
};

function CSHero({ cs, who, companyName, meta, bookUrl }: { cs: ContentSystem; who: string; companyName: string; meta: { tag: string }; bookUrl: string }) {
  const reduce = useReducedMotion();
  const h = CS_HERO[cs.archetype] ?? CS_HERO.silent_founder;
  const hairline = 'var(--color-hairline)';
  // The hero's "this week" panel renders the founder's ACTUAL drafted assets as
  // believable mini-cards: real posts (with their brand images) AND the lead magnet
  // (its real cover). Not a text list — the proof is that it looks finished.
  const founder = cs.founder;
  const avatar = (founder?.avatar_url || '').trim();
  const fname = founder?.name || who;
  const fhead = founder?.headline || '';
  const lm = cs.sample_output?.lm;
  const clamp2: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
  type DraftItem = { kind: 'post' | 'lm'; format: string; text: string; img: string };
  const postItems: DraftItem[] = (cs.sample_output?.posts ?? []).map((p) => ({
    kind: 'post',
    format: (Array.isArray(p.image_urls) && p.image_urls.length >= 2) || /carousel/i.test(p.format || '') ? 'Carousel' : (p.image_url ? 'Image' : 'Post'),
    text: p.hook || (p.body || '').slice(0, 110),
    img: p.image_url || (Array.isArray(p.image_urls) ? p.image_urls[0] : '') || '',
  }));
  const lmItem: DraftItem[] = lm?.title ? [{ kind: 'lm', format: 'Lead magnet', text: lm.title, img: lm.cover_url || '' }] : [];
  // Always show posts AND the lead magnet so the card proves the full output, not just posts.
  const draftItems: DraftItem[] = postItems.length || lmItem.length
    ? [...postItems.slice(0, 2), ...lmItem]
    : [
        { kind: 'post', format: 'Post', text: 'The one thing nobody tells you about…', img: '' },
        { kind: 'post', format: 'Carousel', text: 'A 6-step teardown of…', img: '' },
        { kind: 'lm', format: 'Lead magnet', text: 'The interactive assessment that qualifies every signup.', img: '' },
      ];
  const Reveal: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => (
    <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.18em', marginBottom: '-0.18em' }}>
      <motion.span style={{ display: 'block' }} initial={reduce ? false : { y: '120%' }} animate={{ y: 0 }} transition={{ delay, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}>{children}</motion.span>
    </span>
  );
  return (
    <section className="relative bg-paper overflow-hidden" style={{ borderBottom: `1px solid ${hairline}` }}>
      <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundImage: 'linear-gradient(rgba(26,26,26,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(26,26,26,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <motion.div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: 0.2, backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.3%22/></svg>")' }} animate={reduce ? {} : { backgroundPosition: ['0px 0px', '120px 120px'] }} transition={{ duration: 90, repeat: Infinity, ease: 'linear' }} />
      <motion.div initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.1, duration: 1.6, ease: EASE }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--color-accent)', transformOrigin: 'left', opacity: 0.5, zIndex: 5 }} />
      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-6 pt-12 pb-14 lg:pt-16 lg:pb-20 lg:grid lg:grid-cols-[1.22fr_0.78fr] lg:gap-12 lg:items-center">
        <div>
          <motion.div initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }} className="mb-9 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#5A5752' }}>
            <span style={{ width: 6, height: 6, background: 'var(--color-accent)', display: 'inline-block' }} aria-hidden />
            <span>Content System · {meta.tag}</span>
            <span aria-hidden style={{ color: 'rgba(26,26,26,0.3)' }}>/</span>
            <span style={{ color: 'rgba(26,26,26,0.5)' }}>for {who}{companyName && who !== companyName ? `, founder of ${companyName}` : ''}</span>
          </motion.div>
          <h1 className="mb-7" style={{ fontFamily: SERIF, fontWeight: 400, color: '#1A1A1A', letterSpacing: '-0.02em' }}>
            <Reveal delay={0.12}><span style={{ display: 'block', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', lineHeight: 1.1, color: '#3D3D3B' }}>{h.pre}</span></Reveal>
            <Reveal delay={0.26}><span style={{ display: 'block', color: 'var(--color-accent)', fontSize: 'clamp(3.4rem, 8.5vw, 6.4rem)', lineHeight: 0.92, letterSpacing: '-0.045em', marginTop: '0.06em', marginLeft: '-0.015em' }}>{h.hero}</span></Reveal>
          </h1>
          <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.9, ease: EASE }} className="max-w-xl" style={{ fontFamily: BODY_SERIF, fontSize: 'clamp(18px, 2.2vw, 21px)', lineHeight: 1.5, color: '#3D3D3B' }}>{h.sub}</motion.p>
          <motion.ul initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.92, duration: 0.7, ease: EASE }} className="mt-7 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-2.5 sm:gap-0">
            {h.spec.map((s, i) => (
              <li key={s} className={`flex items-center gap-2.5 sm:px-5 ${i === 0 ? 'sm:pl-0' : 'sm:border-l'}`} style={{ fontFamily: MONO, fontSize: '12.5px', letterSpacing: '0.02em', color: '#2C3A31', borderColor: hairline }}>
                <span className={i === 0 ? '' : 'sm:hidden'} style={{ width: 5, height: 5, background: 'var(--color-accent)', flexShrink: 0 }} aria-hidden />{s}
              </li>
            ))}
          </motion.ul>
          <motion.div initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.02, duration: 0.6, ease: EASE }} className="mt-9"><CIMagneticCTA href={bookUrl} label="Book a 20-min look" /></motion.div>
        </div>
        {/* RIGHT — the founder's actual drafted week, rendered: real posts + the real lead-magnet cover */}
        <motion.div className="hidden lg:block" initial={reduce ? false : { opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.75, duration: 0.9, ease: EASE }}>
          <div className="px-5 py-5" style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW_LG }}>
            <div className="flex items-center justify-between mb-4" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#5A5752' }}>
              <span className="flex items-center gap-2">
                <motion.span aria-hidden animate={reduce ? {} : { opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ width: 6, height: 6, borderRadius: 6, background: 'var(--color-accent)' }} />
                This week
              </span>
              <span style={{ color: 'rgba(26,26,26,0.4)' }}>drafting</span>
            </div>
            <div className="space-y-2.5">
              {draftItems.map((it, i) => it.kind === 'lm' ? (
                <motion.div key={i} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 + i * 0.18, duration: 0.6, ease: EASE }} className="flex items-center gap-3 px-3 py-3" style={{ background: '#1A1A1A', borderRadius: CI_R_SM, border: '1px solid rgba(255,255,255,0.08)' }}>
                  {it.img && <img src={it.img} alt="" loading="lazy" onError={fallbackOnError} style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 7, flexShrink: 0 }} />}
                  <span className="min-w-0">
                    <span style={{ display: 'block', fontFamily: MONO, fontSize: '8px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 600, marginBottom: 3 }}>Lead magnet</span>
                    <span style={{ ...clamp2, fontFamily: BODY_SERIF, fontSize: '12px', lineHeight: 1.3, color: 'rgba(247,244,239,0.92)' }}>{it.text}</span>
                  </span>
                </motion.div>
              ) : (
                <motion.div key={i} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 + i * 0.18, duration: 0.6, ease: EASE }} className="px-3.5 py-3" style={{ background: 'var(--color-paper, #F7F4EF)', borderRadius: CI_R_SM, border: `1px solid ${hairline}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    {avatar
                      ? <img src={avatar} alt="" loading="lazy" onError={fallbackOnError} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <span aria-hidden style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-accent)', color: '#fff', fontFamily: MONO, fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(fname[0] || '·').toUpperCase()}</span>}
                    <span className="min-w-0">
                      <span style={{ display: 'block', fontFamily: BODY_SERIF, fontSize: '11.5px', fontWeight: 600, color: '#1A1A1A', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fname}</span>
                      {fhead && <span style={{ display: 'block', fontFamily: MONO, fontSize: '8px', letterSpacing: '0.04em', color: 'rgba(26,26,26,0.45)', lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fhead}</span>}
                    </span>
                    <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: '8px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-accent-ink)', fontWeight: 600, border: `1px solid ${hairline}`, padding: '2px 5px', flexShrink: 0 }}>{it.format}</span>
                  </div>
                  <p style={{ ...clamp2, fontFamily: BODY_SERIF, fontSize: '12.5px', lineHeight: 1.4, color: '#3D3D3B' }}>{it.text}</p>
                  {it.img && <img src={it.img} alt="" loading="lazy" onError={fallbackOnError} style={{ marginTop: 8, width: '100%', height: 62, objectFit: 'cover', borderRadius: 6, border: `1px solid ${hairline}` }} />}
                </motion.div>
              ))}
            </div>
            <div className="mt-4 pt-3.5 flex items-center justify-between" style={{ borderTop: `1px solid ${hairline}`, fontFamily: MONO, fontSize: '11px', letterSpacing: '0.06em', color: '#5A5752' }}>
              <span>{lm?.title ? '5 posts + 1 lead magnet' : '5 posts a week'}</span>
              <span style={{ color: 'var(--color-accent-ink)', fontWeight: 600 }}>in your voice</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function CSPain({ cs, who, companyName, receipts, scan }: { cs: ContentSystem; who: string; companyName: string; receipts: { label: string; value: string }[]; scan: Scan }) {
  const reduce = useReducedMotion();
  const hairline = 'var(--color-hairline)';
  const accentInk = 'var(--color-accent-ink)';
  const painLines = CS_PAIN[cs.archetype] ?? CS_PAIN.silent_founder;
  const aud = (cs.audience_estimate?.value || '').trim();
  const opener = aud ? `${who}, you've built ${aud}.` : `${who}, you've built a real audience.`;
  const leaks = (cs.leaking_signals ?? []).slice(0, 3);
  return (
    <section className="max-w-3xl mx-auto px-5 sm:px-6 py-16 lg:py-24">
      <Kicker>Sound familiar?</Kicker>
      <motion.p className="mt-7" initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.6, ease: EASE }} style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.7rem, 3.4vw, 2.5rem)', lineHeight: 1.12, letterSpacing: '-0.02em', color: '#1A1A1A' }}>{opener}</motion.p>
      <div className="mt-6 space-y-4">
        {painLines.map((l, i) => (
          <motion.p key={i} initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.5, ease: EASE, delay: Math.min(i * 0.06, 0.3) }} style={{ fontFamily: BODY_SERIF, fontWeight: 400, fontSize: 'clamp(19px, 2.4vw, 24px)', lineHeight: 1.45, color: '#3D3D3B' }}>{l}</motion.p>
        ))}
      </div>
      {leaks.length > 0 && (
        <motion.div className="mt-12 p-7 lg:p-8" initial={reduce ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.7, ease: EASE }} style={{ background: CI_CARD, borderRadius: CI_R, boxShadow: CI_SHADOW, border: `1px solid ${hairline}` }}>
          <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.2em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>Looking at your LinkedIn, three things stood out</p>
          <ul className="mt-5 space-y-4">
            {leaks.map((l, i) => (
              <li key={i} className="flex gap-4 items-baseline">
                <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--color-accent)', lineHeight: 1, minWidth: 22 }}>{i + 1}</span>
                <span style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.2rem, 2.4vw, 1.5rem)', lineHeight: 1.18, letterSpacing: '-0.01em', color: '#1A1A1A' }}>{l.title}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
      <motion.h2 className="mt-14" initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.7, ease: EASE }} style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', lineHeight: 1.04, letterSpacing: '-0.025em', color: 'var(--color-accent)' }}>There's a better way.</motion.h2>
      <p className="mt-3" style={{ fontFamily: BODY_SERIF, fontSize: '18px', color: '#5A5752' }}>Here's how it works.</p>
      {receipts.length > 0 && (
        <div className="mt-12 pt-8" style={{ borderTop: `1px solid ${hairline}` }}>
          <p className="mb-4" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>We didn't guess. Pulled from {scan.domain ?? companyName} today</p>
          <div className="flex flex-wrap gap-2.5">
            {receipts.map((r, i) => (
              <span key={i} className="inline-flex items-baseline gap-2 px-3.5 py-2" style={{ background: CI_CARD, border: `1px solid ${hairline}`, borderRadius: CI_R_SM, boxShadow: CI_SHADOW }}>
                <span style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontFamily: MONO, fontSize: '12px', color: '#3D3D3B' }}>{r.value}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// In-page preview of the prospect's lead magnet. The LM card in the feed opens this:
// the real cover next to what's inside (the actual prompts), so it reads as a finished
// resource without leaving the page. Not a live external link by design.
function LmPreviewModal({ lm, who, bookUrl, onClose }: { lm: { title: string; cover_url: string; pages?: number; promise?: string; whats_inside?: string[] }; who: string; bookUrl: string; onClose: () => void }) {
  const reduce = useReducedMotion();
  const hairline = 'var(--color-hairline)';
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  const items = lm.whats_inside ?? [];
  return (
    <motion.div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      style={{ background: 'rgba(20,18,15,0.55)', backdropFilter: 'blur(3px)' }} onClick={onClose} role="dialog" aria-modal="true" aria-label="Lead magnet preview">
      <motion.div className="relative w-full max-w-3xl overflow-auto" initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.3, ease: EASE }}
        style={{ maxHeight: '88vh', background: 'var(--color-paper, #F7F4EF)', borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW_LG }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close preview" className="absolute top-3 right-3 z-10 p-2 rounded-full transition-colors" style={{ background: 'rgba(26,26,26,0.06)' }}>
          <XCircle className="w-5 h-5" style={{ color: '#1A1A1A' }} />
        </button>
        <div className="grid md:grid-cols-2">
          <div className="p-5 sm:p-6 flex items-center justify-center" style={{ background: '#1A1A1A' }}>
            <img src={lm.cover_url} alt={lm.title} className="w-full h-auto" style={{ borderRadius: CI_R_SM, maxHeight: '64vh', objectFit: 'contain' }} />
          </div>
          <div className="p-6 sm:p-7">
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-accent-ink)', fontWeight: 600 }}>Lead magnet · preview</p>
            <h3 className="mt-3" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.4rem, 2.6vw, 1.85rem)', lineHeight: 1.12, letterSpacing: '-0.015em', color: '#1A1A1A' }}>{lm.title}</h3>
            {lm.promise && <p className="mt-3" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: '#3D3D3B' }}>{lm.promise}</p>}
            {items.length > 0 && (
              <>
                <p className="mt-6 mb-3" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>What's inside</p>
                <ul>
                  {items.map((it, i) => (
                    <li key={i} className="flex gap-3" style={{ borderTop: i ? `1px solid ${hairline}` : 'none', paddingTop: i ? '0.7rem' : 0, marginTop: i ? '0.7rem' : 0 }}>
                      <span aria-hidden style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 600, color: 'var(--color-accent-ink)', lineHeight: 1.5, flexShrink: 0, minWidth: 18 }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.5, color: '#3D3D3B' }}>{it}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-6" style={{ fontFamily: BODY_SERIF, fontSize: '13px', lineHeight: 1.5, color: 'rgba(26,26,26,0.6)' }}>
              The system builds this as an interactive page on your domain and captures every email, {who}.
            </p>
            <div className="mt-5"><CIMagneticCTA href={bookUrl} label="See the live version" small /></div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// The content-system product cockpit — an animated "software" surface showing the
// engine running THIS founder's own content through the pipeline. Mirrors the
// CallIntelProductMock grammar (titlebar, counter tiles, animated rows, activity feed).
function ContentSystemDashboardMock({ cs, companyName }: { cs: ContentSystem; companyName: string }) {
  const reduce = useReducedMotion();
  const hairline = 'var(--color-hairline)';
  const accentInk = 'var(--color-accent-ink)';
  const founder = (cs.founder?.first_name || (cs.founder?.name || '').split(' ')[0] || companyName).trim();

  const STAGES = ['Idea', 'Draft', 'Voice', 'QA', 'Scheduled'];
  const clip = (s: string) => { const t = (s || '').replace(/\s+/g, ' ').trim(); return t.length > 48 ? t.slice(0, 46) + '…' : t; };
  const stagePlan = [4, 3, 1]; // varied stages so the board reads as "in motion"
  const rows: { label: string; kind: string; stage: number }[] = [];
  (cs.sample_output?.posts ?? []).slice(0, 3).forEach((p, i) => {
    const kind = (Array.isArray(p.image_urls) && p.image_urls.length >= 2) || /carousel/i.test(p.format || '')
      ? 'Carousel' : (p.image_url ? 'Image' : 'Post');
    rows.push({ label: clip(p.hook || p.format || 'Post'), kind, stage: stagePlan[i] ?? 2 });
  });
  const lm = cs.sample_output?.lm;
  if (lm?.title) rows.push({ label: clip(lm.title), kind: 'Lead magnet', stage: 4 });

  const tiles = METRICS.slice(0, 4); // honest engine specs, not invented client numbers
  const modules = ['Ideas', 'Posts', 'Lead magnets', 'Outreach', 'Calendar'];
  const activity = [
    { tag: 'Voice', text: `Drafted in ${founder}'s voice, grounded in real calls and past winners.` },
    { tag: 'QA', text: 'Cleared the nine-point quality agent and lint. Zero AI tells.' },
    { tag: 'Funnel', text: 'Lead magnet built and published to a live page, capturing emails.' },
  ];

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.8, ease: EASE }}
      className="overflow-hidden relative"
      style={{ border: `1px solid ${hairline}`, borderRadius: CI_R, boxShadow: CI_SHADOW_LG }}
    >
      <CILoadShimmer />
      {/* window titlebar */}
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: '#1A1A1A' }}>
        <span aria-hidden style={{ height: 7, width: 7, background: 'var(--color-accent)', flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.92)' }}>
          {companyName} · Content System
        </span>
        <span className="ml-auto flex items-center gap-1.5" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.55)' }}>
          <motion.span aria-hidden animate={reduce ? {} : { opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ height: 6, width: 6, background: 'var(--color-accent)' }} />
          Live
        </span>
      </div>

      {/* module nav — sells "runs your whole presence" */}
      <div className="flex items-center gap-2 px-3.5 py-2.5 overflow-x-auto" style={{ borderBottom: `1px solid ${hairline}`, background: CI_CARD }}>
        {modules.map((m, i) => (
          <span key={m} className="shrink-0 px-2.5 py-1" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, borderRadius: 7, color: i === 1 ? '#F7F4EF' : 'rgba(26,26,26,0.5)', background: i === 1 ? 'var(--color-accent)' : 'transparent', border: i === 1 ? 'none' : `1px solid ${hairline}` }}>{m}</span>
        ))}
      </div>

      <div style={{ background: 'var(--color-paper, #F7F4EF)' }}>
        {/* engine-spec tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4" style={{ borderBottom: `1px solid ${hairline}` }}>
          {tiles.map((m, i) => (
            <div key={i} className="px-5 py-5" style={{ borderLeft: i % 4 ? `1px solid ${hairline}` : 'none', borderTop: i >= 2 ? `1px solid ${hairline}` : 'none' }}>
              <CICountMetric value={m.value} style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(1.7rem, 2.7vw, 2.4rem)', lineHeight: 1, letterSpacing: '-0.02em', color: i === 0 ? 'var(--color-accent)' : '#1A1A1A', fontVariantNumeric: 'tabular-nums' }} />
              <p className="mt-2" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)', lineHeight: 1.45 }}>{m.label}</p>
            </div>
          ))}
        </div>

        <div className="px-5 lg:px-6 py-6 space-y-6">
          {/* pipeline board — the prospect's own content, mid-flight */}
          {rows.length > 0 && (
            <div>
              <p className="mb-3" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>This week, in the pipeline</p>
              <div>
                {rows.map((r, ri) => (
                  <motion.div
                    key={ri}
                    initial={reduce ? false : { opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: '-30px' }}
                    transition={{ duration: 0.5, ease: EASE, delay: 0.1 + ri * 0.08 }}
                    className="flex items-center gap-3 flex-wrap py-2.5"
                    style={{ borderTop: ri ? `1px solid ${hairline}` : 'none' }}
                  >
                    <span className="shrink-0 px-2 py-1" style={{ fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, color: accentInk, border: `1px solid ${hairline}`, borderRadius: 7, background: 'rgba(42,143,101,0.06)' }}>{r.kind}</span>
                    <span className="min-w-0 flex-1" style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.4, color: '#1A1A1A' }}>{r.label}</span>
                    <span className="flex items-center gap-1" aria-hidden>
                      {STAGES.map((_, si) => (
                        <motion.span
                          key={si}
                          initial={reduce ? false : { opacity: 0.2, scaleY: 0.55 }}
                          whileInView={{ opacity: si <= r.stage ? 1 : 0.22, scaleY: 1 }}
                          viewport={{ once: true, margin: '-30px' }}
                          transition={{ duration: 0.35, ease: EASE, delay: 0.2 + ri * 0.08 + si * 0.05 }}
                          style={{ height: 6, width: 16, borderRadius: 2, background: si <= r.stage ? 'var(--color-accent)' : 'rgba(26,26,26,0.1)' }}
                        />
                      ))}
                    </span>
                    <span className="shrink-0 text-right" style={{ width: 78, fontFamily: MONO, fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, color: r.stage >= 4 ? accentInk : 'rgba(26,26,26,0.6)' }}>{STAGES[r.stage]}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* live activity feed */}
          <div className="space-y-px" style={{ borderTop: `1px solid ${hairline}` }}>
            {activity.map((f, i) => (
              <motion.div
                key={i}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.25 + i * 0.08 }}
                className="flex items-start gap-3 pt-3"
              >
                <span className="shrink-0 px-2 py-1" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: accentInk, border: `1px solid ${hairline}`, borderRadius: 8, background: 'rgba(42,143,101,0.06)' }}>{f.tag}</span>
                <span style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.45, color: '#3D3D3B' }}>{f.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ContentSystemReport({ report, scan, companyName }: { report: ReportJson; scan: Scan; companyName: string }) {
  const cs = report.content_system;
  if (!cs) return null;
  const meta = CS_HERO[cs.archetype] ?? CS_HERO.silent_founder;
  const hairline = 'var(--color-hairline)';
  const accentInk = 'var(--color-accent-ink)';
  const reduce = useReducedMotion();
  const [lmOpen, setLmOpen] = useState(false);
  // Founder-first: this offer runs on the founder's personal brand, so address them by name.
  const founder = cs.founder;
  const who = (founder?.first_name || (founder?.name || '').split(' ')[0] || '').trim() || companyName;
  const founderFull = founder?.name || companyName;
  const bookUrl = `${CALENDLY_BASE}?utm_source=scan&utm_content=${encodeURIComponent(companyName)}&a1=${encodeURIComponent('content system')}`;
  const BookButton = ({ label, small }: { label: string; small?: boolean }) => <CIMagneticCTA href={bookUrl} label={label} small={small} />;

  // Per-scan share metadata so the clean ivanmanfredi.com/scan/:slug link unfurls
  // (baked into static HTML by scripts/prerender.mjs for prerendered scan slugs).
  useMetadata({
    title: `A content system for ${companyName}`,
    description: `A week of LinkedIn posts and a lead magnet, in ${who}'s voice, ready to approve.`,
    canonical: `https://ivanmanfredi.com/scan/${scan.company_slug}`,
    ogImage: cs.og_image_url || undefined,
    noindex: true,
  });

  // Verified receipts — real organic signals that prove we looked at THEM.
  const receipts: { label: string; value: string }[] = [];
  const ls = report.linkedin_summary;
  if (ls?.followers) receipts.push({ label: 'Audience', value: `${ls.followers.toLocaleString()} followers` });
  if (ls?.posts_30d != null) receipts.push({ label: 'Cadence', value: `${ls.posts_30d} posts in 30 days` });
  else if (ls?.last_post_days != null) receipts.push({ label: 'Last post', value: `${ls.last_post_days} days ago` });
  const tools = (report.tech_stack_assessment?.confirmed_tools ?? []).slice(0, 3);
  if (tools.length) receipts.push({ label: 'Verified stack', value: tools.join(' · ') });

  const mock = cs.sample_output;
  const mockMetrics = (mock?.metrics ?? []).slice(0, 3);
  const feedSpec = buildFeedSpecFromContentSystem(cs, { companyName });

  const cases = [
    { client: 'Kyle Hunt', role: 'Creative-video agency · founder', src: '/content-system/kyle-guides.webp', alt: "Kyle Hunt's content engine running in the system", summary: 'Kyle runs his entire content operation on the system. Every post and lead magnet is drafted in his voice and shipped, without him ever facing a blank page.', metrics: [{ value: '100%', label: 'of his content, run by the system' }, { value: '~300', label: 'comments per lead-magnet post' }, { value: '30K', label: 'impressions per post' }] },
    { client: 'Lemonade', role: 'Demand-gen studio', src: '/content-system/lemonade-thankyou.webp', alt: "Lemonade's lead-capture page built by the system", summary: 'Lemonade turned the lead-magnet engine into a booking machine. Gated assets on live pages qualify every signup and route the best fits straight to the calendar.', metrics: [{ value: '5', label: 'new clients a month from the lead-magnet system' }, { value: 'Live', label: 'gated funnel, on autopilot' }], flip: true },
  ];
  const REVIEWS = [
    { q: 'Ivan is one of those rare builders who actually ships. The system runs exactly as promised and the output sounds like me, not a robot.', n: 'Adeeb Mohammed', r: 'Software Engineer · ex-Amazon · Meta' },
    { q: 'He turned our content into a real pipeline. The lead magnets alone book us calls every week.', n: 'Camille Haas', r: 'Founder' },
    { q: 'Fast, clear, and genuinely good taste. The work looks premium and it just works.', n: 'Rodrigo Ibañez', r: 'Agency owner' },
    { q: 'We went from posting sometimes to showing up every day, in our voice. Game changer.', n: 'Cristian Trif', r: 'Operator' },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink">
      <ScrollProgress />
      <header className="sticky top-0 z-30 backdrop-blur-sm border-b" style={{ borderColor: hairline, background: 'rgba(247,244,239,0.9)' }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="transition-colors hover:text-accent" style={{ fontFamily: BODY_SERIF, fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>Iván Manfredi</Link>
          <span className="hidden md:block" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.65)' }}>Content System · {founderFull}</span>
          <BookButton label="Book a look" small />
        </div>
      </header>

      <CSHero cs={cs} who={who} companyName={companyName} meta={meta} bookUrl={bookUrl} />
      <CSPain cs={cs} who={who} companyName={companyName} receipts={receipts} scan={scan} />

      {/* THE PAYOFF — the prospect's own branded week, surfaced high for engagement */}
      {(feedSpec.posts.length > 0 || mockMetrics.length > 0) && (
        <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
          <Kicker>Your week</Kicker>
          <h2 className="mt-4 max-w-3xl" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.9rem, 3.6vw, 2.8rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: '#1A1A1A' }}>A week of content, <Italic>already drafted in your voice.</Italic></h2>
          <p className="mt-4 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '18px', lineHeight: 1.5, color: '#3D3D3B' }}>Pulled from your latest episode and written the way you say it. Posts, a carousel, and a lead magnet, ready for you to approve. Tap the lead magnet to look inside.</p>
          <motion.div className="mt-10 overflow-hidden" initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8, ease: EASE }} style={{ borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW_LG }}>
            <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: CI_CARD, borderBottom: `1px solid ${hairline}` }}>
              <span aria-hidden style={{ height: 7, width: 7, background: 'var(--color-accent)', flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.68)' }}>{companyName} · {mock?.title || 'This week'}</span>
            </div>
            <div style={{ background: 'var(--color-paper, #F7F4EF)' }}>
              {mockMetrics.length > 0 && (
                <div className="grid grid-cols-3" style={{ borderBottom: `1px solid ${hairline}` }}>
                  {mockMetrics.map((m, i) => (
                    <div key={i} className="px-5 py-5" style={{ borderLeft: i ? `1px solid ${hairline}` : 'none' }}>
                      <CICountMetric value={m.value} style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(1.9rem, 3vw, 2.6rem)', lineHeight: 1, letterSpacing: '-0.02em', color: i === 0 ? 'var(--color-accent)' : '#1A1A1A', fontVariantNumeric: 'tabular-nums' }} />
                      <p className="mt-2" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>{m.label}</p>
                      {m.delta && <p className="mt-0.5" style={{ fontFamily: MONO, fontSize: '10px', color: accentInk }}>{m.delta}</p>}
                    </div>
                  ))}
                </div>
              )}
              {feedSpec.posts.length > 0 && (
                <div className="px-4 lg:px-6 py-6" style={{ background: 'var(--color-paper-sunk, #EFEBE3)' }}>
                  <LinkedInFeedMockup spec={feedSpec} mode="full" showFold={false} onLmClick={() => setLmOpen(true)} />
                </div>
              )}
            </div>
          </motion.div>
        </section>
      )}

      {/* THE FIX — the engine, as a live, animated product cockpit */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
        <Kicker>The system</Kicker>
        <h2 className="mt-4 max-w-3xl" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.9rem, 3.6vw, 2.8rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: '#1A1A1A' }}>
          Not <Italic>"AI writes my posts."</Italic> A system that runs your whole presence.
        </h2>
        {cs.system?.summary && <SerifBody className="mt-4 max-w-2xl">{cs.system.summary}</SerifBody>}
        <div className="mt-10">
          <ContentSystemDashboardMock cs={cs} companyName={companyName} />
        </div>
        {/* the four reframe promises, compact under the cockpit */}
        <div className="mt-9 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-7 gap-y-6">
          {PROMISES.map((p, i) => (
            <motion.div key={p.headline} initial={reduce ? false : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, ease: EASE, delay: (i % 4) * 0.07 }}
              className="pl-4" style={{ borderLeft: '2px solid var(--color-accent)' }}>
              <h3 style={{ fontFamily: BODY_SERIF, fontSize: '15px', fontWeight: 600, lineHeight: 1.2, color: '#1A1A1A' }}>{p.headline}</h3>
              <p className="mt-1.5" style={{ fontFamily: BODY_SERIF, fontSize: '13.5px', lineHeight: 1.5, color: '#3D3D3B' }}>{p.benefit}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ONE IDEA IN -> WHOLE FUNNEL OUT — the interactive fan-out animation from the landing */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
        <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.8rem, 3.4vw, 2.6rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: '#1A1A1A' }}>One idea in. <Italic>Your whole funnel out.</Italic></h2>
        <p className="mt-4 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '18px', lineHeight: 1.5, color: '#3D3D3B' }}>The same engine runs the entire loop, end to end. You only ever touch one step.</p>
        {/* desktop: the interactive fan-out diagram (its reveal is gated to >=1024px) */}
        <motion.div className="mt-10 p-4 sm:p-6 md:p-8 hidden lg:block" initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.8, ease: EASE }}
          style={{ borderRadius: 28, border: `1px solid ${hairline}`, background: 'var(--color-paper-sunk, #EFEAE2)', boxShadow: CI_SHADOW_LG }}>
          <SystemFlowDiagram />
        </motion.div>
        {/* mobile: clean stacked steps (the diagram does not reveal below lg) */}
        <div className="mt-9 lg:hidden grid gap-3">
          {SYSTEM_FLOW.map((s, i) => (
            <motion.div key={s.n} initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.45, ease: EASE, delay: i * 0.06 }}
              className="flex gap-3.5 p-4" style={{ background: CI_CARD, borderRadius: CI_R_SM, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW }}>
              <span aria-hidden style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: '1.45rem', lineHeight: 1, color: 'var(--color-accent)', flexShrink: 0, minWidth: 30 }}>{s.n}</span>
              <div>
                <h3 style={{ fontFamily: BODY_SERIF, fontSize: '15px', fontWeight: 600, lineHeight: 1.25, color: '#1A1A1A' }}>{s.title}</h3>
                <p className="mt-1" style={{ fontFamily: BODY_SERIF, fontSize: '13.5px', lineHeight: 1.5, color: '#3D3D3B' }}>{s.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* LEAD MAGNETS */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
        <Kicker>Lead magnets</Kicker>
        <h2 className="mt-4 max-w-3xl" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.9rem, 3.6vw, 2.8rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: '#1A1A1A' }}>Turn attention into <Italic>qualified leads.</Italic></h2>
        <p className="mt-4 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '18px', lineHeight: 1.5, color: '#3D3D3B' }}>From one idea, the system builds an interactive lead magnet, publishes it as a live page, and routes every signup by how good a fit they are.</p>
        <div className="mt-9 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {LM_FORMATS.map((f) => (
            <div key={f.name} className="p-5" style={{ background: CI_CARD, borderRadius: CI_R_SM, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW }}>
              <h3 style={{ fontFamily: BODY_SERIF, fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>{f.name}</h3>
              <p className="mt-1.5" style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.45, color: '#3D3D3B' }}>{f.blurb}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-8">
          {LM_PROMISES.map((p) => (
            <div key={p.headline} className="pl-5" style={{ borderLeft: '2px solid var(--color-accent)' }}>
              <h3 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: '1.25rem', lineHeight: 1.12, color: '#1A1A1A' }}>{p.headline}</h3>
              <p className="mt-2" style={{ fontFamily: BODY_SERIF, fontSize: '14.5px', lineHeight: 1.5, color: '#3D3D3B' }}>{p.benefit}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PROOF — real client case studies */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
        <p className="mb-2" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>Already running</p>
        <h2 className="max-w-3xl" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.9rem, 3.6vw, 2.8rem)', lineHeight: 1.07, letterSpacing: '-0.02em', color: '#1A1A1A' }}>Built for real operators. <Italic>Running every day.</Italic></h2>
        <div className="mt-12 space-y-16">
          {cases.map((c) => (
            <motion.div key={c.client} initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, ease: EASE }} className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <figure className={`m-0 overflow-hidden ${c.flip ? 'lg:order-2' : ''}`} style={{ borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW_LG }}>
                <div className="flex items-center gap-2.5 px-4 py-2.5" style={{ background: '#1A1A1A' }}>
                  <span aria-hidden style={{ height: 6, width: 6, background: 'var(--color-accent)', flexShrink: 0 }} />
                  <span style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(247,244,239,0.9)' }}>{c.client}</span>
                </div>
                <img src={c.src} alt={c.alt} loading="lazy" onError={fallbackOnError} style={{ display: 'block', width: '100%', height: 'auto' }} />
              </figure>
              <div className={c.flip ? 'lg:order-1' : ''}>
                <div style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>{c.role}</div>
                <h3 className="mt-1.5" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.6rem, 3vw, 2.1rem)', letterSpacing: '-0.02em', color: '#1A1A1A' }}>{c.client}</h3>
                <p className="mt-3" style={{ fontFamily: BODY_SERIF, fontSize: '15.5px', lineHeight: 1.55, color: '#3D3D3B' }}>{c.summary}</p>
                <div className="mt-7 flex flex-wrap gap-x-10 gap-y-6">
                  {c.metrics.map((m) => (
                    <div key={m.label}>
                      <div style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(2rem, 4vw, 2.9rem)', lineHeight: 1, color: 'var(--color-accent-ink)' }}>{m.value}</div>
                      <div className="mt-2 max-w-[200px]" style={{ fontFamily: BODY_SERIF, fontSize: '13.5px', lineHeight: 1.4, color: '#5A5752' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* REVIEWS */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
        <Kicker>The kind of work people rehire for</Kicker>
        <div className="mt-8 p-8 lg:p-10" style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW_LG }}>
          <p style={{ fontFamily: SERIF, fontWeight: 400, fontStyle: 'italic', fontSize: 'clamp(1.4rem, 2.8vw, 2rem)', lineHeight: 1.25, letterSpacing: '-0.01em', color: '#1A1A1A' }}>"{REVIEWS[0].q}"</p>
          <p className="mt-5" style={{ fontFamily: BODY_SERIF, fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>{REVIEWS[0].n}</p>
          <p style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A5752', marginTop: 2 }}>{REVIEWS[0].r}</p>
        </div>
        <div className="mt-5 grid md:grid-cols-3 gap-5">
          {REVIEWS.slice(1).map((t) => (
            <div key={t.n} className="p-6" style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW }}>
              <p style={{ fontFamily: BODY_SERIF, fontSize: '14.5px', lineHeight: 1.5, color: '#3D3D3B' }}>"{t.q}"</p>
              <p className="mt-4" style={{ fontFamily: BODY_SERIF, fontSize: '13.5px', fontWeight: 600, color: '#1A1A1A' }}>{t.n}</p>
              <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5A5752', marginTop: 2 }}>{t.r}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FOUNDER NOTE */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-16 lg:py-24" style={{ borderTop: `1px solid ${hairline}` }}>
        <div className="flex items-start gap-5">
          <img src="/ivan-portrait-400.webp" alt="Ivan Manfredi" loading="lazy" onError={fallbackOnError} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 16, flexShrink: 0 }} />
          <div>
            <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', lineHeight: 1.15, letterSpacing: '-0.02em', color: '#1A1A1A' }}>I'm Iván. I build <Italic>content engines that run themselves.</Italic></h2>
            <p className="mt-4" style={{ fontFamily: BODY_SERIF, fontSize: '17px', lineHeight: 1.55, color: '#3D3D3B' }}>I've built 100+ AI systems for agencies and service businesses, and I run my own LinkedIn on the same engine I'd install for you. I'll train yours on your voice and your real work, then show you a week of drafts before you commit to anything.</p>
            <p className="mt-6" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>Iván Manfredi · Agent-Ready Ops</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 pb-20 pt-6 lg:pb-28 lg:pt-10">
        <div className="p-10 lg:p-16 text-center" style={{ background: CI_CARD, borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW_LG }}>
          <h2 style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: '#1A1A1A' }}>Be the sharpest voice in your space. <Italic>Without writing a word.</Italic></h2>
          <p className="mx-auto mt-4 max-w-xl" style={{ fontFamily: BODY_SERIF, fontSize: '17px', lineHeight: 1.55, color: '#3D3D3B' }}>Book a 20-minute look. We'll scope it to your channels, formats, and voice, and you'll get a fixed proposal.</p>
          <div className="mt-8 flex flex-col items-center gap-3.5">
            <BookButton label="Book a 20-min look" />
            <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)' }}>No deck. A working system.</span>
          </div>
        </div>
      </section>

      <footer style={{ borderTop: `1px solid ${hairline}` }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-10 flex flex-wrap items-center justify-between gap-4">
          <span style={{ fontFamily: BODY_SERIF, fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>Iván Manfredi <span style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.5)', marginLeft: 8 }}>Content System</span></span>
          <span className="flex items-center gap-5" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.1em' }}>
            <a href={bookUrl} target="_blank" rel="noopener noreferrer" style={{ color: accentInk, fontWeight: 600 }}>Book a look</a>
            <a href="https://ivanmanfredi.com" style={{ color: 'rgba(26,26,26,0.55)' }}>ivanmanfredi.com</a>
          </span>
        </div>
        <p className="max-w-5xl mx-auto px-5 sm:px-6 pb-8" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.12em', color: 'rgba(26,26,26,0.35)' }}>Prepared for {founderFull} · This page was built from a live scan of your presence.</p>
      </footer>

      <AnimatePresence>
        {lmOpen && cs.sample_output?.lm && (
          <LmPreviewModal lm={cs.sample_output.lm} who={who} bookUrl={bookUrl} onClose={() => setLmOpen(false)} />
        )}
      </AnimatePresence>
    </div>
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
    <svg viewBox="-40 -25 340 290" width="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', maxWidth: '320px' }}>
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
        const pt = getPoint(i, maxR + 20);
        const isLeft = pt.x < cx - 8;
        const textAnchor = isLeft ? 'end' : pt.x > cx + 8 ? 'start' : 'middle';
        // Wrap each label onto one line per word. Single-line labels like "Spend visibility"
        // (~104px wide) overflowed the viewBox and got clipped to "END VISIBILITY" on mobile;
        // stacking the words keeps every label inside the SVG bounds at any width.
        const words = label.split(' ');
        const lineH = 10;
        const x = pt.x.toFixed(1);
        return (
          <text key={i}
            x={x} y={pt.y.toFixed(1)}
            textAnchor={textAnchor} dominantBaseline="middle"
            style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 9, letterSpacing: '0.1em', fill: 'rgba(247,244,239,0.55)', textTransform: 'uppercase' }}
          >
            {words.map((w, wi) => (
              <tspan key={wi} x={x} dy={wi === 0 ? -((words.length - 1) * lineH) / 2 : lineH}>{w}</tspan>
            ))}
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
                01
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
            You scored {report.automation_score} out of 100. Grade {report.automation_grade}. Score below means more humans pasting fields. Higher means more systems doing the work.
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
                      {/* Score sits on the LEFT now (user feedback: scores stuck to right read weird).
                          Layout: SCORE → LABEL → BAR fills remaining width. */}
                      <p style={{
                        fontFamily: SERIF, fontStyle: 'italic',
                        fontSize: 'clamp(1.75rem, 2.6vw, 2rem)', lineHeight: 1,
                        letterSpacing: '-0.02em', color: tone,
                        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                        flexShrink: 0, minWidth: '64px',
                      }}>
                        {c.value}<span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(247,244,239,0.4)', marginLeft: 4, fontStyle: 'normal' }}>/{c.max}</span>
                      </p>
                      <p style={{
                        fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em',
                        textTransform: 'uppercase', color: 'rgba(247,244,239,0.75)',
                        fontWeight: 600, flexShrink: 0, minWidth: '150px',
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
                    </div>
                    <p style={{
                      fontFamily: BODY_SERIF, fontSize: '14px',
                      color: 'rgba(247,244,239,0.65)', lineHeight: 1.5,
                      paddingLeft: '88px',  // align under label (after score)
                    }} className="lg:pl-[88px] pl-0">
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
            Two steps, in order. The first one you can ship this week on your own. The second is the full 90-day build.
          </span>
        </SerifBody>

        {/* STEP 1 — Quick win the buyer can do themselves */}
        {w && (
          <div className="mb-10 max-w-2xl px-5 sm:px-6 lg:px-8 py-7 lg:py-8 -mx-5 sm:-mx-6 lg:-mx-8" style={{ background: 'rgba(76,110,61,0.06)', borderLeft: '3px solid var(--color-accent)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span style={{ fontFamily: MONO, fontSize: '13px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 700 }}>
                Step 01
              </span>
              <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
                This week, on your own
              </span>
            </div>
            <h3 style={{
              fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.5rem, 2.6vw, 2rem)',
              lineHeight: 1.1, letterSpacing: '-0.015em', color: '#1A1A1A',
            }}>
              {w.title}
            </h3>
            <SerifBody className="mt-3"><Emphasized>{w.why}</Emphasized></SerifBody>
            {(w.approach || (w.tools && w.tools.length > 0)) && (
              <p className="mt-4" style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.5, color: 'rgba(26,26,26,0.65)', fontStyle: 'italic' }}>
                {w.approach ?? w.tools?.join(', ')}
              </p>
            )}
          </div>
        )}

        {/* STEP 2 marker — clear visual signal that the CTA below is the second of two steps */}
        <div className="mb-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span style={{ fontFamily: MONO, fontSize: '13px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 700 }}>
              Step 02
            </span>
            <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
              When you're ready to scale
            </span>
          </div>
          <h3 style={{
            fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.5rem, 2.6vw, 2rem)',
            lineHeight: 1.1, letterSpacing: '-0.015em', color: '#1A1A1A',
          }}>
            Hand us the whole scan. We build the 90-day system around it.
          </h3>
          <p className="mt-3 max-w-xl" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.55, color: 'rgba(26,26,26,0.75)' }}>
            The Assessment converts this report into a full build sequence (what ships first, what depends on what, ROI per phase) plus a 60-minute walkthrough with Ivan.
          </p>
        </div>

        {/* PRICE ANCHOR + CTA — comes IMMEDIATELY after Step 02 description so the action
            is adjacent to the prompt. No social-proof gap to scroll through first. */}
        <p className="mb-2 max-w-xl" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(26,26,26,0.7)', fontStyle: 'italic' }}>
          Costs less than the smallest opportunity above. Pays back inside the first month if even one ships.
        </p>
        <p className="mb-6" style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.85)' }}>
          $2,000 · 1 week · 60-min findings walkthrough
        </p>

        <div className="flex flex-col gap-5 mb-16">
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
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 sm:gap-5">
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

        {/* SOCIAL PROOF moved BELOW the CTA. Buyer who clicks doesn't have to scroll past this.
            Buyer who needs more reassurance scrolls down and finds it. */}
        <div className="pt-10 max-w-3xl" style={{ borderTop: '1px solid rgba(26,26,26,0.10)' }}>
          <p className="mb-6" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
            Who's building this
          </p>

          {/* Ivan portrait + bio */}
          <div className="mb-10 max-w-xl flex items-start gap-4">
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

          {/* Recent builds — client logos */}
          <p className="mb-6" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.55)' }}>
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
      <ReframeBand kicker="The Signal" id="reframe">
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
    <ReframeBand kicker="The Signal" id="reframe">
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
            Public ad library confirms current spend. Captured today.
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
          <p style={{ fontFamily: SERIF, fontWeight: 400, fontSize: 'clamp(1.25rem, 2.2vw, 1.9rem)', lineHeight: 1.08, letterSpacing: '-0.015em', color: '#1A1A1A' }}>
            See the data behind every claim above.
          </p>
          <p className="mt-2" style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.5, color: 'rgba(26,26,26,0.6)' }}>
            Built from 14 public sources.
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
  scan: { completed_at: string | null; created_at: string; domain: string };
  reduceMotion: boolean;
}> = ({ companyName, report, scan, reduceMotion }) => {
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-6">
      <div className="pt-10 lg:pt-16 pb-12 lg:pb-20">
        <HeroBylineRow scan={scan} reduceMotion={reduceMotion} />
        <div className="grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-end">
          <div>
            <CompanyLogo logoUrl={report.logo_url} domain={scan.domain} />
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

  // Call-intelligence prospects get a dedicated, cut-down pitch page (no automation
  // score, no $2k assessment) instead of the generic AI Opportunity Scan report.
  if (report.matched_offer === 'call_intelligence' && report.call_intel) {
    return <CallIntelReport report={report} scan={scan} companyName={companyName} />;
  }

  // Content-system prospects (organic content engine + lead-magnet capture, one bundled offer)
  // get a dedicated personalized pitch instead of the generic AI Opportunity Scan report.
  if (report.matched_offer === 'content_system' && report.content_system) {
    return <ContentSystemReport report={report} scan={scan} companyName={companyName} />;
  }

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
          First, let's confirm we're looking at the same company.
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

      {(() => {
        const isCallIntel = report.matched_offer === 'call_intelligence' && !!report.call_intel;
        return (
          <>
            <div className="max-w-6xl mx-auto px-5 sm:px-6">
              <Transition>
                {isCallIntel
                  ? "You can't hear those calls. Here's what mining them would surface."
                  : "Five places it's happening today. Ranked by leverage."}
              </Transition>
            </div>

            {/* §6 — New Way. Call-intelligence audit+pitch, or the ranked opportunities. */}
            <div className="max-w-6xl mx-auto px-5 sm:px-6 pb-24">
              {isCallIntel
                ? <CallIntelSection report={report} companyName={companyName} />
                : <Section3Opportunities report={report} companyName={companyName} />}

              <Transition>
                Every signal above traces back to this.
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
          </>
        );
      })()}
    </div>
  );
};

export default ScanReportPage;
