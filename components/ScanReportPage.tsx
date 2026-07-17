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
import LinkedInFeedMockup from './ui/LinkedInFeedMockup';
import LinkedInPostPreview from './ui/LinkedInPostPreview';
import NewsletterMockup from './ui/NewsletterMockup';
import FollowUpSequence from './ui/FollowUpSequence';
import EngagerOutreachMockup from './ui/EngagerOutreachMockup';
import { buildFeedSpecFromContentSystem } from '../lib/contentSystemFeed';
import { buildAssessmentEmbedUrl } from '../lib/assessmentEmbed';
import LiveAssessmentEmbed from './ui/LiveAssessmentEmbed';
import { trackScanOpen } from '../lib/scanOpenTracker';

const CALENDLY_BASE = 'https://calendly.com/im-ivanmanfredi/30min';

const SERIF = '"Schibsted Grotesk", system-ui, -apple-system, sans-serif';
const BODY_SERIF = '"Source Serif 4", Georgia, serif';
const MONO = '"Schibsted Grotesk", system-ui, -apple-system, sans-serif';
const EASE = [0.22, 0.84, 0.36, 1] as const;

// ── Black Box scope ────────────────────────────────────────────────────────────
// Ratified v4 "Black Box" restyle. Scoped CSS-var overrides applied to every scan
// report root so the whole page reads as the FDA boxed-warning grammar: paper white,
// ink #131210, one signal red (the wordmark ON only), flat sharp corners, no shadows.
// Overriding the theme vars here re-skins Tailwind utilities (bg-paper, text-ink,
// border-hairline, rounded-*, shadow-*) AND inline var(--color-*) usages in one place.
const INK = '#131210';
const RED = '#C8361B';
const PAPER = '#FFFFFF';
const MUTED = '#6B675E';
const SEC = '#4A463E';
const HAIR = '#C9C2B2';
const BLACKBOX_VARS: React.CSSProperties = {
  ['--color-paper' as any]: PAPER,
  ['--color-paper-sunk' as any]: PAPER,
  ['--color-paper-raise' as any]: PAPER,
  ['--color-ink' as any]: INK,
  ['--color-ink-soft' as any]: SEC,
  ['--color-ink-mute' as any]: MUTED,
  ['--color-hairline' as any]: HAIR,
  ['--color-hairline-bold' as any]: INK,
  ['--color-accent' as any]: INK,
  ['--color-accent-light' as any]: INK,
  ['--color-accent-ink' as any]: INK,
  ['--color-accent-soft' as any]: 'rgba(19,18,16,0.06)',
  ['--radius' as any]: '0px',
  ['--radius-sm' as any]: '0px',
  ['--radius-md' as any]: '0px',
  ['--radius-lg' as any]: '0px',
  ['--radius-xl' as any]: '0px',
  ['--radius-2xl' as any]: '0px',
  ['--shadow-card' as any]: 'none',
  ['--shadow-card-hover' as any]: 'none',
  ['--shadow-card-subtle' as any]: 'none',
  ['--shadow-card-lift' as any]: 'none',
  ['--shadow-card-active' as any]: 'none',
  ['--shadow-card-sm' as any]: 'none',
  ['--shadow-card-sm-hover' as any]: 'none',
  ['--shadow-card-sm-active' as any]: 'none',
  background: PAPER,
};

// Product wordmark. One line, never stacked; ON is always weight 900 and red, the rest
// weight 500. This red is the composition's single red.
const Wordmark: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
  <span className={className} style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: '-0.02em', fontSize: size, lineHeight: 1, color: INK, whiteSpace: 'nowrap', textTransform: 'none' }}>
    INBOUND<span style={{ fontWeight: 900, color: RED }}>ON</span>STEROIDS
  </span>
);

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
    color: tone === 'dark' ? 'rgba(255,255,255,0.88)' : '#131210',
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
      background: tone === 'dark' ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
      border: tone === 'dark' ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(19,18,16,0.06)',
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
      <p className="mb-5" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)', fontWeight: 600 }}>
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
                fontFamily: BODY_SERIF, fontSize: '14px', color: '#131210', lineHeight: 1.3,
              }}>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: isTop ? 'var(--color-accent)' : 'rgba(19,18,16,0.45)', fontWeight: 600 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{o.title.length > 32 ? o.title.slice(0, 30) + '…' : o.title}</span>
              </p>
              <div className="flex-1" style={{ height: 18, background: 'rgba(19,18,16,0.06)', position: 'relative' }}>
                <motion.div
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  whileInView={{ scaleX: pct }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.8, ease: EASE, delay: 0.1 + i * 0.08 }}
                  style={{ height: '100%', background: isTop ? 'var(--color-accent)' : 'rgba(19,18,16,0.5)', transformOrigin: 'left' }}
                />
              </div>
              <p className="flex-shrink-0 text-right" style={{
                width: '110px',
                fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: '20px',
                color: isTop ? 'var(--color-accent)' : 'rgba(19,18,16,0.7)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                ${(o.estimated_monthly_cost || 0).toLocaleString()}<span style={{ fontFamily: MONO, fontSize: '10px', color: 'rgba(19,18,16,0.5)', fontStyle: 'normal', marginLeft: 2 }}>/mo</span>
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
      style={{ background: '#fff', border: '1px solid rgba(19,18,16,0.08)', padding: 6 }}
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
          return <strong key={i} style={{ fontWeight: 600, color: '#131210' }}>{p.slice(2, -2)}</strong>;
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
      fontWeight: 800,
      fontSize: 'clamp(1.875rem, 3.4vw, 2.75rem)',
      lineHeight: 1.05,
      letterSpacing: '-0.02em',
      color: '#131210',
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
  const proseColor = tone === 'sage' ? 'rgba(19,18,16,0.85)' : 'rgba(19,18,16,0.65)';
  const ruleColor = tone === 'sage' ? 'rgba(19,18,16,0.3)' : 'rgba(19,18,16,0.15)';
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
            fontFamily: BODY_SERIF, fontStyle: 'italic', fontWeight: 400,
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
          fontFamily: BODY_SERIF, fontStyle: 'italic', fontWeight: 400,
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

// ReframeBand — THE BOX. The load-bearing §3 "scan result" verdict, rendered as the house
// component: heavy 4px rule + 1px outline offset 3px, printed on paper, rotated -0.6deg.
// This is the one rotated box on the page (the human move); every other box sits square.
const ReframeBand: React.FC<{ kicker: string; children: React.ReactNode; id?: string }> = ({ kicker, children, id }) => {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      id={id}
      initial={reduceMotion ? false : { opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, ease: EASE }}
      className="py-16 lg:py-24"
      style={{ scrollMarginTop: 80 }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        <div
          style={{
            border: `4px solid ${INK}`,
            outline: `1px solid ${INK}`,
            outlineOffset: 3,
            background: PAPER,
            padding: 'clamp(20px,3vw,34px) clamp(20px,3vw,36px) clamp(24px,3.4vw,38px)',
            transform: reduceMotion ? 'none' : 'rotate(-0.6deg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 'clamp(14px,1.8vw,18px)', borderBottom: `2px solid ${INK}` }}>
            <span aria-hidden style={{ width: 17, height: 17, background: INK, flexShrink: 0 }} />
            <span style={{ fontFamily: SERIF, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 'clamp(11px,1.5vw,14px)', lineHeight: 1.25, color: INK }}>
              Scan result: {kicker}
            </span>
          </div>
          <div className="mt-4 lg:mt-5">
            {children}
          </div>
        </div>
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
            fontWeight: 800,
            fontSize: 'clamp(2.5rem, 4.5vw, 3.5rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: '#131210',
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
    return <span style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: INK }}>{children}</span>;
  }
  return (
    <span style={{ fontStyle: 'italic', position: 'relative', color: '#131210' }}>
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
      color: '#4A463E',
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
    variant === 'found' ? { color: 'var(--color-accent)', borderColor: 'rgba(19,18,16,0.25)', background: 'rgba(19,18,16,0.06)' } :
    variant === 'missing' ? { color: '#131210', borderColor: 'rgba(19,18,16,0.25)', background: 'rgba(19,18,16,0.05)' } :
    { color: 'rgba(19,18,16,0.7)', borderColor: 'rgba(19,18,16,0.12)', background: 'transparent' };
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
      <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.5)' }}>
        Your homepage, captured today
      </p>
      <div
        className="overflow-hidden"
        style={{
          border: '1px solid rgba(19,18,16,0.12)',
          background: '#FFFFFF',
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
            <div className="flex flex-wrap gap-x-6 gap-y-2" style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.04em', color: 'rgba(19,18,16,0.65)' }}>
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
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>LinkedIn followers</p>
                <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)', lineHeight: 1, letterSpacing: '-0.02em', color: '#131210', marginTop: 4 }}>
                  {linkedin_summary.followers.toLocaleString()}
                </p>
              </div>
            )}
            {linkedin_summary?.posts_30d != null && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>Posts / 30d</p>
                <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)', lineHeight: 1, letterSpacing: '-0.02em', color: '#131210', marginTop: 4 }}>
                  {linkedin_summary.posts_30d}
                </p>
              </div>
            )}
            {linkedin_summary?.last_post_days != null && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>Last post</p>
                <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)', lineHeight: 1, letterSpacing: '-0.02em', color: linkedin_summary.last_post_days > 30 ? '#131210' : '#131210', marginTop: 4 }}>
                  {linkedin_summary.last_post_days}d ago
                </p>
              </div>
            )}
            {!!linkedin_summary?.ai_mentions && linkedin_summary.ai_mentions > 0 && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>AI mentions</p>
                <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)', lineHeight: 1, letterSpacing: '-0.02em', color: 'var(--color-accent)', marginTop: 4 }}>
                  {linkedin_summary.ai_mentions}
                </p>
              </div>
            )}
            {github && (
              <div>
                <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>GitHub repos</p>
                <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 'clamp(1.75rem, 2.8vw, 2.25rem)', lineHeight: 1, letterSpacing: '-0.02em', color: '#131210', marginTop: 4 }}>
                  {github.repos}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 3. DNS verification callout — high signal, deserves prominence */}
        {(anthropic_verified || openai_verified) && (
          <div className="px-6 py-5 border-l-2" style={{ borderColor: 'var(--color-accent)', background: 'rgba(19,18,16,0.05)' }}>
            <SerifBody>
              DNS records confirm active{' '}
              <Italic>
                {anthropic_verified && 'Anthropic'}
                {anthropic_verified && openai_verified && ' + '}
                {openai_verified && 'OpenAI'}
              </Italic>{' '}
              API usage. The gap here isn't awareness. It's <strong style={{ color: '#131210', fontWeight: 600 }}>deployment</strong>.
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
                  : <p style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(19,18,16,0.65)' }}>None detected</p>}
              </div>
            </div>
            <div>
              <p style={{ fontFamily: MONO, fontSize: '10px', color: '#131210', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>Missing</p>
              <div className="flex flex-wrap gap-2">
                {tech_stack_assessment.missing_critical_tools.length > 0
                  ? tech_stack_assessment.missing_critical_tools.slice(0, 6).map(t => <Chip key={t} label={t} variant="missing" />)
                  : <p style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(19,18,16,0.65)' }}>No critical gaps</p>}
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
    push('Direct',         sources.direct, '#131210');
    push('Referrals',      sources.referrals, 'rgba(19,18,16,0.6)');
    push('Social',         sources.social, 'rgba(19,18,16,0.6)');
    push('Paid',           sources.paidReferrals, '#131210');
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
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>
              Source breakdown
            </p>
            {/* W2.3 — Single FT/Bloomberg-style stacked horizontal bar (was 5 separate sage rectangles
                with zero data-ink per Visual specialist). One thick bar, segmented, labeled inline.
                P0.1 fix: explicit width + flexShrink:0 so segments don't collapse on mobile when the
                first segment is largest (was rendering with sage Organic Search empty at 390px). */}
            <div className="mt-6">
              <div className="flex w-full" style={{ height: 28, background: 'rgba(19,18,16,0.06)' }}>
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
                      borderRight: i < sourceRows.length - 1 ? '1px solid #FFFFFF' : 'none',
                    }}
                  />
                ))}
              </div>
              {/* Inline legend below the bar, mono caps, dot marker matches segment color */}
              <ul className="mt-5 space-y-2.5" style={{ listStyle: 'none', padding: 0 }}>
                {sourceRows.map((row) => (
                  <li key={row.label} className="flex items-baseline gap-3">
                    <span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, background: row.tone, flexShrink: 0 }} />
                    <span style={{ fontFamily: BODY_SERIF, fontSize: '15px', color: '#131210', flex: 1 }}>
                      {row.label}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: '13px', color: 'rgba(19,18,16,0.7)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
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
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>
              Top search queries
            </p>
            <ul className="mt-4 space-y-2">
              {topKeywords.map((k) => (
                <li key={k} style={{ fontFamily: BODY_SERIF, fontSize: '16px', color: '#131210', fontStyle: 'italic' }}>
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
              <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>{s.label}</p>
              <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: '24px', color: '#131210', marginTop: 2 }}>{s.display}</p>
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
          style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.7)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#131210')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(19,18,16,0.7)')}
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
        <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>
          12-month cost of inaction
        </p>
        <div>
          <p style={{
            fontFamily: BODY_SERIF, fontStyle: 'italic',
            fontSize: 'clamp(4rem, 8vw, 6.5rem)', lineHeight: 0.92,
            letterSpacing: '-0.035em', color: '#131210',
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
          fontFamily: SERIF, fontWeight: 800,
          fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05,
          letterSpacing: '-0.025em', color: '#131210',
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
            <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>
              12-month cost of inaction
            </p>
            <p style={{
              fontFamily: BODY_SERIF, fontStyle: 'italic', fontWeight: 400,
              fontSize: 'clamp(4.5rem, 11vw, 9rem)', lineHeight: 0.92,
              letterSpacing: '-0.04em', color: '#131210',
              fontVariantNumeric: 'tabular-nums', marginTop: 8,
            }}>
              <Scramble value={annualDisplay} duration={0.6} />
            </p>
            <p className="mt-4 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '17px', lineHeight: 1.5, color: 'rgba(19,18,16,0.7)', fontStyle: 'italic' }}>
              That's the compounding cost across the 5 opportunities below. Unleveraged time and missed conversion if nothing in the system changes for 12 months.
            </p>
          </div>
        )}

        <a
          href="#opportunities"
          className="inline-flex items-baseline gap-1.5 mt-10 group"
          style={{
            fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em',
            textTransform: 'uppercase', color: 'rgba(19,18,16,0.6)',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#131210')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(19,18,16,0.6)')}
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
        <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>
          What we can see from outside
        </p>
        <p style={{
          fontFamily: BODY_SERIF, fontStyle: 'italic', fontWeight: 400,
          fontSize: 'clamp(2.75rem, 7vw, 5rem)', lineHeight: 0.95,
          letterSpacing: '-0.03em', color: '#131210', marginTop: 10,
        }}>
          {ci.volume_estimate.value}
        </p>
        {ci.volume_estimate.basis && (
          <p className="mt-3 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.55, color: 'rgba(19,18,16,0.65)' }}>
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
              <p className="mt-1.5" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.55, color: '#4A463E' }}>
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
                <p style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.25rem, 2.4vw, 1.6rem)', lineHeight: 1.15, letterSpacing: '-0.015em', color: '#131210' }}>
                  {l.title}
                </p>
                <p className="mt-1.5 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.55, color: '#4A463E' }}>
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
              <li key={i} className="flex gap-3" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.5, color: '#4A463E' }}>
                <span aria-hidden style={{ display: 'inline-block', height: 1, width: 16, background: 'var(--color-accent)', marginTop: '0.7em', flexShrink: 0 }} />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sample output — faux product surface so they can picture the deliverable */}
        <div style={{ border: `1px solid ${hairline}`, background: 'var(--color-paper, #FFFFFF)' }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${hairline}` }}>
            <span aria-hidden style={{ height: 7, width: 7, background: 'var(--color-accent)' }} />
            <p style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>
              {meta.sampleKicker}
            </p>
          </div>
          <div className="p-5">
            <p style={{ fontFamily: SERIF, fontWeight: 800, fontSize: '1.35rem', lineHeight: 1.15, letterSpacing: '-0.015em', color: '#131210' }}>
              {ci.sample_output.title}
            </p>
            <ul className="mt-4 space-y-2.5">
              {ci.sample_output.items.map((it, i) => (
                <li key={i} className="flex gap-2.5" style={{ fontFamily: MONO, fontSize: '13px', lineHeight: 1.5, color: '#4A463E' }}>
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
const CI_CARD = '#FFFFFF';        // flat paper — Black Box: printed, not floating
const CI_R = 0;                   // Black Box: sharp corners only
const CI_R_SM = 0;                // Black Box: sharp corners only
const CI_SHADOW = 'none';         // Black Box: no drop shadows
const CI_SHADOW_LG = 'none';      // Black Box: no drop shadows
const CI_CORAL = '#131210';       // risk / loss accent folded to ink (red reserved for wordmark)

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
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: '#131210' }}>
        <span aria-hidden style={{ height: 7, width: 7, background: 'var(--color-accent)', flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)' }}>
          {companyName} · {meta.review}
        </span>
        <span className="ml-auto flex items-center gap-1.5" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
          <motion.span aria-hidden animate={reduce ? {} : { opacity: [1, 0.3, 1] }} transition={{ duration: 2, repeat: Infinity }} style={{ height: 6, width: 6, background: 'var(--color-accent)' }} />
          Live
        </span>
      </div>

      <div style={{ background: 'var(--color-paper, #FFFFFF)' }}>
        {metrics ? (
          <>
            {flags && flags[0] && (
              <div className="flex items-start gap-2.5 px-5 py-3.5" style={{ borderBottom: `1px solid ${hairline}`, background: 'rgba(19,18,16,0.05)' }}>
                <span style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: accentInk, fontWeight: 600, marginTop: 3, flexShrink: 0 }}>This week</span>
                <span style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.4, color: '#131210' }}>{flags[0].text}</span>
              </div>
            )}
            {/* metric tiles */}
            <div className="grid grid-cols-3" style={{ borderBottom: `1px solid ${hairline}` }}>
              {metrics.map((m, i) => (
                <div key={i} className="px-5 py-5" style={{ borderLeft: i ? `1px solid ${hairline}` : 'none' }}>
                  <CICountMetric value={m.value} style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(1.9rem, 3vw, 2.6rem)', lineHeight: 1, letterSpacing: '-0.02em', color: i === 0 ? 'var(--color-accent)' : '#131210', fontVariantNumeric: 'tabular-nums' }} />
                  <p className="mt-2" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>{m.label}</p>
                  {m.delta && <p className="mt-0.5" style={{ fontFamily: MONO, fontSize: '10px', color: accentInk }}>{m.delta}</p>}
                </div>
              ))}
            </div>

            <div className="px-5 lg:px-6 py-6 space-y-6">
              {/* rep bars */}
              {reps.length > 0 && (
                <div>
                  <p className="mb-3" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.5)' }}>Close rate by rep</p>
                  <div className="space-y-2.5">
                    {reps.map((r, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="shrink-0" style={{ width: 96, fontFamily: BODY_SERIF, fontSize: '13px', color: '#4A463E' }}>{r.name}</span>
                        <div className="relative flex-1" style={{ height: 7, background: 'rgba(19,18,16,0.07)' }}>
                          <motion.div
                            initial={reduce ? false : { scaleX: 0 }}
                            whileInView={{ scaleX: 1 }}
                            viewport={{ once: true, margin: '-40px' }}
                            transition={{ duration: 0.9, ease: EASE, delay: 0.15 + i * 0.1 }}
                            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.round((r.pct / maxPct) * 100)}%`, transformOrigin: 'left', background: bestRep && r.name === bestRep.name ? 'var(--color-accent)' : '#131210' }}
                          />
                        </div>
                        <span className="shrink-0 text-right" style={{ width: 38, fontFamily: MONO, fontSize: '12px', fontWeight: 600, color: bestRep && r.name === bestRep.name ? accentInk : '#131210', fontVariantNumeric: 'tabular-nums' }}>{r.pct}%</span>
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
                      <span className="shrink-0 px-2 py-1" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: accentInk, border: `1px solid ${hairline}`, borderRadius: 8, background: 'rgba(19,18,16,0.06)' }}>{f.tag}</span>
                      <span style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.45, color: '#4A463E' }}>{f.text}</span>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // fallback for pre-structured scans
          <div className="p-6 lg:p-7">
            <p style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.35rem, 2.5vw, 1.75rem)', lineHeight: 1.12, letterSpacing: '-0.015em', color: '#131210' }}>{so.title}</p>
            <ul className="mt-5">
              {so.items.map((it, i) => (
                <li key={i} className="flex gap-3.5" style={{ borderTop: i ? `1px solid ${hairline}` : 'none', paddingTop: i ? '0.85rem' : 0, marginTop: i ? '0.85rem' : 0 }}>
                  <span aria-hidden style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 600, color: accentInk, lineHeight: 1.55, flexShrink: 0, minWidth: 16 }}>{String(i + 1).padStart(2, '0')}</span>
                  <span style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: '#4A463E' }}>{it}</span>
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
        style={{ x: sx, y: sy, fontFamily: BODY_SERIF, fontSize: small ? '14px' : '16.5px', fontWeight: 600, background: '#131210', color: '#FFFFFF', padding: small ? '0 18px' : '16px 30px', minHeight: small ? 42 : 56, borderRadius: small ? 11 : 14, boxShadow: small ? 'none' : '0 2px 6px rgba(19,18,16,0.12), 0 12px 28px rgba(19,18,16,0.16)', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {label}
        <ArrowRight size={small ? 14 : 17} className="transition-transform group-hover:translate-x-1" />
      </motion.a>
    </div>
  );
};

