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
import { ArrowRight, Star, Linkedin, Mail, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import LandingHero from './LandingHero';
import { getBookingQuarter, OPEN_SLOTS } from '../lib/bookingConfig';

// ─── Design tokens ───────────────────────────────────────────────────────────
const ease = [0.22, 0.84, 0.36, 1] as const;

const inView = {
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
    color: 'rgba(26,26,26,0.62)',
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
    fontStyle: 'italic',
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
  <div style={{ ...T.mono, color: dark ? 'rgba(247,244,239,0.5)' : 'rgba(26,26,26,0.62)', marginBottom: '1.75rem' }}>
    {children}
  </div>
);

// ─── RevealH2 — blur-in on scroll ────────────────────────────────────────────
const RevealH2: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <motion.h2
    initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
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
  const [displayed, setDisplayed] = useState(0);
  const displayedRef = useRef(0);
  const spanRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(spanRef, { once: true, margin: '-80px' });

  useEffect(() => {
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
        color: dark ? 'rgba(247,244,239,0.52)' : 'rgba(26,26,26,0.52)',
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
  { text: "Ivan has a sublime understanding of data manipulation, visualization, and automation. You can tell he is very thoughtful in his work. He is reliable and did a great job. Will rehire next time.", project: "Data & Automation Project", author: "Andrew Motiwalla", role: "The Good Life Abroad" },
  { text: "Working with Ivan has been an absolute game-changer. He exceeded all expectations and saved our team countless hours.", project: "Lead Flow & Slack Integration", author: "Camille Haas", role: "Head of Operations" },
  { text: "Ivan's one of those people where you see how he uses AI and immediately feel like you've been doing things the hard way. Had a session with him around Salesforce, Apex, automations — the stuff I do every day. Walked away with a completely different approach.", project: "AI Orientation Session", author: "Cristian Trif", role: "Salesforce Consultant · 9 yrs" },
  { text: "His solutions helped uncover opportunities we were missing, directly impacting our bottom line.", project: "Make.com Workflow Audit", author: "Rodrigo Ibañez", role: "Managing Director" },
  { text: "Complete architectural overhaul. The documentation alone was worth the price.", project: "Enterprise Architecture", author: "Henrik Sund", role: "CTO" },
  { text: "As a current META developer, ex Amazon, very few things surprise me with AI. Ivan did. One conversation and I already had 3 things to implement in my workflow. The guy makes it practical.", project: "AI Strategy Session", author: "Adeeb Mohammed", role: "Software Engineer · ex-Amazon · Meta" },
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
    style={{ width: 'min(85vw, 380px)', height: '240px', borderColor: 'rgba(26,26,26,0.1)', backgroundColor: 'var(--color-paper)' }}
  >
    <div style={{ ...T.mono, marginBottom: '10px' }}>{r.project}</div>
    <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontStyle: 'italic', fontSize: 'clamp(14px,1.3vw,15px)', lineHeight: 1.52, color: '#1A1A1A', flex: 1, overflow: 'hidden' }}>
      "{r.text}"
    </p>
    <div style={{ marginTop: '14px' }}>
      {r.author && (
        <div style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontWeight: 600, fontSize: '13px', color: '#1A1A1A', lineHeight: 1.3, marginBottom: '3px' }}>
          {r.author}
        </div>
      )}
      {r.role && (
        <div style={{ ...T.mono, fontSize: '9px', color: 'rgba(26,26,26,0.38)', marginBottom: '8px' }}>
          {r.role}
        </div>
      )}
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => <Star key={i} size={10} style={{ fill: 'var(--color-accent)', color: 'var(--color-accent)', flexShrink: 0 }} />)}
      </div>
    </div>
  </motion.div>
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
              <Label>02 / The problem</Label>
              <RevealH2 style={{ ...T.display('clamp(2.4rem,4vw,3.8rem)'), marginBottom: '1.25rem' }}>
                You've hit the<br />headcount wall.
              </RevealH2>
              <p style={{ ...T.serif, maxWidth: '50ch' }}>
                Revenue is growing. The team is full. You're the bottleneck. Hiring
                another person doesn't fix the process that's eating everyone's time.
                It just gives the process another victim.
              </p>
            </motion.div>
          </motion.div>

          <div className="hidden lg:block self-stretch" style={{ width: '1px', backgroundColor: 'rgba(26,26,26,0.1)' }} />

          <motion.div style={isLg ? { y: rightY } : undefined} className="pl-20 pt-8 lg:pt-0">
            <motion.div {...inView} transition={{ duration: 0.85, ease, delay: 0.15 }} className="space-y-8">
              {[
                { n: '01', h: 'Repetitive decisions eat partner hours.', b: "Your highest-value people spend a third of their week on work that follows the same pattern every time. It's documentable. It's automatable. It's not automated." },
                { n: '02', h: 'Scaling means hiring, not building.', b: "Every new client brings another coordinator, another account manager, another ops call. The unit economics get worse as you grow." },
                { n: '03', h: "AI experiments haven't worked.", b: "You've tried the chatbots. The summaries. The general-purpose tools. None of it moved the needle because none of it was designed around your specific workflow." },
              ].map((item) => (
                <div key={item.n} className="flex gap-5 items-start">
                  <span style={{ ...T.mono, color: 'var(--color-accent)', fontSize: '11px', flexShrink: 0, paddingTop: '3px' }}>{item.n}</span>
                  <div>
                    <div style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontWeight: 600, fontSize: '16px', color: '#1A1A1A', marginBottom: '6px', lineHeight: 1.35 }}>{item.h}</div>
                    <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontStyle: 'italic', fontSize: '15px', color: 'rgba(26,26,26,0.58)', lineHeight: 1.65 }}>{item.b}</p>
                  </div>
                </div>
              ))}
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
    story: "Their best manager could only sample 5% of sales calls. I encoded her 8-criteria rubric into an agent that grades every call and routes risk to leadership within the hour.",
    qualifier: 'Running daily',
    href: '/work#case-01',
  },
  {
    type: 'Lead Magnet System',
    category: 'Productized build',
    metric: '15 min',
    metricLabel: 'idea to launched',
    story: "Every lead magnet took days of manual work across disconnected tools. One idea in ClickUp now generates the full package: landing page, email, smart link, scheduled post.",
    qualifier: 'Self-serve since launch',
    href: '/work#case-02',
  },
  {
    type: 'SWPPP Automation',
    category: 'Back-office that runs itself',
    metric: 'Multi-FTE → same-day',
    metricLabel: 'permit turnaround',
    story: "Every permit needed hours of manual environmental research across 50 states. Intake to delivered documents now runs end-to-end, no researcher in the loop.",
    qualifier: 'Live across 50 states',
    href: '/work#case-03',
  },
  {
    type: 'Supplier Menu Sync',
    category: 'Inventory orchestration',
    metric: '15+ hrs/week',
    metricLabel: 'manual entry removed',
    story: "A cannabis distributor was reconciling inventory from WhatsApp, supplier sites, and Google Sheets daily. Now n8n auto-consolidates every channel into one sheet, standardizes formats, refreshes every 60–120 min.",
    qualifier: 'Refreshes hourly',
    href: '/work#case-06',
  },
];

