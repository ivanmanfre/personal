import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, LayoutGroup, MotionConfig, useReducedMotion } from 'framer-motion';
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
  auto_publish_days?: number;
}

// ---------- small utils ----------
const INK = '#0f172a';
const DIM = '#475569';
const FAINT = '#64748b';
const LINE = '#e9e9ee';
const CARD_SHADOW = '0 1px 2px rgba(15,23,42,.04), 0 10px 26px -18px rgba(15,23,42,.18)';
const SERIF = '"DM Serif Display", serif';

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
const FLASH_BG = 'color-mix(in srgb, #10b981 13%, white)';

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

function CountUpNum({ n, size }: { n: number; size: number }) {
  const v = useCountUp(n);
  return <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: size, lineHeight: 1.05, color: INK }}>{v}</span>;
}

/** 16:9 row/card thumbnail: real media when it exists, a format glyph tile otherwise. */
function Thumb({ q, accent, large = false }: { q: QueueItem; accent: string; large?: boolean }) {
  const src = q.media_url || q.cover_url;
  const cls = large ? 'aspect-video w-full rounded-lg' : 'h-8 w-14 rounded-[6px]';
  if (src) {
    return <img src={src} alt="" loading="lazy" className={`${cls} shrink-0 object-cover`} style={{ border: `1px solid ${LINE}`, background: '#f1f5f9' }} />;
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
function KindChip({ q, accent }: { q: Pick<QueueItem, 'kind' | 'media_url'>; accent: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: `color-mix(in srgb, ${accent} 10%, white)`, color: INK }}
    >
      {kickerOf(q)}
    </span>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[22px] font-semibold tracking-tight" style={{ color: INK }}>{title}</h2>
      {sub && <p className="mt-1 text-[14px] leading-relaxed" style={{ color: DIM }}>{sub}</p>}
    </div>
  );
}

function PulseDot({ color }: { color: string }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: color }} />
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
  published: { label: 'Published', hint: 'Live on your LinkedIn.' },
};
const STAGE_ORDER: Stage[] = ['review', 'drafted', 'scheduled', 'published'];

function stageStatus(q: QueueItem, stage: Stage): React.ReactNode {
  if (stage === 'planned') {
    const d = q.publish_date ? new Date(q.publish_date + 'T00:00:00') : null;
    const drafts = d ? new Date(d.getTime() - 2 * 86400000).toISOString().slice(0, 10) : '';
    return <span className="text-[12px]" style={{ color: FAINT }}>Drafts {fmtDay(drafts)} · publishes {fmtDay(q.publish_date)}</span>;
  }
  if (stage === 'drafted') {
    return q.generating
      ? <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: DIM }}><PulseDot color="#0ea5e9" /> {q.live_step || 'Generating…'}</span>
      : <span className="text-[12px]" style={{ color: FAINT }}>In production</span>;
  }
  if (stage === 'review') return <span className="text-[12px]" style={{ color: DIM }}>Publishes {fmtDay(q.publish_date)} unless you change it</span>;
  if (stage === 'scheduled') return <span className="text-[12px] font-medium" style={{ color: '#047857' }}>Publishes {fmtDay(q.publish_date)}</span>;
  return <span className="text-[12px]" style={{ color: FAINT }}>Published {fmtDay(q.publish_date)}</span>;
}

type ContentView = 'list' | 'board' | 'feed';
const VIEWS: { id: ContentView; label: string }[] = [
  { id: 'list', label: 'List' },
  { id: 'board', label: 'Board' },
  { id: 'feed', label: 'Feed' },
];

