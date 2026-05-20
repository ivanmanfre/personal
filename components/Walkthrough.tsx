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
  // simple-icons doesn't carry LinkedIn anymore (trademark policy). Hand-built "in" mark.
  'linkedin': 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  // Fireflies + Firecrawl aren't in simple-icons. A small flame works for both.
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
  'LinkedIn API': 'linkedin',
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
 * Editorial slide deck for the Agent-Ready Blueprint walkthrough video.
 * Framework: Score · Map · Blueprint.
 *
 * Keyboard: → / Space advance · ← back · Home/End jump.
 * Excluded from public nav. Used for screen-capture only.
 */

const TOTAL = 14;
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
// Slide 01 — cover
// ────────────────────────────────────────────────────────────────────────

const Slide01: React.FC = () => (
  <Slide bg="bg-paper-sunk">
    <div className="h-full grid grid-cols-1 md:grid-cols-[1fr_auto] gap-12 items-center max-w-7xl mx-auto">
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
          One week. Three things you walk out with —
          the Score, the Map, and the 90-day Blueprint.
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
          { label: 'OUTCOME', value: 'the Blueprint', italic: true, delay: 1.0 },
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
        Credits 100% back if we ship something together inside 60 days.
      </motion.p>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 03 — the framework: Score · Map · Blueprint
// ────────────────────────────────────────────────────────────────────────

const framework = [
  {
    num: '01',
    name: 'The Score',
    blurb: 'Where your operation stands on the four conditions every AI build needs.',
  },
  {
    num: '02',
    name: 'The Map',
    blurb: 'Which work stays with you, which gets handed off, which gets accelerated.',
  },
  {
    num: '03',
    name: 'The Blueprint',
    blurb: 'The 90-day build plan with a dollar number on every gap.',
  },
];

const Slide03: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-6xl mx-auto">
      <MonoLabel>WHAT YOU WALK OUT WITH</MonoLabel>

      <motion.h2
        className="mt-8 text-5xl md:text-6xl font-semibold tracking-tighter leading-[1.0] mb-14 max-w-4xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: editorial }}
      >
        Three things, in <span className="font-drama-display">plain English.</span>
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl">
        {framework.map((item, i) => (
          <motion.div
            key={item.num}
            className="border-t border-[color:var(--color-hairline-bold)] pt-6"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + i * 0.22, duration: 0.6, ease: editorial }}
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute mb-4">
              {item.num}
            </div>
            <div className="font-drama-display text-4xl md:text-5xl text-black tracking-tight leading-none mb-5">
              {item.name}
            </div>
            <p className="text-base text-ink-soft leading-relaxed">{item.blurb}</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        className="mt-14 flex items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <span className="w-2 h-2 bg-accent" />
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-ink-soft">
          SCORE · MAP · BLUEPRINT
        </span>
      </motion.div>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 04 — the Score: 4 preconditions
// ────────────────────────────────────────────────────────────────────────

const preconditions = [
  { num: '01', label: 'Clean inputs.', tag: 'data the system can read every time' },
  { num: '02', label: 'Documentable decisions.', tag: 'someone can write down how they decide' },
  { num: '03', label: 'A narrow first job.', tag: 'one workflow, end to end, before widening' },
  { num: '04', label: 'Repeatable enough to encode.', tag: 'the work runs often enough that automation compounds' },
];

const Slide04: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-6xl mx-auto">
      <MonoLabel>01 · THE SCORE</MonoLabel>

      <motion.h2
        className="mt-8 text-5xl md:text-6xl font-semibold tracking-tighter leading-[1.0] mb-12 max-w-3xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: editorial }}
      >
        Four things, <span className="font-drama-display">every time.</span>
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
// Slide 05 — the Score in action: stack audit
// ────────────────────────────────────────────────────────────────────────

const auditRows: Array<{ category: string; found: string; score: number }> = [
  { category: 'CRM / source of truth', found: 'HubSpot', score: 3 },
  { category: 'Database / ops data', found: 'Supabase', score: 4 },
  { category: 'Automation engine', found: 'n8n', score: 3 },
  { category: 'AI / LLM layer', found: 'Claude', score: 4 },
  { category: 'Project tracking', found: 'ClickUp', score: 2 },
  { category: 'Decision documentation', found: 'Notion', score: 2 },
  { category: 'Payments / billing', found: 'Stripe', score: 4 },
];

const Slide05: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-6xl mx-auto">
      <MonoLabel>01 · THE SCORE — IN ACTION</MonoLabel>

      <motion.h2
        className="mt-8 text-5xl md:text-6xl font-semibold tracking-tighter leading-[1.0] mb-3 max-w-4xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        Day one, I walk your stack.{' '}
        <span className="font-drama-display">Then score it.</span>
      </motion.h2>

      <motion.p
        className="text-lg text-ink-soft mb-10 max-w-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        Seven layers, every audit. Each scored against the four conditions.
      </motion.p>

      <div className="border-t border-[color:var(--color-hairline-bold)] max-w-5xl">
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

      <motion.div
        className="mt-6 flex items-center gap-3 text-xs font-mono uppercase tracking-[0.1em] text-ink-mute"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
      >
        <span className="w-2 h-2 bg-accent" />
        <span>1 PIP PER CONDITION · INPUTS · DECISIONS · SCOPE · HUMAN-IN-LOOP</span>
      </motion.div>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 06 — the Map: Owner / Auto / Assist
// ────────────────────────────────────────────────────────────────────────

const lanes = [
  {
    num: '01',
    label: 'Owner work',
    line: 'What only you can do.',
    examples: ['Sales calls', 'Partnerships', 'Hiring'],
  },
  {
    num: '02',
    label: 'Auto work',
    line: 'What the system handles end-to-end.',
    examples: ['Routing', 'Data entry', 'Scheduled outreach'],
  },
  {
    num: '03',
    label: 'Assist work',
    line: 'What AI drafts and you approve.',
    examples: ['Qualification', 'Scoring', 'Replies'],
  },
];

const Slide06: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-6xl mx-auto">
      <MonoLabel>02 · THE MAP</MonoLabel>

      <motion.h2
        className="mt-8 text-5xl md:text-6xl font-semibold tracking-tighter leading-[1.0] mb-4 max-w-4xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: editorial }}
      >
        Three lanes. <span className="font-drama-display">Every workflow lands in one.</span>
      </motion.h2>

      <motion.p
        className="text-lg text-ink-soft mb-12 max-w-3xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        We walk every workflow in your operation and put it in one of these.
      </motion.p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl">
        {lanes.map((lane, i) => (
          <motion.div
            key={lane.num}
            className="border border-[color:var(--color-hairline-bold)] bg-paper-raise p-7 flex flex-col"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + i * 0.22, duration: 0.6, ease: editorial }}
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute mb-4">
              {lane.num}
            </div>
            <div className="font-drama-display text-3xl md:text-4xl text-black tracking-tight leading-none mb-3">
              {lane.label}
            </div>
            <p className="text-base text-ink-soft leading-relaxed mb-6">{lane.line}</p>

            <div className="border-t border-[color:var(--color-hairline)] pt-4 mt-auto">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute mb-3">
                EXAMPLES
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lane.examples.map((ex) => (
                  <span
                    key={ex}
                    className="inline-block px-2 py-1 border border-[color:var(--color-hairline-bold)] font-mono text-[10px] uppercase tracking-[0.12em] text-ink-soft"
                  >
                    {ex}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slides 07–09 — named clients (Vikram, Kyle, Melissa)
// ────────────────────────────────────────────────────────────────────────

type ClientCase = {
  tag: string;
  name: string;
  before: string;
  after: string;
  metricLabel: string;
  moment: React.ReactNode;
  blurb: string;
  stack: string[];
  image: string | null;
  imageAlt: string;
};

const clients: ClientCase[] = [
  {
    tag: 'VIKRAM · PROVALTECH · CLIENT OPS',
    name: 'Vikram',
    before: '5%',
    after: '100%',
    metricLabel: 'CHURN SIGNALS CAUGHT',
    moment: (
      <>
        Before, the first time Vikram knew a client was unhappy
        was at the renewal call. <span className="font-drama-display">Now he knows in 4 hours.</span>
      </>
    ),
    blurb:
      'Every call flows through Fireflies. Claude reads each transcript for churn signals — frustration, scope drift, dropping engagement — and routes flagged calls to the account lead via Gmail with the excerpt and recording link attached. Customer state syncs to HubSpot, signals to Airtable. First retained account paid for the build.',
    stack: ['Fireflies', 'Claude', 'n8n', 'HubSpot', 'Airtable', 'Gmail'],
    image: '/cases/provaltech.png',
    imageAlt: 'Provaltech call performance dashboard',
  },
  {
    tag: 'KYLE HUNT · AGENCY OPERATORS · GROWTH OPS',
    name: 'Kyle',
    before: '3 hrs',
    after: '10 min',
    metricLabel: 'LEAD MAGNET BUILD TIME',
    moment: (
      <>
        Before, every lead magnet was a Wednesday gone.{' '}
        <span className="font-drama-display">Now he approves the draft over coffee</span> and the system ships the rest before lunch.
      </>
    ),
    blurb:
      'Kyle drops an idea into ClickUp. Claude drafts the copy grounded on his masterclass transcripts via RAG. He approves once. The system then builds the landing page, the resource page, the email sequence, the geo-routed smart link, and a scheduled LinkedIn post — every asset in parallel.',
    stack: ['Claude', 'n8n', 'Webflow', 'ClickUp', 'LinkedIn API'],
    image: null,
    imageAlt: '',
  },
  {
    tag: 'MELISSA · DESTINO FARMS · INVENTORY OPS',
    name: 'Melissa',
    before: '20 sources',
    after: '1 dashboard',
    metricLabel: 'SUPPLIERS UNIFIED',
    moment: (
      <>
        Before, Melissa's team spent 15 hours a week stitching
        WhatsApp messages, supplier sheets, and websites into a menu.{' '}
        <span className="font-drama-display">Now it reconciles itself every 60 minutes.</span>
      </>
    ),
    blurb:
      'WhatsApp messages flow in automatically. Gemini reads stock photos and PDFs. Firecrawl scrapes supplier sites on a schedule. Claude normalizes everything — strain types, flower categories, THC percentages — into one model. Vendor identities stay protected from end clients via automatic coding and COA redaction.',
    stack: ['Claude', 'Gemini OCR', 'Firecrawl', 'WhatsApp API', 'n8n'],
    image: null,
    imageAlt: '',
  },
];

const ClientSlide: React.FC<{ c: ClientCase; idx: number }> = ({ c, idx }) => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-6xl mx-auto">
      <MonoLabel>{`0${idx + 1} OF 03 · RECENT BUILDS`}</MonoLabel>

      <motion.div
        className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        {c.tag}
      </motion.div>

      {/* Big before → after */}
      <motion.div
        className="mt-10 flex items-baseline gap-8 flex-wrap"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.7, ease: editorial }}
      >
        <span className="stat-numeral text-5xl md:text-7xl text-ink-mute line-through tracking-tight">
          {c.before}
        </span>
        <span className="font-mono text-3xl text-ink-mute">→</span>
        <span className="stat-numeral text-6xl md:text-8xl font-semibold text-black tracking-tighter">
          {c.after}
        </span>
      </motion.div>

      <motion.div
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-mute mt-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        {c.metricLabel}
      </motion.div>

      <div className="mt-10">
        <SageRule delay={1.1} w="w-24" />
      </div>

      {/* The moment */}
      <motion.p
        className="mt-8 text-3xl md:text-4xl text-black leading-tight max-w-4xl font-medium"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.7, ease: editorial }}
      >
        {c.moment}
      </motion.p>

      {/* Body grid: blurb + stack (and optional image) */}
      <motion.div
        className="mt-10 grid grid-cols-1 md:grid-cols-[1fr_280px] gap-10 items-start max-w-5xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.0 }}
      >
        <div>
          <p className="text-base text-ink-soft leading-relaxed mb-6">{c.blurb}</p>

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

        {/* Screenshot (Vikram only) or sage typographic block (Kyle, Melissa) */}
        {c.image ? (
          <div className="border border-[color:var(--color-hairline-bold)] bg-paper-sunk overflow-hidden">
            <img src={c.image} alt={c.imageAlt} className="w-full h-auto object-cover" />
          </div>
        ) : (
          <div className="border border-[color:var(--color-hairline)] bg-paper-sunk px-6 py-10 flex flex-col items-center justify-center text-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute">
              {c.metricLabel}
            </span>
            <span className="font-drama-display text-5xl text-black tracking-tight leading-none">
              {c.after}
            </span>
          </div>
        )}
      </motion.div>
    </div>
  </Slide>
);

