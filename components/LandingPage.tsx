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
import Marquee from './Marquee';

import BuildCardDiagram from './landing/diagrams/BuildCardDiagram';
import ProcessAssembly, { StageSnapshot } from './landing/diagrams/ProcessAssembly';
import SystemFlowDiagram from './SystemFlowDiagram';
import { PROMISES } from '../lib/contentSystemContent';

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
    color: '#2E2D2A',
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
  { fig: '100+', label: 'Systems built', receipt: 'Designed and run by me, including the engine behind my own LinkedIn.' },
  { fig: '5+', unit: '/wk', label: 'Posts in your voice', receipt: 'Posts, carousels, video, and lead magnets, out without you touching them.' },
  { fig: '~1', unit: 'hr', label: 'Your time', receipt: 'You review and approve. The engine does the rest.' },
];

// Compact credential strip — refined, not gigantic. Figures sit at a calm
// editorial scale in ink (the old 6rem sage numerals read garish); the sage
// lives only on the small mono label. A quiet receipt under each.
const ProofBand: React.FC = () => (
  <section className="border-t border-b" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/10">
        {METRICS.map((m, i) => (
          <motion.div
            key={m.label}
            initial={prefersReduced ? false : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, ease, delay: i * 0.09 }}
            className="py-9 md:py-11 px-6 sm:px-9 first:sm:pl-0 last:sm:pr-0 text-left"
          >
            <div className="flex items-baseline gap-0.5" style={{ marginBottom: '12px' }}>
              <span style={{ ...T.display('clamp(1.9rem,2.6vw,2.6rem)'), color: '#1A1A1A', lineHeight: 1, letterSpacing: '-0.02em' }}>
                {m.fig}
              </span>
              {m.unit && (
                <span style={{ ...T.display('1.35rem'), color: '#5A5752', lineHeight: 1, letterSpacing: '-0.01em' }}>{m.unit}</span>
              )}
            </div>
            <div style={{ ...T.mono, marginBottom: '8px', color: 'var(--color-accent-ink)' }}>{m.label}</div>
            <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '14px', color: '#5A5752', lineHeight: 1.5, maxWidth: '30ch' }}>
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
    {/* One clean stacked column (the old left-rail / right-list split read as two
        disconnected halves). Heading on top, the pain lines as a single
        hairline-separated list, the turn at the bottom. */}
    <div className="container mx-auto px-8 max-w-3xl">
      <motion.div {...inView}>
        <RevealH2 style={{ ...T.display('clamp(2.6rem,4.4vw,4rem)'), marginBottom: '2.5rem', lineHeight: 1.02 }}>
          Sound{' '}
          <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
            familiar?
          </span>
        </RevealH2>
      </motion.div>

      {PROBLEM_LINES.map((line, i) => (
        <motion.p
          key={i}
          initial={prefersReduced ? false : { opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6, ease, delay: i * 0.08 }}
          className={`py-6 ${i === 0 ? 'border-t' : 'border-t'}`}
          style={{ ...T.serif, fontSize: '19px', borderColor: 'rgba(26,26,26,0.1)' }}
        >
          {line}
        </motion.p>
      ))}

      <motion.p
        initial={prefersReduced ? false : { opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, ease, delay: 0.25 }}
        className="mt-10 pt-9 border-t"
        style={{
          fontFamily: '"DM Serif Display","Bodoni Moda",Georgia,serif',
          fontWeight: 400,
          fontSize: 'clamp(1.7rem,2.8vw,2.5rem)',
          lineHeight: 1.16,
          letterSpacing: '-0.02em',
          color: '#1A1A1A',
          maxWidth: '30ch',
          borderColor: 'var(--color-accent)',
          borderTopWidth: '2px',
        }}
      >
A content system you own, running your feed for you.
      </motion.p>
    </div>
  </section>
);