// Thematic animated audio-waveform — call intelligence reads as "live audio being scored".
// Deterministic bar heights, gentle continuous scaleY loop. Used big in the hero + tiny inline.
function CIWaveform({ count = 56, maxH = 56, gap = 3, barW = 2.5, className = '', barColor = 'var(--color-accent)' }: { count?: number; maxH?: number; gap?: number; barW?: number; className?: string; barColor?: string }) {
  // Static specimen — no pulse loop (Black Box: settled type, no infinite motion).
  return (
    <div className={`flex items-center ${className}`} aria-hidden style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => {
        const base = 0.22 + 0.78 * Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.45) + Math.sin(i * 0.3) * 0.4);
        return (
          <span key={i} style={{ width: barW, background: barColor, height: Math.max(5, base * maxH), flexShrink: 0 }} />
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
      <div className="absolute inset-0 pointer-events-none z-0" style={{ backgroundImage: 'linear-gradient(rgba(19,18,16,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(19,18,16,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      {/* slow drifting paper grain */}
      <motion.div className="absolute inset-0 pointer-events-none z-0" style={{ opacity: 0.2, backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.3%22/></svg>")' }} animate={reduce ? {} : { backgroundPosition: ['0px 0px', '120px 120px'] }} transition={{ duration: 90, repeat: Infinity, ease: 'linear' }} />
      {/* expanding sage rule across top */}
      <motion.div initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.1, duration: 1.6, ease: EASE }} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--color-accent)', transformOrigin: 'left', opacity: 0.5, zIndex: 5 }} />

      <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-6 pt-12 pb-14 lg:pt-16 lg:pb-20 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 lg:items-center">
        <div>
          {/* status byline */}
          <motion.div initial={reduce ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.6 }} className="mb-9 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#6B675E' }}>
            <CIWaveform count={5} maxH={13} gap={2} barW={2} className="mr-0.5" />
            <span>Call Intelligence · {meta.tag}</span>
            <span aria-hidden style={{ color: 'rgba(19,18,16,0.3)' }}>/</span>
            <span style={{ color: 'rgba(19,18,16,0.5)' }}>for {companyName}</span>
          </motion.div>

          {/* benefit-led headline — leads with the outcome, not the mechanism */}
          <h1 className="mb-7" style={{ fontFamily: SERIF, fontWeight: 800, color: '#131210', letterSpacing: '-0.02em' }}>
            <Reveal delay={0.12}>
              <span style={{ display: 'block', fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', lineHeight: 1.1, color: '#4A463E' }}>{h.pre}</span>
            </Reveal>
            <Reveal delay={0.26}>
              <span style={{ display: 'block', color: 'var(--color-accent)', fontSize: 'clamp(3.4rem, 8.5vw, 6.4rem)', lineHeight: 0.92, letterSpacing: '-0.045em', marginTop: '0.06em', marginLeft: '-0.015em' }}>{h.hero}</span>
            </Reveal>
          </h1>

          {/* plain benefit subhead — bigger, short, simple */}
          <motion.p initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.9, ease: EASE }} className="max-w-xl" style={{ fontFamily: BODY_SERIF, fontSize: 'clamp(18px, 2.2vw, 21px)', lineHeight: 1.5, color: '#4A463E' }}>
            {h.sub}
          </motion.p>

          {/* mono spec row */}
          <motion.ul initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.92, duration: 0.7, ease: EASE }} className="mt-7 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-y-2.5 sm:gap-0">
            {h.spec.map((s, i) => (
              <li key={s} className={`flex items-center gap-2.5 sm:px-5 ${i === 0 ? 'sm:pl-0' : 'sm:border-l'}`} style={{ fontFamily: MONO, fontSize: '12.5px', letterSpacing: '0.02em', color: '#131210', borderColor: hairline }}>
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
            <div className="flex items-center justify-between mb-6" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6B675E' }}>
              <span className="flex items-center gap-2">
                <motion.span aria-hidden animate={reduce ? {} : { opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ width: 6, height: 6, borderRadius: 6, background: 'var(--color-accent)' }} />
                Live call
              </span>
              <span style={{ color: 'rgba(19,18,16,0.4)' }}>scoring</span>
            </div>
            <div className="flex items-center justify-center" style={{ height: 90 }}>
              <CIWaveform count={32} maxH={78} gap={4} barW={3} />
            </div>
            <div className="mt-6 pt-4 flex items-center justify-between" style={{ borderTop: `1px solid ${hairline}`, fontFamily: MONO, fontSize: '11px', letterSpacing: '0.06em', color: '#6B675E' }}>
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
        style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.7rem, 3.4vw, 2.5rem)', lineHeight: 1.12, letterSpacing: '-0.02em', color: '#131210' }}>
        {opener}
      </motion.p>
      <div className="mt-6 space-y-4">
        {painLines.map((l, i) => (
          <motion.p key={i} initial={reduce ? false : { opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.5, ease: EASE, delay: Math.min(i * 0.06, 0.3) }}
            style={{ fontFamily: BODY_SERIF, fontWeight: 400, fontSize: 'clamp(19px, 2.4vw, 24px)', lineHeight: 1.45, color: '#4A463E' }}>
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
                <span style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: '1.5rem', color: 'var(--color-accent)', lineHeight: 1, minWidth: 22 }}>{i + 1}</span>
                <span style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.2rem, 2.4vw, 1.5rem)', lineHeight: 1.18, letterSpacing: '-0.01em', color: '#131210' }}>{l.title}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.h2 className="mt-14" initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.7, ease: EASE }}
        style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(2.2rem, 5vw, 3.4rem)', lineHeight: 1.04, letterSpacing: '-0.025em', color: 'var(--color-accent)' }}>
        There's a better way.
      </motion.h2>
      <p className="mt-3" style={{ fontFamily: BODY_SERIF, fontSize: '18px', color: '#6B675E' }}>Here's how it works.</p>

      {receipts.length > 0 && (
        <div className="mt-12 pt-8" style={{ borderTop: `1px solid ${hairline}` }}>
          <p className="mb-4" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.5)' }}>We didn't guess. Read from your public presence today</p>
          <div className="flex flex-wrap gap-2.5">
            {receipts.map((r, i) => (
              <span key={i} className="inline-flex items-baseline gap-2 px-3.5 py-2" style={{ background: CI_CARD, border: `1px solid ${hairline}`, borderRadius: CI_R_SM, boxShadow: CI_SHADOW }}>
                <span style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>{r.label}</span>
                <span style={{ fontFamily: MONO, fontSize: '12px', color: '#4A463E' }}>{r.value}</span>
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
  </g>
);
const SFNode: React.FC<{ x: number; y: number; w: number; label: string; accent?: boolean; active?: boolean; delay: number; reduce: boolean; sage: string; hairline: string; onEnter?: () => void; onLeave?: () => void; onClick?: () => void }> = ({ x, y, w, label, accent, active, delay, reduce, sage, hairline, onEnter, onLeave, onClick }) => {
  const c = accent ? CI_CORAL : sage;
  return (
    <motion.g initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.5, ease: EASE, delay }}
      onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>
      {active && <rect x={x - 5} y={y - 27} width={w + 10} height={54} rx={0} fill="none" stroke={c} strokeWidth={1.5} strokeOpacity={0.55} />}
      <rect x={x} y={y - 22} width={w} height={44} rx={0} fill={active ? (accent ? 'rgba(19,18,16,0.08)' : 'rgba(19,18,16,0.09)') : CI_CARD} stroke={active ? c : (accent ? CI_CORAL : hairline)} strokeWidth={active ? 1.5 : 1} style={{ filter: 'none' }} />
      <circle cx={x + 18} cy={y} r={3} fill={c} />
      <text x={x + 32} y={y} dominantBaseline="central" style={{ fontFamily: MONO, fontSize: 14, letterSpacing: '0.04em', fill: '#131210', fontWeight: active ? 600 : 400 }}>{label}</text>
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
  // Auto-cycle retired — no self-running motion. The panel follows hover; idle rests on the first output.
  void setAuto;
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
          <p className="mt-2 mx-auto" style={{ fontFamily: BODY_SERIF, fontSize: '17px', lineHeight: 1.5, color: '#4A463E', maxWidth: '46ch' }}>{info.desc}</p>
        </motion.div>
      </AnimatePresence>
      <p className="mt-3" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.35)' }}>Hover to explore · click to jump to it</p>
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
            <rect x={EX1 - 8} y={ECY - 74} width={EW + 16} height={148} rx={0} fill="none" stroke={sage} strokeWidth={hover === 'engine' ? 1.5 : 1} strokeOpacity={hover === 'engine' ? 0.6 : 0.4} />
            <rect x={EX1} y={ECY - 66} width={EW} height={132} rx={0} fill="#131210" style={{ filter: 'none' }} />
            <circle cx={EX1 + 24} cy={ECY - 38} r={3.5} fill={sage} />
            <text x={EX1 + 36} y={ECY - 38} dominantBaseline="central" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', fill: 'rgba(255,255,255,0.6)' }}>ENGINE</text>
            <text x={EX1 + 24} y={ECY + 6} style={{ fontFamily: SERIF, fontSize: 28, fill: '#FFFFFF' }}>Scoring <tspan fontStyle="italic" fill={sage}>engine</tspan></text>
            <text x={EX1 + 24} y={ECY + 48} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.05em', fill: 'rgba(255,255,255,0.55)' }}>transcribe · score · route</text>
          </motion.g>
          {/* input + output nodes */}
          {SF_IN.map((l, i) => <SFNode key={`in${i}`} x={24} y={inY[i]} w={172} label={l} delay={0.15 + i * 0.07} reduce={!!reduce} sage={sage} hairline={hairline} />)}
          {SF_OUT.map((o, i) => <SFNode key={`out${i}`} x={788} y={outY[i]} w={196} label={o.label} accent={(o as any).accent} active={activeOut === i} delay={0.7 + i * 0.08} reduce={!!reduce} sage={sage} hairline={hairline} onEnter={() => setHover(i)} onLeave={() => setHover(null)} onClick={() => goTo(o.anchor)} />)}
          <text x={24} y={366} style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.2em', fill: 'rgba(19,18,16,0.4)' }}>EVERY CALL IN</text>
          <text x={788} y={366} style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.2em', fill: 'rgba(19,18,16,0.4)' }}>WHAT YOU GET</text>
        </svg>
      </div>

      {/* MOBILE — vertical flow, output chips tappable */}
      <div className="lg:hidden flex flex-col items-center">
        <div className="w-full grid grid-cols-2 gap-2.5">
          {SF_IN.map((l) => (
            <div key={l} className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: CI_CARD, borderRadius: CI_R_SM, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW }}>
              <span style={{ width: 5, height: 5, borderRadius: 5, background: sage, flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.04em', color: '#131210' }}>{l}</span>
            </div>
          ))}
        </div>
        <div className="relative my-3" style={{ width: 2, height: 40, background: hairline }} />
        <div className="w-full px-5 py-5 text-center" style={{ background: '#131210', borderRadius: CI_R, boxShadow: CI_SHADOW_LG }}>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>The engine</p>
          <p style={{ fontFamily: SERIF, fontSize: '1.7rem', lineHeight: 1.05, color: '#FFFFFF', marginTop: 4 }}>Scoring <span style={{ fontStyle: 'italic', color: sage }}>engine</span></p>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>transcribe · score · route</p>
        </div>
        <div className="relative my-3" style={{ width: 2, height: 40, background: hairline }} />
        <div className="w-full grid grid-cols-2 gap-2.5">
          {SF_OUT.map((o, i) => (
            <button key={o.label} onClick={() => goTo(o.anchor)} className="flex items-center gap-2 px-3.5 py-2.5 text-left" style={{ background: CI_CARD, borderRadius: CI_R_SM, border: `1px solid ${o.accent ? CI_CORAL : hairline}`, boxShadow: CI_SHADOW }}>
              <span style={{ width: 5, height: 5, borderRadius: 5, background: o.accent ? CI_CORAL : sage, flexShrink: 0 }} />
              <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.04em', color: '#131210' }}>{o.label}</span>
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
  // Retired — the loading-glint sweep read as SaaS chrome (an AI-slop tell). Black Box: printed, not loading.
  return null;
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
        <span className="flex gap-1" aria-hidden>{[0, 1, 2].map((d) => <span key={d} style={{ width: 7, height: 7, borderRadius: 7, background: 'rgba(19,18,16,0.13)' }} />)}</span>
        <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>Call analysis</span>
        <span className="ml-auto" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.45)' }}>Discovery · Acme Co · 32 min</span>
      </div>
      <div className="p-5 lg:p-6">
        <div className="flex items-baseline gap-2">
          <span style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 'clamp(2.6rem,5vw,3.4rem)', lineHeight: 0.9, color: 'var(--color-accent)', fontVariantNumeric: 'tabular-nums' }}><Counter value={78} /></span>
          <span style={{ fontFamily: MONO, fontSize: '13px', color: 'rgba(19,18,16,0.5)' }}>/100</span>
          <span className="ml-auto" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.5)' }}>overall</span>
        </div>
        <div className="mt-5 space-y-3">
          {dims.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="shrink-0" style={{ width: 132, fontFamily: BODY_SERIF, fontSize: '14px', color: '#4A463E' }}>{d.label}</span>
              <div className="relative flex-1" style={{ height: 6, borderRadius: 3, background: 'rgba(19,18,16,0.07)' }}>
                <motion.div initial={reduce ? false : { scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.8, ease: EASE, delay: 0.2 + i * 0.08 }}
                  style={{ position: 'absolute', inset: 0, transformOrigin: 'left', width: `${d.s * 10}%`, borderRadius: 3, background: d.s >= 7 ? 'var(--color-accent)' : d.s >= 5 ? '#131210' : CI_CORAL }} />
              </div>
              <span className="shrink-0 text-right" style={{ width: 34, fontFamily: MONO, fontSize: '12px', fontWeight: 600, color: '#131210' }}>{d.s}/10</span>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${hairline}` }}>
          <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>Flagged moment · 18:24</p>
          <p className="mt-1.5" style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: '15px', lineHeight: 1.45, color: '#131210' }}>"Is pricing per seat or per workspace?" Went unanswered for 40 seconds.</p>
        </div>
        <div className="mt-4">
          <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.5)' }}>What to improve</p>
          <ul className="mt-2 space-y-1.5">
            {['Answer the pricing question head-on. Don’t defer it.', 'Lock a next step on the call. This one ended with no date.'].map((t, i) => (
              <li key={i} className="flex gap-2.5" style={{ fontFamily: BODY_SERIF, fontSize: '14.5px', lineHeight: 1.4, color: '#4A463E' }}>
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
        <span className="flex gap-1" aria-hidden>{[0, 1, 2].map((d) => <span key={d} style={{ width: 7, height: 7, borderRadius: 7, background: 'rgba(19,18,16,0.13)' }} />)}</span>
        <span aria-hidden style={{ width: 7, height: 7, background: CI_CORAL, flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: CI_CORAL, fontWeight: 600 }}>At-risk account</span>
        <span className="ml-auto px-2 py-0.5" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, color: CI_CORAL, borderRadius: 6, background: 'rgba(19,18,16,0.09)' }}>High risk</span>
      </div>
      <div className="p-5 lg:p-6">
        <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.5)' }}>What triggered it · QBR, today 9:12</p>
        <p className="mt-2" style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.3rem,2.4vw,1.6rem)', lineHeight: 1.18, letterSpacing: '-0.01em', color: '#131210' }}>"We're re-evaluating vendors before the renewal."</p>
        <p className="mt-2" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.45, color: '#4A463E' }}>Said by their VP of Ops, the economic buyer on the account.</p>
        <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${hairline}` }}>
          <p style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: accentInk, fontWeight: 600 }}>Recommended save-play</p>
          <ul className="mt-2 space-y-1.5">
            {['Get your founder on a call this week, before they shortlist.', 'Send the ROI recap built from their own usage data.'].map((t, i) => (
              <li key={i} className="flex gap-2.5" style={{ fontFamily: BODY_SERIF, fontSize: '14.5px', lineHeight: 1.4, color: '#4A463E' }}>
                <span aria-hidden style={{ marginTop: '0.6em', height: 1, width: 12, background: CI_CORAL, flexShrink: 0 }} /><span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-5" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.1em', color: 'rgba(19,18,16,0.5)' }}>Renewal in 38 days · flagged to you + CS lead</p>
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
      <p style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.5)' }}>{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
  const Check = ({ t }: { t: string }) => (
    <div className="flex items-center gap-2.5 py-1" style={{ fontFamily: BODY_SERIF, fontSize: '15px', color: '#131210' }}>
      <span style={{ color: sage, fontSize: '13px' }}>✓</span>{t}
    </div>
  );
  const Pill = ({ t }: { t: string }) => (
    <span className="inline-flex px-2.5 py-1 m-0.5" style={{ fontFamily: MONO, fontSize: '11px', color: '#4A463E', background: 'rgba(19,18,16,0.04)', borderRadius: CI_R_SM, border: `1px solid ${hairline}` }}>{t}</span>
  );
  return (
    <motion.div className="overflow-hidden" initial={reduce ? false : { opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.7, ease: EASE }}
      style={{ borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW_LG }}>
      <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ background: '#131210' }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 7, background: sage, flexShrink: 0 }} />
        <span style={{ fontFamily: MONO, fontSize: '10.5px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)' }}>Control panel · {companyName}</span>
        <span className="ml-auto" style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>you set the rules</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-10 gap-y-7 p-6 lg:p-8" style={{ background: CI_CARD }}>
        <Block label="Connected sources"><Check t="Fireflies" /><Check t="Zoom" /><Check t="Slack alerts" /></Block>
        <Block label="Calls tracked"><div className="-m-0.5"><Pill t="Sales demos" /><Pill t="Discovery" /><Pill t="Customer QBRs" /><Pill t="Support" /></div></Block>
        <Block label="Churn alerts go to"><Check t="You" /><Check t="CS lead" /><p className="mt-1.5" style={{ fontFamily: BODY_SERIF, fontSize: '13.5px', color: '#6B675E' }}>Threshold: High risk and above</p></Block>
        <Block label="Scoring rubric (editable)"><div className="-m-0.5"><Pill t="Discovery" /><Pill t="Objection handling" /><Pill t="Next steps" /><Pill t="Pricing" /></div></Block>
      </div>
    </motion.div>
  );
}