const BuildOutcomesSection: React.FC = () => (
  <section className="py-12 md:py-20 border-t" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl">

      <motion.div {...inView} className="mb-16 max-w-2xl">
        <Label>04 / Built. Shipped. Live.</Label>
        <RevealH2 style={T.display('clamp(2.4rem,4vw,3.8rem)')}>
          Three ways<br />
          <span style={{ fontStyle: 'italic' }}>systems take over.</span>
        </RevealH2>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-x-6 gap-y-8">
        {OUTCOMES.map((o, i) => (
          <motion.a
            key={o.type}
            href={o.href}
            initial={{ opacity: 0, y: 22 }}
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
            <div style={{ ...T.mono, marginBottom: '20px' }}>{o.metricLabel}</div>
            <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontStyle: 'italic', fontSize: '14px', color: 'rgba(26,26,26,0.6)', lineHeight: 1.6, flex: 1 }}>
              {o.story}
            </p>
            <div className="flex items-center justify-between gap-4 mt-5">
              <div style={{ ...T.mono, color: 'var(--color-accent)', fontSize: '9px' }}>
                {o.qualifier} · 4/4 Agent-Ready
              </div>
              <span style={{
                fontFamily: '"Source Serif 4",serif',
                fontStyle: 'italic',
                fontSize: '13px',
                color: 'rgba(26,26,26,0.5)',
              }} className="group-hover:text-[var(--color-accent)] transition-colors whitespace-nowrap">
                Read case →
              </span>
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  </section>
);

// ─── Section 3: What Agent-Ready means ──────────────────────────────────────
const PRECONDITIONS = [
  {
    n: '01',
    title: 'You decide with data, not vibes',
    sub: 'If I asked your ops lead "why did you say no to that lead last Thursday?", they should point to a row in a spreadsheet, not a feeling.',
  },
  {
    n: '02',
    title: 'The playbook lives in one person’s head',
    sub: 'Your senior operator makes the call without thinking. That means a playbook exists. It’s just never been written down. We write it down.',
  },
  {
    n: '03',
    title: 'You can name the workflow eating the most hours',
    sub: 'Don’t overthink it. You know which one. It’s the one your team reroutes around. The one you’d love to delete.',
  },
  {
    n: '04',
    title: 'The work happens often enough to be worth encoding',
    sub: 'It’s not a one-off project. The same workflow runs every week. Every client, every cycle, every billing run. That’s where automation compounds.',
  },
];

// PreconditionItem — side-stage entrance (numeral from left, content from right) +
// horizontal parallax on the ghost numeral. Each item tracks its own scroll progress.
const PreconditionItem: React.FC<{
  p: typeof PRECONDITIONS[0];
  index: number;
  isLast: boolean;
}> = ({ p, index, isLast }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  // Lateral parallax — alternating direction per item creates visual rhythm
  // (item 0 + 2 drift right, item 1 + 3 drift left)
  const parallaxDir = index % 2 === 0 ? 1 : -1;
  const ghostX = useTransform(scrollYProgress, [0, 1], [-280 * parallaxDir, 280 * parallaxDir]);
  // Subtle counter-parallax on the visible numeral — feels like depth layers
  const visibleNumeralX = useTransform(scrollYProgress, [0, 1], [20 * parallaxDir, -20 * parallaxDir]);

  return (
    <motion.div ref={ref} className="relative">
      {/* Ghost numeral — drifts dramatically horizontally on scroll */}
      <div aria-hidden style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -55%)',
        pointerEvents: 'none',
        zIndex: 0,
      }}>
        <motion.div
          style={{
            x: ghostX,
            fontSize: 'clamp(120px, 22vw, 320px)',
            fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
            fontStyle: 'italic',
            fontWeight: 400,
            color: '#F7F4EF',
            opacity: 0.06,
            lineHeight: 1,
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {p.n}
        </motion.div>
      </div>

      <div className="relative" style={{ zIndex: 1 }}>
        {/* Numeral — entrance slides in from left, then continuous parallax counter-drift */}
        <motion.div
          initial={{ opacity: 0, x: -80 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.9, ease, delay: index * 0.06 }}
          style={{ display: 'inline-block' }}
        >
          <motion.span
            style={{
              x: visibleNumeralX,
              display: 'inline-block',
              fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
              fontStyle: 'italic',
              fontWeight: 400,
              fontSize: 'clamp(2rem, 2.8vw, 2.6rem)',
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: 'var(--color-accent-light)',
              marginBottom: '18px',
            }}
          >
            {p.n}.
          </motion.span>
        </motion.div>

        {/* H3 — fades in from right with delay */}
        <motion.h3
          initial={{ opacity: 0, x: 60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.85, ease, delay: 0.25 + index * 0.06 }}
          style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontStyle: 'normal',
            fontWeight: 600,
            fontSize: 'clamp(1.4rem, 2vw, 1.85rem)',
            lineHeight: 1.25,
            letterSpacing: '-0.01em',
            color: '#F7F4EF',
            marginBottom: '14px',
            maxWidth: '24ch',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {p.title}
        </motion.h3>

        {/* Body — fades in from right with more delay */}
        <motion.p
          initial={{ opacity: 0, x: 80 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.85, ease, delay: 0.4 + index * 0.06 }}
          style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontWeight: 400,
            fontSize: '17px',
            color: 'rgba(247,244,239,0.74)',
            lineHeight: 1.65,
            maxWidth: '52ch',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {p.sub}
        </motion.p>

        {/* Sage rule separator — between items only */}
        {!isLast && (
          <div className="mx-auto mt-10 md:mt-16" style={{
            width: '40px',
            height: '1px',
            backgroundColor: 'var(--color-accent-light)',
            opacity: 0.4,
          }} />
        )}
      </div>
    </motion.div>
  );
};

