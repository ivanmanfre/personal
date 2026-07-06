import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup, MotionConfig, useReducedMotion, useMotionValue, useTransform, animate } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useMetadata } from '../hooks/useMetadata';
import { buildAssessmentEmbedUrl } from '../lib/assessmentEmbed';
import LinkedInPostPreview from './ui/LinkedInPostPreview';
import LiveAssessmentEmbed from './ui/LiveAssessmentEmbed';

/**
 * /client/:slug — the per-client content board (demo mode).
 * Token-gated via the get_client_board RPC; fetches ONLY the board payload
 * (never Ivan's dashboard context — this is a client-facing surface).
 * Light Premium skin + the client's own brand accent/logo/heading font.
 * Content mirrors the Ivan System staged-board pattern: stage groups → rows →
 * detail view with the generation agent trail.
 */

// ---------- types (shape of client_boards.board) ----------
interface BoardBrand {
  accent_hex?: string;
  accent_secondary?: string;
  font_heading?: string;
  font_body?: string;
  is_dark?: boolean;
  header_bg?: string;
  logo_light?: string;
  logo_dark?: string;
  surface_hex?: string;
  /** Short wordmark rendered in the client heading font + an accent period (Step Digital → "step."). */
  wordmark?: string;
}
interface AgentStep { step: string; detail?: string; t?: string; done?: boolean }
/** Friendly phase labels for the trail. Stored step NAMES stay stable — the intro
 *  choreography and any data tooling match on them — the UI translates for the
 *  founder reading it. Unknown names render as-is. */
const STEP_LABELS: Record<string, string> = {
  'Idea curator': 'Topic picked',
  'Voice model': 'Voice matched',
  'Hook agent': 'Opening chosen',
  'Draft agent': 'Written',
  'Copy quality gate': 'Quality check',
  'Image check': 'Image check',
  'Brand image': 'Image made',
  'Carousel renderer': 'Slides made',
  'Assessment builder': 'Assessment built',
  'Scoring engine': 'Scoring set up',
  'Cover render': 'Cover made',
  'Email render': 'Email built',
  Queued: 'On the calendar',
  Published: 'Published',
};
const stepLabel = (name: string) => STEP_LABELS[name] || name;
/** Completed-step sentences for the intro card's pending steps — used both by the
 *  live choreography and by the reload path that lands d1 as an already-finished
 *  review card (so an in-progress detail never shows on a done step). */
const INTRO_DONE_DETAILS: Record<string, string> = {
  'Hook agent': 'Tried 9 openings and kept the strongest',
  'Draft agent': 'Wrote it, then rewrote it once after a self-review',
  'Copy quality gate': 'Quality check passed, nothing flagged',
  'Image check': 'Image matches the post, ready for you',
};
type Stage = 'planned' | 'drafted' | 'review' | 'scheduled' | 'published';
/** Bench entry for a week slot: a seeded alternate ANGLE (topic-level, never an
 *  instant draft). Attached to queue items as `alt_angles` — the slot IS the queue
 *  item, so the bench travels with it. */
interface AltAngle { id: string; title: string; hook: string; pillar?: string; drafts_by?: string }
interface LeadMagnetEntry {
  id: string;
  title: string;
  format: 'assessment' | 'calculator' | 'worksheet' | 'checklist' | string;
  status: 'live' | 'in_production' | 'planned' | string;
  date_label?: string;
}
/** Idea-bank entry: an upcoming topic the engine holds but has NOT drafted yet. It has
 *  no date and no metrics — it drafts when it reaches its calendar slot. Rendered as the
 *  IDEAS stage at the top of the All content ledger; opens a lightweight preview only. */
interface Idea { id: string; title: string; pillar?: string; hook?: string; status?: 'idea' | string }
interface QueueItem {
  id: string;
  kind: 'post' | 'carousel' | 'lm' | 'newsletter';
  stage: Stage;
  pillar?: string;
  hook?: string;
  body?: string;
  media_url?: string | null;
  title?: string;
  promise?: string;
  cover_url?: string;
  publish_date?: string;
  generating?: boolean;
  agent_trail?: AgentStep[];
  /** Transient: the agent step currently running, shown inline on the row (intro choreography). */
  live_step?: string;
  /** Seeded alternate angles for this slot (the "different idea" bench). */
  alt_angles?: AltAngle[];
}
interface CalendarItem { date: string; kind: string; pillar?: string; label: string; ref?: string }
interface Pillar { key: string; label: string; count: number; pct: number; blurb?: string }
interface NewsletterIssue { id: string; ref?: string; date: string; stage: 'scheduled' | 'planned' | string; title: string; body?: string }
interface NurtureStep { step: string; detail?: string }
interface NewsletterSpec {
  name: string;
  cadence?: string;
  from_domain?: string;
  issues?: NewsletterIssue[];
  nurture?: NurtureStep[];
}
interface PerfIndicator { key: string; label: string; source?: string }
interface PerformanceSpec { note?: string; indicators?: PerfIndicator[] }
interface EngineUpdate { date: string; note: string }
interface Board {
  company_name: string;
  domain?: string;
  logo_url?: string;
  founder?: { name?: string; headline?: string; first_name?: string; avatar_url?: string };
  brand?: BoardBrand;
  site?: { nav?: string[]; phone?: string; cta?: string };
  queue: QueueItem[];
  ideas?: Idea[];
  lm?: any;
  lead_magnets?: LeadMagnetEntry[];
  /** Real captured leads, if any exist yet. Absent/empty on a fresh preview board — the
   *  Captured leads table then shows a clean empty-state, never a staged sample lead. */
  leads?: { email: string; score?: string; weakest_area?: string; when?: string }[];
  /** Rich engager DM pipeline for the Leads tab (offer: inbound-engine-engager-dm-pipeline).
   *  Distinct from the thin assessment `leads` above. Live boards fill it from the real
   *  pipeline; demo/preview boards fall back to a LABELED sample deck (see LeadsSurface).
   *  A live board with no data shows a clean empty-state, never a staged sample. */
  lead_pipeline?: PipelineLead[];
  strategy?: { total: number; period?: string; pillars: Pillar[] };
  calendar?: { start: string; weeks: number; items: CalendarItem[] };
  newsletter?: NewsletterSpec;
  performance?: PerformanceSpec;
  engine_updates?: EngineUpdate[];
  auto_publish_days?: number;
}

// ---------- small utils ----------
// V9 "Margin Rail" editorial token system: warm-paper neutrals, ink ramp, hairline
// rules, DM Serif / Source Serif / IBM Plex Mono. The accent is punctuation only —
// it is NEVER a panel background or body text (see the derivation helpers below).
const INK = '#1A1A1A';        // text, primary button
const INK_SOFT = '#4A4A48';   // body copy
const INK_MUTE = '#5A5752';   // labels, meta, eyebrows
/** Back-compat aliases: the whole file styles with DIM (body) / FAINT (meta). Pointing
 *  them at the paper ink ramp moves every existing usage onto the editorial neutrals. */
const DIM = INK_SOFT;
const FAINT = INK_MUTE;
const PAPER = '#F7F4EF';       // app background
const PAPER_SUNK = '#EFEBE3';  // side cards, teasers
const PAPER_RAISE = '#FFFFFF'; // raised cards, previews
const DESK_BG = '#EDEAE3';     // desk behind the whole board
/** Hairlines, not boxes: 26,26,26 alpha so rules composite on paper or white. */
const LINE = 'rgba(26,26,26,0.15)';
const LINE_BOLD = 'rgba(26,26,26,0.25)'; // table heads / section rules
const DIVIDE = 'rgba(26,26,26,0.12)';    // soft divider inside grouped containers
/** Back-compat: the shell frame is now paper, not a tinted SaaS canvas. */
const FRAME_BG = PAPER;
/** One shadow, reserved for raised paper. Hero cards get a touch more. */
const CARD_SHADOW = '0 10px 30px rgba(26,26,26,0.10)';
const HERO_SHADOW = '0 14px 40px rgba(26,26,26,0.12)';
/** Single easing token — every quiet transition on the board uses it. */
const EASE = [0.25, 1, 0.5, 1] as const;
/** Interactive-card affordance: paper-shadow lift on hover, no color shift. */
const LIFT = `transition-[box-shadow,transform] duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-px hover:shadow-[0_10px_30px_rgba(26,26,26,0.10)]`;
const SERIF = '"DM Serif Display", Georgia, serif';   // display headlines + large numerals
const BODY = '"Source Serif 4", Georgia, serif';       // body copy, row titles
const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, monospace'; // data, eyebrows, nav
const UISANS = '"Instrument Sans", system-ui, sans-serif';               // LinkedIn preview interior only

/** The accent is a variable; every use is a derivation. These are the ONLY legal forms. */
/** Small accent text (<19px) — AA-safe against paper. */
const caText = (a: string) => `color-mix(in oklab, ${a} 75%, #1A1A1A)`;
/** Running / highlight frames. */
const caBorder = (a: string, pct = 40) => `color-mix(in oklab, ${a} ${pct}%, transparent)`;
/** Review-row washes, running-step fills (5–9%). */
const caWash = (a: string, pct = 6) => `color-mix(in oklab, ${a} ${pct}%, transparent)`;