// ─── Browser-window frame — shows the REAL product (warm, modern, concrete) ──
// Mirrors the content-system page: dark app window, rounded, soft lift. Real
// dashboard screenshots read as a living product, not an abstract flowchart.
const BrowserFrame: React.FC<{ src: string; alt: string; caption?: string; priority?: boolean }> = ({ src, alt, caption, priority }) => (
  <figure className="m-0">
    <div
      className="overflow-hidden"
      style={{ borderRadius: '12px', border: '1px solid rgba(26,26,26,0.12)', backgroundColor: '#161616', boxShadow: '0 12px 40px rgba(26,26,26,0.16)' }}
    >
      <div className="flex items-center gap-2 px-4" style={{ height: '34px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0.10)'].map((c, i) => (
          <span key={i} style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: c }} />
        ))}
      </div>
      <img src={src} alt={alt} loading={priority ? 'eager' : 'lazy'} className="w-full block" />
    </div>
    {caption && (
      <figcaption style={{ ...T.mono, marginTop: '14px', textAlign: 'center', color: '#5A5752' }}>{caption}</figcaption>
    )}
  </figure>
);

// ─── Section 02: How it works — the REAL interface (not an abstract diagram) ─
// The system functioning, shown as the actual dashboard: the pipeline board
// carries content from idea to published; the editor is where you approve; the
// calendar schedules itself; performance closes the learning loop.
const EngineSection: React.FC = () => (
  <section className="py-24 md:py-32 border-t" style={{ ...DIVIDER, backgroundColor: '#EFE7D6' }}>
    <div className="container mx-auto px-8 max-w-6xl">
      <motion.div {...inView} className="mb-12 md:mb-16 max-w-3xl">
        <RevealH2 style={{ ...T.display('clamp(2.5rem,4.4vw,4rem)'), lineHeight: 1.02, marginBottom: 0 }}>
          One system,{' '}
          <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
            idea to booked call.
          </span>
        </RevealH2>
        <p style={{ ...T.serif, fontSize: '18px', marginTop: '1.5rem', maxWidth: '56ch' }}>
          You record your voice once. The engine decides what to post, writes it
          in your voice across every format, and runs each piece through an
          anti-slop QA pass. You approve, about 15 minutes a week. Then it schedules
          and publishes daily, the lead magnets pull in leads, and real
          performance feeds back so it sharpens what it posts next.
        </p>
      </motion.div>

      {/* The interactive system map — the same one on /content-system. Click any
          step to see it in the real product. */}
      <motion.div {...inView}>
        <SystemFlowDiagram />
      </motion.div>

      <MidCTA>Want to watch it run on your brand before you decide?</MidCTA>
    </div>
  </section>
);

// ─── Why this isn't generic AI — the six promises (ported from /content-system) ──
// Kills the cold objection ("isn't this just AI slop?"). Each promise carries
// its mechanism, which proves it's a real engineered system, not a prompt.
const PromisesSection: React.FC = () => (
  <section className="py-24 md:py-32 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <motion.div {...inView} className="mb-12 md:mb-16 max-w-2xl">
        <RevealH2 style={{ ...T.display('clamp(2.2rem,3.8vw,3.4rem)'), lineHeight: 1.04 }}>
          This isn&rsquo;t &ldquo;AI writes my posts.&rdquo;
        </RevealH2>
        <p style={{ ...T.serif, fontSize: '17px', marginTop: '1.25rem', maxWidth: '48ch' }}>
          What the engine does that a prompt box and a ghostwriter can&rsquo;t.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-x-12 gap-y-11">
        {PROMISES.map((p, i) => (
          <motion.div
            key={p.headline}
            initial={prefersReduced ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.55, ease, delay: (i % 2) * 0.08 }}
            className="pl-6"
            style={{ borderLeft: '2px solid var(--color-accent)' }}
          >
            <h3 style={{ ...T.display('1.4rem'), lineHeight: 1.12, marginBottom: '0.55rem' }}>{p.headline}</h3>
            <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '15.5px', lineHeight: 1.6, color: '#3D3D3B' }}>{p.benefit}</p>
          </motion.div>
        ))}
      </div>
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