// Pattern-break section — DARK editorial pull-quote manifesto.
// Third dark moment on the page; centered editorial typography with huge ghost numerals.
// Decisively breaks the paper rhythm of neighboring sections.
const AgentReadySection: React.FC = () => (
  <section
    className="py-12 md:py-24 border-t relative overflow-hidden"
    style={{ backgroundColor: '#1A1A1A', borderColor: 'rgba(247,244,239,0.08)' }}
  >
    <div className="container mx-auto px-8 max-w-3xl text-center">

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.9, ease }}
        style={{
          fontFamily: '"IBM Plex Mono", monospace',
          fontSize: '12px',
          letterSpacing: '0.25em',
          textTransform: 'uppercase',
          color: 'var(--color-accent-light)',
          marginBottom: '1.75rem',
        }}
      >
        03 / What "Agent-Ready" means
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
        whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.9, ease }}
        className="mb-12 md:mb-20 mx-auto"
        style={{
          fontFamily: '"DM Serif Display", "Bodoni Moda", Georgia, serif',
          fontWeight: 400,
          fontSize: 'clamp(2.4rem, 5vw, 4.2rem)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          color: '#F7F4EF',
          maxWidth: '22ch',
        }}
      >
        What does it mean<br />
        <span style={{ fontStyle: 'italic' }}>
          to be{' '}
          <span style={{ position: 'relative', display: 'inline-block' }}>
            Agent-Ready?
            <motion.span
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: 0.7, duration: 0.85, ease }}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: '0.14em',
                height: '0.34em',
                backgroundColor: 'var(--color-accent-light)',
                transformOrigin: 'left',
                opacity: 0.34,
                zIndex: -1,
              }}
            />
          </span>
        </span>
      </motion.h2>

      <div className="space-y-14 md:space-y-20 overflow-x-clip">
        {PRECONDITIONS.map((p, i) => (
          <PreconditionItem
            key={p.n}
            p={p}
            index={i}
            isLast={i === PRECONDITIONS.length - 1}
          />
        ))}
      </div>
    </div>
  </section>
);

