import React, { useEffect, useState } from 'react';

/** Word-boundary truncation for list rows: the fold is real (string level), the full
 *  copy is one click away in the post modal. */
const truncAt = (t: string, cap: number) => (t.length <= cap ? t : t.slice(0, t.lastIndexOf(' ', cap)).trimEnd() + '\u2026');
const stripBrand = (t?: string | null) => (t || '').replace(/^\[[^\]]*\]\s*/, '');
import {
  FunnelChip, fmtDay, inkOn,
} from '../ClientBoardPage';
import type {
  Board, QueueItem, Stage, Idea, PoolDraft, AltAngle, SlotReplacement, HistoryEntry,
} from '../ClientBoardPage';
import {
  Eyebrow, DeskH2, Footnote, Plate, PlateMute, PlateRule, Num, Stat, StatStrip,
  Chip, Pill, Delta, Drill, Diff, Thumb, SlideStrip,
} from './desk-kit';

/**
 * DeskReviewSurface — the "All content" desk-skin tab.
 *
 * Presentation-only rebuild of `ReviewSurface` (components/ClientBoardPage.tsx) matched to
 * the approved static reference (phase3-panels/frag-review.html). Every prop below is copied
 * from ReviewSurface's interface UNCHANGED, plus one addition (`fetchHistory`, used to fan the
 * client_board_draft_history RPC across the queue for the Changes log). ClientBoardPage.tsx is
 * NOT edited by this file — the integrator wires this component in separately.
 * The freed-slot panel (skips/replacements/pool/bench/onRestore/onPick*) renders in the
 * row body — see the panel block below the row header.
 *
 * A handful of the original's callbacks (onApprove/onRemove/leftEmpty/replacements/pool/
 * the approved reference for this tab — they are kept in the prop interface for wiring parity
 * with ReviewSurface (so the integrator can pass the exact same object through both surfaces),
 * but this file does not invoke them. See the build report for the full list.
 */

const CLIENT_TZ = 'America/Los_Angeles';

/** Mirrors ClientBoardPage's (unexported) isScheduled: a post has a real forward slot once it
 *  carries either a full timestamp or a bare publish date. */
function isScheduledLocal(q: Pick<QueueItem, 'scheduled_at' | 'publish_date'>): boolean {
  return !!(q.scheduled_at || q.publish_date);
}

/** Mirrors ClientBoardPage's (unexported) cardImageUrl: the post's own image first, then its
 *  plumbed cover, then — for a lead-magnet post — the LM's active cover. */
function cardImageUrlLocal(q: QueueItem, board: Pick<Board, 'lead_magnets'>): string | undefined {
  if (q.media_url) return q.media_url;
  if (q.image_urls && q.image_urls.length && q.image_urls[0]) return q.image_urls[0];
  if (q.image) return q.image;
  if (q.cover_url) return q.cover_url;
  const lms = board.lead_magnets || [];
  const isLaunch = q.lm_launch || q.source_detail?.kind === 'lm_launch';
  const slug = (q.source_detail?.lm_ref || '').trim();
  let lm = q.lm_ref ? lms.find((e) => e.id === q.lm_ref) : undefined;
  if (!lm && slug) lm = lms.find((e) => (e.url || '').includes(slug));
  if (!lm && q.kind === 'lm' && q.title) lm = lms.find((e) => (e.title || '').toLowerCase() === (q.title || '').toLowerCase());
  const cov = lm ? (lm.cover_url || (lm.covers && lm.covers[0])) : undefined;
  if (cov) return cov;
  if (isLaunch && slug && /^[a-z0-9-]+$/.test(slug)) {
    const anyUrl = lms.map((e) => e.url).find((u) => u && /^https?:\/\//.test(u));
    if (anyUrl) { try { return `${new URL(anyUrl).origin}/${slug}/assets/cover.jpg`; } catch { /* no guess */ } }
  }
  return undefined;
}

/** Mirrors ClientBoardPage's (unexported) kickerOf: the client-readable format label. */
const KIND_LABEL: Record<string, string> = { post: 'Text post', carousel: 'Carousel', lm: 'Lead magnet', newsletter: 'Newsletter', newsjack: 'Reactive slot' };
function kickerOfLocal(q: Pick<QueueItem, 'kind' | 'media_url' | 'lm_launch' | 'style'>): string {
  if (q.lm_launch) return 'Lead magnet launch';
  if (q.style === 'video') return 'Video';
  if (q.kind === 'post') return q.media_url ? 'Image post' : 'Text post';
  return KIND_LABEL[q.kind] || q.kind;
}

/** Mirrors ClientBoardPage's (unexported) sourceChip: the honest, concrete provenance —
 *  never a vague "Picked by Ivan". Only ever called for live boards (see original). */
function sourceChipLocal(q: Pick<QueueItem, 'source_detail' | 'source_label'>): { label: string; quote?: string | null } | null {
  const sd = q.source_detail;
  if (sd) {
    if (sd.kind === 'call') {
      const who = (sd.call_title || '').replace(/^Intro Call w\/\s*RISE DTC\s*-\s*/i, '').replace(/^ZOOM Meeting\s*-\s*RISE DTC\s*\/\/\s*/i, '').trim();
      return { label: who ? `From your sales call · ${who}` : (sd.label || 'From your sales call'), quote: sd.quote };
    }
    if (sd.kind === 'strategy') return null;
    return { label: sd.label || '', quote: null };
  }
  if (q.source_label) return { label: q.source_label, quote: null };
  return null;
}

/** A short LA-time stamp for history rows ("31 Jul 04:45") and reschedule values. */
function fmtWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString('en-GB', { timeZone: CLIENT_TZ, day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: CLIENT_TZ, hour: '2-digit', minute: '2-digit' });
  return `${day} ${time}`;
}

