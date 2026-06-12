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

import BuildCardDiagram from './landing/diagrams/BuildCardDiagram';
import ProcessAssembly, { StageSnapshot } from './landing/diagrams/ProcessAssembly';

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

// ─── RevealH2 — blur-in on scroll ────────────────────────────────────────────
const RevealH2: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <motion.h2
    initial={prefersReduced ? false : { opacity: 0, y: 22, filter: 'blur(8px)' }}
    whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.9, ease }}
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

const ROW1 = [...REVIEWS, ...REVIEWS];
const ROW2 = [...REVIEWS.slice(5), ...REVIEWS.slice(0, 5), ...REVIEWS.slice(5), ...REVIEWS.slice(0, 5)];

const ReviewCard: React.FC<{ r: Review }> = ({ r }) => (
  <motion.div
    whileHover={{ y: -5, boxShadow: '0 16px 40px rgba(26,26,26,0.08)' }}
    transition={{ duration: 0.22, ease: 'easeOut' }}
    className="shrink-0 p-6 md:p-7 border cursor-default flex flex-col"
    style={{ width: 'min(85vw, 400px)', minHeight: '272px', borderColor: 'rgba(26,26,26,0.1)', backgroundColor: 'var(--color-paper)' }}
  >
    <div style={{ ...T.mono, marginBottom: '10px' }}>{r.project}</div>
    <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '15.5px', lineHeight: 1.55, color: '#1A1A1A', flex: 1 }}>
      "{r.text}"
    </p>
    <div style={{ marginTop: '14px' }}>
      {r.author && (
        <div style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontWeight: 600, fontSize: '14px', color: '#1A1A1A', lineHeight: 1.3, marginBottom: '3px' }}>
          {r.author}
        </div>
      )}
      {r.role && (
        <div style={{ ...T.mono, fontSize: '12px', color: '#5A5752' }}>
          {r.role}
        </div>
      )}
    </div>
  </motion.div>
);

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

// ─── Credibility strip — above-the-fold proof, numeral lockups (§5f) ─────────
const METRICS = [
  { fig: '100+', label: 'Builds shipped' },
  { fig: '90-day', label: 'Payback rule' },
  { fig: '50-state', label: 'Coverage' },
  { fig: '0', label: 'Lock-in' },
];

