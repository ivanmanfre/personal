import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, LayoutGroup, MotionConfig, useReducedMotion } from 'framer-motion';
import { supabase } from '../lib/supabase';
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
}
interface AgentStep { step: string; detail?: string; t?: string; done?: boolean }
type Stage = 'planned' | 'drafted' | 'review' | 'scheduled' | 'published';
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
}
interface CalendarItem { date: string; kind: string; pillar?: string; label: string; ref?: string }
interface Pillar { key: string; label: string; count: number; pct: number; blurb?: string }
interface NewsletterIssue { id: string; ref?: string; date: string; stage: 'scheduled' | 'planned' | string; title: string }
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
  lm?: any;
  strategy?: { total: number; period?: string; pillars: Pillar[] };
  calendar?: { start: string; weeks: number; items: CalendarItem[] };
  newsletter?: NewsletterSpec;
  performance?: PerformanceSpec;
  engine_updates?: EngineUpdate[];
  auto_publish_days?: number;
}

// ---------- small utils ----------
// V6 token system: teal-cast three-ink hierarchy, ink-alpha hairlines, one easing.
const INK = '#101B1A';
const DIM = '#5c6b6a';
/** V7 contrast retoken: FAINT carried informational text at 2.96:1 — now 5.58:1.
 *  Purely decorative grays (weekend numerals, ghost numerals) keep their own literals. */
const FAINT = '#5c6b6a';
/** Structural hairline: brand-ink alpha so it composites over any background. */
const LINE = 'rgba(2,49,47,0.08)';
/** Row divider: softer ink alpha for divide-y inside grouped containers. */
const DIVIDE = 'rgba(2,49,47,0.05)';
/** Tinted app frame the white canvas sits on. */
const FRAME_BG = '#F5F7F6';
/** ONE separation device: soft ring-shadow combo — canvas card + performance cards only. */
const CARD_SHADOW = '0 1px 2px rgba(2,32,32,0.05), 0 0 0 1px rgba(2,32,32,0.03)';
/** Single easing token (Emil Kowalski contract) — every animation on the board uses it. */
const EASE = [0.25, 1, 0.5, 1] as const;
/** Interactive-card affordance: white-on-tint separation at rest, soft lift on hover. */
const LIFT = `transition-[box-shadow,transform] duration-150 ease-[cubic-bezier(0.25,1,0.5,1)] hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(2,32,32,0.07)]`;
const SERIF = '"DM Serif Display", serif';
const MONO = '"Geist Mono", "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace';

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