// ─── Design icon — path draws as row scrolls through viewport ───────────────
const DesignIcon: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const pathLength = useTransform(scrollYProgress, [0.25, 0.55], [0, 1]);

  return (
    <div ref={ref} className="w-full h-full relative">
      <svg viewBox="0 0 200 100" className="w-full h-full">
        <path d="M 10 20 L 190 20 M 10 50 L 190 50 M 10 80 L 190 80 M 40 10 L 40 90 M 100 10 L 100 90 M 160 10 L 160 90" stroke="#1A1A1A" strokeWidth="0.5" fill="none" opacity="0.2" />
        <motion.path
          d="M 40 50 C 70 50, 70 20, 100 20 C 130 20, 130 80, 160 80"
          stroke="currentColor"
          style={{ color: 'var(--color-accent)', pathLength }}
          strokeWidth="1.5"
          fill="none"
        />
        {[{ cx: 40, cy: 50 }, { cx: 100, cy: 20 }, { cx: 160, cy: 80 }].map((pt, i) => (
          <circle key={i} cx={pt.cx} cy={pt.cy} r="2.5" fill="#F7F4EF" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="1" />
        ))}
      </svg>
    </div>
  );
};

// ─── Section 3: How we work ──────────────────────────────────────────────────
const WorkSection: React.FC = () => {
  const steps = [
    {
      id: '01', title: 'Diagnose',
      desc: <>I score your operation on the 4 preconditions and map exactly <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>where capacity is leaking.</span> You leave with your 90-Day AI Rollout Plan: what to build first, what compounds, what needs foundation work before it ships.</>,
      icon: (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <circle cx="50" cy="50" r="40" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="0.75" fill="none" opacity="0.4" />
          <circle cx="50" cy="50" r="20" stroke="#1A1A1A" strokeWidth="0.75" fill="none" strokeDasharray="3 3" opacity="0.3" />
          <line x1="50" y1="5" x2="50" y2="95" stroke="#1A1A1A" strokeWidth="0.5" opacity="0.15" />
          <line x1="5" y1="50" x2="95" y2="50" stroke="#1A1A1A" strokeWidth="0.5" opacity="0.15" />
          <motion.line x1="50" y1="50" x2="50" y2="10" stroke="currentColor" style={{ color: 'var(--color-accent)', transformOrigin: '50px 50px' }} strokeWidth="1" animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} />
          {[{ x: 30, y: 35 }, { x: 70, y: 40 }, { x: 60, y: 70 }, { x: 25, y: 65 }].map((pt, i) => (
            <circle key={i} cx={pt.x} cy={pt.y} r="1.5" fill="currentColor" style={{ color: 'var(--color-accent)' }} />
          ))}
        </svg>
      ),
    },
    {
      id: '02', title: 'Design',
      desc: <>I architect the full system end-to-end. Every data flow, decision point, and integration drawn out <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>before anyone writes code.</span> You sign off on the spec. What gets built is exactly what we agreed on.</>,
      icon: <DesignIcon />,
    },
    {
      id: '03', title: 'Build',
      desc: <>I build, test, and deploy into your existing stack. Your team uses it <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>the day it launches.</span> No multi-month rollout, no invisible progress. You see every step.</>,
      icon: (
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {[20, 50, 80].map((y, i) => (
            <rect key={i} x="20" y={y} width="60" height="15" rx="1.5" fill="none" stroke="currentColor" style={{ color: 'var(--color-accent)' }} strokeWidth="0.75" />
          ))}
          {[27, 57, 87].map((y, i) => (
            <motion.circle key={i} cx="72" cy={y} r="2" fill="currentColor" style={{ color: 'var(--color-accent)' }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 3, repeat: Infinity, delay: i * 0.6, ease: [0.25, 0.46, 0.45, 0.94] }} />
          ))}
        </svg>
      ),
    },
  ];

  return (
    <section className="py-12 md:py-20 border-t" style={DIVIDER}>
      <div className="container mx-auto px-8 max-w-6xl">
        <motion.div {...inView} className="mb-10">
          <Label>05 / How we work together</Label>
          <RevealH2 style={T.display('clamp(2.4rem,4vw,3.6rem)')}>
            Diagnose first.{' '}
            <span style={{ fontStyle: 'italic' }}>Build second.</span>
          </RevealH2>
        </motion.div>

        <div className="flex flex-col">
          {steps.map((step, i) => (
            <React.Fragment key={step.id}>
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                whileHover={{ y: -3, backgroundColor: 'rgba(42,143,101,0.022)' }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.8, ease, delay: i * 0.08 }}
                className="grid lg:grid-cols-[56px_1fr_1.2fr_120px] gap-6 py-7 border-t items-center relative overflow-hidden cursor-default"
                style={DIVIDER}
              >
                {/* Ghost italic numeral — depth texture */}
                <div aria-hidden style={{
                  position: 'absolute', right: '-0.04em', top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: 'clamp(70px,10vw,130px)',
                  fontFamily: '"DM Serif Display","Bodoni Moda",Georgia,serif',
                  fontStyle: 'italic', fontWeight: 400,
                  color: '#1A1A1A', opacity: 0.04, lineHeight: 1,
                  pointerEvents: 'none', userSelect: 'none',
                }}>
                  {step.id}
                </div>
                <div style={{ ...T.mono, color: 'var(--color-accent)', fontSize: '11px' }}>{step.id}</div>
                <h3 style={{ ...T.display('clamp(1.6rem,2.2vw,2rem)') }}>{step.title}</h3>
                <p style={{ ...T.serif, fontSize: '15px', lineHeight: 1.6 }}>{step.desc}</p>
                <div className="hidden lg:flex items-center justify-center h-20">{step.icon}</div>
              </motion.div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── Section 4: Testimonials ─────────────────────────────────────────────────
const TestimonialsSection: React.FC = () => (
  <section className="pt-12 md:pt-20 pb-0 border-t overflow-hidden" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-6xl mb-14">
      <motion.div {...inView}>
        <Label>06 / Client proof</Label>
        <RevealH2 style={T.display('clamp(2rem,3.5vw,3rem)')}>
          Every project ships.<br />Every client comes back.
        </RevealH2>
      </motion.div>
    </div>
    <div className="flex flex-col gap-5 pb-0">
      {[{ row: ROW1, dir: 1 }, { row: ROW2, dir: -1 }].map(({ row, dir }, ri) => (
        <div key={ri} className="relative">
          <div className="absolute inset-y-0 left-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to right, var(--color-paper), transparent)' }} />
          <div className="absolute inset-y-0 right-0 w-20 z-10 pointer-events-none" style={{ background: 'linear-gradient(to left, var(--color-paper), transparent)' }} />
          <motion.div
            className="flex gap-5 w-max px-5"
            initial={dir === -1 ? { x: '-50%' } : undefined}
            animate={{ x: dir === 1 ? '-50%' : '0%' }}
            transition={{ duration: dir === 1 ? 95 : 115, repeat: Infinity, ease: 'linear' }}
          >
            {row.map((r, i) => <ReviewCard key={i} r={r} />)}
          </motion.div>
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
    <section className="py-12 md:py-20 border-t" style={DIVIDER}>
      <div className="container mx-auto px-8 max-w-6xl">

        <motion.div {...inView} className="mb-16">
          <Label>07 / The guarantee</Label>
          <RevealH2 style={{ ...T.display('clamp(2.8rem,5.5vw,5rem)'), marginBottom: '1.25rem' }}>
            The 90-Day<br />Payback Rule.
          </RevealH2>
          <p style={{ ...T.serif, maxWidth: '480px' }}>
            Every build is scoped to pay back within 90 days or I don't build it.
            Plug in your numbers. See how much we can invest and still hit that bar.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">

          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.85, ease }} className="border p-10" style={DIVIDER}>
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
                  <div className="flex justify-between mt-2" style={{ ...T.mono, fontSize: '9px' }}>
                    <span>{field.range[0]}</span><span>{field.range[1]}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontStyle: 'italic', fontSize: '13px', color: 'rgba(26,26,26,0.45)', lineHeight: 1.5, marginTop: '24px' }}>
              Blended value = average hourly revenue target of the people doing the manual work.
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.85, ease }} className="flex flex-col gap-5">

            <div className="border p-8" style={DIVIDER}>
              <div style={{ ...T.mono, marginBottom: '10px' }}>Annual cost of this bottleneck</div>
              <Counter value={yearly} prefix="$" style={T.display('clamp(3rem,5.5vw,5rem)')} />
            </div>

            <div className="border p-8" style={{ ...DIVIDER, borderLeftWidth: '2px', borderLeftColor: qualifies ? 'var(--color-accent)' : 'rgba(26,26,26,0.2)' }}>
              <div style={{ ...T.mono, marginBottom: '10px' }}>Max build budget for 90-day payback</div>
              <Counter
                value={maxBuild}
                prefix="$"
                style={{ ...T.display('clamp(2.4rem,4.5vw,4rem)'), color: qualifies ? 'var(--color-accent)' : '#1A1A1A' }}
              />
              <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontStyle: 'italic', fontSize: '13px', color: 'rgba(26,26,26,0.5)', lineHeight: 1.5, marginTop: '10px' }}>
                {qualifies
                  ? 'This covers a real build. We scope to fit. Nothing over-engineered.'
                  : "Below the diagnostic threshold. We'd need to find a higher-leverage process, or start with the scorecard."}
              </p>
            </div>

            <motion.a
              href="/assessment"
              whileHover={{ y: -2 }}
              transition={{ duration: 0.18 }}
              className="flex items-center justify-between px-7 py-4 bg-black text-white"
              style={{ fontFamily: '"Source Serif 4",serif', fontWeight: 600, fontSize: '16px' }}
            >
              <span>See if you're Agent-Ready</span>
              <ArrowRight size={18} />
            </motion.a>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

