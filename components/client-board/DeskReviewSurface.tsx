import React, { useEffect, useMemo, useRef, useState, useId } from 'react';
import PostSourceContext from './PostSourceContext';

/** Word-boundary truncation for list rows: the fold is real (string level), the full
 *  copy is one click away in the post modal. */
const truncAt = (t: string, cap: number) => (t.length <= cap ? t : t.slice(0, t.lastIndexOf(' ', cap)).trimEnd() + '\u2026');
const stripBrand = (t?: string | null) => (t || '').replace(/^\[[^\]]*\]\s*/, '');

/** The permalink of a post that actually went out. Only ever rendered when the queue item
 *  carries one, so it never promises a link the board cannot honour. */
function LivePostLink({ href }: { href: string }) {
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--cb-ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}
    >
      See it on LinkedIn
    </a>
  );
}

/** Full, selectable copy for review. Editing stays on the explicit Edit copy control. */
/** LinkedIn's own stack — the simulation never wears the desk's body face. */
const LI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

function CardBody({ text }: { text: string }) {
  return <div data-review-copy style={{ padding: '4px 14px 12px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{text}</div>;
}

const escapeHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Plain text out of a contentEditable: innerText folds the <div>/<br> a browser inserts on
 *  Enter back into newlines; jsdom has no innerText, so textContent covers tests. */
const readPlain = (el: HTMLElement) => (typeof el.innerText === 'string' ? el.innerText : (el.textContent || '')).replace(/\n+$/, '');

/** In-place post text (2026-09-10, Ivan): click into the copy, type, click away, it saves.
 *  Plain text only — HTML never enters the body. Escape puts the original back. Same
 *  saving/saved/error line as the feedback box. The explicit Edit copy control stays as the
 *  fallback. Clicks and keys inside never reach the card's open-the-modal handlers. */
function InlineBody({ text, onSave, style, wrapStyle, statusStyle }: {
  text: string;
  onSave: (body: string) => Promise<{ ok: boolean; error?: string }>;
  /** Typography of the text itself (the host's own), and the box around text + status line. */
  style?: React.CSSProperties;
  wrapStyle?: React.CSSProperties;
  statusStyle?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [focused, setFocused] = useState(false);
  /* One object per text value: React writes innerHTML whenever this prop's identity changes,
     so a fresh object on every status re-render would wipe what the client just typed. */
  const html = useMemo(() => ({ __html: escapeHtml(text) }), [text]);
  useEffect(() => {
    if (state !== 'saved') return;
    const t = setTimeout(() => setState('idle'), 3000);
    return () => clearTimeout(t);
  }, [state]);
  const commit = async () => {
    const el = ref.current;
    setFocused(false);
    if (!el) return;
    if (cancelRef.current) { cancelRef.current = false; el.innerHTML = escapeHtml(text); return; }
    const next = readPlain(el);
    if (next.trim() === text.trim() || state === 'saving') return;
    setState('saving'); setError('');
    try {
      const result = await onSave(next);
      if (!result.ok) { setState('error'); setError(result.error || 'Could not save that. Try again.'); return; }
      setState('saved');
    } catch (e) { setState('error'); setError(e instanceof Error ? e.message : 'Could not save that. Try again.'); }
  };
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const plain = e.clipboardData.getData('text/plain');
    if (typeof document.execCommand === 'function' && document.execCommand('insertText', false, plain)) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(plain);
    range.insertNode(node);
    range.setStartAfter(node); range.collapse(true);
    sel.removeAllRanges(); sel.addRange(range);
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); cancelRef.current = true; ref.current?.blur(); }
  };
  return (
    <div data-inline-body-wrap onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ padding: '8px 16px 14px', ...wrapStyle }}>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Post text"
        data-inline-body
        spellCheck
        onFocus={() => setFocused(true)}
        onBlur={() => { void commit(); }}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        dangerouslySetInnerHTML={html}
        style={{ fontSize: 14, lineHeight: 1.45, color: '#202020', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', outline: focused ? '2px solid var(--cb-accent, #FFC71D)' : 'none', outlineOffset: 4, borderRadius: 4, cursor: 'text', ...style }}
      />
      {state !== 'idle' && (
        <div style={{ fontSize: 12, marginTop: 6, ...statusStyle }}>
          {state === 'saving' && <span role="status">Saving…</span>}
          {state === 'saved' && <span role="status">Saved</span>}
          {state === 'error' && <span role="alert" style={{ color: '#a12622' }}>{error}</span>}
        </div>
      )}
    </div>
  );
}

/** Approval is confirmed by the parent only after the server accepts it. */
function CardReviewActions({ approved, onApprove, onChanges, onEdit, onSchedule, scheduled, onFeedback }: {
  onFeedback?: (note: string) => Promise<{ ok: boolean; error?: string }>;
  approved: boolean;
  onApprove: () => Promise<{ ok: boolean; error?: string }> | void;
  onChanges: () => void; onEdit?: () => void; onSchedule: () => void; scheduled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [note, setNote] = useState('');
  const [feedbackState, setFeedbackState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const feedbackId = useId();
  const sendFeedback = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!note.trim() || feedbackState === 'saving' || pending || !onFeedback) return;
    setFeedbackState('saving');
    try {
      const result = await onFeedback(note.trim());
      if (!result.ok) { setFeedbackState('error'); return; }
      setNote(''); setFeedbackState('saved');
    } catch { setFeedbackState('error'); }
  };
  const approve = async () => {
    if (pending) return;
    setPending(true); setError(false);
    try { const result = await onApprove(); if (result && !result.ok) setError(true); }
    catch { setError(true); }
    finally { setPending(false); }
  };
  return (
    <div data-review-actions style={{ padding: '8px 2px 0' }}>
      {onFeedback && <form onSubmit={sendFeedback} style={{ marginBottom: 8 }}>
        <label htmlFor={feedbackId} style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 5 }}>Feedback on this post</label>
        <textarea id={feedbackId} value={note} rows={2} disabled={feedbackState === 'saving'}
          onChange={event => { setNote(event.target.value); setFeedbackState('idle'); }}
          placeholder="What would you change?"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', minHeight: 52, resize: 'vertical', padding: 10, fontFamily: 'inherit', fontSize: 13, lineHeight: 1.5, border: '1px solid #d6d3cd', borderRadius: 10, background: '#fff', color: 'var(--cb-ink)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
          <button type="submit" disabled={!note.trim() || feedbackState === 'saving' || pending}
            style={{ font: 'inherit', fontSize: 13, fontWeight: 600, padding: '8px 0', minHeight: 44, border: 0, background: 'none', color: 'var(--cb-ink)', cursor: 'pointer', opacity: !note.trim() ? .5 : 1 }}>
            {feedbackState === 'saving' ? 'Saving feedback…' : 'Send feedback'}
          </button>
          {feedbackState === 'saved' && <span role="status" style={{ fontSize: 13 }}>Feedback saved</span>}
          {feedbackState === 'error' && <span role="alert" style={{ fontSize: 13, color: '#a12622' }}>Feedback did not save. Your text is kept. Try again.</span>}
        </div>
      </form>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {approved
          ? <span role="status" style={{ fontSize: 14, fontWeight: 700, minHeight: 44, display: 'inline-flex', alignItems: 'center', gap: 6 }}>✓ Approved</span>
          : <Pill onClick={approve} disabled={pending || feedbackState === 'saving'} style={{ fontSize: 13, minHeight: 44, background: 'var(--cb-ink)', color: '#fff', opacity: pending ? .65 : 1 }}>{pending ? 'Approving…' : 'Approve post'}</Pill>}
        {!onFeedback && <Pill onClick={onChanges} disabled={pending} style={{ fontSize: 13, minHeight: 44 }}>Request changes</Pill>}
        {onEdit && <button onClick={onEdit} disabled={pending} style={{ font: 'inherit', fontSize: 13, minHeight: 44, padding: '8px 4px', border: 0, background: 'none', color: 'var(--cb-ink)', textDecoration: 'underline', cursor: 'pointer' }}>Edit copy</button>}
        <button onClick={onSchedule} disabled={pending} style={{ font: 'inherit', fontSize: 13, minHeight: 44, padding: '8px 4px', border: 0, background: 'none', color: 'var(--cb-ink)', textDecoration: 'underline', cursor: 'pointer', marginLeft: 'auto' }}>{scheduled ? 'Edit time' : 'Schedule'}</button>
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--cb-ink-mute)', marginTop: 2 }}>{approved ? (scheduled ? 'Approved. Scheduled time stays as set.' : 'Approved. Still in the buffer until scheduled.') : 'Approval saves your sign-off. Scheduling is separate.'}</div>
      {error && <div role="alert" style={{ fontSize: 14, marginTop: 6, color: '#a12622' }}>Approval did not save. Try Approve post again.</div>}
    </div>
  );
}
import {
  FunnelChip, fmtDay, inkOn, DocCarousel, docPagesOf, clientTz,
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
 * A handful of the original's callbacks (onRemove/leftEmpty/replacements/pool/
 * the approved reference for this tab — they are kept in the prop interface for wiring parity
 * with ReviewSurface (so the integrator can pass the exact same object through both surfaces),
 * but this file does not invoke them. See the build report for the full list.
 */

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
function kickerOfLocal(q: Pick<QueueItem, 'kind' | 'media_url' | 'image_urls' | 'lm_launch' | 'style'>): string {
  if (q.lm_launch) return 'Lead magnet launch';
  if (q.style === 'video') return 'Video';
  if (q.kind === 'post') return (q.media_url || (q.image_urls && q.image_urls.length)) ? 'Single image' : 'Text post';
  return KIND_LABEL[q.kind] || q.kind;
}

/** Mirrors ClientBoardPage's (unexported) sourceChip: the honest, concrete provenance —
 *  never a vague "Picked by Ivan". Only ever called for live boards (see original). */
function srcDayLocal(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
function sourceChipLocal(q: Pick<QueueItem, 'source_detail' | 'source_label'>): { label: string; quote?: string | null; meta?: string | null } | null {
  const sd = q.source_detail;
  if (sd) {
    // 2026-09-07 (Ivan): the Review grid now carries the source line, so the call date rides
    // along when the row knows it — "From your call · 20 Aug" beats a bare "From your calls".
    const meta = srcDayLocal(sd.call_date) || srcDayLocal(sd.sourced_at) || null;
    if (sd.kind === 'call') {
      const who = (sd.call_title || '').replace(/^Intro Call w\/\s*RISE DTC\s*-\s*/i, '').replace(/^ZOOM Meeting\s*-\s*RISE DTC\s*\/\/\s*/i, '').trim();
      return { label: who ? `${sd.label || 'From your sales call'} · ${who}` : (sd.label || 'From your sales call'), quote: sd.quote, meta };
    }
    if (sd.kind === 'strategy') return null;
    return { label: sd.label || q.source_label || '', quote: null, meta };
  }
  if (q.source_label) return { label: q.source_label, quote: null };
  return null;
}

/** A short LA-time stamp for history rows ("31 Jul 04:45") and reschedule values. */
function fmtWhen(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString('en-GB', { timeZone: clientTz(), day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { timeZone: clientTz(), hour: '2-digit', minute: '2-digit' });
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
  const day = (s: string) => new Date(s).toLocaleDateString('en-GB', { timeZone: clientTz(), day: 'numeric', month: 'short' });
  const time = (s: string) => new Date(s).toLocaleTimeString('en-GB', { timeZone: clientTz(), hour: '2-digit', minute: '2-digit' });
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

type Bucket = 'upnext' | 'buffer' | 'approved' | 'published';
/** 'buffer' = pending approval, 'approved' = signed off but still undated. Both are the buffer. */
const inBuffer = (b: Bucket) => b === 'buffer' || b === 'approved';

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
  foldPhotos, foldCalendar, live = false, fetchHistory, approvedIds = new Set(), onFeedback, onEditBody,
}: {
  board: Board; accent: string; mint: string;
  stageOf: (q: QueueItem) => Stage;
  onOpen: (q: QueueItem, opts?: { changing?: boolean; editing?: boolean; scheduling?: boolean }) => void;
  onOpenIdea: (idea: Idea) => void;
  live?: boolean;
  onApprove: (id: string) => Promise<{ ok: boolean; error?: string }> | void;
  approvedIds?: Set<string>;
  onFeedback?: (id: string, note: string) => Promise<{ ok: boolean; error?: string }>;
  /** Live review boards: saves the post text typed in place on a buffer card (same RPC path
   *  as the modal's Edit copy). Absent, the copy renders static and Edit copy is the only way. */
  onEditBody?: (id: string, body: string) => Promise<{ ok: boolean; error?: string }>;
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
  // onRemove, leftEmpty, onLeaveEmpty, onRefillDay, onBackToBuffer, onLeaveDayEmpty,
  // onClearDay, onEditPromo, replacements, pool, benchFor, onRestore, onPickReplacement,
  // onPickReplacementAngle, skips — none has a block in the approved reference.
  // (foldPhotos DOES render — the photo library block near the foot of the list view.)
  void onRemove; void leftEmpty; void onLeaveEmpty; void onRefillDay; void onBackToBuffer;
  void onLeaveDayEmpty; void onClearDay; void onEditPromo; void replacements; void pool; void benchFor;
  void onRestore; void onPickReplacement; void onPickReplacementAngle; void skips; void mint;

  const todayIso = new Date().toISOString().slice(0, 10);
  const byDate = (a: QueueItem, b: QueueItem) => (a.publish_date || '9999-99').localeCompare(b.publish_date || '9999-99');

  // ---- Block 1/2: pipeline headline + counts (deskPipelineTitle, replicated) ----
  const out = board.queue.filter((x) => stageOf(x) === 'published').length;
  const sched = board.queue.filter((x) => stageOf(x) !== 'published' && isScheduledLocal(x)).length;
  const buffer = board.queue.filter((x) => stageOf(x) !== 'published' && !isScheduledLocal(x)).length;
  // 2026-09-10 (Ivan): published posts stay out of the pipeline stat. The plate counts only
  // what still needs a decision: pending approval, approved, scheduled.
  const pendingN = board.queue.filter((x) => stageOf(x) === 'review' && !isScheduledLocal(x)).length;
  const approvedN = board.queue.filter((x) => stageOf(x) === 'scheduled' && !isScheduledLocal(x)).length;
  const total = sched + buffer;
  const parts = [pendingN ? `${pendingN} pending approval` : null, approvedN ? `${approvedN} approved` : null, sched ? `${sched} scheduled` : null].filter(Boolean) as string[];

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
  let pendingRows: QueueItem[] = [];
  let approvedRows: QueueItem[] = [];
  let bufferRows: QueueItem[] = [];
  let scheduledRows: QueueItem[] = [];
  let reviewRows: QueueItem[] = [];
  if (live) {
    upNextRows = board.queue.filter((q) => stageOf(q) !== 'published' && stageOf(q) !== 'drafted' && isScheduledLocal(q)).slice().sort(byDate);
    // Approve moves the card, it never vanishes it (2026-09-10, Ivan: "when i select approve
    // nothing happens"): the buffer splits into Pending approval (still 'review') and
    // Approved (stage 'scheduled' with no date yet). bufferRows stays the union for counts.
    pendingRows = board.queue.filter((q) => stageOf(q) === 'review' && !isScheduledLocal(q));
    approvedRows = board.queue.filter((q) => stageOf(q) === 'scheduled' && !isScheduledLocal(q));
    bufferRows = [...pendingRows, ...approvedRows];
  } else {
    reviewRows = board.queue.filter((q) => stageOf(q) === 'review').slice().sort(byDate);
    scheduledRows = board.queue.filter((q) => stageOf(q) === 'scheduled').slice().sort(byDate);
  }

  // ---- Category filters (2026-08-07, Ivan): two separate axes so they never overlap.
  // FORMAT (?cat=) is what the item looks like on LinkedIn (post/carousel/video/LM);
  // TOPIC (?topic=) is the pillar the engine tagged it with (taxonomy.pillar via the queue
  // sync), with the personal lane keyed off taxonomy.register so a hybrid post still counts
  // as personal. They compose — "Carousels × Teardown" is a real view.
  type Cat = 'all' | 'post' | 'image' | 'carousel' | 'video' | 'lm';
  const CATS: { id: Cat; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'post', label: 'Text' }, { id: 'image', label: 'Single image' },
    { id: 'carousel', label: 'Carousels' }, { id: 'video', label: 'Videos' }, { id: 'lm', label: 'Lead magnets' },
  ];
  const catOf = (q: QueueItem): Cat => {
    if (q.kind === 'lm' || q.lm_launch || q.lm_gate) return 'lm';
    if ((q.style || '').toLowerCase() === 'video' || /^video[:\s]/i.test(q.title || '')) return 'video';
    if (q.kind === 'carousel') return 'carousel';
    // A post that carries art is a different thing to write and to judge, so it filters apart.
    if (q.image || (q.image_urls && q.image_urls.length)) return 'image';
    return 'post';
  };
  const topicOf = (q: QueueItem): string | null => {
    if (q.register === 'personal' || q.register === 'hybrid') return 'personal';
    return q.pillar || null;
  };
  // Topic pills are PINNED to the canonical set (the client's 4 hand-authored pillars +
  // personal; Ivan 2026-08-08: "never coin new labels on a client surface"). A rogue pillar
  // value — e.g. one leaked from another lane's taxonomy enum — gets NO pill; its row still
  // shows under All. Pills render only for canon values present in the data.
  const TOPIC_ORDER = ['personal', 'teardown', 'authority', 'demand', 'case_study'];
  const topicCounts: Record<string, number> = {};
  board.queue.forEach((q) => { const t = topicOf(q); if (t) topicCounts[t] = (topicCounts[t] || 0) + 1; });
  const topics = TOPIC_ORDER.filter((t) => (topicCounts[t] || 0) > 0);
  const topicLabel = (t: string) => t.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  const readParam = (k: string) => { try { return new URLSearchParams(window.location.search).get(k); } catch { return null; } };
  const [cat, setCatState] = useState<Cat>(() => {
    const c = readParam('cat');
    if (c === 'personal') return 'all'; // legacy deep link from before the topic axis existed
    return (CATS.some((x) => x.id === c) && c !== 'all') ? (c as Cat) : 'all';
  });
  const [topic, setTopicState] = useState<string>(() => {
    const t = readParam('topic');
    if (t) return t;
    return readParam('cat') === 'personal' ? 'personal' : 'all';
  });
  // Third axis (2026-08-07, Ivan): AIM (?aim=) — reach/trust/buyers, i.e. funnel stage
  // (TOFU→BOFU), plumbed from carousel_drafts.funnel_stage. Same words the dark plate and
  // the per-row chip already use, so the three surfaces never disagree.
  const AIMS = ['reach', 'trust', 'buyers'];
  const aimOf = (q: QueueItem): string | null => (q.funnel_stage && AIMS.includes(q.funnel_stage)) ? q.funnel_stage : null;
  const aimCount = (a: string) => board.queue.filter((q) => aimOf(q) === a).length;
  const [aimSel, setAimState] = useState<string>(() => readParam('aim') || 'all');
  // Filter clicks write the URL (shareable view) and tell the panel shell on
  // resources.risedtc.com to swap its pretty path (/panel/content/<x>/). The message carries
  // only the three filter ids — nothing sensitive crosses the frame boundary.
  const syncFilterUrl = (c: Cat, t: string, a: string) => {
    try {
      const u = new URL(window.location.href);
      if (c === 'all') u.searchParams.delete('cat'); else u.searchParams.set('cat', c);
      if (t === 'all') u.searchParams.delete('topic'); else u.searchParams.set('topic', t);
      if (a === 'all') u.searchParams.delete('aim'); else u.searchParams.set('aim', a);
      window.history.replaceState(null, '', u.toString());
      if (window.parent !== window) window.parent.postMessage({ type: 'cb-filter', cat: c, topic: t, aim: a }, '*');
    } catch { /* URL sync is best-effort; the filter itself already applied */ }
  };
  const setCat = (c: Cat) => { setCatState(c); syncFilterUrl(c, topic, aimSel); };
  const setTopic = (t: string) => { setTopicState(t); syncFilterUrl(cat, t, aimSel); };
  const setAim = (a: string) => { setAimState(a); syncFilterUrl(cat, topic, a); };
  const inCat = (q: QueueItem) => (cat === 'all' || catOf(q) === cat) && (topic === 'all' || topicOf(q) === topic) && (aimSel === 'all' || aimOf(q) === aimSel);
  const catCount = (id: Cat) => id === 'all' ? board.queue.length : board.queue.filter((q) => catOf(q) === id).length;
  const fUpNext = upNextRows.filter(inCat), fBuffer = bufferRows.filter(inCat), fDrafted = draftedRows.filter(inCat),
    fPending = pendingRows.filter(inCat), fApproved = approvedRows.filter(inCat),
    fPublished = publishedRows.filter(inCat), fReview = reviewRows.filter(inCat), fScheduled = scheduledRows.filter(inCat);

  // ---- Collapsible sections (2026-08-07, Ivan; 2026-09-10: every section starts folded).
  // The header row with the count always renders, the rows toggle on click. ----
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  /** Per-card body expansion in the 2-up buffer grid. */
  const sectionOpen = (key: string) => openSections[key] ?? false;
  const toggleSection = (key: string) => setOpenSections((o) => ({ ...o, [key]: !sectionOpen(key) }));
  const [logOpen, setLogOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);

  // ---- Block 6: changes log — fan fetchHistory across the queue, tagged with the post title.
  const [entries, setEntries] = useState<(HistoryEntry & { postId: string; postTitle: string })[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [who, setWho] = useState<'all' | 'founder'>('all');
  const founderFirst = (board.founder?.first_name || '').trim() || (board.founder?.name || '').trim().split(/\s+/)[0] || '';
  const deskLabel = deskLabelOf(board);
  const queueKey = board.queue.map((q) => q.id).join(',');
  const [historyTick, setHistoryTick] = useState(0);
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
  }, [queueKey, !!fetchHistory, historyTick]);
  /** In-place text save; a saved edit re-fans the history so the Changes log shows it. */
  const saveBody = onEditBody ? async (id: string, body: string) => {
    const r = await onEditBody(id, body);
    if (r.ok) setHistoryTick((t) => t + 1);
    return r;
  } : undefined;
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
    const dateLabel = inBuffer(bucket) ? 'no date yet' : (fmtDay(q.publish_date) || (bucket === 'published' ? 'date unknown' : 'date at sign-off'));
    const chip = bucket === 'approved' ? { label: 'Approved ✓' } : statusChipFor(stage, q, live, todayIso);
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
              {q.post_url && <LivePostLink href={q.post_url} />}
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
                {live && saveBody && bucket !== 'published'
                  ? <InlineBody text={q.body} onSave={(body) => saveBody(q.id, body)} style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--cb-ink-mute)' }} wrapStyle={{ padding: 0, marginTop: 5 }} />
                  : <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--cb-ink-mute)', whiteSpace: 'pre-line', marginTop: 5 }}>{q.body}</div>}
              </div>
            </div>
          ) : null}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 13 }}>
            <Chip>{kickerOfLocal(q)}</Chip>
            {provenance?.label && <Chip>{provenance.label}</Chip>}
          </div>
          {bucket !== 'published' && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              {live && onApprove && bucket === 'buffer' && <Pill style={{ fontSize: 15, minHeight: 44 }} onClick={() => { void onApprove(q.id); }}>Approve ✓</Pill>}
              {/* 2026-09-10 (Ivan): the text edits in place when onEditBody is wired, so the Edit copy control is redundant there. */}
              {!(live && onEditBody) && <Pill style={{ fontSize: 15, minHeight: 44 }} onClick={() => onOpen(q, { editing: true })}>Edit copy</Pill>}
              <Pill style={{ fontSize: 15, minHeight: 44 }} onClick={() => onOpen(q, { scheduling: true })}>Edit time</Pill>
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

  // ---- LinkedIn-style card (2026-08-07, Ivan): the Personal topic renders drafts the way
  // they'll actually look in the feed — founder header, the full copy, the image — two to a
  // row. No title line, no hook/copy split, no drill.
  const renderLiCard = (q: QueueItem, bucket: Bucket) => {
    const img = cardImageUrlLocal(q, board);
    /* A carousel is a multi-page document, and this card is the only place the Personal topic
       shows it. Rendering just the cover made a 9-slide deck look like one dead image with no
       way through it, so a deck gets the pager (swipe, drag, dots, arrow keys) and everything
       else keeps the flat image. */
    const deck = docPagesOf(q);
    const chip = bucket === 'published' ? { label: 'published' } : statusChipFor(stageOf(q), q, live, todayIso);
    const dateLabel = inBuffer(bucket) ? 'no date yet' : (fmtDay(q.publish_date) || (bucket === 'published' ? 'date unknown' : 'date at sign-off'));
    const fName = (board.founder?.name || '').trim() || 'Founder';
    const initials = fName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const bodyText = stripBrand(q.body || q.hook || q.title) || '';
    /* Where the post came from sits ABOVE the simulation (2026-09-07, Ivan: "the source of the
       content should be seen above each html simulation"). Same provenance the list view and
       the detail modal already show; the quote is the founder's own line from that call. */
    const src = sourceChipLocal(q);
    return (
      <div data-review-card={q.id} key={q.id} className="cb-licard" style={{ minWidth: 0, fontFamily: LI_FONT }}>
      {live && <PostSourceContext compact detail={q.source_detail} label={src?.label || q.source_label} quote={src?.quote} date={src?.meta} />}
      {/* The post itself is the 08-19 review page's `.post` card, value for value (2026-09-10,
          Ivan: "def looks less realistic than this html, also text"): LinkedIn's own type
          size, its grey ink, its head, its action bar. */}
      <div className="cb-post" style={{ border: '1px solid #e0dfdc', borderRadius: 10, background: '#fff', color: 'rgba(0,0,0,.9)', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.08)', fontFamily: LI_FONT }}>
        <div
          role="button" tabIndex={0}
          onClick={() => onOpen(q)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(q); } }}
          style={{ display: 'flex', gap: 9, padding: '12px 14px 6px', cursor: 'pointer' }}
        >
          <div aria-hidden data-founder-avatar style={{ flex: '0 0 40px', width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', background: '#173a5c', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>{board.founder?.avatar_url ? <img src={board.founder.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : initials}</div>
          <div style={{ flex: '1 1 100px', minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,.9)' }}>{fName}</span>
            {board.founder?.headline && <span style={{ fontSize: 11, color: 'rgba(0,0,0,.55)' }}>{board.founder.headline}</span>}
            <span style={{ fontSize: 11, color: 'rgba(0,0,0,.55)' }}>1d &middot; &#127760;</span>
          </div>
          <span aria-hidden style={{ flex: 'none', marginLeft: 'auto', color: 'rgba(0,0,0,.55)', fontWeight: 700, letterSpacing: 1 }}>&middot;&middot;&middot;</span>
        </div>
        {live && saveBody && q.body && bucket !== 'published'
          ? <InlineBody text={q.body} onSave={(body) => saveBody(q.id, body)} wrapStyle={{ padding: 0 }} statusStyle={{ padding: '0 14px 10px' }} style={{ padding: '4px 14px 12px', fontSize: 13, lineHeight: 1.5, color: 'inherit', borderRadius: 0, outline: 'none' }} />
          : <CardBody text={bodyText} />}
        {deck.length >= 2
          ? <div className="cb-post-deck"><DocCarousel slides={deck} title={q.title || q.hook} accent={accent} /></div>
          : img && <img src={img} alt="" loading="lazy" style={{ display: 'block', width: '100%', height: 'auto' }} />}
        <div className="cb-pactions" data-linkedin-actions aria-label="LinkedIn action bar preview">
          <span><svg viewBox="0 0 24 24" aria-hidden><path d="M7 11v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3zm0 0 4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 0 1 2 2.3l-1 6.5A2.4 2.4 0 0 1 17.6 20H7"/></svg>Like</span>
          <span><svg viewBox="0 0 24 24" aria-hidden><path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.7A8 8 0 1 1 21 12z"/></svg>Comment</span>
          <span><svg viewBox="0 0 24 24" aria-hidden><path d="M17 2l4 4-4 4M21 6H8a4 4 0 0 0-4 4M7 22l-4-4 4-4M3 18h13a4 4 0 0 0 4-4"/></svg>Repost</span>
          <span><svg viewBox="0 0 24 24" aria-hidden><path d="M22 2 11 13M22 2 15 22l-4-9-9-4 20-7z"/></svg>Send</span>
        </div>
      </div>
      {/* Board chrome sits OUTSIDE the post, so the simulation above stays a clean post.
          2026-09-07 (Ivan): the buffer's Review grid drops the tag row ("no date yet · in buffer ·
          Text post · Trust") — the Source line above and the mock itself say it; the date and
          status chips stay only where they carry news (scheduled / published cards). */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '10px 2px 0' }}>
        {!inBuffer(bucket) && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--cb-ink-mute)' }}>{dateLabel}</span>}
        {!inBuffer(bucket) && chip && <Chip>{chip.label}</Chip>}
        {bucket === 'approved' && <Chip>Approved ✓</Chip>}
        {q.post_url && <LivePostLink href={q.post_url} />}
      </div>
      {bucket !== 'published' && <CardReviewActions approved={approvedIds.has(q.id)} onApprove={() => onApprove(q.id)} onFeedback={onFeedback ? note => onFeedback(q.id, note) : undefined} onChanges={() => onOpen(q, { changing: true })} onEdit={(live && onEditBody) ? undefined : () => onOpen(q, { editing: true })} onSchedule={() => onOpen(q, { scheduling: true })} scheduled={isScheduledLocal(q)} />}
      </div>
    );
  };
  /** Rows are the default everywhere. Review mode — and the Personal topic, which has read
   *  as a feed since 2026-08-07 — swap to a 2-up of LinkedIn-style cards. Opt-in, so a client
   *  who liked the list keeps the list (2026-09-03, Ivan). */
  /* Review grid order (2026-09-07, Ivan): text posts first, then single-image posts, then
     carousels, so the eye reads one format at a time instead of hopping between them. Stable
     within a group, so the list's own order still holds inside each block. */
  const formatRank = (q: QueueItem): number => {
    if (q.kind === 'carousel' || docPagesOf(q).length >= 2) return 2;
    if (q.media_url || (q.image_urls && q.image_urls.length) || cardImageUrlLocal(q, board)) return 1;
    return 0;
  };
  const rowsFor = (list: QueueItem[], bucket: Bucket): React.ReactNode =>
    topic === 'personal' || (view === 'feed' && inBuffer(bucket))
      ? <div className="cb-licard-grid">{[...list].sort((a, b) => formatRank(a) - formatRank(b)).map((q) => renderLiCard(q, bucket))}</div>
      : list.map((q) => renderRow(q, bucket));

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

  const section = (label: string, count: number, blurb: string, rows: React.ReactNode, key: string, aside?: React.ReactNode) => count > 0 ? (
    <div key={key} style={{ marginTop: 20 }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={sectionOpen(key)}
        onClick={() => toggleSection(key)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(key); } }}
        style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', paddingBottom: 12, borderBottom: '2px solid var(--cb-ink)', cursor: 'pointer' }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--cb-ink)', flex: '1 1 auto' }}>
          <span aria-hidden style={{ display: 'inline-block', width: 14, fontSize: 10, transform: sectionOpen(key) ? 'none' : 'translateY(-1px)' }}>{sectionOpen(key) ? '▾' : '▸'}</span>
          {label}
        </div>
        <Num size="row" inline style={{ fontSize: 19 }}>{count}</Num>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>{blurb}</span>
        {aside ? (
          <span
            style={{ marginLeft: 'auto', display: 'inline-flex', gap: 8, alignItems: 'center' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="presentation"
          >
            {aside}
          </span>
        ) : null}
      </div>
      {sectionOpen(key) ? rows : null}
    </div>
  ) : null;

  /** Sub-group inside a section: same register as the section header, one step lighter.
   *  Always names its state, even when it is the only group with rows. */
  const subSection = (label: string, count: number, blurb: string, rows: React.ReactNode, key: string) => count > 0 ? (
    <div key={key} data-buffer-group={key} style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', padding: '6px 0 8px', borderBottom: '1px solid var(--cb-line)' }}>
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)' }}>{label}</span>
        <Num size="row" inline>{count}</Num>
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
      <style>{`
        /* The feed grey and the 555px column of LinkedIn itself (values from the 08-19 review
           page). Two columns only when each can hold a 440px card (the desk column is 804px at
           a 1100px viewport, 984px at 1280, capped at 1040) — one centred column below that,
           so a card never runs narrower than a real feed post. */
        .cb-licard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 440px), 1fr)); grid-auto-rows: auto; gap: 0 24px; margin-top: 20px; align-items: start; background: #f4f2ee; padding: 18px; }
        .cb-licard-grid > div { width: 100%; max-width: 555px; justify-self: center; }
        /* Each card is a subgrid over the four rows it renders (source line / post / chips /
           feedback + actions), exactly like the 08-19 review page's .slot rule: the post row grows
           to the taller card of the pair, so "Feedback on this post" and Approve start at the
           same y in both columns (2026-09-10, Ivan: "feedback bar and feedback etc should be at
           same height"). Rows keep their own padding as spacing; the 28px between pairs is the
           last row's margin. Single column: same stack as before. */
        .cb-licard-grid > .cb-licard { display: grid; grid-template-rows: subgrid; grid-row: span 4; align-self: stretch; }
        .cb-licard-grid > .cb-licard > * { align-self: start; min-width: 0; }
        .cb-licard-grid > .cb-licard > :last-child { margin-bottom: 28px; }
        .cb-licard-grid button:focus-visible, .cb-licard-grid summary:focus-visible, .cb-licard-grid a:focus-visible { outline: 2px solid var(--cb-ink); outline-offset: 3px; }
        .cb-licard-grid textarea:focus-visible { outline: 2px solid #0a66c2; border-color: #0a66c2; }
        .cb-licard-grid textarea::placeholder { color: #9a9a9a; }
        .cb-post [data-inline-body] { overflow-wrap: anywhere; transition: background .15s, box-shadow .15s; }
        .cb-post [data-inline-body]:hover { background: #fbfaf8; box-shadow: inset 0 0 0 1px #d6d3cd; }
        .cb-post [data-inline-body]:focus { background: #fdfdff; box-shadow: inset 0 0 0 2px #0a66c2; }
        .cb-post .cb-post-deck > div { border-left: 0; border-right: 0; border-radius: 0; }
        .cb-pactions { display: flex; border-top: 1px solid rgba(0,0,0,.08); margin-top: 2px; }
        .cb-pactions span { flex: 1; text-align: center; padding: 9px 0; font-size: 12px; font-weight: 600; color: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; gap: 5px; }
        .cb-pactions svg { width: 15px; height: 15px; fill: none; stroke: rgba(0,0,0,.6); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
        @media (max-width: 480px) { .cb-licard-grid { padding: 12px; } .cb-licard-grid textarea { font-size: 16px !important; } }
      `}</style>

      {/* Block 1: computed headline. */}
      <Eyebrow>All content</Eyebrow>
      <DeskH2>
        {total} {total === 1 ? 'post' : 'posts'} in the buffer{parts.length ? <>: <b>{parts.join(', ')}.</b></> : '.'}
      </DeskH2>

      {/* Block 2: dark plate — pipeline counts + aim mix. */}
      <Plate style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 28px', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <Num size="hero" tone="accent">{total}</Num>
            <Footnote on="plate" style={{ marginTop: 6 }}>waiting to go out</Footnote>
          </div>
          <div data-viz="" style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            {[
              { v: pendingN, label: 'pending approval', bg: 'rgba(255,255,255,0.26)', tone: 'plate-mute' as const },
              { v: approvedN, label: 'approved', bg: 'var(--cb-accent)', tone: 'plate' as const },
              { v: sched, label: 'scheduled', bg: 'rgba(255,255,255,0.62)', tone: 'plate' as const },
            ].map((seg) => (
              /* minWidth keeps a zero segment's label from stacking onto its neighbour
                 (the "0 34 / SCHEDULED IN BUFFER" overlap Ivan screenshotted 2026-09-10). */
              <div key={seg.label} style={{ flex: `${Math.max(seg.v, 0.6)} 1 0`, minWidth: 118 }}>
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
      <div style={{ marginTop: 18, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Pill active={view === 'list'} onClick={() => setView('list')}>List</Pill>
        <Pill active={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</Pill>
      </div>

      {/* Block 3b: filters — ONE aligned block, three labelled axes. No "All" pills:
          a pill toggles, clicking the active one clears that axis; a single Clear link
          resets everything. Labels share a fixed column so the rows scan as a unit. */}
      {(() => {
        const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)', paddingTop: 7 };
        const ROW: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' };
        const anyFilter = cat !== 'all' || topic !== 'all' || aimSel !== 'all';
        const clearAll = () => { setCatState('all'); setTopicState('all'); setAimState('all'); syncFilterUrl('all', 'all', 'all'); };
        return (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--cb-line)', display: 'grid', gridTemplateColumns: '62px 1fr', rowGap: 7, columnGap: 12, alignItems: 'start' }}>
            <span style={LBL}>Format</span>
            <div style={ROW}>
              {CATS.filter((c) => c.id !== 'all' && catCount(c.id) > 0).map((c) => (
                <Pill key={c.id} active={cat === c.id} onClick={() => setCat(cat === c.id ? 'all' : c.id)}>{c.label}</Pill>
              ))}
            </div>
            {topics.length > 0 && (
              <>
                <span style={LBL}>Topic</span>
                <div style={ROW}>
                  {topics.map((t) => (
                    <Pill key={t} active={topic === t} onClick={() => setTopic(topic === t ? 'all' : t)}>{topicLabel(t)}</Pill>
                  ))}
                </div>
              </>
            )}
            {AIMS.some((a) => aimCount(a) > 0) && (
              <>
                <span style={LBL}>Aim</span>
                <div style={ROW}>
                  {AIMS.map((a) => aimCount(a) > 0 && (
                    <Pill key={a} active={aimSel === a} onClick={() => setAim(aimSel === a ? 'all' : a)}>{a[0].toUpperCase() + a.slice(1)}</Pill>
                  ))}
                  {anyFilter && (
                    <button
                      onClick={clearAll}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)', textDecoration: 'underline', textUnderlineOffset: 3 }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {view === 'calendar' ? (
        (foldCalendar && React.isValidElement(foldCalendar)
          ? React.cloneElement(foldCalendar as React.ReactElement<any>, { queueFilter: (cat === 'all' && topic === 'all' && aimSel === 'all') ? undefined : inCat })
          : foldCalendar) || <Footnote>Calendar view not available yet.</Footnote>
      ) : (
        <div>
          {/* Block 4: list view, pipeline-first (Up next/Scheduled → In buffer → Published). */}
          {live ? (
            <>
              {section('Scheduled', fUpNext.length, 'posts, dated and queued', rowsFor(fUpNext, 'upnext'), 'upnext')}
              {section('In buffer', fBuffer.length, 'written, no date yet', (
                <>
                  {subSection('Approved', fApproved.length, 'Approved. Takes the next open slot.', rowsFor(fApproved, 'approved'), 'approved')}
                  {subSection('Pending approval', fPending.length, 'Waiting for your approval.', rowsFor(fPending, 'buffer'), 'pending')}
                </>
              ), 'buffer', (
                <>
                  {view === 'feed' && <Footnote>Full posts · source notes above each</Footnote>}
                  <Pill active={view === 'list'} onClick={() => setView('list')}>List</Pill>
                  <Pill active={view === 'feed'} onClick={() => setView('feed')}>Review</Pill>
                </>
              ))}
              {section('Drafting', fDrafted.length, 'Being written now. They move to your review when ready.', fDrafted.map(renderDraftedRow), 'drafted')}
              {section('Published', fPublished.length, 'published, newest first', [
                <React.Fragment key="recent-out">{rowsFor(fPublished.slice(-6).reverse(), 'published')}</React.Fragment>,
                fPublished.length > 6 ? (
                  <Drill key="earlier-out" label="open it" summaryLeft={<>Earlier: <b>{fPublished.length - 6}</b> more published posts</>} style={{ marginTop: 4 }}>
                    {fPublished.slice(0, -6).reverse().map((q, i) => (
                      <div key={q.id || i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', padding: '7px 0', borderTop: '1px solid var(--cb-line)' }}>
                        <span style={{ flex: 'none', width: 64, fontSize: 12, fontWeight: 800, color: 'var(--cb-ink-mute)' }}>{fmtDay(q.publish_date)}</span>
                        <button onClick={() => onOpen(q)} style={{ flex: '1 1 200px', minWidth: 0, textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--cb-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{stripBrand(q.hook || q.title) || 'Untitled'}</button>
                      </div>
                    ))}
                  </Drill>
                ) : null,
              ], 'published')}
              {(cat !== 'all' || topic !== 'all' || aimSel !== 'all') && fUpNext.length + fBuffer.length + fDrafted.length + fPublished.length === 0 && (
                <Footnote style={{ marginTop: 16 }}>Nothing in this category yet.</Footnote>
              )}
            </>
          ) : (
            <>
              {section('Ideas', ideas.length, "The engine's upcoming idea bank. Each one drafts when it reaches its slot.", ideas.map(renderIdeaRow), 'ideas')}
              {section('Your review', fReview.length, 'Approve, or say what to change in plain words.', topic === 'personal' ? <div className="cb-licard-grid">{fReview.map((q) => renderLiCard(q, isScheduledLocal(q) ? 'upnext' : 'buffer'))}</div> : fReview.map((q) => renderRow(q, isScheduledLocal(q) ? 'upnext' : 'buffer')), 'review')}
              {section('Drafting', fDrafted.length, 'Being written now. They move to your review when ready.', fDrafted.map(renderDraftedRow), 'drafted')}
              {section('Scheduled', fScheduled.length, 'Approved and queued to publish on their dates.', rowsFor(fScheduled, 'upnext'), 'scheduled')}
              {section('Published', fPublished.length, 'How live posts will report here once posting starts.', rowsFor(fPublished, 'published'), 'published')}
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
          <div
            role="button"
            tabIndex={0}
            aria-expanded={logOpen}
            onClick={() => setLogOpen((v) => !v)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setLogOpen((v) => !v); } }}
            style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', paddingBottom: 7, borderBottom: '1px solid var(--cb-line-bold)', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)', flex: '1 1 auto' }}><span aria-hidden style={{ display: 'inline-block', width: 13, fontSize: 9 }}>{logOpen ? '▾' : '▸'}</span>Changes log</div>
            {entries !== null && entries.length > 0 && <Num size="row" inline style={{ fontSize: 13 }}>{entries.length}</Num>}
            {entries !== null && entries.length > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>changes on this board</span>}
            {entries !== null && entries.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginLeft: 6 }} onClick={(e) => e.stopPropagation()}>
                <Pill active={who === 'all'} onClick={() => setWho('all')}>All</Pill>
                {founderFirst && <Pill active={who === 'founder'} onClick={() => setWho('founder')}>{founderFirst}&rsquo;s</Pill>}
              </div>
            )}
          </div>
          {logOpen && historyLoading && <Footnote style={{ marginTop: 10 }}>reading the log…</Footnote>}
          {logOpen && !historyLoading && entries !== null && entries.length === 0 && <Footnote style={{ marginTop: 10 }}>No changes recorded yet.</Footnote>}
          {logOpen && !historyLoading && filteredEntries.length > 0 && (
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
          <div
            role="button"
            tabIndex={0}
            aria-expanded={photosOpen}
            onClick={() => setPhotosOpen((v) => !v)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPhotosOpen((v) => !v); } }}
            style={{ paddingBottom: 7, borderBottom: '1px solid var(--cb-line-bold)', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)' }}><span aria-hidden style={{ display: 'inline-block', width: 13, fontSize: 9 }}>{photosOpen ? '▾' : '▸'}</span>The photo library</div>
          </div>
          {photosOpen && <div style={{ marginTop: 12 }}>{foldPhotos}</div>}
        </div>
      )}

      {/* Block 7: stat footer. */}
      <StatStrip>
        <Stat value={total} caption="written" />
        <Stat value={sched} caption="scheduled" />
        <Stat value={buffer} caption="in buffer" />
        {board.ideas && <Stat value={board.ideas.length} caption="ideas banked, ready to write" />}
      </StatStrip>
    </div>
  );
}