const BeforeAfterSection: React.FC = () => (
  <section className="py-24 md:py-32 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <motion.div {...inView} className="mb-16 max-w-4xl">
        <RevealH2 style={{ ...T.display('clamp(2.5rem,4.6vw,4.25rem)'), lineHeight: 1.02, marginBottom: 0 }}>
          Six months from now,{' '}
          one of two things is true.
        </RevealH2>
      </motion.div>

      <div className="relative grid md:grid-cols-2 gap-x-16 gap-y-12">
        {/* Center spine (md+): a hairline that fills sage top-to-bottom on scroll,
            the pivot between the two futures. Sage square nodes cap each end.
            Reduced motion: the fill is shown statically. */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2"
          style={{ width: '2px', backgroundColor: 'rgba(26,26,26,0.12)' }}
        >
          <motion.div
            initial={prefersReduced ? false : { scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 1.1, ease }}
            style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-accent)', transformOrigin: 'top' }}
          />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ top: '-4px', width: '9px', height: '9px', backgroundColor: 'var(--color-accent)' }} />
          <span className="absolute left-1/2 -translate-x-1/2" style={{ bottom: '-4px', width: '9px', height: '9px', backgroundColor: 'var(--color-accent)' }} />
        </div>

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
  { label: 'Your time / week', cells: ['About 15 min review', '2 to 4 hrs', '5 to 10 hrs managing', '15 to 20 hrs'] },
  { label: 'Time to first leads', cells: ['About 30 days', '60 to 90 days', '90+ days', '6+ months'] },
];

const ComparisonSection: React.FC = () => (
  <section className="py-24 md:py-32 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <motion.div {...inView} className="mb-16 max-w-2xl">
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

// ─── ROI calculator — your current content cost, in your own numbers ─────────
// The "drag your real numbers" mechanic (Salesforge), re-skinned editorial: mono
// figures, sage square slider thumbs, no SaaS gauge. We never put OUR price on a
// cold surface (the offer is the free fit call) — the number that lands is THEIR
// current burn, computed live.
const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

const CostSlider: React.FC<{
  label: string; value: number; min: number; max: number; step: number;
  prefix?: string; suffix?: string; onChange: (v: number) => void;
}> = ({ label, value, min, max, step, prefix = '', suffix = '', onChange }) => (
  <div>
    <div className="flex items-baseline justify-between" style={{ marginBottom: '10px' }}>
      <span style={{ ...T.mono, fontSize: '11px', color: '#5A5752' }}>{label}</span>
      <span style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '15px', fontWeight: 600, color: '#1A1A1A' }}>
        {prefix}{fmtInt(value)}{suffix}
      </span>
    </div>
    <input
      type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      className="w-full cursor-pointer"
      style={{ accentColor: 'var(--color-accent)' }}
    />
  </div>
);

