import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMetadata } from '../hooks/useMetadata';
import {
  siN8n, siClaude, siHubspot, siSupabase, siClickup, siWebflow,
  siGmail, siStripe, siNotion, siAirtable, siWhatsapp, siGooglegemini,
} from 'simple-icons';

// ────────────────────────────────────────────────────────────────────────
// Tool logos — monochrome, brand-correct (ink color, no vendor color clash)
// ────────────────────────────────────────────────────────────────────────

// Slug → simple-icons path data. Two tools (Fireflies, Firecrawl) aren't in
// simple-icons; render a small flame glyph for both since both are
// "fire-themed" services. Editorially honest, brand-correct.
const LOGO_PATHS: Record<string, string> = {
  'n8n': siN8n.path,
  'claude': siClaude.path,
  'hubspot': siHubspot.path,
  'supabase': siSupabase.path,
  'clickup': siClickup.path,
  'webflow': siWebflow.path,
  'gmail': siGmail.path,
  'stripe': siStripe.path,
  'notion': siNotion.path,
  'airtable': siAirtable.path,
  'whatsapp': siWhatsapp.path,
  'gemini': siGooglegemini.path,
  // Hand-built minimal flame for the two services missing from simple-icons.
  // Single path on a 24×24 viewBox.
  'flame': 'M12 2c1.5 4 4 5.5 4 9a4 4 0 1 1-8 0c0-1.6.7-2.6 1.5-3.5C10.3 6.5 12 5 12 2zm0 14a3 3 0 0 0 3-3c0-1-.5-2-2-3 0 1.5-1 2-2 2.5-.7.4-1 1-1 2a2 2 0 0 0 2 1.5z',
};

const TOOL_TO_SLUG: Record<string, string> = {
  'n8n': 'n8n',
  'Claude': 'claude',
  'HubSpot': 'hubspot',
  'Supabase': 'supabase',
  'ClickUp': 'clickup',
  'Webflow': 'webflow',
  'Gmail': 'gmail',
  'Stripe': 'stripe',
  'Notion': 'notion',
  'Airtable': 'airtable',
  'WhatsApp API': 'whatsapp',
  'Gemini OCR': 'gemini',
  'Fireflies': 'flame',
  'Firecrawl': 'flame',
};

const Logo: React.FC<{ tool: string; size?: number; className?: string }> = ({
  tool, size = 14, className = '',
}) => {
  const slug = TOOL_TO_SLUG[tool];
  const path = slug ? LOGO_PATHS[slug] : null;
  if (!path) return null;
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={`shrink-0 ${className}`}
      aria-label={tool}
    >
      <path d={path} />
    </svg>
  );
};

/**
 * /walkthrough — recording-only deck route.
 *
 * Full-bleed editorial slide deck for the 5-day Blueprint walkthrough video.
 * Reuses the site's brand tokens (paper, sage, Space Grotesk, DM Serif italic,
 * IBM Plex Mono) so the recorded video matches ivanmanfredi.com pixel-for-pixel.
 *
 * Keyboard: → / Space advance · ← back · Home/End jump.
 * Excluded from public nav. Used for screen-capture only.
 */

const TOTAL = 10;
const editorial = [0.22, 0.36, 0, 1] as const;

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -24 },
};

// ────────────────────────────────────────────────────────────────────────
// Shared atomic primitives
// ────────────────────────────────────────────────────────────────────────

const MonoLabel: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children, delay = 0.2, className = '',
}) => (
  <motion.div
    className={`font-mono text-[11px] uppercase tracking-[0.2em] text-ink-mute ${className}`}
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: editorial }}
  >
    {children}
  </motion.div>
);

const SageRule: React.FC<{ delay?: number; w?: string; align?: 'left' | 'center' }> = ({
  delay = 0.8, w = 'w-32', align = 'left',
}) => (
  <motion.div
    className={`h-px bg-accent ${w} ${align === 'left' ? 'origin-left' : 'origin-center mx-auto'}`}
    initial={{ scaleX: 0 }}
    animate={{ scaleX: 1 }}
    transition={{ delay, duration: 0.7, ease: editorial }}
  />
);