// Where the flags land — a Slack message mock (the churn alert pinged to your channel).
function CISlackAlert() {
  const reduce = useReducedMotion();
  // Slack dark-mode palette
  const BG = '#131210', LINE = 'rgba(255,255,255,0.09)', TXT = '#E4E5E6', MUT = 'rgba(228,229,230,0.45)';
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
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(19,18,16,0.16)', border: '1px solid rgba(19,18,16,0.4)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CIWaveform count={3} maxH={17} gap={2.5} barW={2.5} />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span style={{ fontFamily: BODY_SERIF, fontSize: '14.5px', fontWeight: 700, color: '#FFFFFF' }}>Call Intelligence</span>
            <span className="px-1.5 py-0.5" style={{ fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.08em', textTransform: 'uppercase', color: MUT, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>App</span>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: MUT }}>9:12 AM</span>
          </div>
          <p className="mt-1.5" style={{ fontFamily: BODY_SERIF, fontSize: '15.5px', lineHeight: 1.5, color: TXT }}>
            <span style={{ color: '#131210', fontWeight: 600 }}>At-risk: Acme Co.</span> Their VP of Ops said “we’re re-evaluating vendors before the renewal” on today’s QBR. Renewal in 38 days.
          </p>
          <div className="mt-3 flex flex-wrap gap-2"><Btn t="Open account" /><Btn t="See save-play" /></div>
          <div className="mt-2.5 flex gap-1.5">
            {['👀 3', '🔥 2'].map((r) => <span key={r} className="px-2 py-0.5" style={{ fontFamily: MONO, fontSize: '11px', color: TXT, background: 'rgba(19,18,16,0.14)', border: '1px solid rgba(19,18,16,0.32)', borderRadius: 10 }}>{r}</span>)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// OPERATING-RECORD GRAMMAR (tournament winner — candidate C)
// Scoped document grammar for the two production layouts (ContentSystemReport +
// CallIntelReport). NOTHING here touches styles.css — every rule is scoped under
// `.bbrec`. Tokens are the Black Box canon (ink/red/paper/muted/secondary/hairline/
// flash). The single red per surface is `.cta-btn`; the wordmark's ON is exempt.
// Two boxes per surface only: the verdict box (tilt) and the CTA box (square), both
// with WARNING-pattern heads. Depicted product mocks keep native chrome and are
// framed as Fig · exhibits with Source Serif italic captions.
// ══════════════════════════════════════════════════════════════════════════════
const RECORD_CSS = `
.bbrec{
  --ink:#131210;--red:#C8361B;--paper:#FFFFFF;--muted:#6B675E;--sec:#4A463E;--hair:#C9C2B2;--flash:#E9E4D6;
  --grotesk:'Schibsted Grotesk',system-ui,-apple-system,sans-serif;
  --serif:'Source Serif 4',Georgia,serif;
  color:var(--ink);font-family:var(--grotesk);font-weight:400;line-height:1.5;
  font-variant-numeric:tabular-nums;background:var(--paper);overflow-x:hidden;
}
.bbrec .wrap{max-width:1180px;margin:0 auto;padding:0 clamp(20px,5vw,64px);}
.bbrec .num{font-variant-numeric:tabular-nums;}
/* register bars */
.bbrec .reg{border-bottom:1px solid var(--ink);position:sticky;top:0;z-index:40;background:var(--paper);}
.bbrec .reg-row{display:flex;align-items:center;justify-content:space-between;gap:12px 20px;padding:clamp(13px,2vw,17px) 0;flex-wrap:wrap;}
.bbrec .reg-meta{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:clamp(9px,1vw,11px);color:var(--sec);}
.bbrec .reg-right{display:flex;align-items:center;gap:16px;}
.bbrec .btn-ink{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:11px;color:var(--paper);background:var(--ink);padding:9px 16px;text-decoration:none;white-space:nowrap;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:8px;}
/* docline */
.bbrec .docline{display:flex;align-items:center;gap:12px;padding-top:clamp(28px,5vw,52px);font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:clamp(9px,1.1vw,11px);color:var(--sec);flex-wrap:wrap;}
.bbrec .sq{width:9px;height:9px;background:var(--ink);flex-shrink:0;}
.bbrec .docline .rule{flex:1;height:1px;background:var(--hair);min-width:24px;}
/* data plate */
.bbrec .plate{margin-top:clamp(18px,2.6vw,26px);border:1px solid var(--ink);}
.bbrec .plate-grid{display:grid;grid-template-columns:repeat(3,1fr);}
.bbrec .cell{padding:clamp(12px,1.7vw,17px) clamp(13px,1.7vw,19px);border-right:1px solid var(--hair);border-bottom:1px solid var(--hair);}
.bbrec .plate-grid .cell:nth-child(3n){border-right:none;}
.bbrec .plate-grid .cell:nth-child(n+4){border-bottom:none;}
.bbrec .k{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--muted);}
.bbrec .v{font-family:var(--grotesk);font-weight:500;letter-spacing:-0.01em;font-size:clamp(14px,1.7vw,17px);margin-top:6px;color:var(--ink);line-height:1.2;}
@media(max-width:720px){.bbrec .plate-grid{grid-template-columns:1fr 1fr;}.bbrec .plate-grid .cell{border-right:1px solid var(--hair);border-bottom:1px solid var(--hair);}.bbrec .plate-grid .cell:nth-child(2n){border-right:none;}}
@media(max-width:430px){.bbrec .plate-grid .cell{padding:10px 11px;}.bbrec .v{font-size:13px;}}
/* fold */
.bbrec .fold{padding-top:clamp(34px,6vw,60px);display:grid;grid-template-columns:1.5fr 0.5fr;gap:clamp(26px,5vw,56px);align-items:end;}
@media(max-width:820px){.bbrec .fold{grid-template-columns:1fr;gap:26px;align-items:start;}}
.bbrec .company{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.035em;font-size:clamp(38px,8vw,86px);line-height:0.92;color:var(--ink);}
.bbrec .lede{font-family:var(--serif);font-weight:400;font-size:clamp(16px,1.5vw,19px);line-height:1.5;color:var(--sec);max-width:40ch;margin-top:clamp(16px,2vw,22px);}
.bbrec .reading{border:1px solid var(--ink);padding:clamp(15px,2vw,20px);}
.bbrec .reading .rk{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--muted);}
.bbrec .reading .rn{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.035em;font-size:clamp(40px,6vw,58px);line-height:0.9;margin-top:6px;color:var(--ink);}
.bbrec .reading .rd{font-family:var(--serif);font-style:italic;font-weight:400;font-size:14px;line-height:1.4;color:var(--muted);margin-top:10px;}
.bbrec .reading .rrow{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--hair);margin-top:12px;padding-top:10px;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;font-size:10px;color:var(--sec);}
/* THE BOX */
.bbrec .boxwrap{padding-top:clamp(34px,5vw,58px);}
.bbrec .box{border:4px solid var(--ink);outline:1px solid var(--ink);outline-offset:3px;background:var(--paper);padding:clamp(20px,3vw,34px) clamp(20px,3vw,36px) clamp(24px,3.4vw,38px);}
.bbrec .box.tilt{transform:rotate(-0.6deg);}
.bbrec .box-head{display:flex;align-items:center;gap:12px;padding-bottom:clamp(13px,1.8vw,17px);border-bottom:2px solid var(--ink);}
.bbrec .box-head .sqbig{width:17px;height:17px;background:var(--ink);flex-shrink:0;}
.bbrec .box-head .lbl{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:clamp(11px,1.5vw,14px);line-height:1.25;color:var(--ink);}
.bbrec .box-body{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.03em;font-size:clamp(24px,3.6vw,40px);line-height:1.05;margin-top:clamp(16px,2.2vw,22px);color:var(--ink);}
.bbrec .box-note{font-family:var(--serif);font-style:italic;font-weight:400;font-size:clamp(14px,1.4vw,17px);line-height:1.5;color:var(--sec);margin-top:clamp(14px,1.8vw,18px);max-width:62ch;}
/* AS-FOUND / PROJECTED table */
.bbrec .afp{margin-top:clamp(18px,2.4vw,24px);border-top:1px solid var(--ink);}
.bbrec .afp-h,.bbrec .afp-r{display:grid;grid-template-columns:1.1fr 1fr 1.1fr;gap:clamp(10px,1.6vw,22px);}
.bbrec .afp-h>span{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--muted);padding:10px 0;border-bottom:1px solid var(--hair);}
.bbrec .afp-r{padding:clamp(12px,1.6vw,15px) 0;border-bottom:1px solid var(--hair);align-items:baseline;}
.bbrec .afp-r:last-child{border-bottom:1px solid var(--ink);}
.bbrec .afp-p{font-family:var(--grotesk);font-weight:500;font-size:clamp(13px,1.5vw,15px);letter-spacing:-0.01em;line-height:1.2;color:var(--ink);}
.bbrec .afp-f{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.02em;font-size:clamp(15px,1.8vw,20px);line-height:1.05;color:var(--ink);}
.bbrec .afp-open{font-family:var(--serif);font-style:italic;font-weight:400;font-size:clamp(13px,1.5vw,15px);color:var(--muted);line-height:1.3;}
.bbrec .afp-v{font-family:var(--grotesk);font-weight:500;font-size:clamp(13px,1.5vw,15px);line-height:1.25;letter-spacing:-0.01em;color:var(--ink);}
@media(max-width:640px){.bbrec .afp-h{display:none;}.bbrec .afp-r{grid-template-columns:1fr;gap:4px;padding:16px 0;}.bbrec .afp-p{font-size:15px;}.bbrec .afp-r>.afp-f::before,.bbrec .afp-r>.afp-open::before,.bbrec .afp-r>.afp-v::before{content:attr(data-l);display:block;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:9px;color:var(--muted);margin-top:8px;margin-bottom:2px;}}
/* section scaffold */
.bbrec .sec{padding-top:clamp(52px,8vw,94px);}
.bbrec .sec-label{display:flex;align-items:center;gap:10px;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:clamp(9px,1.1vw,11px);color:var(--muted);flex-wrap:wrap;}
.bbrec .sec-label .sq{width:8px;height:8px;}
.bbrec .sec-title{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.035em;font-size:clamp(34px,4.6vw,48px);line-height:1.0;margin-top:14px;max-width:24ch;color:var(--ink);}
.bbrec .sec-note{font-family:var(--serif);font-weight:400;font-size:clamp(15px,1.4vw,18px);line-height:1.5;color:var(--sec);max-width:58ch;margin-top:clamp(14px,1.6vw,18px);}
.bbrec .cl{font-family:var(--serif);font-style:italic;font-weight:400;color:var(--ink);}
/* ledger */
.bbrec .ledger{margin-top:clamp(28px,3.4vw,42px);border-top:1px solid var(--ink);}
.bbrec .lrow{display:grid;grid-template-columns:132px 1fr;gap:clamp(16px,2.4vw,34px);padding:clamp(20px,2.8vw,30px) 0;border-bottom:1px solid var(--hair);}
.bbrec .lrow:last-child{border-bottom:1px solid var(--ink);}
.bbrec .lidx{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.02em;font-size:clamp(22px,2.6vw,30px);line-height:1;color:var(--ink);}
.bbrec .ldate{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--muted);margin-top:8px;}
.bbrec .lobs{font-family:var(--grotesk);font-weight:500;letter-spacing:-0.012em;font-size:clamp(17px,2vw,22px);line-height:1.28;color:var(--ink);}
.bbrec .lbuild{margin-top:14px;padding-top:12px;border-top:1px solid var(--hair);display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:baseline;}
.bbrec .lbuild .bl{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--muted);white-space:nowrap;}
.bbrec .lbuild .bt{font-family:var(--serif);font-weight:400;font-size:clamp(14px,1.4vw,16px);line-height:1.5;color:var(--sec);}
.bbrec .lrow.open .lobs{font-family:var(--serif);font-style:italic;font-weight:400;color:var(--muted);font-size:clamp(15px,1.5vw,17px);}
@media(max-width:620px){.bbrec .lrow{grid-template-columns:1fr;gap:12px;}.bbrec .lmeta{display:flex;align-items:baseline;gap:14px;}.bbrec .lmeta .ldate{margin-top:0;}}
/* figures / exhibits */
.bbrec .figlabel{display:flex;align-items:center;gap:10px;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--muted);margin-bottom:14px;flex-wrap:wrap;}
.bbrec .figlabel .sq{width:7px;height:7px;}
.bbrec .figframe{border:1px solid var(--hair);padding:clamp(12px,1.6vw,18px);background:var(--paper);}
.bbrec .cap{font-family:var(--serif);font-style:italic;font-weight:400;font-size:clamp(14.5px,1.45vw,16px);line-height:1.5;color:var(--sec);margin-top:14px;max-width:58ch;}
/* lead-magnet exhibit */
/* voice provenance pairing */
.bbrec .vpair{margin-top:clamp(24px,3vw,34px);border-top:1px solid var(--ink);border-bottom:1px solid var(--ink);display:grid;grid-template-columns:1fr auto 1fr;align-items:stretch;}
.bbrec .vpair .vcell{padding:clamp(16px,2.2vw,24px) clamp(16px,2.2vw,26px) clamp(18px,2.4vw,26px) 0;}
.bbrec .vpair .vcell:last-child{padding-left:clamp(16px,2.2vw,26px);padding-right:0;}
.bbrec .vpair .vlink{display:flex;align-items:center;justify-content:center;padding:0 clamp(10px,1.6vw,18px);border-left:1px solid var(--hair);border-right:1px solid var(--hair);font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;font-size:9.5px;color:var(--muted);white-space:nowrap;}
.bbrec .vpair .vq{font-family:var(--serif);font-style:italic;font-weight:400;font-size:clamp(17px,2.1vw,23px);line-height:1.45;color:var(--sec);margin-top:10px;}
.bbrec .vpair .vd{font-family:var(--grotesk);font-weight:600;letter-spacing:-0.018em;font-size:clamp(17px,2.1vw,23px);line-height:1.32;color:var(--ink);margin-top:10px;}
@media(max-width:640px){.bbrec .vpair{grid-template-columns:1fr;}.bbrec .vpair .vcell{padding:clamp(14px,2.2vw,20px) 0;}.bbrec .vpair .vcell:last-child{padding-left:0;}.bbrec .vpair .vlink{justify-content:flex-start;border-left:none;border-right:none;border-top:1px solid var(--hair);border-bottom:1px solid var(--hair);padding:9px 0;}}
.bbrec .lm{margin-top:clamp(26px,3.2vw,40px);display:grid;grid-template-columns:300px 1fr;gap:clamp(26px,4vw,52px);align-items:center;}
@media(max-width:760px){.bbrec .lm{grid-template-columns:1fr;gap:26px;}}
.bbrec .lm-cover{border:1px solid var(--hair);background:#0e0e12;min-height:180px;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.bbrec .lm-cover img{width:100%;display:block;}
.bbrec .lm-title{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.03em;font-size:clamp(24px,3vw,34px);line-height:1.05;color:var(--ink);}
.bbrec .lm-promise{font-family:var(--serif);font-weight:400;font-size:clamp(16px,1.5vw,18px);line-height:1.5;color:var(--sec);margin-top:14px;max-width:46ch;}
.bbrec .inside{margin-top:22px;border-top:1px solid var(--hair);}
.bbrec .inside .ir{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:baseline;padding:11px 0;border-bottom:1px solid var(--hair);}
.bbrec .inside .ir:last-child{border-bottom:none;}
.bbrec .inside .ii{font-family:var(--grotesk);font-weight:700;font-size:11px;color:var(--muted);letter-spacing:0.04em;}
.bbrec .inside .it{font-family:var(--grotesk);font-weight:500;font-size:clamp(14px,1.5vw,16px);letter-spacing:-0.01em;color:var(--ink);}
.bbrec .lm-gate{margin-top:20px;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;font-size:10px;color:var(--sec);display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
/* embedded-LM exhibit masthead — cover plate beside the branded title band (sharp, hairline, no shadow/radius) */
.bbrec .lm-frame{display:grid;grid-template-columns:200px 1fr;gap:clamp(20px,3vw,40px);align-items:start;border-top:1px solid var(--ink);border-bottom:1px solid var(--hair);padding:clamp(18px,2.4vw,26px) 0;}
.bbrec .lm-frame-cover{border:1px solid var(--ink);background:#0e0e12;overflow:hidden;align-self:start;}
.bbrec .lm-frame-cover img{display:block;width:100%;}
.bbrec .lm-frame-body{min-width:0;}
@media(max-width:640px){.bbrec .lm-frame{grid-template-columns:1fr;gap:16px;}.bbrec .lm-frame-cover{max-width:220px;}}
/* governance strip */
.bbrec .gov{margin-top:clamp(24px,3vw,34px);display:flex;flex-wrap:wrap;gap:10px 26px;}
.bbrec .gov span{display:flex;align-items:center;gap:9px;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.04em;font-size:10px;color:var(--sec);}
.bbrec .gov .sq{width:6px;height:6px;flex-shrink:0;}
/* commissioning record */
.bbrec .kyle{margin-top:clamp(26px,3.2vw,40px);border:1px solid var(--ink);}
.bbrec .kyle-h{display:grid;grid-template-columns:1fr auto auto;gap:clamp(12px,2vw,26px);align-items:baseline;padding:clamp(16px,2.2vw,24px);border-bottom:1px solid var(--hair);}
@media(max-width:600px){.bbrec .kyle-h{grid-template-columns:1fr;gap:14px;}}
.bbrec .kyle-p{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:11px;color:var(--muted);align-self:center;}
.bbrec .kyle-af{font-family:var(--grotesk);font-weight:500;font-size:clamp(20px,2.4vw,28px);letter-spacing:-0.02em;color:var(--muted);}
.bbrec .kyle-al{font-family:var(--grotesk);font-weight:800;font-size:clamp(30px,4.4vw,52px);letter-spacing:-0.035em;line-height:0.9;color:var(--ink);}
.bbrec .kyle-al small{font-family:var(--grotesk);font-weight:700;font-size:0.34em;letter-spacing:0.02em;color:var(--muted);}
.bbrec .kyle-q{padding:clamp(16px,2.2vw,24px);font-family:var(--serif);font-style:italic;font-weight:400;font-size:clamp(16px,1.7vw,20px);line-height:1.45;color:var(--ink);}
.bbrec .kyle-q .who{display:block;font-style:normal;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--muted);margin-top:12px;}
.bbrec .kmet{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--hair);}
.bbrec .kmet .m{padding:clamp(14px,2vw,20px) clamp(14px,2vw,22px);border-right:1px solid var(--hair);}
.bbrec .kmet .m:last-child{border-right:none;}
.bbrec .kmet .mv{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.03em;font-size:clamp(22px,2.8vw,34px);line-height:1;color:var(--ink);}
.bbrec .kmet .ml{font-family:var(--serif);font-style:italic;font-weight:400;font-size:14.5px;line-height:1.4;color:var(--muted);margin-top:8px;}
@media(max-width:560px){.bbrec .kmet{grid-template-columns:1fr;}.bbrec .kmet .m{border-right:none;border-bottom:1px solid var(--hair);}.bbrec .kmet .m:last-child{border-bottom:none;}}
/* proof exhibits — two BIG stacked client records (content_system only) */
.bbrec .pf{margin-top:clamp(26px,3.2vw,40px);border:1px solid var(--ink);}
.bbrec .pf-top{display:grid;grid-template-columns:auto 1fr;gap:clamp(18px,3vw,44px);align-items:end;padding:clamp(18px,2.6vw,28px);border-bottom:1px solid var(--hair);}
@media(max-width:640px){.bbrec .pf-top{grid-template-columns:1fr;align-items:start;}}
.bbrec .pf-faces{display:flex;gap:10px;align-items:flex-start;}
.bbrec .pf-face{position:relative;width:clamp(104px,13vw,148px);flex-shrink:0;}
.bbrec .pf-face img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;object-position:50% 18%;border:1px solid var(--ink);background:var(--paper);}
.bbrec .pf-face .nm{position:absolute;left:6px;bottom:6px;background:var(--ink);color:#fff;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.07em;font-size:8.5px;padding:3px 6px;white-space:nowrap;}
.bbrec .pf-figwrap{min-width:0;}
.bbrec .pf-figk{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:11px;color:var(--muted);}
.bbrec .pf-fig{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.035em;font-size:clamp(34px,6.2vw,72px);line-height:0.95;color:var(--ink);margin-top:10px;}
.bbrec .pf-fig .from{font-weight:500;color:var(--muted);}
.bbrec .pf-quote{padding:clamp(18px,2.6vw,30px) clamp(18px,2.6vw,28px);font-family:var(--serif);font-style:italic;font-weight:400;font-size:clamp(19px,2.6vw,29px);line-height:1.4;color:var(--ink);border-bottom:1px solid var(--hair);}
.bbrec .pf-quote .who{display:block;font-style:normal;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--muted);margin-top:14px;}
.bbrec .pf-sample{margin:0;background:var(--paper);}
.bbrec .pf-sample img{display:block;width:100%;height:auto;}
.bbrec .pf-cap{padding:12px clamp(18px,2.6vw,28px) clamp(16px,2.2vw,22px);font-family:var(--serif);font-style:italic;font-weight:400;font-size:clamp(14.5px,1.45vw,16px);line-height:1.5;color:var(--sec);border-top:1px solid var(--hair);}
/* reported outcomes (static ruled grid — replaces the marquee) */
.bbrec .revs{margin-top:clamp(24px,3vw,36px);border-top:1px solid var(--ink);}
.bbrec .rev{display:grid;grid-template-columns:1fr 200px;gap:clamp(14px,2.4vw,32px);padding:clamp(16px,2.2vw,22px) 0;border-bottom:1px solid var(--hair);align-items:baseline;}
.bbrec .rev:last-child{border-bottom:1px solid var(--ink);}
.bbrec .rev-q{font-family:var(--serif);font-weight:400;font-size:clamp(15px,1.6vw,18px);line-height:1.5;color:var(--ink);}
.bbrec .rev-w{font-family:var(--grotesk);font-weight:700;font-size:12px;color:var(--ink);}
.bbrec .rev-w small{display:block;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;font-size:9.5px;color:var(--muted);margin-top:4px;}
@media(max-width:640px){.bbrec .rev{grid-template-columns:1fr;gap:8px;}}
/* pillar table — inside THE BOX (content_system only). Pillar names are anchor links. */
.bbrec .ptab{margin-top:clamp(18px,2.4vw,24px);border-top:1px solid var(--ink);}
.bbrec .ptab-h,.bbrec .ptab-r{display:grid;grid-template-columns:0.62fr 1.19fr 1.19fr;gap:clamp(10px,1.6vw,22px);}
.bbrec .ptab-h>span{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--muted);padding:10px 0;border-bottom:1px solid var(--hair);}
.bbrec .ptab-r{padding:clamp(12px,1.6vw,16px) 0;border-bottom:1px solid var(--hair);align-items:baseline;}
.bbrec .ptab-r:last-child{border-bottom:1px solid var(--ink);}
.bbrec .ptab-a{font-family:var(--grotesk);font-weight:800;letter-spacing:0.01em;font-size:clamp(12px,1.5vw,15px);line-height:1.2;text-transform:uppercase;color:var(--ink);text-decoration:none;border-bottom:2px solid var(--ink);padding-bottom:2px;display:inline-block;}
.bbrec .ptab-a:hover{color:var(--sec);border-color:var(--sec);}
.bbrec .ptab-f{font-family:var(--grotesk);font-weight:500;font-size:clamp(13px,1.5vw,15.5px);line-height:1.35;letter-spacing:-0.01em;color:var(--ink);}
.bbrec .ptab-v{font-family:var(--serif);font-weight:400;font-size:clamp(13px,1.5vw,15.5px);line-height:1.4;color:var(--sec);}
@media(max-width:640px){.bbrec .ptab-h{display:none;}.bbrec .ptab-r{grid-template-columns:1fr;gap:4px;padding:16px 0;}.bbrec .ptab-r>.ptab-f::before,.bbrec .ptab-r>.ptab-v::before{content:attr(data-l);display:block;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10.5px;color:var(--muted);margin-top:8px;margin-bottom:2px;}}
/* chapter CTA row — one line + the ink button, closing each chapter (content_system only) */
.bbrec .chcta{margin-top:clamp(26px,3.2vw,40px);padding-top:clamp(18px,2.2vw,26px);border-top:1px solid var(--ink);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px 24px;}
.bbrec .chcta p{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.02em;font-size:clamp(17px,2.2vw,22px);line-height:1.2;color:var(--ink);max-width:34ch;margin:0;}
.bbrec .promises{margin-top:clamp(22px,2.8vw,34px);display:grid;grid-template-columns:repeat(2,1fr);border-top:1px solid var(--hair);border-left:1px solid var(--hair);}
@media(max-width:640px){.bbrec .promises{grid-template-columns:1fr;}}
.bbrec .pcell{padding:clamp(16px,2.2vw,22px);border-right:1px solid var(--hair);border-bottom:1px solid var(--hair);}
.bbrec .promises .pcell:nth-child(2n){border-right:none;}
@media(max-width:640px){.bbrec .pcell{border-right:none;}}
.bbrec .ph{font-family:var(--grotesk);font-weight:700;font-size:clamp(15px,1.7vw,18px);letter-spacing:-0.01em;color:var(--ink);}
.bbrec .pb{font-family:var(--serif);font-weight:400;font-size:clamp(14px,1.4vw,15.5px);line-height:1.5;color:var(--sec);margin-top:8px;}
/* audience room read (content_system only) — counted figures, ruled rows, named-buyer cells */
.bbrec .aud-top{margin-top:clamp(22px,2.8vw,34px);}
.bbrec .aud-sub{font-family:var(--serif);font-weight:400;font-size:clamp(15px,1.6vw,18px);line-height:1.5;color:var(--sec);margin-top:12px;max-width:52ch;}
.bbrec .aud-rows{margin-top:clamp(22px,2.8vw,32px);border-top:1px solid var(--ink);}
.bbrec .aud-row{display:grid;grid-template-columns:170px 1fr;gap:clamp(14px,2.4vw,32px);padding:clamp(14px,2vw,20px) 0;border-bottom:1px solid var(--hair);align-items:baseline;}
.bbrec .aud-row:last-child{border-bottom:1px solid var(--ink);}
.bbrec .aud-row .ak{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--muted);}
.bbrec .aud-row p{font-family:var(--serif);font-weight:400;font-size:clamp(15px,1.6vw,18px);line-height:1.5;color:var(--ink);margin:0;}
@media(max-width:640px){.bbrec .aud-row{grid-template-columns:1fr;gap:6px;}}
.bbrec .aud-names{margin-top:clamp(18px,2.4vw,26px);display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));border-top:1px solid var(--hair);border-left:1px solid var(--hair);}
.bbrec .aud-name{padding:clamp(14px,2vw,18px);border-right:1px solid var(--hair);border-bottom:1px solid var(--hair);}
.bbrec .aud-name .anm{font-family:var(--grotesk);font-weight:700;font-size:clamp(14px,1.6vw,16px);letter-spacing:-0.01em;color:var(--ink);}
.bbrec .aud-name .ahl{font-family:var(--serif);font-weight:400;font-size:clamp(13px,1.35vw,14.5px);line-height:1.45;color:var(--sec);margin-top:6px;}
.bbrec .aud-name .asrc{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:9.5px;color:var(--muted);margin-top:10px;}
.bbrec .aud-scale{margin-top:clamp(18px,2.4vw,26px);display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--hair);border-left:1px solid var(--hair);}
@media(max-width:640px){.bbrec .aud-scale{grid-template-columns:1fr;}}
.bbrec .aud-band{padding:clamp(12px,1.8vw,16px);border-right:1px solid var(--hair);border-bottom:1px solid var(--hair);}
.bbrec .aud-band.on{background:var(--flash);}
.bbrec .aud-band .abr{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.01em;font-size:clamp(14px,1.6vw,16px);color:var(--ink);}
.bbrec .aud-band .abw{font-family:var(--serif);font-weight:400;font-size:clamp(14px,1.4vw,15px);line-height:1.4;color:var(--sec);margin-top:4px;}
.bbrec .aud-band .abys{font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:9.5px;color:var(--ink);margin-top:8px;}
/* operator block */
.bbrec .operator{margin-top:clamp(28px,3.4vw,44px);display:grid;grid-template-columns:150px 1fr;gap:clamp(22px,3.4vw,44px);align-items:start;border-top:1px solid var(--ink);padding-top:clamp(26px,3.2vw,40px);}
@media(max-width:600px){.bbrec .operator{grid-template-columns:1fr;gap:22px;}}
.bbrec .op-portrait{border:1px solid var(--ink);background:var(--flash);}
.bbrec .op-portrait img{width:100%;display:block;filter:grayscale(100%) contrast(1.02);}
.bbrec .op-h{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.03em;font-size:clamp(22px,3vw,36px);line-height:1.08;color:var(--ink);}
.bbrec .op-b{font-family:var(--serif);font-weight:400;font-size:clamp(16px,1.5vw,18px);line-height:1.55;color:var(--sec);margin-top:16px;max-width:56ch;}
.bbrec .op-sig{margin-top:18px;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--sec);display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.bbrec .op-sig a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--hair);}
/* final CTA box (RED lives here) */
.bbrec .ctawrap{padding-top:clamp(52px,8vw,90px);padding-bottom:clamp(40px,6vw,70px);}
.bbrec .box.cta{padding:clamp(30px,5vw,56px);text-align:center;}
.bbrec .cta-h{font-family:var(--grotesk);font-weight:800;letter-spacing:-0.035em;font-size:clamp(34px,4.8vw,52px);line-height:1.0;max-width:20ch;margin:0 auto;color:var(--ink);}
.bbrec .cta-n{font-family:var(--serif);font-weight:400;font-size:clamp(16px,1.6vw,18px);line-height:1.5;color:var(--sec);max-width:46ch;margin:clamp(16px,2vw,20px) auto 0;}
.bbrec .cta-btn{display:inline-flex;align-items:center;gap:10px;margin-top:clamp(22px,3vw,30px);background:var(--red);color:var(--paper);font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:clamp(13px,1.5vw,15px);padding:16px 30px;text-decoration:none;}
.bbrec .cta-fine{margin-top:16px;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;color:var(--muted);}
/* footer */
.bbrec .foot{border-top:1px solid var(--ink);margin-top:clamp(40px,6vw,70px);}
.bbrec .foot-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;padding:clamp(22px,3vw,34px) 0 12px;}
.bbrec .foot-links{display:flex;align-items:center;gap:22px;font-family:var(--grotesk);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;font-size:10px;}
.bbrec .foot-links a{text-decoration:none;color:var(--sec);}
.bbrec .foot-links a.book{color:var(--ink);}
.bbrec .foot-fine{padding-bottom:clamp(40px,6vw,60px);font-family:var(--serif);font-style:italic;font-weight:400;font-size:13px;color:var(--muted);}
/* ── mobile readability floor (scoped; lifts the smallest labels/captions to ~11px so nothing sits below the mobile floor; desktop sizes untouched) ── */
@media(max-width:640px){
  .bbrec .sec-label,.bbrec .reg-meta,.bbrec .docline{font-size:11px;line-height:1.35;}
  .bbrec .k,.bbrec .lm-gate,.bbrec .who,.bbrec .ldate,.bbrec .figlabel,.bbrec .lbuild .bl,.bbrec .gov span,.bbrec .op-sig,.bbrec .reading .rk,.bbrec .reading .rrow,.bbrec .foot-links,.bbrec .foot-links a,.bbrec .cta-fine,.bbrec .afp-h>span,.bbrec .inside .ii,.bbrec .kyle-p,.bbrec .aud-row .ak,.bbrec .aud-name .asrc{font-size:11px;line-height:1.35;}
  .bbrec .vpair .vlink,.bbrec .rev-w small{font-size:11px;}
  .bbrec .pf-face .nm{font-size:10px;}
  .bbrec .pf-figk{font-size:11px;}
  .bbrec .afp-r>.afp-f::before,.bbrec .afp-r>.afp-open::before,.bbrec .afp-r>.afp-v::before{font-size:10.5px;}
  /* small serif italic captions: hold the floor and open the leading */
  .bbrec .cap,.bbrec .kmet .ml,.bbrec .foot-fine{font-size:13px;line-height:1.5;}
  .bbrec .reading .rd{font-size:14px;line-height:1.5;}
}
`;

// One-time reveal per section — the canon motion: rise ≤26px + fade, ~0.7s, once. Settled
// under reduced motion. Replaces candidate C's CSS .reveal so it obeys useReducedMotion.
const Rev: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties; el?: 'div' | 'section'; id?: string }> = ({ children, className, style, el = 'div', id }) => {
  const reduce = useReducedMotion();
  const M = el === 'section' ? motion.section : motion.div;
  return (
    <M
      id={id}
      className={className}
      style={style}
      initial={reduce ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      {children}
    </M>
  );
};

const RecordStyles: React.FC = () => <style dangerouslySetInnerHTML={{ __html: RECORD_CSS }} />;

// Administrative document line: square · doc-type · scan date — rule — reference.
const Docline: React.FC<{ docType: string; date: string; refLabel: string }> = ({ docType, date, refLabel }) => (
  <div className="docline">
    <span className="sq" aria-hidden />
    <span>{docType}&nbsp;·&nbsp;{date}</span>
    <span className="rule" aria-hidden />
    <span>Ref&nbsp;&nbsp;{refLabel}</span>
  </div>
);

// ISO-7200 data plate — the admin title block, ruled cells with clinical field labels.
const DataPlate: React.FC<{ cells: { k: string; v: React.ReactNode }[] }> = ({ cells }) => (
  <div className="plate">
    <div className="plate-grid">
      {cells.map((c, i) => (
        <div className="cell" key={i}>
          <div className="k">{c.k}</div>
          <div className="v">{c.v}</div>
        </div>
      ))}
    </div>
  </div>
);

// Numbered section head — clinical label + straight display title (no serif italic in heads).
const SecHead: React.FC<{ label: React.ReactNode; title: React.ReactNode; note?: React.ReactNode }> = ({ label, title, note }) => (
  <>
    <div className="sec-label"><span className="sq" aria-hidden /> {label}</div>
    <h2 className="sec-title">{title}</h2>
    {note ? <p className="sec-note">{note}</p> : null}
  </>
);

// Lettered exhibit caption — Source Serif italic specimen line citing the real source.
const FigLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="figlabel"><span className="sq" aria-hidden /> {children}</div>
);

// A depicted artifact (native chrome kept) framed as a Fig · exhibit with an italic caption.
const Exhibit: React.FC<{ label: React.ReactNode; caption?: React.ReactNode; children: React.ReactNode }> = ({ label, caption, children }) => (
  <div>
    <FigLabel>{label}</FigLabel>
    <div className="figframe">{children}</div>
    {caption ? <p className="cap">{caption}</p> : null}
  </div>
);

// Date helpers — every displayed date derives from the scan's own created/completed stamp.
const recDateISO = (s: string | null | undefined, fallback?: string | null) => {
  const d = new Date(s ?? fallback ?? Date.now());
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};
const recDatePlusDaysISO = (s: string | null | undefined, days: number, fallback?: string | null) => {
  const d = new Date(s ?? fallback ?? Date.now());
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

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

  // ── Derived, honest figures (numbers trace to report_json / scan stamps) ──
  const scanDate = recDateISO(scan.completed_at, scan.created_at);
  const volRaw = (ci.volume_estimate?.value || '').trim();
  const volNum = (volRaw.match(/[\d][\d,]*/) || [])[0] || '';
  const volBasis = (ci.volume_estimate?.basis || '').trim();
  const leaks = (ci.leaking_signals ?? []).slice(0, 3);
  const cleanDomain = (scan.domain || companyName || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const WARN: Record<CallIntel['archetype'], { effect: string; verdict: string }> = {
    sales_demo_driven:   { effect: 'WARNING: DEALS LOST UNEXAMINED', verdict: 'The calls happen. Nobody reviews what lost the deal.' },
    cs_retention_driven: { effect: 'WARNING: CHURN SEEN TOO LATE', verdict: 'The customer says it on the call. You hear it at renewal.' },
    intake_driven:       { effect: 'WARNING: GOOD CASES SLIP AWAY', verdict: 'The right cases call in. Most are never looked at twice.' },
  };
  const warn = WARN[ci.archetype] ?? WARN.sales_demo_driven;
  const reading = volNum
    ? { open: false, k: 'As found · call volume', n: volNum, d: `${volBasis || 'calls a month'}, with no record of what happens on them.` }
    : { open: true, k: 'As found', n: '[ open ]', d: 'call volume not on record yet. The cell is ruled and left open.' };
  // ProvalTech case-study stat tiles — copy is a PLACEHOLDER per code comment; kept verbatim, given quiet body treatment (no figure-plate certification).
  const provalStats = [
    { v: '+$20K', label: 'a month in new revenue', sub: 'from the calls they already ran' }, // PLACEHOLDER: '+$20K/mo'
    { v: '+27%', label: 'close rate', sub: 'after coaching on flagged calls' },              // PLACEHOLDER: '+27%'
    { v: '20×', label: 'more calls reviewed', sub: '5% sampled by hand → 100% scored' },     // REAL
  ];
  const CI_REVIEWS = [
    { q: 'Working with Ivan has been an absolute game-changer. He exceeded all expectations and saved our team countless hours.', n: 'Camille Haas', r: 'Head of Operations' },
    { q: 'His solutions helped uncover opportunities we were missing, directly impacting our bottom line.', n: 'Rodrigo Ibañez', r: 'Managing Director' },
    { q: 'You see how he uses AI and immediately feel like you’ve been doing things the hard way. Walked away with a completely different approach.', n: 'Cristian Trif', r: 'Salesforce Consultant · 9 yrs' },
  ];

  return (
    <div className="bbrec min-h-screen" style={BLACKBOX_VARS}>
      <RecordStyles />
      <ScrollProgress />

      {/* ── TOP REGISTER ─────────────────────── */}
      <header className="reg">
        <div className="wrap reg-row">
          <Link to="/" aria-label="InboundOnSteroids" className="inline-flex items-center hover:opacity-80 transition-opacity"><Wordmark size={20} /></Link>
          <div className="reg-right">
            <span className="reg-meta hidden md:inline">Call Intelligence&nbsp;·&nbsp;Confidential to recipient</span>
            <a className="btn-ink" href={bookUrl} target="_blank" rel="noopener noreferrer">Book a call</a>
          </div>
        </div>
      </header>

      <main className="wrap">
        {/* ── DOCLINE ─────────────────────────── */}
        <Docline docType="Call Intelligence · Projected · Scanned" date={scanDate} refLabel={scan.company_slug} />

        {/* ── DATA PLATE ──────────────────────── */}
        <DataPlate cells={[
          { k: 'Prepared for', v: companyName },
          { k: 'Scanned', v: <>Public presence{cleanDomain ? <><br />{cleanDomain}</> : null}</> },
          { k: 'Scan date', v: <span className="num">{scanDate}</span> },
          { k: 'Operator of record', v: 'Ivan Manfredi' },
          { k: 'Measured in', v: 'Revenue from calls you already run' },
          { k: 'Scope', v: 'Every call transcribed, scored, routed' },
        ]} />

        {/* ── FOLD ────────────────────────────── */}
        <Rev el="section" className="fold">
          <div>
            <h1 className="company">{companyName}</h1>
            <p className="lede">{ci.thesis || 'The calls already happen. Today nothing keeps the record of what wins or loses on them.'}</p>
          </div>
          <div className="reading">
            <div className="rk">{reading.k}</div>
            <div className="rn num" style={reading.open ? { fontFamily: BODY_SERIF, fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(22px,3vw,30px)', color: MUTED } : undefined}>{reading.n}</div>
            <div className="rd">{reading.d}</div>
            <div className="rrow"><span>Scored today</span><span className="num">0</span></div>
            <div className="rrow"><span>Record kept</span><span>None</span></div>
          </div>
        </Rev>

        {/* ── VERDICT · THE BOX (1 of 2) ──────── */}
        <div className="boxwrap">
          <Rev className="box tilt">
            <div className="box-head">
              <span className="sqbig" aria-hidden />
              <span className="lbl">{warn.effect}</span>
            </div>
            <div className="box-body">{warn.verdict}</div>
            <div className="afp">
              <div className="afp-h">
                <span>Parameter</span>
                <span>As found · {scanDate}</span>
                <span>Projected · scored</span>
              </div>
              <div className="afp-r">
                <div className="afp-p">Calls reviewed</div>
                <div className="afp-open" data-l={`As found · ${scanDate}`}>[ open · none scored ]</div>
                <div className="afp-v" data-l="Projected · scored">Every call scored on your rubric</div>
              </div>
              <div className="afp-r">
                <div className="afp-p">Deal-loss reasons</div>
                <div className="afp-open" data-l={`As found · ${scanDate}`}>[ open · not on record ]</div>
                <div className="afp-v" data-l="Projected · scored">Flagged per call, coached next time</div>
              </div>
              <div className="afp-r">
                <div className="afp-p">At-risk accounts</div>
                <div className="afp-open" data-l={`As found · ${scanDate}`}>[ open · surfaces at renewal ]</div>
                <div className="afp-v" data-l="Projected · scored">Flagged the morning it happens</div>
              </div>
            </div>
            <p className="box-note">The readings above have no before-state to record: the cells are ruled and left open, because nothing scores those calls today. Everything below this line is the record the engine would keep instead.</p>
          </Rev>
        </div>

        {/* ── SECTION 03 · OBSERVATIONS LEDGER ── */}
        {leaks.length > 0 && (
          <Rev el="section" className="sec">
            <SecHead
              label={<>Section 03&nbsp;·&nbsp;Observations on record</>}
              title="What the scan read on your calls."
              note="Read from your public presence on the scan date."
            />
            <div className="ledger">
              {leaks.map((l, i) => (
                <div className="lrow" key={i}>
                  <div className="lmeta"><div className="lidx num">{String(i + 1).padStart(2, '0')}</div><div className="ldate">Observed {scanDate}</div></div>
                  <div>
                    <div className="lobs">{l.title}</div>
                    {l.detail ? <div className="lbuild"><span className="bl">→ Reading</span><span className="bt">{l.detail}</span></div> : null}
                  </div>
                </div>
              ))}
            </div>
            {receipts.length > 0 && (
              <p className="cap" style={{ marginTop: 20 }}>Read from your public presence today: {receipts.map((r, i) => <span key={i}>{i ? '  ·  ' : ''}{r.label}: {r.value}</span>)}</p>
            )}
          </Rev>
        )}

        {/* ── SECTION 04 · THE INSTRUMENT ─────── */}
        <Rev el="section" className="sec">
          <SecHead
            label={<>Section 04&nbsp;·&nbsp;The instrument</>}
            title={<>Every call in. The right output out.</>}
            note="Every call your team runs flows through one scoring engine, and comes back as something you can act on. The system keeps the record."
          />
          <div style={{ marginTop: 'clamp(26px,3.2vw,40px)' }}>
            <Exhibit label={<>Fig&nbsp;·&nbsp;system flow&nbsp;·&nbsp;calls in, four outputs out</>} caption="Schematic of the scoring engine. Calls are transcribed, scored on your rubric, and routed to the right place.">
              <CallIntelSystemFlow />
            </Exhibit>
          </div>
          <div className="grid gap-7 lg:grid-cols-2" style={{ marginTop: 'clamp(28px,3.4vw,44px)' }}>
            {surfaces.map((s, i) => (
              <div key={i} id={s === SURFACE_SALES ? 'ci-analysis' : 'ci-alert'} className="scroll-mt-24">
                <FigLabel>Fig&nbsp;·&nbsp;{s.tag}&nbsp;·&nbsp;{s === SURFACE_SALES ? 'scored call' : 'churn flag'}</FigLabel>
                <p className="ph" style={{ marginBottom: 12 }}>{s.head}</p>
                <div className="figframe" style={{ padding: 0 }}>{s === SURFACE_SALES ? <CICallAnalysis /> : <CIChurnAlert />}</div>
              </div>
            ))}
          </div>
          <div id="ci-alert-slack" className="scroll-mt-24" style={{ marginTop: 'clamp(28px,3.4vw,44px)' }}>
            <Exhibit label={<>Fig&nbsp;·&nbsp;where the flags land&nbsp;·&nbsp;your Slack</>} caption="The urgent ones ping you where you already work. No new dashboard to babysit.">
              <div style={{ maxWidth: 560 }}><CISlackAlert /></div>
            </Exhibit>
          </div>
          <div id="ci-digest" className="scroll-mt-24" style={{ marginTop: 'clamp(28px,3.4vw,44px)' }}>
            <Exhibit label={<>Fig&nbsp;·&nbsp;the weekly digest&nbsp;·&nbsp;every Monday</>} caption="One scroll, no meeting: the week's pattern, your reps ranked, the accounts at risk.">
              <CallIntelProductMock ci={ci} companyName={companyName} />
            </Exhibit>
          </div>
          <div id="ci-control" className="scroll-mt-24" style={{ marginTop: 'clamp(28px,3.4vw,44px)' }}>
            <Exhibit label={<>Fig&nbsp;·&nbsp;the control panel&nbsp;·&nbsp;you set the rules</>} caption="You set the rubric, the thresholds, and who gets pinged. The system runs the way you sell.">
              <CIControlPanel companyName={companyName} />
            </Exhibit>
          </div>
          <div className="promises" style={{ marginTop: 'clamp(28px,3.4vw,44px)' }}>
            {[
              { t: 'Rep performance', d: 'See who is improving and who is stalling, week over week.' },
              { t: 'Coverage gaps', d: 'Get flagged when calls or follow-ups slip through the cracks.' },
              { t: 'Objection library', d: 'The objections killing your deals, ranked by how often they land.' },
              { t: 'Competitor mentions', d: 'Know every time a prospect names a rival on a call.' },
              { t: 'Talk-time ratio', d: 'Catch reps talking when they should be listening.' },
              { t: 'New-rep ramp', d: 'Watch how fast new hires get to your best rep’s bar.' },
            ].map((f) => (
              <div className="pcell" key={f.t}><div className="ph">{f.t}</div><div className="pb">{f.d}</div></div>
            ))}
          </div>
        </Rev>

        {/* ── SECTION 05 · COMMISSIONING RECORD · PROVALTECH ── */}
        <Rev el="section" className="sec">
          <SecHead
            label={<>Section 05&nbsp;·&nbsp;Commissioning record · ProvalTech</>}
            title="How we turned ProvalTech's existing calls into $20K more a month."
            note="Same team. Same calls. We scored every one and coached each rep on what lost the deal. Close rate moved 27%."
          />
          {/* quiet stat cells — placeholder figures kept verbatim, no figure-plate certification */}
          <div className="kmet" style={{ marginTop: 'clamp(24px,3vw,36px)', borderTop: `1px solid ${HAIR}`, borderLeft: `1px solid ${HAIR}`, borderRight: `1px solid ${HAIR}`, borderBottom: `1px solid ${HAIR}` }}>
            {provalStats.map((s, i) => (
              <div className="m" key={i}><div className="mv num">{s.v}</div><div className="k" style={{ marginTop: 6 }}>{s.label}</div><div className="ml" style={{ marginTop: 4 }}>{s.sub}</div></div>
            ))}
          </div>
          <div style={{ marginTop: 'clamp(24px,3vw,36px)' }}>
            <Exhibit label={<>Fig&nbsp;·&nbsp;ProvalTech · call performance dashboard</>} caption="The live board: per-call scores, per-rep trends, flagged moments.">
              <div style={{ background: '#131210' }}>
                <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: '#131210' }}>
                  <span aria-hidden style={{ height: 7, width: 7, background: 'var(--color-accent)', flexShrink: 0 }} />
                  <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>ProvalTech · Call Performance Dashboard</span>
                </div>
                <img src="/cases/provaltech.png" alt="ProvalTech Call Performance Dashboard with per-call scores and trends" loading="lazy" onError={fallbackOnError} style={{ display: 'block', width: '100%', height: 'auto' }} />
              </div>
            </Exhibit>
          </div>
          <p className="cap" style={{ marginTop: 14, letterSpacing: '0.14em', textTransform: 'uppercase', fontStyle: 'normal', fontFamily: MONO, fontSize: 11 }}>STACK · Fireflies · Airtable · n8n · Claude</p>
        </Rev>

        {/* ── SECTION 06 · REPORTED OUTCOMES ──── */}
        <Rev el="section" className="sec">
          <SecHead
            label={<>Section 06&nbsp;·&nbsp;Reported outcomes</>}
            title={<>The kind of work people rehire for.</>}
          />
          <div className="kyle" style={{ marginTop: 'clamp(24px,3vw,36px)' }}>
            <div className="kyle-q">&ldquo;As a current Meta developer, ex-Amazon, very few things surprise me with AI. Ivan did. One conversation and I already had three things to implement in my workflow.&rdquo;<span className="who">Adeeb Mohammed · Software Engineer · ex-Amazon · Meta</span></div>
          </div>
          <div className="revs">
            {CI_REVIEWS.map((t, i) => (
              <div className="rev" key={i}>
                <div className="rev-q">&ldquo;{t.q}&rdquo;</div>
                <div className="rev-w">{t.n}<small>{t.r}</small></div>
              </div>
            ))}
          </div>
        </Rev>

        {/* ── OPERATOR OF RECORD ──────────────── */}
        <Rev el="section" className="sec">
          <div className="sec-label"><span className="sq" aria-hidden /> Operator of record</div>
          <div className="operator">
            <div className="op-portrait">
              <img src="/ivan-portrait-400.webp" alt="Ivan Manfredi" loading="lazy" onError={fallbackOnError} />
            </div>
            <div>
              <div className="op-h">I&rsquo;m Ivan. I build the systems agencies promise and never ship.</div>
              <p className="op-b">Call intelligence is the one I reach for most, because the money is always hiding in conversations nobody has time to review. I&rsquo;ll build yours, run it on your real calls first, and you&rsquo;ll see exactly what it catches before you commit to anything.</p>
              <div className="op-sig"><span className="sq" aria-hidden /> Iván Manfredi · operator · <a href="https://ivanmanfredi.com" target="_blank" rel="noopener noreferrer">ivanmanfredi.com</a></div>
            </div>
          </div>
        </Rev>

        {/* ── FINAL CTA · THE BOX (2 of 2, RED) ─ */}
        <div className="ctawrap">
          <Rev className="box cta">
            <div className="box-head" style={{ justifyContent: 'center' }}>
              <span className="sqbig" aria-hidden />
              <span className="lbl">WARNING: REVENUE LEFT ON THE CALL</span>
            </div>
            <div className="cta-h" style={{ marginTop: 'clamp(18px,2.4vw,26px)' }}>See it running on your calls.</div>
            <p className="cta-n">15 minutes. Bring a few of your real calls. I&rsquo;ll run them through the system live and show you what it scores, flags, and surfaces.</p>
            <a className="cta-btn" href={bookUrl} target="_blank" rel="noopener noreferrer">Book a call <span aria-hidden>→</span></a>
            <div className="cta-fine">No deck. A working demo.</div>
          </Rev>
        </div>
      </main>

      {/* ── FOOTER ──────────────────────────── */}
      <footer className="foot">
        <div className="wrap">
          <div className="foot-row">
            <Wordmark size={16} />
            <div className="foot-links">
              <a className="book" href={bookUrl} target="_blank" rel="noopener noreferrer">Book a call</a>
              <a href="https://ivanmanfredi.com" target="_blank" rel="noopener noreferrer">ivanmanfredi.com</a>
            </div>
          </div>
          <p className="foot-fine">Prepared for {companyName}. Built from a live scan of your public presence, scanned {scanDate}. The record above is projected; the open cells are honest.</p>
        </div>
      </footer>
    </div>
  );
}

// ── CONTENT SYSTEM REPORT ─────────────────────────────────────────────────────
// Rendered IN PLACE OF the generic report when matched_offer === 'content_system'.
// 2026-07-14 revamp: three pillar chapters (Content / Inbound / Warm outbound) under a
// hero WARNING box that carries the 3-row pillar table; big stacked proof exhibits;
// per-chapter CTA rows; final CTA box. v4 Black Box grammar, document metaphor demoted
// to seasoning. CallIntelReport keeps its own copy of everything.

type LmSim = { kind: string; accent?: string; seed: { aov: number; cogs: number; shipping: number; feePct: number; adSpend: number; roas: number } };

// An interactive SIMULATION of the prospect's lead magnet — the working calculator the
// system drafted from their posts, seeded with their own numbers and computed live, in
// their brand. No external page: it reads as their finished tool, right inside the scan.
function LmCalculatorSim({ sim }: { sim: LmSim }) {
  type SeedKey = 'aov' | 'cogs' | 'shipping' | 'feePct' | 'adSpend' | 'roas';
  const accent = sim.accent || '#2ea3f2';
  const [v, setV] = useState(sim.seed);
  const set = (k: SeedKey) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: Number(e.target.value) }));

  const feeCost = (v.feePct / 100) * v.aov;
  const margin = v.aov - v.cogs - v.shipping - feeCost;      // contribution margin / order
  const adPerOrder = v.roas > 0 ? v.aov / v.roas : 0;
  const profit = margin - adPerOrder;                        // true profit / order
  const breakEven = margin > 0 ? v.aov / margin : Infinity;  // ROAS where true profit = 0
  const orders = adPerOrder > 0 ? v.adSpend / adPerOrder : 0;
  const monthlyProfit = profit * orders;
  const underwater = profit < 0;

  const money = (n: number, dp = 2) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const money0 = (n: number) => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US');

  const fields: { k: SeedKey; label: string; min: number; max: number; step: number; fmt: (n: number) => string }[] = [
    { k: 'aov', label: 'Average order value', min: 20, max: 300, step: 1, fmt: (n) => '$' + n },
    { k: 'cogs', label: 'COGS per unit', min: 0, max: 200, step: 1, fmt: (n) => '$' + n },
    { k: 'shipping', label: 'Shipping & fulfilment', min: 0, max: 60, step: 1, fmt: (n) => '$' + n },
    { k: 'feePct', label: 'Payment fee', min: 0, max: 8, step: 0.1, fmt: (n) => n + '%' },
    { k: 'adSpend', label: 'Monthly ad spend', min: 2000, max: 200000, step: 1000, fmt: (n) => '$' + n.toLocaleString('en-US') },
    { k: 'roas', label: 'Current ROAS', min: 1, max: 12, step: 0.1, fmt: (n) => n.toFixed(1) + 'x' },
  ];

  const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  const INK = '#EAF1F6', MUT = 'rgba(234,241,246,0.55)', CARD = '#131210', LINE = 'rgba(234,241,246,0.10)', LOSS = '#FF6B6B';

  return (
    <div style={{ background: '#131210', color: INK, borderRadius: CI_R_SM, overflow: 'hidden' }}>
      <div className="flex items-center justify-between px-5 sm:px-7 py-4" style={{ borderBottom: `1px solid ${LINE}` }}>
        <span className="flex items-center gap-2.5" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: MUT }}>
          <span aria-hidden style={{ width: 7, height: 7, background: accent, flexShrink: 0 }} /> Interactive sample
        </span>
        <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', color: MUT }}>Drag any number</span>
      </div>

      <div className="px-5 sm:px-7 pt-6">
        <h4 style={{ fontFamily: SANS, fontWeight: 700, fontSize: 'clamp(1.25rem,2.4vw,1.7rem)', lineHeight: 1.12, letterSpacing: '-0.01em', color: INK }}>The True-Profit ROAS Calculator</h4>
        <p className="mt-1.5" style={{ fontFamily: SANS, fontSize: '13px', lineHeight: 1.5, color: MUT }}>Plug in your six numbers. See what each order actually keeps, and the ROAS you need before scaling makes money.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 px-5 sm:px-7 py-6">
        <div className="space-y-4">
          {fields.map((f) => (
            <div key={f.k}>
              <div className="flex items-baseline justify-between">
                <label htmlFor={`sim-${f.k}`} style={{ fontFamily: SANS, fontSize: '12px', color: MUT }}>{f.label}</label>
                <span style={{ fontFamily: MONO, fontSize: '13px', fontWeight: 600, color: INK }}>{f.fmt(v[f.k])}</span>
              </div>
              <input id={`sim-${f.k}`} type="range" min={f.min} max={f.max} step={f.step} value={v[f.k]} onChange={set(f.k)}
                className="w-full mt-1.5" style={{ accentColor: accent, height: 4 }} />
            </div>
          ))}
        </div>

        <div style={{ background: CARD, borderRadius: CI_R_SM, padding: '20px 22px' }}>
          <p style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: MUT }}>True profit per order</p>
          <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 'clamp(2.2rem,6vw,3rem)', lineHeight: 1, marginTop: 6, color: underwater ? LOSS : accent, fontVariantNumeric: 'tabular-nums' }}>{money(profit)}</div>
          <p className="mt-2" style={{ fontFamily: SANS, fontSize: '12.5px', lineHeight: 1.45, color: underwater ? LOSS : INK }}>
            {underwater ? `At ${v.roas.toFixed(1)}x ROAS you lose ${money(-profit)} on every order.` : `At ${v.roas.toFixed(1)}x ROAS you keep ${money(profit)} per order.`}
          </p>

          <div className="grid grid-cols-2 gap-px mt-5" style={{ background: LINE, borderRadius: 8, overflow: 'hidden' }}>
            {[
              { l: 'Break-even ROAS', val: isFinite(breakEven) ? breakEven.toFixed(1) + 'x' : '—', hot: isFinite(breakEven) && v.roas < breakEven },
              { l: 'Contribution margin', val: money(margin), hot: margin < 0 },
              { l: 'Ad spend / order', val: money(adPerOrder), hot: false },
              { l: 'True profit / month', val: money0(monthlyProfit), hot: monthlyProfit < 0 },
            ].map((s, i) => (
              <div key={i} style={{ background: CARD, padding: '12px 14px' }}>
                <p style={{ fontFamily: MONO, fontSize: '8.5px', letterSpacing: '0.14em', textTransform: 'uppercase', color: MUT }}>{s.l}</p>
                <p style={{ fontFamily: MONO, fontWeight: 600, fontSize: '16px', marginTop: 3, color: s.hot ? LOSS : INK, fontVariantNumeric: 'tabular-nums' }}>{s.val}</p>
              </div>
            ))}
          </div>

          <p className="mt-4" style={{ fontFamily: SANS, fontSize: '11.5px', lineHeight: 1.5, color: MUT }}>
            You need <span style={{ color: accent, fontWeight: 600 }}>{isFinite(breakEven) ? breakEven.toFixed(1) + 'x' : '—'}</span> just to break even. Below it, every "winning" campaign ships at a loss.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between px-5 sm:px-7 py-3" style={{ borderTop: `1px solid ${LINE}` }}>
        <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: '13px', color: INK }}>Step Digital<span style={{ color: accent }}>.</span></span>
        <span style={{ fontFamily: MONO, fontSize: '9px', letterSpacing: '0.14em', textTransform: 'uppercase', color: MUT }}>Drafted from your posts</span>
      </div>
    </div>
  );
}