function cleanHex(hex?: string, fallback = '#4f46e5'): string {
  const h = (hex || '').replace(/[^0-9a-fA-F]/g, '');
  return h.length === 6 ? `#${h}` : fallback;
}
function inkOn(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.62 ? '#141210' : '#ffffff';
}
function fmtDay(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function lmPath(title?: string): string {
  return (title || 'lead-magnet').toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim()
    .split(/\s+/).slice(-3).join('-');
}
const KIND_LABEL: Record<string, string> = { post: 'Post', carousel: 'Carousel', lm: 'Lead magnet', newsletter: 'Newsletter', newsjack: 'Reactive slot' };
/** Settle tint after a row moves stage: the client accent at a whisper, not a green flash. */
const FLASH_BG = 'color-mix(in srgb, var(--cb-accent) 7%, white)';

/** The body the opening-choreography draft (d1) lands with — same register as the other
 *  seeded drafts (owner-cost storytelling, concrete and direct, no fabricated results). */
const D1_DRAFT_BODY = `The audit that finds where ad spend leaks before you scale.

Most accounts leak in the same three places: broad match quietly spending on junk queries, retargeting audiences that overlap so you pay twice for the same buyer, and ROAS targets set before your costs went up.

None of it shows in the dashboard. All of it shows in a margin audit.

Scaling multiplies whatever is already in the account, including the leaks. Audit first, then scale.`;

/** Format kicker: refines the raw kind into the client-readable format label. */
function kickerOf(q: Pick<QueueItem, 'kind' | 'media_url'>): string {
  if (q.kind === 'post') return q.media_url ? 'Image post' : 'Text post';
  return KIND_LABEL[q.kind] || q.kind;
}

/** Inline count-up (logic mirrored from dashboard-v2 useCountUp — not imported across
 *  the client/ops context boundary). Respects prefers-reduced-motion. */
function useCountUp(target: number, duration = 1100): string {
  const [v, setV] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { prevRef.current = target; setV(target); return; }
    const from = prevRef.current;
    prevRef.current = target;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setV(Math.round(from + (1 - Math.pow(1 - p, 3)) * (target - from)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v.toLocaleString();
}

/** Stat numeral. DM Serif is the board's one signature — reserved for LARGE numerals
 *  only; small counts fall back to sans semibold with tabular figures. */
function CountUpNum({ n, size }: { n: number; size: number }) {
  const v = useCountUp(n);
  const serif = size >= 24;
  return (
    <span
      className="tabular-nums"
      style={serif
        ? { fontFamily: SERIF, fontStyle: 'italic', fontSize: size, lineHeight: 1.05, color: INK }
        : { fontWeight: 600, fontSize: size, lineHeight: 1.05, color: INK }}
    >
      {v}
    </span>
  );
}

/** Count that rolls vertically when it changes — the badge beat of the approve moment. */
function RollingNumber({ n }: { n: number }) {
  return (
    <span className="relative inline-flex h-[1.2em] items-center overflow-hidden tabular-nums" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={n}
          initial={{ y: '0.9em', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-0.9em', opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="inline-block"
        >
          {n}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** 16:9 row/card thumbnail: real media when it exists; text posts get a mini
 *  typographic tile (opening words of the hook, sans semibold, accent-washed);
 *  other formats get a glyph tile. */
function Thumb({ q, accent, large = false }: { q: QueueItem; accent: string; large?: boolean }) {
  const src = q.media_url || q.cover_url;
  const cls = large ? 'aspect-video w-full rounded-lg' : 'h-10 w-14 rounded-[6px]';
  if (src) {
    return <img src={src} alt="" loading="lazy" className={`${cls} shrink-0 object-cover`} style={{ border: `1px solid ${LINE}`, background: 'rgba(2,49,47,0.04)' }} />;
  }
  if (q.kind === 'post' && (q.hook || q.title)) {
    const words = (q.hook || q.title || '').split(/\s+/).slice(0, large ? 12 : 6).join(' ');
    return (
      <span
        className={`${cls} flex shrink-0 items-center overflow-hidden px-1.5 py-1 text-left`}
        style={{ background: `color-mix(in srgb, ${accent} 7%, white)`, border: `1px solid ${LINE}` }}
        aria-hidden
      >
        <span
          style={{
            fontWeight: 600, fontSize: large ? 13.5 : 8.5, lineHeight: 1.3, letterSpacing: '-0.01em',
            color: `color-mix(in srgb, ${accent} 60%, ${INK})`,
            display: '-webkit-box', WebkitLineClamp: large ? 4 : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {words}
        </span>
      </span>
    );
  }
  const glyph = (() => {
    switch (q.kind === 'post' && q.media_url ? 'image' : q.kind) {
      case 'carousel':
        return <path d="M4 7h10v10H4zM16 9h4M16 12h4M16 15h4" stroke={accent} strokeWidth="1.6" strokeLinecap="round" fill="none" />;
      case 'lm':
        return <path d="M5 6h14M5 10h14M5 14h8M15.5 13.5l2 2 3.5-3.5" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
      case 'newsletter':
        return <path d="M4 7l8 6 8-6M4 7h16v11H4z" stroke={accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
      default:
        return <path d="M5 7h14M5 11h14M5 15h9" stroke={accent} strokeWidth="1.6" strokeLinecap="round" fill="none" />;
    }
  })();
  return (
    <span
      className={`${cls} flex shrink-0 items-center justify-center`}
      style={{ background: `color-mix(in srgb, ${accent} 7%, white)`, border: `1px solid ${LINE}` }}
      aria-hidden
    >
      <svg width={large ? 30 : 18} height={large ? 30 : 18} viewBox="0 0 24 24" style={{ opacity: 0.75 }}>{glyph}</svg>
    </span>
  );
}

// Segment tints: the client's accent mixed toward white at stepped ratios, so the
// bar reads as one brand family, never a rainbow.
const TINT_STEPS = [26, 20, 15, 11, 8];

// ---------- shared bits ----------
function KindChip({ q }: { q: Pick<QueueItem, 'kind' | 'media_url'>; accent?: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium"
      style={{ background: 'rgba(2,49,47,0.05)', color: DIM }}
    >
      {kickerOf(q)}
    </span>
  );
}

/** Italic accent "drama" phrase for a display headline — one per headline, full accent
 *  (headlines are >19px so no AA mix needed). */
function Accent({ children }: { children: React.ReactNode }) {
  return <span style={{ fontStyle: 'italic', color: 'var(--cb-accent)' }}>{children}</span>;
}

/** Editorial masthead on every tab: mono eyebrow → DM Serif Display headline (with one
 *  italic accent phrase) → Source Serif sub. The shell's loudest, most consistent mark. */
function SectionHead({ eyebrow, title, sub }: { eyebrow?: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-7">
      {eyebrow && (
        <div className="mb-2.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>{eyebrow}</div>
      )}
      <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(29px, 3.4vw, 40px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: INK }}>{title}</h2>
      {sub && <p className="mt-3.5 max-w-[62ch]" style={{ fontFamily: BODY, fontSize: 15, lineHeight: 1.62, color: INK_SOFT }}>{sub}</p>}
    </div>
  );
}

/** Card header — Source Serif, the quiet register inside white cards. */
function CardHead({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 15, color: INK }}>{children}</div>;
}

/** Ambient status dot: 6px core + 3px halo ring. `pulse` is reserved for the topbar
 *  "Live preview" only; everything else stays still. Gated on prefers-reduced-motion. */
function StatusDot({ color, pulse = false, size = 6 }: { color: string; pulse?: boolean; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ height: size, width: size }}>
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-50 motion-safe:animate-ping motion-reduce:hidden"
          style={{ background: color, animationDuration: '2s' }}
        />
      )}
      <span
        className="relative inline-flex rounded-full"
        style={{ height: size, width: size, background: color, boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 18%, transparent)` }}
      />
    </span>
  );
}

/** The engine heartbeat: the brief's `pulse` (scale 1→.72, opacity 1→.35, 1.6s). One per
 *  surface region, and the only animated accent element. Honors reduced motion. */
function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  return (
    <span
      className="cb-pulse inline-block shrink-0 rounded-full"
      style={{ height: size, width: size, background: color }}
      aria-hidden
    />
  );
}

/** The true LinkedIn feed preview from the brief: Instrument Sans interior, initials
 *  avatar in the accent, a typographic cover plate (client heading font on accent), and
 *  the Like/Comment/Share row. Cover plate is the ONE place the guest font appears in a
 *  surface — never in shell chrome. `cover`='render' shows the drafting placeholder. */
function FeedPreview({ item, board, accent, fontStack, size = 'lg', cover = 'plate' }: {
  item: QueueItem; board: Board; accent: string; fontStack: string;
  size?: 'lg' | 'sm'; cover?: 'plate' | 'render' | 'none';
}) {
  const founder = board.founder;
  const name = founder?.name || board.company_name;
  const wordmark = board.brand?.wordmark || board.company_name.split(/\s+/)[0].toLowerCase();
  const av = size === 'lg' ? 44 : 38;
  const bodyPx = size === 'lg' ? 13.5 : 12.5;
  const titlePx = size === 'lg' ? 24 : 18;
  const showCover = cover !== 'none' && (item.kind === 'post' || item.kind === 'carousel' || cover === 'render');
  return (
    <div style={{ fontFamily: UISANS, border: `1px solid ${LINE}`, borderRadius: 10, padding: size === 'lg' ? '18px 20px' : '15px 17px', background: PAPER_RAISE }}>
      <div className="flex gap-2.5" style={{ marginBottom: 12 }}>
        <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: av, height: av, background: accent, color: inkOn(accent), fontFamily: fontStack, fontWeight: 700, fontSize: size === 'lg' ? 17 : 14 }} aria-hidden>
          {initialsOf(name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold" style={{ fontSize: size === 'lg' ? 13.5 : 12.5, color: '#111' }}>{name}</span>
          <span className="block truncate" style={{ fontSize: size === 'lg' ? 11.5 : 10.5, color: '#666' }}>{founder?.headline || `Founder, ${board.company_name}`} · 1st</span>
          <span className="block truncate" style={{ fontSize: size === 'lg' ? 11 : 10, color: '#999' }}>Scheduled · {fmtDay(item.publish_date) || 'this week'} · 🌐</span>
        </span>
      </div>
      {item.body && (
        <div style={{ fontSize: bodyPx, lineHeight: 1.55, color: '#111', marginBottom: 12, whiteSpace: 'pre-line' }}>{item.body}</div>
      )}
      {item.media_url ? (
        <img src={item.media_url} alt="" loading="lazy" style={{ width: '100%', borderRadius: 6, border: `1px solid ${LINE}`, display: 'block' }} />
      ) : cover === 'render' ? (
        <div className="flex items-center justify-center gap-2.5" style={{ aspectRatio: '1200/500', borderRadius: 6, border: `1px dashed ${caBorder(accent, 45)}` }}>
          <PulseDot color={accent} size={8} />
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.14em', color: INK_MUTE }}>cover rendering…</span>
        </div>
      ) : showCover ? (
        <div className="flex flex-col justify-end" style={{ background: accent, borderRadius: 6, aspectRatio: '1200/500', padding: size === 'lg' ? '20px 22px' : '15px 17px' }}>
          <div style={{ fontFamily: fontStack, fontWeight: 700, fontSize: titlePx, lineHeight: 1.13, color: '#fff', maxWidth: '20ch' }}>{item.title || item.hook}</div>
          <div style={{ fontFamily: fontStack, fontWeight: 500, fontSize: size === 'lg' ? 12 : 10.5, color: 'rgba(255,255,255,.75)', marginTop: 9 }}>{wordmark}. / field notes</div>
        </div>
      ) : null}
      <div className="flex gap-5" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #eee', fontSize: size === 'lg' ? 12 : 11, color: '#888' }}>
        <span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span>
      </div>
    </div>
  );
}

// ---------- Content surface: staged list ----------
const STAGE_META: Record<Stage, { label: string; hint: string }> = {
  planned: { label: 'Planned', hint: 'On the calendar. The engine drafts each one a few days ahead.' },
  drafted: { label: 'Drafted', hint: 'The engine is writing these. They move to your review when ready.' },
  review: { label: 'Your review', hint: 'Your only job. Approve or request a change.' },
  scheduled: { label: 'Scheduled', hint: 'Approved and queued to publish.' },
  published: { label: 'Published · example', hint: 'How live posts will report here once the engine is running.' },
};
const STAGE_ORDER: Stage[] = ['review', 'drafted', 'scheduled', 'published'];

/** All content LIST view = a STAGE-GROUPED pipeline (the operator mental model), so it
 *  reads distinctly from the This week deck. Order top→bottom: Ideas → Your review →
 *  Drafting → Scheduled → Published. Ideas is sourced separately (board.ideas). */
const LIST_STAGE_SECTIONS: { stage: Stage; label: string; blurb: string }[] = [
  { stage: 'review', label: 'Your review', blurb: STAGE_META_review_blurb() },
  { stage: 'drafted', label: 'Drafting', blurb: 'The engine is writing these. They move to your review when ready.' },
  { stage: 'scheduled', label: 'Scheduled', blurb: 'Approved and queued to publish on their dates.' },
  { stage: 'published', label: 'Published', blurb: 'How live posts will report here once the engine is running.' },
];
function STAGE_META_review_blurb() { return 'Your only job. Approve, or say what to change in plain words.'; }
const IDEAS_BLURB = "The engine's upcoming idea bank. Each one drafts when it reaches its slot.";

/** Editorial section header for a ledger stage group: mono-caps eyebrow + accent count,
 *  a one-line Source Serif description. Matches the V9 masthead type system. */
function LedgerSectionHead({ eyebrow, count, blurb, accent }: { eyebrow: string; count: number; blurb: string; accent: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-2.5 pt-9 first:pt-0" style={{ borderBottom: `1px solid ${LINE_BOLD}` }}>
      <div className="flex items-baseline gap-2.5">
        <span className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.22em', color: INK_MUTE }}>{eyebrow}</span>
        <span className="tabular-nums" style={{ fontFamily: MONO, fontSize: 11, color: caText(accent) }}>{String(count).padStart(2, '0')}</span>
      </div>
      <span className="max-w-[52ch] sm:text-right" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, lineHeight: 1.5, color: INK_MUTE }}>{blurb}</span>
    </div>
  );
}

function stageStatus(q: QueueItem, stage: Stage, startIso?: string): React.ReactNode {
  if (stage === 'planned') {
    const d = q.publish_date ? new Date(q.publish_date + 'T00:00:00') : null;
    let drafts = d ? new Date(d.getTime() - 2 * 86400000).toISOString().slice(0, 10) : '';
    // Nothing drafts before the engine starts.
    if (drafts && startIso && drafts < startIso) drafts = startIso;
    return <span className="text-[12px] tabular-nums" style={{ color: FAINT }}>Drafts {fmtDay(drafts)} · publishes {fmtDay(q.publish_date)}</span>;
  }
  if (stage === 'drafted') {
    return q.generating
      ? <span className="inline-flex items-center gap-2 text-[12px] font-medium" style={{ color: DIM }}><PulseDot color="var(--cb-mint)" /> {q.live_step || 'Generating…'}</span>
      : <span className="text-[12px]" style={{ color: FAINT }}>In production</span>;
  }
  if (stage === 'review') return <span className="text-[12px] tabular-nums" style={{ color: DIM }}>Publishes {fmtDay(q.publish_date)} unless you change it</span>;
  if (stage === 'scheduled') return <span className="text-[12px] font-medium tabular-nums" style={{ color: DIM }}>Publishes {fmtDay(q.publish_date)}</span>;
  // Example state, not a claim: nothing has run on the client's LinkedIn yet.
  return <span className="text-[12px] tabular-nums" style={{ color: FAINT }}>Example · {fmtDay(q.publish_date)}</span>;
}

type ContentView = 'list' | 'board' | 'feed';
const VIEWS: { id: ContentView; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'board', label: 'Board' },
  { id: 'feed', label: 'Feed' },
];

/** Days from today to an ISO date; null when unparseable. Used for the honest
 *  "in N days" hint on review rows — omitted entirely when the date has passed. */
function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const t = new Date(iso + 'T00:00:00').getTime();
  if (Number.isNaN(t)) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((t - today.getTime()) / 86400000);
}

/** Right-aligned two-line publish cell for list rows: tabular date over a faint hint.
 *  Dates stay neutral ink — status is carried by a 5px dot, mint only when live. */
function PublishCell({ q, stage }: { q: QueueItem; stage: Stage }) {
  if (stage === 'drafted' && q.generating) {
    return (
      <span className="inline-flex items-center justify-end gap-2 text-[12px] font-medium" style={{ color: DIM }}>
        <PulseDot color="var(--cb-mint)" /> {q.live_step || 'Generating…'}
      </span>
    );
  }
  const n = daysUntil(q.publish_date);
  const sub =
    stage === 'review'
      ? `auto-publishes${n != null && n > 1 ? ` · in ${n} days` : n === 1 ? ' · tomorrow' : n === 0 ? ' · today' : ''}`
      : stage === 'scheduled'
      ? 'approved · queued'
      : stage === 'published'
      ? 'example report'
      : 'in production';
  return (
    <span className="block text-right">
      <span className="block text-[12.5px] font-medium tabular-nums" style={{ color: INK, fontVariantNumeric: 'tabular-nums' }}>
        {fmtDay(q.publish_date) || '—'}
      </span>
      <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] tabular-nums" style={{ color: FAINT }}>
        {stage === 'scheduled' && <span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: FAINT }} aria-hidden />}
        {sub}
      </span>
    </span>
  );
}

const STAGE_SOFT_META: Record<Stage, string> = {
  planned: 'planned', drafted: 'in production', review: 'awaiting', scheduled: 'queued', published: 'example',
};

/** Short weekday for the ledger "When" column. */
function weekAbbr(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { weekday: 'short' });
}

/** Mono stage mark for a ledger row — honest, and the auto-publish clock is part of it. */
function stageMark(q: QueueItem, stage: Stage, autoDays: number): { text: string; sub?: string; color: string; pulse?: boolean } {
  if (stage === 'review') {
    const n = daysUntil(q.publish_date);
    const days = n != null && n > 0 ? n : autoDays;
    return { text: '● Your review', sub: `auto-publishes in ${days} ${days === 1 ? 'day' : 'days'}`, color: caText(q.pillar ? 'var(--cb-accent)' : 'var(--cb-accent)') };
  }
  if (stage === 'scheduled') return { text: '✓ Scheduled', sub: q.publish_date ? `${weekAbbr(q.publish_date)} ${KIND_TIME[q.kind] || ''}`.trim() : undefined, color: caText('var(--cb-accent)') };
  if (stage === 'drafted') return { text: 'Drafting', color: INK_MUTE, pulse: !!q.generating };
  if (stage === 'published') return { text: 'Published', sub: 'example', color: INK_MUTE };
  return { text: 'Planned', color: INK_MUTE };
}

/** Narrated build sequence for a drafting row: numbered mono index + plain-English serif
 *  sentence. Exactly one running step (accent frame + pulse + italic); future steps fade. */
function BuildSequence({ trail, accent }: { trail: AgentStep[]; accent: string }) {
  const runningIdx = trail.findIndex((s) => !s.done);
  return (
    <div className="flex flex-col">
      <div className="mb-2 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: INK_MUTE }}>Build sequence · running</div>
      {trail.map((s, i) => {
        const running = i === runningIdx;
        const future = !s.done && !running;
        const num = String(i + 1).padStart(2, '0');
        const sentence = s.detail || stepLabel(s.step);
        if (running) {
          return (
            <div key={i} className="flex gap-3 rounded-[6px] p-2" style={{ margin: '4px 0', border: `1px solid ${caBorder(accent, 40)}`, background: caWash(accent, 7) }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: caText(accent), width: 20, flex: 'none' }}>{num}</span>
              <span className="flex items-baseline gap-2" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13, lineHeight: 1.5, color: INK }}>
                <span style={{ position: 'relative', top: 1 }}><PulseDot color={accent} size={7} /></span>{sentence}…
              </span>
            </div>
          );
        }
        return (
          <div key={i} className="flex gap-3 py-2" style={{ borderBottom: `1px solid ${DIVIDE}`, opacity: future ? 0.45 : 1 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, color: INK_MUTE, width: 20, flex: 'none' }}>{num}</span>
            <span style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.5, color: INK }}>{sentence}</span>
          </div>
        );
      })}
      <div className="mt-1" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12, color: INK_MUTE }}>It joins your review stack the moment it's ready.</div>
    </div>
  );
}

/** Lightweight preview for an IDEAS-stage row. Ideas are not approvable yet, so this is
 *  deliberately NOT the DetailModal — just the topic, its pillar, and the promise that it
 *  drafts when it reaches its slot. No feed preview, no agent trail, no actions. */
function IdeaPreviewModal({ idea, accent, onClose }: { idea: Idea; accent: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative mx-auto my-0 flex min-h-full w-full max-w-lg flex-col bg-white sm:my-16 sm:min-h-0 sm:rounded-xl" style={{ boxShadow: '0 30px 80px rgba(2,32,32,.32)' }}>
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: INK_MUTE }}>Idea</span>
          {idea.pillar && <span className="capitalize" style={{ fontFamily: MONO, fontSize: 11, color: caText(accent) }}>{idea.pillar}</span>}
          <button onClick={onClose} aria-label="Close" className="ml-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[rgba(2,49,47,0.05)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke={DIM} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-6 sm:px-6">
          <h3 style={{ fontFamily: SERIF, fontSize: 25, lineHeight: 1.14, letterSpacing: '-0.01em', color: INK }}>{idea.title}</h3>
          {idea.hook && <p className="mt-3 max-w-[46ch]" style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.6, color: INK_SOFT }}>{idea.hook}</p>}
          <div className="mt-5 rounded-[10px] p-4" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
            <div className="flex items-center gap-2">
              <PulseDot color={accent} size={6} />
              <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE }}>In the idea bank</span>
            </div>
            <p className="mt-2" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
              {idea.pillar ? `A ${idea.pillar} idea the engine is holding. ` : 'An idea the engine is holding. '}It drafts when it reaches its slot, then lands in your review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewSurface({ board, accent, stageOf, onOpen, onOpenIdea, onApprove, flashId, view, setView, skips }: {
  board: Board; accent: string;
  stageOf: (q: QueueItem) => Stage;
  onOpen: (q: QueueItem, opts?: { changing?: boolean }) => void;
  onOpenIdea: (idea: Idea) => void;
  onApprove: (id: string) => void;
  flashId: string | null;
  view: ContentView;
  setView: (v: ContentView) => void;
  /** Week-home "skip this day" marks: skipped items stay listed but lose their actions. */
  skips: Record<string, true>;
}) {
  const autoDays = board.auto_publish_days ?? 3;
  const reduce = useReducedMotion();
  const fontStack = board.brand?.font_heading ? `"${board.brand.font_heading}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif';
  const groups = STAGE_ORDER.map((s) => ({ stage: s, items: board.queue.filter((q) => stageOf(q) === s) }));
  const stageDot = (s: Stage) => (s === 'review' ? accent : s === 'published' ? 'var(--cb-mint)' : FAINT);
  // All content LIST view = the pipeline grouped BY STAGE (distinct from the This week
  // deck, which is a day-by-day approval flow). Within a stage, rows sort by date.
  // The engine's idea bank leads at the top: upcoming topics not yet drafted.
  const ideas = board.ideas || [];
  const byDate = (a: QueueItem, b: QueueItem) => (a.publish_date || '9999-99').localeCompare(b.publish_date || '9999-99');
  const firstReviewId = groups.find((g) => g.stage === 'review')?.items.filter((q) => !skips[q.id]).sort(byDate)[0]?.id || null;
  const [openRow, setOpenRow] = useState<string | null>(firstReviewId);
  const flashStyle = (id: string): React.CSSProperties => ({
    background: flashId === id ? FLASH_BG : undefined,
    transition: 'background-color 700ms ease',
  });

  // The approve moment: check path-draws on the row (~300ms), then the optimistic
  // stage move fires and the row settles into Scheduled. Hovered review rows also
  // take A (approve) and R (request change) from the keyboard.
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const approveTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(approveTimer.current), []);
  const startApprove = (id: string) => {
    if (approvingId) return;
    if (reduce) { setHoverId(null); onApprove(id); return; }
    setApprovingId(id);
    window.clearTimeout(approveTimer.current);
    approveTimer.current = window.setTimeout(() => {
      setApprovingId(null);
      // The row travels to Scheduled out from under the cursor — mouseleave never
      // fires, so clear the hover target or A/R keep aiming at the moved row.
      setHoverId(null);
      onApprove(id);
    }, 420);
  };
  const reviewIds = (groups.find((g) => g.stage === 'review')?.items || []).filter((q) => !skips[q.id]).map((q) => q.id);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (!hoverId || !reviewIds.includes(hoverId)) return;
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); startApprove(hoverId); }
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        const item = board.queue.find((q) => q.id === hoverId);
        if (item) onOpen(item, { changing: true });
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoverId, approvingId, reviewIds.join(','), board]);

  // Feed identity + honest counts: next-week volume read straight off the calendar.
  const founder = board.founder;
  const feedItems = board.queue
    .filter((q) => (stageOf(q) === 'review' || stageOf(q) === 'scheduled') && q.body && !skips[q.id])
    .sort((a, b) => (a.publish_date || '').localeCompare(b.publish_date || ''));
  const weekCounts = (() => {
    const cal = board.calendar;
    if (!cal) return { posts: feedItems.length, lms: 0 };
    const start = new Date(cal.start + 'T00:00:00').getTime();
    const wk = cal.items.filter((it) => {
      const t = new Date(it.date + 'T00:00:00').getTime();
      return t >= start && t < start + 7 * 86400000;
    });
    return {
      posts: wk.filter((it) => it.kind === 'post' || it.kind === 'carousel').length,
      lms: wk.filter((it) => it.kind === 'lm').length,
    };
  })();

  // One unfolding ledger row, reused across every stage section in the list view.
  const renderLedgerRow = (q: QueueItem) => {
    const stage = stageOf(q);
    const skipped = stage === 'review' && !!skips[q.id];
    const isOpen = openRow === q.id;
    const mark = stageMark(q, stage, autoDays);
    const rowBg = stage === 'review' && !skipped ? caWash(accent, 5) : (flashId === q.id ? FLASH_BG : 'transparent');
    const provenance = stage === 'review' ? (q.promise || 'drafted from your voice, nothing invented')
      : q.generating ? 'reactive: drafting began after the news broke'
      : (q.promise || '');
    return (
      <div key={q.id} style={{ borderBottom: `1px solid ${LINE}` }}>
        <div
          role="button" tabIndex={0}
          onClick={() => setOpenRow(isOpen ? null : q.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenRow(isOpen ? null : q.id); } }}
          className="grid cursor-pointer items-center gap-x-[18px] px-3.5 py-[15px] transition-colors duration-150 hover:brightness-[0.985] sm:grid-cols-[96px_minmax(0,1fr)_110px_190px_26px]"
          style={{ margin: '0 -14px', background: rowBg, opacity: skipped ? 0.6 : 1, transition: 'background-color 700ms ease' }}
        >
          <span style={{ fontFamily: MONO, fontSize: 12, color: INK_SOFT }}>{q.publish_date ? `${weekAbbr(q.publish_date)} ${KIND_TIME[q.kind] || ''}`.trim() : 'live'}</span>
          <span className="min-w-0">
            <span className="block truncate" style={{ fontFamily: BODY, fontWeight: 600, fontSize: 16, color: INK }}>{q.hook || q.title}</span>
            {provenance && <span className="block truncate" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE }}>{provenance}</span>}
          </span>
          <span className="hidden sm:block" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE }}>{kickerOf(q)}</span>
          <span className="hidden sm:block" style={{ fontFamily: MONO, fontSize: 11, color: mark.color }}>
            {mark.text}{mark.pulse && <span className="ml-1.5 inline-block"><PulseDot color={accent} size={6} /></span>}
            {mark.sub && <><br /><span style={{ color: INK_MUTE, fontSize: 10 }}>{mark.sub}</span></>}
          </span>
          <span className="hidden text-right sm:block" style={{ fontFamily: MONO, fontSize: 13, color: INK_MUTE }}>{isOpen ? '▾' : '▸'}</span>
        </div>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="overflow-hidden"
              style={{ margin: '0 -14px', background: rowBg }}
            >
              <div className="grid gap-6 px-3.5 pb-6 pt-1.5 lg:grid-cols-[430px_1fr]">
                <div style={{ maxWidth: 430 }}>
                  {q.body || stage === 'review' || stage === 'scheduled'
                    ? <FeedPreview item={q.body ? q : { ...q, body: q.body }} board={board} accent={accent} fontStack={fontStack} size="sm" cover={q.generating ? 'render' : 'plate'} />
                    : q.generating
                    ? <FeedPreview item={q} board={board} accent={accent} fontStack={fontStack} size="sm" cover="render" />
                    : <FeedPreview item={q} board={board} accent={accent} fontStack={fontStack} size="sm" />}
                </div>
                <div className="flex flex-col gap-3 pt-1.5">
                  {stage === 'review' && !skipped ? (
                    <>
                      <p style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT, maxWidth: '40ch' }}>Exactly how it lands in the feed. Approve it, or say what to change in plain words.</p>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); onApprove(q.id); }}
                          className="uppercase transition-colors duration-150"
                          style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.14em', background: INK, color: PAPER, border: 'none', borderRadius: 7, padding: '12px 20px', cursor: 'pointer' }}
                          onMouseEnter={(ev) => { (ev.currentTarget as HTMLButtonElement).style.background = `color-mix(in oklab, ${accent} 80%, #1A1A1A)`; }}
                          onMouseLeave={(ev) => { (ev.currentTarget as HTMLButtonElement).style.background = INK; }}
                        >Approve ✓</button>
                        <button onClick={(e) => { e.stopPropagation(); onOpen(q, { changing: true }); }} style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13, background: 'none', border: 'none', color: INK_MUTE, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>request a change…</button>
                      </div>
                      <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12, color: INK_MUTE }}>{mark.sub || `auto-publishes in ${autoDays} days`} if untouched</div>
                    </>
                  ) : q.generating ? (
                    <BuildSequence trail={q.agent_trail || []} accent={accent} />
                  ) : stage === 'scheduled' ? (
                    <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: caText(accent) }}>Signed off. On the schedule.</div>
                  ) : q.kind === 'lm' ? (
                    <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: INK_MUTE, maxWidth: '38ch' }}>Live on your domain: a real assessment your audience can take, not a cover image. Try it in the Lead magnets tab.</div>
                  ) : stage === 'published' ? (
                    <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: INK_MUTE, maxWidth: '38ch' }}>An example of how your published posts will report here once the engine is live. Nothing has run on your account yet.</div>
                  ) : (
                    <div style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13.5, lineHeight: 1.6, color: INK_MUTE, maxWidth: '38ch' }}>{skipped ? 'Skipped this week. Nothing publishes in this slot.' : 'In production. It lands in your review the moment it is ready.'}</div>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); onOpen(q); }} className="mt-1 inline-flex w-fit items-center gap-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: INK_MUTE, background: 'none', border: 'none', cursor: 'pointer' }}>
                    see how it was made →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // One IDEAS-stage row: title + pillar dot + a quiet "queued as an idea" mark. Opens a
  // lightweight preview, never the approve flow.
  const renderIdeaRow = (idea: Idea) => (
    <div key={idea.id} style={{ borderBottom: `1px solid ${LINE}` }}>
      <div
        role="button" tabIndex={0}
        onClick={() => onOpenIdea(idea)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenIdea(idea); } }}
        className="grid cursor-pointer items-center gap-x-[18px] px-3.5 py-[15px] transition-colors duration-150 hover:brightness-[0.985] sm:grid-cols-[96px_minmax(0,1fr)_110px_190px_26px]"
        style={{ margin: '0 -14px' }}
      >
        <span style={{ fontFamily: MONO, fontSize: 12, color: INK_MUTE }}>—</span>
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: caText(accent) }} aria-hidden />
          <span className="min-w-0">
            <span className="block truncate" style={{ fontFamily: BODY, fontWeight: 600, fontSize: 16, color: INK }}>{idea.title}</span>
            {idea.hook && <span className="block truncate" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE }}>{idea.hook}</span>}
          </span>
        </span>
        <span className="hidden capitalize sm:block" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE }}>{idea.pillar || 'idea'}</span>
        <span className="hidden sm:block" style={{ fontFamily: MONO, fontSize: 11, color: INK_MUTE }}>queued as an idea</span>
        <span className="hidden text-right sm:block" style={{ fontFamily: MONO, fontSize: 13, color: INK_MUTE }}>→</span>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header stays capped at the list width in every view, so the view switcher
          never jumps when the board view widens the canvas. */}
      <div className="flex max-w-[880px] flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-[240px] flex-1">
          <SectionHead
            eyebrow="The pipeline"
            title={<>The pipeline, <Accent>in your voice.</Accent></>}
            sub={`Everything the engine produces moves through these stages. Open a row to see it exactly as the feed will. Anything in your review you don't touch publishes automatically after ${autoDays} days.`}
          />
        </div>
        <div className="inline-flex shrink-0 overflow-hidden rounded-[8px]" style={{ border: `1px solid ${LINE}` }} role="tablist" aria-label="Content view">
          {VIEWS.map((v, i) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className="min-h-[34px] px-3.5 uppercase transition-colors duration-150"
              style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.1em', borderLeft: i > 0 ? `1px solid ${LINE}` : 'none', ...(view === v.id ? { background: caWash(accent, 8), color: caText(accent) } : { background: 'transparent', color: INK_MUTE }) }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' && (
        <div className="max-w-[980px]">
          {/* IDEAS — the engine's upcoming idea bank, not yet drafted. Hides when absent. */}
          {ideas.length > 0 && (
            <section>
              <LedgerSectionHead eyebrow="Ideas" count={ideas.length} blurb={IDEAS_BLURB} accent={accent} />
              {ideas.map(renderIdeaRow)}
            </section>
          )}
          {/* Stage groups: Your review → Drafting → Scheduled → Published. Empty stages hide. */}
          {LIST_STAGE_SECTIONS.map(({ stage, label, blurb }) => {
            const rows = (groups.find((g) => g.stage === stage)?.items || []).slice().sort(byDate);
            if (rows.length === 0) return null;
            return (
              <section key={stage}>
                <LedgerSectionHead eyebrow={label} count={rows.length} blurb={blurb} accent={accent} />
                {rows.map(renderLedgerRow)}
              </section>
            );
          })}
        </div>
      )}

      {view === 'board' && (
        <LayoutGroup id="cb-board">
          <div className="overflow-x-auto pb-2">
            <div className="flex items-start gap-3" style={{ minWidth: 'max-content' }}>
              {groups.map(({ stage, items }) => (
                <div key={stage} className="w-[248px] shrink-0 rounded-xl p-2" style={{ background: 'rgba(2,49,47,0.03)' }}>
                  <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                    <span className="h-[6px] w-[6px] rounded-full" style={{ background: stageDot(stage) }} aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: stage === 'review' ? accent : DIM }}>{STAGE_META[stage].label}</span>
                    <span className="rounded-full bg-white px-1.5 text-[11px] font-semibold tabular-nums" style={{ color: DIM }}>{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.length === 0 && (
                      <div className="rounded-lg px-3 py-4 text-[12px]" style={{ color: FAINT, border: `1px dashed ${LINE}` }}>Nothing here right now.</div>
                    )}
                    {items.map((q) => (
                      <motion.button
                        layout
                        layoutId={`b-${q.id}`}
                        key={q.id}
                        transition={{ layout: { duration: 0.25, ease: EASE } }}
                        onClick={() => onOpen(q)}
                        className={`flex w-full flex-col gap-2 rounded-lg bg-white p-2.5 text-left ${LIFT}`}
                        style={{ ...flashStyle(q.id) }}
                      >
                        {/* Text posts skip the typographic thumb here — the card already
                            leads with the title, so the tile would say it twice. */}
                        {!(q.kind === 'post' && !q.media_url && !q.cover_url) && <Thumb q={q} accent={accent} large />}
                        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>{kickerOf(q)}</span>
                        <span className="text-[13px] font-medium leading-snug" style={{ color: INK, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {q.hook || q.title}
                        </span>
                        <span>
                          {stage === 'review' && skips[q.id]
                            ? <span className="text-[12px]" style={{ color: FAINT }}>Skipped this week</span>
                            : stageStatus(q, stage)}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </LayoutGroup>
      )}

      {view === 'feed' && (
        <div className="max-w-[880px] rounded-xl px-3 py-6 sm:px-6" style={{ background: '#f3f2ef', border: `1px solid ${LINE}` }}>
          <div className="mx-auto mb-5 max-w-[552px]">
            <h3 className="text-[18px] font-semibold tracking-tight" style={{ color: INK }}>Next week on your LinkedIn</h3>
            <p className="mt-1 text-[13.5px]" style={{ color: DIM }}>
              {weekCounts.posts} posts, {weekCounts.lms} lead magnets, drafted from your voice.
            </p>
          </div>
          <div className="flex flex-col">
            {feedItems.map((q) => (
              <div key={q.id} className="mx-auto w-full max-w-[552px]">
                <div className="mb-1.5 mt-4 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] tabular-nums first:mt-0" style={{ color: FAINT }}>
                  {fmtDay(q.publish_date)}
                </div>
                <LinkedInPostPreview
                  text={q.body || ''}
                  author={founder?.name || board.company_name}
                  headline={founder?.headline || ''}
                  avatarUrl={founder?.avatar_url || ''} /* '' forces initials — the component's default is Ivan's portrait */
                  mediaUrl={q.media_url || undefined}
                  stats={{ reactions: 0, comments: 0 }}
                  timeLabel="Preview" /* future posts: no "1d · Edited" chrome */
                  showFold
                />
              </div>
            ))}
            {feedItems.length === 0 && (
              <div className="mx-auto max-w-[552px] rounded-[12px] bg-white px-4 py-6 text-[13px]" style={{ color: DIM, border: `1px solid ${LINE}` }}>
                Your first drafts land here this week. This view shows them exactly as they'll run on your feed.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Story intake: where the client's REAL material enters the engine. The chip is a
          format explainer, not history — nothing on this card claims past activity. */}
      <div className="mt-8 max-w-[880px] rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${accent} 10%, white)` }} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3" />
            </svg>
          </span>
          <div className="min-w-0">
            <CardHead>Your stories</CardHead>
            <p className="mt-1 max-w-[58ch] text-[13.5px] leading-relaxed" style={{ color: DIM }}>
              Once a week, send a voice note about a real client situation. The engine turns true stories into posts; nothing gets invented.
            </p>
            <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium" style={{ background: 'rgba(2,49,47,0.04)', color: DIM }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              </svg>
              a 90-second note becomes 1-2 posts
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Week home: "Your next 7 days" ----------
function weekDayList(startIso: string): string[] {
  const start = new Date(startIso + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000).toISOString().slice(0, 10));
}
const KIND_SORT: Record<string, number> = { newsletter: 0, post: 1, carousel: 2, lm: 3, newsjack: 4 };
interface WeekSlot { key: string; q?: QueueItem; cal?: CalendarItem }

/** Trust mark: the draft was checked against the client's voice model. Neutral chip —
 *  accent stays rationed to actions. The full trail is one tap away (card opens the modal). */
function VoiceChip({ accent }: { accent: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium"
      style={{ background: 'rgba(2,49,47,0.05)', color: DIM }}
      title="Checked against your voice model. Open the card for the full trail."
    >
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 13l4 4 10-10" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      </svg>
      Voice-matched
    </span>
  );
}

/** One actionable card in the week flow. Desktop: buttons + A/R/N on the focused card.
 *  Mobile: swipe right = approve, swipe left = different idea, tap = detail modal.
 *  Swipe release uses a tween (no spring) per the motion contract. */
function WeekCard({ q, accent, focused, approving, flashOn, autoDays, panel, onFocus, onOpen, onApprove, onServeAngle, onPickAngle, onClosePanel, onSkip, cardRef }: {
  q: QueueItem; accent: string; focused: boolean; approving: boolean; flashOn: boolean; autoDays: number;
  panel: { alt?: AltAngle; none?: boolean } | null;
  onFocus: () => void;
  onOpen: (opts?: { changing?: boolean }) => void;
  onApprove: () => void;
  onServeAngle: () => void;
  onPickAngle: (alt: AltAngle) => void;
  onClosePanel: () => void;
  onSkip: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const reduce = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const x = useMotionValue(0);
  const approveReveal = useTransform(x, [24, 90], [0, 1]);
  const angleReveal = useTransform(x, [-90, -24], [1, 0]);
  const dragged = useRef(false);
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const settle = () => animate(x, 0, { duration: 0.2, ease: EASE as any });
  const kbd = (k: string) => (
    <kbd className="ml-1 hidden h-[15px] min-w-[15px] items-center justify-center rounded-[4px] px-1 text-[9.5px] leading-none sm:inline-flex" style={{ fontFamily: MONO, background: 'rgba(2,49,47,0.06)', border: `1px solid ${LINE}`, color: DIM }}>{k}</kbd>
  );
  const inkCta = inkOn(accent);
  return (
    <div className="relative" ref={cardRef}>
      {/* Swipe reveals (mobile): the gesture's own affordance layers. */}
      <motion.div className="absolute inset-0 flex items-center rounded-xl px-5 sm:hidden" style={{ opacity: approveReveal, background: `color-mix(in srgb, ${accent} 10%, white)` }} aria-hidden>
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold" style={{ color: accent }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4 10-10" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Approve
        </span>
      </motion.div>
      <motion.div className="absolute inset-0 flex items-center justify-end rounded-xl px-5 sm:hidden" style={{ opacity: angleReveal, background: 'rgba(2,49,47,0.05)' }} aria-hidden>
        <span className="text-[13px] font-semibold" style={{ color: DIM }}>Different idea</span>
      </motion.div>
      <motion.div
        role="button"
        tabIndex={0}
        drag={coarse ? 'x' : false}
        dragMomentum={false}
        dragConstraints={{ left: -140, right: 140 }}
        dragElastic={0.12}
        style={{ x, border: `1px solid ${focused ? 'transparent' : LINE}`, boxShadow: focused ? `0 0 0 2px ${accent}, 0 4px 14px rgba(2,32,32,0.08)` : undefined, background: flashOn ? FLASH_BG : '#fff', transition: 'background-color 700ms ease' }}
        onDragStart={() => { dragged.current = true; }}
        onDragEnd={(_, info) => {
          const dx = info.offset.x;
          settle();
          if (dx > 90) onApprove();
          else if (dx < -90) onServeAngle();
          window.setTimeout(() => { dragged.current = false; }, 60);
        }}
        onClick={() => { if (dragged.current) return; onOpen(); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
        onMouseEnter={onFocus}
        onFocus={onFocus}
        className="relative cursor-pointer rounded-xl p-3.5 outline-none sm:p-4"
        aria-label={`${q.hook || q.title}, awaiting your review`}
      >
        <div className="flex items-start gap-3">
          {/* Text posts lead with the title itself — the typographic thumb would repeat it. */}
          {!(q.kind === 'post' && !q.media_url && !q.cover_url) && <Thumb q={q} accent={accent} />}
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium leading-snug" style={{ color: INK }}>{q.hook || q.title}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>{kickerOf(q)}</span>
              {q.pillar && (
                <span className="inline-flex items-center gap-1.5 text-[12px] capitalize" style={{ color: FAINT }}>
                  <span className="h-[5px] w-[5px] rounded-full" style={{ background: accent, opacity: 0.55 }} aria-hidden />
                  {q.pillar}
                </span>
              )}
              <VoiceChip accent={accent} />
            </div>
          </div>
          <span className="hidden shrink-0 sm:block"><PublishCell q={q} stage="review" /></span>
        </div>
        {/* Desktop action row — Approve is the only filled button. */}
        <div className="mt-3 hidden items-center gap-2 sm:flex">
          <button
            onClick={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).blur(); onApprove(); }}
            className="inline-flex min-h-[32px] items-center rounded-[6px] px-3.5 text-[12.5px] font-semibold"
            style={{ background: accent, color: inkCta }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden className="mr-1.5">
              <path d="M5 13l4 4 10-10" stroke={inkCta} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Approve{kbd('A')}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onServeAngle(); }}
            className="inline-flex min-h-[32px] items-center rounded-[6px] bg-white px-3 text-[12.5px] font-medium transition-colors duration-150 hover:bg-[rgba(2,49,47,0.04)]"
            style={{ color: DIM, border: `1px solid ${LINE}` }}
          >
            Different idea{kbd('N')}
          </button>
          <div className="relative ml-auto">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((m) => !m); }}
              aria-label="More options"
              aria-expanded={menuOpen}
              className="flex h-8 w-8 items-center justify-center rounded-[6px] transition-colors duration-150 hover:bg-[rgba(2,49,47,0.05)]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="5" cy="12" r="1.6" fill={DIM} /><circle cx="12" cy="12" r="1.6" fill={DIM} /><circle cx="19" cy="12" r="1.6" fill={DIM} />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} aria-hidden />
                <div className="absolute right-0 top-9 z-20 w-48 rounded-lg bg-white p-1" style={{ border: `1px solid ${LINE}`, boxShadow: '0 8px 24px rgba(2,32,32,0.12)' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpen({ changing: true }); }}
                    className="flex w-full items-center justify-between rounded-[6px] px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors duration-150 hover:bg-[rgba(2,49,47,0.04)]"
                    style={{ color: INK }}
                  >
                    Request a change{kbd('R')}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onSkip(); }}
                    className="flex w-full rounded-[6px] px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors duration-150 hover:bg-[rgba(2,49,47,0.04)]"
                    style={{ color: DIM }}
                  >
                    Skip this day
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        {/* Different-idea panel: a seeded alternate ANGLE, never an instant draft. */}
        <AnimatePresence initial={false}>
          {panel && (
            <motion.div
              initial={reduce ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={reduce ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: EASE }}
              className="overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {panel.none ? (
                <div className="mt-3 rounded-lg p-3.5" style={{ background: 'rgba(2,49,47,0.03)', border: `1px dashed ${LINE}` }}>
                  <p className="text-[13px] leading-relaxed" style={{ color: DIM }}>
                    This one is already built and live on your domain, so there is no alternate angle to serve. Request a change instead and your operator adjusts it.
                  </p>
                  <div className="mt-2.5 flex gap-2">
                    <button onClick={() => { onClosePanel(); onOpen({ changing: true }); }} className="inline-flex min-h-[32px] items-center rounded-[6px] px-3 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}>Request a change</button>
                    <button onClick={onClosePanel} className="inline-flex min-h-[32px] items-center rounded-[6px] px-3 text-[12.5px] font-medium" style={{ color: FAINT }}>Close</button>
                  </div>
                </div>
              ) : panel.alt ? (
                <div className="mt-3 rounded-lg p-3.5" style={{ background: `color-mix(in srgb, ${accent} 4%, white)`, border: `1px dashed color-mix(in srgb, ${accent} 30%, white)` }}>
                  <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em]" style={{ color: FAINT }}>Different idea for this slot</div>
                  <div className="mt-1.5 text-[13.5px] font-semibold" style={{ color: INK }}>{panel.alt.title}</div>
                  <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: DIM }}>{panel.alt.hook}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]" style={{ color: FAINT }}>
                    {panel.alt.pillar && (
                      <span className="inline-flex items-center gap-1.5 capitalize">
                        <span className="h-[5px] w-[5px] rounded-full" style={{ background: accent, opacity: 0.55 }} aria-hidden />
                        {panel.alt.pillar}
                      </span>
                    )}
                    {panel.alt.drafts_by && <span className="tabular-nums">Drafts {fmtDay(panel.alt.drafts_by)} if you pick it</span>}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button onClick={() => onPickAngle(panel.alt!)} className="inline-flex min-h-[32px] items-center rounded-[6px] px-3.5 text-[12.5px] font-semibold" style={{ background: accent, color: inkCta }}>Use this angle</button>
                    <button onClick={onServeAngle} className="inline-flex min-h-[32px] items-center rounded-[6px] bg-white px-3 text-[12.5px] font-medium" style={{ border: `1px solid ${LINE}`, color: DIM }}>Show another</button>
                    <button onClick={onClosePanel} className="inline-flex min-h-[32px] items-center rounded-[6px] px-2.5 text-[12.5px] font-medium" style={{ color: FAINT }}>Keep current</button>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
        {/* Approve moment: the check draws, then the card settles into its locked state. */}
        {approving && (
          <motion.span
            className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.85)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, ease: EASE }}
            aria-hidden
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <motion.path
                d="M4.5 12.5l5 5 10-11"
                stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3, ease: EASE }}
              />
            </svg>
            <span className="text-[13px] font-semibold" style={{ color: accent }}>Approved</span>
          </motion.span>
        )}
      </motion.div>
    </div>
  );
}