const SageBullet: React.FC = () => (
  <span className="inline-block w-2 h-2 bg-accent shrink-0 mt-2" />
);

// Wraps each slide in full-bleed paper with consistent padding + crossfade.
const Slide: React.FC<{ children: React.ReactNode; bg?: string }> = ({
  children, bg = 'bg-paper',
}) => (
  <motion.section
    className={`absolute inset-0 ${bg} px-16 md:px-24 py-16 overflow-hidden`}
    {...fadeUp}
    transition={{ duration: 0.7, ease: editorial }}
  >
    {children}
  </motion.section>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 01 — walkthrough cover
// ────────────────────────────────────────────────────────────────────────

const Slide01: React.FC = () => (
  <Slide bg="bg-paper-sunk">
    <div className="h-full grid grid-cols-1 md:grid-cols-[1fr_auto] gap-12 items-center max-w-7xl mx-auto">
      {/* Left — text column */}
      <div>
        <MonoLabel delay={0.15}>AGENT-READY OPS™ / WALKTHROUGH</MonoLabel>

        <motion.h1
          className="mt-12 text-7xl md:text-[8.5rem] font-semibold tracking-tighter leading-[0.92]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          The <span className="font-drama-display">Agent-Ready</span>
          <br />
          Blueprint.
        </motion.h1>

        <div className="mt-10">
          <SageRule delay={1.0} w="w-40" />
        </div>

        <motion.p
          className="mt-8 text-2xl text-ink-soft max-w-xl leading-snug"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.6, ease: editorial }}
        >
          A one-week structured audit of your operation —
          tools, workflows, data — and the 90-day plan
          that comes out of it.
        </motion.p>

        <motion.div
          className="mt-10 flex items-center gap-4 font-mono text-xs uppercase tracking-[0.18em] text-ink-mute"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.7, duration: 0.6 }}
        >
          <span className="px-2 py-1 border border-[color:var(--color-hairline-bold)]">
            $2,000
          </span>
          <span>·</span>
          <span>5 DAYS</span>
          <span>·</span>
          <span>1 DOCUMENT</span>
        </motion.div>
      </div>

      {/* Right — Ivan portrait, paper-edged */}
      <motion.div
        className="hidden md:block relative"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6, duration: 0.8, ease: editorial }}
      >
        <picture>
          <source
            type="image/webp"
            srcSet="/ivan-portrait-400.webp 400w, /ivan-portrait-800.webp 800w"
            sizes="320px"
          />
          <img
            src="/ivan-portrait.jpg"
            alt="Iván Manfredi"
            width={400}
            height={500}
            className="w-80 h-[400px] object-cover border border-[color:var(--color-hairline-bold)] shadow-card-lift portrait-editorial"
          />
        </picture>
      </motion.div>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 02 — terms
// ────────────────────────────────────────────────────────────────────────