const ROICalculator: React.FC = () => {
  const [retainer, setRetainer] = useState(2000); // $/mo to a writer or agency
  const [hours, setHours] = useState(8);           // hrs/week you or your team spend
  const [rate, setRate] = useState(100);           // $/hr that time is worth

  const monthly = retainer + Math.round(hours * 4.33 * rate);
  const annual = monthly * 12;
  const hoursYear = Math.round(hours * 52);

  return (
    <section className="py-24 md:py-32 border-t" style={{ ...DIVIDER, backgroundColor: '#EFE7D6' }}>
      <div className="container mx-auto px-8 max-w-6xl">
        <motion.div {...inView} className="mb-12 md:mb-16 max-w-2xl">
          <RevealH2 style={{ ...T.display('clamp(2.4rem,3.8vw,3.4rem)'), lineHeight: 1.02 }}>
            What does your content<br />cost you right now?
          </RevealH2>
          <p style={{ ...T.serif, fontSize: '17px', marginTop: '1.5rem', maxWidth: '48ch' }}>
            You are already paying for content, in retainers or in hours. Move the sliders to see your real number.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-12 gap-x-12 gap-y-10 items-center">
          {/* inputs */}
          <motion.div {...inView} className="md:col-span-6 flex flex-col gap-8">
            <CostSlider label="Writer / agency retainer" prefix="$" suffix="/mo" value={retainer} min={0} max={8000} step={100} onChange={setRetainer} />
            <CostSlider label="Hours you or your team spend" suffix=" hrs/wk" value={hours} min={0} max={25} step={1} onChange={setHours} />
            <CostSlider label="What an hour of that time is worth" prefix="$" suffix="/hr" value={rate} min={25} max={400} step={5} onChange={setRate} />
          </motion.div>

          {/* result */}
          <motion.div {...inView} className="md:col-span-6 md:col-start-7">
            <div className="border" style={{ borderColor: 'rgba(26,26,26,0.12)', backgroundColor: 'var(--color-paper-raise)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(26,26,26,0.10)', padding: '32px' }}>
              <div style={{ ...T.mono, color: 'var(--color-accent-ink)', marginBottom: '14px' }}>Your content spend, today</div>
              <div style={{ ...T.display('clamp(3rem,6vw,4.5rem)'), color: 'var(--color-accent)', lineHeight: 1, letterSpacing: '-0.03em' }}>
                ${fmtInt(monthly)}<span style={{ fontSize: '0.34em', color: '#5A5752' }}> /mo</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6" style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid rgba(26,26,26,0.14)' }}>
                <div>
                  <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '22px', fontWeight: 600, color: '#1A1A1A' }}>${fmtInt(annual)}</div>
                  <div style={{ ...T.mono, fontSize: '10px', color: '#5A5752', marginTop: '4px' }}>a year</div>
                </div>
                <div>
                  <div style={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: '22px', fontWeight: 600, color: '#1A1A1A' }}>{fmtInt(hoursYear)} hrs</div>
                  <div style={{ ...T.mono, fontSize: '10px', color: '#5A5752', marginTop: '4px' }}>of your year</div>
                </div>
              </div>
              <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '15px', lineHeight: 1.55, color: '#3D3D3B', marginTop: '24px' }}>
                The engine does more, posts, carousels, video, and lead magnets, daily and in your voice, for about 15 minutes a week of your time.
              </p>
            </div>
          </motion.div>
        </div>

        <MidCTA>That is your number. Let's see what the engine does with it.</MidCTA>
      </div>
    </section>
  );
};