// ─── Section 6: The Offer ─────────────────────────────────────────────────────
const OfferSection: React.FC = () => (
  <section className="py-12 md:py-20 border-t" style={{ borderColor: 'rgba(26,26,26,0.12)', backgroundColor: '#1A1A1A' }}>
    <div className="container mx-auto px-8 max-w-6xl">
      <div className="grid lg:grid-cols-[1fr_1px_1fr] items-start">

        <motion.div {...inView} className="pr-20">
          <Label dark>08 / The offer</Label>
          <motion.div
            initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
            whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.9, ease }}
            style={{ ...T.display('clamp(2.4rem,4vw,3.8rem)'), color: '#F7F4EF', marginBottom: '1rem' }}
          >
            Agent-Ready<br />Blueprint
          </motion.div>
          <div style={{ fontFamily: '"IBM Plex Mono",monospace', fontSize: '22px', color: '#F7F4EF', letterSpacing: '-0.01em', marginBottom: '1.5rem' }}>$2,000</div>
          <p style={{ ...T.serif, fontSize: '17px', color: 'rgba(247,244,239,0.72)', marginBottom: '1.5rem' }}>
            A one-week diagnostic. I evaluate your operation against the 4 preconditions,
            map where capacity is leaking, and hand back your 90-Day AI Rollout Plan:
            sequenced builds, costed gaps, decision logic for the first project.
          </p>
          <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontStyle: 'italic', fontSize: '13px', color: 'rgba(247,244,239,0.5)', lineHeight: 1.55 }}>
            100% credited toward the build if you proceed. You keep the scorecard either way. If we're not a fit after the 90-min discovery call, you don't pay.
          </p>
        </motion.div>

        <div className="hidden lg:block self-stretch" style={{ width: '1px', backgroundColor: 'rgba(247,244,239,0.1)' }} />

        <motion.div {...inView} transition={{ duration: 0.85, ease, delay: 0.15 }} className="pl-20 pt-8 lg:pt-0">
          <div style={{ ...T.mono, color: 'rgba(247,244,239,0.35)', marginBottom: '1.5rem' }}>What's included</div>
          <ul className="space-y-5 mb-10">
            {[
              ['90-min discovery call', 'We map your highest-leverage workflows together.'],
              ['Agent-Ready Scorecard', 'Where you stand on all 4 preconditions. Yours to keep.'],
              ['Workflow opportunity map', 'Every automatable process ranked by ROI.'],
              ['90-Day AI Rollout Plan', 'What to build first, second, and what to skip entirely.'],
              ['First-project spec', 'Full architecture for the highest-impact build. Ready to execute.'],
            ].map(([title, desc]) => (
              <li key={title} className="flex gap-4 items-start">
                <span style={{ color: 'var(--color-accent-light)', fontFamily: '"Source Serif 4",serif', fontStyle: 'italic', fontSize: '17px', lineHeight: 1.4, flexShrink: 0 }}>↳</span>
                <div>
                  <div style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontWeight: 600, fontSize: '14px', color: '#F7F4EF', lineHeight: 1.3 }}>{title}</div>
                  <div style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontStyle: 'italic', fontSize: '13px', color: 'rgba(247,244,239,0.42)', lineHeight: 1.4, marginTop: '3px' }}>{desc}</div>
                </div>
              </li>
            ))}
          </ul>
          <p style={{
            fontFamily: '"Source Serif 4", Georgia, serif',
            fontStyle: 'italic',
            fontSize: '13px',
            color: 'rgba(247,244,239,0.5)',
            marginBottom: '14px',
            lineHeight: 1.5,
          }}>
            Not ready?{' '}
            <a
              href="/scorecard"
              style={{
                color: 'rgba(247,244,239,0.7)',
                textDecoration: 'underline',
                textDecorationColor: 'rgba(247,244,239,0.25)',
                textUnderlineOffset: '3px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-accent-light)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(247,244,239,0.7)')}
            >
              take the free Agent-Ready Scorecard →
            </a>
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <MagneticCTA href="/assessment" variant="primary" dark>
              Build your Blueprint <ArrowRight size={18} />
            </MagneticCTA>
            <MagneticCTA href="/start" variant="ghost" dark fontSize="15px">
              Prefer to talk first? Book a call <ArrowRight size={15} />
            </MagneticCTA>
          </div>
        </motion.div>

      </div>
    </div>
  </section>
);