const Slide02: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-6xl mx-auto">
      <MonoLabel>THE TERMS</MonoLabel>

      <div className="mt-16 grid grid-cols-3 gap-12 max-w-5xl">
        {[
          { label: 'PRICE', value: '$2,000', italic: false, delay: 0.4 },
          { label: 'DURATION', value: '1 week', italic: false, delay: 0.7 },
          { label: 'OUTCOME', value: 'a 90-day plan', italic: true, delay: 1.0 },
        ].map((cell) => (
          <motion.div
            key={cell.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: cell.delay, duration: 0.6, ease: editorial }}
            className="border-t border-[color:var(--color-hairline-bold)] pt-6"
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute mb-3">
              {cell.label}
            </div>
            <div
              className={`text-5xl md:text-6xl tracking-tighter leading-[1] ${
                cell.italic ? 'font-drama-display' : 'font-semibold stat-numeral'
              }`}
            >
              {cell.value}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.p
        className="mt-16 text-xl text-ink-soft max-w-2xl leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        Or sometimes — a clear recommendation to wait.
      </motion.p>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 03 — the 4 preconditions
// ────────────────────────────────────────────────────────────────────────

const preconditions = [
  { num: '01', label: 'Clean inputs.', tag: 'data the system can read every time' },
  { num: '02', label: 'Documentable decisions.', tag: 'someone can write down how they decide' },
  { num: '03', label: 'A narrow first job.', tag: 'one workflow, end to end, before widening' },
  { num: '04', label: 'Repeatable enough to encode.', tag: 'the work runs often enough that automation compounds' },
];

const Slide03: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-6xl mx-auto">
      <MonoLabel>WHAT I'M LOOKING FOR</MonoLabel>

      <motion.h2
        className="mt-8 text-5xl md:text-6xl font-semibold tracking-tighter leading-[1.0] mb-12 max-w-3xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: editorial }}
      >
        Four things, every time.
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl">
        {preconditions.map((p, i) => (
          <motion.div
            key={p.num}
            className="flex gap-5 items-start border-l border-[color:var(--color-hairline-bold)] pl-5"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.18, duration: 0.6, ease: editorial }}
          >
            <span className="font-mono text-xs text-ink-mute mt-2 shrink-0">{p.num}</span>
            <div className="flex-1">
              <div className="text-2xl font-semibold tracking-tight leading-tight mb-2">
                {p.label}
              </div>
              <div className="text-base text-ink-soft leading-relaxed">{p.tag}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 04 — Day 1-3 process
// ────────────────────────────────────────────────────────────────────────

// Each row is a category I inspect on day one. The "found" example is illustrative —
// in a real Blueprint it gets replaced by whatever the client actually runs.
// Score = 0..4 sage pips against the 4 preconditions (input/logic/scope/loop).
const auditRows: Array<{ category: string; found: string; score: number }> = [
  { category: 'CRM / source of truth', found: 'HubSpot', score: 3 },
  { category: 'Database / ops data', found: 'Supabase', score: 4 },
  { category: 'Automation engine', found: 'n8n', score: 3 },
  { category: 'AI / LLM layer', found: 'Claude', score: 4 },
  { category: 'Project tracking', found: 'ClickUp', score: 2 },
  { category: 'Decision documentation', found: 'Notion', score: 2 },
  { category: 'Payments / billing', found: 'Stripe', score: 4 },
];

const Slide04: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-6xl mx-auto">
      <MonoLabel>DAY ONE — STACK AUDIT</MonoLabel>

      <motion.h2
        className="mt-8 text-5xl md:text-6xl font-semibold tracking-tighter leading-[1.0] mb-3 max-w-4xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        I review what runs your operation.{' '}
        <span className="font-drama-display">Then score it.</span>
      </motion.h2>

      <motion.p
        className="text-lg text-ink-soft mb-10 max-w-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        Seven layers, every audit. Each scored against the four preconditions.
      </motion.p>

      {/* Audit table */}
      <div className="border-t border-[color:var(--color-hairline-bold)] max-w-5xl">
        {/* Header row */}
        <motion.div
          className="grid grid-cols-[1fr_220px_140px] gap-6 py-3 border-b border-[color:var(--color-hairline)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {['CATEGORY', 'FOUND', 'READINESS'].map((h) => (
            <div
              key={h}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute"
            >
              {h}
            </div>
          ))}
        </motion.div>

        {auditRows.map((row, i) => (
          <motion.div
            key={row.category}
            className="grid grid-cols-[1fr_220px_140px] gap-6 py-4 items-center border-b border-[color:var(--color-hairline)]"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0 + i * 0.18, duration: 0.5, ease: editorial }}
          >
            <div className="text-base text-ink-soft">{row.category}</div>

            <motion.div
              className="inline-flex items-center gap-2 self-start px-2.5 py-1.5 border border-[color:var(--color-hairline-bold)] font-mono text-xs uppercase tracking-[0.1em] text-black w-fit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.0 + i * 0.18 + 0.25, duration: 0.4 }}
            >
              <Logo tool={row.found} size={14} className="text-accent-ink" />
              {row.found}
            </motion.div>

            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((j) => (
                <motion.div
                  key={j}
                  className={`w-3 h-3 ${
                    j < row.score
                      ? 'bg-accent'
                      : 'bg-transparent border border-[color:var(--color-hairline-bold)]'
                  }`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.0 + i * 0.18 + 0.5 + j * 0.06, duration: 0.3 }}
                />
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <motion.div
        className="mt-6 flex items-center gap-3 text-xs font-mono uppercase tracking-[0.1em] text-ink-mute"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
      >
        <span className="w-2 h-2 bg-accent" />
        <span>1 PIP PER PRECONDITION · INPUTS · DECISIONS · SCOPE · HUMAN-IN-LOOP</span>
      </motion.div>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 05 — cost math
// ────────────────────────────────────────────────────────────────────────

const Slide05: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-6xl mx-auto">
      <MonoLabel>THE NUMBERS, FAST</MonoLabel>

      {/* Equation that builds */}
      <div className="mt-12 mb-8">
        <motion.div
          className="font-mono text-2xl md:text-3xl text-ink-soft tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          20 hrs / week
        </motion.div>
        <motion.div
          className="font-mono text-2xl md:text-3xl text-ink-soft tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          × $150 blended
        </motion.div>
        <motion.div
          className="font-mono text-2xl md:text-3xl text-ink-soft tracking-tight"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
        >
          × 52 weeks
        </motion.div>

        <motion.div
          className="mt-4 mb-4"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.9, duration: 0.5 }}
          style={{ transformOrigin: 'left' }}
        >
          <div className="h-px bg-ink w-64" />
        </motion.div>

        <motion.div
          className="stat-numeral text-7xl md:text-9xl font-semibold tracking-tighter leading-[1]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.2, duration: 0.7, ease: editorial }}
        >
          <span className="font-drama-display">$156,000</span>
          <span className="text-3xl md:text-4xl text-ink-mute ml-4 font-mono">/ year</span>
        </motion.div>
      </div>

      <SageRule delay={3.0} w="w-24" />

      <motion.p
        className="mt-8 text-xl text-ink-soft max-w-3xl leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.4 }}
      >
        The Blueprint is{' '}
        <span className="font-mono font-semibold text-black">1.6%</span> of one role.
      </motion.p>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 06 — proof carousel
