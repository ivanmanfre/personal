import React, { useState, useEffect, useRef } from 'react';
import {
  motion,
  animate,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
  useScroll,
  useInView,
  MotionConfig,
} from 'framer-motion';
import { ArrowRight, Linkedin, Mail, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import LandingHero from './LandingHero';
import LiveEngineProof from './LiveEngineProof';

import BuildCardDiagram from './landing/diagrams/BuildCardDiagram';
import ProcessAssembly, { StageSnapshot } from './landing/diagrams/ProcessAssembly';
import EngineFlow from './landing/diagrams/EngineFlow';

// ─── Design tokens ───────────────────────────────────────────────────────────
const ease = [0.22, 0.84, 0.36, 1] as const;

// Honor OS-level reduced-motion. When set, every scroll-reveal below is skipped
// so sections render at full opacity on first paint — content never depends on
// the IntersectionObserver firing to become visible (closes the blank-section
// risk for reduced-motion users, fast programmatic scroll, and non-interactive
// full-page captures). Normal users are unaffected: prefersReduced === false
// yields the exact original animation objects. Complements the page-level
// <MotionConfig reducedMotion="user">, which only disables transform/layout
// motion and still lets opacity fade — this also kills the opacity fade.
const prefersReduced =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const inView = prefersReduced
  ? { initial: false as const, transition: { duration: 0 } }
  : {
      initial: { opacity: 0, y: 28 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: '-80px' } as const,
      transition: { duration: 0.85, ease },
    };

const T = {
  mono: {
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: '11px',
    letterSpacing: '0.22em',
    textTransform: 'uppercase' as const,
    color: '#5A5752',
  } as React.CSSProperties,
  serif: {
    fontFamily: '"Source Serif 4", Georgia, serif',
    fontWeight: 400,
    fontSize: '18px',
    lineHeight: 1.7,
    color: '#3D3D3B',
  } as React.CSSProperties,
  display: (size = 'clamp(2.4rem, 4vw, 3.8rem)'): React.CSSProperties => ({
    fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
    fontStyle: 'normal',
    fontWeight: 400,
    fontSize: size,
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
    color: '#1A1A1A',
  }),
};

const DIVIDER = { borderColor: 'rgba(26,26,26,0.1)' };

// ─── Label ───────────────────────────────────────────────────────────────────
const Label: React.FC<{ children: React.ReactNode; dark?: boolean }> = ({ children, dark }) => (
  <div style={{ ...T.mono, color: dark ? 'rgba(247,244,239,0.62)' : '#5A5752', marginBottom: '1.75rem' }}>
    {children}
  </div>
);

// ─── Numbered section intro (§4.5 + §4.4) ────────────────────────────────────
// Sharp-cornered black mono pill ("01"/"02") sitting against a 2px sage left-rule
// kicker. Replaces the bare floating "01" mono caption — gives every section a
// consistent, ownable editorial entry that reads as punctuation, never a circle.
const SectionIntro: React.FC<{ num: string; kicker: string }> = ({ num, kicker }) => (
  <div className="flex items-center gap-4" style={{ marginBottom: '1.5rem' }}>
    <span
      style={{
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.16em',
        color: '#F7F4EF',
        backgroundColor: '#1A1A1A',
        padding: '5px 9px',
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {num}
    </span>
    <span
      style={{
        ...T.mono,
        fontSize: '11px',
        color: '#5A5752',
        paddingLeft: '14px',
        borderLeft: '2px solid var(--color-accent)',
        lineHeight: 1.1,
      }}
    >
      {kicker}
    </span>
  </div>
);

// ─── RevealH2 — clean rise on scroll ─────────────────────────────────────────
// No blur (blur-on-every-headline was the generic-AI motion tell); a single
// decisive translate-rise matches the hero's mask reveal in character.
const RevealH2: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <motion.h2
    initial={prefersReduced ? false : { opacity: 0, y: 26 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    style={style}
  >
    {children}
  </motion.h2>
);

// ─── Spring counter ───────────────────────────────────────────────────────────
const Counter: React.FC<{ value: number; prefix?: string; style?: React.CSSProperties }> = ({ value, prefix = '', style }) => {
  const [displayed, setDisplayed] = useState(prefersReduced ? value : 0);
  const displayedRef = useRef(prefersReduced ? value : 0);
  const spanRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(spanRef, { once: true, margin: '-80px' });

  useEffect(() => {
    if (prefersReduced) { displayedRef.current = value; setDisplayed(value); return; }
    if (!isInView) return;
    const controls = animate(displayedRef.current, value, {
      duration: 0.65,
      ease: [0.22, 0.84, 0.36, 1] as [number, number, number, number],
      onUpdate: (v) => {
        const rounded = Math.round(v);
        displayedRef.current = rounded;
        setDisplayed(rounded);
      },
    });
    return () => controls.stop();
  }, [value, isInView]);

  return <span ref={spanRef} style={style}>{prefix}{displayed.toLocaleString()}</span>;
};

// ─── Magnetic CTA ─────────────────────────────────────────────────────────────
const MagneticCTA: React.FC<{
  href: string;
  variant?: 'primary' | 'ghost';
  dark?: boolean;
  children: React.ReactNode;
  fontSize?: string;
  px?: string;
}> = ({ href, variant = 'primary', dark, children, fontSize = '16px', px = 'px-7 py-3.5' }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 250, damping: 20 });
  const springY = useSpring(y, { stiffness: 250, damping: 20 });

  const variantStyle: React.CSSProperties = variant === 'primary'
    ? { backgroundColor: dark ? '#F7F4EF' : '#1A1A1A', color: dark ? '#1A1A1A' : '#F7F4EF' }
    : {
        fontStyle: 'italic',
        color: dark ? 'rgba(247,244,239,0.62)' : '#4A4A48',
        border: `1px solid ${dark ? 'rgba(247,244,239,0.15)' : 'rgba(26,26,26,0.14)'}`,
      };

  return (
    <div
      ref={wrapperRef}
      style={{ display: 'inline-block' }}
      onMouseMove={(e) => {
        if (!wrapperRef.current) return;
        const rect = wrapperRef.current.getBoundingClientRect();
        x.set((e.clientX - rect.left - rect.width / 2) * 0.28);
        y.set((e.clientY - rect.top - rect.height / 2) * 0.28);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
    >
      <motion.a
        href={href}
        style={{
          x: springX, y: springY,
          fontFamily: '"Source Serif 4", serif',
          fontWeight: 600,
          fontSize,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '10px',
          ...variantStyle,
        }}
        className={px}
      >
        {children}
      </motion.a>
    </div>
  );
};

// ─── Reviews ─────────────────────────────────────────────────────────────────
type Review = { text: string; project: string; author?: string; role?: string };

const REVIEWS: Review[] = [
  { text: "Ivan is top notch. Response time is incredible, he is eager to do the work and deliverables are high functioning products.", project: "N8N Inventory System", author: "Don Morrow", role: "Highland Tech" },
  { text: "Quality work and lightning fast. Would rehire him again without any doubt.", project: "Automation Build", author: "Michel de Wachter", role: "BNP Paribas Fortis" },
  { text: "Ivan has a sublime understanding of data manipulation, visualization, and automation. He is reliable and did a great job. Will rehire next time.", project: "Data & Automation Project", author: "Andrew Motiwalla", role: "The Good Life Abroad" },
  { text: "Working with Ivan has been an absolute game-changer. He exceeded all expectations and saved our team countless hours.", project: "Lead Flow & Slack Integration", author: "Camille Haas", role: "Head of Operations" },
  { text: "Ivan's one of those people where you see how he uses AI and immediately feel like you've been doing things the hard way. Walked away with a completely different approach.", project: "AI Orientation Session", author: "Cristian Trif", role: "Salesforce Consultant · 9 yrs" },
  { text: "His solutions helped uncover opportunities we were missing, directly impacting our bottom line.", project: "Make.com Workflow Audit", author: "Rodrigo Ibañez", role: "Managing Director" },
  { text: "Complete architectural overhaul. The documentation alone was worth the price.", project: "Enterprise Architecture", author: "Henrik Sund", role: "CTO" },
  { text: "As a current META developer, ex Amazon, very few things surprise me with AI. Ivan did. One conversation and I already had 3 things to implement in my workflow.", project: "AI Strategy Session", author: "Adeeb Mohammed", role: "Software Engineer · ex-Amazon · Meta" },
  { text: "Ivan is pure class, excellent, hard working and has attention to detail. Hire him.", project: "AI Voice Agent Infrastructure", author: "Priya Nair", role: "Co-Founder" },
  { text: "Very knowledgeable in n8n. Will be doing more projects with Ivan.", project: "SaaS Backend Automation", author: "Finn Gallagher", role: "Founder" },
];

// ─── Mid-funnel ask — quiet one-liner (2026-06-10) ───────────────────────────
// The hero ask and the calculator ask were ~5,000px apart (10 screens on
// mobile) with the entire persuasion core between them and nothing to click.
const MidCTA: React.FC<{ children: React.ReactNode; href?: string; linkText?: string }> = ({ children, href = '/start', linkText = 'Book the free fit call →' }) => (
  <motion.p
    {...inView}
    className="mt-12"
    style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '15.5px', color: '#5A5752', lineHeight: 1.6 }}
  >
    {children}{' '}
    <a
      href={href}
      style={{ color: 'var(--color-accent-ink)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: 'var(--color-accent)' }}
    >
      {linkText}
    </a>
  </motion.p>
);

// ─── Media query hook ────────────────────────────────────────────────────────
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

// ─── Proof band (beat 2) — real receipts at display scale, full-bleed hairlines ──
// NOTE: deliberately NO calculated figures here (e.g. the $146,870 is an example
// OUTPUT of the §06 calculator, not a receipt — it stays in its own context).
// Only vetted, defensible numbers live at the top of the page.
const METRICS = [
  { fig: '100+', label: 'Builds shipped', receipt: 'Systems shipped and running in production, including the one writing this feed.' },
  { fig: 'Daily', label: 'Posts in your voice', receipt: 'Posts, carousels, video, and lead magnets, out every day without you touching them.' },
  { fig: '~1 hr', label: 'Your week', receipt: 'You review and approve. The engine does the rest.' },
];

const ProofBand: React.FC = () => (
  <section className="border-t border-b" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-7xl">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/10">
        {METRICS.map((m, i) => (
          <motion.div
            key={m.label}
            initial={prefersReduced ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.7, ease, delay: i * 0.1 }}
            className="py-12 md:py-16 px-6 sm:px-9 first:sm:pl-0 last:sm:pr-0 text-left"
          >
            <div style={{ ...T.display('clamp(3.5rem,7vw,6rem)'), color: 'var(--color-accent)', lineHeight: 0.92, letterSpacing: '-0.02em', marginBottom: '14px' }}>
              {m.fig}
            </div>
            <div style={{ ...T.mono, marginBottom: '10px' }}>{m.label}</div>
            <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '15px', color: '#5A5752', lineHeight: 1.5, maxWidth: '26ch' }}>
              {m.receipt}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Section 1: Problem — "Sound familiar?" ──────────────────────────────────
const PROBLEM_LINES = [
  'You know LinkedIn inbound works. But posting daily, on top of running the agency, never actually happens.',
  "You tried a ghostwriter or an agency. The posts didn't sound like you, and the pipeline stayed flat.",
  'A full-time content hire is $5k to $8k a month, and you still have to manage them.',
  'So your own feed, the thing that should be selling your agency, sits quiet.',
];

const ProblemSection: React.FC = () => (
  <section className="py-24 md:py-32 border-t relative" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      {/* Asymmetric editorial grid: narrow intro rail on the left, the pain copy
          held in an offset reading column on the right. Breaks the centered-list
          feel that made 01 and 02 read as one endless run. */}
      <div className="grid md:grid-cols-12 gap-x-12 gap-y-10">
        <motion.div {...inView} className="md:col-span-5">
          <SectionIntro num="01" kicker="THE PROBLEM" />
          <RevealH2 style={{ ...T.display('clamp(2.6rem,4.4vw,4rem)'), marginBottom: 0, lineHeight: 1.02 }}>
            Sound{' '}
            <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
              familiar?
              <SageSweep delay={0.5} opacity={0.85} />
            </span>
          </RevealH2>
        </motion.div>

        <div className="md:col-span-7 md:col-start-6">
          {PROBLEM_LINES.map((line, i) => (
            <motion.p
              key={i}
              initial={prefersReduced ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.6, ease, delay: i * 0.08 }}
              className={`py-6 ${i === 0 ? '' : 'border-t'}`}
              style={{ ...T.serif, fontSize: '19px', borderColor: 'rgba(26,26,26,0.1)' }}
            >
              {line}
            </motion.p>
          ))}

          <motion.p
            initial={prefersReduced ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, ease, delay: 0.3 }}
            className="mt-10 pt-8 border-t"
            style={{
              fontFamily: '"DM Serif Display","Bodoni Moda",Georgia,serif',
              fontWeight: 400,
              fontSize: 'clamp(1.6rem,2.6vw,2.3rem)',
              lineHeight: 1.18,
              letterSpacing: '-0.02em',
              color: '#1A1A1A',
              maxWidth: '26ch',
              borderColor: 'var(--color-accent)',
              borderTopWidth: '2px',
            }}
          >
            There's a better way: a content system you own that runs it for you.
          </motion.p>
        </div>
      </div>
    </div>
  </section>
);

// ─── Section 02: How it works — the engine, animated (W3.6) ──────────────────
// The showcase. The EngineFlow diagram does the demonstrating; the copy is one
// scannable lede, not a wall. This replaces the old generic Diagnose/Design/
// Build process block as the page's "how it works" beat.
const EngineSection: React.FC = () => (
  <section className="py-24 md:py-32 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <motion.div {...inView} className="mb-14 md:mb-20 max-w-3xl">
        <SectionIntro num="02" kicker="HOW IT WORKS" />
        <RevealH2 style={{ ...T.display('clamp(2.5rem,4.4vw,4rem)'), lineHeight: 1.02, marginBottom: 0 }}>
          One system,{' '}
          <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
            idea to booked call.
            <SageSweep delay={0.5} opacity={0.85} />
          </span>
        </RevealH2>
        <p style={{ ...T.serif, fontSize: '18px', marginTop: '1.5rem', maxWidth: '54ch' }}>
          You record your voice once. From there the engine drafts, runs every
          piece through an anti-slop QA pass so nothing reads like AI, and ships
          every format daily. You review for about an hour a week.
        </p>
      </motion.div>

      <motion.div {...inView}>
        <EngineFlow />
      </motion.div>

      <MidCTA>Want to watch it run on your brand before you decide?</MidCTA>
    </div>
  </section>
);

// ─── Section 4: What I build · Real outcomes ─────────────────────────────────
const OUTCOMES = [
  {
    type: 'Sales-Call Auditor',
    category: 'Judgment-heavy AI',
    metric: '5% → 100%',
    metricLabel: 'of calls graded',
    story: "Their best manager could sample 5% of calls. Now every call is graded against her 8-criteria rubric, with risk routed within the hour.",
    qualifier: 'running daily · every call graded',
    pipeline: ['call', 'transcript', 'rubric', 'route'],
    href: '/work#case-01',
  },
  {
    type: 'Lead Magnet System',
    category: 'Productized build',
    metric: '15 min',
    metricLabel: 'idea to launched',
    story: "One typed idea becomes the full package: landing page, email, smart link, scheduled post.",
    qualifier: 'self-serve since launch',
    pipeline: ['idea', 'page', 'email', 'link', 'post'],
    href: '/work#case-02',
  },
  {
    type: 'SWPPP Automation',
    category: 'Back-office that runs itself',
    metric: 'Days of work → same-day',
    metricLabel: 'permit turnaround',
    story: "Permit work that needed multiple full-time researchers now runs intake-to-delivered across 50 states, and the team never grew.",
    qualifier: 'live across 50 states',
    pipeline: ['intake', 'rules', 'research', 'delivered'],
    href: '/work#case-03',
  },
  {
    type: 'Supplier Menu Sync',
    category: 'Inventory orchestration',
    metric: '15+ hrs/week',
    metricLabel: 'manual entry removed',
    story: "Inventory from WhatsApp, supplier sites, and Google Sheets auto-consolidates into one standardized sheet, refreshed hourly.",
    qualifier: 'refreshes hourly',
    pipeline: ['sources', 'consolidate', 'sheet'],
    href: '/work#case-06',
  },
];

const BuildOutcomesSection: React.FC = () => {
  const isMd = useMediaQuery('(min-width: 768px)');
  const [showAll, setShowAll] = useState(false);
  const visible = isMd || showAll ? OUTCOMES : OUTCOMES.slice(0, 2);

  return (
  <section className="py-12 md:py-20 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">

      <motion.div {...inView} className="mb-16 max-w-2xl">
        <Label>06</Label>
        <RevealH2 style={T.display('clamp(2.4rem,4vw,3.8rem)')}>
          The same hands<br />
          built these.
        </RevealH2>
        <p style={{ ...T.serif, fontSize: '16px', marginTop: '1.25rem' }}>
          The content engine is one of a hundred systems I have shipped and run myself. Here are a few more, all in production. Click into any build for the full story.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-x-12 gap-y-12">
        {visible.map((o, i) => (
          <motion.a
            key={o.type}
            href={o.href}
            initial={prefersReduced ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease, delay: i * 0.1 }}
            className="group flex flex-col border-t pt-7"
            style={{ borderColor: 'rgba(26,26,26,0.16)' }}
          >
            <div style={{ ...T.mono, marginBottom: '10px' }}>{o.category}</div>
            <h3 style={{ fontFamily: '"DM Serif Display","Bodoni Moda",Georgia,serif', fontWeight: 400, fontSize: 'clamp(1.5rem,1.8vw,1.85rem)', lineHeight: 1.1, letterSpacing: '-0.02em', color: '#1A1A1A', marginBottom: '1.5rem' }}>
              {o.type}
            </h3>
            <div style={{ fontFamily: '"DM Serif Display","Bodoni Moda",Georgia,serif', fontSize: 'clamp(1.6rem,2.2vw,2.2rem)', color: 'var(--color-accent)', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '5px' }}>
              {o.metric}
            </div>
            <div style={{ ...T.mono, marginBottom: '14px' }}>{o.metricLabel}</div>
            <div style={{ marginBottom: '18px' }}>
              <BuildCardDiagram labels={o.pipeline} />
            </div>
            <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '14.5px', color: '#5A5752', lineHeight: 1.6, flex: 1 }}>
              {o.story}
            </p>
            <div className="flex items-center justify-between gap-4 mt-5">
              <div style={{ ...T.mono, color: 'var(--color-accent-ink)', fontSize: '12px' }}>
                {o.qualifier}
              </div>
              <span style={{
                fontFamily: '"Source Serif 4",serif',
                fontSize: '13px',
                color: '#5A5752',
              }} className="group-hover:text-[var(--color-accent)] transition-colors whitespace-nowrap">
                Read case →
              </span>
            </div>
          </motion.a>
        ))}
      </div>

      {!isMd && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-8 w-full py-3.5"
          style={{
            fontFamily: '"Source Serif 4",serif', fontWeight: 600, fontSize: '15px',
            color: '#4A4A48', background: 'transparent', border: '1px solid rgba(26,26,26,0.18)', cursor: 'pointer',
          }}
        >
          Show 2 more builds ↓
        </button>
      )}

      <MidCTA>Want one of these running in your business?</MidCTA>
    </div>
  </section>
  );
};