function WeekSurface({ board, accent, mint, stageOf, approvedIds, angleSwaps, skips, benchFor, onOpen, onOpenCal, onApprove, onPickAngle, onSkip, onUnskip, onGoContent, flashId, modalOpen }: {
  board: Board; accent: string; mint: string;
  stageOf: (q: QueueItem) => Stage;
  /** Ids the CLIENT approved this session (persisted) — distinct from data-scheduled items. */
  approvedIds: Set<string>;
  angleSwaps: Record<string, AltAngle>;
  skips: Record<string, true>;
  benchFor: (id: string) => AltAngle[];
  onOpen: (q: QueueItem, opts?: { changing?: boolean }) => void;
  onOpenCal: (it: CalendarItem) => void;
  onApprove: (id: string) => void;
  onPickAngle: (id: string, alt: AltAngle) => void;
  onSkip: (id: string) => void;
  onUnskip: (id: string) => void;
  /** "Behind this week" teaser → the Content ledger. */
  onGoContent: () => void;
  flashId: string | null;
  modalOpen: boolean;
}) {
  const reduce = useReducedMotion();
  const fontStack = board.brand?.font_heading ? `"${board.brand.font_heading}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif';
  const coarseWeek = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const onOpenBehind = onGoContent;
  const autoDays = board.auto_publish_days ?? 3;
  const cal = board.calendar;
  const days = cal ? weekDayList(cal.start) : [];
  const daySet = new Set(days);

  // One slot per piece: queue items own their day; calendar entries fill the rest.
  // A calendar entry that names a queue item (ref), or an unlinked entry of a kind the
  // queue already covers that day, collapses into the queue card — one source, no doubles.
  const slotsByDay = useMemo(() => {
    const map = new Map<string, WeekSlot[]>();
    days.forEach((day) => {
      const qItems = board.queue.filter((q) => q.publish_date === day && q.stage !== 'published');
      const calItems = (cal?.items || []).filter((it) => it.date === day);
      const have = new Set(qItems.map((q) => q.id));
      const spare: Record<string, number> = {};
      qItems.forEach((q) => { if (!calItems.some((it) => it.ref === q.id)) spare[q.kind] = (spare[q.kind] || 0) + 1; });
      const slots: WeekSlot[] = qItems.map((q) => ({ key: q.id, q }));
      calItems.forEach((it, i) => {
        if (it.ref) {
          if (have.has(it.ref)) return;
          const linked = board.queue.find((qq) => qq.id === it.ref);
          if (linked) {
            if (linked.stage !== 'published') { slots.push({ key: linked.id, q: linked }); have.add(linked.id); }
            return;
          }
        }
        if (!it.ref && (spare[it.kind] || 0) > 0) { spare[it.kind] -= 1; return; }
        slots.push({ key: `cal-${day}-${it.kind}-${i}`, cal: it });
      });
      slots.sort((a, b) => (KIND_SORT[(a.q ? a.q.kind : a.cal!.kind)] ?? 9) - (KIND_SORT[(b.q ? b.q.kind : b.cal!.kind)] ?? 9));
      map.set(day, slots);
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, cal, days.join(',')]);

  // The flow ledger: total = review-stage pieces this week; handled = approved,
  // re-angled or skipped. d1 joins the count the moment the intro lands it.
  const weekQ = board.queue.filter((q) => daySet.has(q.publish_date || '') && q.stage !== 'published');
  const actionable = [...weekQ.filter((q) => q.stage === 'review')].sort((a, b) => (a.publish_date || '').localeCompare(b.publish_date || ''));
  const handledOf = (q: QueueItem) => approvedIds.has(q.id) || !!angleSwaps[q.id] || !!skips[q.id];
  const total = actionable.length;
  const done = actionable.filter(handledOf).length;
  const pendingIds = actionable.filter((q) => stageOf(q) === 'review' && !skips[q.id]).map((q) => q.id);
  const doneState = total > 0 && pendingIds.length === 0;

  // Focus flow: one focused card, j/k or arrows to move, auto-advance after acting.
  const [focusId, setFocusId] = useState<string | null>(null);
  const focusRef = useRef<string | null>(null);
  focusRef.current = focusId;
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!focusRef.current || !pendingIds.includes(focusRef.current)) setFocusId(pendingIds[0] || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingIds.join(',')]);
  const advanceFrom = (id: string) => {
    const i = pendingIds.indexOf(id);
    const next = pendingIds[i + 1] || pendingIds[i - 1] || null;
    setFocusId(next !== id ? next : null);
  };
  const move = (dir: 1 | -1) => {
    if (!pendingIds.length) return;
    const i = focusRef.current ? pendingIds.indexOf(focusRef.current) : -1;
    const next = pendingIds[Math.min(pendingIds.length - 1, Math.max(0, i + dir))];
    setFocusId(next);
    cardRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
  };

  // Approve = sign-off. The card flings out (AnimatePresence exit) and the next enters;
  // the tick fills as it lands. No check overlay — the deck motion IS the confirmation.
  const startApprove = (id: string) => {
    setAngle(null);
    advanceFrom(id);
    onApprove(id);
  };

  // Different-idea bench: N (or swipe left) serves the next seeded angle for the slot.
  const [angle, setAngle] = useState<{ id: string; alt?: AltAngle; none?: boolean } | null>(null);
  const servedRef = useRef<Record<string, number>>({});
  const serveAngle = (id: string) => {
    const bench = benchFor(id);
    if (!bench.length) { setAngle({ id, none: true }); return; }
    const idx = servedRef.current[id] || 0;
    servedRef.current[id] = idx + 1;
    setAngle({ id, alt: bench[idx % bench.length] });
  };
  const pickAngle = (id: string, alt: AltAngle) => { setAngle(null); advanceFrom(id); onPickAngle(id, alt); };

  useEffect(() => {
    if (modalOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); move(1); return; }
      if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); move(-1); return; }
      const id = focusRef.current;
      if (!id) return;
      const item = board.queue.find((q) => q.id === id);
      if (!item) return;
      if (e.key === 'a' || e.key === 'A') { e.preventDefault(); startApprove(id); }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); onOpen(item, { changing: true }); }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); serveAngle(id); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, pendingIds.join(','), board]);

  const focused = focusId ? board.queue.find((q) => q.id === focusId) : undefined;
  const dayHasPending = (day: string) => actionable.some((q) => q.publish_date === day && pendingIds.includes(q.id));
  const weekdayName = (iso?: string) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' }) : '');
  const upNext = (() => {
    const fi = focusId ? pendingIds.indexOf(focusId) : -1;
    return pendingIds.slice(fi + 1, fi + 3).map((id) => board.queue.find((q) => q.id === id)).filter(Boolean) as QueueItem[];
  })();
  const pipelineCount = board.queue.filter((q) => q.stage !== 'published').length;

  // Day-tick row (M T W T F S S): filled accent when that day's piece is handled,
  // white + accent border for the current focused day, transparent otherwise.
  const TICK_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const ticks = days.map((d, i) => {
    const dayActionable = actionable.filter((q) => q.publish_date === d);
    const handledDay = dayActionable.length > 0 && dayActionable.every(handledOf);
    const isCurrent = !doneState && focused?.publish_date === d;
    return { letter: TICK_LETTER[i], done: handledDay, current: isCurrent };
  });
  const swapChip = focused && angleSwaps[focused.id];
  const provenance = focused ? (focused.promise || 'drafted from your voice, nothing invented') : '';
  const curPanel = focused && angle?.id === focused.id ? angle : null;

  const rightRail = (
    <div className="flex flex-col gap-4 pt-1.5">
      <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>Up next in the stack</div>
      {upNext.length === 0 && (
        <div className="text-[13px]" style={{ fontFamily: BODY, fontStyle: 'italic', color: INK_MUTE }}>Nothing else waiting on you this week.</div>
      )}
      {upNext.map((q) => (
        <button key={q.id} onClick={() => setFocusId(q.id)} className="rounded-[10px] px-4 py-3.5 text-left transition-opacity hover:opacity-100" style={{ background: PAPER_RAISE, border: `1px solid ${LINE}`, opacity: 0.85 }}>
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE, marginBottom: 6 }}>{weekdayName(q.publish_date)} · {kickerOf(q)}</div>
          <div style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, lineHeight: 1.4, color: INK }}>{q.hook || q.title}</div>
        </button>
      ))}
      <div className="pt-2" style={{ borderTop: `1px solid ${LINE}` }}>
        <button onClick={() => onOpenBehind()} className="w-full rounded-[10px] px-4 py-4 text-left transition-colors hover:brightness-[0.98]" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE, marginBottom: 6 }}>Behind this week</div>
          <div style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.5, color: INK }}>{pipelineCount} pieces in the pipeline: planned, drafting, queued.</div>
          <div className="mt-2 uppercase" style={{ fontFamily: MONO, fontSize: 11, color: caText(accent), letterSpacing: '0.04em' }}>open the pipeline →</div>
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          {/* Masthead: mono eyebrow + day headline + day-tick row (or the done headline). */}
          {doneState || total === 0 ? (
            <div className="mb-2">
              <div className="mb-2.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>Week of {fmtDay(days[0])} · {total} of {total}</div>
              <div style={{ fontFamily: SERIF, fontSize: 'clamp(30px,3.6vw,44px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: INK }}>
                You're set <Accent>for the week.</Accent>
              </div>
            </div>
          ) : (
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <div className="mb-2.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>
                  Week of {fmtDay(days[0])} · piece {Math.min(done + 1, total)} of {total} · {total - done} to go
                </div>
                <div style={{ fontFamily: SERIF, fontSize: 'clamp(30px,3.6vw,44px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: INK, whiteSpace: 'nowrap' }}>
                  {weekdayName(focused?.publish_date)}<span style={{ fontStyle: 'italic', color: accent }}>.</span>
                </div>
              </div>
              <div className="hidden shrink-0 items-center gap-2 sm:flex" aria-hidden>
                {ticks.map((tk, i) => (
                  <span key={i} className="flex items-center justify-center rounded-full" style={{
                    width: 28, height: 28,
                    fontFamily: MONO, fontSize: 10,
                    border: `1.5px solid ${tk.current ? accent : tk.done ? accent : LINE_BOLD}`,
                    background: tk.done ? accent : tk.current ? PAPER_RAISE : 'transparent',
                    color: tk.done ? '#fff' : tk.current ? caText(accent) : INK_MUTE,
                    transition: 'all .3s ease',
                  }}>{tk.letter}</span>
                ))}
              </div>
            </div>
          )}

          {/* Done state: the ledger of everything approved this week. */}
          {(doneState || total === 0) ? (
            <motion.div initial={reduce ? false : { opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45, ease: EASE }}>
              <p className="mt-1 max-w-[52ch]" style={{ fontFamily: BODY, fontSize: 16, lineHeight: 1.6, color: INK_SOFT }}>
                {total === 0
                  ? 'Nothing needs you this week. Every piece is already approved or operator-run. The engine keeps drafting next week behind the scenes.'
                  : `Seven pieces, approved in your voice, queued to their slots. The engine keeps drafting next week behind the scenes, and if you ever miss a week nothing stalls: drafts publish automatically after ${autoDays} days.`}
              </p>
              <div className="mt-6" style={{ borderTop: `1px solid ${LINE_BOLD}` }}>
                {actionable.map((q) => (
                  <div key={q.id} className="grid items-baseline gap-x-4 py-3" style={{ gridTemplateColumns: '96px 1fr 120px', borderBottom: `1px solid ${DIVIDE}` }}>
                    <span className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.08em', color: INK_MUTE }}>{weekdayName(q.publish_date).slice(0, 3)} {KIND_TIME[q.kind] || ''}</span>
                    <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 15, color: INK }}>{q.hook || q.title}</span>
                    <span className="text-right" style={{ fontFamily: MONO, fontSize: 10, color: caText(accent) }}>✓ {kickerOf(q)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <>
              {pendingIds.length > 0 && (
                <p className="mb-4 text-[12px] sm:hidden" style={{ fontFamily: MONO, letterSpacing: '0.04em', color: INK_MUTE }}>
                  Swipe right to approve · left for a different idea · tap to read
                </p>
              )}
              {/* The card deck: front card over two rotated ghosts; flings on approve. */}
              <div className="relative">
                <div className="pointer-events-none absolute" style={{ inset: '10px -8px -10px 8px', background: PAPER_RAISE, border: `1px solid ${DIVIDE}`, borderRadius: 14, transform: 'rotate(.8deg)' }} aria-hidden />
                <div className="pointer-events-none absolute" style={{ inset: '5px -4px -5px 4px', background: PAPER_RAISE, border: `1px solid ${caBorder('#1a1a1a', 14)}`, borderRadius: 14, transform: 'rotate(-.5deg)' }} aria-hidden />
                {/* swipe hint layers (mobile) */}
                <AnimatePresence mode="popLayout" initial={false}>
                  {focused && (
                    <motion.div
                      key={focused.id}
                      drag={coarseWeek ? 'x' : false}
                      dragSnapToOrigin
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.5}
                      onDragEnd={(_, info) => { if (info.offset.x > 90) startApprove(focused.id); else if (info.offset.x < -90) serveAngle(focused.id); }}
                      initial={reduce ? false : { opacity: 0, x: 28, rotate: 1, scale: 0.98 }}
                      animate={{ opacity: 1, x: 0, rotate: 0, scale: 1, transition: { duration: 0.45, ease: [0.2, 0.8, 0.3, 1] } }}
                      exit={reduce ? { opacity: 0 } : { opacity: 0, x: '130%', rotate: 9, transition: { duration: 0.36, ease: [0.5, 0, 0.9, 0.4] } }}
                      className="relative"
                      style={{ background: PAPER_RAISE, border: `1px solid ${caBorder('#1a1a1a', 18)}`, borderRadius: 14, padding: '22px 26px', boxShadow: HERO_SHADOW, touchAction: coarseWeek ? 'pan-y' : undefined }}
                    >
                      <div className="mb-3.5 flex items-baseline justify-between gap-3">
                        <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: caText(accent) }}>{kickerOf(focused)} · goes out {weekdayName(focused.publish_date)}</span>
                        <span style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 13, color: INK_MUTE }}>{provenance}</span>
                      </div>
                      {swapChip && (
                        <div className="mb-3 inline-block rounded-full uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: caText(accent), background: caWash(accent, 9), border: `1px solid ${caBorder(accent, 35)}`, padding: '5px 12px' }}>
                          ⟲ fresh idea: same slot, still your voice
                        </div>
                      )}
                      <div onClick={() => onOpen(focused)} className="cursor-pointer">
                        <FeedPreview item={focused} board={board} accent={accent} fontStack={fontStack} size="lg" />
                      </div>
                      <div className="mt-4.5 flex flex-wrap items-center gap-3" style={{ marginTop: 18 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).blur(); startApprove(focused.id); }}
                          className="uppercase transition-colors duration-150"
                          style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', background: INK, color: PAPER, border: 'none', borderRadius: 8, padding: '14px 28px', cursor: 'pointer' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `color-mix(in oklab, ${accent} 80%, #1A1A1A)`; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = INK; }}
                        >Approve ✓</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); serveAngle(focused.id); }}
                          className="uppercase transition-colors duration-150"
                          style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.12em', background: 'none', color: INK, border: `1px solid ${LINE_BOLD}`, borderRadius: 8, padding: '13px 18px', cursor: 'pointer' }}
                        >⟲ swap the idea</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpen(focused, { changing: true }); }}
                          style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 14, background: 'none', border: 'none', color: INK_MUTE, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                        >edit a line…</button>
                        <span className="ml-auto hidden sm:inline" style={{ fontFamily: BODY, fontStyle: 'italic', fontSize: 12.5, color: INK_MUTE }}>untouched pieces auto-publish in {autoDays} days</span>
                      </div>
                      {/* Different-idea panel: a seeded alternate ANGLE, never an instant draft. */}
                      <AnimatePresence initial={false}>
                        {curPanel && (
                          <motion.div
                            initial={reduce ? false : { opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={reduce ? undefined : { opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: EASE }}
                            className="overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {curPanel.none ? (
                              <div className="mt-4 rounded-lg p-3.5" style={{ background: caWash('#1a1a1a', 3), border: `1px dashed ${LINE}` }}>
                                <p style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.6, color: INK_SOFT }}>This one is already built and live on your domain, so there's no alternate angle to serve. Request a change instead and your operator adjusts it.</p>
                                <div className="mt-2.5 flex gap-2">
                                  <button onClick={() => { setAngle(null); onOpen(focused, { changing: true }); }} className="rounded-[6px] px-3 py-2 text-[12.5px] font-semibold" style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}>Request a change</button>
                                  <button onClick={() => setAngle(null)} className="px-3 py-2 text-[12.5px]" style={{ color: INK_MUTE }}>Close</button>
                                </div>
                              </div>
                            ) : curPanel.alt ? (
                              <div className="mt-4 rounded-lg p-3.5" style={{ background: caWash(accent, 4), border: `1px dashed ${caBorder(accent, 30)}` }}>
                                <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.14em', color: INK_MUTE }}>Different idea for this slot</div>
                                <div className="mt-1.5" style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14.5, color: INK }}>{curPanel.alt.title}</div>
                                <p className="mt-0.5" style={{ fontFamily: BODY, fontSize: 13, lineHeight: 1.6, color: INK_SOFT }}>{curPanel.alt.hook}</p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]" style={{ color: INK_MUTE }}>
                                  {curPanel.alt.pillar && <span className="inline-flex items-center gap-1.5 capitalize"><span className="h-[5px] w-[5px] rounded-full" style={{ background: accent }} aria-hidden />{curPanel.alt.pillar}</span>}
                                  {curPanel.alt.drafts_by && <span className="tabular-nums">Drafts {fmtDay(curPanel.alt.drafts_by)} if you pick it</span>}
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <button onClick={() => pickAngle(focused.id, curPanel.alt!)} className="rounded-[6px] px-3.5 py-2 text-[12.5px] font-semibold" style={{ background: accent, color: inkOn(accent) }}>Use this angle</button>
                                  <button onClick={() => serveAngle(focused.id)} className="rounded-[6px] px-3 py-2 text-[12.5px] font-medium" style={{ border: `1px solid ${LINE}`, color: INK_SOFT, background: '#fff' }}>Show another</button>
                                  <button onClick={() => setAngle(null)} className="px-2.5 py-2 text-[12.5px] font-medium" style={{ color: INK_MUTE }}>Keep current</button>
                                </div>
                              </div>
                            ) : null}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}
        </div>
        {rightRail}
      </div>
    </div>
  );
}