// ────────────────────────────────────────────────────────────────────────

const cases = [
  {
    tag: 'PROVALTECH · CLIENT OPS',
    headlineA: '5%',
    headlineB: '100%',
    label: 'CHURN SIGNALS CAUGHT',
    problem: 'Spot-checking 5% of client calls — by the time someone noticed an unhappy account, it was usually too late.',
    blurb:
      'Every client call now flows through Fireflies for transcription. Claude reads each transcript for churn signals — frustration, scope drift, dropping engagement — and routes flagged calls to the account lead via Gmail. Customer state syncs to HubSpot, signal tracking to Airtable. First retained account paid for the build.',
    stack: ['Fireflies', 'Claude', 'n8n', 'HubSpot', 'Airtable', 'Gmail'],
    image: '/cases/provaltech.png',
    imageAlt: 'Provaltech call performance dashboard',
  },
  {
    tag: 'MARKETING SHOP · GROWTH OPS',
    headlineA: '3 days',
    headlineB: '1 afternoon',
    label: 'PER LEAD-MAGNET BUILD',
    problem: 'Each new lead magnet was three full days of research, copywriting, design, and deployment — every single time.',
    blurb:
      'ClickUp briefs trigger the pipeline. Claude does the topic research and drafts the copy from a tested structure. n8n routes the draft through human review, then ships the resource page in Webflow with all assets in place. Same editorial quality, roughly five times the throughput.',
    stack: ['Claude', 'ClickUp', 'Webflow', 'n8n'],
    image: null,
    imageAlt: '',
  },
  {
    tag: 'DESTINO FARMS · INVENTORY OPS',
    headlineA: '20 sources',
    headlineB: '1 dashboard',
    label: 'LIVE SUPPLIER INVENTORY',
    problem: 'Twenty suppliers, five different channels — WhatsApp messages, supplier websites, shared Google Sheets. Hours of manual reconciliation every morning.',
    blurb:
      'WhatsApp API captures supplier messages. Gemini OCR reads stock photos and PDFs. Firecrawl scrapes supplier sites on a schedule. Claude normalizes everything into one inventory model, n8n orchestrates it, and a custom interface displays a single live dashboard — updated automatically through the day.',
    stack: ['Claude', 'Gemini OCR', 'Firecrawl', 'WhatsApp API', 'n8n'],
    image: null,
    imageAlt: '',
  },
];