/** History entries carry either editable copy (before/after are the draft body) or a bare
 *  ISO instant (reschedule). Render whichever it really is — never invent either. */
function prettyHistoryValue(s?: string | null): string {
  if (!s) return '';
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? fmtWhen(s) : s;
}

/** Mirrors DetailModal's (unexported) historyLabel, extended with the two action kinds the
 *  frag shows that DetailModal's switch does not name (reschedule, media change) — those fall
 *  back to the same `action.replace(/_/g,' ')` DetailModal itself uses, so an unrecognised
 *  action string still reads sensibly instead of breaking. */
/** Only client-meaningful actions reach the log. Operator sessions also write internal
 *  ops notes (born-inert markers, goal-run stamps) through the same RPC — those are
 *  build telemetry, never client copy. */
const CLIENT_ACTIONS = new Set(['edit_copy', 'approve', 'request_changes', 'changes', 'reschedule', 'schedule_change', 'resched', 'set_schedule', 'schedule', 'image_change', 'media_change', 'set_media']);
const CLIENT_EVENTS = new Set(['angle_swap', 'angle_swap_undone', 'post_removed', 'post_restored', 'undo_approve']);
function historyLabelLocal(h: HistoryEntry): string {
  if (h.action === 'edit_copy') return 'Copy edited';
  if (h.action === 'approve') return 'Approved';
  if (h.action === 'request_changes') return 'Change requested';
  // `set_schedule` is what the schedule RPC actually writes (client_board_set_schedule);
  // it was falling through to the raw-key fallback and printing "set schedule", which also
  // made the footer's reschedule counter read 0 with four of them on screen.
  if (h.action === 'reschedule' || h.action === 'schedule_change' || h.action === 'resched'
    || h.action === 'set_schedule' || h.action === 'schedule') return 'Rescheduled';
  if (h.action === 'image_change' || h.action === 'media_change' || h.action === 'set_media') return 'Image changed';
  if (h.action === 'note') {
    switch (h.event) {
      case 'angle_swap': return 'Idea swapped';
      case 'angle_swap_undone': return 'Swap undone';
      case 'post_removed': return 'Post removed';
      case 'post_restored': return 'Post restored';
      case 'undo_approve': return 'Approve walked back';
      default: return 'Note sent';
    }
  }
  return h.action.replace(/_/g, ' ');
}

/** The house name for every writer that is not the founder: operator emails, tooling
 *  session ids and nulls all resolve to one client-facing label ("RISE DTC desk"). */
function deskLabelOf(board: Pick<Board, 'brand' | 'company_name'>): string {
  const wordmark = (board.brand?.wordmark || '').trim();
  const firstWord = (board.company_name || '').trim().split(/\s+/)[0] || '';
  return `${wordmark || firstWord || 'The'} desk`;
}

/** Client-facing identity for a log row. `by` is whatever wrote it — "Mattan",
 *  "mattan@risedtc.com", "im@ivanmanfredi.com", "claude-code (operator session)", null.
 *  Only the founder is ever named; everything else is the desk. A raw email or a session
 *  id must never reach the client's screen, so this is the ONLY thing the chip renders,
 *  and the founder filter reads the same verdict. */
function authorOf(by: string | null | undefined, board: Pick<Board, 'founder' | 'brand' | 'company_name'>, deskLabel: string): { label: string; founder: boolean } {
  const raw = (by || '').trim();
  const fullName = (board.founder?.name || '').trim();
  const first = (board.founder?.first_name || '').trim() || fullName.split(/\s+/)[0] || '';
  if (!raw || !first) return { label: deskLabel, founder: false };
  const norm = (s: string) => s.toLowerCase().replace(/[._\-+]+/g, ' ').replace(/\s+/g, ' ').trim();
  const local = raw.includes('@') ? raw.slice(0, raw.indexOf('@')) : raw;
  const want = new Set([norm(fullName), norm(first)].filter(Boolean));
  const founder = want.has(norm(raw)) || want.has(norm(local));
  return { label: founder ? first : deskLabel, founder };
}

/** The move a reschedule made: "27 Jul 20:05 → 22:05" within a day, both stamps across
 *  days. Null unless both ends are real instants — the row then just carries its label. */
function rescheduleMove(before?: string | null, after?: string | null): string | null {
  const isStamp = (s?: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}T/.test(s) && !Number.isNaN(new Date(s).getTime());
  if (!isStamp(before) || !isStamp(after)) return null;
  const day = (s: string) => new Date(s).toLocaleDateString('en-GB', { timeZone: CLIENT_TZ, day: 'numeric', month: 'short' });
  const time = (s: string) => new Date(s).toLocaleTimeString('en-GB', { timeZone: CLIENT_TZ, hour: '2-digit', minute: '2-digit' });
  return day(before) === day(after)
    ? `${day(before)} ${time(before)} → ${time(after)}`
    : `${fmtWhen(before)} → ${fmtWhen(after)}`;
}