// ---------- Detail view (modal): preview + edit + agent trail ----------
function AgentTrail({ steps, accent }: { steps: AgentStep[]; accent: string }) {
  // The trail draws itself on open: connector spine grows, steps settle in with a
  // ~120ms stagger, timestamps fade last. Motion demonstrates "agents ran in order".
  const reduce = useReducedMotion();
  const stepVariants = reduce
    ? undefined
    : {
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
      };
  return (
    <div>
      <div className="mb-3 text-[13px] font-semibold" style={{ color: INK }}>How this was made</div>
      <motion.div
        className="flex flex-col"
        initial={reduce ? false : 'hidden'}
        animate="show"
        variants={reduce ? undefined : { show: { transition: { staggerChildren: 0.12, delayChildren: 0.12 } } }}
      >
        {steps.map((s, i) => (
          <motion.div key={i} className="relative flex gap-3 pb-4 last:pb-0" variants={stepVariants}>
            {i < steps.length - 1 && (
              <motion.span
                className="absolute bottom-0 left-[7px] top-5 w-px"
                style={{ background: LINE, transformOrigin: 'top' }}
                aria-hidden
                variants={reduce ? undefined : { hidden: { scaleY: 0 }, show: { scaleY: 1, transition: { duration: 0.3, ease: EASE } } }}
              />
            )}
            <span className="relative z-10 mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
              {s.done === false && !s.t
                ? <span className="h-3 w-3 rounded-full" style={{ border: `1.5px solid ${LINE}`, background: '#fff' }} aria-hidden />
                : s.done === false
                ? <PulseDot color={accent} />
                : (
                  <motion.span
                    className="flex h-4 w-4 items-center justify-center rounded-full"
                    style={{ background: `color-mix(in srgb, ${accent} 16%, white)` }}
                    variants={reduce ? undefined : { hidden: { scale: 0.4 }, show: { scale: 1, transition: { duration: 0.25, ease: EASE } } }}
                  >
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M5 13l4 4 10-10" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.span>
                )}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-semibold" style={{ color: INK }}>{stepLabel(s.step)}</span>
                {s.t && (
                  <motion.span
                    className="text-[11px]"
                    style={{ color: FAINT }}
                    variants={reduce ? undefined : { hidden: { opacity: 0 }, show: { opacity: 1, transition: { delay: 0.22, duration: 0.3 } } }}
                  >
                    {s.t}
                  </motion.span>
                )}
              </div>
              {s.detail && <div className="text-[12px] leading-snug" style={{ color: DIM }}>{s.detail}</div>}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

function DetailModal({ item, board, accent, stage, onClose, onApprove, initialChanging = false }: {
  item: QueueItem; board: Board; accent: string; stage: Stage;
  onClose: () => void; onApprove: (id: string) => void; initialChanging?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.body || '');
  const [changing, setChanging] = useState(initialChanging);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const ctaInk = inkOn(accent);
  const canAct = stage === 'review';

  // Escape steps out one level at a time: edit / request-change mode first, then the modal.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (editing) { setEditing(false); return; }
      if (changing) { setChanging(false); return; }
      onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [editing, changing, onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />
      {/* Dialog caps at viewport height with internal scroll — the action footer stays
          visible at small desktop sizes (1280x720) instead of falling below the fold. */}
      <div className="relative mx-auto my-0 flex min-h-full w-full max-w-4xl flex-col bg-white sm:my-6 sm:min-h-0 sm:max-h-[calc(100vh-48px)] sm:rounded-xl" style={{ boxShadow: '0 30px 80px rgba(2,32,32,.32)' }}>
        {/* Header */}
        <div className="flex shrink-0 items-center gap-2.5 px-4 pb-4 pt-4 sm:px-6 sm:pt-6">
          <KindChip q={item} accent={accent} />
          {item.pillar && <span className="text-[12px] capitalize" style={{ color: FAINT }}>{item.pillar}</span>}
          <span className="ml-auto">{stageStatus(item, stage, board.calendar?.start)}</span>
          <button onClick={onClose} aria-label="Close" className="ml-2 flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[rgba(2,49,47,0.05)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke={DIM} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          {/* Left: content preview / edit */}
          <div className="min-w-0">
            {item.kind === 'newsletter' && item.body ? (
              /* Newsletter issues read as email, not as a LinkedIn post. */
              <div className="overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
                <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: `1px solid ${DIVIDE}`, background: 'rgba(2,49,47,0.02)' }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: accent, color: inkOn(accent) }} aria-hidden>
                    {(board.founder?.name || board.company_name).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold" style={{ color: INK }}>
                      {board.founder?.name || board.company_name}{board.newsletter?.name ? ` · ${board.newsletter.name}` : ''}
                    </span>
                    <span className="block text-[11.5px]" style={{ color: FAINT }}>to your subscribers</span>
                  </span>
                  <span className="ml-auto shrink-0 text-[11.5px] tabular-nums" style={{ color: FAINT }}>{fmtDay(item.publish_date)}</span>
                </div>
                <div className="px-4 py-4 sm:px-5">
                  <div className="text-[16px] font-semibold leading-snug" style={{ color: INK }}>{item.hook || item.title}</div>
                  <div className="mt-3 max-w-[62ch]">
                    {(item.body || '').split(/\n\n+/).map((p, i) => (
                      <p key={i} className="mt-3 whitespace-pre-line text-[14px] leading-relaxed first:mt-0" style={{ color: '#2b3736' }}>{p}</p>
                    ))}
                  </div>
                </div>
              </div>
            ) : item.kind === 'lm' ? (
              <div className="rounded-xl p-4" style={{ border: `1px solid ${LINE}` }}>
                <div className="flex flex-col gap-4 sm:flex-row">
                  {item.cover_url && <img src={item.cover_url} alt="" className="w-full rounded-lg object-cover sm:w-44" style={{ border: `1px solid ${LINE}` }} />}
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold" style={{ color: INK }}>{item.title}</div>
                    <p className="mt-1 text-[14px] leading-relaxed" style={{ color: DIM }}>{item.promise}</p>
                    <p className="mt-2 text-[13px]" style={{ color: FAINT }}>Interactive assessment on your domain. Try it live in the Lead magnet tab.</p>
                  </div>
                </div>
              </div>
            ) : editing ? (
              <div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={Math.min(18, Math.max(8, body.split('\n').length + 2))}
                  className="w-full rounded-lg p-4 text-[14px] leading-relaxed outline-none"
                  style={{ border: `1.5px solid ${accent}`, color: INK, background: 'rgba(2,49,47,0.02)' }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex min-h-[40px] items-center rounded-[6px] px-4 text-[13px] font-semibold"
                    style={{ background: accent, color: ctaInk }}
                  >
                    Done editing
                  </button>
                  <span className="text-[12px]" style={{ color: FAINT }}>Edits sync to your operator before publish.</span>
                  <span className="ml-auto text-[12px] tabular-nums" style={{ color: body.length > 210 ? '#b45309' : FAINT }}>
                    {body.length} chars{body.length > 210 ? ' · past the LinkedIn fold' : ''}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                {item.body ? (
                  <LinkedInPostPreview
                    text={body || item.body || ''}
                    author={board.founder?.name || board.company_name}
                    headline={board.founder?.headline || ''}
                    avatarUrl={board.founder?.avatar_url || ''} /* '' forces initials — the component's default is Ivan's portrait */
                    mediaUrl={item.media_url || undefined}
                    stats={{ reactions: 0, comments: 0 }}
                    timeLabel="Preview" /* future/example posts: no "1d · Edited" chrome */
                    showFold={false}
                  />
                ) : (
                  <div className="rounded-xl p-5 text-[14px]" style={{ border: `1px dashed ${LINE}`, color: DIM }}>
                    <div className="text-[15px] font-semibold not-italic" style={{ color: INK }}>{item.hook}</div>
                    <p className="mt-2 leading-relaxed">
                      {stage === 'planned'
                        ? 'Planned topic. The engine drafts it two days before the publish date, then it lands in your review.'
                        : item.generating
                        ? 'The draft is being written right now. It lands here in a few minutes.'
                        : 'Draft in production.'}
                    </p>
                  </div>
                )}
                {canAct && item.body && (
                  <button
                    onClick={() => setEditing(true)}
                    className="mt-3 inline-flex min-h-[40px] items-center rounded-[6px] px-4 text-[13px] font-semibold"
                    style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
                  >
                    Edit copy
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: agent trail */}
          <div className="h-fit rounded-xl p-4" style={{ background: 'rgba(2,49,47,0.02)', border: `1px solid ${LINE}` }}>
            <AgentTrail steps={item.agent_trail || []} accent={accent} />
          </div>
        </div>
        </div>

        {/* Sticky action footer — Approve stays visible while the body scrolls. */}
        {canAct && (
          <div className="sticky bottom-0 shrink-0 rounded-b-xl border-t bg-white px-4 py-3.5 sm:px-6" style={{ borderColor: LINE }}>
            <div className="flex flex-wrap items-center gap-2.5">
              <motion.button
                onClick={() => { onApprove(item.id); onClose(); }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15, ease: EASE }}
                className="inline-flex min-h-[44px] items-center rounded-[7px] px-6 uppercase transition-colors duration-150"
                style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '0.14em', background: INK, color: PAPER }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `color-mix(in oklab, ${accent} 80%, #1A1A1A)`; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = INK; }}
              >
                Approve ✓
              </motion.button>
              <button
                onClick={() => setChanging(!changing)}
                className="inline-flex min-h-[44px] items-center rounded-[6px] px-4 text-[14px] font-medium"
                style={{ border: `1px solid ${LINE}`, color: DIM, background: '#fff' }}
              >
                Request changes
              </button>
              {sent && <span className="text-[13px] font-medium" style={{ color: DIM }}>Sent. Your operator will adjust it before the publish date.</span>}
            </div>
            {changing && !sent && (
              <div className="mt-3">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Tell us what to change, in plain words."
                  rows={3}
                  className="w-full rounded-lg p-3 text-[14px] outline-none"
                  style={{ border: `1px solid ${LINE}`, color: INK, background: 'rgba(2,49,47,0.02)' }}
                />
                <button
                  onClick={() => { setSent(true); setChanging(false); }}
                  className="mt-2 inline-flex min-h-[44px] items-center rounded-[6px] px-4 text-[14px] font-semibold"
                  style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
                >
                  Send to your operator
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Calendar surface ----------
const KIND_TIME: Record<string, string> = { post: '09:00', carousel: '09:00', newsletter: '08:00', lm: '12:00' };

function CalendarSurface({ board, accent, mint, onOpen, scheduledIds }: {
  board: Board; accent: string; mint: string; onOpen: (it: CalendarItem) => void;
  /** Queue ids currently in Scheduled (approved) — their linked chips get a check mark. */
  scheduledIds: Set<string>;
}) {
  const cal = board.calendar;
  if (!cal) return null;
  const start = new Date(cal.start + 'T00:00:00');
  // One source for titles: a chip linked to a queue item always shows that item's hook.
  const labelOf = (it: CalendarItem): string => {
    const linked = it.ref ? board.queue.find((q) => q.id === it.ref) : null;
    return linked?.hook || linked?.title || it.label;
  };
  const byDate = new Map<string, CalendarItem[]>();
  cal.items.forEach((it) => {
    const arr = byDate.get(it.date) || [];
    arr.push(it);
    byDate.set(it.date, arr);
  });
  const totals = { post: 0, carousel: 0, lm: 0, newsletter: 0 };
  cal.items.forEach((it) => { if (it.kind in totals) (totals as any)[it.kind] += 1; });

  // Washed 8-15% tints plus a 3px full-tone rail on the left: chips carry the color
  // system so the grid itself can stay quiet.
  const chipStyle = (kind: string): React.CSSProperties => {
    switch (kind) {
      case 'post': return { background: `color-mix(in srgb, ${accent} 8%, white)`, color: INK, borderLeft: `3px solid color-mix(in srgb, ${accent} 45%, white)` };
      case 'carousel': return { background: `color-mix(in srgb, ${accent} 15%, white)`, color: INK, borderLeft: `3px solid ${accent}` };
      case 'lm': return { background: `color-mix(in srgb, ${mint} 15%, white)`, color: INK, borderLeft: `3px solid ${mint}` };
      case 'newsletter': return { background: 'rgba(2,49,47,0.04)', color: DIM, borderLeft: `3px solid ${FAINT}` };
      case 'newsjack': return { background: '#fff', color: FAINT, border: `1px dashed ${LINE}` };
      default: return { background: 'rgba(2,49,47,0.04)', color: DIM };
    }
  };
  const swatch = (bg: React.CSSProperties, label: string) => (
    <span key={label} className="inline-flex items-center gap-1.5 text-[12px]" style={{ color: DIM }}>
      <span className="h-2.5 w-2.5 rounded-sm" style={{ ...bg, border: bg.border || `1px solid ${LINE}` }} />
      {label}
    </span>
  );

  const weeks: Date[][] = [];
  for (let w = 0; w < cal.weeks; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) row.push(new Date(start.getTime() + (w * 7 + d) * 86400000));
    weeks.push(row);
  }
  const monthLabel = start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const num = (n: number) => <CountUpNum n={n} size={26} />;
  /** Approved mark on a linked chip — the calendar's visible reaction to an approve. */
  const approvedMark = (it: CalendarItem) =>
    it.ref && scheduledIds.has(it.ref) ? (
      <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full" style={{ background: accent }} title="Approved" aria-label="Approved">
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 13l4 4 10-10" stroke={inkOn(accent)} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    ) : null;
  // Mobile agenda: the 7-col grid clips at phone widths, so under 640px the month
  // renders as a day-grouped list that keeps the same tone rails.
  const agendaDays = Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <SectionHead eyebrow="The month ahead" title={<>A month, <Accent>topic by topic.</Accent></>} sub="Every piece the engine has planned, on the day it publishes. Click any item to see it, or what the engine has planned for it." />
      <div className="mb-5 flex flex-wrap gap-3">
        {[
          [totals.post + totals.carousel, 'posts'],
          [totals.lm, 'lead magnets'],
          [totals.newsletter, 'newsletters'],
        ].map(([n, label]) => (
          <div key={label as string} className="flex items-baseline gap-2 rounded-xl bg-white px-4 py-3" style={{ border: `1px solid ${LINE}` }}>
            {num(n as number)}
            <span className="text-[13px] font-medium" style={{ color: DIM }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Mobile: agenda list grouped by day (the grid clips at Mon-Wed under 640px). */}
      <div className="rounded-xl bg-white p-3 sm:hidden" style={{ border: `1px solid ${LINE}` }}>
        <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
          <span className="text-[15px] font-semibold" style={{ color: INK }}>{monthLabel}</span>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums" style={{ border: `1px solid ${LINE}`, background: '#fff', color: DIM }}>
            Engine starts {fmtDay(cal.start)}
          </span>
        </div>
        {agendaDays.map(([iso, dayItems]) => (
          <div key={iso}>
            <div className="mb-1 mt-3 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] tabular-nums" style={{ color: FAINT }}>{fmtDay(iso)}</div>
            <div className="flex flex-col gap-1">
              {dayItems.map((it, i) => {
                const time = KIND_TIME[it.kind];
                if (it.kind === 'newsjack') {
                  return <div key={i} className="rounded-[6px] px-2.5 py-2 text-[12px] font-medium" style={chipStyle(it.kind)}>{labelOf(it)}</div>;
                }
                return (
                  <button
                    key={i}
                    onClick={() => onOpen(it)}
                    className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-left text-[12px] font-medium"
                    style={chipStyle(it.kind)}
                  >
                    {time && <span className="shrink-0 tabular-nums opacity-60">{time}</span>}
                    <span className="min-w-0 flex-1 truncate">{labelOf(it)}</span>
                    {approvedMark(it)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl bg-white p-4 sm:block" style={{ border: `1px solid ${LINE}` }}>
        <div className="min-w-[820px]">
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
            <span className="text-[15px] font-semibold" style={{ color: INK }}>{monthLabel}</span>
            <span className="rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums" style={{ border: `1px solid ${LINE}`, background: '#fff', color: DIM }}>
              Engine starts {fmtDay(cal.start)}
            </span>
            <span className="text-[12px] tabular-nums" style={{ color: FAINT }}>{cal.items.length} pieces scheduled</span>
            <span className="ml-auto hidden items-center gap-4 md:inline-flex">
              {swatch(chipStyle('post'), 'Post')}
              {swatch(chipStyle('carousel'), 'Carousel')}
              {swatch(chipStyle('lm'), 'Lead magnet')}
              {swatch(chipStyle('newsletter'), 'Newsletter')}
            </span>
          </div>
          <div className="grid grid-cols-7 border-b pb-1.5" style={{ borderColor: DIVIDE }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="px-2 text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: FAINT }}>{d}</div>
            ))}
          </div>
          {weeks.map((row, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {row.map((d, di) => {
                const iso = d.toISOString().slice(0, 10);
                const items = byDate.get(iso) || [];
                const visible = items.slice(0, 3);
                const weekend = d.getDay() === 0 || d.getDay() === 6;
                return (
                  <div key={iso} className="min-h-[112px] bg-white p-1.5" style={{ borderTop: wi > 0 ? `1px solid ${DIVIDE}` : 'none', borderLeft: di > 0 ? `1px solid ${DIVIDE}` : 'none' }}>
                    <div className="px-0.5 pb-1 text-[12px] font-medium tabular-nums" style={{ color: weekend ? '#c2cccb' : FAINT }}>{d.getDate()}</div>
                    <div className="flex flex-col gap-1">
                      {visible.map((it, i) => {
                        const time = KIND_TIME[it.kind];
                        const tip = `${time ? time + ' · ' : ''}${KIND_LABEL[it.kind] || it.kind} · ${labelOf(it)}`;
                        if (it.kind === 'newsjack') {
                          return <div key={i} title={tip} className="truncate rounded-[4px] px-1.5 py-1 text-[10.5px] font-medium" style={chipStyle(it.kind)}>{labelOf(it)}</div>;
                        }
                        return (
                          <button
                            key={i}
                            title={tip}
                            onClick={() => onOpen(it)}
                            className="flex w-full items-center gap-1 truncate rounded-[4px] px-1.5 py-1 text-left text-[10.5px] font-medium transition-transform duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] hover:scale-[1.02]"
                            style={chipStyle(it.kind)}
                          >
                            {time && <span className="shrink-0 tabular-nums opacity-60">{time}</span>}
                            <span className="min-w-0 flex-1 truncate">{labelOf(it)}</span>
                            {approvedMark(it)}
                          </button>
                        );
                      })}
                      {items.length > visible.length && (
                        <div className="px-1 text-[10.5px] font-medium" style={{ color: FAINT }}>+{items.length - visible.length} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[13px]" style={{ color: FAINT }}>Dashed slots stay open on purpose: when news breaks in your niche, a reactive post takes the slot same-day.</p>
    </div>
  );
}

// ---------- Lead magnet surface ----------
const LM_FORMAT_LABEL: Record<string, string> = {
  assessment: 'Assessment', calculator: 'Calculator', worksheet: 'Worksheet', checklist: 'Checklist',
};

/** Typographic mockup cover for a library entry: brand tones + the title as the art.
 *  Honest by construction — status chips only, no capture counts, no fake leads. */
function LmLibraryCard({ entry, accent, mint, brand, fontStack, i }: {
  entry: LeadMagnetEntry; accent: string; mint: string; brand?: BoardBrand; fontStack: string; i: number;
}) {
  const live = entry.status === 'live';
  const heroBg = live ? (brand?.header_bg || INK) : `color-mix(in srgb, ${accent} ${[9, 6, 12, 7, 5][i % 5]}%, white)`;
  const titleColor = live ? '#ffffff' : `color-mix(in srgb, ${accent} 72%, ${INK})`;
  const statusChip = live
    ? { label: 'Live', bg: `color-mix(in srgb, ${mint} 16%, white)`, color: INK, dot: mint }
    : entry.status === 'in_production'
    ? { label: 'In production', bg: `color-mix(in srgb, ${accent} 9%, white)`, color: INK, dot: null }
    : { label: 'Planned', bg: 'rgba(2,49,47,0.05)', color: DIM, dot: null };
  return (
    <div className={`overflow-hidden rounded-xl bg-white ${LIFT}`} style={{ border: `1px solid ${LINE}` }}>
      <div className="flex aspect-[16/10] flex-col justify-between p-4" style={{ background: heroBg }}>
        <span
          className="inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={live ? { background: 'rgba(255,255,255,0.12)', color: mint } : { background: 'rgba(255,255,255,0.75)', color: DIM }}
        >
          {LM_FORMAT_LABEL[entry.format] || entry.format}
        </span>
        <span className="text-[17px] font-semibold leading-snug" style={{ fontFamily: fontStack, color: titleColor }}>
          {entry.title}
        </span>
      </div>
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: statusChip.bg, color: statusChip.color }}>
          {statusChip.dot && <StatusDot color={statusChip.dot} size={5} />}
          {statusChip.label}
        </span>
        <span className="ml-auto text-[11.5px] tabular-nums" style={{ color: FAINT }}>
          {live ? 'On your domain' : entry.date_label || ''}
        </span>
      </div>
    </div>
  );
}

function LeadMagnetSurface({ board, accent, mint, fontStack }: { board: Board; accent: string; mint: string; fontStack: string }) {
  const lm = board.lm;
  // Default src (scan_embed) keeps the engine's embed mode: Ivan's chrome/greeting
  // stripped + the client's accent/fonts applied. bname/blogo/cta/ctaurl rebrand the
  // engine's identity + end-screen CTA to the CLIENT (not Ivan's Calendly).
  const src = useMemo(() => {
    const domain = (board.domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    const ctaurl = (board.site as any)?.cta_url || (domain ? `https://${domain}/` : undefined);
    return buildAssessmentEmbedUrl(lm, {
      bname: board.company_name,
      blogo: board.brand?.logo_light || board.logo_url || undefined,
      cta: board.site?.cta,
      ctaurl,
    });
  }, [lm, board]);
  return (
    <div>
      <SectionHead
        eyebrow="Live on your domain"
        title={<>Lead magnets, <Accent>working for you.</Accent></>}
        sub="The live one first, exactly what your leads see. It scores them, then captures their email. New capture assets ship on the calendar below it."
      />
      {src ? (
        <LiveAssessmentEmbed
          src={src}
          title={lm?.title}
          domain={board.domain}
          urlPath={lmPath(lm?.title)}
          logoUrl={board.brand?.logo_dark || board.logo_url}
          accentHex={accent}
          companyName={board.company_name}
          navLinks={board.site?.nav}
          headerBg={board.brand?.header_bg}
          ctaText={board.site?.cta}
          phone={board.site?.phone}
          height={980}
        />
      ) : (
        <div className="rounded-xl bg-white p-8" style={{ border: `1px solid ${LINE}` }}>
          <p className="text-[14px]" style={{ color: DIM }}>Your first lead magnet is in production. It lands here for review this week.</p>
        </div>
      )}

      {/* Library: the live one plus what's coming. Statuses are honest; mockup covers
          are typographic, never screenshots of things that don't exist yet. */}
      {(board.lead_magnets || []).length > 0 && (
        <div className="mt-8">
          <div className="mb-1 flex items-baseline gap-2.5">
            <CardHead>Your lead magnet library</CardHead>
            <span className="text-[12px] tabular-nums" style={{ color: FAINT }}>
              {(board.lead_magnets || []).filter((e) => e.status === 'live').length} live · {(board.lead_magnets || []).filter((e) => e.status !== 'live').length} on the calendar
            </span>
          </div>
          <p className="mb-3 max-w-[64ch] text-[13px] leading-relaxed" style={{ color: DIM }}>
            Each one scores or grades a real problem your buyers have, captures the email, and feeds the leads table below.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(board.lead_magnets || []).map((entry, i) => (
              <LmLibraryCard key={entry.id} entry={entry} accent={accent} mint={mint} brand={board.brand} fontStack={fontStack} i={i} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
        <div className="mb-3"><CardHead>Captured leads</CardHead></div>
        {(board.leads && board.leads.length > 0) ? (
          <>
            {/* Columns prioritized at phone widths: "When" hides under 640px so nothing clips. */}
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr style={{ color: FAINT }}>
                  <th className="pb-2 pr-3 font-medium">Email</th>
                  <th className="pb-2 pr-3 font-medium">Score</th>
                  <th className="pb-2 font-medium">Weakest area</th>
                  <th className="hidden pb-2 pl-3 font-medium sm:table-cell">When</th>
                </tr>
              </thead>
              <tbody style={{ color: INK }}>
                {board.leads.map((lead, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${DIVIDE}` }}>
                    <td className="py-2.5 pr-3"><span className="break-all">{lead.email}</span></td>
                    <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums">{lead.score || ''}</td>
                    <td className="py-2.5">{lead.weakest_area || ''}</td>
                    <td className="hidden py-2.5 pl-3 sm:table-cell">{lead.when || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[13px]" style={{ color: DIM }}>Yours to keep, exportable anytime.</p>
          </>
        ) : (
          /* Fresh preview board: no real leads yet, so no staged sample row. */
          <div className="rounded-lg px-4 py-6 text-center" style={{ background: PAPER_SUNK, border: `1px dashed ${LINE}` }}>
            <p className="mx-auto max-w-[46ch] text-[13px] leading-relaxed" style={{ color: DIM }}>
              Leads land here the moment someone completes your assessment. Yours to keep, exportable anytime.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Strategy surface ----------
/** One-line job per pillar, used when the board data carries no blurb. */
const PILLAR_JOBS: Record<string, string> = {
  demand: 'Shows buyers what the problem is costing them right now.',
  authority: 'Proves you understand the mechanics better than anyone else they follow.',
  teardown: 'Walks through real numbers so the lesson sticks.',
  proof: 'Client results, told straight.',
  personal: 'The founder behind the work. Keeps the feed human.',
};

function StrategySurface({ board, accent, mint }: { board: Board; accent: string; mint: string }) {
  const strat = board.strategy;
  const [open, setOpen] = useState<string | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [shiftSent, setShiftSent] = useState(false);
  const [note, setNote] = useState('');
  if (!strat) return null;

  const openPillar = strat.pillars.find((p) => p.key === open);
  const queueOf = (key: string) => board.queue.filter((q) => q.pillar === key && (q.stage === 'review' || q.stage === 'drafted'));
  const scheduledOf = (key: string) => (board.calendar?.items || []).filter((it) => it.pillar === key).length;

  return (
    <div>
      <SectionHead eyebrow="This month's mix" title={<>One plan, <Accent>divided on purpose.</Accent></>} sub="Your operator holds the mix; you can request a shift anytime." />

      <div className="rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <CardHead>Your content this month</CardHead>
          <div className="flex items-baseline gap-2">
            <CountUpNum n={strat.total} size={34} />
            <span className="text-[13px] font-medium" style={{ color: DIM }}>posts</span>
          </div>
        </div>

        <div className="flex w-full overflow-hidden rounded-lg" style={{ border: `1px solid ${LINE}` }}>
          {strat.pillars.map((p, i) => (
            <button
              key={p.key}
              onClick={() => setOpen(open === p.key ? null : p.key)}
              className="relative flex min-h-[86px] flex-col items-start justify-center gap-0.5 px-2 py-3 text-left transition-opacity"
              style={{
                flexGrow: p.pct,
                flexBasis: 0,
                minWidth: 58,
                background: `color-mix(in srgb, ${accent} ${TINT_STEPS[i % TINT_STEPS.length]}%, white)`,
                borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.9)' : 'none',
                opacity: open && open !== p.key ? 0.55 : 1,
              }}
            >
              <span className="w-full truncate text-[12px] font-semibold" style={{ color: INK }}>{p.label}</span>
              <CountUpNum n={p.count} size={24} />
              <span className="text-[11px] font-medium" style={{ color: DIM }}>{p.pct}%</span>
            </button>
          ))}
        </div>

        {openPillar && (
          <div className="mt-5 rounded-lg p-4" style={{ background: 'rgba(2,49,47,0.02)', border: `1px solid ${LINE}` }}>
            <div className="text-[14px] font-semibold" style={{ color: INK }}>{openPillar.label}</div>
            {openPillar.blurb && <p className="mt-1 text-[13px] leading-relaxed" style={{ color: DIM }}>{openPillar.blurb}</p>}
            <div className="mt-3 flex flex-col gap-3">
              {queueOf(openPillar.key).map((q) => (
                <div key={q.id} className="rounded-lg bg-white p-3" style={{ border: `1px solid ${LINE}` }}>
                  <div className="text-[13px] font-medium leading-snug" style={{ color: INK }}>{q.hook || q.title}</div>
                  <div className="mt-1 text-[12px]" style={{ color: FAINT }}>{STAGE_META[q.stage].label} · publishes {fmtDay(q.publish_date)}</div>
                </div>
              ))}
            </div>
            {scheduledOf(openPillar.key) > 0 && (
              <p className="mt-3 text-[12px]" style={{ color: FAINT }}>
                + {scheduledOf(openPillar.key)} more {openPillar.label.toLowerCase()} slots scheduled in {strat.period || 'this month'}
              </p>
            )}
          </div>
        )}

        {board.calendar && (() => {
          const t = { post: 0, carousel: 0, lm: 0, newsletter: 0 };
          board.calendar.items.forEach((it) => { if (it.kind in t) (t as any)[it.kind] += 1; });
          const formats = [
            { label: 'Text posts', n: t.post, bg: `color-mix(in srgb, ${accent} 9%, white)` },
            { label: 'Carousels', n: t.carousel, bg: `color-mix(in srgb, ${accent} 17%, white)` },
            { label: 'Lead magnets', n: t.lm, bg: `color-mix(in srgb, ${mint} 15%, white)` },
            { label: 'Newsletters', n: t.newsletter, bg: 'rgba(2,49,47,0.04)' },
          ].filter((f) => f.n > 0);
          return (
            <div className="mt-6">
              <div className="mb-2"><CardHead>Formats this month</CardHead></div>
              <div className="flex w-full overflow-hidden rounded-lg" style={{ border: `1px solid ${LINE}` }}>
                {formats.map((f, i) => (
                  <div
                    key={f.label}
                    className="flex min-h-[56px] flex-col items-start justify-center gap-0 px-2 py-2"
                    style={{ flexGrow: f.n, flexBasis: 0, minWidth: 62, background: f.bg, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.9)' : 'none' }}
                  >
                    <CountUpNum n={f.n} size={18} />
                    <span className="w-full truncate text-[11px] font-semibold" style={{ color: INK }}>{f.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: FAINT }}>
                The format each topic ships in is picked per topic: teardown math wants a carousel, a capture play wants a lead magnet.
              </p>
            </div>
          );
        })()}

      </div>

      {/* Per-pillar breakdown: what each slice of the bar is doing, with a real example. */}
      <div className="mt-6 overflow-hidden rounded-xl bg-white" style={{ border: `1px solid ${LINE}` }}>
        <div className="px-4 pb-1 pt-4 text-[13px] font-semibold sm:px-6" style={{ color: INK }}>What each pillar does</div>
        {strat.pillars.map((p, i) => {
          const example = board.queue.find((q) => q.pillar === p.key && (q.hook || q.title))
            || null;
          const calExample = !example ? (board.calendar?.items || []).find((it) => it.pillar === p.key) : null;
          const exampleTitle = example ? (example.hook || example.title) : calExample?.label;
          return (
            <div key={p.key} className="grid grid-cols-[minmax(96px,130px)_1fr] gap-x-4 px-4 py-3.5 sm:grid-cols-[150px_1fr_44px] sm:px-6" style={{ borderTop: `1px solid ${DIVIDE}` }}>
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: `color-mix(in srgb, ${accent} ${TINT_STEPS[i % TINT_STEPS.length] + 34}%, white)` }} aria-hidden />
                <span className="text-[13.5px] font-semibold" style={{ color: INK }}>{p.label}</span>
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] leading-relaxed" style={{ color: DIM }}>{p.blurb || PILLAR_JOBS[p.key] || 'Part of the monthly mix.'}</span>
                {exampleTitle && (
                  <span className="mt-0.5 block truncate text-[12px]" style={{ color: FAINT }}>e.g. “{exampleTitle}”</span>
                )}
              </span>
              <span className="hidden text-right text-[13px] font-semibold tabular-nums sm:block" style={{ color: DIM }}>{p.pct}%</span>
            </div>
          );
        })}
      </div>

      {/* Voice model: what the drafts are trained on. Sources named, no post counts claimed. */}
      {(() => {
        const domain = (board.domain || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
        const traits: string[] = (board as any).voice?.traits || ['Plain spoken', 'Numbers on the page', 'No hype'];
        return (
          <div className="mt-6 rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
            <div className="mb-1"><CardHead>Voice model</CardHead></div>
            <p className="text-[13.5px] leading-relaxed" style={{ color: DIM }}>
              Every draft is written from a model of how you already sound, then checked against it before it reaches your review.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {traits.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: `color-mix(in srgb, ${accent} 7%, white)`, color: INK }}>
                  <span className="h-[5px] w-[5px] rounded-full" style={{ background: accent, opacity: 0.55 }} aria-hidden />
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[12px]" style={{ color: FAINT }}>
              Sources: {domain ? `${domain} + your LinkedIn posts` : 'your site copy + your LinkedIn posts'}
            </p>
          </div>
        );
      })()}

      {/* Recent shifts: the request loop lives here — client asks, operator decides. */}
      <div className="mt-6 rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
        <div className="mb-3"><CardHead>Recent shifts</CardHead></div>
        {shiftSent ? (
          <p className="text-[13.5px] font-medium" style={{ color: DIM }}>Shift request sent. Your operator reviews every request and replies before the next batch drafts.</p>
        ) : (
          <p className="text-[13.5px] leading-relaxed" style={{ color: DIM }}>No shifts requested yet. The mix is reviewed monthly with your operator.</p>
        )}
        {!shiftSent && (
          <div className="mt-4">
            {!shiftOpen ? (
              <button
                onClick={() => setShiftOpen(true)}
                className="inline-flex min-h-[44px] items-center rounded-[6px] px-4 text-[14px] font-semibold"
                style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
              >
                Request a shift
              </button>
            ) : (
              <div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder='e.g. "More proof posts this month, we just landed two big results."'
                  rows={3}
                  className="w-full rounded-lg p-3 text-[14px] outline-none"
                  style={{ border: `1px solid ${LINE}`, color: INK, background: 'rgba(2,49,47,0.02)' }}
                />
                <button
                  onClick={() => { setShiftSent(true); setShiftOpen(false); }}
                  className="mt-2 inline-flex min-h-[44px] items-center rounded-[6px] px-4 text-[14px] font-semibold"
                  style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
                >
                  Send
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Operator note: why this mix, signed. */}
      <div className="mt-6 rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold" style={{ background: INK, color: '#fff' }} aria-hidden>IM</span>
          <CardHead>Why this mix, from your operator</CardHead>
        </div>
        <p className="text-[14px] leading-relaxed" style={{ color: DIM }}>
          {board.company_name}'s first month is weighted toward demand. Your buyers move when they see what the problem is costing them, so the feed leads with that. Authority ramps as the audience warms, and proof takes a bigger share of the mix as client results come in. We review the weights together every month.
        </p>
        <p className="mt-3 text-[13px] font-medium" style={{ color: INK }}>Ivan Manfredi · Operator</p>
      </div>

      {/* Your plan: the money card. Deliverables derived from THIS board's own calendar,
          so the numbers can never disagree with the rest of the surface. */}
      {(() => {
        const t = { post: 0, carousel: 0, lm: 0, newsletter: 0 };
        (board.calendar?.items || []).forEach((it) => { if (it.kind in t) (t as any)[it.kind] += 1; });
        const ships: string[] = [
          `${t.post + t.carousel} LinkedIn posts, drafted for your approval`,
          ...(t.lm > 0 ? [`${t.lm} lead magnet${t.lm === 1 ? '' : 's'}, live on your domain`] : []),
          ...(t.newsletter > 0 ? [`${t.newsletter} newsletter issue${t.newsletter === 1 ? '' : 's'}`] : []),
          'Captured leads pipeline, exportable anytime',
          'Monthly performance report from your operator',
        ];
        return (
          <div className="mt-6 rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <CardHead>Your plan</CardHead>
                <p className="mt-0.5 text-[13px]" style={{ color: DIM }}>Operator plan</p>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="tabular-nums" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 30, lineHeight: 1.05, color: INK }}>$2,000</span>
                <span className="text-[13px] font-medium" style={{ color: DIM }}>/month</span>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {ships.map((s) => (
                <div key={s} className="flex items-center gap-2.5 text-[13.5px]" style={{ color: INK }}>
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${accent} 16%, white)` }} aria-hidden>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4 10-10" stroke={accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {s}
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] leading-relaxed" style={{ color: DIM }}>
              Month to month. Pause anytime. Your content, your leads, yours to keep.
            </p>
            {/* The kill switch, visible on purpose. Inert in preview. */}
            <div className="mt-4 flex items-center justify-between gap-3 rounded-lg p-3.5" style={{ border: `1px solid ${LINE}`, background: 'rgba(2,49,47,0.02)' }}>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: INK }}>Pause engine</div>
                <div className="mt-0.5 text-[12px] leading-snug" style={{ color: DIM }}>Stops drafting and publishing. Nothing ships while paused.</div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="hidden text-[11px] sm:inline" style={{ color: FAINT }}>Available when live</span>
                <span
                  role="switch"
                  aria-checked={false}
                  aria-disabled
                  title="Available when the engine is live"
                  className="relative inline-flex h-5 w-9 cursor-default items-center rounded-full"
                  style={{ background: 'rgba(2,49,47,0.12)' }}
                >
                  <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white" style={{ boxShadow: '0 1px 2px rgba(2,32,32,0.18)' }} />
                </span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ---------- Newsletter surface ----------
function NewsletterSurface({ board, accent, fontStack, onOpenIssue }: {
  board: Board; accent: string; fontStack: string;
  onOpenIssue: (it: NewsletterIssue) => void;
}) {
  const nl = board.newsletter;
  const [issueOpen, setIssueOpen] = useState(false);
  const reduce = useReducedMotion();
  if (!nl) return null;
  const issues = nl.issues || [];
  const nurture = nl.nurture || [];

  const issueStatus = (it: NewsletterIssue) =>
    stageStatus({ id: it.id, kind: 'newsletter', stage: it.stage === 'scheduled' ? 'scheduled' : 'planned', publish_date: it.date }, it.stage === 'scheduled' ? 'scheduled' : 'planned', board.calendar?.start);

  return (
    <div>
      <SectionHead
        eyebrow="Weekly to your list"
        title={<>Your newsletter, <Accent>in your voice.</Accent></>}
        sub="One issue a week, drafted from the same voice model as your posts. Every lead your assessments capture gets it."
      />

      {/* Hero: memo identity next to an inbox preview of the next issue. */}
      {(() => {
        const founderName = board.founder?.name || board.company_name;
        const initials = founderName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
        const first = issues[0];
        const linked = first?.ref ? board.queue.find((q) => q.id === first.ref) : null;
        const fullBody = first?.body || '';
        const snippet = fullBody || linked?.body || 'The draft lands here the Sunday before it sends, written from the same voice model as your posts.';
        return (
          <div className="grid gap-5 rounded-xl bg-white p-5 sm:p-6 lg:grid-cols-[minmax(220px,1fr)_1.25fr] lg:items-center" style={{ border: `1px solid ${LINE}` }}>
            <div>
              <div className="text-[24px] font-semibold leading-tight tracking-tight" style={{ fontFamily: fontStack, color: INK }}>{nl.name}</div>
              <div className="mt-2.5 flex flex-col gap-1.5 text-[13px]" style={{ color: DIM }}>
                {nl.cadence && <span>{nl.cadence}</span>}
                {nl.from_domain && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-[5px] w-[5px] rounded-full" style={{ background: accent, opacity: 0.55 }} aria-hidden />
                    Sends from {nl.from_domain}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-[5px] w-[5px] rounded-full" style={{ background: accent, opacity: 0.55 }} aria-hidden />
                  Written in your voice, approved by you
                </span>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl bg-white" style={{ border: `1px solid ${LINE}` }}>
              <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ borderBottom: `1px solid ${DIVIDE}`, background: 'rgba(2,49,47,0.02)' }}>
                {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: 'rgba(2,49,47,0.10)' }} aria-hidden />)}
                <span className="ml-2 text-[11px] font-medium" style={{ color: FAINT }}>Inbox · next issue</span>
              </div>
              <div className="p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: accent, color: inkOn(accent) }} aria-hidden>{initials}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold" style={{ color: INK }}>{founderName} · {nl.name}</span>
                    <span className="block text-[11.5px]" style={{ color: FAINT }}>to your subscribers</span>
                  </span>
                  {first && <span className="ml-auto shrink-0 text-[11.5px] tabular-nums" style={{ color: FAINT }}>{fmtDay(first.date)}</span>}
                </div>
                <div className="mt-3 text-[15px] font-semibold leading-snug" style={{ fontFamily: fontStack, color: INK }}>{first?.title || 'Your first issue'}</div>
                {!issueOpen && (
                  <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: DIM, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {snippet}
                  </p>
                )}
                {/* Issue 1 carries a full readable draft — expandable in place. */}
                <AnimatePresence initial={false}>
                  {issueOpen && fullBody && (
                    <motion.div
                      initial={reduce ? false : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={reduce ? undefined : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 max-w-[62ch] border-t pt-3" style={{ borderColor: DIVIDE }}>
                        {fullBody.split(/\n\n+/).map((p, i) => (
                          <p key={i} className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed first:mt-0" style={{ color: '#2b3736' }}>{p}</p>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {fullBody && (
                  <button
                    onClick={() => setIssueOpen((o) => !o)}
                    className="mt-2.5 inline-flex min-h-[32px] items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] font-semibold transition-colors duration-150 hover:bg-[rgba(2,49,47,0.04)]"
                    style={{ color: accent }}
                    aria-expanded={issueOpen}
                  >
                    {issueOpen ? 'Show less' : 'Read the full issue'}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden style={{ transform: issueOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>
                      <path d="M6 9l6 6 6-6" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Issues */}
      <div className="mb-2 mt-6 px-1 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: FAINT }}>Upcoming issues</div>
      <div className="overflow-hidden rounded-xl bg-white" style={{ border: `1px solid ${LINE}` }}>
        {issues.map((it, i) => (
          <button
            key={it.id}
            onClick={() => onOpenIssue(it)}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--cb-accent)_2.5%,white)]"
            style={{ borderTop: i > 0 ? `1px solid ${DIVIDE}` : 'none', minHeight: 54 }}
          >
            <Thumb q={{ id: it.id, kind: 'newsletter', stage: 'planned' }} accent={accent} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium" style={{ color: INK }}>{it.title}</span>
              <span className="mt-0.5 block text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>Newsletter</span>
            </span>
            <span className="hidden shrink-0 text-right sm:block">{issueStatus(it)}</span>
          </button>
        ))}
      </div>

      {/* Nurture flow */}
      {nurture.length > 0 && (
        <div className="mt-6 rounded-xl bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}` }}>
          <div className="mb-4"><CardHead>Inbound leads flow</CardHead></div>
          <div className="flex flex-col sm:flex-row">
            {nurture.map((s, i) => {
              const last = i === nurture.length - 1;
              return (
                <div key={i} className="relative flex gap-3 pb-6 last:pb-0 sm:flex-1 sm:flex-col sm:gap-2.5 sm:pb-0 sm:pr-4 sm:last:pr-0">
                  {i < nurture.length - 1 && (
                    <>
                      <span className="absolute bottom-0 left-[9px] top-6 w-px sm:hidden" style={{ background: LINE }} aria-hidden />
                      <span className="absolute hidden h-px sm:block" style={{ background: LINE, top: 10, left: 28, right: 8 }} aria-hidden />
                    </>
                  )}
                  <span
                    className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={last ? { background: accent } : { background: `color-mix(in srgb, ${accent} 16%, white)` }}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                      <path d="M5 13l4 4 10-10" stroke={last ? inkOn(accent) : accent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-snug" style={{ color: last ? accent : INK }}>{s.step}</div>
                    {s.detail && <div className="mt-0.5 text-[12px] leading-snug" style={{ color: DIM }}>{s.detail}</div>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-[13px]" style={{ color: FAINT }}>
            Leads captured by your assessments feed this list automatically. Yours to keep, exportable anytime.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- Performance surface ----------
/** Dashed placeholder sparkline paths — clearly not data, just the shape of the chart to come. */
const PLACEHOLDER_SPARKS = [
  'M0 34 C 20 31, 34 25, 52 27 S 92 33, 112 27 S 152 15, 170 19 S 192 13, 200 11',
  'M0 30 C 18 33, 36 27, 54 29 S 90 21, 112 24 S 150 18, 168 14 S 190 14, 200 12',
  'M0 36 C 22 32, 38 30, 56 31 S 94 25, 114 27 S 148 17, 168 20 S 192 10, 200 12',
  'M0 32 C 20 34, 36 28, 54 26 S 92 30, 112 24 S 150 20, 170 15 S 192 15, 200 10',
];

/** Honest expectation line per indicator — when the number typically starts moving. */
function expectationFor(ind: PerfIndicator): string {
  const l = `${ind.key} ${ind.label}`.toLowerCase();
  if (l.includes('view')) return 'Profile views usually move within the first week of posting.';
  if (l.includes('dm')) return 'First inbound DMs typically show in weeks 2 to 3.';
  if (l.includes('opt') || l.includes('magnet')) return 'Opt-ins start as soon as your first lead magnet goes live.';
  if (l.includes('call')) return 'Booked calls follow opt-ins, typically from week 3 on.';
  return 'Tracking starts the day the engine goes live.';
}

// ---------- Leads (engager DM pipeline) ----------
type PipelineStep = { key: string; label: string; done: boolean; current?: boolean };
/** One message in a lead's thread. `from:'lead'` = something they wrote (comment / reply);
 *  `from:'engine'` = a message the pipeline sent (resource DM, follow-up). */
type ThreadMsg = { from: 'lead' | 'engine'; label: string; when?: string; text: string };
type PipelineLead = {
  name: string; role?: string; company?: string; icp: number;
  track: 'handraiser' | 'reactor';
  source: 'comment' | 'optin' | 'like';
  steps: PipelineStep[];
  in_newsletter?: boolean;
  last_touch?: string; next_action?: string;
  /** The actual conversation — powers the click-a-lead reveal. */
  thread?: ThreadMsg[];
};

/** Build a step trail from ordered labels + the index the lead has reached. Steps before
 *  the reached index are done; the reached step is current (filled + ring). */
function mkSteps(labels: string[], reached: number): PipelineStep[] {
  return labels.map((label, i) => ({
    key: `${i}-${label}`.toLowerCase().replace(/\s+/g, '-'),
    label,
    done: i < reached,
    current: i === reached,
  }));
}
const HR_STEPS = (first: string) => [first, 'resource sent', 'follow-up', 'replied'];
const RE_STEPS = ['ICP match', 'connect sent', 'connected', 'DM sent', 'follow-up', 'replied'];

/** LABELED example deck — only ever rendered on a demo/preview board, behind the
 *  "example data" chip. A live board renders board.lead_pipeline or a clean empty-state. */
const SAMPLE_LEAD_PIPELINE: PipelineLead[] = [
  { name: 'Marcus Webb', role: 'Founder', company: 'Northbeam Studio', icp: 9, track: 'handraiser', source: 'comment', in_newsletter: true, steps: mkSteps(HR_STEPS('commented'), 3), thread: [
    { from: 'lead', label: 'commented on your post', when: 'day 0', text: 'This is exactly the problem we keep hitting. Can you send it over?' },
    { from: 'engine', label: 'resource DM', when: 'day 0', text: 'Hey Marcus, here’s the teardown you asked for: [link]. The section on hand-off gaps is the part most teams miss. Happy to walk you through how it maps to Northbeam if useful.' },
    { from: 'engine', label: 'follow-up', when: 'day 2', text: 'Did the framework land? Curious whether the scoring section matched what you’re seeing on your side.' },
    { from: 'lead', label: 'replied', when: 'day 3', text: 'It did, the scoring part especially. We should talk. What does working together look like?' },
  ] },
  { name: 'Dana Okafor', role: 'Head of Ops', company: 'Litmus Legal', icp: 8, track: 'handraiser', source: 'optin', in_newsletter: true, steps: mkSteps(HR_STEPS('opted in'), 2), thread: [
    { from: 'lead', label: 'opted in', when: 'day 0', text: 'Downloaded the assessment.' },
    { from: 'engine', label: 'resource DM', when: 'day 0', text: 'Hi Dana, sent the assessment to your inbox. Question 4 is the one that trips up most ops leads. Let me know what it flagged for you.' },
    { from: 'engine', label: 'follow-up', when: 'day 2', text: 'Any surprises in the results? Happy to unpack the weakest-area section with you.' },
  ] },
  { name: 'Priya Nair', role: 'Managing Partner', company: 'Cedar & Vale', icp: 8, track: 'handraiser', source: 'comment', in_newsletter: true, steps: mkSteps(HR_STEPS('commented'), 2), thread: [
    { from: 'lead', label: 'commented on your post', when: 'day 0', text: 'Would love a copy of this.' },
    { from: 'engine', label: 'resource DM', when: 'day 0', text: 'Here you go, Priya: [link]. The part on partner-level workflows is written for firms like Cedar & Vale.' },
    { from: 'engine', label: 'follow-up', when: 'day 3', text: 'Did it spark anything? Glad to compare notes on how partners are handling this.' },
  ] },
  { name: 'Tom Reilly', role: 'Founder', company: 'Reilly Advisory', icp: 7, track: 'handraiser', source: 'optin', in_newsletter: true, steps: mkSteps(HR_STEPS('opted in'), 1), thread: [
    { from: 'lead', label: 'opted in', when: 'day 0', text: 'Downloaded the guide.' },
    { from: 'engine', label: 'resource DM', when: 'day 0', text: 'Hi Tom, the guide’s in your inbox. Start with the second half, that’s where the ROI math is. Shout if anything’s unclear.' },
  ] },
  { name: 'Grace Lin', role: 'Ops Lead', company: 'Vantage Group', icp: 8, track: 'handraiser', source: 'comment', steps: mkSteps(HR_STEPS('commented'), 0), thread: [
    { from: 'lead', label: 'commented on your post', when: 'just now', text: 'Sounds useful, send it my way?' },
  ] },
  { name: 'Elena Vasquez', role: 'VP Marketing', company: 'Summit Partners', icp: 9, track: 'reactor', source: 'like', steps: mkSteps(RE_STEPS, 5), thread: [
    { from: 'engine', label: 'connection note', when: 'day 0', text: 'Hi Elena, saw you following the thread on attribution. Sending a connect, I think what we’re building is right up Summit’s alley.' },
    { from: 'engine', label: 'DM', when: 'day 1', text: 'Thanks for connecting. Put together a short teardown on the exact problem you were reacting to, want me to send it?' },
    { from: 'lead', label: 'replied', when: 'day 2', text: 'Yes please. And if you have time this week, I’d take a call.' },
  ] },
  { name: 'Sarah Chen', role: 'Head of Growth', company: 'Fathom Consulting', icp: 9, track: 'reactor', source: 'like', steps: mkSteps(RE_STEPS, 4), thread: [
    { from: 'engine', label: 'connection note', when: 'day 0', text: 'Hi Sarah, noticed you engaging with the growth-systems posts. Connecting, I think there’s overlap with what Fathom’s working on.' },
    { from: 'engine', label: 'DM', when: 'day 1', text: 'Thanks for the connect. Made a quick breakdown of the workflow you reacted to, sending it over: [link].' },
    { from: 'engine', label: 'follow-up', when: 'day 3', text: 'Did the breakdown help? Happy to tailor the second half to Fathom’s stack.' },
  ] },
  { name: 'Nina Alvarez', role: 'Director', company: 'BrightPath Agency', icp: 8, track: 'reactor', source: 'like', steps: mkSteps(RE_STEPS, 3), thread: [
    { from: 'engine', label: 'connection note', when: 'day 0', text: 'Hi Nina, saw you reacting to the agency-ops thread. Sending a connect.' },
    { from: 'engine', label: 'DM', when: 'day 1', text: 'Thanks for connecting. The thing you reacted to, I wrote up how it plays out for agencies like BrightPath. Want it?' },
  ] },
  { name: 'Devon Clarke', role: 'Principal', company: 'Clarke & Co', icp: 7, track: 'reactor', source: 'like', steps: mkSteps(RE_STEPS, 2), thread: [
    { from: 'engine', label: 'connection note', when: 'day 0', text: 'Hi Devon, noticed you following the thread. Connecting, I think there’s a fit with how Clarke & Co runs.' },
  ] },
  { name: 'Raj Patel', role: 'Founder', company: 'Meridian Ops', icp: 7, track: 'reactor', source: 'like', steps: mkSteps(RE_STEPS, 0) },
];

const stepFilled = (s: PipelineStep) => s.done || !!s.current;
const isReplied = (s: PipelineStep) => /replied/i.test(s.label) && stepFilled(s);

/** One person's journey as an ordered trail of sharp-square markers + mono labels.
 *  Shared by the row and the detail modal. */
function StepTrail({ steps, accent }: { steps: PipelineStep[]; accent: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {steps.map((s) => {
        const filled = stepFilled(s);
        return (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              style={{
                width: 7, height: 7,
                background: filled ? caText(accent) : 'transparent',
                border: filled ? 'none' : `1px solid ${LINE_BOLD}`,
                boxShadow: s.current ? `0 0 0 3px ${caWash(accent, 22)}` : undefined,
              }}
            />
            <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: s.current ? caText(accent) : s.done ? INK_SOFT : FAINT }}>{s.label}</span>
          </span>
        );
      })}
    </div>
  );
}

/** A clickable lead row. Opens the detail modal with the full message thread. */
function LeadRow({ lead, accent, onOpen }: { lead: PipelineLead; accent: string; onOpen: (l: PipelineLead) => void }) {
  return (
    <button
      onClick={() => onOpen(lead)}
      aria-label={`Open ${lead.name}`}
      className="group -mx-3 block w-full rounded-lg px-3 py-4 text-left transition-colors duration-150 hover:bg-[rgba(26,26,26,0.03)]"
      style={{ borderTop: `1px solid ${DIVIDE}` }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span style={{ fontFamily: SERIF, fontSize: 17, color: INK }}>{lead.name}</span>
        <span style={{ fontFamily: BODY, fontSize: 13, color: DIM }}>{[lead.role, lead.company].filter(Boolean).join(' · ')}</span>
        <span className="ml-auto flex items-center gap-2.5">
          {lead.in_newsletter && (
            <span className="inline-flex items-center gap-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: INK_MUTE }}>
              <span style={{ width: 6, height: 6, background: caText(accent) }} />newsletter
            </span>
          )}
          <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.04em', color: caText(accent), border: `1px solid ${caBorder(accent, 40)}`, background: caWash(accent, 6), padding: '2px 6px' }}>ICP {lead.icp}</span>
          {/* Affordance: chevron nudges right on hover so rows read as openable. */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={FAINT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </div>
      <div className="mt-2.5">
        <StepTrail steps={lead.steps} accent={accent} />
      </div>
    </button>
  );
}

function LeadsSurface({ board, accent, preview, onOpen }: { board: Board; accent: string; preview: boolean; onOpen: (l: PipelineLead) => void }) {
  const real = board.lead_pipeline && board.lead_pipeline.length > 0 ? board.lead_pipeline : null;
  const usingSample = !real && preview;
  const leads: PipelineLead[] = real ?? (usingSample ? SAMPLE_LEAD_PIPELINE : []);

  const captured = leads.length;
  const contacted = leads.filter((l) => l.steps.some((s, i) => i > 0 && stepFilled(s))).length;
  const replied = leads.filter((l) => l.steps.some(isReplied)).length;
  const onNewsletter = leads.filter((l) => l.in_newsletter).length;

  const handRaisers = leads.filter((l) => l.track === 'handraiser');
  const reactors = leads.filter((l) => l.track === 'reactor');

  const tiles = [
    { n: captured, l: 'captured' },
    { n: contacted, l: 'contacted' },
    { n: replied, l: 'replied' },
    { n: onNewsletter, l: 'on newsletter' },
  ];

  return (
    <div className="pb-16">
      <div className="mb-7">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>capture → pipeline</span>
          {usingSample && (
            <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: caText(accent), border: `1px solid ${caBorder(accent, 40)}`, background: caWash(accent, 6), padding: '2px 6px' }}>example data</span>
          )}
        </div>
        <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(29px, 3.4vw, 40px)', lineHeight: 1.06, letterSpacing: '-0.02em', color: INK }}>Leads</h2>
        <p className="mt-3.5 max-w-[62ch]" style={{ fontFamily: BODY, fontSize: 15, lineHeight: 1.62, color: INK_SOFT }}>
          {usingSample
            ? 'Everyone your content pulled in, and where each person sits in the pipeline. These are example leads — real named people land here the moment your engine goes live.'
            : 'Everyone your content pulled in, and where each person sits in the pipeline. Yours to keep, exportable anytime.'}
        </p>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-xl px-4 py-10 text-center" style={{ background: PAPER_SUNK, border: `1px dashed ${LINE}` }}>
          <p className="mx-auto max-w-[54ch] text-[13px] leading-relaxed" style={{ color: DIM }}>
            Every ICP-matched person who engages your content lands here. Hand-raisers get the resource and a follow-up; high-fit reactors get a connection request and a DM. Yours to keep.
          </p>
        </div>
      ) : (
        <>
          {/* Hairline-gap grid: 1px cell gaps over a line-colored bg read as clean dividers
           *  in both the 4-col desktop row and the 2-col mobile wrap — no per-cell borders. */}
          <div className="mb-9 grid grid-cols-2 gap-px overflow-hidden rounded-xl sm:grid-cols-4" style={{ background: LINE, border: `1px solid ${LINE}` }}>
            {tiles.map((m) => (
              <div key={m.l} className="bg-white px-5 py-4">
                <div style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1, color: INK }}>{m.n}</div>
                <div className="mt-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', color: INK_MUTE }}>{m.l}</div>
              </div>
            ))}
          </div>

          {handRaisers.length > 0 && (
            <section className="mb-9">
              <div className="mb-1 flex items-baseline gap-2.5 border-b pb-2" style={{ borderColor: LINE_BOLD }}>
                <span className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: INK }}>hand-raisers</span>
                <span className="tabular-nums" style={{ fontFamily: MONO, fontSize: 11, color: caText(accent) }}>{handRaisers.length}</span>
                <span style={{ fontFamily: BODY, fontSize: 12.5, color: FAINT }}>commented or opted in — they asked for it</span>
              </div>
              {handRaisers.map((l) => <LeadRow key={l.name} lead={l} accent={accent} onOpen={onOpen} />)}
            </section>
          )}

          {reactors.length > 0 && (
            <section>
              <div className="mb-1 flex items-baseline gap-2.5 border-b pb-2" style={{ borderColor: LINE_BOLD }}>
                <span className="uppercase" style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', color: INK }}>ICP reactors</span>
                <span className="tabular-nums" style={{ fontFamily: MONO, fontSize: 11, color: caText(accent) }}>{reactors.length}</span>
                <span style={{ fontFamily: BODY, fontSize: 12.5, color: FAINT }}>engaged your post — we reached out</span>
              </div>
              {reactors.map((l) => <LeadRow key={l.name} lead={l} accent={accent} onOpen={onOpen} />)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/** Click-a-lead reveal: the person's journey + the actual message thread the pipeline
 *  ran. Engine-sent messages carry the accent rule; the lead's own words stay neutral. */
function LeadDetailModal({ lead, accent, onClose }: { lead: PipelineLead; accent: string; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const first = (lead.name.split(/\s+/)[0]) || lead.name;
  const trackLabel = lead.track === 'handraiser' ? 'hand-raiser' : 'ICP reactor';
  const thread = lead.thread || [];
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative mx-auto my-0 flex min-h-full w-full max-w-lg flex-col bg-white sm:my-16 sm:min-h-0 sm:rounded-xl" style={{ boxShadow: '0 30px 80px rgba(2,32,32,.32)' }}>
        <div className="flex items-center gap-2.5 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: INK_MUTE }}>Lead</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: caText(accent) }}>{trackLabel}</span>
          <button onClick={onClose} aria-label="Close" className="ml-auto flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[rgba(2,49,47,0.05)]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke={DIM} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-5 pb-6 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 style={{ fontFamily: SERIF, fontSize: 25, lineHeight: 1.14, letterSpacing: '-0.01em', color: INK }}>{lead.name}</h3>
            <span style={{ fontFamily: BODY, fontSize: 13.5, color: DIM }}>{[lead.role, lead.company].filter(Boolean).join(' · ')}</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2.5">
            <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: '0.04em', color: caText(accent), border: `1px solid ${caBorder(accent, 40)}`, background: caWash(accent, 6), padding: '2px 6px' }}>ICP {lead.icp}</span>
            {lead.in_newsletter && (
              <span className="inline-flex items-center gap-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: INK_MUTE }}>
                <span style={{ width: 6, height: 6, background: caText(accent) }} />newsletter
              </span>
            )}
          </div>

          <div className="mt-5">
            <StepTrail steps={lead.steps} accent={accent} />
          </div>

          <div className="mt-6 border-t pt-5" style={{ borderColor: DIVIDE }}>
            {thread.length > 0 ? (
              <>
                <div className="mb-4 uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.16em', color: INK_MUTE }}>the conversation</div>
                <div className="flex flex-col gap-4">
                  {thread.map((m, i) => {
                    const isEngine = m.from === 'engine';
                    return (
                      <div key={i} className="relative pl-4">
                        <span className="absolute bottom-1 left-0 top-1" style={{ width: 2, background: isEngine ? caText(accent) : LINE_BOLD }} aria-hidden />
                        <div className="flex items-center gap-1.5">
                          {isEngine && <span style={{ width: 6, height: 6, background: caText(accent) }} aria-hidden />}
                          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.13em', color: isEngine ? caText(accent) : INK_MUTE }}>
                            {isEngine ? `sent · ${m.label}` : `${first} · ${m.label}`}{m.when ? ` · ${m.when}` : ''}
                          </span>
                        </div>
                        <p className="mt-1.5" style={{ fontFamily: BODY, fontSize: 14, lineHeight: 1.6, color: INK_SOFT }}>{m.text}</p>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-5 text-[12px] leading-relaxed" style={{ fontFamily: BODY, color: FAINT }}>
                  Every message marked <span style={{ color: caText(accent) }}>sent</span> went out automatically. You approve the first send; after that the engine runs the cadence.
                </p>
              </>
            ) : (
              <div className="rounded-[10px] p-4" style={{ background: PAPER_SUNK, border: `1px solid ${LINE}` }}>
                <p style={{ fontFamily: BODY, fontSize: 13.5, lineHeight: 1.6, color: INK_SOFT }}>
                  {first} just entered the pipeline. The conversation shows up here as the engine reaches out, and you approve the first send.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PerformanceSurface({ board, accent }: { board: Board; accent: string }) {
  const perf = board.performance;
  const updates = board.engine_updates || [];
  const indicators = perf?.indicators || [];
  return (
    <div>
      <SectionHead
        eyebrow="What we track"
        title={<>The numbers, <Accent>told straight.</Accent></>}
        sub={perf?.note || 'The leading indicators your retainer is measured on. No invented charts: real series appear the day the engine goes live.'}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {indicators.map((ind, i) => (
          <div key={ind.key} className="rounded-xl bg-white p-4 sm:p-5" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[13.5px] font-semibold leading-snug" style={{ color: INK }}>{ind.label}</div>
              {ind.source && <div className="shrink-0 text-[11px]" style={{ color: FAINT }}>from {ind.source}</div>}
            </div>
            {/* Ghost numeral: shows what WILL live here — unmistakably a placeholder. */}
            <div className="mt-2 select-none" style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 28, lineHeight: 1, color: '#e2e8f0' }} aria-hidden>—</div>
            <svg viewBox="0 0 200 44" className="mt-3 h-11 w-full" preserveAspectRatio="none" aria-hidden>
              <path
                d={PLACEHOLDER_SPARKS[i % PLACEHOLDER_SPARKS.length]}
                fill="none" stroke="#c9d3d1" strokeWidth="1.6" strokeDasharray="3.5 5" strokeLinecap="round"
              />
              <line x1="0" y1="43" x2="200" y2="43" stroke="rgba(2,49,47,0.06)" strokeWidth="1.5" />
            </svg>
            <div className="mt-2 text-[10px] uppercase tracking-[0.1em]" style={{ fontFamily: MONO, color: FAINT }}>No data yet</div>
            <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: DIM }}>{expectationFor(ind)}</p>
          </div>
        ))}
      </div>

      {updates.length > 0 && (
        <div className="mt-6 rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
          <div className="mb-1"><CardHead>Engine updates</CardHead></div>
          <p className="mb-3 text-[13px]" style={{ color: DIM }}>The engine keeps improving; every upgrade ships to your account automatically.</p>
          <div className="flex flex-col">
            {updates.map((u, i) => (
              <div key={i} className="flex items-baseline gap-3 py-2.5" style={{ borderTop: i > 0 ? `1px solid ${DIVIDE}` : 'none' }}>
                <span className="w-24 shrink-0 text-[12px] tabular-nums" style={{ color: FAINT }}>{fmtDay(u.date)}</span>
                <span className="text-[13.5px] leading-snug" style={{ color: INK }}>{u.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- page ----------
// One vocabulary on every viewport: mobile shows the same words, sized down, never renamed.
const TABS = [
  { id: 'week', label: 'This week', group: 'Content' },
  { id: 'review', label: 'All content', group: 'Content' },
  { id: 'calendar', label: 'Calendar', group: 'Content' },
  { id: 'lm', label: 'Lead magnets', group: 'Content' },
  { id: 'newsletter', label: 'Newsletter', group: 'Content' },
  { id: 'leads', label: 'Leads', group: 'Reports' },
  { id: 'performance', label: 'Performance', group: 'Reports' },
  { id: 'strategy', label: 'Strategy', group: 'Reports' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const NAV_GROUPS = ['Content', 'Reports'] as const;

/** 16px stroke icons for the nav (feather register, 1.8 stroke). */
const NAV_ICON_PATHS: Record<TabId, React.ReactNode> = {
  week: (
    <>
      <path d="M10 6.5h10.5M10 12h10.5M10 17.5h10.5" />
      <path d="m3.5 5.75 1.25 1.25 2.25-2.5M3.5 11.25 4.75 12.5 7 10M3.5 16.75 4.75 18 7 15.5" />
    </>
  ),
  review: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M15 13H9M15 17H9" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3.5 11h17" />
    </>
  ),
  lm: <path d="M13 2 4.5 13.5H11l-1.5 8.5L18 10.5h-6.5L13 2z" />,
  newsletter: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  leads: <path d="M3.5 5.5h17l-6.5 7.7v5.6l-4 2v-7.6z" />,
  performance: <path d="M18 20V10M12 20V4M6 20v-6" />,
  strategy: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m15.8 8.2-2 5.6-5.6 2 2-5.6 5.6-2z" />
    </>
  ),
};

function NavIcon({ id, size = 16 }: { id: TabId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      {NAV_ICON_PATHS[id]}
    </svg>
  );
}

/** Two-letter initials off a display name. */
function initialsOf(name?: string): string {
  return (name || '').split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '·';
}

/** Layout-shaped loading skeleton: sidebar + topbar + rows, one 1.4s sheen sweep.
 *  Unmounts (killing the animation) the moment board data lands. */
function BoardSkeleton() {
  const sheen: React.CSSProperties = {
    borderRadius: 6,
    background: 'linear-gradient(90deg, rgba(2,49,47,0.05) 25%, rgba(2,49,47,0.10) 50%, rgba(2,49,47,0.05) 75%)',
    backgroundSize: '200% 100%',
    animation: 'cb-sheen 1.4s linear infinite',
  };
  const bar = (w: number | string, h = 12): React.CSSProperties => ({ ...sheen, width: w, height: h });
  return (
    <div className="min-h-screen" style={{ background: FRAME_BG }} aria-busy="true" aria-label="Loading your board">
      <style>{`@keyframes cb-sheen { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .cb-skel [style*="cb-sheen"] { animation: none !important; } }`}</style>
      <div className="cb-skel">
        <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col lg:flex">
          <div className="px-5 pb-5 pt-5">
            <div style={bar(120, 26)} />
            <div className="mt-3" style={bar(88, 9)} />
          </div>
          <div className="flex flex-col gap-2.5 px-6 pt-2">
            {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} style={bar(i % 2 ? 132 : 112, 13)} />)}
          </div>
        </aside>
        <div className="lg:ml-60 lg:py-2 lg:pr-2">
          <div className="min-h-screen bg-white lg:min-h-[calc(100vh-16px)] lg:rounded-xl" style={{ boxShadow: CARD_SHADOW }}>
            <div className="flex h-14 items-center gap-3 px-4 sm:px-8" style={{ borderBottom: `1px solid ${DIVIDE}` }}>
              <div style={bar(110, 12)} />
              <div className="ml-auto" style={{ ...bar(84, 22), borderRadius: 999 }} />
            </div>
            <div className="max-w-[880px] px-4 pt-8 sm:px-6 lg:px-8">
              <div style={bar(200, 20)} />
              <div className="mt-3" style={bar('62%', 12)} />
              <div className="mt-8 overflow-hidden rounded-xl" style={{ border: `1px solid ${LINE}` }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i > 0 ? `1px solid ${DIVIDE}` : 'none', minHeight: 56 }}>
                    <div style={{ ...bar(56, 40), borderRadius: 6 }} />
                    <div className="flex-1">
                      <div style={bar(i % 2 ? '52%' : '64%', 12)} />
                      <div className="mt-2" style={bar(64, 8)} />
                    </div>
                    <div className="hidden sm:block" style={bar(90, 12)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClientBoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const token = params.get('k') || '';
  // ?intro=1 force-replays the opening choreography (clears the played flag before the fetch).
  const forceIntro = params.get('intro') === '1';
  const introKey = `cb-intro-${slug || ''}`;
  const approvalsKey = `cb-approvals-${slug || ''}`;
  const [board, setBoard] = useState<Board | null>(null);
  const [mode, setMode] = useState<string>('demo');
  const [state, setState] = useState<'loading' | 'ready' | 'invalid' | 'generating' | 'failed'>('loading');
  // Company name for the pre-render states (generating / failed): the placeholder row
  // carries it before the full board jsonb exists, so the building screen can name it.
  const [pendingCompany, setPendingCompany] = useState<string>('');
  const [tab, setTab] = useState<TabId>('week');
  const [detail, setDetail] = useState<QueueItem | null>(null);
  const [detailChanging, setDetailChanging] = useState(false);
  // Ideas are not approvable yet — they open a lightweight preview, kept separate from the
  // full DetailModal approve flow.
  const [ideaPreview, setIdeaPreview] = useState<Idea | null>(null);
  const [leadDetail, setLeadDetail] = useState<PipelineLead | null>(null);
  // Demo interaction state survives a reload: approvals persist per-slug.
  const [stageOverride, setStageOverride] = useState<Record<string, Stage>>(() => {
    try {
      const raw = localStorage.getItem(`cb-approvals-${slug || ''}`);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(approvalsKey, JSON.stringify(stageOverride)); } catch { /* private mode */ }
  }, [stageOverride, approvalsKey]);
  // Week-home decisions persist the same way: chosen alternate angles + skipped days.
  const anglesKey = `cb-angles-${slug || ''}`;
  const skipsKey = `cb-skips-${slug || ''}`;
  const [angleSwaps, setAngleSwaps] = useState<Record<string, AltAngle>>(() => {
    try { const raw = localStorage.getItem(`cb-angles-${slug || ''}`); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(anglesKey, JSON.stringify(angleSwaps)); } catch { /* private mode */ }
  }, [angleSwaps, anglesKey]);
  const [weekSkips, setWeekSkips] = useState<Record<string, true>>(() => {
    try { const raw = localStorage.getItem(`cb-skips-${slug || ''}`); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(skipsKey, JSON.stringify(weekSkips)); } catch { /* private mode */ }
  }, [weekSkips, skipsKey]);
  const [flashId, setFlashId] = useState<string | null>(null);
  // Content view lives up here so the page can widen the container for the kanban.
  const [contentView, setContentViewState] = useState<ContentView>(() => {
    try {
      const v = localStorage.getItem('client-board-view');
      return v === 'board' || v === 'feed' ? v : 'list';
    } catch { return 'list'; }
  });
  const setContentView = (v: ContentView) => {
    setContentViewState(v);
    try { localStorage.setItem('client-board-view', v); } catch { /* private mode */ }
  };
  const reduceMotion = useReducedMotion();
  const introRan = useRef(false);
  const flashTimer = useRef<number>(0);
  const introTimers = useRef<number[]>([]);
  // Undo window after an action: toast with Z / click to restore the row.
  const [undo, setUndo] = useState<{ id: string; kind: 'approve' | 'angle' | 'skip' } | null>(null);
  const undoTimer = useRef<number>(0);
  useEffect(() => () => { introTimers.current.forEach((t) => window.clearTimeout(t)); window.clearTimeout(flashTimer.current); window.clearTimeout(undoTimer.current); }, []);

  const flash = (id: string) => {
    setFlashId(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1500);
  };

  // Optimistic actions + undo window. Defined above the early returns so the
  // Z-key effect keeps a stable hook order across loading states.
  const armUndo = (id: string, kind: 'approve' | 'angle' | 'skip') => {
    setUndo({ id, kind });
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), 6000);
  };
  const approve = (id: string) => {
    setStageOverride((s) => ({ ...s, [id]: 'scheduled' }));
    flash(id);
    armUndo(id, 'approve');
  };
  const pickAngle = (id: string, alt: AltAngle) => {
    setAngleSwaps((s) => ({ ...s, [id]: alt }));
    flash(id);
    armUndo(id, 'angle');
  };
  const skipDay = (id: string) => {
    setWeekSkips((s) => ({ ...s, [id]: true as const }));
    armUndo(id, 'skip');
  };
  const unskipDay = (id: string) => {
    setWeekSkips((s) => { const { [id]: _drop, ...rest } = s; return rest; });
  };
  const undoApprove = () => {
    window.clearTimeout(undoTimer.current);
    setUndo((u) => {
      if (u) {
        if (u.kind === 'approve') setStageOverride((s) => { const { [u.id]: _drop, ...rest } = s; return rest; });
        else if (u.kind === 'angle') setAngleSwaps((s) => { const { [u.id]: _drop, ...rest } = s; return rest; });
        else setWeekSkips((s) => { const { [u.id]: _drop, ...rest } = s; return rest; });
        flash(u.id);
      }
      return null;
    });
  };
  // Z restores the last approve while the toast is up.
  useEffect(() => {
    if (!undo) return;
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); undoApprove(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo]);

  // E1 — opening choreography (once per browser): the "Generating…" draft finishes its
  // remaining agent steps live, then travels up into "Your review". Local state theater
  // with honest verbs — the same steps the engine actually runs, no fabricated metrics.
  useEffect(() => {
    // The intro now targets the week HOME (the finishing card lands in its day slot);
    // it also runs from All content so ?intro=1 replays work from either surface.
    if (state !== 'ready' || !board || (tab !== 'week' && tab !== 'review') || introRan.current || reduceMotion) return;
    try { if (localStorage.getItem(introKey)) return; } catch { return; }
    const d1 = board.queue.find((q) => q.id === 'd1' && q.generating);
    if (!d1) return;
    introRan.current = true;

    const patch = (fn: (q: QueueItem) => QueueItem) =>
      setBoard((prev) => prev ? { ...prev, queue: prev.queue.map((q) => (q.id === 'd1' ? fn({ ...q }) : q)) } : prev);
    // Steps that arrive already-done keep their stored detail + timestamp — the
    // choreography only finishes what the data left pending.
    const completeStep = (name: string, detail: string, next?: AgentStep) => (q: QueueItem): QueueItem => {
      let trail = (q.agent_trail || []).map((s) =>
        s.step === name ? (s.done ? { ...s, done: true } : { ...s, done: true, t: 'just now', detail }) : s);
      if (next && !trail.some((s) => s.step === next.step)) trail = [...trail, next];
      return { ...q, agent_trail: trail };
    };

    // Timers live in a ref cleared only on unmount: the patches below change `board`,
    // which re-fires this effect — a dep-tied cleanup would kill the choreography mid-run.
    // Step names mirror the stored trails exactly (client vocabulary, no internal tool names).
    const at = (ms: number, fn: () => void) => introTimers.current.push(window.setTimeout(fn, ms));
    at(1300, () => patch((q) => completeStep('Hook agent', INTRO_DONE_DETAILS['Hook agent'], { step: 'Draft agent', detail: 'writing the first draft…', done: false, t: 'now' })({ ...q, live_step: 'Opening chosen · kept the strongest of 9' })));
    at(2900, () => patch((q) => completeStep('Draft agent', INTRO_DONE_DETAILS['Draft agent'], { step: 'Copy quality gate', detail: 'reading it back…', done: false, t: 'now' })({ ...q, live_step: 'Written · rewrote once after a self-review' })));
    at(4300, () => patch((q) => completeStep('Copy quality gate', INTRO_DONE_DETAILS['Copy quality gate'], { step: 'Image check', detail: 'checking the image…', done: false, t: 'now' })({ ...q, live_step: 'Quality check passed, nothing flagged' })));
    at(5500, () => patch((q) => completeStep('Image check', INTRO_DONE_DETAILS['Image check'])({ ...q, live_step: 'Ready for your review' })));
    at(6700, () => {
      patch((q) => ({
        ...q,
        stage: 'review',
        generating: false,
        live_step: undefined,
        body: q.body || D1_DRAFT_BODY,
      }));
      flash('d1');
      try { localStorage.setItem(introKey, '1'); } catch { /* private mode */ }
    });
  }, [state, board, tab, reduceMotion]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug || !token) { setState('invalid'); return; }
      if (forceIntro) {
        // Replay support: drop the played flag (and any stale approval/angle/skip of the
        // intro card) BEFORE the board mounts, so the choreography runs again from the top.
        try { localStorage.removeItem(introKey); } catch { /* private mode */ }
        setStageOverride((s) => { const { d1: _drop, ...rest } = s; return rest; });
        setAngleSwaps((s) => { const { d1: _drop, ...rest } = s; return rest; });
        setWeekSkips((s) => { const { d1: _drop, ...rest } = s; return rest; });
      }
      const { data, error } = await supabase.rpc('get_client_board', { p_slug: slug, p_token: token });
      if (cancelled) return;
      if (error || !data) { setState('invalid'); return; }
      const rowMode = (data as any).mode || 'demo';
      // The board-generator service reserves the row in 'generating' before the full
      // jsonb exists, then flips it to 'preview' (done) or 'failed'. In those pre-render
      // states the board is a minimal placeholder — show a dedicated screen instead of
      // trying to render an empty board (which would read as the invalid-link error).
      if (rowMode === 'generating' || rowMode === 'failed') {
        setPendingCompany(((data as any).board?.company_name as string) || '');
        setState(rowMode);
        return;
      }
      let b = (data as any).board as Board;
      // Once the intro has played (or motion is reduced and it never will), the choreography
      // card must land as a normal completed review card — never a stuck "Generating…" row.
      const introPlayed = (() => {
        try { return !!localStorage.getItem(introKey); } catch { return true; }
      })();
      if (introPlayed || reduceMotion) {
        b = {
          ...b,
          queue: b.queue.map((q) => q.id === 'd1' && q.generating
            ? { ...q, stage: 'review' as Stage, generating: false, body: q.body || D1_DRAFT_BODY, agent_trail: (q.agent_trail || []).map((s) => (s.done ? s : { ...s, done: true, detail: INTRO_DONE_DETAILS[s.step] ?? s.detail })) }
            : q),
        };
        if (!introPlayed) { try { localStorage.setItem(introKey, '1'); } catch { /* private mode */ } }
      }
      if (b.logo_url) { const img = new Image(); img.src = b.logo_url; }
      setBoard(b);
      setMode((data as any).mode || 'demo');
      setState('ready');
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, token]);

  // While the board is still generating, poll the row every 15s. When it flips to a
  // renderable mode, reload once so the full loader (intro choreography included) runs
  // cleanly; if it fails, drop to the failed screen.
  useEffect(() => {
    if (state !== 'generating' || !slug || !token) return;
    let stopped = false;
    const id = setInterval(async () => {
      const { data, error } = await supabase.rpc('get_client_board', { p_slug: slug, p_token: token });
      if (stopped || error || !data) return;
      const m = (data as any).mode || 'demo';
      if (m === 'failed') { setPendingCompany(((data as any).board?.company_name as string) || pendingCompany); setState('failed'); }
      else if (m !== 'generating') { window.location.reload(); }
    }, 15000);
    return () => { stopped = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, slug, token]);

  // Load the client's heading font so the board carries their type, not ours.
  const headingFont = board?.brand?.font_heading;
  useEffect(() => {
    if (!headingFont) return;
    const id = 'client-board-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(headingFont).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }, [headingFont]);

  // Instrument Sans stands in for LinkedIn's system UI font inside the feed previews.
  // Scoped to this route; DM Serif / Source Serif / IBM Plex Mono ship in the global kit.
  useEffect(() => {
    const id = 'client-board-ui-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap';
    document.head.appendChild(link);
  }, []);

  const accent = cleanHex(board?.brand?.accent_hex);
  const mint = cleanHex(board?.brand?.accent_secondary || board?.brand?.accent_hex);
  // Integrity rule: a still-generating card is never approvable — it renders in Drafted
  // regardless of its stored stage, and never counts toward the review badge. An item
  // whose angle was swapped goes back to Drafted too: picking a different idea queues a
  // fresh draft, it never fakes an instant one.
  const stageOf = (q: QueueItem): Stage => (q.generating ? 'drafted' : angleSwaps[q.id] ? 'drafted' : stageOverride[q.id] ?? q.stage);
  // Display resolution for swapped slots: the chosen angle replaces topic + pillar and
  // clears the stale body/media; the trail restarts honestly from "new angle locked".
  const resolveItem = (q: QueueItem): QueueItem => {
    const a = angleSwaps[q.id];
    if (!a) return q;
    return {
      ...q,
      hook: a.hook,
      title: a.title,
      pillar: a.pillar || q.pillar,
      body: undefined,
      media_url: null,
      cover_url: undefined,
      agent_trail: [
        { step: 'New angle locked', detail: 'you picked a different idea for this slot', done: true, t: 'just now' },
        { step: 'Voice model', detail: a.drafts_by ? `writing starts ${fmtDay(a.drafts_by)}` : 'up next', done: false },
        { step: 'Hook agent', done: false },
        { step: 'Draft agent', done: false },
        { step: 'Copy quality gate', done: false },
        { step: 'Image check', detail: 'then it lands back in your review', done: false },
      ],
    };
  };
  const viewBoard = useMemo(
    () => (board ? { ...board, queue: board.queue.map(resolveItem) } : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board, angleSwaps],
  );
  // The bench for a slot: its seeded alternates; once an angle is picked, the ORIGINAL
  // topic joins the bench (the rejected angle is benched, never lost).
  const benchFor = (id: string): AltAngle[] => {
    const raw = board?.queue.find((q) => q.id === id);
    if (!raw) return [];
    const chosen = angleSwaps[id];
    const pool = raw.alt_angles || [];
    if (!chosen) return pool;
    return [
      ...pool.filter((a) => a.id !== chosen.id),
      { id: `${id}-original`, title: 'The original angle', hook: raw.hook || raw.title || '', pillar: raw.pillar, drafts_by: chosen.drafts_by },
    ];
  };
  // 'demo' (legacy) and 'preview' (current) mean the same thing — the board is a
  // built-ahead preview, not a live account. Reads both so a data migration can't break it.
  const isPreview = mode === 'demo' || mode === 'preview';

  // Per-board share metadata (mirrors ScanReportPage). Sets the title + a NEUTRAL OG about
  // a content preview built for this company — never Ivan's agency pitch — and an OG image
  // that is the board's own brand asset (or a house fallback), never ivan-portrait.jpg.
  // This kills the portrait unfurl for JS-rendering scrapers even on boards not yet
  // prerendered, and bakes correctly into the static HTML that scripts/prerender.mjs emits.
  // useMetadata is a hook, so it runs every render; the values simply update once the board
  // loads. noindex keeps these private prospect demos out of search.
  const ogCompany = board?.company_name || pendingCompany || 'Your brand';
  const ogImage = board?.brand?.logo_light || board?.logo_url || board?.brand?.logo_dark || 'https://ivanmanfredi.com/og-scorecard.png';
  useMetadata({
    title: `${ogCompany} · content preview`,
    description: `A month of content built for ${ogCompany} to preview: LinkedIn posts, carousels, and a live lead magnet, themed to your brand and ready to approve.`,
    canonical: slug ? `https://ivanmanfredi.com/client/${slug}` : undefined,
    ogImage,
    noindex: true,
  });

  // Favicon only: swap the tab icon to the client's mark. Title + OG are owned by
  // useMetadata above; this just makes the browser tab read as the client's board.
  useEffect(() => {
    if (state !== 'ready' || !board) return;
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    const prevHref = link?.getAttribute('href') || '';
    const prevType = link?.getAttribute('type') || '';
    const fav = board.logo_url || board.brand?.logo_light;
    if (link && fav) { link.href = fav; link.removeAttribute('type'); }
    return () => {
      if (link && prevHref) { link.setAttribute('href', prevHref); if (prevType) link.setAttribute('type', prevType); }
    };
  }, [state, board]);

  // Calendar chip click: linked items open the real draft; planned slots open a
  // pipeline preview of what the engine will do for that topic.
  const openCalendarItem = (it: CalendarItem) => {
    const linked = it.ref ? viewBoard?.queue.find((q) => q.id === it.ref) : null;
    if (linked) { setDetail(linked); return; }
    const d = new Date(it.date + 'T00:00:00');
    const rawDraft = new Date(d.getTime() - 2 * 86400000).toISOString().slice(0, 10);
    const engineStart = board?.calendar?.start || '';
    const draftDay = engineStart && rawDraft < engineStart ? engineStart : rawDraft;
    setDetail({
      id: `cal-${it.date}-${it.kind}`,
      kind: (it.kind === 'newsjack' ? 'post' : it.kind) as QueueItem['kind'],
      stage: 'planned',
      pillar: it.pillar,
      hook: it.label,
      publish_date: it.date,
      agent_trail: [
        { step: 'Queued', detail: 'this date is locked in for the topic above', done: true },
        { step: 'Voice model', detail: `writing starts ${fmtDay(draftDay)}`, done: false },
        { step: 'Hook agent', done: false },
        { step: 'Draft agent', done: false },
        { step: 'Copy quality gate', done: false },
        { step: it.kind === 'lm' ? 'Assessment builder' : 'Brand image', done: false },
        { step: 'Image check', detail: 'then it lands in your review', done: false },
      ],
    });
  };

  // Newsletter issue click: the linked issue opens the real queue item; planned issues
  // open the planned-slot pipeline preview with a nurture-appropriate trail.
  const openNewsletterIssue = (it: NewsletterIssue) => {
    const linked = it.ref ? viewBoard?.queue.find((q) => q.id === it.ref) : null;
    // Issue bodies live on the issue record (newsletter.issues[n].body); the queue item
    // is the schedule entry. Inject so the modal reads the full email.
    if (linked) { setDetail(it.body && !linked.body ? { ...linked, body: it.body } : linked); return; }
    const d = new Date(it.date + 'T00:00:00');
    const rawDraft = new Date(d.getTime() - 2 * 86400000).toISOString().slice(0, 10);
    const engineStart = board?.calendar?.start || '';
    const draftDay = engineStart && rawDraft < engineStart ? engineStart : rawDraft;
    const fromDomain = board?.newsletter?.from_domain;
    setDetail({
      id: `nl-${it.id}`,
      kind: 'newsletter',
      stage: 'planned',
      hook: it.title,
      publish_date: it.date,
      agent_trail: [
        { step: 'Queued', detail: 'this send date is locked in', done: true },
        { step: 'Voice model', detail: `writing starts ${fmtDay(draftDay)}`, done: false },
        { step: 'Draft agent', detail: "pulls the week's numbers and stories", done: false },
        { step: 'Copy quality gate', done: false },
        { step: 'Email render', detail: fromDomain ? `sends from ${fromDomain}` : undefined, done: false },
        { step: 'Image check', detail: 'then it lands in your review', done: false },
      ],
    });
  };

  if (state === 'loading') {
    return <BoardSkeleton />;
  }
  if (state === 'generating') {
    const who = pendingCompany ? `${pendingCompany}'s` : 'your';
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: PAPER, color: INK }}>
        <style>{`@keyframes cb-build { 0%,100% { opacity:.3 } 50% { opacity:1 } } @media (prefers-reduced-motion: reduce){ .cb-build-dot{ animation:none !important } }`}</style>
        <div className="w-full max-w-md text-center">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>Content desk</div>
          <h1 className="mt-4" style={{ fontFamily: SERIF, fontSize: 30, lineHeight: 1.15, color: INK }}>
            We're building {who} board<span style={{ color: '#2A8F65' }}>.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-sm" style={{ fontFamily: BODY, fontSize: 15, color: DIM }}>
            The engine is reading your brand, drafting a month of posts, and theming your lead magnet. This takes a few minutes. The page turns itself on the moment it's ready, so you can leave it open.
          </p>
          <div className="mt-7 flex items-center justify-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="cb-build-dot" style={{ width: 7, height: 7, borderRadius: 99, background: '#2A8F65', display: 'inline-block', animation: 'cb-build 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
          <div className="mt-3 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK_MUTE }}>Checking again every few seconds</div>
        </div>
      </div>
    );
  }
  if (state === 'failed') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: PAPER, color: INK }}>
        <div className="w-full max-w-md text-center">
          <div className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: INK_MUTE }}>Content desk</div>
          <h1 className="mt-4" style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 1.15, color: INK }}>
            This board didn't finish building<span style={{ color: '#2A8F65' }}>.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-sm" style={{ fontFamily: BODY, fontSize: 15, color: DIM }}>
            Something interrupted the run. Nothing is wrong on your end. Ask your operator to kick it off again, they'll have a fresh link for you in a few minutes.
          </p>
        </div>
      </div>
    );
  }
  if (state === 'invalid' || !board || !viewBoard) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: FRAME_BG }}>
        <div className="max-w-sm rounded-xl bg-white p-8 text-center" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
          <div className="text-[16px] font-semibold" style={{ color: INK }}>This preview link isn't valid or has expired.</div>
          <p className="mt-2 text-[14px]" style={{ color: DIM }}>Ask your operator for a fresh link.</p>
        </div>
      </div>
    );
  }

  const fontStack = headingFont ? `"${headingFont}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif';
  const openDetail = (q: QueueItem, opts?: { changing?: boolean }) => { setDetail(q); setDetailChanging(!!opts?.changing); };
  const scheduledIds = new Set(viewBoard.queue.filter((q) => stageOf(q) === 'scheduled').map((q) => q.id));
  const approvedIds = new Set(Object.keys(stageOverride).filter((id) => stageOverride[id] === 'scheduled'));
  const surfaces: Record<TabId, React.ReactNode> = {
    week: (
      <WeekSurface
        board={viewBoard}
        accent={accent}
        mint={mint}
        stageOf={stageOf}
        approvedIds={approvedIds}
        angleSwaps={angleSwaps}
        skips={weekSkips}
        benchFor={benchFor}
        onOpen={openDetail}
        onOpenCal={openCalendarItem}
        onApprove={approve}
        onPickAngle={pickAngle}
        onSkip={skipDay}
        onUnskip={unskipDay}
        onGoContent={() => goTab('review')}
        flashId={flashId}
        modalOpen={!!detail}
      />
    ),
    review: <ReviewSurface board={viewBoard} accent={accent} stageOf={stageOf} onOpen={openDetail} onOpenIdea={setIdeaPreview} onApprove={approve} flashId={flashId} view={contentView} setView={setContentView} skips={weekSkips} />,
    calendar: <CalendarSurface board={viewBoard} accent={accent} mint={mint} onOpen={openCalendarItem} scheduledIds={scheduledIds} />,
    lm: <LeadMagnetSurface board={viewBoard} accent={accent} mint={mint} fontStack={fontStack} />,
    newsletter: <NewsletterSurface board={viewBoard} accent={accent} fontStack={fontStack} onOpenIssue={openNewsletterIssue} />,
    leads: <LeadsSurface board={viewBoard} accent={accent} preview={isPreview} onOpen={setLeadDetail} />,
    performance: <PerformanceSurface board={viewBoard} accent={accent} />,
    strategy: <StrategySurface board={viewBoard} accent={accent} mint={mint} />,
  };

  const logo = (h: number) => (
    board.logo_url
      ? <img src={board.logo_url} alt={board.company_name} style={{ height: h, width: 'auto', maxWidth: 150, objectFit: 'contain', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      : <span className="text-[14px] font-semibold" style={{ fontFamily: fontStack, color: INK }}>{board.company_name}</span>
  );

  // Badge = pieces actually awaiting an action: generating, swapped and skipped excluded.
  const reviewCount = viewBoard.queue.filter((q) => stageOf(q) === 'review' && !weekSkips[q.id]).length;
  const founderName = board.founder?.name || board.company_name;
  const goTab = (id: TabId) => { setTab(id); window.scrollTo({ top: 0 }); };

  return (
    <MotionConfig reducedMotion="user">
    <style>{`
@keyframes cb-pulse { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.35; transform:scale(.72) } }
.cb-pulse { animation: cb-pulse 1.6s ease-in-out infinite; }
@keyframes cb-rowgrow { 0% { opacity:0; transform:translateY(-10px) scaleY(.92) } 100% { opacity:1; transform:translateY(0) scaleY(1) } }
@media (prefers-reduced-motion: reduce) { .cb-pulse { animation: none !important } }
`}</style>
    <div className="min-h-screen" style={{ background: PAPER, color: INK, fontFamily: BODY, ['--cb-accent' as any]: accent, ['--cb-mint' as any]: mint }}>
      {/* The margin rail — 216px, hairline right border, never a gray panel. Wordmark in
          the client heading font + accent period; "This week" the one serif nav item, the
          rest mono caps; record button the rail's only ink-filled element. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[216px] flex-col lg:flex" style={{ borderRight: `1px solid ${LINE}`, background: PAPER }}>
        <div className="px-6 pb-5 pt-6" style={{ borderBottom: `1px solid ${LINE}` }}>
          {board.brand?.wordmark ? (
            <span style={{ fontFamily: fontStack, fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: INK }}>
              {board.brand.wordmark}<span style={{ color: accent }}>.</span>
            </span>
          ) : logo(28)}
          <div className="mt-1.5 uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.22em', color: INK_MUTE }}>content desk</div>
        </div>
        <nav className="flex flex-col gap-5 px-0 py-5" aria-label="Board sections">
          {NAV_GROUPS.map((g) => (
            <div key={g}>
              <div className="mb-1 px-6 uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: INK_MUTE, opacity: 0.75 }}>{g}</div>
              <div className="flex flex-col">
                {TABS.filter((t) => t.group === g).map((t) => {
                  const active = tab === t.id;
                  const isHero = t.id === 'week';
                  return (
                    <button
                      key={t.id}
                      onClick={() => goTab(t.id)}
                      className="relative flex min-h-[40px] w-full items-center justify-between gap-2 px-6 text-left transition-colors duration-150 hover:bg-[rgba(26,26,26,0.04)]"
                      style={{ borderLeft: `3px solid ${active ? accent : 'transparent'}`, background: active ? caWash(accent, 6) : 'transparent' }}
                    >
                      <span
                        style={isHero
                          ? { fontFamily: SERIF, fontSize: 17, color: INK }
                          : { fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: active ? INK : INK_MUTE }}
                      >
                        {t.label}
                      </span>
                      {isHero && reviewCount > 0 && (
                        <span className="rounded-full px-2 py-0.5 leading-none tabular-nums" style={{ fontFamily: MONO, fontSize: 10, background: caText(accent), color: PAPER }}><RollingNumber n={reviewCount} /></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-4 px-6 pb-6 pt-5" style={{ borderTop: `1px solid ${LINE}` }}>
          <div>
            <div className="mb-2 uppercase" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: INK_MUTE }}>This week's story</div>
            <button
              onClick={() => goTab('week')}
              className="w-full rounded-md py-2.5 uppercase transition-colors duration-150 hover:opacity-90"
              style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', background: INK, color: PAPER, border: 'none' }}
            >
              ◉ record 90 sec
            </button>
          </div>
          <div className="flex items-center gap-2 uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: INK }}>
            <PulseDot color={accent} size={7} /> engine running
          </div>
          {isPreview && (
            <div className="flex items-center gap-2 text-[11.5px] leading-snug" style={{ fontFamily: BODY, color: INK_MUTE }}>
              <StatusDot color={mint} size={5} />
              Preview built for {board.company_name}
            </div>
          )}
          <div className="flex items-center gap-2.5 pt-1.5" style={{ borderTop: `1px solid ${LINE}` }}>
            <span className="mt-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: accent, color: inkOn(accent) }} aria-hidden>{initialsOf(founderName)}</span>
            <span className="mt-2.5 min-w-0">
              <span className="block truncate text-[12.5px] font-semibold" style={{ color: INK }}>{founderName}</span>
              <span className="block truncate text-[10.5px]" style={{ fontFamily: MONO, color: INK_MUTE }}>Run by Ivan Manfredi</span>
            </span>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b bg-white/85 px-4 py-3 backdrop-blur-md lg:hidden" style={{ borderColor: LINE }}>
        {logo(22)}
        {isPreview && (
          <span className="ml-auto inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium" title="Your first month, built ahead" style={{ border: `1px solid ${LINE}`, color: DIM }}>
            <StatusDot color={mint} size={5} />
            Preview
          </span>
        )}
      </header>

      {/* Main is paper, not a floating white canvas — cards are the only white surfaces.
          A hairline top rule carries the tab name + live-preview mark (mono, quiet). */}
      <div className="lg:ml-[216px]" style={{ background: PAPER }}>
        <div className="sticky top-0 z-10 hidden h-12 items-center gap-2.5 px-8 backdrop-blur lg:flex" style={{ borderBottom: `1px solid ${LINE}`, background: 'rgba(247,244,239,0.86)' }}>
          <span className="uppercase" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', color: INK_MUTE }}>{TABS.find((t) => t.id === tab)?.label}</span>
          <span
            className="ml-auto inline-flex items-center gap-2 uppercase"
            title={isPreview ? 'Your first month, built ahead' : undefined}
            style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', color: INK_MUTE }}
          >
            <PulseDot color={mint} size={6} />
            {isPreview ? 'Preview · built ahead' : 'Live'}
          </span>
          <span className="ml-4 inline-flex items-center gap-2" style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', color: INK_MUTE }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full text-[8.5px] font-bold" style={{ background: INK, color: PAPER, fontFamily: BODY }} aria-hidden>IM</span>
            OPERATOR · IVAN MANFREDI
          </span>
        </div>

        <main className="px-4 pb-[calc(env(safe-area-inset-bottom)+88px)] pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-9">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2, ease: EASE }}
            >
              {/* Week + Content get the wider two-column editorial layout; others cap tighter. */}
              <div className={`w-full ${tab === 'week' ? 'max-w-[1140px]' : tab === 'calendar' || tab === 'review' ? 'max-w-5xl' : 'max-w-[880px]'}`}>{surfaces[tab]}</div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/85 px-1 pt-1 backdrop-blur-md lg:hidden" style={{ borderColor: LINE, paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}>
        <nav className="grid w-full grid-cols-8" aria-label="Board sections">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => goTab(t.id)}
                className="flex min-h-[50px] flex-col items-center justify-center gap-1 rounded-lg px-0.5"
                style={{ color: active ? accent : FAINT }}
              >
                <span className="relative">
                  <NavIcon id={t.id} size={18} />
                  {t.id === 'week' && reviewCount > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-0.5 text-[8.5px] font-bold leading-none tabular-nums" style={{ background: accent, color: inkOn(accent) }}><RollingNumber n={reviewCount} /></span>
                  )}
                </span>
                <span className={`max-w-full truncate text-[9px] leading-tight ${active ? 'font-bold' : 'font-semibold'}`}>{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Undo toast: the quiet second half of the approve moment. */}
      <AnimatePresence>
        {undo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-30 flex justify-center px-4 lg:bottom-6"
          >
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg py-1.5 pl-4 pr-1.5 text-[13px] font-medium text-white" style={{ background: INK, boxShadow: '0 8px 24px rgba(2,32,32,0.28)' }}>
              {undo.kind === 'approve' ? 'Post approved' : undo.kind === 'angle' ? 'New angle locked' : 'Day skipped'}
              <button
                onClick={undoApprove}
                className="ml-1 inline-flex min-h-[32px] items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-white/10"
              >
                Undo
                <kbd className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[4px] px-1 text-[10px] leading-none" style={{ fontFamily: MONO, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }}>Z</kbd>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {detail && (
        <DetailModal
          item={detail}
          board={board}
          accent={accent}
          stage={stageOf(detail)}
          initialChanging={detailChanging}
          onClose={() => { setDetail(null); setDetailChanging(false); }}
          onApprove={approve}
        />
      )}
      {ideaPreview && (
        <IdeaPreviewModal idea={ideaPreview} accent={accent} onClose={() => setIdeaPreview(null)} />
      )}
      {leadDetail && (
        <LeadDetailModal lead={leadDetail} accent={accent} onClose={() => setLeadDetail(null)} />
      )}
    </div>
    </MotionConfig>
  );
}