const Slide06: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-7xl mx-auto">
      <MonoLabel>SOME RECENT ENGAGEMENTS</MonoLabel>

      <motion.h2
        className="mt-8 text-5xl md:text-6xl font-semibold tracking-tighter leading-[1.0] mb-14"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <span className="font-drama-display">Receipts.</span>
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {cases.map((c, i) => (
          <motion.div
            key={c.tag}
            className="border border-[color:var(--color-hairline-bold)] bg-paper-raise flex flex-col overflow-hidden"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.22, duration: 0.7, ease: editorial }}
          >
            {/* Visual header — real screenshot if available, else typographic hero */}
            {c.image ? (
              <div className="aspect-[16/10] bg-paper-sunk border-b border-[color:var(--color-hairline)] overflow-hidden relative">
                <img
                  src={c.image}
                  alt={c.imageAlt}
                  className="w-full h-full object-cover object-top"
                />
                <div className="absolute inset-0 bg-paper opacity-[0.04] pointer-events-none" />
              </div>
            ) : (
              <div className="aspect-[16/10] bg-paper-sunk border-b border-[color:var(--color-hairline)] flex flex-col items-center justify-center px-6 text-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute">
                  {c.label}
                </span>
                <span className="font-drama-display text-6xl text-black tracking-tight leading-none">
                  {c.headlineB}
                </span>
              </div>
            )}

            <div className="p-7 flex flex-col flex-1">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-4">
                {c.tag}
              </div>

              {/* Before → after metric (always shown in body) */}
              <div className="flex items-baseline gap-3 mb-1">
                <span className="font-mono text-xl text-ink-mute line-through tabular-nums">
                  {c.headlineA}
                </span>
                <span className="font-mono text-ink-mute">→</span>
                <span className="text-3xl font-semibold tracking-tight text-black leading-none">
                  {c.headlineB}
                </span>
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-4">
                {c.label}
              </div>

              <p className="text-sm text-black font-medium leading-relaxed mb-3 italic">
                {c.problem}
              </p>
              <p className="text-sm text-ink-soft leading-relaxed mb-6 flex-1">{c.blurb}</p>

              {/* Stack — what the build ran on */}
              <div className="border-t border-[color:var(--color-hairline)] pt-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-3">
                  STACK
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.stack.map((tool) => (
                    <span
                      key={tool}
                      className="inline-flex items-center gap-1.5 px-2 py-1 border border-[color:var(--color-hairline-bold)] font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft"
                    >
                      <Logo tool={tool} size={10} className="text-accent-ink" />
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 07 — deliverable showcase (the hero moment)
// ────────────────────────────────────────────────────────────────────────

const Slide07: React.FC = () => (
  <Slide bg="bg-paper-sunk">
    <div className="h-full flex flex-col justify-center items-center max-w-6xl mx-auto">
      <MonoLabel delay={0.1}>WHAT YOU LEAVE WITH</MonoLabel>

      {/* Document cover */}
      <motion.div
        className="mt-10 w-full max-w-3xl bg-paper border border-[color:var(--color-hairline-bold)] shadow-card-lift px-12 py-14 relative"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8, ease: editorial }}
      >
        {/* Top brand pill */}
        <motion.div
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          AGENT-READY OPS™
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="text-[42px] md:text-[56px] tracking-tighter leading-[0.95]"
        >
          <div className="font-semibold">Your</div>
          <div className="font-semibold">90-Day AI</div>
          <div className="font-drama-display">Rollout Plan.</div>
        </motion.div>

        {/* Sage hairline */}
        <motion.div
          className="h-px bg-accent w-2/3 mt-10 origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.5, duration: 0.7, ease: editorial }}
        />

        {/* Description */}
        <motion.p
          className="mt-8 text-base text-ink-soft leading-relaxed max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.9 }}
        >
          An evaluation of your operation against the 4 Agent-Ready
          preconditions, with a sequenced build plan for the next 90 and 180 days.
        </motion.p>

        {/* Colophon (replaces "Prepared by") */}
        <motion.div
          className="mt-16 flex items-end justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.4 }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute leading-relaxed">
            MANFREDI / AGENT-READY OPS™
            <br />
            2026.04
          </div>
          {/* Sage seal */}
          <motion.div
            className="flex items-center gap-2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 2.7, duration: 0.5, ease: editorial }}
          >
            <span className="w-2 h-2 bg-accent" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-ink font-semibold">
              ASSESSMENT · NO. 12
            </span>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* TOC strip below cover */}
      <motion.div
        className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-x-8 gap-y-3 max-w-3xl w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.2 }}
      >
        {[
          'Workflow scorecard',
          'Costed gap analysis',
          '90-day build sequence',
          'Project 01 decision logic',
        ].map((item, i) => (
          <motion.div
            key={item}
            className="flex items-center gap-2"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 3.4 + i * 0.12, duration: 0.5 }}
          >
            <span className="w-1.5 h-1.5 bg-accent shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-soft">
              {item}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 08 — credit math reveal
// ────────────────────────────────────────────────────────────────────────

const Slide08: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-6xl mx-auto">
      <MonoLabel>ON THE PRICE</MonoLabel>

      <motion.h2
        className="mt-8 text-5xl md:text-6xl font-semibold tracking-tighter leading-[1.0] mb-14 max-w-4xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        The $2,000 isn't a{' '}
        <span className="font-drama-display">separate fee.</span>
      </motion.h2>

      <motion.p
        className="text-xl text-ink-soft mb-12 max-w-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        It credits 100% to anything we ship together within 60 days.
      </motion.p>

      {/* Math ledger */}
      <motion.div
        className="bg-paper-sunk border border-[color:var(--color-hairline-bold)] p-10 max-w-2xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.7, ease: editorial }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute mb-6">
          FRACTIONAL STANDARD · MONTH 1
        </div>

        <div className="space-y-3 font-mono text-2xl">
          <motion.div
            className="flex justify-between"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.7 }}
          >
            <span className="text-ink-soft">Retainer</span>
            <span className="stat-numeral text-black">$6,500</span>
          </motion.div>
          <motion.div
            className="flex justify-between text-ink-mute"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.1 }}
          >
            <span>Blueprint credit</span>
            <span className="stat-numeral">– $2,000</span>
          </motion.div>
          <motion.div
            className="border-t border-[color:var(--color-hairline-bold)] pt-3"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 2.4, duration: 0.4 }}
            style={{ transformOrigin: 'left' }}
          />
          <motion.div
            className="flex justify-between items-baseline"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.7, duration: 0.6, ease: editorial }}
          >
            <span className="font-drama italic text-3xl font-normal text-black">First month</span>
            <span className="stat-numeral text-5xl font-semibold text-accent-ink">$4,000</span>
          </motion.div>
        </div>

        <motion.div
          className="mt-8 flex items-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3.2 }}
        >
          <span className="w-1.5 h-1.5 bg-accent" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            Includes 2 strategy calls + 2–3 builds
          </span>
        </motion.div>
      </motion.div>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 09 — the honest exit