const MetricStrip: React.FC = () => (
  <section className="border-t border-b" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-black/10">
        {METRICS.map((m, i) => (
          <motion.div
            key={m.label}
            initial={prefersReduced ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.6, ease, delay: i * 0.08 }}
            className="py-8 md:py-11 px-4 text-center"
          >
            <div style={{ ...T.display('clamp(1.9rem,3vw,2.7rem)'), color: 'var(--color-accent)', lineHeight: 1, marginBottom: '9px' }}>
              {m.fig}
            </div>
            <div style={T.mono}>{m.label}</div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Section 2: Problem (with parallax depth, lg+ only) ──────────────────────
const ProblemSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const isLg = useMediaQuery('(min-width: 1024px)');
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  });
  const leftY = useTransform(scrollYProgress, [0, 1], [60, -60]);
  const rightY = useTransform(scrollYProgress, [0, 1], [-30, 30]);

  return (
    <section ref={sectionRef} className="py-12 md:py-20 border-t relative" style={DIVIDER}>
      <div className="container mx-auto px-8 max-w-6xl">
        <div className="grid lg:grid-cols-[1fr_1px_1fr] items-start">

          <motion.div style={isLg ? { y: leftY } : undefined} className="pr-20">
            <motion.div {...inView}>
              <Label>01</Label>
              <RevealH2 style={{ ...T.display('clamp(2.4rem,4vw,3.8rem)'), marginBottom: '1.25rem' }}>
                You're growing.<br />
                <span style={{ position: 'relative', display: 'inline-block' }}>
                  The margin isn't.
                  <SageSweep delay={0.5} opacity={0.85} />
                </span>
              </RevealH2>
              <p style={{ ...T.serif, maxWidth: '50ch' }}>
                Every new client should widen your margin. Instead it means another
                salary and more work routed back through you, and the margin barely
                moves. I build AI systems that take the repeatable work off the
                payroll, so the next stage of growth drops to the bottom line instead
                of getting eaten by it.
              </p>
            </motion.div>
          </motion.div>

          <div className="hidden lg:block self-stretch" style={{ width: '1px', backgroundColor: 'rgba(26,26,26,0.1)' }} />

          <motion.div style={isLg ? { y: rightY } : undefined} className="pl-20 pt-8 lg:pt-0">
            <motion.div {...inView} transition={{ duration: 0.85, ease, delay: 0.15 }}>
              <div style={{ ...T.mono, color: 'var(--color-accent-ink)', marginBottom: '1.75rem' }}>
                What you get
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-10">
                {[
                  { verb: 'Review', stat: '100%', line: 'of your sales calls graded, with at-risk accounts flagged the same hour.' },
                  { verb: 'Cut', stat: '15+ hrs/wk', line: "of manual work off your team's plate, every single week." },
                  { verb: 'Turn', stat: 'same-day', line: 'delivery on work that takes your team days right now.' },
                  { verb: 'Grow', stat: '2–3x', line: 'more client capacity with the team you already have.' },
                ].map((item) => (
                  <div key={item.verb}>
                    <div style={{ ...T.mono, marginBottom: '8px' }}>{item.verb}</div>
                    <div style={{ ...T.display('clamp(1.9rem,2.5vw,2.5rem)'), color: 'var(--color-accent-ink)', marginBottom: '8px' }}>{item.stat}</div>
                    <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontSize: '15px', color: '#5A5752', lineHeight: 1.55 }}>{item.line}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

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
        <Label>03</Label>
        <RevealH2 style={T.display('clamp(2.4rem,4vw,3.8rem)')}>
          Recent builds,<br />
          <span style={{ fontStyle: 'italic' }}>already in production.</span>
        </RevealH2>
        <p style={{ ...T.serif, fontSize: '16px', marginTop: '1.25rem' }}>
          The numbers above come from these. Click into any build for the full story.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-x-6 gap-y-8">
        {visible.map((o, i) => (
          <motion.a
            key={o.type}
            href={o.href}
            initial={prefersReduced ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(26,26,26,0.08)' }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, ease, delay: i * 0.1 }}
            className="group border p-7 flex flex-col md:min-h-[340px] transition-colors"
            style={{ borderColor: 'rgba(26,26,26,0.1)', backgroundColor: 'var(--color-paper)' }}
          >
            <div style={{ ...T.mono, marginBottom: '10px' }}>{o.category}</div>
            <h3 style={{ fontFamily: '"DM Serif Display","Bodoni Moda",Georgia,serif', fontStyle: 'italic', fontWeight: 400, fontSize: 'clamp(1.5rem,1.8vw,1.85rem)', lineHeight: 1.1, letterSpacing: '-0.02em', color: '#1A1A1A', marginBottom: '1.5rem' }}>
              {o.type}
            </h3>
            <div style={{ fontFamily: '"DM Serif Display","Bodoni Moda",Georgia,serif', fontStyle: 'italic', fontSize: 'clamp(1.6rem,2.2vw,2.2rem)', color: 'var(--color-accent)', lineHeight: 1, letterSpacing: '-0.02em', marginBottom: '5px' }}>
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
                fontStyle: 'italic',
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
      top: '0.18em',
      width: '108%',
      height: '0.78em',
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
    label: 'WITHOUT THE SYSTEMS',
    lines: ["It's 9am and 23 approvals are already waiting on you.", 'You hired another coordinator to keep pace, and now you manage them too.', 'You worked more this year and the margin came in thinner.'],
  },
  with: {
    label: 'WITH THEM',
    lines: ['Approvals clear overnight. Nothing waits on you.', 'The weekly report wrote itself before you woke up.', 'Same payroll, two new clients live.'],
  },
};

const AgentReadySection: React.FC = () => (
  <section className="py-12 md:py-16 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">
      <motion.div {...inView} className="mb-10 max-w-3xl">
        <Label>02</Label>
        <RevealH2 style={{ ...T.display('clamp(2rem,3vw,2.8rem)'), marginBottom: 0 }}>
          Six months from now,{' '}
          <span style={{ fontStyle: 'italic' }}>one of two things is true.</span>
        </RevealH2>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-x-16 gap-y-10">
        {[FUTURES.without, FUTURES.with].map((f, col) => (
          <motion.div
            key={f.label}
            initial={prefersReduced ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease, delay: col * 0.12 }}
            className="border-t pt-5"
            style={{ borderColor: col === 1 ? 'var(--color-accent)' : 'rgba(26,26,26,0.25)', borderTopWidth: '2px' }}
          >
            <div style={{ ...T.mono, color: col === 1 ? 'var(--color-accent-ink)' : '#5A5752', marginBottom: '14px' }}>{f.label}</div>
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
        Not ready for a call? Find out where the time and money go first.
      </MidCTA>
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
    <section className="py-12 md:py-20 border-t" style={DIVIDER}>
      <div className="container mx-auto px-8 max-w-6xl">
        <motion.div {...inView} className="mb-10 lg:mb-16">
          <Label>05</Label>
          <RevealH2 style={T.display('clamp(2.4rem,4vw,3.6rem)')}>
            Diagnose first.{' '}
            <span style={{ fontStyle: 'italic' }}>Build second.</span>
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

      </div>
    </section>
  );
};

// ─── Section 4: Testimonials ─────────────────────────────────────────────────
const TestimonialsSection: React.FC = () => (
  <section className="pt-12 md:pt-20 pb-12 md:pb-16 border-t overflow-hidden" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl mb-14">
      <motion.div {...inView}>
        <Label>04</Label>
        <RevealH2 style={T.display('clamp(2rem,3.5vw,3rem)')}>
          100+ builds shipped.<br />In their words.
        </RevealH2>
      </motion.div>
    </div>
    {/* CSS marquee (was framer tween): pauses on hover so quotes are actually
        readable, and stops entirely under prefers-reduced-motion. Keyframes +
        .marquee-* classes live in styles.css. */}
    <div className="flex flex-col gap-5 pb-0">
      {[{ row: ROW1, dur: 95, reverse: false }, { row: ROW2, dur: 115, reverse: true }].map(({ row, dur, reverse }, ri) => (
        <div key={ri} className="relative marquee-row">
          <div className="absolute inset-y-0 left-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, var(--color-paper), transparent)' }} />
          <div className="absolute inset-y-0 right-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, var(--color-paper), transparent)' }} />
          <div
            className="flex gap-5 w-max px-5 marquee-track"
            style={{ animationDuration: `${dur}s`, animationDirection: reverse ? 'reverse' : 'normal' }}
          >
            {row.map((r, i) => <ReviewCard key={i} r={r} />)}
          </div>
        </div>
      ))}
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
          <Label>06</Label>
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

            <div className="border p-8" style={{ ...DIVIDER, backgroundColor: 'var(--color-paper)' }}>
              <div style={{ ...T.mono, marginBottom: '10px' }}>Annual cost of this bottleneck</div>
              <Counter value={yearly} prefix="$" style={T.display('clamp(3rem,5.5vw,5rem)')} />
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
    price: 'From $7k',
    cadence: '3-week build',
    desc: 'Lead magnets plus a content engine trained on your voice, filling your pipeline while you run the business.',
    href: '/content-system',
    cta: 'Scope your build',
  },
  {
    id: '02',
    name: 'Call Intelligence',
    price: 'From $5,000',
    cadence: 'Scoped on the fit call',
    desc: "Close more of the deals you're already in. It scores every sales call, flags accounts about to churn, and shows you why deals slip.",
    href: '/call-intelligence',
    cta: 'See how it works',
    signature: true,
  },
  {
    id: '03',
    name: 'Fractional AI Partner',
    price: 'From $3,500/mo',
    cadence: 'Ongoing partnership',
    desc: 'Want me building alongside you month over month? You set the intensity, and you can stop any month.',
    href: '/fractional',
    cta: 'Explore partnership',
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
          . I scope custom builds for service businesses every week.
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
            I build and ship everything myself, start to finish. Clients have ranged from
            solo founders to engineers at Meta and BNP Paribas. The posts and the DM that
            found you came from{' '}
            <a href="/content-system" style={{ color: 'rgba(247,244,239,0.95)', textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationColor: 'var(--color-accent)' }}>
              systems I run myself
            </a>
            . Book the call and I'll show you where AI saves hours and adds margin in your business, even if we never work together.
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
            What I built this week, and what it changed. Weekly, for service-business founders.
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

        {/* Wordmark + socials */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12 pt-12 border-t" style={DIVIDER}>
          <div className="text-center md:text-left">
            <div style={{ ...T.display('clamp(1.8rem,2.4vw,2.4rem)'), fontStyle: 'normal', marginBottom: '4px' }}>
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
const LandingPage: React.FC = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Iván Manfredi · Agent-Ready Ops';
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
        <LandingHero />
        <MetricStrip />
        <ProblemSection />
        <AgentReadySection />
        <BuildOutcomesSection />
        <TestimonialsSection />
        <WorkSection />
        <PaybackSection />
        <OfferSection />
        <FinalCTA />
        <LandingFooter />
      </div>
    </div>
    </MotionConfig>
  );
};

export default LandingPage;