// ─── Qualification: This isn't for every agency ──────────────────────────────
const QUALIFY = {
  built: [
    'Agencies doing $20k-$30k/mo and up, ready to scale.',
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
          <RevealH2 style={{ ...T.display('clamp(2.4rem,3.8vw,3.4rem)'), lineHeight: 1.02 }}>
            This isn't for<br />every agency.
          </RevealH2>
          <p style={{ ...T.serif, fontSize: '17px', marginTop: '1.5rem', maxWidth: '34ch' }}>
            The engine pays back fastest for a specific kind of founder. Here is who it is, and who it isn't.
          </p>
        </motion.div>

        <div className="md:col-span-7 md:col-start-6 relative grid sm:grid-cols-2 gap-x-12 gap-y-12">
          {/* center hairline — the fit / not-fit seam (sm+) */}
          <div aria-hidden="true" className="hidden sm:block absolute top-1 bottom-1 left-1/2 -translate-x-1/2" style={{ width: '1px', backgroundColor: 'rgba(26,26,26,0.12)' }} />
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
                      style={
                        group.accent
                          ? { marginTop: '0.5em', width: '9px', height: '9px', flexShrink: 0, backgroundColor: 'var(--color-accent)' }
                          : { marginTop: '0.62em', width: '14px', height: '2px', flexShrink: 0, backgroundColor: 'rgba(26,26,26,0.3)' }
                      }
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

// ─── Section 06: Proof — content-system operators + real numbers ─────────────
// Reworked from generic automation testimonials to content-relevant proof: the
// two clients actually running the content engine (Kyle Hunt, Lemonade) with
// their real numbers, then one supporting quote for broader credibility.
const ENGINE_CASES = [
  {
    client: 'Agency Operators',
    role: 'Fractional COO · ops coach',
    img: '/content-system/kyle-guides.webp',
    alt: "Agency Operators' lead magnets, built and published by the system",
    summary: 'Runs its entire content operation on the system. Every post and lead magnet is drafted in the founder’s voice and shipped, without anyone facing a blank page.',
    metrics: [
      { v: '100%', l: 'of his content, run by the system' },
      { v: '~300', l: 'comments per lead-magnet post' },
      { v: '30K', l: 'impressions per post' },
    ],
  },
  {
    client: 'Lemonade',
    role: 'Demand-gen studio',
    img: '/content-system/lemonade-thankyou.webp',
    alt: "Lemonade's lead-capture page built by the system",
    flip: true,
    summary: 'Turned the lead-magnet engine into a booking machine. Gated assets on live pages qualify every signup and route the best fits straight to the calendar.',
    metrics: [
      { v: '5', l: 'new clients a month from the system' },
      { v: 'Live', l: 'gated funnel, on autopilot' },
    ],
  },
];

const TestimonialsSection: React.FC = () => (
  <section className="py-12 md:py-20 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <motion.div {...inView} className="mb-12 md:mb-16 max-w-2xl">
        <RevealH2 style={{ ...T.display('clamp(2rem,3.4vw,3rem)'), lineHeight: 1.04 }}>
          Already running for{' '}
          <span style={{ position: 'relative', display: 'inline-block' }}>
            real operators.
          </span>
        </RevealH2>
      </motion.div>

      <div className="flex flex-col gap-16 md:gap-24">
        {ENGINE_CASES.map((c, ci) => (
          <motion.div
            key={c.client}
            initial={prefersReduced ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.65, ease }}
            className="grid md:grid-cols-12 gap-x-12 gap-y-8 items-center"
          >
            {/* Screenshot of the real work — sharp editorial frame */}
            <div className={`md:col-span-6 ${c.flip ? 'md:order-2 md:col-start-7' : ''}`}>
              <div
                className="overflow-hidden border"
                style={{ borderColor: 'rgba(26,26,26,0.10)', aspectRatio: '16 / 10', backgroundColor: 'var(--color-paper-raise)', borderRadius: '12px', boxShadow: '0 10px 30px rgba(26,26,26,0.10)' }}
              >
                <img src={c.img} alt={c.alt} loading="lazy" className="w-full h-full object-cover object-top" />
              </div>
            </div>

            <div className={`md:col-span-6 ${c.flip ? 'md:order-1 md:col-start-1' : ''}`}>
              <div style={{ ...T.display('1.9rem'), lineHeight: 1, marginBottom: '6px' }}>{c.client}</div>
              <div style={{ ...T.mono, marginBottom: '1.25rem' }}>{c.role}</div>
              <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '16px', lineHeight: 1.6, color: '#3D3D3B', marginBottom: '1.75rem', maxWidth: '42ch' }}>
                {c.summary}
              </p>
              <div className="grid grid-cols-3 gap-x-5 pt-6 border-t" style={{ borderColor: 'rgba(26,26,26,0.14)' }}>
                {c.metrics.map((m) => (
                  <div key={m.l}>
                    <div style={{ ...T.display('clamp(1.7rem,2.2vw,2.3rem)'), color: 'var(--color-accent)', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '8px' }}>
                      {m.v}
                    </div>
                    <div style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '13px', color: '#5A5752', lineHeight: 1.4, maxWidth: '18ch' }}>
                      {m.l}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Scrolling reviews marquee — the broader book of work, kept moving ───────
const ReviewCard: React.FC<{ r: Review }> = ({ r }) => (
  <div
    className="flex flex-col shrink-0 mx-4 p-6 border whitespace-normal"
    style={{ width: '340px', minHeight: '188px', borderColor: 'rgba(26,26,26,0.10)', backgroundColor: 'var(--color-paper-raise)', borderRadius: '12px', boxShadow: '0 4px 16px rgba(26,26,26,0.05)' }}
  >
    <div style={{ ...T.mono, marginBottom: '12px', color: '#5A5752' }}>{r.project}</div>
    <p
      style={{
        fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '15px', lineHeight: 1.5, color: '#1A1A1A', marginBottom: '14px', flex: 1,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}
    >
      &ldquo;{r.text}&rdquo;
    </p>
    <div style={{ fontFamily: '"Source Serif 4",serif', fontWeight: 600, fontSize: '14px', color: '#1A1A1A' }}>{r.author}</div>
    <div style={{ ...T.mono, fontSize: '11px', color: '#5A5752' }}>{r.role}</div>
  </div>
);

const ReviewsMarquee: React.FC = () => {
  // Use the shorter quotes so they fit the fixed card height without ellipsis.
  const short = REVIEWS.filter((r) => r.text.length <= 130);
  const half = Math.ceil(short.length / 2);
  const rowA = short.slice(0, half);
  const rowB = short.slice(half);
  return (
    <section className="py-14 md:py-20 border-t overflow-hidden" style={{ ...DIVIDER, backgroundColor: '#EFE7D6' }}>
      <div className="container mx-auto px-8 max-w-6xl mb-10 md:mb-12">
        <p style={{ ...T.mono, color: '#5A5752' }}>And the broader book of work</p>
      </div>
      <div className="flex flex-col gap-5">
        <Marquee speed={70} direction="left">
          {rowA.map((r) => <ReviewCard key={r.author} r={r} />)}
        </Marquee>
        <Marquee speed={85} direction="right">
          {rowB.map((r) => <ReviewCard key={r.author} r={r} />)}
        </Marquee>
      </div>
    </section>
  );
};

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

// ─── Section: The ask — single booking CTA, no option cards ──────────────────
// ─── Calendly inline embed — branded (paper bg, sage primary), SPA-safe ──────
const CALENDLY_URL = 'https://calendly.com/im-ivanmanfredi/30min?hide_gdpr_banner=1&background_color=f7f4ef&text_color=1a1a1a&primary_color=2a8f65';

const CalendlyEmbed: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const SRC = 'https://assets.calendly.com/assets/external/widget.js';
    const init = () => {
      const C = (window as unknown as { Calendly?: { initInlineWidget: (o: { url: string; parentElement: HTMLElement }) => void } }).Calendly;
      if (C && ref.current) {
        ref.current.innerHTML = '';
        C.initInlineWidget({ url: CALENDLY_URL, parentElement: ref.current });
      }
    };
    if (!document.querySelector(`script[src="${SRC}"]`)) {
      const s = document.createElement('script');
      s.src = SRC;
      s.async = true;
      s.onload = init;
      document.body.appendChild(s);
    } else {
      init();
    }
  }, []);
  return (
    <div
      ref={ref}
      style={{ minWidth: '320px', height: '720px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(26,26,26,0.10)', boxShadow: '0 12px 40px rgba(26,26,26,0.10)', backgroundColor: 'var(--color-paper)' }}
    />
  );
};

const OfferSection: React.FC = () => (
  <section className="py-24 md:py-32 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-4xl text-center">
      <motion.div {...inView}>
        <RevealH2 style={{ ...T.display('clamp(2.4rem,4.4vw,4rem)'), lineHeight: 1.04, marginBottom: '1.5rem' }}>
          See what it would{' '}
          <span style={{ position: 'relative', display: 'inline-block', whiteSpace: 'nowrap' }}>
            post for you.
          </span>
        </RevealH2>
        <p style={{ ...T.serif, fontSize: '18px', marginBottom: '2.25rem', maxWidth: '48ch', marginLeft: 'auto', marginRight: 'auto' }}>
          Book the fit call. I'll show you exactly what the engine would write for
          your agency, in your voice, even if we never work together.
        </p>
      </motion.div>

      {/* A glance at real output — fulfils the "see what it would post" promise */}
      <motion.div
        initial={prefersReduced ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, ease }}
        className="max-w-2xl mx-auto mb-4"
      >
        <div className="grid grid-cols-3 gap-4 md:gap-5">
          {[
            { src: 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/post-stills/library/IMG_4492.jpg', alt: 'A recent post graphic from the engine' },
            { src: 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/lm-og/claude-agency-ops-square-clean.jpg', alt: 'A recent carousel from the engine' },
            { src: '/content-system/lead-magnet.webp', alt: 'A lead magnet built by the engine' },
          ].map((s) => (
            <div
              key={s.src}
              className="overflow-hidden border"
              style={{ aspectRatio: '4 / 5', borderRadius: '12px', borderColor: 'rgba(26,26,26,0.10)', backgroundColor: 'var(--color-paper-raise)', boxShadow: '0 8px 24px rgba(26,26,26,0.08)' }}
            >
              <img src={s.src} alt={s.alt} loading="lazy" className="w-full h-full object-cover object-top" />
            </div>
          ))}
        </div>
        <div style={{ ...T.mono, marginTop: '14px', color: '#5A5752' }}>Real output, in your voice</div>
      </motion.div>

      <motion.div {...inView} className="flex justify-center mt-9">
        <MagneticCTA href="/start" variant="primary" fontSize="17px" px="px-9 py-4">
          Book your fit call <ArrowRight size={18} />
        </MagneticCTA>
      </motion.div>
    </div>
  </section>
);

// ─── Meet the operator — trust section, big portrait, solo-ownership framing ──
const OPERATOR_POINTS = [
  'Your engine is trained on your voice and ships 5+ posts a week, plus carousels, video, and lead magnets, all QA’d before they go out.',
  "It's the same system already running for operators like Agency Operators and Lemonade, not a demo.",
  'You own the system at the end. It lives in your accounts and keeps running, with or without me.',
];

const MeetOperator: React.FC = () => (
  <section className="border-t" style={DIVIDER}>
    <div className="grid lg:grid-cols-[minmax(0,42%)_1fr]">
      {/* Large portrait */}
      <div className="relative" style={{ minHeight: '460px' }}>
        <img
          src="/ivan-portrait.jpg"
          alt="Iván Manfredi"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: '50% 24%' }}
        />
        <div className="hidden lg:block absolute top-0 right-0 h-full" style={{ width: '2px', backgroundColor: '#2A8F65' }} aria-hidden="true" />
        <div className="lg:hidden absolute bottom-0 left-0 w-full" style={{ height: '2px', backgroundColor: '#2A8F65' }} aria-hidden="true" />
      </div>

      {/* Copy */}
      <motion.div {...inView} className="flex flex-col justify-center px-8 md:px-16 py-16 md:py-24">
        <div className="max-w-2xl">
          <div style={{ ...T.mono, marginBottom: '1.5rem' }}>Who builds it</div>
          <RevealH2 style={{ ...T.display('clamp(2.3rem,3.8vw,3.6rem)'), lineHeight: 1.04, marginBottom: '1.5rem' }}>
            You work with the<br />person who built it.
          </RevealH2>
          <p style={{ ...T.serif, fontSize: '18px', lineHeight: 1.65, color: '#3D3D3B', marginBottom: '2.25rem', maxWidth: '50ch' }}>
            I'm Iván. I've shipped 100+ AI systems for agencies and service
            businesses, and I run my own LinkedIn on the same content engine I'd
            install for you.
          </p>
          <div className="flex flex-col gap-4 mb-10">
            {OPERATOR_POINTS.map((pt) => (
              <div key={pt} className="flex items-start gap-3.5">
                <span aria-hidden="true" style={{ marginTop: '0.62em', width: '16px', height: '2px', flexShrink: 0, backgroundColor: 'var(--color-accent)' }} />
                <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '16px', lineHeight: 1.55, color: '#2A2A28', maxWidth: '52ch' }}>{pt}</p>
              </div>
            ))}
          </div>
          <MagneticCTA href="/start" variant="primary" fontSize="17px" px="px-9 py-4">
            Book your fit call <ArrowRight size={18} />
          </MagneticCTA>
        </div>
      </motion.div>
    </div>
  </section>
);