// ────────────────────────────────────────────────────────────────────────

const Slide09: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-5xl mx-auto">
      <MonoLabel>ONE MORE THING</MonoLabel>

      <motion.h2
        className="mt-12 text-5xl md:text-7xl font-semibold tracking-tighter leading-[1.05]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.7, ease: editorial }}
      >
        Sometimes I recommend you{' '}
        <span className="font-drama-display">wait.</span>
      </motion.h2>

      <motion.div
        className="mt-12 mb-8"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 1.2, duration: 0.7, ease: editorial }}
        style={{ transformOrigin: 'left' }}
      >
        <div className="h-px bg-accent w-32" />
      </motion.div>

      <motion.p
        className="text-2xl text-ink-soft max-w-3xl leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
      >
        Fix the foundation first. That recommendation is the deliverable.
      </motion.p>

      <motion.p
        className="mt-6 font-mono text-sm uppercase tracking-[0.2em] text-ink-mute"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.1 }}
      >
        NO UPSELL · NO PRESSURE
      </motion.p>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 10 — close
// ────────────────────────────────────────────────────────────────────────

const Slide10: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center items-start max-w-5xl mx-auto">
      <MonoLabel>BOOK IT</MonoLabel>

      <motion.h2
        className="mt-12 text-7xl md:text-9xl font-semibold tracking-tighter leading-[0.95]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.7, ease: editorial }}
      >
        Your
        <br />
        90-Day AI
        <br />
        <span className="font-drama-display">Rollout Plan.</span>
      </motion.h2>

      <motion.div
        className="mt-12 flex items-baseline gap-8"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.6 }}
      >
        <span className="stat-numeral text-5xl md:text-6xl font-semibold">$2,000</span>
        <span className="font-mono text-base uppercase tracking-[0.2em] text-ink-mute">
          ONE WEEK · CREDITED 100%
        </span>
      </motion.div>

      <motion.div
        className="mt-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.9 }}
      >
        <div className="px-10 py-5 bg-accent text-white font-semibold text-lg tracking-wide inline-flex items-center gap-3">
          ivanmanfredi.com / assessment
        </div>
      </motion.div>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Main deck