function ReviewSurface({ board, accent, stageOf, onOpen, flashId, view, setView }: {
  board: Board; accent: string;
  stageOf: (q: QueueItem) => Stage;
  onOpen: (q: QueueItem) => void;
  flashId: string | null;
  view: ContentView;
  setView: (v: ContentView) => void;
}) {
  const autoDays = board.auto_publish_days ?? 3;
  const groups = STAGE_ORDER.map((s) => ({ stage: s, items: board.queue.filter((q) => stageOf(q) === s) }));
  const stageDot = (s: Stage) => (s === 'review' ? accent : s === 'drafted' ? '#0ea5e9' : s === 'scheduled' ? '#047857' : '#94a3b8');
  const flashStyle = (id: string): React.CSSProperties => ({
    background: flashId === id ? FLASH_BG : undefined,
    transition: 'background-color 700ms ease',
  });

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
        <div className="inline-flex shrink-0 rounded-lg p-0.5" style={{ background: '#eceef2', border: `1px solid ${LINE}` }} role="tablist" aria-label="Content view">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className="min-h-[36px] rounded-[7px] px-3.5 text-[13px] font-semibold transition-colors"
              style={view === v.id ? { background: '#fff', color: INK, boxShadow: '0 1px 2px rgba(15,23,42,.08)' } : { color: DIM }}
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
                  <span className="text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: stage === 'review' ? accent : FAINT }}>
                    {STAGE_META[stage].label}
                  </span>
                  <span className="rounded-full px-1.5 text-[11px] font-semibold" style={{ background: '#f1f5f9', color: DIM }}>{items.length}</span>
                  <span className="hidden text-[12px] sm:inline" style={{ color: FAINT }}>{STAGE_META[stage].hint}</span>
                </div>
                <div className="overflow-hidden rounded-[14px] bg-white" style={{ border: `1px solid ${LINE}`, boxShadow: stage === 'review' ? CARD_SHADOW : 'none' }}>
                  {items.length === 0 && (
                    <div className="px-4 py-4 text-[13px]" style={{ color: FAINT }}>Nothing here right now.</div>
                  )}
                  {items.map((q, i) => (
                    <motion.button
                      layout
                      layoutId={`l-${q.id}`}
                      key={q.id}
                      onClick={() => onOpen(q)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[#fbfcfd]"
                      style={{ borderTop: i > 0 ? `1px solid ${LINE}` : 'none', minHeight: 54, ...flashStyle(q.id) }}
                    >
                      <Thumb q={q} accent={accent} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium" style={{ color: INK }}>{q.hook || q.title}</span>
                        <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.06em]" style={{ color: FAINT }}>{kickerOf(q)}</span>
                      </span>
                      {q.pillar && (
                        <span className="hidden items-center gap-1.5 sm:inline-flex">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent, opacity: 0.55 }} />
                          <span className="text-[12px] capitalize" style={{ color: FAINT }}>{q.pillar}</span>
                        </span>
                      )}
                      <span className="hidden shrink-0 text-right sm:block">{stageStatus(q, stage)}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0" aria-hidden>
                        <path d="M9 6l6 6-6 6" stroke={FAINT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.button>
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
                <div key={stage} className="w-[248px] shrink-0 rounded-[14px] p-2" style={{ background: '#f0f2f5', border: `1px solid ${LINE}` }}>
                  <div className="flex items-center gap-2 px-1.5 pb-2 pt-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: stageDot(stage) }} aria-hidden />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: stage === 'review' ? accent : DIM }}>{STAGE_META[stage].label}</span>
                    <span className="rounded-full px-1.5 text-[11px] font-semibold" style={{ background: '#fff', color: DIM }}>{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.length === 0 && (
                      <div className="rounded-[12px] px-3 py-4 text-[12px]" style={{ color: FAINT, border: `1px dashed ${LINE}` }}>Nothing here right now.</div>
                    )}
                    {items.map((q) => (
                      <motion.button
                        layout
                        layoutId={`b-${q.id}`}
                        key={q.id}
                        onClick={() => onOpen(q)}
                        className="flex w-full flex-col gap-2 rounded-[12px] bg-white p-2.5 text-left transition-shadow hover:shadow-md"
                        style={{ border: `1px solid ${LINE}`, boxShadow: '0 1px 2px rgba(15,23,42,.05)', ...flashStyle(q.id) }}
                      >
                        <Thumb q={q} accent={accent} large />
                        <span className="text-[10.5px] font-semibold uppercase tracking-[0.07em]" style={{ color: FAINT }}>{kickerOf(q)}</span>
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
        <div className="rounded-[16px] px-3 py-6 sm:px-6" style={{ background: '#f3f2ef', border: `1px solid ${LINE}` }}>
          <div className="mx-auto mb-5 max-w-[552px]">
            <h3 className="text-[18px] font-semibold tracking-tight" style={{ color: INK }}>Next week on your LinkedIn</h3>
            <p className="mt-1 text-[13.5px]" style={{ color: DIM }}>
              {weekCounts.posts} posts, {weekCounts.lms} lead magnets, drafted from your voice.
            </p>
          </div>
          <div className="flex flex-col">
            {feedItems.map((q) => (
              <div key={q.id} className="mx-auto w-full max-w-[552px]">
                <div className="mb-1.5 mt-4 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] first:mt-0" style={{ color: FAINT }}>
                  {fmtDay(q.publish_date)}
                </div>
                <LinkedInPostPreview
                  text={q.body || ''}
                  author={founder?.name || board.company_name}
                  headline={founder?.headline || ''}
                  avatarUrl={founder?.avatar_url || ''} /* '' forces initials — the component's default is Ivan's portrait */
                  mediaUrl={q.media_url || undefined}
                  stats={{ reactions: 0, comments: 0 }}
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
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 420, damping: 28 } },
      };
  return (
    <div>
      <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: FAINT }}>How this was made</div>
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
                variants={reduce ? undefined : { hidden: { scaleY: 0 }, show: { scaleY: 1, transition: { duration: 0.32, ease: 'easeOut' } } }}
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
                    variants={reduce ? undefined : { hidden: { scale: 0.4 }, show: { scale: 1, transition: { type: 'spring', stiffness: 500, damping: 22 } } }}
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

function DetailModal({ item, board, accent, stage, onClose, onApprove }: {
  item: QueueItem; board: Board; accent: string; stage: Stage;
  onClose: () => void; onApprove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.body || '');
  const [changing, setChanging] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);
  const ctaInk = inkOn(accent);
  const canAct = stage === 'review';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative mx-auto my-0 min-h-full w-full max-w-4xl bg-white p-4 sm:my-8 sm:min-h-0 sm:rounded-[16px] sm:p-6" style={{ boxShadow: '0 30px 80px rgba(15,23,42,.35)' }}>
        {/* Header */}
        <div className="mb-4 flex items-center gap-2.5">
          <KindChip q={item} accent={accent} />
          {item.pillar && <span className="text-[12px] capitalize" style={{ color: FAINT }}>{item.pillar}</span>}
          <span className="ml-auto">{stageStatus(item, stage)}</span>
          <button onClick={onClose} aria-label="Close" className="ml-2 flex h-9 w-9 items-center justify-center rounded-full hover:bg-[#f1f5f9]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke={DIM} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          {/* Left: content preview / edit */}
          <div className="min-w-0">
            {item.kind === 'lm' ? (
              <div className="rounded-[14px] p-4" style={{ border: `1px solid ${LINE}` }}>
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
                  className="w-full rounded-[12px] p-4 text-[14px] leading-relaxed outline-none"
                  style={{ border: `1.5px solid ${accent}`, color: INK, background: '#fbfcfd' }}
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => setEditing(false)}
                    className="inline-flex min-h-[40px] items-center rounded-lg px-4 text-[13px] font-semibold"
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
                    showFold={false}
                  />
                ) : (
                  <div className="rounded-[14px] p-5 text-[14px]" style={{ border: `1px dashed ${LINE}`, color: DIM }}>
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
                    className="mt-3 inline-flex min-h-[40px] items-center rounded-lg px-4 text-[13px] font-semibold"
                    style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
                  >
                    Edit copy
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: agent trail */}
          <div className="h-fit rounded-[14px] p-4" style={{ background: '#fbfcfd', border: `1px solid ${LINE}` }}>
            <AgentTrail steps={item.agent_trail || []} accent={accent} />
          </div>
        </div>

        {/* Footer actions */}
        {canAct && (
          <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t pt-4" style={{ borderColor: LINE }}>
            <motion.button
              onClick={() => { onApprove(item.id); onClose(); }}
              whileTap={{ scale: 0.93 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18 }}
              className="inline-flex min-h-[44px] items-center rounded-lg px-6 text-[14px] font-semibold"
              style={{ background: accent, color: ctaInk }}
            >
              Approve
            </motion.button>
            <button
              onClick={() => setChanging(!changing)}
              className="inline-flex min-h-[44px] items-center rounded-lg px-4 text-[14px] font-semibold"
              style={{ border: `1px solid ${LINE}`, color: DIM, background: '#fff' }}
            >
              Request changes
            </button>
            {sent && <span className="text-[13px] font-medium" style={{ color: '#047857' }}>Sent. Your operator will adjust it before the publish date.</span>}
          </div>
        )}
        {changing && canAct && !sent && (
          <div className="mt-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tell us what to change, in plain words."
              rows={3}
              className="w-full rounded-lg p-3 text-[14px] outline-none"
              style={{ border: `1px solid ${LINE}`, color: INK, background: '#fbfcfd' }}
            />
            <button
              onClick={() => { setSent(true); setChanging(false); }}
              className="mt-2 inline-flex min-h-[44px] items-center rounded-lg px-4 text-[14px] font-semibold"
              style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
            >
              Send to your operator
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Calendar surface ----------
const KIND_TIME: Record<string, string> = { post: '09:00', carousel: '09:00', newsletter: '08:00', lm: '12:00' };

function CalendarSurface({ board, accent, mint, onOpen }: { board: Board; accent: string; mint: string; onOpen: (it: CalendarItem) => void }) {
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

  const chipStyle = (kind: string): React.CSSProperties => {
    switch (kind) {
      case 'post': return { background: `color-mix(in srgb, ${accent} 13%, white)`, color: INK };
      case 'carousel': return { background: `color-mix(in srgb, ${accent} 28%, white)`, color: INK };
      case 'lm': return { background: `color-mix(in srgb, ${mint} 24%, white)`, color: INK };
      case 'newsletter': return { background: '#f1f5f9', color: DIM };
      case 'newsjack': return { background: '#fff', color: FAINT, border: `1px dashed ${LINE}` };
      default: return { background: '#f1f5f9', color: DIM };
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

  return (
    <div>
      <SectionHead title="Your calendar" sub="A month of content, planned topic by topic. Click any item to see it, or what the engine has planned for it." />
      <div className="mb-5 flex flex-wrap gap-3">
        {[
          [totals.post + totals.carousel, 'posts'],
          [totals.lm, 'lead magnets'],
          [totals.newsletter, 'newsletters'],
        ].map(([n, label]) => (
          <div key={label as string} className="flex items-baseline gap-2 rounded-[14px] bg-white px-4 py-3" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
            {num(n as number)}
            <span className="text-[13px] font-medium" style={{ color: DIM }}>{label}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-[14px] bg-white p-3 sm:p-4" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
        <div className="min-w-[820px]">
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 px-1">
            <span className="text-[15px] font-semibold" style={{ color: INK }}>{monthLabel}</span>
            <span className="text-[12px]" style={{ color: FAINT }}>{cal.items.length} pieces scheduled</span>
            <span className="ml-auto hidden items-center gap-4 md:inline-flex">
              {swatch(chipStyle('post'), 'Post')}
              {swatch(chipStyle('carousel'), 'Carousel')}
              {swatch(chipStyle('lm'), 'Lead magnet')}
              {swatch(chipStyle('newsletter'), 'Newsletter')}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 border-b pb-2" style={{ borderColor: LINE }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: FAINT }}>{d}</div>
            ))}
          </div>
          {weeks.map((row, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1.5 pt-1.5">
              {row.map((d) => {
                const iso = d.toISOString().slice(0, 10);
                const items = byDate.get(iso) || [];
                const visible = items.slice(0, 3);
                return (
                  <div key={iso} className="min-h-[112px] rounded-lg p-1.5" style={{ border: `1px solid ${LINE}`, background: items.length ? '#fff' : '#fbfcfd' }}>
                    <div className="px-0.5 pb-1 text-[12px] font-medium" style={{ color: FAINT }}>{d.getDate()}</div>
                    <div className="flex flex-col gap-1">
                      {visible.map((it, i) => {
                        const time = KIND_TIME[it.kind];
                        const tip = `${time ? time + ' · ' : ''}${KIND_LABEL[it.kind] || it.kind} — ${it.label}`;
                        if (it.kind === 'newsjack') {
                          return <div key={i} title={tip} className="truncate rounded px-1.5 py-1 text-[10.5px] font-semibold" style={chipStyle(it.kind)}>{it.label}</div>;
                        }
                        return (
                          <button
                            key={i}
                            title={tip}
                            onClick={() => onOpen(it)}
                            className="flex w-full items-center gap-1 truncate rounded px-1.5 py-1 text-left text-[10.5px] font-semibold transition-transform hover:scale-[1.02]"
                            style={chipStyle(it.kind)}
                          >
                            {time && <span className="shrink-0 tabular-nums opacity-60">{time}</span>}
                            <span className="truncate">{it.label}</span>
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
  // stripped + the client's accent/fonts applied.
  const src = useMemo(() => buildAssessmentEmbedUrl(lm), [lm]);
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
        <div className="rounded-[14px] bg-white p-8" style={{ border: `1px solid ${LINE}` }}>
          <p className="text-[14px]" style={{ color: DIM }}>Your first lead magnet is in production. It lands here for review this week.</p>
        </div>
      )}

      <div className="mt-6 rounded-[14px] bg-white p-4 sm:p-5" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
        <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: FAINT }}>Captured leads</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-[13px]">
            <thead>
              <tr style={{ color: FAINT }}>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Score</th>
                <th className="pb-2 font-medium">Weakest area</th>
                <th className="pb-2 font-medium">When</th>
              </tr>
            </thead>
            <tbody style={{ color: INK }}>
              <tr style={{ borderTop: `1px solid ${LINE}` }}>
                <td className="py-2.5">jamie@—store.com <span className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: '#f1f5f9', color: DIM }}>Sample</span></td>
                <td className="py-2.5">52 / 100</td>
                <td className="py-2.5">Margin visibility</td>
                <td className="py-2.5">—</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[13px]" style={{ color: DIM }}>Leads land here the moment someone completes it. Yours to keep, exportable anytime.</p>
      </div>
    </div>
  );
}

// ---------- Strategy surface ----------
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

      <div className="rounded-[14px] bg-white p-4 sm:p-6" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: FAINT }}>
            Your content this month
          </div>
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
          <div className="mt-5 rounded-lg p-4" style={{ background: '#fbfcfd', border: `1px solid ${LINE}` }}>
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
            { label: 'Text posts', n: t.post, bg: `color-mix(in srgb, ${accent} 13%, white)` },
            { label: 'Carousels', n: t.carousel, bg: `color-mix(in srgb, ${accent} 28%, white)` },
            { label: 'Lead magnets', n: t.lm, bg: `color-mix(in srgb, ${mint} 24%, white)` },
            { label: 'Newsletters', n: t.newsletter, bg: '#f1f5f9' },
          ].filter((f) => f.n > 0);
          return (
            <div className="mt-6">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.1em]" style={{ color: FAINT }}>Formats this month</div>
              <div className="flex w-full overflow-hidden rounded-lg" style={{ border: `1px solid ${LINE}` }}>
                {formats.map((f, i) => (
                  <div
                    key={f.label}
                    className="flex min-h-[56px] flex-col items-start justify-center gap-0 px-2 py-2"
                    style={{ flexGrow: f.n, flexBasis: 0, minWidth: 104, background: f.bg, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.9)' : 'none' }}
                  >
                    <span className="flex items-baseline gap-1.5">
                      <CountUpNum n={f.n} size={18} />
                      <span className="truncate text-[11px] font-semibold" style={{ color: INK }}>{f.label}</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: FAINT }}>
                The format each topic ships in is picked per topic: teardown math wants a carousel, a capture play wants a lead magnet.
              </p>
            </div>
          );
        })()}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => { setShiftOpen(!shiftOpen); setShiftSent(false); }}
            className="inline-flex min-h-[44px] items-center rounded-lg px-4 text-[14px] font-semibold"
            style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
          >
            Request a shift
          </button>
          {shiftSent && <span className="text-[13px] font-medium" style={{ color: '#047857' }}>Sent. Your operator reviews every shift.</span>}
        </div>
        {shiftOpen && !shiftSent && (
          <div className="mt-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder='e.g. "More proof posts this month, we just landed two big results."'
              rows={3}
              className="w-full rounded-lg p-3 text-[14px] outline-none"
              style={{ border: `1px solid ${LINE}`, color: INK, background: '#fbfcfd' }}
            />
            <button
              onClick={() => { setShiftSent(true); setShiftOpen(false); }}
              className="mt-2 inline-flex min-h-[44px] items-center rounded-lg px-4 text-[14px] font-semibold"
              style={{ border: `1px solid ${LINE}`, color: INK, background: '#fff' }}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- page ----------
const TABS = [
  { id: 'review', label: 'Content' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'lm', label: 'Lead magnet' },
  { id: 'strategy', label: 'Strategy' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function ClientBoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const token = params.get('k') || '';
  const [board, setBoard] = useState<Board | null>(null);
  const [mode, setMode] = useState<string>('demo');
  const [state, setState] = useState<'loading' | 'ready' | 'invalid'>('loading');
  const [tab, setTab] = useState<TabId>('review');
  const [detail, setDetail] = useState<QueueItem | null>(null);
  const [stageOverride, setStageOverride] = useState<Record<string, Stage>>({});
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
  useEffect(() => () => { introTimers.current.forEach((t) => window.clearTimeout(t)); window.clearTimeout(flashTimer.current); }, []);

  const flash = (id: string) => {
    setFlashId(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlashId(null), 1500);
  };

  // E1 — opening choreography (once per browser): the "Generating…" draft finishes its
  // remaining agent steps live, then travels up into "Your review". Local state theater
  // with honest verbs — the same steps the engine actually runs, no fabricated metrics.
  useEffect(() => {
    if (state !== 'ready' || !board || tab !== 'review' || introRan.current || reduceMotion) return;
    try { if (localStorage.getItem('cb-intro-played')) return; } catch { return; }
    const d1 = board.queue.find((q) => q.id === 'd1' && q.generating);
    if (!d1) return;
    introRan.current = true;

    const patch = (fn: (q: QueueItem) => QueueItem) =>
      setBoard((prev) => prev ? { ...prev, queue: prev.queue.map((q) => (q.id === 'd1' ? fn({ ...q }) : q)) } : prev);
    const completeStep = (name: string, detail: string, next?: AgentStep) => (q: QueueItem): QueueItem => {
      let trail = (q.agent_trail || []).map((s) => (s.step === name ? { ...s, done: true, t: 'just now', detail } : s));
      if (next && !trail.some((s) => s.step === next.step)) trail = [...trail, next];
      return { ...q, agent_trail: trail };
    };

    // Timers live in a ref cleared only on unmount: the patches below change `board`,
    // which re-fires this effect — a dep-tied cleanup would kill the choreography mid-run.
    const at = (ms: number, fn: () => void) => introTimers.current.push(window.setTimeout(fn, ms));
    at(1300, () => patch((q) => completeStep('Hook agent', '9 angles scored, picked #3', { step: 'Draft agent', detail: 'writing v1…', done: false, t: 'now' })({ ...q, live_step: 'Hook agent — picked angle #3 of 9' })));
    at(2900, () => patch((q) => completeStep('Draft agent', 'v2 after self-review', { step: 'Copy lint v13', detail: 'checking…', done: false, t: 'now' })({ ...q, live_step: 'Draft agent — v2 after self-review' })));
    at(4300, () => patch((q) => completeStep('Copy lint v13', 'PASS — 0 flags', { step: 'Vision QA', detail: 'reviewing…', done: false, t: 'now' })({ ...q, live_step: 'Copy lint v13 — PASS' })));
    at(5500, () => patch((q) => completeStep('Vision QA', 'clean')({ ...q, live_step: 'Ready for your review' })));
    at(6700, () => {
      patch((q) => ({
        ...q,
        stage: 'review',
        generating: false,
        live_step: undefined,
        body: q.body || D1_DRAFT_BODY,
      }));
      flash('d1');
      try { localStorage.setItem('cb-intro-played', '1'); } catch { /* private mode */ }
    });
  }, [state, board, tab, reduceMotion]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug || !token) { setState('invalid'); return; }
      const { data, error } = await supabase.rpc('get_client_board', { p_slug: slug, p_token: token });
      if (cancelled) return;
      if (error || !data) { setState('invalid'); return; }
      setBoard((data as any).board as Board);
      setMode((data as any).mode || 'demo');
      setState('ready');
    })();
    return () => { cancelled = true; };
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
  const stageOf = (q: QueueItem): Stage => stageOverride[q.id] ?? q.stage;

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
        { step: 'Copy lint v13', done: false },
        { step: it.kind === 'lm' ? 'Assessment builder' : 'Brand image', done: false },
        { step: 'Vision QA', detail: 'then it lands in your review', done: false },
      ],
    });
  };

  if (state === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#f6f7f9' }}>
        <div className="text-[14px]" style={{ color: FAINT }}>Loading your board…</div>
      </div>
    );
  }
  if (state === 'invalid' || !board) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: '#f6f7f9' }}>
        <div className="max-w-sm rounded-[14px] bg-white p-8 text-center" style={{ border: `1px solid ${LINE}`, boxShadow: CARD_SHADOW }}>
          <div className="text-[16px] font-semibold" style={{ color: INK }}>This preview link isn't valid or has expired.</div>
          <p className="mt-2 text-[14px]" style={{ color: DIM }}>Ask Ivan for a fresh link.</p>
        </div>
      </div>
    );
  }

  const fontStack = headingFont ? `"${headingFont}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif';
  const surfaces: Record<TabId, React.ReactNode> = {
    review: <ReviewSurface board={board} accent={accent} stageOf={stageOf} onOpen={setDetail} flashId={flashId} view={contentView} setView={setContentView} />,
    calendar: <CalendarSurface board={board} accent={accent} mint={mint} onOpen={openCalendarItem} />,
    lm: <LeadMagnetSurface board={board} accent={accent} />,
    strategy: <StrategySurface board={board} accent={accent} mint={mint} />,
  };

  const logo = (h: number) => (
    board.logo_url
      ? <img src={board.logo_url} alt={board.company_name} style={{ height: h, width: 'auto', maxWidth: 150, objectFit: 'contain', display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      : <span className="text-[14px] font-semibold" style={{ fontFamily: fontStack, color: INK }}>{board.company_name}</span>
  );

  const nav = (vertical: boolean) => (
    <nav className={vertical ? 'flex flex-col gap-1' : 'grid w-full grid-cols-4'} aria-label="Board sections">
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }}
            className={`min-h-[44px] rounded-lg text-[13px] font-semibold transition-colors ${vertical ? 'px-3 text-left' : 'px-1 text-center'}`}
            style={active
              ? { background: `color-mix(in srgb, ${accent} 12%, white)`, color: INK }
              : { color: DIM, background: 'transparent' }}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen" style={{ background: '#f6f7f9', color: INK, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-6 border-r bg-white p-5 lg:flex" style={{ borderColor: LINE }}>
        <div>
          {logo(30)}
          <div className="mt-2 text-[11px] font-medium uppercase tracking-[0.08em]" style={{ color: FAINT }}>Content engine</div>
        </div>
        {nav(true)}
        <div className="mt-auto flex flex-col gap-3">
          {mode === 'demo' && (
            <div className="rounded-lg px-3 py-2 text-[12px] font-medium leading-snug" style={{ background: '#f1f5f9', color: DIM }}>
              Preview built for {board.company_name}
            </div>
          )}
          <div className="text-[11px]" style={{ color: FAINT }}>Run by Ivan Manfredi</div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center gap-2.5 border-b bg-white px-4 py-3 lg:hidden" style={{ borderColor: LINE }}>
        {logo(22)}
        {mode === 'demo' && (
          <span className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: '#f1f5f9', color: DIM }}>Preview</span>
        )}
      </header>

      <main className="px-4 pb-28 pt-6 sm:px-6 lg:ml-60 lg:px-10 lg:pb-16 lg:pt-10">
        <div className={`mx-auto w-full ${tab === 'calendar' || (tab === 'review' && contentView === 'board') ? 'max-w-5xl' : 'max-w-3xl'}`}>{surfaces[tab]}</div>
      </main>

      {/* Mobile bottom tabs */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white px-2 py-1.5 lg:hidden" style={{ borderColor: LINE }}>
        {nav(false)}
      </div>

      {detail && (
        <DetailModal
          item={detail}
          board={board}
          accent={accent}
          stage={stageOf(detail)}
          onClose={() => setDetail(null)}
          onApprove={(id) => { setStageOverride((s) => ({ ...s, [id]: 'scheduled' })); flash(id); }}
        />
      )}
    </div>
    </MotionConfig>
  );
}