// ─── Section 3: What Agent-Ready means ──────────────────────────────────────
// titlePre + pivot + titlePost — pivot is the italic phrase with sage sweep behind it
// Reusable sage highlighter sweep — same hand-painted SVG path as the hero.
// Sized to fit behind an italic word block via absolute positioning.
const SageSweep: React.FC<{ delay?: number; opacity?: number }> = ({ delay = 0.5, opacity = 0.78 }) => (
  <motion.svg
    initial={prefersReduced ? false : { scaleX: 0, opacity: 0 }}
    whileInView={{ scaleX: 1, opacity: 1 }}
    viewport={{ once: true, margin: '-40px' }}
    transition={{ delay, duration: 0.85, ease }}
    viewBox="0 0 400 100"
    preserveAspectRatio="none"
    aria-hidden="true"
    style={{
      position: 'absolute',
      left: '-4%',
      right: '-4%',
      top: '0.30em',
      width: '108%',
      height: '0.72em',
      transformOrigin: 'left',
      zIndex: -1,
      overflow: 'visible',
    }}
  >
    <path
      d="M 6 14 Q 70 10 140 14 Q 220 18 290 12 Q 350 15 394 16 L 394 86 Q 350 88 290 84 Q 220 92 140 86 Q 70 90 6 84 Z"
      fill="#2A8F65"
      opacity={opacity}
    />
  </motion.svg>
);