// In-page preview of the prospect's lead magnet. The LM card in the feed opens this:
// the real cover next to what's inside (the actual prompts), so it reads as a finished
// resource without leaving the page. Not a live external link by design.
function LmPreviewModal({ lm, who, bookUrl, embedUrl, domain, logoUrl, accentHex, companyName, onClose }: { lm: { title: string; cover_url: string; pages?: number; promise?: string; whats_inside?: string[]; sim?: LmSim }; who: string; bookUrl: string; embedUrl?: string | null; domain?: string; logoUrl?: string; accentHex?: string; companyName?: string; onClose: () => void }) {
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
  // A believable path off the LM title (last ~3 words), so the address bar reads like their page.
  const urlPath = (lm.title || 'assessment').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().split(/\s+/).slice(-3).join('-');
  // A calculator LM has no live page to embed — present it AS the prospect's own deployed
  // page anyway: a browser window on their domain wrapping the interactive simulation, so it
  // reads as the tool running on their site (never an ivanmanfredi.com resource).
  if (lm.sim) {
    const simPath = (lm.title || 'calculator').split(':')[0].toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
    const cleanDomain = (domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    return (
      <motion.div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
        style={{ background: 'rgba(20,18,15,0.6)', backdropFilter: 'blur(3px)' }} onClick={onClose} role="dialog" aria-modal="true" aria-label="Your live lead magnet">
        <motion.div className="relative w-full max-w-3xl" initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.3, ease: EASE }}
          style={{ maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} aria-label="Close" className="absolute right-0 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors" style={{ top: -40, background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Close <XCircle className="w-4 h-4" />
          </button>
          <div className="w-full overflow-auto" style={{ maxHeight: '90vh', borderRadius: 14, border: '1px solid rgba(234,241,246,0.12)', boxShadow: '0 24px 60px rgba(19,18,16,0.28)', background: '#131210' }}>
            {cleanDomain && (
              <div className="flex items-center gap-3 px-3.5" style={{ height: 46, background: 'linear-gradient(180deg,#131210 0%,#131210 100%)', borderBottom: '1px solid rgba(234,241,246,0.10)' }}>
                <div className="flex items-center gap-2" aria-hidden>
                  <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FF5F57' }} />
                  <span style={{ width: 11, height: 11, borderRadius: 999, background: '#FEBC2E' }} />
                  <span style={{ width: 11, height: 11, borderRadius: 999, background: '#28C840' }} />
                </div>
                <div className="flex items-center gap-2 mx-auto" style={{ maxWidth: 420, width: '100%', height: 28, padding: '0 12px', borderRadius: 8, background: 'rgba(234,241,246,0.06)', border: '1px solid rgba(234,241,246,0.10)', color: 'rgba(234,241,246,0.6)' }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanDomain}/{simPath}</span>
                </div>
                <div style={{ width: 46, flexShrink: 0 }} aria-hidden />
              </div>
            )}
            <LmCalculatorSim sim={lm.sim} />
          </div>
        </motion.div>
      </motion.div>
    );
  }
  // The live sample is shown AS the prospect's own deployed page — a browser window on their
  // domain, no surrounding paper frame, so nothing reads as an Ivan-hosted resource.
  if (embedUrl) {
    return (
      <motion.div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
        style={{ background: 'rgba(20,18,15,0.6)', backdropFilter: 'blur(3px)' }} onClick={onClose} role="dialog" aria-modal="true" aria-label="Your live lead magnet">
        <motion.div className="relative w-full max-w-4xl" initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.3, ease: EASE }}
          style={{ maxHeight: '92vh' }} onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} aria-label="Close" className="absolute right-0 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors" style={{ top: -40, background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', fontFamily: MONO, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Close <XCircle className="w-4 h-4" />
          </button>
          <div className="overflow-hidden" style={{ maxHeight: '92vh', borderRadius: 14 }}>
            <LiveAssessmentEmbed src={embedUrl} title={lm.title} height={900} domain={domain} urlPath={urlPath} logoUrl={logoUrl} accentHex={accentHex} companyName={companyName} />
          </div>
        </motion.div>
      </motion.div>
    );
  }
  return (
    <motion.div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
      style={{ background: 'rgba(20,18,15,0.55)', backdropFilter: 'blur(3px)' }} onClick={onClose} role="dialog" aria-modal="true" aria-label="Lead magnet preview">
      <motion.div className="relative w-full max-w-3xl overflow-auto" initial={reduce ? false : { opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.3, ease: EASE }}
        style={{ maxHeight: '88vh', background: 'var(--color-paper, #FFFFFF)', borderRadius: CI_R, border: `1px solid ${hairline}`, boxShadow: CI_SHADOW_LG }} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Close preview" className="absolute top-3 right-3 z-10 p-2 rounded-full transition-colors" style={{ background: 'rgba(19,18,16,0.06)' }}>
          <XCircle className="w-5 h-5" style={{ color: '#131210' }} />
        </button>
        {(
        <div className="grid md:grid-cols-2">
          <div className="p-5 sm:p-6 flex items-center justify-center" style={{ background: '#131210' }}>
            <img src={lm.cover_url} alt={lm.title} className="w-full h-auto" style={{ borderRadius: CI_R_SM, maxHeight: '64vh', objectFit: 'contain' }} />
          </div>
          <div className="p-6 sm:p-7">
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--color-accent-ink)', fontWeight: 600 }}>Lead magnet · preview</p>
            <h3 className="mt-3" style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.4rem, 2.6vw, 1.85rem)', lineHeight: 1.12, letterSpacing: '-0.015em', color: '#131210' }}>{lm.title}</h3>
            {lm.promise && <p className="mt-3" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: '#4A463E' }}>{lm.promise}</p>}
            {items.length > 0 && (
              <>
                <p className="mt-6 mb-3" style={{ fontFamily: MONO, fontSize: '9.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.5)' }}>What's inside</p>
                <ul>
                  {items.map((it, i) => (
                    <li key={i} className="flex gap-3" style={{ borderTop: i ? `1px solid ${hairline}` : 'none', paddingTop: i ? '0.7rem' : 0, marginTop: i ? '0.7rem' : 0 }}>
                      <span aria-hidden style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 600, color: 'var(--color-accent-ink)', lineHeight: 1.5, flexShrink: 0, minWidth: 18 }}>{String(i + 1).padStart(2, '0')}</span>
                      <span style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.5, color: '#4A463E' }}>{it}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-6" style={{ fontFamily: BODY_SERIF, fontSize: '13px', lineHeight: 1.5, color: 'rgba(19,18,16,0.6)' }}>
              The system builds this as an interactive page on your domain and captures every email, {who}.
            </p>
            <div className="mt-5"><CIMagneticCTA href={bookUrl} label="See the live version" small /></div>
          </div>
        </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ContentSystemReport({ report, scan, companyName }: { report: ReportJson; scan: Scan; companyName: string }) {
  const cs = report.content_system;
  if (!cs) return null;
  const [lmOpen, setLmOpen] = useState(false);
  // Display name: strip a trailing parenthetical — "DiviUp Agency (an AMP Agency)" reads
  // as "DiviUp Agency" on the h1/meta/carousel surfaces. The full legal-ish name stays in
  // the data plate "Company" cell and the footer "Prepared for" line.
  const displayCompany = companyName.replace(/\s*\(.*\)$/, '').trim() || companyName;
  // Founder-first: this offer runs on the founder's personal brand, so address them by name.
  const founder = cs.founder;
  const who = (founder?.first_name || (founder?.name || '').split(' ')[0] || '').trim() || displayCompany;
  const founderFull = founder?.name || companyName;
  const bookUrl = `${CALENDLY_BASE}?utm_source=scan&utm_content=${encodeURIComponent(companyName)}&a1=${encodeURIComponent('inbound engine')}`;

  // Per-scan share metadata so the clean ivanmanfredi.com/scan/:slug link unfurls
  // (baked into static HTML by scripts/prerender.mjs for prerendered scan slugs).
  useMetadata({
    title: `An inbound engine for ${displayCompany}`,
    description: `A week of LinkedIn posts and a lead magnet, in ${who}'s voice, ready to approve.`,
    canonical: `${import.meta.env.VITE_SCAN_ORIGIN || 'https://ivanmanfredi.com'}/scan/${scan.company_slug}`,
    ogImage: cs.og_image_url || undefined,
    noindex: true,
  });

  // The prospect's full brand kit — threaded into every sample artifact (carousel slides,
  // designed image cards, LM embed chrome) so each reads as THEIR asset, not a template.
  const brand = cs.sample_output?.lm?.brand;
  const prospectAccent = brand?.accent_hex || cs.sample_output?.lm?.accent_hex || '#1F6FEB';
  const prospectLogo = brand?.logo_url || undefined;

  // Attention budget: ONE post runs full-size in the feed — the first visual one
  // (image/carousel) — and every other full post renders as a compact clamped card
  // (real body + small thumb) so the whole written week reads in one screenful.
  type CsPost = NonNullable<NonNullable<ContentSystem['sample_output']>['posts']>[number];
  const weekPosts: CsPost[] = (cs.sample_output?.posts ?? []).filter((p) => !/lead.?magnet/i.test(p.format || ''));
  const isVisualPost = (p: CsPost) => Boolean(p.image_url) || Boolean(p.image_card?.headline) || (Array.isArray(p.image_urls) && p.image_urls.length >= 2) || (Array.isArray(p.slides) && p.slides.length >= 2);
  const firstVisual = weekPosts.find(isVisualPost);
  const heroPosts = firstVisual ? [firstVisual] : weekPosts.slice(0, 1);
  const feedSpec = buildFeedSpecFromContentSystem(
    cs.sample_output ? { ...cs, sample_output: { ...cs.sample_output, posts: heroPosts } } : cs,
    { companyName: displayCompany },
  );
  const restSpec = cs.sample_output
    ? buildFeedSpecFromContentSystem(
        { ...cs, sample_output: { ...cs.sample_output, posts: weekPosts.filter((p) => !heroPosts.includes(p)) } },
        { companyName: displayCompany },
      )
    : null;
  // When the LM is a live, results-forward assessment we can embed, use it everywhere.
  const lmEmbedUrl = buildAssessmentEmbedUrl(cs.sample_output?.lm, { prospectId: scan?.company_slug || companyName });
  const lmSim = cs.sample_output?.lm?.sim;
  const lmCover = cs.sample_output?.lm?.cover_url || '';
  const lmStatic = !lmEmbedUrl && !lmSim && Boolean(lmCover);
  const lmHasSample = Boolean(lmEmbedUrl) || Boolean(lmSim) || lmStatic;

  // ── Derived, honest figures (every number traces to report_json / scan stamps) ──
  const scanDate = recDateISO(scan.completed_at, scan.created_at);
  // Approval-language scrubber (defensive display cleanup for builder-emitted copy — the
  // engine writes and runs; the prospect is never framed as an approver, and "drafted"
  // over-claims are folded to "written"). Live rows were data-cleaned 07-17; this guards
  // every future n8n-emitted row at render time.
  const scrubApproval = (t?: string) => (t || '')
    .replace(/,?\s*(?:sent|dispatched|queued|prepared|drafted|written)?\s*for (?:your|her|his|their|the)?\s*(?:approval|review|sign[- ]?off)\b[^.!?]*/gi, '')
    .replace(/\bready to approve\b/gi, 'ready')
    .replace(/\byour only job is to approve\b/gi, 'we run it')
    .replace(/\byou (?:review and |just )?approve\b/gi, 'we handle it')
    .replace(/\bdrafted\b/gi, 'written')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/,(?=\s*[.,;:])/g, '')
    .trim()
    .replace(/[,;:]\s*$/, '')
    .replace(/([^.!?…])$/, '$1.');
  const ls = report.linkedin_summary;
  const followers = ls?.followers ?? null;
  const posts30 = ls?.posts_30d ?? null;
  const lastPostDays = ls?.last_post_days ?? null;
  const winsCards = (cs.wins ?? []).filter((w) => (w.observation || '').trim());
  const lm = cs.sample_output?.lm;
  const insideItems = (lm?.whats_inside ?? []).slice(0, 5);
  // Voice provenance: one inspectable pairing, their sentence beside the drafted open built
  // from it. Skip pairs where one side is a near-copy of the other: verbatim reuse proves
  // nothing about voice; the pairing must show resemblance with difference.
  const vnorm = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const voicePair = (cs.sample_output?.posts ?? []).find((p) => {
    const q = (p.source_quote || '').trim();
    const d = ((p.hook || '').trim() || (p.body || '').split('\n')[0].trim());
    if (q.length < 20 || !d) return false;
    const nq = vnorm(q); const nd = vnorm(d);
    return !nq.includes(nd) && !nd.includes(nq);
  });
  const sourceQuotes = ((cs.sample_output?.posts ?? []).map((p) => p.source_quote).filter(Boolean) as string[])
    .filter((q) => q !== voicePair?.source_quote).slice(0, 4);
  const engagerNames = (cs.sample_output?.engager_outreach?.samples ?? [])
    .map((s) => (s.engager?.name || '').trim()).filter(Boolean).slice(0, 3);
  const cleanDomain = (scan.domain || companyName || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
  const newsletter = cs.sample_output?.newsletter?.subject && cs.sample_output?.newsletter?.sections?.length ? cs.sample_output.newsletter : null;
  const followUps = cs.sample_output?.follow_ups?.length ? cs.sample_output.follow_ups : null;
  const engager = cs.sample_output?.engager_outreach?.samples?.length ? cs.sample_output.engager_outreach : null;

  // ── Audience room read (scan-build audit embed; PLAN-audit-in-scans, 2026-07-15) ──
  // Framing guard: a cold prospect is being told about their own audience by a stranger, so
  // the section leads with the gift (buyers already connected, real names) and renders ONLY
  // when the audit counted something flattering: 3+ buyers in the connection sample, or a
  // named buyer among their engagers. Thin or purely unflattering data hides it entirely.
  // Every figure is counted from what was actually read, never extrapolated; the SN total
  // estimate (audience.network_total) is unstable and deliberately never shown.
  const aud = cs.audience;
  const audClean = (t?: string) => (t || '').replace(/\s*—\s*/g, ', ').replace(/\s+/g, ' ').trim();
  const audNamed = (aud?.named ?? []).filter((n) => (n?.name || '').trim()).slice(0, 3);
  const audNetCount = aud?.network_icp_count ?? null;
  const audNetSample = aud?.network_sample ?? null;
  const audNetTotal = aud?.network_total ?? null;
  const audEngIcp = aud?.engager_icp_count ?? 0;
  const audEngagers = aud?.engagers ?? 0;
  const audPosts = aud?.posts ?? 0;
  // Floor: >=3 counted buyers AND >=2% of the read sample. 2% sits clearly above the ~1%
  // background rate of DTC decision-makers in a generic professional network (the flagship
  // good room read 4.6%); below it "buyers in your room" stops being a gift.
  const audNetDensity = aud?.network_icp_density ?? (audNetCount !== null && audNetSample ? Math.round((audNetCount / audNetSample) * 1000) / 10 : null);
  const audNetOk = audNetCount !== null && audNetSample !== null && audNetSample >= 30 && audNetCount >= 3 && (audNetDensity ?? 0) >= 2;
  // Extrapolate over the full list only when the real connections_count is known (never the
  // unstable SN search total) and the sample covers at least a tenth of it. The counted
  // number stays on the page as the receipt either way.
  const audEst = audNetOk && audNetTotal && audNetTotal > (audNetSample as number) && (audNetSample as number) * 10 >= audNetTotal
    ? (() => { const x = ((audNetCount as number) / (audNetSample as number)) * audNetTotal; return x >= 100 ? Math.round(x / 10) * 10 : Math.round(x / 5) * 5; })()
    : null;
  const roomMode: 'network' | 'engager' | null = audNetOk ? 'network' : (audEngIcp >= 1 && audNamed.length > 0 ? 'engager' : null);
  const room = aud && roomMode ? {
    figure: roomMode === 'network' ? (audEst ? `~${audEst}` : String(audNetCount)) : String(audEngIcp),
    figureLabel: roomMode === 'network' ? 'Buyers already connected to you' : 'Buyers already in your comments',
    figureSub: roomMode === 'network'
      ? (audEst
        ? `We read ${audNetSample} of your ${audNetTotal.toLocaleString('en-US')} connections and counted ${audNetCount} buyers, name by name. Averaged over the full list that lands near ${audEst}.`
        : `Counted one by one in the ${audNetSample} connections we read, each verified from their own headline.`)
      : `Counted among the ${audEngagers} people who engaged your last ${audPosts} posts, each verified from their own headline.`,
    giftLine: roomMode === 'network'
      ? (audEst
        ? `${audNetCount} buyers verified by name in the ${audNetSample} connections we read; the full list likely holds around ${audEst}. Each of them said yes to you once.`
        : `${audNetCount} decision makers at consumer brands already sit in your connections. Each of them said yes to you once.`)
      : `${audEngIcp} ${audEngIcp === 1 ? 'decision maker at a consumer brand shows' : 'decision makers at consumer brands show'} up in your own comments and reactions. They come to you already.`,
    gapLine: audEngagers > 0
      ? `Your last ${audPosts} posts drew ${audEngagers} ${audEngagers === 1 ? 'person' : 'people'}. ${audEngIcp === 0 ? 'Not one of them was a buyer.' : `${audEngIcp} ${audEngIcp === 1 ? 'was a buyer' : 'were buyers'}. The rest were not.`}`
      : `Your last ${audPosts} posts drew no reactions or comments we could read. The buyers above never hear from you.`,
    caveat: audEst
      ? `Counted from what we actually read: ${audNetSample} of your connections and the reactions and comments on your last ${audPosts} posts, one headline at a time. The ~${audEst} averages that count over your full ${audNetTotal.toLocaleString('en-US')}; every name above is verified.`
      : `Counted from what we actually read: ${[
          audNetSample ? `${audNetSample} of your connections` : '',
          audPosts ? `the reactions and comments on your last ${audPosts} posts` : '',
        ].filter(Boolean).join(' and ')}, classified one headline at a time. No estimates on this page.`,
  } : null;

  const WARN: Record<ContentSystem['archetype'], { effect: string; verdict: string }> = {
    silent_founder:    { effect: 'WARNING: ATTENTION LEFT UNWORKED', verdict: 'The audience is already there. Nothing routes it anywhere.' },
    inconsistent:      { effect: 'WARNING: PRESENCE RESETS TO ZERO', verdict: 'The presence comes in bursts. Between them, the feed goes quiet.' },
    no_capture:        { effect: 'WARNING: READERS LEAVE UNNAMED', verdict: 'The readers arrive. Not one of them is named.' },
    invisible:         { effect: 'WARNING: ABSENT WHERE BUYERS LOOK', verdict: 'The buyers are looking. The feed gives them nothing.' },
    uncaptured_feed:   { effect: 'WARNING: THE FEED CAPTURES NOBODY', verdict: 'The posting happens. Not one reader is named or kept.' },
    unworked_audience: { effect: 'WARNING: THE ROOM GOES UNWORKED', verdict: 'The audience is built. Nobody works a single name in it.' },
  };
  const warn = WARN[cs.archetype] ?? WARN.silent_founder;

  // ── Pillars: the hero table + chapter seating ──────────────────────────────
  // Ladder: builder-emitted cs.pillars → wins[].pillar tag → keyword heuristic on the
  // win text → an honest plain-sentence fallback. Never a bracket glyph.
  type PillarKey = 'content' | 'inbound' | 'outbound';
  const winPillar = (w: NonNullable<ContentSystem['wins']>[number]): PillarKey => {
    if (w.pillar === 'content' || w.pillar === 'inbound' || w.pillar === 'outbound') return w.pillar;
    const t = `${w.observation || ''} ${w.build || ''}`.toLowerCase();
    if (/(outreach|\bdms?\b|connection request|engager|commenter|comment(s|ed)?\b|reaction|warm message|warm lane)/.test(t)) return 'outbound';
    if (/(lead.?magnet|captur|gated|newsletter|email list|mailing list|assessment|calculator|download|subscrib|opt.?in|funnel|landing page)/.test(t)) return 'inbound';
    return 'content';
  };
  const winsByPillar: Record<PillarKey, typeof winsCards> = { content: [], inbound: [], outbound: [] };
  for (const w of winsCards) winsByPillar[winPillar(w)].push(w);
  const contentFoundFallback = followers != null && posts30 != null
    ? `${followers.toLocaleString()} followers, ${posts30} post${posts30 === 1 ? '' : 's'} in the last 30 days.`
    : posts30 != null
    ? (posts30 === 0 ? 'No posts on the feed in the last 30 days.' : `${posts30} post${posts30 === 1 ? '' : 's'} in the last 30 days.`)
    : lastPostDays != null
    ? `Last post ${lastPostDays} day${lastPostDays === 1 ? '' : 's'} ago.`
    : followers != null
    ? `${followers.toLocaleString()} followers, no posting pattern we could read.`
    : 'No posting pattern we could read from the public feed.';
  const FOUND_FALLBACK: Record<PillarKey, string> = {
    content: contentFoundFallback,
    inbound: 'No lead capture found behind any post in the last 30 days.',
    outbound: 'No warm follow-up found. People who engage the posts are left there.',
  };
  const PROJECTED_FALLBACK: Record<PillarKey, string> = {
    content: 'Five posts a week, in your voice.',
    inbound: 'A gated asset in your brand names every reader. A newsletter and a follow-up sequence keep them.',
    outbound: 'Everyone who engages a post gets a warm message that references it. Around 15 a week, capped.',
  };
  const pillarCell = (k: PillarKey) => ({
    found: scrubApproval((cs.pillars?.[k]?.found || '').trim() || (winsByPillar[k][0]?.observation || '').trim() || FOUND_FALLBACK[k]),
    projected: scrubApproval((cs.pillars?.[k]?.projected || '').trim() || PROJECTED_FALLBACK[k]),
  });
  const PILLARS: { key: PillarKey; name: string; anchor: string }[] = [
    { key: 'content', name: 'Content', anchor: 'cs-ch-content' },
    { key: 'inbound', name: 'Inbound', anchor: 'cs-ch-inbound' },
    { key: 'outbound', name: 'Warm outbound', anchor: 'cs-ch-outbound' },
  ];
  const pillars: Record<PillarKey, { found: string; projected: string }> = {
    content: pillarCell('content'), inbound: pillarCell('inbound'), outbound: pillarCell('outbound'),
  };
  const jump = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // One-line CTA row closing each chapter — same ink button, red stays reserved for the end.
  const ChapterCta = ({ line }: { line: React.ReactNode }) => (
    <div className="chcta">
      <p>{line}</p>
      <a className="btn-ink" href={bookUrl} target="_blank" rel="noopener noreferrer">Book the free fit call <span aria-hidden>→</span></a>
    </div>
  );

  // The gated wins that belong to a chapter, rendered as observed entries with the build.
  // A win whose observation already fills the pillar table's "found" cell (the fallback
  // path when the builder emits no cs.pillars) is skipped here — never printed twice.
  const WinRows = ({ k }: { k: PillarKey }) => {
    const rows = winsByPillar[k].filter((w) => (w.observation || '').trim() !== pillars[k].found);
    return rows.length ? (
    <div className="ledger">
      {rows.slice(0, 3).map((w, i) => (
        <div className="lrow" key={i}>
          <div className="lmeta"><div className="lidx num">{String(i + 1).padStart(2, '0')}</div><div className="ldate">Observed {scanDate}</div></div>
          <div>
            <div className="lobs">{w.observation}</div>
            {w.build ? <div className="lbuild"><span className="bl">→ Build</span><span className="bt">{w.build}</span></div> : null}
          </div>
        </div>
      ))}
    </div>
    ) : null;
  };

  return (
    <div className="bbrec min-h-screen" style={BLACKBOX_VARS}>
      <RecordStyles />
      <ScrollProgress />

      {/* ── TOP REGISTER ─────────────────────── */}
      <header className="reg">
        <div className="wrap reg-row">
          <Link to="/" aria-label="InboundOnSteroids" className="inline-flex items-center hover:opacity-80 transition-opacity"><Wordmark size={20} /></Link>
          <div className="reg-right">
            <span className="reg-meta hidden md:inline">Scan report&nbsp;·&nbsp;Confidential to recipient</span>
            <a className="btn-ink" href={bookUrl} target="_blank" rel="noopener noreferrer">Book a call</a>
          </div>
        </div>
      </header>

      <main className="wrap">
        {/* ── DOCLINE ─────────────────────────── */}
        <Docline docType="Scan report · Projected · Scanned" date={scanDate} refLabel={scan.company_slug} />

        {/* ── DATA PLATE ──────────────────────── */}
        <DataPlate cells={[
          { k: 'Prepared for', v: founderFull },
          ...(companyName && founderFull !== companyName ? [{ k: 'Company', v: companyName }] : []),
          { k: 'Scanned', v: <>LinkedIn feed{cleanDomain ? <><br />{cleanDomain}</> : null}</> },
          { k: 'Scan date', v: <span className="num">{scanDate}</span> },
          { k: 'Operator of record', v: 'Ivan Manfredi' },
        ]} />

        {/* ── FOLD ────────────────────────────── */}
        <Rev el="section" className="fold">
          <div>
            <h1 className="company">{displayCompany}</h1>
            <p className="lede">{cs.thesis ? scrubApproval(cs.thesis) : 'The attention is real. The mechanism that keeps it is the part that was never built.'}</p>
          </div>
        </Rev>

        {/* ── VERDICT · THE BOX (1 of 2, the page's one tilt) ── */}
        <div className="boxwrap">
          <Rev className="box tilt">
            <div className="box-head">
              <span className="sqbig" aria-hidden />
              <span className="lbl">{warn.effect}</span>
            </div>
            <div className="box-body">{warn.verdict}</div>
            <div className="ptab">
              <div className="ptab-h">
                <span>Pillar</span>
                <span>On your feed today</span>
                <span>After 90 days</span>
              </div>
              {PILLARS.map((p) => (
                <div className="ptab-r" key={p.key}>
                  <div><a className="ptab-a" href={`#${p.anchor}`} onClick={(e) => jump(e, p.anchor)}>{p.name}</a></div>
                  <div className="ptab-f" data-l="On your feed today">{pillars[p.key].found}</div>
                  <div className="ptab-v" data-l="After 90 days">{pillars[p.key].projected}</div>
                </div>
              ))}
            </div>
            <p className="box-note">Read from your public presence on {scanDate}. Tap a pillar to jump to it.</p>
          </Rev>
        </div>

        {/* ── EVIDENCE · THE ROOM (framing-guarded: renders only with a flattering counted fact) ── */}
        {room && (
          <Rev el="section" className="sec" id="cs-room">
            <SecHead
              label={<>Evidence&nbsp;·&nbsp;Audience</>}
              title={<>Who is actually in your room.</>}
              note={<>We read your audience the slow way before this page was built. Here is who was in it.</>}
            />
            <div className="aud-top">
              <div className="pf-figk">{room.figureLabel}</div>
              <div className="pf-fig">{room.figure}</div>
              <p className="aud-sub">{room.figureSub}</p>
            </div>
            {/* Grade scale: bands are OUR scale from the rooms we read for this buyer type
                (consumer-brand sellers only, enforced upstream by the audit's vertical gate;
                a different ICP would need re-based bands). ~1% is the background rate of DTC
                decision-makers in a generic network; the flagship good room read 4.6%. */}
            {roomMode === 'network' && audNetDensity !== null && (
              <div>
                <div className="pf-figk" style={{ marginTop: 'clamp(18px,2.4vw,26px)' }}>How rooms grade, share of connections that are buyers</div>
                <div className="aud-scale">
                  {[
                    { r: 'Under 1%', w: 'Background noise. Almost every room starts here.', on: audNetDensity < 1 },
                    { r: '1 to 2%', w: 'A typical room. Some buyers, mostly peers.', on: audNetDensity >= 1 && audNetDensity < 2 },
                    { r: 'Above 2%', w: 'Raw material worth working.', on: audNetDensity >= 2 },
                  ].map((b, i) => (
                    <div className={`aud-band${b.on ? ' on' : ''}`} key={i}>
                      <div className="abr">{b.r}</div>
                      <div className="abw">{b.w}</div>
                      {b.on ? <div className="abys">Yours · {audNetDensity}%</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="aud-rows">
              <div className="aud-row"><span className="ak">The raw material</span><p>{room.giftLine}</p></div>
              <div className="aud-row"><span className="ak">As it runs today</span><p>{room.gapLine}</p></div>
            </div>
            {audNamed.length > 0 && (
              <div className="aud-names">
                {audNamed.map((n, i) => (
                  <div className="aud-name" key={i}>
                    <div className="anm">{audClean(n.name)}</div>
                    {n.headline ? <div className="ahl">{audClean(n.headline).slice(0, 110)}</div> : null}
                    <div className="asrc">{n.source === 'engager' ? 'Engaged your posts' : 'In your connections'}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="cap">{room.caveat}</p>
          </Rev>
        )}

        {/* ── CHAPTER 01 · CONTENT ────────────── */}
        <Rev el="section" className="sec" id="cs-ch-content" style={{ scrollMarginTop: 76 }}>
          <SecHead
            label={<>Chapter 01&nbsp;·&nbsp;Content</>}
            title={<>Once daily, in your voice.</>}
            note={<>Built from your own material before this page existed.</>}
          />
          <WinRows k="content" />
          {feedSpec.posts.length > 0 && (
            <div style={{ marginTop: 'clamp(26px,3.2vw,38px)' }}>
              <Exhibit
                label={<>Fig&nbsp;·&nbsp;this week&rsquo;s posts&nbsp;·&nbsp;your feed, your brand</>}
                caption={sourceQuotes.length ? <>From your own words: {sourceQuotes.slice(0, 2).map((q, i) => <span key={i}>{i ? '  ·  ' : ''}&ldquo;{q}&rdquo;</span>)}</> : undefined}
              >
                <div style={{ background: '#FFFFFF' }}>
                  <LinkedInFeedMockup spec={feedSpec} mode="full" accentHex={prospectAccent} brandName={who} brand={brand} companyName={displayCompany} />
                </div>
              </Exhibit>
              {restSpec && restSpec.posts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-stretch" style={{ marginTop: 16 }}>
                  {restSpec.posts.map((p, i) => (
                    <LinkedInPostPreview
                      key={i}
                      compact
                      clampLines={4}
                      author={restSpec.profile.name}
                      headline={restSpec.profile.headline}
                      avatarUrl={restSpec.profile.avatarUrl}
                      text={p.body}
                      mediaUrl={p.type === 'image' ? (p.imageUrl ?? null) : p.type === 'carousel' && p.slides?.length ? p.slides[0] : null}
                      stats={{ reactions: p.reactions, comments: p.comments }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <ChapterCta line={<>This week is already written, {who}. On the call we walk it live.</>} />
        </Rev>

        {/* ── CHAPTER 02 · INBOUND ────────────── */}
        <Rev el="section" className="sec" id="cs-ch-inbound" style={{ scrollMarginTop: 76 }}>
          <SecHead
            label={<>Chapter 02&nbsp;·&nbsp;Inbound</>}
            title={<>Every reader leaves a name.</>}
            note={<>One gated asset on your domain. Every reader who finishes it lands on your list.</>}
          />
          <WinRows k="inbound" />
          {lm?.title && lmEmbedUrl && (
            <div style={{ marginTop: 'clamp(26px,3.2vw,38px)' }}>
              {/* branded exhibit masthead — cover plate beside the title/promise band */}
              <div className="lm-frame">
                {(lmCover || lm.brand?.logo_url) && (
                  <div className="lm-frame-cover">
                    <img src={lmCover || lm.brand?.logo_url} alt={lm.title} loading="lazy" onError={fallbackOnError} />
                  </div>
                )}
                <div className="lm-frame-body">
                  <FigLabel>Fig&nbsp;·&nbsp;lead magnet&nbsp;·&nbsp;your brand</FigLabel>
                  <div className="lm-title" style={{ fontSize: 'clamp(22px,2.6vw,32px)' }}>{lm.title}</div>
                  {lm.promise ? <p className="lm-promise">{lm.promise}</p> : null}
                  <div className="lm-gate"><span className="sq" aria-hidden /> Live&nbsp;·&nbsp;gated on {cleanDomain || 'your domain'}</div>
                </div>
              </div>
              <div style={{ marginTop: 'clamp(18px,2.2vw,26px)' }}>
                <Exhibit
                  label={<>Fig&nbsp;·&nbsp;the gated asset&nbsp;·&nbsp;running, in your brand</>}
                  caption={<>Live and working, in your brand. Every completion lands a named email on your list.</>}
                >
                  <LiveAssessmentEmbed src={lmEmbedUrl} title={lm.title} height={820} eager domain={scan?.domain || companyName} urlPath={(lm.title || 'assessment').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().split(/\s+/).slice(-3).join('-')} logoUrl={lm.brand?.logo_url} accentHex={lm.brand?.accent_hex || lm.accent_hex} companyName={companyName} />
                </Exhibit>
              </div>
              <button type="button" className="btn-ink" onClick={() => setLmOpen(true)} style={{ marginTop: 20 }}>
                Open it full screen <span aria-hidden>→</span>
              </button>
            </div>
          )}
          {lm?.title && !lmEmbedUrl && (
            <div className="lm">
              <div>
                <FigLabel>Fig&nbsp;·&nbsp;lead magnet cover&nbsp;·&nbsp;your brand</FigLabel>
                <div className="lm-cover">
                  {lmCover
                    ? <img src={lmCover} alt={lm.title} loading="lazy" onError={fallbackOnError} />
                    : <div style={{ padding: 40, fontFamily: BODY_SERIF, fontStyle: 'italic', color: MUTED, textAlign: 'center' }}>Cover · {lm.title}</div>}
                </div>
              </div>
              <div>
                <div className="lm-title">{lm.title}</div>
                {lm.promise ? <p className="lm-promise">{lm.promise}</p> : null}
                {insideItems.length > 0 && (
                  <div className="inside">
                    {insideItems.map((it, i) => (
                      <div className="ir" key={i}><span className="ii num">{String(i + 1).padStart(2, '0')}</span><span className="it">{it}</span></div>
                    ))}
                  </div>
                )}
                <div className="lm-gate"><span className="sq" aria-hidden /> Gated on {cleanDomain || 'your domain'}&nbsp;·&nbsp;names every reader onto a list you own</div>
                {lmHasSample && feedSpec.lmCard && (
                  <button type="button" className="btn-ink" onClick={() => setLmOpen(true)} style={{ marginTop: 20 }}>
                    {lmSim ? 'Open the calculator' : lmStatic ? 'See the sample' : 'Take the live sample'} <span aria-hidden>→</span>
                  </button>
                )}
              </div>
            </div>
          )}
          {(newsletter || followUps) && (
            <div className="grid gap-7 lg:grid-cols-2 items-start" style={{ marginTop: 'clamp(26px,3.2vw,38px)' }}>
              {newsletter && (
                <Exhibit label={<>Fig&nbsp;·&nbsp;newsletter&nbsp;·&nbsp;sent to the list you own</>} caption="Written from the same week's material, in your voice.">
                  <NewsletterMockup data={newsletter} accent={prospectAccent} who={who} logoUrl={prospectLogo} />
                </Exhibit>
              )}
              {followUps && (
                <Exhibit label={<>Fig&nbsp;·&nbsp;follow-up sequence&nbsp;·&nbsp;offsets from day zero</>} caption="Runs on a fixed clock after the download.">
                  <FollowUpSequence data={followUps} accent={prospectAccent} who={who} />
                </Exhibit>
              )}
            </div>
          )}
          <ChapterCta line={<>The asset is built in your brand, {who}. The call decides where it lives.</>} />
        </Rev>

        {/* ── CHAPTER 03 · WARM OUTBOUND ──────── */}
        <Rev el="section" className="sec" id="cs-ch-outbound" style={{ scrollMarginTop: 76 }}>
          <SecHead
            label={<>Chapter 03&nbsp;·&nbsp;Warm outbound</>}
            title={<>The people who engage get a message.</>}
            note={<>Everyone who engages a post gets a message about that exact post. Useful, no pitch.</>}
          />
          <WinRows k="outbound" />
          {engager && (
            <div style={{ marginTop: 'clamp(24px,3vw,36px)' }}>
              <Exhibit
                label={<>Fig&nbsp;·&nbsp;warm engager outreach&nbsp;·&nbsp;keyed to your posts</>}
                caption={engagerNames.length ? <>First in line: {engagerNames.join('  ·  ')}. Real people from your comments.</> : undefined}
              >
                <EngagerOutreachMockup data={engager} accent={prospectAccent} who={who} />
              </Exhibit>
            </div>
          )}
          <div className="gov">
            <span><span className="sq" aria-hidden /> Warm only · people who engaged you</span>
            <span><span className="sq" aria-hidden /> ~15 requests a week · capped</span>
            <span><span className="sq" aria-hidden /> 27% warm acceptance in our lanes · cold sits near 14%</span>
            <span><span className="sq" aria-hidden /> It runs on auto-approve; a veto is there if you ever want it</span>
          </div>
          <ChapterCta line={<>The warm lane opens in week one. Effects observed in booked calls.</>} />
        </Rev>

        {/* ── PROOF · EFFECTS OBSERVED (unnumbered) ── */}
        <Rev el="section" className="sec">
          <SecHead
            label={<>Effects observed&nbsp;·&nbsp;on the engine today</>}
            title={<>Two founders run this engine already.</>}
            note="Real operators, real numbers. Both run the same three pillars this page just walked."
          />
          {/* Kyle Hunt — the before/after figure is the exhibit's dominant element */}
          <div className="pf">
            <div className="pf-top">
              <div className="pf-faces">
                <div className="pf-face"><img src="/content-system/kyle-portrait.webp" alt="Kyle Hunt" loading="lazy" onError={fallbackOnError} /><span className="nm">Kyle Hunt</span></div>
              </div>
              <div className="pf-figwrap">
                <div className="pf-figk">Agency MRR · Kyle Hunt · Agency Operators</div>
                <div className="pf-fig num"><span className="from">$30K/mo →</span> $80K/mo</div>
              </div>
            </div>
            <div className="pf-quote">&ldquo;Leads come in with a name and the guide they pulled. By the time we talk, they already know the offer.&rdquo;<span className="who">Kyle Hunt · Agency Operators, founder</span></div>
            <figure className="pf-sample"><img src="/content-system/kyle-guides.webp" alt="Kyle Hunt's guide library, generated and shipped by the engine" loading="lazy" onError={fallbackOnError} /></figure>
            <div className="pf-cap">Fig · Kyle&rsquo;s guide library, written and shipped by the engine, as it runs today.</div>
            <div className="kmet">
              {[
                { value: '30K', label: 'impressions per post' },
                { value: '~300', label: 'comments on a lead-magnet post' },
                { value: '100%', label: 'of his content, run by the system' },
              ].map((m, i) => (
                <div className="m" key={i}><div className="mv num">{m.value}</div><div className="ml">{m.label}</div></div>
              ))}
            </div>
          </div>
          {/* Lemonade — two founders, the monthly client figure dominant */}
          <div className="pf">
            <div className="pf-top">
              <div className="pf-faces">
                <div className="pf-face"><img src="/content-system/david-dinsmore.webp" alt="David Dinsmore" loading="lazy" onError={fallbackOnError} /><span className="nm">David Dinsmore</span></div>
                <div className="pf-face"><img src="/content-system/billy-mackie.webp" alt="Billy Mackie" loading="lazy" onError={fallbackOnError} /><span className="nm">Billy Mackie</span></div>
              </div>
              <div className="pf-figwrap">
                <div className="pf-figk">New clients · Lemonade</div>
                <div className="pf-fig num">5 <span className="from">new clients a month</span></div>
              </div>
            </div>
            <div className="pf-quote">&ldquo;Calls keep landing from the guides while we&rsquo;re heads-down with clients. Five a month, give or take.&rdquo;<span className="who">Lemonade · David Dinsmore &amp; Billy Mackie, co-founders</span></div>
            <figure className="pf-sample"><img src="/content-system/lemonade-thankyou.webp" alt="Lemonade's gated lead-capture page, built by the engine" loading="lazy" onError={fallbackOnError} /></figure>
            <div className="pf-cap">Fig · Lemonade&rsquo;s gated funnel page, built by the engine and live today.</div>
          </div>
        </Rev>

        {/* ── OPERATOR OF RECORD ──────────────── */}
        {/* No reveal wrapper: a fast scroll can outrun whileInView on cold cache, and the
            operator + final CTA must never strand invisible. Static render, always visible. */}
        <section className="sec">
          <div className="sec-label"><span className="sq" aria-hidden /> Operator of record</div>
          <div className="operator">
            <div className="op-portrait">
              <img src="/ivan-portrait-400.webp" alt="Ivan Manfredi" loading="lazy" onError={fallbackOnError} />
            </div>
            <div>
              <div className="op-h">I&rsquo;m Iván. I fill founders&rsquo; LinkedIn with content and lead magnets, on autopilot.</div>
              <p className="op-b">It&rsquo;s an inbound engine that writes your posts and lead magnets in your voice, publishes them, and brings leads in without you writing a thing. I run my own LinkedIn on the same setup I&rsquo;d build for you.</p>
              <div className="op-sig"><span className="sq" aria-hidden /> Iván Manfredi · operator · <a href="https://ivanmanfredi.com" target="_blank" rel="noopener noreferrer">ivanmanfredi.com</a></div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA · THE BOX (2 of 2, square; the page's single red button) ── */}
        <div className="ctawrap">
          <div className="box cta">
            <div className="box-head" style={{ justifyContent: 'center' }}>
              <span className="sqbig" aria-hidden />
              <span className="lbl">WARNING: EXCESSIVE INBOUND</span>
            </div>
            <div className="cta-h" style={{ marginTop: 'clamp(18px,2.4vw,26px)' }}>Be the sharpest voice in your space. Without writing a word.</div>
            <p className="cta-n">Book the free fit call. We&rsquo;ll scope it to your channels, formats, and voice, and you&rsquo;ll keep the audience, list, and every lead it builds.</p>
            <a className="cta-btn" href={bookUrl} target="_blank" rel="noopener noreferrer">Book the free fit call <span aria-hidden>→</span></a>
            <div className="cta-fine">Or just reply to the message this arrived in. The same operator answers.</div>
          </div>
        </div>
      </main>

      {/* ── FOOTER ──────────────────────────── */}
      <footer className="foot">
        <div className="wrap">
          <div className="foot-row">
            <Wordmark size={16} />
            <div className="foot-links">
              <a className="book" href={bookUrl} target="_blank" rel="noopener noreferrer">Book a call</a>
              <a href="https://ivanmanfredi.com" target="_blank" rel="noopener noreferrer">ivanmanfredi.com</a>
            </div>
          </div>
          <p className="foot-fine">Prepared for {founderFull}. Read from a live scan of your public presence, {scanDate}. Every sample above was drafted from your own material and is ready to ship.</p>
        </div>
      </footer>

      <AnimatePresence>
        {lmOpen && cs.sample_output?.lm && (
          <LmPreviewModal lm={cs.sample_output.lm} who={who} bookUrl={bookUrl} embedUrl={lmEmbedUrl} domain={scan?.domain || companyName} logoUrl={cs.sample_output.lm.brand?.logo_url} accentHex={cs.sample_output.lm.brand?.accent_hex || cs.sample_output.lm.accent_hex} companyName={companyName} onClose={() => setLmOpen(false)} />
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
      <span style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>{platformLabel}</span>
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
            fontFamily: BODY_SERIF,
            fontStyle: 'italic',
            fontSize: 'clamp(18px, 2.2vw, 22px)',
            lineHeight: 1.35,
            letterSpacing: '-0.01em',
            color: '#131210',
          }}
        >
          "{body.length > 220 ? body.slice(0, 217) + '…' : body}"
        </blockquote>
        {realTitle && (
          <p style={{ fontFamily: BODY_SERIF, fontSize: '14px', color: 'rgba(19,18,16,0.65)' }}>from {realTitle}</p>
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
      <div className="aspect-[16/10] overflow-hidden" style={{ background: '#FFFFFF' }}>
        <img src={initialImage!} alt={realTitle ?? `${platformLabel} ad creative`} className="w-full h-full object-cover" loading="lazy" onError={() => setImgFailed(true)} />
      </div>
      <div className="p-5 flex-1 flex flex-col gap-3">
        {platformChip}
        {realTitle && (
          <p style={{ fontFamily: SERIF, fontSize: '17px', lineHeight: 1.25, letterSpacing: '-0.01em', color: '#131210' }} className="line-clamp-2">{realTitle}</p>
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
    on_par: { label: 'On Par.', tone: '#131210', description: 'The awareness is there, but deployment lags behind leading firms in your tier.' },
    behind: { label: 'Behind.', tone: '#131210', description: 'No AI tooling detected on your side. Each month of delay compounds the gap.' },
    unknown: {
      label: 'Unknown.',
      suffix: "and that's data.",
      tone: 'rgba(19,18,16,0.85)',
      description: 'No verified AI provider, no LLM tooling in your public stack, no AI-themed posts in the last 30 days. Either your team is still scoping or the work is happening off-site. Both are gaps the Assessment closes.',
    },
  };
  const m = meta[signal] ?? meta.unknown;

  return (
    <Section id="ai-adoption" kicker="AI Adoption" title="Where you sit on the curve.">
      <div className="space-y-6 max-w-2xl">
        <h3 style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(2.5rem, 5vw, 4rem)', lineHeight: 1, letterSpacing: '-0.02em', color: m.tone }}>
          {m.label}
          {m.suffix && <span style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: INK }}> {m.suffix}</span>}
        </h3>
        <SerifBody large>{m.description}</SerifBody>
        {(anthropic_verified || openai_verified) && (
          <div className="px-5 py-4 border-l-2" style={{ borderColor: 'var(--color-accent)', background: 'rgba(19,18,16,0.04)' }}>
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
               className="flex items-start gap-4 py-5 hover:bg-[rgba(19,18,16,0.02)] transition-colors group border-b border-[color:var(--color-hairline)] last:border-b-0">
              <div className="flex-1">
                <p style={{ fontFamily: SERIF, fontSize: '20px', letterSpacing: '-0.01em', color: '#131210' }} className="group-hover:text-accent transition-colors">{c.title}</p>
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
            stroke="rgba(255,255,255,0.12)"
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
            stroke="rgba(255,255,255,0.08)" strokeWidth="1"
          />
        );
      })}
      <motion.path
        d={scorePath}
        fill="rgba(127,168,104,0.20)"
        stroke="#131210"
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
            style={{ fontFamily: '"Schibsted Grotesk", system-ui, -apple-system, sans-serif', fontSize: 9, letterSpacing: '0.1em', fill: 'rgba(255,255,255,0.55)', textTransform: 'uppercase' }}
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

  // Black Box: on the dark ink plane the score and bars are flat paper white (no color
  // grade scale — red is reserved for the wordmark). Per-dimension strength reads as tone
  // (opacity of white), never hue.
  const scoreColor = '#FFFFFF';
  const toneFor = (pct: number) =>
    pct >= 70 ? '#FFFFFF' : pct >= 40 ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.45)';

  return (
    <section
      // W2.4 — bumped vertical padding on mobile from py-20 (5rem = 80px) to py-24 (6rem = 96px) so
      // the score 52 has breathing room from the section edges; desktop unchanged
      className="py-20 lg:py-28"
      style={{ background: '#131210', color: '#FFFFFF' }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6">
        {/* Hairline sweep in sage — paints in left-to-right when section enters viewport */}
        <motion.div
          aria-hidden
          initial={reduceMotion ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.9, ease: EASE }}
          style={{ height: 1, background: 'rgba(255,255,255,0.18)', transformOrigin: 'left', marginBottom: '4rem' }}
        />

        <div className="mb-14 lg:mb-20">
          {/* Dark-band kicker — same pattern as paper sections but inverted (sage on dark stays sage) */}
          <div className="mb-1">
            <div className="flex items-center gap-3 mb-2">
              <span aria-hidden style={{ display: 'inline-block', height: 9, width: 9, background: '#FFFFFF' }} />
              <span style={{ fontFamily: SERIF, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
                Section 01
              </span>
            </div>
            <p style={{ fontFamily: SERIF, fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>
              The Breakdown
            </p>
          </div>
          <RevealHeadline
            style={{
              fontFamily: SERIF, fontWeight: 800,
              fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', lineHeight: 1.05,
              letterSpacing: '-0.035em', color: '#FFFFFF', marginTop: 12,
            }}
          >
            Where you're <span style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: '#FFFFFF' }}>winning</span>. Where you're <span style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: '#FFFFFF' }}>not</span>.
          </RevealHeadline>
          <SectionAnswer tone="dark">
            You scored {report.automation_score} out of 100. Grade {report.automation_grade}. Score below means more humans pasting fields. Higher means more systems doing the work.
          </SectionAnswer>
        </div>

        <div className="grid lg:grid-cols-[auto_1fr] gap-12 lg:gap-20 items-start">
          {/* Left: massive score */}
          <div>
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
              Automation Maturity Score
            </p>
            <p style={{
              fontFamily: SERIF, fontWeight: 800,
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
            <p style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
              / 100  ·  Grade <span style={{ color: scoreColor }}>{report.automation_grade}</span>
            </p>
            <p style={{ fontFamily: BODY_SERIF, fontSize: '13px', lineHeight: 1.5, color: 'rgba(255,255,255,0.55)', marginTop: 14, fontStyle: 'italic' }}>
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
              <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.4)' }}>
                Longer bar = stronger dimension. Shorter bar = the gap.
              </p>
              {cats.map(({ key, label }) => {
                const c = sb[key];
                if (!c) return null;
                const pct = Math.min(100, (c.value / c.max) * 100);
                const tone = toneFor(pct);
                return (
                  <div key={key} className="pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                    {/* Single horizontal row: label LEFT, bar BRIDGES the gap, score RIGHT.
                        The bar visually connects label to score so the eye reads them as one unit
                        instead of "label on left, score floating in void". Standard dashboard UX. */}
                    <div className="flex items-center gap-5 mb-3">
                      {/* Score sits on the LEFT now (user feedback: scores stuck to right read weird).
                          Layout: SCORE → LABEL → BAR fills remaining width. */}
                      <p style={{
                        fontFamily: BODY_SERIF, fontStyle: 'italic',
                        fontSize: 'clamp(1.75rem, 2.6vw, 2rem)', lineHeight: 1,
                        letterSpacing: '-0.02em', color: tone,
                        fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                        flexShrink: 0, minWidth: '64px',
                      }}>
                        {c.value}<span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginLeft: 4, fontStyle: 'normal' }}>/{c.max}</span>
                      </p>
                      <p style={{
                        fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em',
                        textTransform: 'uppercase', color: 'rgba(255,255,255,0.75)',
                        fontWeight: 600, flexShrink: 0, minWidth: '150px',
                      }}>
                        {label}
                      </p>
                      <div className="flex-1" style={{ height: 4, background: 'rgba(255,255,255,0.10)', position: 'relative' }}>
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
                      color: 'rgba(255,255,255,0.65)', lineHeight: 1.5,
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
    early_adopter: { label: 'Early Adopter.', tone: '#131210', description: 'You are actively integrating AI into operations. Ahead of the peer group.' },
    on_par:        { label: 'On Par.',        tone: '#131210', description: 'The awareness is there, but deployment lags behind leading firms in your tier.' },
    behind:        { label: 'Behind.',        tone: '#131210', description: 'No AI tooling detected on your side. Each month of delay compounds the gap.' },
    unknown:       { label: 'Unknown.',       tone: 'rgba(255,255,255,0.85)', description: "No verified AI provider, no LLM tooling in your public stack, no AI-themed posts in the last 30 days. Either your team is still scoping or the work is happening off-site." },
  };
  const m = meta[signal] ?? meta.unknown;
  return (
    <div className="mt-16 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="grid lg:grid-cols-[auto_1fr] gap-6 lg:gap-12 items-baseline">
        <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
          AI Posture
        </p>
        <div>
          <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 'clamp(1.5rem, 2.6vw, 2rem)', lineHeight: 1, color: m.tone }}>
            {m.label}
          </p>
          <p className="mt-2 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '16px', lineHeight: 1.55, color: 'rgba(255,255,255,0.78)' }}>
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
  const tone = diff > 0 ? '#131210' : '#131210';
  const label = diff > 0 ? `+${diff}` : `${diff}`;
  return (
    <div className="mt-16 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
      <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
        Peer median, {pm.size_tier_compared}
      </p>
      <div className="flex items-baseline gap-5 mt-3">
        <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 'clamp(2rem, 3vw, 2.75rem)', lineHeight: 1, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
          {pm.score}
        </p>
        <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: '20px', color: tone }}>
          ({label} vs them)
        </p>
      </div>
      <p className="mt-3 max-w-2xl" style={{ fontFamily: BODY_SERIF, fontSize: '17px', lineHeight: 1.55, color: 'rgba(255,255,255,0.78)' }}>
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
            <p style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 'clamp(16px, 1.6vw, 18px)', lineHeight: 1.5, color: '#131210' }}>
              "{p.text.length > 320 ? p.text.slice(0, 317) + '…' : p.text}"
            </p>
            <div className="mt-4 flex items-center gap-4" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.6)' }}>
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
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>
            Open roles
          </p>
          <p style={{
            fontFamily: BODY_SERIF, fontStyle: 'italic',
            fontSize: 'clamp(5rem, 9vw, 8rem)', lineHeight: 0.9,
            letterSpacing: '-0.04em', color: 'var(--color-accent)', marginTop: 10,
            fontVariantNumeric: 'tabular-nums',
          }}>
            <Scramble value={String(h.open_count)} duration={1.0} />
          </p>
          <p className="mt-3" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>
            via LinkedIn jobs
          </p>
        </div>
        {h.sample_titles && h.sample_titles.length > 0 && (
          <div>
            <p className="mb-4" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>
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
                  <p style={{ fontFamily: SERIF, fontSize: '20px', letterSpacing: '-0.01em', color: '#131210' }}>
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
            className="flex items-start gap-4 py-5 hover:bg-[rgba(19,18,16,0.02)] transition-colors group border-b border-[color:var(--color-hairline)] last:border-b-0"
          >
            <div className="flex-1">
              <p style={{ fontFamily: SERIF, fontSize: '20px', letterSpacing: '-0.01em', color: '#131210' }} className="group-hover:text-accent transition-colors">{n.title}</p>
              <div className="mt-1 flex items-center gap-3" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.6)' }}>
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
      <p className="mb-3" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(19,18,16,0.7)' }}>
        Built from <strong style={{ color: '#131210', fontWeight: 600 }}>14 public sources</strong>.
      </p>
      <details className="group">
        <summary
          className="cursor-pointer inline-flex items-center gap-2 list-none transition-colors"
          style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}
        >
          <span className="transition-transform group-open:rotate-90" aria-hidden style={{ display: 'inline-block', fontSize: '10px' }}>▸</span>
          See sources + what we couldn't see
        </summary>

        <div className="mt-8 space-y-8">
          <div>
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>
              How this report was generated
            </p>
            <SerifBody className="mt-3 max-w-2xl">
              We pulled signals from the 14 public sources below. Claude Opus 4.7 synthesized the patterns into the gap analysis and dollar estimates. Ivan reviews every report before it ships. <strong style={{ color: '#131210', fontWeight: 600 }}>Generated {today}.</strong>
            </SerifBody>
          </div>

          <div>
            <p className="mb-3" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>
              Sources pulled
            </p>
            <ul className="space-y-2 border-t border-[color:var(--color-hairline)]" style={{ listStyle: 'none', padding: 0 }}>
              {SOURCES.map((s) => (
                <li key={s.name} className="flex items-baseline gap-4 py-2 border-b border-[color:var(--color-hairline)]">
                  <span className="shrink-0" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.04em', color: '#131210', fontWeight: 600, minWidth: '180px' }}>
                    {s.name}
                  </span>
                  <span style={{ fontFamily: BODY_SERIF, fontSize: '14px', color: 'rgba(19,18,16,0.7)', lineHeight: 1.5 }}>
                    {s.what}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>
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
            border: '1px solid rgba(19,18,16,0.1)',
            fontFamily: MONO, fontSize: '11px', letterSpacing: '0.05em', color: '#131210', fontWeight: 600,
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
          style={{ width: 44, height: 44, objectFit: 'contain', background: '#fff', border: '1px solid rgba(19,18,16,0.08)', padding: 4 }}
          onError={() => setImgFailed(true)}
        />
      )}
      <p style={{ fontFamily: BODY_SERIF, fontSize: '14px', color: '#131210', fontWeight: 600, lineHeight: 1.3 }}>
        {name}
      </p>
      <p style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.5, color: 'rgba(19,18,16,0.7)' }}>
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
            fontWeight: 800,
            fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            color: '#131210',
          }}
        >
          Here's the <Italic highlight>move</Italic>.
        </h2>

        <SerifBody large className="mb-10 max-w-xl">
          <span style={{ color: 'rgba(19,18,16,0.8)' }}>
            Two steps, in order. The first one you can ship this week on your own. The second is the full 90-day build.
          </span>
        </SerifBody>

        {/* STEP 1 — Quick win the buyer can do themselves */}
        {w && (
          <div className="mb-10 max-w-2xl px-5 sm:px-6 lg:px-8 py-7 lg:py-8 -mx-5 sm:-mx-6 lg:-mx-8" style={{ background: 'rgba(19,18,16,0.06)', borderLeft: '3px solid var(--color-accent)' }}>
            <div className="flex items-center gap-3 mb-4">
              <span style={{ fontFamily: MONO, fontSize: '13px', letterSpacing: '0.28em', textTransform: 'uppercase', color: 'var(--color-accent)', fontWeight: 700 }}>
                Step 01
              </span>
              <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>
                This week, on your own
              </span>
            </div>
            <h3 style={{
              fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.5rem, 2.6vw, 2rem)',
              lineHeight: 1.1, letterSpacing: '-0.015em', color: '#131210',
            }}>
              {w.title}
            </h3>
            <SerifBody className="mt-3"><Emphasized>{w.why}</Emphasized></SerifBody>
            {(w.approach || (w.tools && w.tools.length > 0)) && (
              <p className="mt-4" style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.5, color: 'rgba(19,18,16,0.65)', fontStyle: 'italic' }}>
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
            <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>
              When you're ready to scale
            </span>
          </div>
          <h3 style={{
            fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.5rem, 2.6vw, 2rem)',
            lineHeight: 1.1, letterSpacing: '-0.015em', color: '#131210',
          }}>
            Hand us the whole scan. We build the 90-day system around it.
          </h3>
          <p className="mt-3 max-w-xl" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.55, color: 'rgba(19,18,16,0.75)' }}>
            The Assessment converts this report into a full build sequence (what ships first, what depends on what, ROI per phase) plus a 60-minute walkthrough with Ivan.
          </p>
        </div>

        {/* PRICE ANCHOR + CTA — comes IMMEDIATELY after Step 02 description so the action
            is adjacent to the prompt. No social-proof gap to scroll through first. */}
        <p className="mb-2 max-w-xl" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(19,18,16,0.7)', fontStyle: 'italic' }}>
          Costs less than the smallest opportunity above. Pays back inside the first month if even one ships.
        </p>
        <p className="mb-6" style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.85)' }}>
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
              backgroundColor: '#131210',
              color: '#FFFFFF',
            }}
          >
            Book your Agent-Ready Assessment <ArrowRight size={18} />
          </a>
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 sm:gap-5">
            <span style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.6)' }}>
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
                textDecorationColor: 'rgba(19,18,16,0.45)',
              }}
            >
              Book the free fit call <ArrowRight className="w-4 h-4 self-center transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>

        {/* SOCIAL PROOF moved BELOW the CTA. Buyer who clicks doesn't have to scroll past this.
            Buyer who needs more reassurance scrolls down and finds it. */}
        <div className="pt-10 max-w-3xl" style={{ borderTop: '1px solid rgba(19,18,16,0.10)' }}>
          <p className="mb-6" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>
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
            <p style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.55, color: 'rgba(19,18,16,0.75)' }}>
              <span style={{ color: '#131210', fontWeight: 600 }}>Ivan Manfredi</span> builds AI systems for B2B service businesses. Every project pays back in 90 days, or he doesn't build it. This scan is the same diagnostic he runs on every Assessment client.
            </p>
          </div>

          {/* Recent builds — client logos */}
          <p className="mb-6" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.55)' }}>
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
          fontFamily: SERIF, fontWeight: 800,
          fontSize: 'clamp(1.75rem, 3.8vw, 3rem)', lineHeight: 1.12,
          letterSpacing: '-0.02em', color: '#131210',
        }}>
          {pre}
          <em style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: INK, fontWeight: 400 }}>{emphasis}</em>
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
      reframe_emphasis: <em style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: INK, fontWeight: 400 }}>{platformStr}</em>,
      reframe_post: ` — ${totalAds} active ads running right now — but the path from click to booked meeting goes through a contact form into a Gmail inbox. The most expensive part of the funnel is the part with no system.`,
    };
  }
  // 2. Heavy hiring with no automation roles
  else if (hiringCount >= 3 && hiringTitles.length > 0) {
    const hasAiRole = hiringTitles.some(t => /AI|Automation|ML|Agent|Engineer/i.test(t));
    if (!hasAiRole) {
      content = {
        reframe_pre: 'You have ',
        reframe_emphasis: <em style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: INK, fontWeight: 400 }}>{hiringCount} open roles</em>,
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
        reframe_emphasis: <em style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: INK, fontWeight: 400 }}>{followers.toLocaleString()} followers</em>,
        reframe_post: ` and published ${posts} posts in 30 days. That's an audience that's already opted in — being talked to less often than your competitors' audiences.`,
      };
    }
  }
  // 4. High traffic, no visible conversion path
  else if (monthlyVisits >= 5000 && missingCapture) {
    content = {
      reframe_pre: 'Roughly ',
      reframe_emphasis: <em style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: INK, fontWeight: 400 }}>{monthlyVisits.toLocaleString()} monthly visitors</em>,
      reframe_post: " hit your site — and the only paths off the page are a contact form and a phone number. Everything in between (qualification, scheduling, follow-up) is human.",
    };
  }

  if (!content) return null;

  return (
    <ReframeBand kicker="The Signal" id="reframe">
      <p style={{
        fontFamily: SERIF, fontWeight: 800,
        fontSize: 'clamp(1.75rem, 3.8vw, 3rem)', lineHeight: 1.12,
        letterSpacing: '-0.02em', color: '#131210',
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
        <p className="mb-4" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.45)' }}>
          Spotted · Live Signal
        </p>
        <div className="flex gap-6 lg:gap-10 items-start max-w-3xl">
          {imgSrc && (
            <div className="shrink-0 w-20 h-20 lg:w-28 lg:h-28 overflow-hidden" style={{ border: '1px solid rgba(19,18,16,0.1)', background: '#FFFFFF' }}>
              <img src={imgSrc} alt="Active ad creative" className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
          <div style={wrapperStyle}>
            <p style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.4rem, 3vw, 2.25rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: '#131210' }}>
              Running <span style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: INK }}>{totalAds}</span> active {totalAds === 1 ? 'ad' : 'ads'} on {platformStr}.
            </p>
            {firstImageCreative.body && firstImageCreative.body.trim().length > 20 && (
              <p className="mt-2 max-w-xl line-clamp-2" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(19,18,16,0.6)', fontStyle: 'italic' }}>
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
        <p className="mb-4" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.45)' }}>
          Spotted · Live Spend
        </p>
        <div className="max-w-3xl">
          <p style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.4rem, 3vw, 2.25rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: '#131210' }}>
            <span style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: INK }}>{totalAds}</span> active {totalAds === 1 ? 'ad' : 'ads'} on {platformStr}.
          </p>
          <p className="mt-2" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(19,18,16,0.65)', fontStyle: 'italic' }}>
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
        <p className="mb-4" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.45)' }}>
          Spotted · Hiring Signal
        </p>
        <div className="max-w-3xl">
          <p style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.4rem, 3vw, 2.25rem)', lineHeight: 1.08, letterSpacing: '-0.02em', color: '#131210' }}>
            <span style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', color: INK }}>{hiringCount}</span> open {hiringCount === 1 ? 'role' : 'roles'} right now.
          </p>
          {report.hiring?.sample_titles && report.hiring.sample_titles.length > 0 && (
            <p className="mt-2" style={{ fontFamily: BODY_SERIF, fontSize: '15px', lineHeight: 1.5, color: 'rgba(19,18,16,0.65)' }}>
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
        <p className="mb-4" style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.45)' }}>
          Spotted · Recent Post
        </p>
        <blockquote
          className="max-w-2xl"
          style={{ fontFamily: BODY_SERIF, fontStyle: 'italic', fontSize: 'clamp(1.1rem, 2vw, 1.5rem)', lineHeight: 1.4, color: '#131210', borderLeft: '2px solid var(--color-accent)', paddingLeft: 16 }}
        >
          "{topPost.text.length > 280 ? topPost.text.slice(0, 277) + '…' : topPost.text}"
        </blockquote>
        {topPost.reactions != null && (
          <p className="mt-3" style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.45)' }}>
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
          background: open ? 'rgba(19,18,16,0.07)' : 'rgba(19,18,16,0.04)',
          borderLeft: '3px solid var(--color-accent)',
          transition: 'background 0.2s ease',
        }}
      >
        <div>
          <p style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(1.25rem, 2.2vw, 1.9rem)', lineHeight: 1.08, letterSpacing: '-0.015em', color: '#131210' }}>
            See the data behind every claim above.
          </p>
          <p className="mt-2" style={{ fontFamily: BODY_SERIF, fontSize: '14px', lineHeight: 1.5, color: 'rgba(19,18,16,0.6)' }}>
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
      <div className="pt-8 lg:pt-12 pb-12 lg:pb-20">
        <HeroDocByline scan={scan} />
        <AdminGrid companyName={companyName} scan={scan} />
        <div className="grid lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-end pt-10 lg:pt-16">
          <div>
            <CompanyLogo logoUrl={report.logo_url} domain={scan.domain} />
            <motion.h1
              initial={reduceMotion ? false : { y: 10 }}
              animate={{ y: 0 }}
              transition={{ delay: 0.15, duration: 0.7, ease: EASE }}
              style={{
                fontFamily: SERIF, fontWeight: 800, fontSize: 'clamp(3rem, 7vw, 6rem)',
                lineHeight: 0.94, letterSpacing: '-0.035em', color: INK, marginBottom: '1.25rem',
              }}
            >
              {companyName}
            </motion.h1>
            <p className="max-w-xl" style={{ fontFamily: BODY_SERIF, fontWeight: 400, fontSize: 'clamp(16px,1.6vw,19px)', lineHeight: 1.5, color: SEC }}>
              <Emphasized>{report.score_rationale}</Emphasized>
            </p>
          </div>
          <div className="lg:w-80 lg:shrink-0">
            <div style={{ fontFamily: SERIF, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10, color: MUTED }}>
              Automation Maturity Score
            </div>
            <div className="mt-3">
              <ScoreBar score={report.automation_score} grade={report.automation_grade} size="lg" />
            </div>
          </div>
        </div>
        <HeroTeaserSignals signals={report.teaser_signals} />
      </div>
    </div>
  );
};