// ────────────────────────────────────────────────────────────────────────

const Walkthrough: React.FC = () => {
  const [index, setIndex] = useState(0);

  useMetadata({
    title: 'Walkthrough · Manfredi',
    description: 'Five-day Agent-Ready Blueprint walkthrough.',
    canonical: 'https://ivanmanfredi.com/walkthrough',
    noindex: true,
  });

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, TOTAL - 1)), []);
  const prev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Home') {
        e.preventDefault();
        setIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setIndex(TOTAL - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  // Suppress body scroll while the deck is open
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const slide = useMemo(() => {
    switch (index) {
      case 0: return <Slide01 key="01" />;
      case 1: return <Slide02 key="02" />;
      case 2: return <Slide03 key="03" />;
      case 3: return <Slide04 key="04" />;
      case 4: return <Slide05 key="05" />;
      case 5: return <Slide06 key="06" />;
      case 6: return <Slide07 key="07" />;
      case 7: return <Slide08 key="08" />;
      case 8: return <Slide09 key="09" />;
      case 9: return <Slide10 key="10" />;
      default: return null;
    }
  }, [index]);

  return (
    <div className="fixed inset-0 bg-paper text-ink overflow-hidden">
      <AnimatePresence mode="wait">{slide}</AnimatePresence>

      {/* Slide counter — bottom left */}
      <div className="absolute bottom-6 left-8 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute pointer-events-none">
        {String(index + 1).padStart(2, '0')} / {String(TOTAL).padStart(2, '0')}
      </div>

      {/* Keyboard hint — bottom right, fades after first advance */}
      {index === 0 && (
        <motion.div
          className="absolute bottom-6 right-8 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
        >
          → / SPACE TO ADVANCE
        </motion.div>
      )}

      {/* Progress hairline — top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-[color:var(--color-hairline)] pointer-events-none">
        <motion.div
          className="h-full bg-accent origin-left"
          initial={false}
          animate={{ scaleX: (index + 1) / TOTAL }}
          transition={{ duration: 0.6, ease: editorial }}
        />
      </div>
    </div>
  );
};

export default Walkthrough;