/** Real per-post reads/rate, matched off board.performance.posts by title (fallback: publish
 *  date). Absent when unmatched — never a fabricated number. */
function perfFor(board: Board, q: QueueItem): { reads: number; rate: string | null } | null {
  const posts = board.performance?.posts || [];
  if (!posts.length) return null;
  const norm = (s?: string) => (s || '').replace(/^\[[^\]]*\]\s*/, '').trim().toLowerCase();
  const wanted = norm(q.title || q.hook);
  const hit = posts.find((p) => wanted && norm(p.title) === wanted)
    || posts.find((p) => !!q.publish_date && (p.published_at || '').slice(0, 10) === q.publish_date);
  if (!hit || hit.impressions == null) return null;
  // Rate = engagements over reads — the SAME definition Performance uses. Two tabs
  // disagreeing on what "rate" means was round-2 finding D.
  const eng = (hit.reactions || 0) + (hit.comments || 0);
  const rate = hit.impressions ? `${((eng / hit.impressions) * 100).toFixed(1)}%` : null;
  return { reads: hit.impressions, rate };
}

type Bucket = 'upnext' | 'buffer' | 'published';

function statusChipFor(stage: Stage, q: QueueItem, live: boolean, todayIso: string): { label: string; accent?: boolean } | null {
  if (stage === 'published' || stage === 'drafted') return null;
  if (live) {
    if (isScheduledLocal(q)) return q.publish_date === todayIso ? { label: 'ships today', accent: true } : { label: 'scheduled' };
    return { label: 'in buffer' };
  }
  if (stage === 'review') return { label: 'in review' };
  if (stage === 'scheduled') return q.publish_date === todayIso ? { label: 'ships today', accent: true } : { label: 'scheduled' };
  return { label: 'in buffer' };
}