// Document byline — square + doc-type + date, a hairline rule, then the reference number.
// The administrative title-block grammar of a regulatory document.
const scanRef = (scan: { completed_at: string | null; created_at: string }) => {
  const d = new Date(scan.completed_at ?? scan.created_at);
  return `SCN-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const HeroDocByline: React.FC<{ scan: { completed_at: string | null; created_at: string } }> = ({ scan }) => (
  <div className="flex items-center gap-3" style={{ fontFamily: SERIF, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 'clamp(9px,1.1vw,11px)', color: SEC }}>
    <span aria-hidden style={{ width: 9, height: 9, background: INK, flexShrink: 0 }} />
    <span className="whitespace-nowrap">
      AI Opportunity Scan&nbsp;&nbsp;·&nbsp;&nbsp;{new Date(scan.completed_at ?? scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
    </span>
    <span aria-hidden style={{ flex: '1 1 0%', height: 1, background: HAIR }} />
    <span className="whitespace-nowrap">Ref. {scanRef(scan)}</span>
  </div>
);

// Admin title-block table — 3 cells, ink top/bottom rules, hairline column dividers.
const AdminGrid: React.FC<{ companyName: string; scan: { domain: string } }> = ({ companyName, scan }) => {
  const cells: [string, string][] = [
    ['Prepared for', companyName],
    ['Scanned', scan.domain],
    ['Measured in', 'Booked calls & margin'],
  ];
  return (
    <div className="mt-6 lg:mt-8 grid grid-cols-1 sm:grid-cols-3" style={{ borderTop: `1px solid ${INK}`, borderBottom: `1px solid ${INK}` }}>
      {cells.map(([k, v], i) => (
        <div
          key={k}
          className={`py-4 sm:px-5 first:sm:pl-0 border-hairline ${i < 2 ? 'border-b sm:border-b-0 sm:border-r' : ''}`}
        >
          <div style={{ fontFamily: SERIF, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 10, color: MUTED }}>{k}</div>
          <div className="mt-1.5" style={{ fontFamily: SERIF, fontWeight: 500, letterSpacing: '-0.01em', fontSize: 'clamp(15px,1.9vw,19px)', color: INK }}>{v}</div>
        </div>
      ))}
    </div>
  );
};

const HeroTeaserSignals: React.FC<{ signals: string[] | undefined }> = ({ signals }) => {
  if (!signals || signals.length === 0) return null;
  return (
    <div className="mt-16 grid sm:grid-cols-3 gap-6 lg:gap-10">
      {signals.map((s, i) => (
        <div key={i} className="border-t-2 pt-4" style={{ borderColor: 'var(--color-accent)' }}>
          <p style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)', marginBottom: 8 }}>
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
  { id: 'cta',          label: 'Book a call' },
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
                  color: isActive ? 'var(--color-accent)' : 'rgba(19,18,16,0.4)',
                  fontWeight: isActive ? 600 : 400,
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'rgba(19,18,16,0.75)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = 'rgba(19,18,16,0.4)';
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

  // Record a prospect open once the report data resolves. Fire-and-forget;
  // the edge fn decides real-vs-owner server-side (IP + dashboard/?me=1 flag).
  useEffect(() => {
    if (scan && slug) trackScanOpen(slug);
  }, [scan, slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center" style={BLACKBOX_VARS}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
          <p style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(19,18,16,0.65)' }}>Loading report</p>
        </div>
      </div>
    );
  }

  if (error || !scan || !scan.report_json) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center" style={BLACKBOX_VARS}>
        <div className="text-center max-w-sm px-6">
          <AlertCircle className="w-12 h-12 text-ink-mute mx-auto mb-4" />
          <h1 style={{ fontFamily: SERIF, fontSize: '32px', color: '#131210' }} className="mb-2">Report not available</h1>
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

  // Route by offer. Trust the scans.matched_offer COLUMN as a fallback when report_json
  // doesn't carry matched_offer (pipeline-built scans set the column, not the json field) —
  // otherwise a content_system scan falls through to the audit layout and crashes on a
  // missing automation_grade.
  const offer = report.matched_offer ?? scan.matched_offer;

  // Call-intelligence prospects get a dedicated, cut-down pitch page (no automation
  // score, no $2k assessment) instead of the generic AI Opportunity Scan report.
  if (offer === 'call_intelligence' && report.call_intel) {
    return <CallIntelReport report={report} scan={scan} companyName={companyName} />;
  }

  // Content-system prospects (organic content engine + lead-magnet capture, one bundled offer)
  // get a dedicated personalized pitch instead of the generic AI Opportunity Scan report.
  if (offer === 'content_system' && report.content_system) {
    return <ContentSystemReport report={report} scan={scan} companyName={companyName} />;
  }

  return (
    <div className="min-h-screen bg-paper text-ink" style={BLACKBOX_VARS}>
      <ScrollProgress />
      {/* Header */}
      <header className="sticky top-0 z-30 border-b" style={{ background: PAPER, borderColor: INK }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          {/* Product wordmark — INBOUND + red ON + STEROIDS, one line. The red ON is the
              composition's single red per Black Box law. */}
          <Link to="/" className="inline-flex items-center hover:opacity-80 transition-opacity" aria-label="InboundOnSteroids">
            <Wordmark size={20} />
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            {/* Confidential strip */}
            <span className="hidden md:block" style={{ fontFamily: SERIF, fontWeight: 700, fontSize: '10px', letterSpacing: '0.05em', textTransform: 'uppercase', color: SEC }}>
              AI Opportunity Scan&nbsp;&nbsp;·&nbsp;&nbsp;Confidential to recipient
            </span>
            {/* CTA — href unchanged. Mobile: tighter label; desktop: full. */}
            <a
              href={`https://calendly.com/im-ivanmanfredi/30min?utm_source=scan`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-3 sm:px-4"
              style={{
                fontFamily: SERIF,
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                backgroundColor: INK,
                color: PAPER,
                minHeight: 40,
              }}
            >
              <span className="sm:hidden">Book</span>
              <span className="hidden sm:inline">Book your Assessment</span>
              <ArrowRight size={14} />
            </a>
          </div>
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