Scaling multiplies whatever is already in the account — including the leaks. Audit first, then scale.`;

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

/** Identical page-title block on every tab: 22/600 title, 13.5 slate sub, 24px gap. */
function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-[22px] font-semibold tracking-tight" style={{ color: INK }}>{title}</h2>
      {sub && <p className="mt-1 max-w-[64ch] text-[13.5px] leading-relaxed" style={{ color: DIM }}>{sub}</p>}
    </div>
  );
}

/** Sentence-case card header — eyebrows are rationed to stage/group rails only. */
function CardHead({ children }: { children: React.ReactNode }) {
  return <div className="text-[13px] font-semibold" style={{ color: INK }}>{children}</div>;
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

function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping motion-reduce:hidden" style={{ background: color, animationDuration: '2s' }} />
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
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

function stageStatus(q: QueueItem, stage: Stage): React.ReactNode {
  if (stage === 'planned') {
    const d = q.publish_date ? new Date(q.publish_date + 'T00:00:00') : null;
    const drafts = d ? new Date(d.getTime() - 2 * 86400000).toISOString().slice(0, 10) : '';
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

function ReviewSurface({ board, accent, stageOf, onOpen, onApprove, flashId, view, setView }: {
  board: Board; accent: string;
  stageOf: (q: QueueItem) => Stage;
  onOpen: (q: QueueItem, opts?: { changing?: boolean }) => void;
  onApprove: (id: string) => void;
  flashId: string | null;
  view: ContentView;
  setView: (v: ContentView) => void;
}) {
  const autoDays = board.auto_publish_days ?? 3;
  const reduce = useReducedMotion();
  const groups = STAGE_ORDER.map((s) => ({ stage: s, items: board.queue.filter((q) => stageOf(q) === s) }));
  const stageDot = (s: Stage) => (s === 'review' ? accent : s === 'published' ? 'var(--cb-mint)' : FAINT);
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
  const reviewIds = groups.find((g) => g.stage === 'review')?.items.map((q) => q.id) || [];
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
    .filter((q) => (stageOf(q) === 'review' || stageOf(q) === 'scheduled') && q.body)
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

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-[240px] flex-1">
          <SectionHead
            title="Your content"
            sub={`Everything the engine produces moves through these stages. Anything in your review you don't touch publishes automatically after ${autoDays} days.`}
          />
        </div>
        <div className="inline-flex shrink-0 rounded-lg p-0.5" style={{ background: 'rgba(2,49,47,0.05)' }} role="tablist" aria-label="Content view">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className="min-h-[36px] rounded-[6px] px-3.5 text-[13px] transition-colors duration-150"
              style={view === v.id ? { background: '#fff', color: INK, fontWeight: 600, boxShadow: '0 1px 2px rgba(2,32,32,0.08)' } : { color: DIM, fontWeight: 500 }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'list' && (
        <LayoutGroup id="cb-list">
          <div className="flex flex-col gap-6">
            {groups.map(({ stage, items }) => (
              <div key={stage}>
                <div className="mb-2 flex items-baseline gap-2.5 px-1">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: stage === 'review' ? accent : FAINT }}>
                    {STAGE_META[stage].label}
                  </span>
                  <span className="inline-flex rounded-full px-1.5 text-[11px] font-semibold tabular-nums" style={{ background: 'rgba(2,49,47,0.05)', color: DIM }}>
                    <RollingNumber n={items.length} />
                  </span>
                  <span className="hidden text-[12px] sm:inline" style={{ color: FAINT }}>{STAGE_META[stage].hint}</span>
                  {items.length > 0 && (
                    <span className="ml-auto inline-flex shrink-0 items-baseline gap-1 text-[12px] tabular-nums" style={{ color: FAINT }}>
                      <RollingNumber n={items.length} /> {stage === 'published' ? (items.length === 1 ? 'example' : 'examples') : STAGE_SOFT_META[stage]}
                    </span>
                  )}
                </div>
                <div className="overflow-hidden rounded-xl bg-white" style={{ border: `1px solid ${LINE}` }}>
                  {items.length === 0 && (
                    <div className="px-4 py-4 text-[13px]" style={{ color: FAINT }}>Nothing here right now.</div>
                  )}
                  {items.map((q, i) => (
                    <motion.div
                      layout
                      layoutId={`l-${q.id}`}
                      key={q.id}
                      transition={{ layout: { duration: 0.25, ease: EASE } }}
                      role="button"
                      tabIndex={0}
                      onClick={() => onOpen(q)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(q); } }}
                      onMouseEnter={() => setHoverId(q.id)}
                      onMouseLeave={() => setHoverId((h) => (h === q.id ? null : h))}
                      className="group relative flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--cb-accent)_2.5%,white)] sm:grid sm:grid-cols-[56px_minmax(0,1fr)_110px_224px] sm:items-center sm:gap-x-4"
                      style={{ borderTop: i > 0 ? `1px solid ${DIVIDE}` : 'none', minHeight: 56, ...flashStyle(q.id) }}
                    >
                      <Thumb q={q} accent={accent} />
                      <span className="min-w-0 flex-1 sm:flex-none">
                        <span className="block truncate text-[13.5px] font-medium" style={{ color: INK }}>{q.hook || q.title}</span>
                        <span className="mt-0.5 block text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>{kickerOf(q)}</span>
                      </span>
                      <span className="hidden min-w-0 items-center gap-1.5 sm:inline-flex">
                        {q.pillar && (
                          <>
                            <span className="h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: accent, opacity: 0.55 }} />
                            <span className="truncate text-[12px] capitalize" style={{ color: FAINT }}>{q.pillar}</span>
                          </>
                        )}
                      </span>
                      {/* Review rows crossfade the date cell into the action cluster on hover —
                          the cluster lives in the reserved right column, so the pillar tag and
                          title never get occluded (Linear-style). */}
                      <span className={`hidden sm:block ${stage === 'review' ? 'transition-opacity duration-150 group-focus-within:opacity-0 group-hover:opacity-0' : ''}`}>
                        <PublishCell q={q} stage={stage} />
                      </span>
                      {stage === 'review' && approvingId !== q.id && (
                        <span
                          className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 items-center justify-end gap-1.5 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 sm:flex"
                        >
                          <button
                            onClick={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).blur(); startApprove(q.id); }}
                            title="Approve (A)"
                            className="inline-flex min-h-[30px] items-center gap-1.5 rounded-[6px] px-3 text-[12.5px] font-semibold"
                            style={{ background: accent, color: inkOn(accent) }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                              <path d="M5 13l4 4 10-10" stroke={inkOn(accent)} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Approve
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).blur(); onOpen(q, { changing: true }); }}
                            title="Request change (R)"
                            className="min-h-[30px] rounded-[6px] bg-white px-2.5 text-[12.5px] font-medium transition-colors duration-150 hover:bg-[rgba(2,49,47,0.04)]"
                            style={{ color: DIM, border: `1px solid ${LINE}` }}
                          >
                            Request change
                          </button>
                        </span>
                      )}
                      {approvingId === q.id && (
                        <motion.span
                          className="absolute inset-0 z-10 flex items-center justify-center gap-2"
                          style={{ background: 'rgba(255,255,255,0.82)' }}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.15, ease: EASE }}
                          aria-hidden
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <motion.path
                              d="M4.5 12.5l5 5 10-11"
                              stroke={accent}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: 1 }}
                              transition={{ duration: 0.3, ease: EASE }}
                            />
                          </svg>
                          <span className="text-[13px] font-semibold" style={{ color: accent }}>Approved</span>
                        </motion.span>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </LayoutGroup>
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
                        <Thumb q={q} accent={accent} large />
                        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>{kickerOf(q)}</span>
                        <span className="text-[13px] font-medium leading-snug" style={{ color: INK, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {q.hook || q.title}
                        </span>
                        <span>{stageStatus(q, stage)}</span>
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
        <div className="rounded-xl px-3 py-6 sm:px-6" style={{ background: '#f3f2ef', border: `1px solid ${LINE}` }}>
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
                Your first drafts land here this week — this view shows them exactly as they'll run on your feed.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Story intake: where the client's REAL material enters the engine. The chip is a
          format explainer, not history — nothing on this card claims past activity. */}
      <div className="mt-8 rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
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
                <span className="text-[13px] font-semibold" style={{ color: INK }}>{s.step}</span>
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
          <span className="ml-auto">{stageStatus(item, stage)}</span>
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
            {item.kind === 'lm' ? (
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
                className="inline-flex min-h-[44px] items-center rounded-[6px] px-6 text-[14px] font-semibold"
                style={{ background: accent, color: ctaInk }}
              >
                Approve
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
      <SectionHead title="Your calendar" sub="A month of content, planned topic by topic. Click any item to see it, or what the engine has planned for it." />
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
                  return <div key={i} className="rounded-[6px] px-2.5 py-2 text-[12px] font-medium" style={chipStyle(it.kind)}>{it.label}</div>;
                }
                return (
                  <button
                    key={i}
                    onClick={() => onOpen(it)}
                    className="flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-left text-[12px] font-medium"
                    style={chipStyle(it.kind)}
                  >
                    {time && <span className="shrink-0 tabular-nums opacity-60">{time}</span>}
                    <span className="min-w-0 flex-1 truncate">{it.label}</span>
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
                        const tip = `${time ? time + ' · ' : ''}${KIND_LABEL[it.kind] || it.kind} — ${it.label}`;
                        if (it.kind === 'newsjack') {
                          return <div key={i} title={tip} className="truncate rounded-[4px] px-1.5 py-1 text-[10.5px] font-medium" style={chipStyle(it.kind)}>{it.label}</div>;
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
                            <span className="min-w-0 flex-1 truncate">{it.label}</span>
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
function LeadMagnetSurface({ board, accent }: { board: Board; accent: string }) {
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
        title="Your lead magnet"
        sub="Live and interactive, exactly what your leads see. It scores them, then captures their email."
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

      <div className="mt-6 rounded-xl bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}` }}>
        <div className="mb-3"><CardHead>Captured leads</CardHead></div>
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
            <tr style={{ borderTop: `1px solid ${DIVIDE}` }}>
              <td className="py-2.5 pr-3"><span className="break-all">jamie@—store.com</span> <span className="ml-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'rgba(2,49,47,0.05)', color: DIM }}>Sample</span></td>
              <td className="whitespace-nowrap py-2.5 pr-3 tabular-nums">52 / 100</td>
              <td className="py-2.5">Margin visibility</td>
              <td className="hidden py-2.5 pl-3 sm:table-cell">—</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-[13px]" style={{ color: DIM }}>Leads land here the moment someone completes it. Yours to keep, exportable anytime.</p>
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
      <SectionHead title="Your content strategy" sub="One plan, divided on purpose. Your operator holds the mix; you can request a shift anytime." />

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
        const traits: string[] = (board as any).voice?.traits || ['Plain spoken', 'Numbers on the page', 'No hype', 'Australian register'];
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
  if (!nl) return null;
  const issues = nl.issues || [];
  const nurture = nl.nurture || [];

  const issueStatus = (it: NewsletterIssue) =>
    stageStatus({ id: it.id, kind: 'newsletter', stage: it.stage === 'scheduled' ? 'scheduled' : 'planned', publish_date: it.date }, it.stage === 'scheduled' ? 'scheduled' : 'planned');

  return (
    <div>
      <SectionHead
        title="Your newsletter"
        sub="One issue a week, drafted from the same voice model as your posts. Every lead your assessments capture gets it."
      />

      {/* Hero: memo identity next to an inbox preview of the next issue. */}
      {(() => {
        const founderName = board.founder?.name || board.company_name;
        const initials = founderName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
        const first = issues[0];
        const linked = first?.ref ? board.queue.find((q) => q.id === first.ref) : null;
        const snippet = linked?.body || 'The draft lands here the Sunday before it sends, written from the same voice model as your posts.';
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
                <p className="mt-1.5 text-[13px] leading-relaxed" style={{ color: DIM, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {snippet}
                </p>
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

function PerformanceSurface({ board, accent }: { board: Board; accent: string }) {
  const perf = board.performance;
  const updates = board.engine_updates || [];
  const indicators = perf?.indicators || [];
  return (
    <div>
      <SectionHead
        title="Your performance"
        sub={perf?.note || 'The leading indicators your retainer is measured on.'}
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
  { id: 'review', label: 'Content', group: 'Content' },
  { id: 'calendar', label: 'Calendar', group: 'Content' },
  { id: 'lm', label: 'Lead magnet', group: 'Content' },
  { id: 'newsletter', label: 'Newsletter', group: 'Content' },
  { id: 'performance', label: 'Performance', group: 'Reports' },
  { id: 'strategy', label: 'Strategy', group: 'Reports' },
] as const;
type TabId = (typeof TABS)[number]['id'];
const NAV_GROUPS = ['Content', 'Reports'] as const;

/** 16px stroke icons for the nav (feather register, 1.8 stroke). */
const NAV_ICON_PATHS: Record<TabId, React.ReactNode> = {
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
  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [tab, setTab] = useState<TabId>('review');
  const [detail, setDetail] = useState<QueueItem | null>(null);
  const [detailChanging, setDetailChanging] = useState(false);
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
  // Undo window after an approve: toast with Z / click to restore the row.
  const [undo, setUndo] = useState<{ id: string } | null>(null);
  const undoTimer = useRef<number>(0);
  useEffect(() => () => { introTimers.current.forEach((t) => window.clearTimeout(t)); window.clearTimeout(flashTimer.current); window.clearTimeout(undoTimer.current); }, []);

  const flash = (id: string) => {
    setFlashId(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1500);
  };

  // Optimistic approve + undo window. Defined above the early returns so the
  // Z-key effect keeps a stable hook order across loading states.
  const approve = (id: string) => {
    setStageOverride((s) => ({ ...s, [id]: 'scheduled' }));
    flash(id);
    setUndo({ id });
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => setUndo(null), 6000);
  };
  const undoApprove = () => {
    window.clearTimeout(undoTimer.current);
    setUndo((u) => {
      if (u) {
        setStageOverride((s) => { const { [u.id]: _drop, ...rest } = s; return rest; });
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
    if (state !== 'ready' || !board || tab !== 'review' || introRan.current || reduceMotion) return;
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
    at(1300, () => patch((q) => completeStep('Hook agent', '9 angles scored, picked the strongest', { step: 'Draft agent', detail: 'writing v1…', done: false, t: 'now' })({ ...q, live_step: 'Hook agent · picked the strongest of 9' })));
    at(2900, () => patch((q) => completeStep('Draft agent', 'v2 after self-review pass', { step: 'Copy quality gate', detail: 'checking…', done: false, t: 'now' })({ ...q, live_step: 'Draft agent · v2 after self-review' })));
    at(4300, () => patch((q) => completeStep('Copy quality gate', 'PASS, 0 flags', { step: 'Image check', detail: 'reviewing…', done: false, t: 'now' })({ ...q, live_step: 'Copy quality gate · PASS' })));
    at(5500, () => patch((q) => completeStep('Image check', 'clean, approved for review')({ ...q, live_step: 'Ready for your review' })));
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
        // Replay support: drop the played flag (and any stale approval of the intro card)
        // BEFORE the board mounts, so the choreography runs again from the top.
        try { localStorage.removeItem(introKey); } catch { /* private mode */ }
        setStageOverride((s) => { const { d1: _drop, ...rest } = s; return rest; });
      }
      const { data, error } = await supabase.rpc('get_client_board', { p_slug: slug, p_token: token });
      if (cancelled) return;
      if (error || !data) { setState('invalid'); return; }
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
            ? { ...q, stage: 'review' as Stage, generating: false, body: q.body || D1_DRAFT_BODY, agent_trail: (q.agent_trail || []).map((s) => ({ ...s, done: true })) }
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

  // Load the client's heading font so the board carries their type, not ours.
  const headingFont = board?.brand?.font_heading;
  useEffect(() => {
    if (!headingFont) return;
    const id = 'client-board-font';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(headingFont).replace(/%20/g, '+')}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
  }, [headingFont]);

  const accent = cleanHex(board?.brand?.accent_hex);
  const mint = cleanHex(board?.brand?.accent_secondary || board?.brand?.accent_hex);
  // Integrity rule: a still-generating card is never approvable — it renders in Drafted
  // regardless of its stored stage, and never counts toward the review badge.
  const stageOf = (q: QueueItem): Stage => (q.generating ? 'drafted' : stageOverride[q.id] ?? q.stage);
  // 'demo' (legacy) and 'preview' (current) mean the same thing — the board is a
  // built-ahead preview, not a live account. Reads both so a data migration can't break it.
  const isPreview = mode === 'demo' || mode === 'preview';

  // Per-client document head: the tab reads as the client's board, not Ivan's sales pitch.
  // OG/meta tags stay static — GitHub Pages can't vary them per route without prerendering
  // this route, which is out of scope here.
  useEffect(() => {
    if (state !== 'ready' || !board) return;
    const prevTitle = document.title;
    document.title = `${board.company_name} · Inbound Engine`;
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    const prevHref = link?.getAttribute('href') || '';
    const prevType = link?.getAttribute('type') || '';
    const fav = board.logo_url || board.brand?.logo_light;
    if (link && fav) { link.href = fav; link.removeAttribute('type'); }
    return () => {
      document.title = prevTitle;
      if (link && prevHref) { link.setAttribute('href', prevHref); if (prevType) link.setAttribute('type', prevType); }
    };
  }, [state, board]);

  // Calendar chip click: linked items open the real draft; planned slots open a
  // pipeline preview of what the engine will do for that topic.
  const openCalendarItem = (it: CalendarItem) => {
    const linked = it.ref ? board?.queue.find((q) => q.id === it.ref) : null;
    if (linked) { setDetail(linked); return; }
    const d = new Date(it.date + 'T00:00:00');
    const draftDay = new Date(d.getTime() - 2 * 86400000).toISOString().slice(0, 10);
    setDetail({
      id: `cal-${it.date}-${it.kind}`,
      kind: (it.kind === 'newsjack' ? 'post' : it.kind) as QueueItem['kind'],
      stage: 'planned',
      pillar: it.pillar,
      hook: it.label,
      publish_date: it.date,
      agent_trail: [
        { step: 'Queued', detail: 'slot locked on your calendar', done: true },
        { step: 'Voice model', detail: `drafts ${fmtDay(draftDay)}`, done: false },
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
    const linked = it.ref ? board?.queue.find((q) => q.id === it.ref) : null;
    if (linked) { setDetail(linked); return; }
    const d = new Date(it.date + 'T00:00:00');
    const draftDay = new Date(d.getTime() - 2 * 86400000).toISOString().slice(0, 10);
    const fromDomain = board?.newsletter?.from_domain;
    setDetail({
      id: `nl-${it.id}`,
      kind: 'newsletter',
      stage: 'planned',
      hook: it.title,
      publish_date: it.date,
      agent_trail: [
        { step: 'Queued', detail: 'issue slot locked on your calendar', done: true },
        { step: 'Voice model', detail: `drafts ${fmtDay(draftDay)}`, done: false },
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
  if (state === 'invalid' || !board) {
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
  const scheduledIds = new Set(board.queue.filter((q) => stageOf(q) === 'scheduled').map((q) => q.id));
  const surfaces: Record<TabId, React.ReactNode> = {
    review: <ReviewSurface board={board} accent={accent} stageOf={stageOf} onOpen={openDetail} onApprove={approve} flashId={flashId} view={contentView} setView={setContentView} />,
    calendar: <CalendarSurface board={board} accent={accent} mint={mint} onOpen={openCalendarItem} scheduledIds={scheduledIds} />,
    lm: <LeadMagnetSurface board={board} accent={accent} />,
    newsletter: <NewsletterSurface board={board} accent={accent} fontStack={fontStack} onOpenIssue={openNewsletterIssue} />,
    performance: <PerformanceSurface board={board} accent={accent} />,
    strategy: <StrategySurface board={board} accent={accent} mint={mint} />,
  };

  const logo = (h: number) => (
    board.logo_url
      ? <img src={board.logo_url} alt={board.company_name} style={{ height: h, width: 'auto', maxWidth: 150, objectFit: 'contain', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      : <span className="text-[14px] font-semibold" style={{ fontFamily: fontStack, color: INK }}>{board.company_name}</span>
  );

  const reviewCount = board.queue.filter((q) => stageOf(q) === 'review').length;
  const founderName = board.founder?.name || board.company_name;
  const goTab = (id: TabId) => { setTab(id); window.scrollTo({ top: 0 }); };

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen" style={{ background: FRAME_BG, color: INK, fontFamily: 'Inter, system-ui, sans-serif', ['--cb-accent' as any]: accent, ['--cb-mint' as any]: mint }}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col lg:flex">
        <div className="px-5 pb-5 pt-5">
          {logo(30)}
          <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>Inbound engine</div>
        </div>
        <nav className="flex flex-col gap-5 px-3" aria-label="Board sections">
          {NAV_GROUPS.map((g) => (
            <div key={g}>
              <div className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: FAINT }}>{g}</div>
              <div className="flex flex-col gap-0.5">
                {TABS.filter((t) => t.group === g).map((t) => {
                  const active = tab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => goTab(t.id)}
                      className="relative flex min-h-[40px] w-full items-center gap-2.5 rounded-md px-3 text-left text-[13px] transition-colors duration-150 hover:bg-[rgba(2,49,47,0.04)]"
                      style={active ? { background: `color-mix(in srgb, ${accent} 8%, ${FRAME_BG})`, color: accent, fontWeight: 600 } : { color: DIM, fontWeight: 500 }}
                    >
                      {active && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full" style={{ background: accent }} aria-hidden />}
                      <span style={{ color: active ? accent : FAINT }}><NavIcon id={t.id} /></span>
                      {t.label}
                      {t.id === 'review' && reviewCount > 0 && (
                        <span className="ml-auto rounded-full px-1.5 py-0.5 text-[10.5px] font-bold leading-none tabular-nums" style={{ background: accent, color: inkOn(accent) }}><RollingNumber n={reviewCount} /></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 px-5 pb-5">
          {isPreview && (
            <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[12px] font-medium leading-snug" style={{ border: `1px solid ${LINE}`, color: DIM }}>
              <StatusDot color={mint} size={5} />
              Preview built for {board.company_name}
            </div>
          )}
          <div className="flex items-center gap-2.5 border-t pt-3.5" style={{ borderColor: LINE }}>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold" style={{ background: accent, color: inkOn(accent) }} aria-hidden>{initialsOf(founderName)}</span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold" style={{ color: INK }}>{founderName}</span>
              <span className="block truncate text-[11px]" style={{ color: FAINT }}>{board.company_name} · Operator plan</span>
            </span>
          </div>
          <div className="text-[11px]" style={{ color: FAINT }}>Run by Ivan Manfredi</div>
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

      {/* Inset two-surface shell: the white canvas card sits on the tinted app frame. */}
      <div className="lg:ml-60 lg:py-2 lg:pr-2">
        <div className="min-h-screen bg-white lg:min-h-[calc(100vh-16px)] lg:rounded-xl" style={{ boxShadow: CARD_SHADOW }}>
          {/* Slim top bar: breadcrumb + status. Desktop only — mobile has its own header. */}
          <div className="sticky z-10 hidden h-14 items-center gap-2.5 rounded-t-xl px-8 backdrop-blur lg:top-2 lg:flex" style={{ borderBottom: `1px solid ${DIVIDE}`, background: 'rgba(255,255,255,.86)' }}>
            <span className="text-[13px] font-medium" style={{ color: FAINT }}>Inbound Engine</span>
            <span className="text-[13px]" style={{ color: 'rgba(2,49,47,0.25)' }} aria-hidden>/</span>
            <span className="text-[13px] font-semibold" style={{ color: INK }}>{TABS.find((t) => t.id === tab)?.label}</span>
            <span
              className="ml-auto inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11.5px] font-medium"
              title={isPreview ? 'Your first month, built ahead' : undefined}
              style={{ border: `1px solid ${LINE}`, background: '#fff', color: DIM }}
            >
              <StatusDot color={mint} pulse size={6} />
              {isPreview ? 'Preview' : 'Live'}
              {isPreview && <span className="hidden xl:inline" style={{ color: FAINT, fontWeight: 400 }}>· your first month, built ahead</span>}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[11.5px] font-medium" style={{ border: `1px solid ${LINE}`, color: DIM, background: '#fff' }}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[8.5px] font-bold" style={{ background: INK, color: '#fff' }} aria-hidden>IM</span>
              Operator: Ivan Manfredi
            </span>
          </div>

          <main className="px-4 pb-[calc(env(safe-area-inset-bottom)+88px)] pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.2, ease: EASE }}
              >
                <div className={`w-full ${tab === 'calendar' || (tab === 'review' && contentView === 'board') ? 'max-w-5xl' : 'max-w-[880px]'}`}>{surfaces[tab]}</div>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>

      {/* Mobile bottom tabs */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/85 px-1 pt-1 backdrop-blur-md lg:hidden" style={{ borderColor: LINE, paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}>
        <nav className="grid w-full grid-cols-6" aria-label="Board sections">
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
                  {t.id === 'review' && reviewCount > 0 && (
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
              Post approved
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
    </div>
    </MotionConfig>
  );
}