// What-changes section — paper-sunk band, header row + 2×2 grid (2026-06-10 v2).
// v1 (same-day) mirrored ProblemSection's numbered right-rail, which made
// sections 01 and 02 read as one endless list at the seam (217 words in a
// single viewport). The sunk band + grid breaks the pattern and halves the
// Six months from now — either/or split. FOMO via contrast, receipts only.
const FUTURES = {
  without: {
    label: 'WITHOUT THE ENGINE',
    lines: ["It's been three weeks since your last post, and you keep meaning to fix that.", 'You paid a ghostwriter and the posts read like everyone else on LinkedIn.', 'Your feed is quiet, so the inbound calls are too.', 'You closed the year on referrals and luck, the same as last year.'],
  },
  with: {
    label: 'WITH IT',
    lines: ['A post goes out every day, in your voice, without you lifting a finger.', 'A founder you never met books a call because your last post landed.', 'Lead magnets and carousels ship on their own. The pipeline stays full.', 'You own the system, so the inbound keeps coming whether I am around or not.'],
  },
};

const AgentReadySection: React.FC = () => (
  <section className="py-24 md:py-32 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <motion.div {...inView} className="mb-16 max-w-4xl">
        <SectionIntro num="05" kicker="WHAT CHANGES" />
        <RevealH2 style={{ ...T.display('clamp(2.5rem,4.6vw,4.25rem)'), lineHeight: 1.02, marginBottom: 0 }}>
          Six months from now,{' '}
          one of two things is true.
        </RevealH2>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-x-16 gap-y-12">
        {[FUTURES.without, FUTURES.with].map((f, col) => (
          <motion.div
            key={f.label}
            initial={prefersReduced ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease, delay: col * 0.12 }}
            className="pt-6"
            style={{ borderTop: col === 1 ? '2px solid var(--color-accent)' : '2px solid rgba(26,26,26,0.2)' }}
          >
            <div className="flex items-center gap-2" style={{ marginBottom: '16px' }}>
              {col === 1 && (
                <span aria-hidden="true" style={{ width: '7px', height: '7px', backgroundColor: 'var(--color-accent)', flexShrink: 0 }} />
              )}
              <span style={{ ...T.mono, color: col === 1 ? 'var(--color-accent-ink)' : '#5A5752' }}>{f.label}</span>
            </div>
            <div className="flex flex-col gap-3">
              {f.lines.map((l) => (
                <p key={l} style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '18px', lineHeight: 1.45, color: col === 1 ? '#1A1A1A' : '#5A5752' }}>
                  {l}
                </p>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <MidCTA href="/scorecard" linkText="See where you're leaking. 2 minutes →">
        Not ready for a call? Find out where your feed is leaking pipeline first.
      </MidCTA>
    </div>
  </section>
);

// ─── Comparison: Why not just hire a ghostwriter? ────────────────────────────
const COMPARE_COLS = ['Your system', 'Ghostwriter', 'In-house hire', 'DIY'] as const;
const COMPARE_ROWS: { label: string; cells: string[] }[] = [
  { label: 'Who writes it', cells: ['An engine in your voice', 'One writer', 'One hire', 'You'] },
  { label: 'Sounds like you', cells: ['Yes, anti-slop QA', 'Sometimes', 'Sometimes', 'Yes'] },
  { label: 'Formats', cells: ['Posts, carousels, video, lead magnets', 'Posts', 'Posts', 'Whatever you manage'] },
  { label: 'You own it after', cells: ["Yes, it's your system", 'No', 'No', 'Yes'] },
  { label: 'Your time / week', cells: ['About 1 hr review', '2 to 4 hrs', '5 to 10 hrs managing', '15 to 20 hrs'] },
  { label: 'Time to first leads', cells: ['About 30 days', '60 to 90 days', '90+ days', '6+ months'] },
];

const ComparisonSection: React.FC = () => (
  <section className="py-24 md:py-32 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <motion.div {...inView} className="mb-16 max-w-2xl">
        <SectionIntro num="04" kicker="THE COMPARISON" />
        <RevealH2 style={{ ...T.display('clamp(2.4rem,3.8vw,3.4rem)'), lineHeight: 1.02 }}>
          Why not just hire<br />a ghostwriter?
        </RevealH2>
      </motion.div>

      {/* Desktop / tablet: editorial data table. Figures + headers + labels all
          render IBM Plex Mono (§5c — data is the mono voice). The "Your system"
          column is accented with a 2px sage top-rule + a square sage bullet on the
          header, NOT a fill (sage is punctuation, never a background). */}
      <motion.div {...inView} className="hidden sm:block overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: '760px' }}>
          <thead>
            <tr>
              <th className="text-left align-bottom pb-5 pr-6" style={{ width: '20%' }} />
              {COMPARE_COLS.map((col, i) => (
                <th
                  key={col}
                  className="text-left align-bottom pb-5 px-6"
                  style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: i === 0 ? 'var(--color-accent-ink)' : '#1A1A1A',
                    borderBottom: i === 0 ? '2px solid var(--color-accent)' : '1px solid rgba(26,26,26,0.25)',
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    {i === 0 && (
                      <span aria-hidden="true" style={{ width: '7px', height: '7px', backgroundColor: 'var(--color-accent)', flexShrink: 0 }} />
                    )}
                    {col}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE_ROWS.map((row) => (
              <tr key={row.label} className="border-b" style={{ borderColor: 'rgba(26,26,26,0.08)' }}>
                <td
                  className="py-5 pr-6 align-top"
                  style={{ ...T.mono, fontSize: '11px', letterSpacing: '0.12em', color: '#5A5752' }}
                >
                  {row.label}
                </td>
                {row.cells.map((cell, i) => (
                  <td
                    key={i}
                    className="py-5 px-6 align-top"
                    style={{
                      fontFamily: '"IBM Plex Mono", monospace',
                      fontSize: '13px',
                      lineHeight: 1.55,
                      color: i === 0 ? '#1A1A1A' : '#7A766F',
                      fontWeight: i === 0 ? 600 : 400,
                      borderLeft: i === 0 ? '2px solid var(--color-accent)' : 'none',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>

      {/* Mobile: stacked cards, one per column. First card (your system) lifted
          with a soft shadow + sage top-rule for hierarchy; figures render mono. */}
      <div className="sm:hidden flex flex-col gap-7">
        {COMPARE_COLS.map((col, ci) => (
          <motion.div
            key={col}
            initial={prefersReduced ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, ease, delay: ci * 0.06 }}
            className="pt-5 px-5 pb-6"
            style={{
              borderTop: ci === 0 ? '2px solid var(--color-accent)' : '2px solid rgba(26,26,26,0.2)',
              backgroundColor: ci === 0 ? 'var(--color-paper-raise)' : 'transparent',
              boxShadow: ci === 0 ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <div className="flex items-center gap-2" style={{ marginBottom: '14px' }}>
              {ci === 0 && (
                <span aria-hidden="true" style={{ width: '7px', height: '7px', backgroundColor: 'var(--color-accent)', flexShrink: 0 }} />
              )}
              <span
                style={{
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: ci === 0 ? 'var(--color-accent-ink)' : '#1A1A1A',
                }}
              >
                {col}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {COMPARE_ROWS.map((row) => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span style={{ ...T.mono, color: '#5A5752', flexShrink: 0 }}>{row.label}</span>
                  <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '12.5px', lineHeight: 1.45, color: '#1A1A1A', textAlign: 'right' }}>
                    {row.cells[ci]}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <MidCTA>Want to see what it would write for you?</MidCTA>
    </div>
  </section>
);

// ─── Qualification: This isn't for every agency ──────────────────────────────
const QUALIFY = {
  built: [
    'Agencies doing $100k/mo or more, ready to scale.',
    'Founders who want to own the system, not rent a content team forever.',
    'Teams that can handle more inbound calls.',
  ],
  not: [
    'Pre-revenue, or no clear offer yet.',
    'Founders who want to write every post themselves.',
    'Anyone chasing viral hacks with no strategy.',
  ],
};

const QualificationSection: React.FC = () => (
  <section className="py-24 md:py-32 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      {/* Asymmetric: intro rail (left 5 cols) + the built-for / not-built-for
          contrast offset to the right 7. The two columns are an editorial
          contrast, not a symmetric card pair — sage square bullets carry the
          "built for" side, muted markers the "not". */}
      <div className="grid md:grid-cols-12 gap-x-12 gap-y-12">
        <motion.div {...inView} className="md:col-span-5">
          <SectionIntro num="05" kicker="THE FIT" />
          <RevealH2 style={{ ...T.display('clamp(2.4rem,3.8vw,3.4rem)'), lineHeight: 1.02 }}>
            This isn't for<br />every agency.
          </RevealH2>
          <p style={{ ...T.serif, fontSize: '17px', marginTop: '1.5rem', maxWidth: '34ch' }}>
            The engine pays back fastest for a specific kind of founder. Here is who it is, and who it isn't.
          </p>
        </motion.div>

        <div className="md:col-span-7 md:col-start-6 grid sm:grid-cols-2 gap-x-12 gap-y-12">
          {[
            { label: 'BUILT FOR', lines: QUALIFY.built, accent: true },
            { label: 'NOT BUILT FOR', lines: QUALIFY.not, accent: false },
          ].map((group, col) => (
            <motion.div
              key={group.label}
              initial={prefersReduced ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease, delay: col * 0.12 }}
              className="pt-6"
              style={{ borderTop: group.accent ? '2px solid var(--color-accent)' : '2px solid rgba(26,26,26,0.2)' }}
            >
              <div style={{ ...T.mono, color: group.accent ? 'var(--color-accent-ink)' : '#5A5752', marginBottom: '22px' }}>
                {group.label}
              </div>
              <div className="flex flex-col gap-5">
                {group.lines.map((l) => (
                  <div key={l} className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      style={{
                        marginTop: '0.5em',
                        width: '7px',
                        height: '7px',
                        flexShrink: 0,
                        backgroundColor: group.accent ? 'var(--color-accent)' : 'rgba(26,26,26,0.28)',
                      }}
                    />
                    <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '17px', lineHeight: 1.5, color: group.accent ? '#1A1A1A' : '#7A766F' }}>
                      {l}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

// ─── Section 5: How we work — Scene 2 pinned assembly ───────────────────────
const WorkSection: React.FC = () => {
  const steps = [
    {
      id: '01',
      title: 'Diagnose',
      desc: <>It starts with the free fit call. I map exactly <span style={{ fontWeight: 600, color: 'var(--color-accent-ink)' }}>where your time and money are leaking,</span> and hand you a plan ranked by how fast each build pays back.</>,
    },
    {
      id: '02',
      title: 'Design',
      desc: <>I draw the full system out, every data flow and integration, <span style={{ fontWeight: 600, color: 'var(--color-accent-ink)' }}>before anyone writes code.</span> You sign off on the spec, so what ships is what we agreed on.</>,
    },
    {
      id: '03',
      title: 'Build',
      desc: <>I build, test, and deploy into your existing stack. Your team uses it <span style={{ fontWeight: 600, color: 'var(--color-accent-ink)' }}>the day it launches.</span> You own all of it. The code, the integrations, and the data live in your stack, so if we ever stop, it keeps running without me.</>,
    },
  ];

  return (
    <section className="py-16 md:py-28 border-t" style={DIVIDER}>
      <div className="container mx-auto px-8 max-w-7xl">
        <motion.div {...inView} className="mb-12 lg:mb-20 max-w-4xl">
          <Label>07</Label>
          <RevealH2 style={{ ...T.display('clamp(2.8rem,5.5vw,5rem)'), lineHeight: 1.02 }}>
            Diagnose first.{' '}
            Build second.
          </RevealH2>
        </motion.div>

        {/* Desktop: pinned scroll-scrubbed assembly */}
        <div className="hidden lg:block">
          <ProcessAssembly steps={steps} />
        </div>

        {/* Mobile/narrow: static rows with stage glyphs — no pinned scrub below lg */}
        <div className="lg:hidden flex flex-col">
          {steps.map((step, i) => (
            <motion.div
              key={step.id}
              {...inView}
              className="grid grid-cols-[1fr_96px] gap-5 py-7 border-t items-center"
              style={DIVIDER}
            >
              <div>
                <div style={{ ...T.mono, color: 'var(--color-accent-ink)', fontSize: '11px', marginBottom: '6px' }}>{step.id}</div>
                <h3 style={{ ...T.display('1.6rem'), marginBottom: '8px' }}>{step.title}</h3>
                <p style={{ ...T.serif, fontSize: '15px', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
              <StageSnapshot stage={(i + 1) as 1 | 2 | 3} />
            </motion.div>
          ))}
        </div>

        <MidCTA>Want me to map where yours is leaking?</MidCTA>

      </div>
    </section>
  );
};

// ─── Section 4: Testimonials ─────────────────────────────────────────────────
// §04 — de-boxed: one oversized named pull-quote leads, the rest support quietly.
const TESTIMONIAL_LEAD = REVIEWS[7]; // Adeeb Mohammed — ex-Amazon · Meta
const TESTIMONIAL_SUPPORT = [REVIEWS[3], REVIEWS[4], REVIEWS[2], REVIEWS[5], REVIEWS[1], REVIEWS[6]];

const TestimonialsSection: React.FC = () => (
  <section className="py-12 md:py-20 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <motion.div {...inView} className="mb-12 md:mb-16">
        <Label>06</Label>
        <RevealH2 style={T.display('clamp(1.8rem,2.8vw,2.6rem)')}>
          In their words.
        </RevealH2>
      </motion.div>

      {/* Lead pull-quote — oversized, high-authority, named */}
      <motion.figure {...inView} className="mb-16 md:mb-20 max-w-5xl">
        <blockquote
          style={{
            ...T.display('clamp(2rem,4vw,3.6rem)'),
            color: '#1A1A1A',
            lineHeight: 1.12,
            letterSpacing: '-0.015em',
          }}
        >
          &ldquo;Very few things surprise me with AI.{' '}
          <span style={{ color: 'var(--color-accent)' }}>Ivan did.</span>&rdquo;
        </blockquote>
        <figcaption className="mt-7 flex items-baseline gap-x-3 gap-y-1 flex-wrap">
          <span style={{ fontFamily: '"Source Serif 4",serif', fontWeight: 600, fontSize: '17px', color: '#1A1A1A' }}>
            {TESTIMONIAL_LEAD.author}
          </span>
          <span style={{ ...T.mono, color: '#5A5752' }}>{TESTIMONIAL_LEAD.role}</span>
        </figcaption>
      </motion.figure>

      {/* Supporting — de-boxed, hairline-topped columns */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
        {TESTIMONIAL_SUPPORT.map((r, i) => (
          <motion.div
            key={r.author}
            initial={prefersReduced ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.55, ease, delay: (i % 3) * 0.08 }}
            className="pt-5 border-t"
            style={{ borderColor: 'rgba(26,26,26,0.14)' }}
          >
            <div style={{ ...T.mono, marginBottom: '12px', color: '#5A5752' }}>{r.project}</div>
            <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '16px', lineHeight: 1.55, color: '#1A1A1A', marginBottom: '16px' }}>
              &ldquo;{r.text}&rdquo;
            </p>
            <div style={{ fontFamily: '"Source Serif 4",serif', fontWeight: 600, fontSize: '14px', color: '#1A1A1A' }}>{r.author}</div>
            <div style={{ ...T.mono, fontSize: '12px', color: '#5A5752' }}>{r.role}</div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Section 5: 90-Day Payback ───────────────────────────────────────────────
const PaybackSection: React.FC = () => {
  const [hours, setHours] = useState(20);
  const [rate, setRate] = useState(150);
  const yearly = hours * rate * 52;
  const maxBuild = Math.round(yearly * (90 / 365));
  const qualifies = maxBuild >= 2000;

  return (
    <section
      className="py-12 md:pt-20 md:pb-28 border-t"
      style={DIVIDER}
    >
      <div className="container mx-auto px-8 max-w-6xl">

        <motion.div {...inView} className="mb-16">
          <Label>08</Label>
          <RevealH2 style={{ ...T.display('clamp(2.8rem,5.5vw,5rem)'), marginBottom: '1.25rem' }}>
            The 90-Day<br />Payback Rule.
          </RevealH2>
          <p style={{ ...T.serif, maxWidth: '480px' }}>
            Every build is scoped to pay back within 90 days or I don't build it.
            Plug in your numbers and see how much we can invest while still hitting that bar.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">

          <motion.div initial={prefersReduced ? false : { opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.85, ease }} className="border p-10" style={{ ...DIVIDER, backgroundColor: 'var(--color-paper)' }}>
            <div className="space-y-10">
              {[
                { label: 'Hours lost per week', value: hours, setValue: setHours, min: 5, max: 100, step: 5, fmt: (v: number) => `${v} hrs`, range: ['5 hrs', '100 hrs'] },
                { label: 'Blended hourly value', value: rate, setValue: setRate, min: 50, max: 500, step: 25, fmt: (v: number) => `$${v}/hr`, range: ['$50', '$500'] },
              ].map((field) => (
                <div key={field.label}>
                  <div className="flex justify-between items-baseline mb-4">
                    <span style={T.mono}>{field.label}</span>
                    <span style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: '18px', color: '#1A1A1A', fontWeight: 500 }}>{field.fmt(field.value)}</span>
                  </div>
                  <input type="range" min={field.min} max={field.max} step={field.step} value={field.value} onChange={(e) => field.setValue(Number(e.target.value))} className="stat-slider w-full" />
                  <div className="flex justify-between mt-2" style={{ ...T.mono, fontSize: '11px' }}>
                    <span>{field.range[0]}</span><span>{field.range[1]}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '14px', color: '#5A5752', lineHeight: 1.5, marginTop: '24px' }}>
              Blended value: what an hour of the affected people's time is worth to the business.
            </p>
          </motion.div>

          <motion.div initial={prefersReduced ? false : { opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.85, ease }} className="flex flex-col gap-5">

            <div className="border p-8 md:p-10" style={{ ...DIVIDER, backgroundColor: 'var(--color-paper)' }}>
              <div style={{ ...T.mono, marginBottom: '14px' }}>Annual cost of the work you're doing by hand</div>
              <Counter value={yearly} prefix="$" style={{ ...T.display('clamp(3.4rem,6.5vw,6rem)'), lineHeight: 0.95, letterSpacing: '-0.02em' }} />
            </div>

            <div className="border p-8" style={{ ...DIVIDER, backgroundColor: 'var(--color-paper)', borderLeftWidth: '2px', borderLeftColor: qualifies ? 'var(--color-accent)' : 'rgba(26,26,26,0.2)' }}>
              <div style={{ ...T.mono, marginBottom: '10px' }}>Max build budget for 90-day payback</div>
              <Counter
                value={maxBuild}
                prefix="$"
                style={{ ...T.display('clamp(2.4rem,4.5vw,4rem)'), color: qualifies ? 'var(--color-accent)' : '#1A1A1A' }}
              />
              <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '14px', color: '#5A5752', lineHeight: 1.5, marginTop: '10px' }}>
                {qualifies
                  ? 'That budget covers a real build, scoped to what this number says.'
                  : "Below the threshold for a build. We'd need to find a process where more is leaking, or start with the scorecard."}
              </p>
            </div>

            <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '14.5px', color: '#5A5752', lineHeight: 1.5 }}>
              Every quarter you wait costs about{' '}
              <span style={{ fontStyle: 'normal', fontWeight: 600, color: '#1A1A1A' }}>${Math.round(yearly / 4).toLocaleString()}</span>.
              {' '}The diagnosis takes one week.
            </p>

            <motion.a
              href="/start"
              whileHover={{ y: -2 }}
              transition={{ duration: 0.18 }}
              className="flex items-center justify-between px-7 py-4"
              style={{ fontFamily: '"Source Serif 4",serif', fontWeight: 600, fontSize: '16px', backgroundColor: '#1A1A1A', color: '#F7F4EF' }}
            >
              <span>See if it's a fit</span>
              <ArrowRight size={18} />
            </motion.a>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

// ─── Section 6: The Offer ─────────────────────────────────────────────────────
const OFFER_BUILDS = [
  {
    id: '01',
    name: 'Content System',
    price: 'Live in 30 days',
    cadence: 'Fixed price · scoped on the fit call',
    desc: 'A content engine trained on your voice plus the lead magnets it feeds, filling your pipeline while you run the business.',
    href: '/content-system',
    cta: 'Scope your build',
    signature: true,
  },
  {
    id: '02',
    name: 'Call Intelligence',
    price: 'More closes, fewer churns',
    cadence: 'Fixed price · scoped on the fit call',
    desc: "Once the feed is filling your pipeline: score every sales call, flag accounts about to churn, and see why deals slip.",
    href: '/call-intelligence',
    cta: 'See how it works',
  },
  {
    id: '03',
    name: 'Fractional AI Partner',
    price: 'Build by build',
    cadence: 'No retainer',
    desc: 'Once the content engine is filling your pipeline, most agencies install the next system, then the next, across Demand, Pipeline, Conversion, Delivery, and Command. A partner who ships every month, no retainer.',
    href: '/fractional',
    cta: 'See how it works',
  },
];

const OfferSection: React.FC = () => (
  <section className="py-16 md:py-24 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <motion.div {...inView} className="mb-12 md:mb-16 max-w-2xl">
        <Label>07</Label>
        <RevealH2 style={T.display('clamp(2.4rem,4vw,3.8rem)')}>
          Pick the build that<br />
          <span style={{ position: 'relative', display: 'inline-block' }}>
            pays back fastest.
            <SageSweep delay={0.6} opacity={0.85} />
          </span>
        </RevealH2>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-5">
        {OFFER_BUILDS.map((b, i) => (
          <motion.a
            key={b.id}
            href={b.href}
            initial={prefersReduced ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.7, ease, delay: i * 0.08 }}
            className="group flex flex-col p-8 md:p-9 border"
            style={{ borderColor: 'rgba(26,26,26,0.12)', backgroundColor: 'var(--color-paper)', position: 'relative' }}
          >
            {b.signature && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', backgroundColor: 'var(--color-accent)' }} />
            )}
            <div className="flex items-center justify-between mb-6">
              <span style={{ ...T.mono, marginBottom: 0 }}>{b.id}</span>
              {b.signature && (
                <span style={{ ...T.mono, color: 'var(--color-accent-ink)', marginBottom: 0 }}>Signature</span>
              )}
            </div>
            <h3 style={{ ...T.display('1.7rem'), marginBottom: '1rem' }}>{b.name}</h3>
            <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '20px', color: 'var(--color-accent-ink)', letterSpacing: '-0.01em', marginBottom: '0.4rem' }}>{b.price}</div>
            <div style={{ ...T.mono, marginBottom: '1.5rem' }}>{b.cadence}</div>
            <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '15px', lineHeight: 1.6, color: '#5A5752', marginBottom: '1.75rem', flex: 1 }}>{b.desc}</p>
            <div className="flex items-center gap-2" style={{ fontFamily: '"Source Serif 4", serif', fontWeight: 600, fontSize: '14px', color: 'var(--color-accent-ink)' }}>
              {b.cta}
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
            </div>
          </motion.a>
        ))}
      </div>

      <motion.div {...inView} className="mt-12 flex flex-col items-center gap-6">
        <MagneticCTA href="/start" variant="primary" fontSize="17px" px="px-9 py-4">
          Book your fit call <ArrowRight size={18} />
        </MagneticCTA>
        <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontSize: '14.5px', color: '#5A5752', textAlign: 'center', maxWidth: '520px', lineHeight: 1.6 }}>
          Working on something that's not here?{' '}
          <a href="/start" style={{ color: 'var(--color-accent-ink)', textDecoration: 'underline', textDecorationColor: 'var(--color-accent)', textUnderlineOffset: '3px' }}>
            The call is for that too
          </a>
          . I scope custom builds for agencies every week.
        </p>
      </motion.div>
    </div>
  </section>
);

// ─── Section 7: Final CTA — founder block ─────────────────────────────────────
const FinalCTA: React.FC = () => (
  <section className="border-t relative overflow-hidden" style={{ borderColor: 'rgba(247,244,239,0.12)', backgroundColor: '#1A1A1A' }}>
    <div className="grid lg:grid-cols-[minmax(0,46%)_1fr]">
      {/* Portrait — left, full-bleed, sage rule on right edge */}
      <div className="relative" style={{ minHeight: '440px' }}>
        <img
          src="/ivan-portrait.jpg"
          alt="Iván Manfredi"
          className="absolute inset-0 w-full h-full object-cover portrait-editorial"
          style={{ objectPosition: '50% 30%' }}
        />
        <div
          className="hidden lg:block absolute top-0 right-0 h-full"
          style={{ width: '2px', backgroundColor: '#2A8F65' }}
          aria-hidden="true"
        />
        <div
          className="lg:hidden absolute bottom-0 left-0 w-full"
          style={{ height: '2px', backgroundColor: '#2A8F65' }}
          aria-hidden="true"
        />
      </div>

      {/* Copy — right */}
      <motion.div {...inView} className="flex flex-col justify-center px-8 md:px-14 py-14 md:py-20">
        <div className="max-w-xl">
          <div style={{ ...T.mono, color: 'var(--color-accent-light)', marginBottom: '1.75rem' }}>
            08 / WORK WITH ME
          </div>
          <RevealH2 style={{ ...T.display('clamp(2.1rem,3.4vw,3.4rem)'), color: '#F7F4EF', marginBottom: '1.5rem', lineHeight: 1.08 }}>
            Iván Manfredi.<br />
            <span style={{ color: 'var(--color-accent-light)' }}>100+ builds, in production.</span>
          </RevealH2>
          <p style={{ fontFamily: '"Source Serif 4", Georgia, serif', fontWeight: 400, fontSize: '17px', lineHeight: 1.65, color: 'rgba(247,244,239,0.72)', marginBottom: '2.25rem', maxWidth: '480px' }}>
            Everything I build, I build and run myself. The posts and the DM that found you
            came from{' '}
            <a href="/content-system" style={{ color: 'rgba(247,244,239,0.95)', textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: 'var(--color-accent)' }}>
              the same content engine
            </a>
            . Book the call and I'll show you exactly what it would post for your agency, even if we never work together.
          </p>
          <div className="flex items-center">
            <MagneticCTA href="/start" variant="primary" dark fontSize="17px" px="px-8 py-4">
              Book your fit call <ArrowRight size={18} />
            </MagneticCTA>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

// ─── Footer — newsletter, socials, links ─────────────────────────────────────
const BEACON_URL = 'https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/lm-beacon';

const LandingFooter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch(BEACON_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'capture',
          lm_slug: 'agent-ready-letter',
          email,
          src: 'landing-footer',
        }),
      });
      if (!res.ok) throw new Error('subscribe failed');
      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  };

  return (
    <footer className="border-t pt-16 md:pt-24 pb-10" style={{ ...DIVIDER, backgroundColor: 'var(--color-paper)' }}>
      <div className="container mx-auto px-8 max-w-5xl">

        {/* Newsletter */}
        <div className="text-center mb-12 md:mb-20 max-w-xl mx-auto">
          <Label>The Agent-Ready Letter</Label>
          <p style={{ ...T.serif, fontSize: '16px', marginBottom: '1.5rem' }}>
            What I built this week, and what it changed. Weekly, for agency founders.
          </p>

          {status === 'success' ? (
            <div className="inline-flex items-center gap-2.5 px-5 py-3 border" style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}>
              <Check size={16} strokeWidth={2.5} />
              <span style={{ fontFamily: '"Source Serif 4",serif', fontStyle: 'italic', fontSize: '14px' }}>
                Subscribed. First letter arrives within 15 minutes.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                disabled={status === 'loading'}
                className="flex-1 px-4 py-3"
                style={{
                  fontFamily: '"Source Serif 4",serif',
                  fontSize: '15px',
                  border: '1px solid rgba(26,26,26,0.18)',
                  backgroundColor: 'var(--color-paper)',
                  color: '#1A1A1A',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-6 py-3"
                style={{
                  fontFamily: '"Source Serif 4",serif',
                  fontWeight: 600,
                  fontSize: '15px',
                  backgroundColor: '#1A1A1A',
                  color: '#F7F4EF',
                  border: 'none',
                  cursor: status === 'loading' ? 'wait' : 'pointer',
                  opacity: status === 'loading' ? 0.6 : 1,
                }}
              >
                {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
              </button>
            </form>
          )}
          {status === 'error' && (
            <p style={{ fontFamily: '"Source Serif 4",serif', fontStyle: 'italic', fontSize: '13px', color: '#B85450', marginTop: '12px' }}>
              Something went wrong. Try again or email im@ivanmanfredi.com.
            </p>
          )}
        </div>

        {/* Wordmark + socials — oversized closing signature (footer finale) */}
        <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-8 mb-12 pt-12 border-t" style={DIVIDER}>
          <div className="text-center md:text-left">
            <div style={{ ...T.display('clamp(2.6rem,5vw,4.5rem)'), fontStyle: 'normal', lineHeight: 0.95, letterSpacing: '-0.02em', marginBottom: '8px' }}>
              Iván <span style={{ fontStyle: 'italic' }}>Manfredi</span>
            </div>
            <p style={T.mono}>Agent-Ready Ops™</p>
          </div>

          <div className="flex gap-2.5">
            {[
              { Icon: Linkedin, href: 'https://www.linkedin.com/in/iv%C3%A1n-manfredi-120841202/', label: 'LinkedIn' },
              { Icon: Mail, href: 'mailto:im@ivanmanfredi.com', label: 'Email' },
            ].map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
                aria-label={label}
                className="w-11 h-11 flex items-center justify-center transition-colors"
                style={{
                  border: '1px solid rgba(26,26,26,0.18)',
                  color: 'rgba(26,26,26,0.65)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1A1A1A';
                  e.currentTarget.style.color = '#F7F4EF';
                  e.currentTarget.style.borderColor = '#1A1A1A';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'rgba(26,26,26,0.65)';
                  e.currentTarget.style.borderColor = 'rgba(26,26,26,0.18)';
                }}
              >
                <Icon size={18} strokeWidth={2} aria-hidden />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4" style={{ ...DIVIDER, ...T.mono, fontSize: '11px' }}>
          <p>© {new Date().getFullYear()} Iván Manfredi · All rights reserved</p>
          <div className="flex gap-7">
            <Link to="/store" style={{ color: '#5A5752', transition: 'color 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#1A1A1A'} onMouseLeave={(e) => e.currentTarget.style.color = '#5A5752'}>Store</Link>
            <a href="/scorecard" style={{ color: '#5A5752' }} onMouseEnter={(e) => e.currentTarget.style.color = '#1A1A1A'} onMouseLeave={(e) => e.currentTarget.style.color = '#5A5752'}>Scorecard</a>
            <a href="mailto:im@ivanmanfredi.com" style={{ color: '#5A5752' }} onMouseEnter={(e) => e.currentTarget.style.color = '#1A1A1A'} onMouseLeave={(e) => e.currentTarget.style.color = '#5A5752'}>Contact</a>
          </div>
        </div>

      </div>
    </footer>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────
// ─── Sticky mini-CTA — docks after the fold, hides near the footer ───────────
// +14% mobile lift on scrolling pages (2026 conversion study); the sticky
// absorbs most of the CTA benefit once the hero scrolls off. Mobile: full-width
// bottom bar. Desktop: compact bottom-right. Sharp corners (brand), soft shadow.
const StickyCTA: React.FC = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      const docH = document.documentElement.scrollHeight;
      const nearBottom = y + vh > docH - vh * 1.25;
      setShow(y > vh * 0.9 && !nearBottom);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <motion.a
      href="/start"
      initial={false}
      animate={{ opacity: show ? 1 : 0, y: show ? 0 : 16 }}
      transition={{ duration: 0.35, ease }}
      className="fixed z-[9997] inline-flex items-center justify-center gap-2 left-4 right-4 bottom-4 py-3.5 sm:left-auto sm:right-6 sm:bottom-6 sm:px-7"
      style={{
        fontFamily: '"Source Serif 4", serif',
        fontWeight: 600,
        fontSize: '15px',
        backgroundColor: '#1A1A1A',
        color: '#F7F4EF',
        boxShadow: '0 10px 34px rgba(26,26,26,0.20)',
        pointerEvents: show ? 'auto' : 'none',
      }}
      aria-hidden={!show}
    >
      Book the fit call <ArrowRight size={16} />
    </motion.a>
  );
};

const LandingPage: React.FC = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Iván Manfredi · The AI Content Engine for Agencies';
    return () => { document.title = prev; };
  }, []);

  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const [pointerActive, setPointerActive] = useState(false);
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 22 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 22 });
  const xPct = useTransform(springX, (x) => `${x * 100}%`);
  const yPct = useTransform(springY, (y) => `${y * 100}%`);
  const spotlight = useMotionTemplate`radial-gradient(600px circle at ${xPct} ${yPct}, rgba(42,143,101,0.09), transparent 70%)`;

  return (
    <MotionConfig reducedMotion="user">
    <div
      style={{ backgroundColor: 'var(--color-paper)', position: 'relative' }}
      onMouseMove={(e) => {
        if (!pointerActive) setPointerActive(true);
        mouseX.set(e.clientX / window.innerWidth);
        mouseY.set(e.clientY / window.innerHeight);
      }}
    >
      {/* Page-wide paper grain — static material texture, very subtle (P5 floor) */}
      <div
        aria-hidden="true"
        className="pointer-events-none"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 30,
          opacity: 0.04,
          mixBlendMode: 'multiply',
          backgroundImage:
            'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22/></filter><rect width=%22160%22 height=%22160%22 filter=%22url(%23n)%22/></svg>")',
          backgroundSize: '160px 160px',
        }}
      />
      {/* Left-edge scroll progress — sage line fills as you scroll */}
      <motion.div
        style={{
          position: 'fixed',
          left: 0, top: 0,
          width: '2px',
          height: '100vh',
          backgroundColor: '#2A8F65',
          scaleY,
          transformOrigin: 'top',
          zIndex: 9998,
          opacity: 0.65,
        }}
      />
      {/* Fixed sage cursor spotlight — desktop only (touch devices have no cursor;
          leaving it on creates a static green blob in the middle of the screen). */}
      <motion.div
        className="pointer-events-none hidden lg:block"
        style={{ background: spotlight, position: 'fixed', inset: 0, zIndex: 9999, opacity: pointerActive ? 1 : 0, transition: 'opacity 0.8s' }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* W3.4 — focused content-engine narrative for a cold agency visitor:
            hook → proof band → problem → how it works (the engine, animated) →
            proof it runs (the live feed) → comparison → fit → social proof →
            offer → close. Cut from Wave 2: the unrelated automation cases
            (BuildOutcomes), the hours-saved calculator (Payback), the generic
            Diagnose/Design/Build process (Work), and the twin future-pacing
            beat (AgentReady). */}
        <LandingHero />
        <ProofBand />
        <ProblemSection />
        <EngineSection />
        <LiveEngineProof />
        <ComparisonSection />
        <QualificationSection />
        <TestimonialsSection />
        <OfferSection />
        <FinalCTA />
        <LandingFooter />
      </div>
      <StickyCTA />
    </div>
    </MotionConfig>
  );
};

export default LandingPage;