export default function DeskReviewSurface({
  board, accent, mint, stageOf, onOpen, onOpenIdea, onApprove, onRemove, flashId, view, setView, skips,
  leftEmpty = {}, onLeaveEmpty, onRefillDay, onBackToBuffer, onLeaveDayEmpty, onClearDay, onEditPromo,
  replacements = {}, pool = [], benchFor, onRestore, onPickReplacement, onPickReplacementAngle,
  foldPhotos, foldCalendar, live = false, fetchHistory,
}: {
  board: Board; accent: string; mint: string;
  stageOf: (q: QueueItem) => Stage;
  onOpen: (q: QueueItem, opts?: { changing?: boolean; editing?: boolean; scheduling?: boolean }) => void;
  onOpenIdea: (idea: Idea) => void;
  live?: boolean;
  onApprove: (id: string) => void;
  onRemove?: (id: string) => void;
  leftEmpty?: Record<string, true>;
  onLeaveEmpty?: (id: string) => void;
  onRefillDay?: (id: string) => void;
  onBackToBuffer?: (id: string) => void;
  onLeaveDayEmpty?: (id: string, date?: string) => void;
  onClearDay?: (id: string, date?: string) => Promise<{ ok: boolean; error?: string }>;
  onEditPromo?: (lmId: string, field: 'email' | 'dm', value: unknown) => Promise<{ ok: boolean; error?: string }>;
  flashId: string | null;
  view: 'list' | 'board' | 'feed' | 'calendar';
  setView: (v: 'list' | 'board' | 'feed' | 'calendar') => void;
  skips: Record<string, true>;
  replacements?: Record<string, SlotReplacement>;
  pool?: PoolDraft[];
  benchFor?: (id: string) => AltAngle[];
  onRestore?: (id: string) => void;
  onPickReplacement?: (id: string, item: PoolDraft) => void;
  onPickReplacementAngle?: (id: string, alt: AltAngle) => void;
  foldPhotos?: React.ReactNode;
  foldCalendar?: React.ReactNode;
  /** Live board: per-draft history (client_board_draft_history RPC), fanned across the whole
   *  queue for the Changes log. Absent on preview/demo boards — the log renders nothing. */
  fetchHistory?: (ref: string) => Promise<HistoryEntry[]>;
}) {
  // Unused-here wiring kept for interface parity with ReviewSurface (see file header):
  // onApprove, onRemove, leftEmpty, onLeaveEmpty, onRefillDay, onBackToBuffer, onLeaveDayEmpty,
  // onClearDay, onEditPromo, replacements, pool, benchFor, onRestore, onPickReplacement,
  // onPickReplacementAngle, skips — none has a block in the approved reference.
  // (foldPhotos DOES render — the photo library block near the foot of the list view.)
  void onApprove; void onRemove; void leftEmpty; void onLeaveEmpty; void onRefillDay; void onBackToBuffer;
  void onLeaveDayEmpty; void onClearDay; void onEditPromo; void replacements; void pool; void benchFor;
  void onRestore; void onPickReplacement; void onPickReplacementAngle; void skips; void mint;

  const todayIso = new Date().toISOString().slice(0, 10);
  const byDate = (a: QueueItem, b: QueueItem) => (a.publish_date || '9999-99').localeCompare(b.publish_date || '9999-99');

  // ---- Block 1/2: pipeline headline + counts (deskPipelineTitle, replicated) ----
  const out = board.queue.filter((x) => stageOf(x) === 'published').length;
  const sched = board.queue.filter((x) => stageOf(x) !== 'published' && isScheduledLocal(x)).length;
  const buffer = board.queue.filter((x) => stageOf(x) !== 'published' && !isScheduledLocal(x)).length;
  const total = board.queue.length;
  const parts = [out ? `${out} out` : null, sched ? `${sched} scheduled` : null, buffer ? `${buffer} in the buffer` : null].filter(Boolean) as string[];

  // Aim mix across the whole queue.
  const aim = { reach: 0, trust: 0, buyers: 0 } as Record<'reach' | 'trust' | 'buyers', number>;
  board.queue.forEach((q) => { if (q.funnel_stage === 'reach' || q.funnel_stage === 'trust' || q.funnel_stage === 'buyers') aim[q.funnel_stage]++; });
  const aimTotal = aim.reach + aim.trust + aim.buyers;

  // ---- Block 4: list-view buckets. Live merges review+scheduled into one dated "Scheduled"
  // bucket (the operator's "Up next"); preview keeps the four real stages separate. Both
  // orderings are pipeline-first, published last — see file header + build report. ----
  const draftedRows = board.queue.filter((q) => stageOf(q) === 'drafted');
  const publishedRows = board.queue.filter((q) => stageOf(q) === 'published').slice().sort(byDate);
  const ideas = (!live && board.ideas) ? board.ideas : [];

  let upNextRows: QueueItem[] = [];
  let bufferRows: QueueItem[] = [];
  let scheduledRows: QueueItem[] = [];
  let reviewRows: QueueItem[] = [];
  if (live) {
    upNextRows = board.queue.filter((q) => stageOf(q) !== 'published' && stageOf(q) !== 'drafted' && isScheduledLocal(q)).slice().sort(byDate);
    bufferRows = board.queue.filter((q) => stageOf(q) === 'review' && !isScheduledLocal(q));
  } else {
    reviewRows = board.queue.filter((q) => stageOf(q) === 'review').slice().sort(byDate);
    scheduledRows = board.queue.filter((q) => stageOf(q) === 'scheduled').slice().sort(byDate);
  }

  // ---- Block 6: changes log — fan fetchHistory across the queue, tagged with the post title.
  const [entries, setEntries] = useState<(HistoryEntry & { postId: string; postTitle: string })[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [who, setWho] = useState<'all' | 'founder'>('all');
  const founderFirst = (board.founder?.first_name || '').trim() || (board.founder?.name || '').trim().split(/\s+/)[0] || '';
  const deskLabel = deskLabelOf(board);
  const queueKey = board.queue.map((q) => q.id).join(',');
  useEffect(() => {
    if (!fetchHistory) { setEntries(null); return; }
    let gone = false;
    setHistoryLoading(true);
    Promise.all(board.queue.map((q) => fetchHistory(q.id)
      .then((items) => items.map((h) => ({ ...h, postId: q.id, postTitle: q.title || q.hook || 'Untitled post' }))).then((items) => items.filter((h) => CLIENT_ACTIONS.has(h.action) || (h.action === 'note' && CLIENT_EVENTS.has(h.event || ''))))
      .catch(() => [] as (HistoryEntry & { postId: string; postTitle: string })[])))
      .then((lists) => {
        if (gone) return;
        setEntries(lists.flat().sort((a, b) => (b.at || '').localeCompare(a.at || '')));
        setHistoryLoading(false);
      });
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey, !!fetchHistory]);
  // One identity verdict per row, used by BOTH the display chip and the founder filter —
  // they can never disagree, and neither ever touches the raw `by` string.
  const filteredEntries = (entries || []).filter((e) => who === 'all' || authorOf(e.by, board, deskLabel).founder);
  const copyEdits = filteredEntries.filter((e) => e.action === 'edit_copy').length;
  const reschedules = filteredEntries.filter((e) => historyLabelLocal(e) === 'Rescheduled').length;

  // Per-post grouping for the card-level history affordance ("changed N times · last …").
  // Same fetched, whitelist-filtered entries as the global log — no extra RPC, no wider set.
  // Global sort is newest-first, so each post's slice arrives newest-first too.
  const entriesByPost: Record<string, (HistoryEntry & { postId: string; postTitle: string })[]> = {};
  (entries || []).forEach((e) => { (entriesByPost[e.postId] = entriesByPost[e.postId] || []).push(e); });

  // ---- Row renderer (Blocks 4 + list rows inside Block 5's mini-list share the thumb math) ----
  const renderRow = (q: QueueItem, bucket: Bucket) => {
    const stage = stageOf(q);
    const img = cardImageUrlLocal(q, board);
    const slides = (q.kind === 'carousel' || q.style === 'carousel') ? (q.image_urls || []).filter(Boolean) : [];
    const dateLabel = bucket === 'buffer' ? 'no date yet' : (fmtDay(q.publish_date) || (bucket === 'published' ? 'date unknown' : 'date at sign-off'));
    const chip = statusChipFor(stage, q, live, todayIso);
    const provenance = live ? sourceChipLocal(q) : null;
    const perf = bucket === 'published' ? perfFor(board, q) : null;
    const flashed = flashId === q.id;
    const shipsToday = chip?.accent;
    return (
      <div
        key={q.id}
        style={{
          padding: shipsToday ? '26px 14px 20px' : '24px 14px 18px',
          marginTop: shipsToday ? 10 : 0,
          background: shipsToday ? 'color-mix(in srgb, var(--cb-accent) 6%, var(--cb-paper))' : (flashed ? 'color-mix(in srgb, var(--cb-accent) 7%, var(--cb-paper))' : undefined),
          borderLeft: shipsToday ? '3px solid var(--cb-accent)' : undefined,
          borderRadius: shipsToday ? '0 14px 14px 0' : undefined,
          borderBottom: shipsToday ? undefined : '1px solid var(--cb-line)',
          transition: 'background-color 700ms ease',
        }}
      >
        <div
          role="button" tabIndex={0}
          onClick={() => onOpen(q)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(q); } }}
          style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', cursor: 'pointer' }}
        >
          {img && <Thumb src={img} size="lg" />}
          <div style={{ flex: '1 1 210px', minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.35, color: 'var(--cb-ink)' }}>{truncAt(stripBrand(q.title || q.hook), 72)}</div>
            <div style={{ marginTop: 7, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--cb-ink-mute)' }}>{dateLabel}</span>
              <Chip>{kickerOfLocal(q)}</Chip>
              <FunnelChip stage={q.funnel_stage} accent={accent} />
            </div>
          </div>
          {bucket === 'published' ? (
            perf ? (
              <span style={{ flex: 'none', marginLeft: 'auto', display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                <Num size="row" inline>{perf.reads.toLocaleString()}</Num>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>reads{perf.rate ? ` · ${perf.rate}` : ''}</span>
              </span>
            ) : <Chip style={{ flex: 'none', marginLeft: 'auto' }}>out</Chip>
          ) : chip ? (
            <Chip tone={chip.accent ? 'accent' : 'default'} style={chip.accent ? { flex: 'none', marginLeft: 'auto', color: inkOn(accent) } : { flex: 'none', marginLeft: 'auto' }}>{chip.label}</Chip>
          ) : null}
        </div>
        {/* Freed slot (the client removed this post from its day): restore, refill from
            the bench/pool, or hold the day - the original review's panel, desk-set. */}
        {skips[q.id] && bucket !== 'published' && (
          replacements[q.id] ? (
            <div style={{ marginTop: 10, borderRadius: 14, padding: 14, background: 'color-mix(in srgb, var(--cb-accent) 6%, var(--cb-paper))', border: '1px solid color-mix(in srgb, var(--cb-accent) 30%, var(--cb-line))' }}>
              <Eyebrow>now running in this slot</Eyebrow>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--cb-ink)', marginTop: 5 }}>{replacements[q.id]?.title || 'A ready draft'}</div>
              {onRestore && <Pill onClick={() => onRestore(q.id)} style={{ marginTop: 10 }}>Undo, bring the original back</Pill>}
            </div>
          ) : (
            <div style={{ marginTop: 10, borderRadius: 14, padding: 14, border: '2px dashed var(--cb-line-bold)' }}>
              <Eyebrow>your slot, open</Eyebrow>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {onRestore && <Pill onClick={() => onRestore(q.id)}>Restore this post</Pill>}
                {onLeaveEmpty && <Pill onClick={() => onLeaveEmpty(q.id)}>Leave this day empty</Pill>}
              </div>
              {(() => {
                const bench = benchFor ? benchFor(q.id) : [];
                if (bench.length === 0 && pool.length === 0) return <Footnote style={{ marginTop: 10 }}>No other ready drafts to pull in yet.</Footnote>;
                return (
                  <Drill label="pick a replacement" ruled={false} style={{ marginTop: 6 }}>
                    {bench.map((alt) => (
                      <div key={alt.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 0', borderTop: '1px solid var(--cb-line)' }}>
                        <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>{alt.title}</span>
                        {onPickReplacementAngle && <Pill tone="accent" onClick={() => onPickReplacementAngle(q.id, alt)}>Use this</Pill>}
                      </div>
                    ))}
                    {pool.map((it) => (
                      <div key={it.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '8px 0', borderTop: '1px solid var(--cb-line)' }}>
                        <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: 13.5, fontWeight: 600 }}>{it.title || 'Ready draft'}</span>
                        {onPickReplacement && <Pill tone="accent" onClick={() => onPickReplacement(q.id, it)}>Use this</Pill>}
                      </div>
                    ))}
                  </Drill>
                );
              })()}
            </div>
          )
        )}
        <Drill label="open →" style={{ marginTop: 2 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)' }}>Hook</div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--cb-ink)', lineHeight: 1.4, marginTop: 5 }}>{truncAt(stripBrand(q.hook || q.title), 88)}</div>
          {slides.length >= 2 ? (
            <>
              <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)', marginTop: 12 }}>The slides · {slides.length}</div>
              <SlideStrip srcs={slides} style={{ marginTop: 7 }} />
            </>
          ) : q.body ? (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12 }}>
              {img && <img src={img} alt="" loading="lazy" style={{ flex: 'none', width: 180, height: 'auto', border: '1px solid var(--cb-line)', borderRadius: 6 }} />}
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)' }}>The copy</div>
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--cb-ink-mute)', whiteSpace: 'pre-line', marginTop: 5, display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{q.body}</div>
              </div>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 13 }}>
            <Chip>{kickerOfLocal(q)}</Chip>
            {provenance?.label && <Chip>{provenance.label}</Chip>}
          </div>
          {bucket !== 'published' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Pill onClick={() => onOpen(q, { editing: true })}>Edit copy</Pill>
              <Pill onClick={() => onOpen(q, { scheduling: true })}>Edit time</Pill>
              {!live && <Pill onClick={() => onOpen(q, { changing: true })}>Swap slot</Pill>}
            </div>
          )}
        </Drill>
        {/* This post's own history: only when it HAS whitelisted entries (zero-history posts
            render nothing — no "0 changes"). Same fetched set, same wording as the global
            log; a plain span (not a Chip) carries the author so the identity mapping still
            holds without adding card-level chip noise. */}
        {(entriesByPost[q.id] || []).length > 0 && (
          <div data-post-log={q.id}>
            <Drill
              className="post-log" label="open it" ruled={false}
              summaryStyle={{ padding: '4px 0' }}
              summaryLeft={
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>
                  changed {entriesByPost[q.id].length} {entriesByPost[q.id].length === 1 ? 'time' : 'times'} · last {fmtWhen(entriesByPost[q.id][0].at)}
                </span>
              }
            >
              {entriesByPost[q.id].map((h, i) => {
                const author = authorOf(h.by, board, deskLabel);
                const label = historyLabelLocal(h);
                const move = label === 'Rescheduled' ? rescheduleMove(h.before, h.after) : null;
                return (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid var(--cb-line)' }}>
                    <span style={{ flex: 'none', width: 84, fontSize: 11.5, fontWeight: 800, color: 'var(--cb-ink-mute)', whiteSpace: 'nowrap' }}>{fmtWhen(h.at)}</span>
                    <span style={{ flex: 'none', fontSize: 11.5, fontWeight: 800, color: author.founder ? 'var(--cb-ink)' : 'var(--cb-ink-mute)' }}>{author.label}</span>
                    <span style={{ flex: '1 1 120px', minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--cb-ink)' }}>
                      {label}
                      {move && <span style={{ color: 'var(--cb-ink-mute)', fontVariantNumeric: 'tabular-nums' }}> · {move}</span>}
                    </span>
                  </div>
                );
              })}
            </Drill>
          </div>
        )}
      </div>
    );
  };

  const renderDraftedRow = (q: QueueItem) => (
    <div key={q.id} style={{ padding: '18px 14px 12px', borderBottom: '1px solid var(--cb-line)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {cardImageUrlLocal(q, board) && <Thumb src={cardImageUrlLocal(q, board)!} size="lg" />}
      <div style={{ flex: '1 1 210px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.35, color: 'var(--cb-ink)' }}>{truncAt(stripBrand(q.title || q.hook) || 'Untitled', 72)}</div>
        <div style={{ marginTop: 6, fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>{q.live_step || 'Being written…'}</div>
      </div>
    </div>
  );

  const renderIdeaRow = (idea: Idea) => (
    <div
      key={idea.id} role="button" tabIndex={0}
      onClick={() => onOpenIdea(idea)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenIdea(idea); } }}
      style={{ padding: '18px 14px 12px', borderBottom: '1px solid var(--cb-line)', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
    >
      <div style={{ flex: '1 1 210px', minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 15.5, lineHeight: 1.35, color: 'var(--cb-ink)' }}>{idea.title}</div>
        {idea.hook && <div style={{ marginTop: 4, fontSize: 13, color: 'var(--cb-ink-mute)' }}>{idea.hook}</div>}
      </div>
      {idea.pillar && <Chip>{idea.pillar}</Chip>}
      <Chip style={{ flex: 'none', marginLeft: 'auto' }}>queued as an idea</Chip>
    </div>
  );

  const section = (label: string, count: number, blurb: string, rows: React.ReactNode, key: string) => count > 0 ? (
    <div key={key} style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', paddingBottom: 12, borderBottom: '2px solid var(--cb-ink)' }}>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--cb-ink)', flex: '1 1 auto' }}>{label}</div>
        <Num size="row" inline style={{ fontSize: 19 }}>{count}</Num>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>{blurb}</span>
      </div>
      {rows}
    </div>
  ) : null;

  // NOTE: the reference's dated mini-list is deliberately NOT rendered here. In the List
  // view it re-listed every row the Scheduled/Out sections print directly above it (critic
  // BLOCKER-4, ~900px of straight duplication). The dated enumeration lives in the Calendar
  // view only — see DeskCalendarStrip.

  return (
    <div data-surface="review">

      {/* Block 1: computed headline. */}
      <Eyebrow>All content</Eyebrow>
      <DeskH2>
        {total} {total === 1 ? 'post' : 'posts'} in the pipeline{parts.length ? <>: <b>{parts.join(', ')}.</b></> : '.'}
      </DeskH2>

      {/* Block 2: dark plate — pipeline counts + aim mix. */}
      <Plate style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 28px', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <Num size="hero" tone="accent">{total}</Num>
            <Footnote on="plate" style={{ marginTop: 6 }}>in the pipeline</Footnote>
          </div>
          <div data-viz="" style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            {[
              { v: out, label: 'out', bg: 'var(--cb-accent)', tone: 'plate' as const },
              { v: sched, label: 'scheduled', bg: 'rgba(255,255,255,0.62)', tone: 'plate' as const },
              { v: buffer, label: 'in buffer', bg: 'rgba(255,255,255,0.26)', tone: 'plate-mute' as const },
            ].map((seg) => (
              <div key={seg.label} style={{ flex: `${Math.max(seg.v, 0.6)} 1 0`, minWidth: 0 }}>
                <div className="bar" style={{ height: 16, background: seg.bg, borderRadius: 6 }} />
                <div style={{ marginTop: 9 }}><Num size="row" inline tone={seg.tone}>{seg.v}</Num></div>
                <PlateMute as="div" style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{seg.label}</PlateMute>
              </div>
            ))}
          </div>
        </div>
        <PlateRule gap={20} />
        {aimTotal > 0 ? (
          <div style={{ marginTop: 15 }}>
            <div data-viz="" style={{ display: 'flex', gap: 4, height: 10 }}>
              <div style={{ flex: `${Math.max(aim.reach, 0.4)} 1 0`, minWidth: 0, background: 'var(--cb-accent)', borderRadius: 999 }} />
              <div style={{ flex: `${Math.max(aim.trust, 0.4)} 1 0`, minWidth: 0, background: 'rgba(255,255,255,0.55)', borderRadius: 999 }} />
              <div style={{ flex: `${Math.max(aim.buyers, 0.4)} 1 0`, minWidth: 0, background: 'rgba(255,255,255,0.24)', borderRadius: 999 }} />
            </div>
            <Footnote on="plate" style={{ marginTop: 9 }}>
              By aim <span style={{ color: 'var(--cb-plate-ink)' }}>{aim.reach} reach</span> · {aim.trust} trust · {aim.buyers} buyers
            </Footnote>
          </div>
        ) : (
          <Footnote on="plate" style={{ marginTop: 15 }}>Audience aim not tracked yet.</Footnote>
        )}
      </Plate>

      {/* Block 3: view toggle. */}
      <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Pill active={view === 'list'} onClick={() => setView('list')}>List</Pill>
        <Pill active={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</Pill>
      </div>

      {view === 'calendar' ? (
        foldCalendar || <Footnote>Calendar view not available yet.</Footnote>
      ) : (
        <div>
          {/* Block 4: list view, pipeline-first (Up next/Scheduled → In buffer → Published). */}
          {live ? (
            <>
              {section('Scheduled', upNextRows.length, 'posts, dated and queued', upNextRows.map((q) => renderRow(q, 'upnext')), 'upnext')}
              {section('In buffer', bufferRows.length, 'written, no date yet', bufferRows.map((q) => renderRow(q, 'buffer')), 'buffer')}
              {section('Drafting', draftedRows.length, 'Being written now. They move to your review when ready.', draftedRows.map(renderDraftedRow), 'drafted')}
              {section('Out', publishedRows.length, 'published, newest first', [
                ...publishedRows.slice(-6).reverse().map((q) => renderRow(q, 'published')),
                publishedRows.length > 6 ? (
                  <Drill key="earlier-out" label="open it" summaryLeft={<>Earlier: <b>{publishedRows.length - 6}</b> more published posts</>} style={{ marginTop: 4 }}>
                    {publishedRows.slice(0, -6).reverse().map((q, i) => (
                      <div key={q.id || i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', padding: '7px 0', borderTop: '1px solid var(--cb-line)' }}>
                        <span style={{ flex: 'none', width: 64, fontSize: 12, fontWeight: 800, color: 'var(--cb-ink-mute)' }}>{fmtDay(q.publish_date)}</span>
                        <button onClick={() => onOpen(q)} style={{ flex: '1 1 200px', minWidth: 0, textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--cb-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{stripBrand(q.hook || q.title) || 'Untitled'}</button>
                      </div>
                    ))}
                  </Drill>
                ) : null,
              ], 'published')}
            </>
          ) : (
            <>
              {section('Ideas', ideas.length, "The engine's upcoming idea bank. Each one drafts when it reaches its slot.", ideas.map(renderIdeaRow), 'ideas')}
              {section('Your review', reviewRows.length, 'Approve, or say what to change in plain words.', reviewRows.map((q) => renderRow(q, isScheduledLocal(q) ? 'upnext' : 'buffer')), 'review')}
              {section('Drafting', draftedRows.length, 'Being written now. They move to your review when ready.', draftedRows.map(renderDraftedRow), 'drafted')}
              {section('Scheduled', scheduledRows.length, 'Approved and queued to publish on their dates.', scheduledRows.map((q) => renderRow(q, 'upnext')), 'scheduled')}
              {section('Published', publishedRows.length, 'How live posts will report here once posting starts.', publishedRows.map((q) => renderRow(q, 'published')), 'published')}
            </>
          )}
          {publishedRows.length > 0 && <Footnote style={{ marginTop: 14 }}>Reach and rate per post live on Performance.</Footnote>}
        </div>
      )}

      {/* Block 6: changes log — absent fetchHistory (preview boards) renders nothing.
          Compact by request (2026-08-02): the per-post history now lives on each card, so
          this global block drops to footnote weight — 3 most-recent rows visible, the rest
          folded. Same whitelist, same identity mapping as before. */}
      {fetchHistory && (
        <div style={{ marginTop: 26 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', paddingBottom: 7, borderBottom: '1px solid var(--cb-line-bold)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)', flex: '1 1 auto' }}>Changes log</div>
            {entries !== null && entries.length > 0 && <Num size="row" inline style={{ fontSize: 13 }}>{entries.length}</Num>}
            {entries !== null && entries.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>changes on this board</span>}
            {entries !== null && entries.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginLeft: 6 }}>
                <Pill active={who === 'all'} onClick={() => setWho('all')}>All</Pill>
                {founderFirst && <Pill active={who === 'founder'} onClick={() => setWho('founder')}>{founderFirst}&rsquo;s</Pill>}
              </div>
            )}
          </div>
          {historyLoading && <Footnote style={{ marginTop: 10 }}>reading the log…</Footnote>}
          {!historyLoading && entries !== null && entries.length === 0 && <Footnote style={{ marginTop: 10 }}>No changes recorded yet.</Footnote>}
          {!historyLoading && filteredEntries.length > 0 && (
            <>
              {/* 3 recent entries visible; everything else folds. */}
              {filteredEntries.slice(0, 3).map((h, i) => {
                const author = authorOf(h.by, board, deskLabel);
                const label = historyLabelLocal(h);
                const move = label === 'Rescheduled' ? rescheduleMove(h.before, h.after) : null;
                const hasDiff = !move && !!(h.before && h.after);
                const delta = hasDiff && h.action === 'edit_copy' ? (h.after as string).length - (h.before as string).length : null;
                return (
                  <div key={i} data-log-row="" style={{ padding: '8px 0 6px', borderBottom: '1px solid var(--cb-line)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ flex: 'none', width: 84, fontSize: 11.5, fontWeight: 800, color: 'var(--cb-ink-mute)', whiteSpace: 'nowrap' }}>{fmtWhen(h.at)}</span>
                      <Chip tone={author.founder ? 'accent' : 'default'} style={{ flex: 'none' }}>{author.label}</Chip>
                      <span style={{ flex: 'none', fontSize: 12, fontWeight: 800, color: 'var(--cb-ink)' }}>{label}</span>
                      <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--cb-ink-mute)', lineHeight: 1.35 }}>{truncAt(h.postTitle || '', 58)}</span>
                    </div>
                    {move && (
                      <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--cb-ink-mute)', fontVariantNumeric: 'tabular-nums' }}>{move}</div>
                    )}
                    {hasDiff && (
                      <Drill label="see the edit" ruled={false} style={{ marginTop: 3 }} summaryStyle={{ padding: '4px 0' }}>
                        <Diff
                          before={prettyHistoryValue(h.before)}
                          after={prettyHistoryValue(h.after)}
                          meta={delta !== null ? <Delta>{delta >= 0 ? `+${delta}` : delta} characters</Delta> : undefined}
                        />
                      </Drill>
                    )}
                    {!hasDiff && h.note && <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>&ldquo;{h.note}&rdquo;</div>}
                  </div>
                );
              })}
              {filteredEntries.length > 3 && (
                <Drill label="open it" summaryLeft={<span style={{ fontSize: 12 }}>The earlier log: <b>{filteredEntries.length - 3}</b> more changes</span>} style={{ marginTop: 6 }} summaryStyle={{ padding: '7px 0' }}>
                  {filteredEntries.slice(3).map((h, i) => {
                    const author = authorOf(h.by, board, deskLabel);
                    return (
                      <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', padding: '7px 0', borderTop: '1px solid var(--cb-line)' }}>
                        <span style={{ flex: 'none', width: 84, fontSize: 11.5, fontWeight: 800, color: 'var(--cb-ink-mute)', whiteSpace: 'nowrap' }}>{fmtWhen(h.at)}</span>
                        <Chip tone={author.founder ? 'accent' : 'default'} style={{ flex: 'none' }}>{author.label}</Chip>
                        <span style={{ flex: 'none', fontSize: 12, fontWeight: 800, color: 'var(--cb-ink)' }}>{historyLabelLocal(h)}</span>
                        <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: 12, fontWeight: 600, color: 'var(--cb-ink-mute)', lineHeight: 1.35 }}>{truncAt(h.postTitle || '', 58)}</span>
                      </div>
                    );
                  })}
                </Drill>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <Chip>{copyEdits} copy edits</Chip>
                <Chip>{reschedules} reschedules</Chip>
              </div>
            </>
          )}
        </div>
      )}

      {/* Block 6b: the client's photo library. The page passes the full PhotosSurface node
          (its own upload/delete UI) on live boards; preview boards pass null and this whole
          block, header included, renders nothing. The node is opaque — rendered as-is, never
          wrapped in a drill: it is content-bearing, so it stays visible on the list view. */}
      {foldPhotos != null && view !== 'calendar' && (
        <div style={{ marginTop: 26 }}>
          <div style={{ paddingBottom: 7, borderBottom: '1px solid var(--cb-line-bold)' }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)' }}>The photo library</div>
          </div>
          <div style={{ marginTop: 12 }}>{foldPhotos}</div>
        </div>
      )}

      {/* Block 7: stat footer. */}
      <StatStrip>
        <Stat value={total} caption="written" />
        <Stat value={out} caption="out" />
        <Stat value={sched} caption="scheduled" />
        <Stat value={buffer} caption="in buffer" />
        {board.ideas && <Stat value={board.ideas.length} caption="ideas banked, ready to write" />}
      </StatStrip>
    </div>
  );
}