// ─── FAQ — accordion ─────────────────────────────────────────────────────────
const FAQS = [
  { q: 'Will it actually sound like me?', a: "Yes. The engine is trained on your voice from a short intake, and every piece runs through an anti-slop QA pass before it ships. If it reads like AI, it doesn't go out." },
  { q: "How long until it's live?", a: 'About 30 days from kickoff. Week one is voice and positioning, week two is the build, then it ships daily while we tune.' },
  { q: 'Do I own it?', a: "Yes. The system, the content, and the data live in your own accounts. If we ever stop, it keeps running without me." },
  { q: 'What does it cost?', a: "A fixed price for the build, scoped to your channels and content volume on the fit call, then an optional monthly to keep it running and improving. No surprise retainers, and you own the system either way." },
  { q: 'What do I actually have to do?', a: 'Record a voice intake once, then review and approve. About 15 minutes a week. The engine handles the rest.' },
  { q: 'How is this different from a ghostwriter or an agency?', a: 'A ghostwriter writes posts. This is a system you own that writes the posts, builds the lead magnets, and ships every format daily in your voice, with no one to manage.' },
  { q: "What if it's not a fit?", a: "The fit call tells us fast. If it's not right for you, I'll say so on the call. No pressure either way." },
];

const FAQSection: React.FC = () => {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-24 md:py-32 border-t" style={{ ...DIVIDER, backgroundColor: '#EFE7D6' }}>
      <div className="container mx-auto px-8 max-w-2xl">
        <motion.div {...inView} className="mb-12 md:mb-16">
          <RevealH2 style={{ ...T.display('clamp(2.2rem,3.8vw,3.4rem)'), lineHeight: 1.04 }}>
            Frequent questions.
          </RevealH2>
        </motion.div>

        <div>
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} className="border-t" style={{ borderColor: 'rgba(26,26,26,0.14)' }}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-start justify-between gap-6 py-8 text-left"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                  aria-expanded={isOpen}
                >
                  <span style={{ fontFamily: '"DM Serif Display","Bodoni Moda",Georgia,serif', fontSize: 'clamp(1.2rem,1.8vw,1.5rem)', lineHeight: 1.25, letterSpacing: '-0.01em', color: '#1A1A1A' }}>
                    {f.q}
                  </span>
                  <span aria-hidden="true" style={{ flexShrink: 0, marginTop: '0.35em', color: 'var(--color-accent-ink)', transition: 'transform 0.25s', transform: isOpen ? 'rotate(45deg)' : 'none', fontFamily: '"IBM Plex Mono",monospace', fontSize: '20px', lineHeight: 1 }}>
                    +
                  </span>
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.32, ease }}
                  style={{ overflow: 'hidden' }}
                >
                  <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '17px', lineHeight: 1.6, color: '#3D3D3B', paddingBottom: '1.75rem', maxWidth: '60ch' }}>
                    {f.a}
                  </p>
                </motion.div>
              </div>
            );
          })}
          <div className="border-t" style={{ borderColor: 'rgba(26,26,26,0.14)' }} />
        </div>
      </div>
    </section>
  );
};

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
        <div className="text-center mb-12 md:mb-14 max-w-xl mx-auto">
          <Label>The Agent-Ready Letter</Label>
          <p style={{ ...T.serif, fontSize: '16px', marginBottom: '1.5rem' }}>
            What I built this week, and what it changed. Weekly, for agency owners.
          </p>

          {status === 'success' ? (
            <div className="inline-flex items-center gap-2.5 px-5 py-3 border" style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}>
              <Check size={16} strokeWidth={2.5} />
              <span style={{ fontFamily: '"Source Serif 4",serif', fontStyle: 'italic', fontSize: '14px' }}>
                Subscribed. First letter arrives within 15 minutes.
              </span>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row sm:items-stretch gap-2 max-w-md mx-auto">
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
                  border: '1px solid rgba(26,26,26,0.32)',
                  backgroundColor: 'var(--color-paper-raise)',
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
                  fontWeight: 500,
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
        <PromisesSection />
        <LiveEngineProof />
        <ComparisonSection />
        <ROICalculator />
        <BeforeAfterSection />
        <QualificationSection />
        <TestimonialsSection />
        <ReviewsMarquee />
        <MeetOperator />
        <FAQSection />
        <OfferSection />
        <LandingFooter />
      </div>
      <StickyCTA />
    </div>
    </MotionConfig>
  );
};

export default LandingPage;