const Slide07: React.FC = () => <ClientSlide c={clients[0]} idx={0} />;
const Slide08: React.FC = () => <ClientSlide c={clients[1]} idx={1} />;
const Slide09: React.FC = () => <ClientSlide c={clients[2]} idx={2} />;

// ────────────────────────────────────────────────────────────────────────
// Slide 10 — the Blueprint document
// ────────────────────────────────────────────────────────────────────────

const Slide10: React.FC = () => (
  <Slide bg="bg-paper-sunk">
    <div className="h-full flex flex-col justify-center items-center max-w-6xl mx-auto">
      <MonoLabel delay={0.1}>03 · THE BLUEPRINT</MonoLabel>

      <motion.div
        className="mt-10 w-full max-w-3xl bg-paper border border-[color:var(--color-hairline-bold)] shadow-card-lift px-12 py-14 relative"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8, ease: editorial }}
      >
        <motion.div
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute mb-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          AGENT-READY OPS™
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="text-[42px] md:text-[56px] tracking-tighter leading-[0.95]"
        >
          <div className="font-semibold">Your</div>
          <div className="font-semibold">90-Day</div>
          <div className="font-drama-display">Blueprint.</div>
        </motion.div>

        <motion.div
          className="h-px bg-accent w-2/3 mt-10 origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 1.5, duration: 0.7, ease: editorial }}
        />

        <motion.p
          className="mt-8 text-base text-ink-soft leading-relaxed max-w-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.9 }}
        >
          The Score, the Map, and a sequenced build plan for
          the next 90 and 180 days — with a dollar number on every gap.
        </motion.p>

        <motion.div
          className="mt-16 flex items-end justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.4 }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute leading-relaxed">
            MANFREDI / AGENT-READY OPS™
            <br />
            2026.05
          </div>
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
// Slide 11 — objection: Claude Code
// ────────────────────────────────────────────────────────────────────────