// ─── Section 7: Final CTA ─────────────────────────────────────────────────────
const FinalCTA: React.FC = () => (
  <section className="py-16 md:py-24 border-t relative overflow-hidden" style={DIVIDER}>
    <div className="container mx-auto px-8 max-w-4xl relative z-10">
      <motion.div {...inView} className="text-center">
        <div className="w-8 h-0.5 mx-auto mb-10" style={{ backgroundColor: 'var(--color-accent)' }} />
        <RevealH2 style={{ ...T.display('clamp(2.8rem,6vw,5.5rem)'), marginBottom: '1.75rem' }}>
          Ready to scale<br />without hiring?
        </RevealH2>
        <p style={{ ...T.serif, fontSize: '19px', maxWidth: '500px', margin: '0 auto 2.5rem', textAlign: 'center' }}>
          One week. Four preconditions.{' '}
          <span style={{ fontStyle: 'italic', color: 'var(--color-accent)' }}>Your 90-Day AI Rollout Plan.</span>
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <MagneticCTA href="/assessment" variant="primary" fontSize="17px" px="px-8 py-4">
            Build your Blueprint <ArrowRight size={18} />
          </MagneticCTA>
          <MagneticCTA href="/start" variant="ghost" fontSize="16px" px="px-8 py-4">
            Prefer to talk first? Book a call <ArrowRight size={15} />
          </MagneticCTA>
        </div>
        <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontStyle: 'italic', fontSize: '13px', color: 'rgba(26,26,26,0.55)', marginTop: '1.75rem' }}>
          Booking {getBookingQuarter()} · {OPEN_SLOTS} diagnostic slots remaining
        </p>
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
          <h3 style={{ ...T.display('clamp(2rem,3.5vw,3rem)'), marginBottom: '0.75rem' }}>
            Weekly notes on systems<br />
            <span style={{ fontStyle: 'italic' }}>that actually ship.</span>
          </h3>
          <p style={{ ...T.serif, fontSize: '15px', marginBottom: '2rem' }}>
            Written for founders of growing service businesses. No fluff, no AI hype. Just the patterns that work.
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
            <h2 style={{ ...T.display('clamp(1.8rem,2.4vw,2.4rem)'), fontStyle: 'normal', marginBottom: '4px' }}>
              Iván <span style={{ fontStyle: 'italic' }}>Manfredi</span>
            </h2>
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
        <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4" style={{ ...DIVIDER, ...T.mono, fontSize: '10px' }}>
          <p>© {new Date().getFullYear()} Iván Manfredi · All rights reserved</p>
          <div className="flex gap-7">
            <Link to="/store" style={{ color: 'rgba(26,26,26,0.55)', transition: 'color 0.15s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#1A1A1A'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(26,26,26,0.55)'}>Store</Link>
            <a href="/scorecard" style={{ color: 'rgba(26,26,26,0.55)' }} onMouseEnter={(e) => e.currentTarget.style.color = '#1A1A1A'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(26,26,26,0.55)'}>Scorecard</a>
            <a href="mailto:im@ivanmanfredi.com" style={{ color: 'rgba(26,26,26,0.55)' }} onMouseEnter={(e) => e.currentTarget.style.color = '#1A1A1A'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(26,26,26,0.55)'}>Contact</a>
          </div>
        </div>

      </div>
    </footer>
  );
};

// ─── About strip — dark credibility break before the footer ──────────────────
const AboutStrip: React.FC = () => (
  <section className="py-12 md:py-20 border-t" style={{ borderColor: 'rgba(26,26,26,0.12)', backgroundColor: '#1A1A1A' }}>
    <div className="container mx-auto px-8 max-w-5xl">
      <div className="grid md:grid-cols-[220px_1fr] gap-8 md:gap-14 items-start md:items-center">
        <motion.div
          initial={{ opacity: 0, scale: 1.05 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.9, ease }}
        >
          <picture>
            <source type="image/webp" srcSet="/ivan-hero-800.webp 800w, /ivan-hero-1200.webp 1200w" sizes="(min-width: 768px) 220px, 130px" />
            <img
              src="/ivan-hero.jpeg"
              alt="Iván Manfredi"
              className="w-32 md:w-full aspect-square object-cover object-top"
              style={{ borderRadius: '0' }}
            />
          </picture>
        </motion.div>
        <motion.div {...inView} style={{ maxWidth: '55ch' }}>
          <div style={{ ...T.mono, color: 'rgba(247,244,239,0.5)', marginBottom: '1.5rem' }}>Behind the work</div>
          <h2 style={{ ...T.display('clamp(1.8rem,2.6vw,2.6rem)'), fontStyle: 'normal', color: '#F7F4EF', marginBottom: '6px' }}>
            Iván <span style={{ fontStyle: 'italic' }}>Manfredi</span>
          </h2>
          <div style={{ ...T.mono, color: 'var(--color-accent-light)', marginBottom: '1.25rem' }}>Agent-Ready Ops™</div>
          <p style={{ ...T.serif, fontSize: '17px', color: 'rgba(247,244,239,0.78)', lineHeight: 1.6, marginBottom: '14px' }}>
            I've shipped <span style={{ fontStyle: 'italic', color: '#F7F4EF' }}>100+ AI and automation systems</span> for growing service businesses.
          </p>
          <p style={{ fontFamily: '"Source Serif 4",Georgia,serif', fontStyle: 'italic', fontSize: '14px', color: 'rgba(247,244,239,0.42)', lineHeight: 1.5 }}>
            Off-keyboard, I play tennis. With more enthusiasm than skill.
          </p>
        </motion.div>
      </div>
    </div>
  </section>
);

// ─── Page ─────────────────────────────────────────────────────────────────────
const LandingPage: React.FC = () => {
  useEffect(() => {
    const prev = document.title;
    document.title = 'Iván Manfredi · Agent-Ready Ops';
    return () => { document.title = prev; };
  }, []);

  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 22 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 22 });
  const xPct = useTransform(springX, (x) => `${x * 100}%`);
  const yPct = useTransform(springY, (y) => `${y * 100}%`);
  const spotlight = useMotionTemplate`radial-gradient(600px circle at ${xPct} ${yPct}, rgba(42,143,101,0.15), transparent 70%)`;

  return (
    <MotionConfig reducedMotion="user">
    <div
      style={{ backgroundColor: 'var(--color-paper)', position: 'relative' }}
      onMouseMove={(e) => {
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
        style={{ background: spotlight, position: 'fixed', inset: 0, zIndex: 9999 }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>
        <LandingHero />
        <ProblemSection />
        <AgentReadySection />
        <BuildOutcomesSection />
        <WorkSection />
        <TestimonialsSection />
        <PaybackSection />
        <OfferSection />
        <FinalCTA />
        <AboutStrip />
        <LandingFooter />
      </div>
    </div>
    </MotionConfig>
  );
};

export default LandingPage;