const Slide11: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-5xl mx-auto">
      <MonoLabel>A REAL 2026 QUESTION</MonoLabel>

      <motion.h2
        className="mt-8 text-5xl md:text-7xl font-semibold tracking-tighter leading-[1.0] mb-12 max-w-4xl"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: editorial }}
      >
        <span className="font-drama-display">"Can't I just use</span><br />
        <span className="font-drama-display">Claude Code?"</span>
      </motion.h2>

      <div className="space-y-6 max-w-3xl">
        <motion.p
          className="text-xl text-ink-soft leading-relaxed"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6 }}
        >
          Sure — if your qualification criteria are documented, your CRM data is clean, your team agrees on what <span className="italic text-black">qualified</span> means. Hand it to Claude Code, you're done.
        </motion.p>

        <motion.p
          className="text-xl text-ink-soft leading-relaxed"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.6 }}
        >
          <span className="text-black font-semibold">That's maybe 1 in 20 ops shops I see.</span>
        </motion.p>

        <motion.p
          className="text-xl text-ink-soft leading-relaxed"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.9, duration: 0.6 }}
        >
          For the other 19, the build hasn't shipped because nobody's done the decision-work upstream. Claude Code can build anything. It just needs you to tell it what <span className="italic text-black">good</span> looks like.
        </motion.p>

        <motion.div
          className="pt-6 border-t border-[color:var(--color-hairline-bold)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
        >
          <p className="text-2xl text-black leading-snug">
            After the Blueprint, the build is fast.
            <br />
            <span className="font-drama-display">Before it, it's a confident wrong answer.</span>
          </p>
        </motion.div>
      </div>
    </div>
  </Slide>
);

// ────────────────────────────────────────────────────────────────────────
// Slide 12 — credit math (price reveal)
// ────────────────────────────────────────────────────────────────────────

const Slide12: React.FC = () => (
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
// Slide 13 — the honest exit (guarantee)
// ────────────────────────────────────────────────────────────────────────

const Slide13: React.FC = () => (
  <Slide>
    <div className="h-full flex flex-col justify-center max-w-5xl mx-auto">
      <MonoLabel>ONE MORE THING</MonoLabel>

      <motion.h2
        className="mt-12 text-5xl md:text-7xl font-semibold tracking-tighter leading-[1.05]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.7, ease: editorial }}
      >
        Sometimes I tell you to{' '}
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
// Slide 14 — close / CTA
// ────────────────────────────────────────────────────────────────────────

const Slide14: React.FC = () => (
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
        90-Day
        <br />
        <span className="font-drama-display">Blueprint.</span>
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
    description: 'Agent-Ready Blueprint walkthrough — Score, Map, Blueprint.',
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
      case 10: return <Slide11 key="11" />;
      case 11: return <Slide12 key="12" />;
      case 12: return <Slide13 key="13" />;
      case 13: return <Slide14 key="14" />;
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
