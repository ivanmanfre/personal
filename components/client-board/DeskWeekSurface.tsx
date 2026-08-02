/**
 * DeskWeekSurface — the board's front page ("This week"), rebuilt against the approved
 * static reference (phase3-panels/frag-week.html) on the desk kit.
 *
 * WHAT CHANGED vs the original `WeekSurface` in ClientBoardPage.tsx
 * Presentation only. The props interface is copied byte-for-byte, every callback fires from
 * the same semantic place, and nothing here fetches, mutates or derives state the original
 * did not. Blocks, in frag order:
 *   1  eyebrow (real week range) + computed headline
 *   2  ONE full-width dark Plate, split into two columns at >= 900px:
 *        left  — queue hero + breakdown, "Ships today"/"Up next" facts, the deck strip,
 *                the Edit copy / Edit time / Swap slot pills, and the banded queue rail
 *                (bottom-aligned, so both columns close on the same rule)
 *        right — the day pills, then the LinkedIn preview ITSELF, framed on a paper mat
 *                INSIDE the plate (Ivan 08-02: "it could be inside that gray queue square
 *                up next"). Below 900px it stacks under the up-next block, still inside.
 *      then a full-width footer line under both columns closes the plate.
 *   3  the week-at-a-glance rail: one tile a day, carrying the real cover. It is ALSO the
 *      second control on the day selector (08-02) and it marks lead-magnet days in mint.
 *   4  day-by-day rows, compressed to a single line (day, title, status, Open post) since
 *      the rail above already carries the artwork; each row keeps its collapsed drill
 *   5  the stat footer
 *
 * CONTRAST ISOLATION
 * The white preview card is a framed artifact on dark paper. The desk skin sets
 * `[data-skin="desk"] .cb-plate { color: var(--cb-plate-ink) !important }`, which every
 * descendant that does not set its own colour inherits. The mat div re-declares
 * `color: var(--cb-ink)` and `background: var(--cb-paper)`, so nothing plate-relative can
 * cascade into the card and the card keeps its own AA contrast on its own white ground.
 *
 * HONESTY RULES BAKED IN
 * - Every number comes from props. Absent data renders a kit <Blank/>/<StatBlank/>, never a 0.
 * - A still-generating draft renders FeedPreview with cover='render' (the drafting
 *   placeholder), so a half-written post can never read as a finished one.
 * - Provenance chips render ONLY from real source_detail / source_label. Curation-fallback
 *   labels ("Hand-picked") are dropped, never re-labelled.
 * - Statuses use the locked run-for-you register: out / scheduled / in buffer / in review.
 *
 * A few pure helpers below (weekDayList, isScheduled, isWeekendDay, cardImageUrl,
 * fmtSchedLA, kickerOf) are local copies of private functions in ClientBoardPage.tsx. They
 * are not exported from that module and this file may not edit it; see the run report.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Eyebrow, SectionRule, DeskH2, Footnote,
  Plate, PlateMute, PlateRule,
  Num, Stat, StatStrip, StatBlank, Chip, Pill,
  Drill, SlideStrip, Blank,
} from './desk-kit';
import { FeedPreview, FunnelChip, fmtDay } from '../ClientBoardPage';
import type { Board, QueueItem, Stage, AltAngle, PoolDraft, CalendarItem, PerfPost } from '../ClientBoardPage';

/* ────────────────────────── local pure helpers ────────────────────────── */

const CLIENT_TZ = 'America/Los_Angeles';

/** Today as YYYY-MM-DD in the client's timezone (never browser-local). */
function todayIsoLA(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLIENT_TZ }).format(new Date());
}
/**
 * Seven consecutive ISO dates starting at `startIso`.
 * The probe is NOON UTC, not local midnight: the original parsed `iso + 'T00:00:00'` in the
 * viewer's own timezone and then read the UTC date back out, which shifts the whole window
 * one day early for anyone east of UTC (measured: Europe/Warsaw started the week on the
 * wrong day). Noon UTC + whole-day steps is offset-proof and DST-proof.
 */
function weekDayList(startIso: string): string[] {
  const start = new Date(startIso + 'T12:00:00Z').getTime();
  return Array.from({ length: 7 }, (_, i) => new Date(start + i * 86400000).toISOString().slice(0, 10));
}
/** True once a post has a real slot (not sitting undated in the buffer). */
function isScheduled(q: Pick<QueueItem, 'scheduled_at' | 'publish_date'>): boolean {
  return !!(q.scheduled_at || q.publish_date);
}
/** Weekend in the client's timezone. The cadence is weekdays only. */
function isWeekendDay(iso?: string): boolean {
  if (!iso) return false;
  const wd = new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: CLIENT_TZ, weekday: 'short' });
  return wd === 'Sat' || wd === 'Sun';
}
/** A scheduled instant as "Tue 21 Jul, 10:00 AM PT", falling back to the bare date. */
function fmtSchedLA(scheduledAt?: string, publishDate?: string): string {
  if (scheduledAt) {
    const d = new Date(scheduledAt);
    if (!Number.isNaN(d.getTime())) {
      const day = d.toLocaleDateString('en-GB', { timeZone: CLIENT_TZ, weekday: 'short', day: 'numeric', month: 'short' });
      const time = d.toLocaleTimeString('en-US', { timeZone: CLIENT_TZ, hour: 'numeric', minute: '2-digit' });
      return `${day}, ${time} PT`;
    }
  }
  return fmtDay(publishDate);
}
/** The card thumbnail: the generated image, then image_urls[0], then a plumbed cover. */
function cardImageUrl(q: QueueItem): string | undefined {
  if (q.media_url) return q.media_url;
  if (q.image_urls && q.image_urls.length && q.image_urls[0]) return q.image_urls[0];
  if (q.image) return q.image;
  if (q.cover_url) return q.cover_url;
  return undefined;
}
/** The slide deck of a carousel, when it really has one. */
function slidesOf(q: QueueItem): string[] {
  return (q.kind === 'carousel' || q.style === 'carousel') ? (q.image_urls || []).filter(Boolean) : [];
}
const KIND_LABEL: Record<string, string> = { post: 'post', carousel: 'carousel', lm: 'lead magnet', newsletter: 'newsletter' };
/** Format label, client vocabulary. */
function kickerOf(q: Pick<QueueItem, 'kind' | 'media_url' | 'lm_launch' | 'style'>): string {
  if (q.lm_launch) return 'lead magnet launch';
  if (q.style === 'video') return 'video';
  if (q.kind === 'post') return q.media_url ? 'image post' : 'text post';
  return KIND_LABEL[q.kind] || q.kind;
}
/**
 * Lead magnet, classified the same way DeskCalendarStrip classifies it, so the glance rail
 * and the calendar strip can never disagree about which day carries one. `lm_gate` counts
 * (Ivan 08-02): a gated carousel IS a lead magnet — the gate is the whole point — even when
 * the writer never set `lm_launch` (the 31 Jul ChatGPT checklist carousel is the live case).
 */
function isLeadMagnet(q: Pick<QueueItem, 'lm_launch' | 'kind' | 'lm_gate'>): boolean {
  return !!q.lm_launch || q.kind === 'lm' || !!q.lm_gate;
}
/**
 * Provenance, REAL sources only. A call-grounded post carries the call; an own-post
 * carries its label. Curation fallbacks ("Hand-picked", "Picked by Ivan") and the
 * editorial 'strategy' category are dropped rather than re-labelled.
 */
const CURATION_FALLBACK = /hand[-\s]?picked|picked by|curat/i;
function provenanceOf(q: Pick<QueueItem, 'source_detail' | 'source_label'>): { label: string; quote?: string | null } | null {
  const sd = q.source_detail;
  if (sd) {
    if (sd.kind === 'strategy') return null;
    if (sd.kind === 'call') {
      const who = (sd.call_title || '').replace(/^Intro Call w\/\s*[^-]*-\s*/i, '').replace(/^ZOOM Meeting\s*-\s*[^/]*\/\/\s*/i, '').trim();
      return { label: who ? `From your sales call · ${who}` : (sd.label || 'From your sales call'), quote: sd.quote };
    }
    if (sd.label && !CURATION_FALLBACK.test(sd.label)) return { label: sd.label, quote: null };
    return null;
  }
  if (q.source_label && !CURATION_FALLBACK.test(q.source_label)) return { label: q.source_label, quote: null };
  return null;
}
/** Long weekday for a bare ISO date. */
const weekdayLong = (iso?: string) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' }) : '');
const weekdayShort = (iso?: string) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' }) : '');
const dayNumOf = (iso?: string) => (iso ? String(parseInt(iso.slice(8, 10), 10)) : '');
const monthOf = (iso?: string) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { month: 'short' }) : '');
const shiftDays = (iso: string, n: number) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
/** The span a dated band covers: "3 to 7 Aug", "31 Jul to 4 Aug", or a single day. */
function dateSpan(first?: string, last?: string): string {
  if (!first) return '';
  if (!last || last === first) return `${dayNumOf(first)} ${monthOf(first)}`;
  return monthOf(first) === monthOf(last)
    ? `${dayNumOf(first)} to ${dayNumOf(last)} ${monthOf(last)}`
    : `${dayNumOf(first)} ${monthOf(first)} to ${dayNumOf(last)} ${monthOf(last)}`;
}

const SPELLED: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
/** Posts-a-week cadence read off the board's own strategy line. null when it says nothing. */
function cadencePerWeek(headline?: string): number | null {
  if (!headline) return null;
  const digit = headline.match(/(\d+)\s*(?:posts?|pieces?)?\s*(?:a|per)\s*week/i);
  if (digit) return parseInt(digit[1], 10);
  const word = headline.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b\s*(?:posts?|pieces?)?\s*(?:a|per)\s*week/i);
  if (word) return SPELLED[word[1].toLowerCase()] ?? null;
  return null;
}
const normTitle = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** No em dash ever reaches the client; the glyph is reserved for the not-tracked mark. */
const noDash = (s?: string) => (s || '').replace(/\s*—\s*/g, ', ').replace(/—/g, ', ');

/**
 * An undecodable cover (the board carries real `.heic` uploads that no browser decodes)
 * degrades to nothing instead of a broken-image glyph. Same behaviour as the kit's <Thumb/>,
 * applied to every raw <img> this surface renders.
 */
const truncAt = (t: string, cap: number) => (t.length <= cap ? t : t.slice(0, t.lastIndexOf(' ', cap)).trimEnd() + '\u2026');
const stripBrand = (t?: string | null) => (t || '').replace(/^\[[^\]]*\]\s*/, '');
const hideBroken = (e: React.SyntheticEvent<HTMLImageElement>) => {
  // undecodable source (e.g. .heic): the slot degrades to a drawn ghost, never an
  // empty cell and never a broken glyph
  const img = e.currentTarget;
  img.style.border = '2px dashed var(--cb-line-bold)';
  img.style.background = 'repeating-linear-gradient(45deg, rgba(17,17,17,0.06) 0 4px, rgba(17,17,17,0) 4px 9px)';
  img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
};

const CLAMP8: React.CSSProperties = {
  display: '-webkit-box', WebkitLineClamp: 8, WebkitBoxOrient: 'vertical',
  overflow: 'hidden', whiteSpace: 'pre-line',
} as React.CSSProperties;

/* Plate-internal literals. Relative to the dark plate, not to the brand. */
const PLATE_BORDER = 'rgba(255,255,255,0.35)';
/** The queue rail's tile borders: solid for a dated tile, dashed for an undated buffer ghost. */
const PLATE_TILE_LINE = 'rgba(255,255,255,0.55)';
const PLATE_TILE_GHOST = 'rgba(255,255,255,0.40)';
const PLATE_TILE_SUNK = 'rgba(255,255,255,0.07)';
const PLATE_RULE_SOFT = 'rgba(255,255,255,0.32)';
const PLATE_INK = 'var(--cb-plate-ink)';
const PLATE_MUTE = 'var(--cb-plate-mute)';
/** The kit's own plate soft-text literal (desk-kit PLATE_SOFT_TEXT), kept in sync. */
const PLATE_SOFT = '#C9C9C2';

/**
 * The four rules this surface cannot inline.
 * 1. The plate's own column split. An inline style cannot carry a media query, and the
 *    split is a real breakpoint: at >= 900px the preview sits in the plate's right column,
 *    below it stacks inside the plate under the up-next block.
 * 2. The seam between the two plate columns (left rule wide, top rule stacked).
 * 3. The preview's media cap. LinkedIn's own feed crops tall media, so a capped object-fit
 *    crop is faithful, and it keeps the framed card from out-running the left column.
 * 4. The plate hover-lift is dropped for THIS plate only. The reference lifts a small proof
 *    plate; lifting a full-width stage that now holds the post preview reads as a glitch.
 *    The skin's rule carries !important on the shadow, so this one has to as well.
 * 5. The glance rail's hover lift and focus ring. The rail became a day SELECTOR (Ivan
 *    08-02: "when u touch on any of the week at a glance it shows its preview linkedin
 *    html"), so each tile needs a hover affordance and a keyboard focus ring, neither of
 *    which an inline style can express. The lift sits inside prefers-reduced-motion, and it
 *    is a transform, never a size change, so the row can never reflow on hover.
 */
const WEEK_CSS = `
.cb-week-grid { display: grid; gap: 22px; grid-template-columns: minmax(0, 1fr); }
.cb-week-col-left { display: flex; flex-direction: column; min-width: 0; }
.cb-week-col-right { min-width: 0; border-top: 1px solid rgba(255,255,255,0.16); padding-top: 20px; }
@media (min-width: 900px) {
  .cb-week-grid { grid-template-columns: minmax(0, 1.02fr) minmax(0, 0.98fr); gap: 26px; }
  .cb-week-col-right { border-top: 0; padding-top: 0; border-left: 1px solid rgba(255,255,255,0.16); padding-left: 26px; }
}
.cb-week-preview-frame .cb-linkedin-preview > img { max-height: 250px; object-fit: cover; object-position: center top; }
@media (prefers-reduced-motion: no-preference) {
  [data-skin="desk"] .cb-week-plate:hover { transform: none !important; box-shadow: none !important; }
}
.cb-weekrail-tile:focus-visible { outline: 2px solid var(--cb-accent); outline-offset: 2px; }
@media (prefers-reduced-motion: no-preference) {
  .cb-weekrail-tile { transition: transform .16s ease, filter .16s ease; }
  .cb-weekrail-tile:hover { transform: translateY(-2px); filter: brightness(1.04); }
}
`;

/* ────────────────────────── the surface ────────────────────────── */

export function DeskWeekSurface({ board, accent, mint, stageOf, approvedIds, angleSwaps, skips, benchFor, pool = [], onPickReplacement, onBackToBuffer, onLeaveDayEmpty, onSetSchedule, onClearDay, onScheduleToDay, recentlyCleared = {}, leftEmpty = {}, onLeaveEmpty, onRefillDay, onOpen, onOpenCal, onApprove, onPickAngle, onSkip, onUnskip, onGoContent, flashId, modalOpen, live = false }: {
  board: Board; accent: string; mint: string;
  stageOf: (q: QueueItem) => Stage;
  /** Live board: publishing runs from the buffer — no approve gate. The deck shows every
   *  buffered draft with the client powers (edit / swap / remove), each recorded. */
  live?: boolean;
  /** Ids the CLIENT approved this session (persisted) — distinct from data-scheduled items. */
  approvedIds: Set<string>;
  angleSwaps: Record<string, AltAngle>;
  skips: Record<string, true>;
  benchFor: (id: string) => AltAngle[];
  /** Ready drafts (pool) offered alongside bench angles in the swap list picker. */
  pool?: PoolDraft[];
  onPickReplacement?: (id: string, item: PoolDraft) => void;
  /** Unschedule the focused post (clears its slot, returns it to the buffer bucket). */
  onBackToBuffer?: (id: string) => void;
  /** Take a scheduled post off its day AND hold the day empty (no auto-fill). */
  onLeaveDayEmpty?: (id: string, date?: string) => void;
  /** Client schedule controls: set a post's exact time, clear a day, add a ready post to a day. */
  onSetSchedule?: (id: string, iso: string) => Promise<{ ok: boolean; error?: string }>;
  onClearDay?: (id: string, date?: string) => Promise<{ ok: boolean; error?: string }>;
  onScheduleToDay?: (id: string, date: string) => Promise<{ ok: boolean; error?: string }>;
  /** date (YYYY-MM-DD) → the draft id most recently cleared from that day (offered first on add). */
  recentlyCleared?: Record<string, string>;
  /** Deliberately-empty slots (persist server-side, keyed by draft id OR day date). */
  leftEmpty?: Record<string, true>;
  onLeaveEmpty?: (ref: string) => void;
  onRefillDay?: (ref: string) => void;
  onOpen: (q: QueueItem, opts?: { changing?: boolean; editing?: boolean; scheduling?: boolean }) => void;
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
  const fontStack = board.brand?.font_heading ? `"${board.brand.font_heading}", Inter, system-ui, sans-serif` : 'Inter, system-ui, sans-serif';
  const today = todayIsoLA();
  const cal = board.calendar;
  // Rolling "next 7 days": the synced calendar.start is a static Monday that goes stale by
  // the weekend, so the window starts at today unless the synced start is still ahead.
  // A board with no calendar still gets a real window (the original rendered nothing).
  const startIso = cal && cal.start > today ? cal.start : today;
  const days = useMemo(() => weekDayList(startIso), [startIso]);
  const daySet = useMemo(() => new Set(days), [days]);
  const windowEnd = days[days.length - 1];

  /* ---- the live buckets. Every count below is derived from these, never typed in. ---- */
  const notSkipped = (q: QueueItem) => !skips[q.id];
  const publishedItems = board.queue.filter((q) => q.stage === 'published');
  const todayItems = board.queue.filter((q) => q.stage !== 'published' && q.publish_date === today && notSkipped(q));
  const laterItems = board.queue
    .filter((q) => q.stage !== 'published' && !!q.publish_date && q.publish_date > today && notSkipped(q))
    .sort((a, b) => (a.publish_date || '').localeCompare(b.publish_date || ''));
  const bufferItems = board.queue
    .filter((q) => stageOf(q) === 'review' && !isScheduled(q) && notSkipped(q))
    .sort((a, b) => (a.hook || a.title || '').localeCompare(b.hook || b.title || ''));
  const queueTotal = todayItems.length + laterItems.length + bufferItems.length;
  /** Ready posts a client can drop onto an open day (same filter as the original). */
  const readyToAdd = board.queue.filter((q) => stageOf(q) === 'review' && !isScheduled(q) && notSkipped(q));

  /* ---- performance join: the ONLY honest source of a published post's reads + URL. ---- */
  const perfPosts: PerfPost[] = board.performance?.posts || [];
  const perfFor = (q: QueueItem): PerfPost | undefined => {
    // Reads + the live URL belong to PUBLISHED posts only. Without this guard a same-day
    // draft inherits the published post's numbers, which is the worst kind of wrong.
    if (stageOf(q) !== 'published') return undefined;
    const key = normTitle(q.title || q.hook);
    const byBoth = perfPosts.find((p) => (p.published_at || '').slice(0, 10) === q.publish_date && normTitle(p.title) === key && !!key);
    if (byBoth) return byBoth;
    const byTitle = perfPosts.find((p) => !!key && normTitle(p.title) === key);
    if (byTitle) return byTitle;
    const sameDay = perfPosts.filter((p) => (p.published_at || '').slice(0, 10) === q.publish_date);
    return sameDay.length === 1 ? sameDay[0] : undefined;
  };
  /** Reads last week: only when the performance feed actually carries that week's posts. */
  const readsLastWeek = (() => {
    const from = shiftDays(days[0], -7);
    const rows = perfPosts.filter((p) => {
      const d = (p.published_at || '').slice(0, 10);
      return !!d && d >= from && d < days[0] && typeof p.impressions === 'number';
    });
    if (!rows.length) return null;
    // Dated caption: this window is the 7 days before the rolling week, which is NOT the
    // Monday-anchored week other tabs chart — naming the dates dissolves the collision.
    return { n: rows.reduce((t, p) => t + (p.impressions || 0), 0), from, to: shiftDays(days[0], -1) };
  })();

  /* ---- day selection: the preview, the rail and the rows all read this one value. ---- */
  const postsOnDay = (day: string) => board.queue
    .filter((q) => q.publish_date === day)
    .sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''));
  const calOnlyOnDay = (day: string): CalendarItem[] => {
    const refs = new Set(board.queue.filter((q) => q.publish_date === day).map((q) => q.id));
    return (cal?.items || []).filter((it) => it.date === day && (!it.ref || !refs.has(it.ref)) && !board.queue.some((q) => q.id === it.ref));
  };
  const defaultDay = (days.includes(today) && postsOnDay(today).length ? today : days.find((d) => postsOnDay(d).length)) || days[0];
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const selectedDay = pickedDay && daySet.has(pickedDay) ? pickedDay : defaultDay;
  const selectedItem: QueueItem | undefined = postsOnDay(selectedDay).find((q) => !skips[q.id]) || postsOnDay(selectedDay)[0];

  // Arrow keys walk the week, exactly like the original's j/k deck nav. Suspended while a
  // modal owns the keyboard, and never while the client is typing.
  useEffect(() => {
    if (modalOpen) return;
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      const dir = (e.key === 'ArrowRight' || e.key === 'j') ? 1 : (e.key === 'ArrowLeft' || e.key === 'k') ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      setPickedDay((cur) => {
        const i = days.indexOf(cur && daySet.has(cur) ? cur : defaultDay);
        return days[Math.min(days.length - 1, Math.max(0, i + dir))];
      });
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, days.join(','), defaultDay]);

  /* ---- day-level write state (add a post to an open day). ---- */
  const [addDay, setAddDay] = useState<string | null>(null);
  const [dayErr, setDayErr] = useState<Record<string, string>>({});
  const runDayWrite = async (day: string, p?: Promise<{ ok: boolean; error?: string }>) => {
    if (!p) return;
    const r = await p;
    setDayErr((prev) => ({ ...prev, [day]: r.ok ? '' : (r.error || 'Could not save that. Try again.') }));
    if (r.ok) setAddDay(null);
  };

  /* ---- status vocabulary: out / scheduled / in buffer / in review. Locked register. ---- */
  const statusOf = (q: QueueItem): string => {
    const st = stageOf(q);
    if (st === 'published') return 'out';
    if (skips[q.id]) return 'removed';
    if (st === 'drafted') return q.generating ? 'being written' : 'in production';
    if (st === 'planned') return 'planned';
    if (!isScheduled(q)) return 'in buffer';
    if (q.publish_date === today) return 'ships today';
    if (live || st === 'scheduled' || approvedIds.has(q.id)) return 'scheduled';
    return 'in review';
  };

  /* ---- headline: facts with numbers, computed. No couplets, no approval framing. ---- */
  const behindCount = laterItems.length + bufferItems.length;
  const nextDated = laterItems[0];
  const headline: React.ReactNode = todayItems.length > 0
    ? (
      <>
        There {todayItems.length === 1 ? 'is' : 'are'} <b>{todayItems.length === 1 ? 'one post' : `${todayItems.length} posts`} scheduled for today</b>
        {behindCount > 0 ? `, and ${behindCount} more in the queue behind it.` : ', and nothing else in the queue behind it.'}
      </>
    )
    : nextDated
      ? (
        <>
          Nothing ships today. The next post is <b>scheduled for {fmtDay(nextDated.publish_date)}</b>
          {behindCount > 1 ? `, with ${behindCount - 1} more in the queue behind it.` : '.'}
        </>
      )
      : bufferItems.length > 0
        ? (<>Nothing is dated this week. <b>{bufferItems.length} {bufferItems.length === 1 ? 'draft is' : 'drafts are'} in the buffer</b>, none with a date yet.</>)
        : (<><b>Nothing is in the queue this week.</b></>);

  /* ---- the plate's featured post: what ships today, else the next dated post. ---- */
  const plateItem = todayItems[0] || nextDated;
  /* Round 4 (Ivan 08-02): the plate's post block FOLLOWS the day selector, so every post
     is editable as you move through the days. An empty or weekend day falls back to the
     up-next post, labelled "Up next", which keeps the block alive and the pills honest. */
  const stageItem = selectedItem || plateItem;
  const stageIsFallback = !selectedItem && !!plateItem;
  const stagePublished = !!stageItem && stageOf(stageItem) === 'published';
  const plateSlides = stageItem ? slidesOf(stageItem) : [];

  const cadence = cadencePerWeek(board.strategy?.cadence?.headline);
  const cadenceCaption = /working day/i.test(board.strategy?.cadence?.headline || '')
    ? 'posts a week, one a working day'
    : 'posts a week';
  const workingDays = days.filter((d) => !isWeekendDay(d)).length;
  const daysWithPost = days.filter((d) => postsOnDay(d).length > 0).length;
  /** Days in THIS window that carry a lead magnet. Drives the glance rail's mint legend
   *  token, which stays off entirely when the window has none. */
  const lmDays = days.filter((d) => postsOnDay(d).some(isLeadMagnet));
  const beyondWindow = laterItems.filter((q) => (q.publish_date || '') > windowEnd);
  const lastDated = laterItems.length ? laterItems[laterItems.length - 1].publish_date : (todayItems.length ? today : undefined);

  /* ────────── shared row pieces ────────── */

  const actionPill = (q: QueueItem, label: string, opts: { changing?: boolean; editing?: boolean; scheduling?: boolean }) => (
    <Pill onClick={() => onOpen(q, opts)}>{label}</Pill>
  );

  const platePill = (label: string, opts: { changing?: boolean; editing?: boolean; scheduling?: boolean }) => (
    <Pill
      onClick={() => stageItem && onOpen(stageItem, opts)}
      style={{ borderColor: PLATE_BORDER, color: PLATE_INK, background: 'none', fontSize: 12, padding: '6px 14px' }}
    >{label}</Pill>
  );

  /* ────────── the plate's queue rail ──────────
     One tile per queued item, banded: what ships today (accent outline), what carries a
     later date (real cover), and what sits undated in the buffer (dashed ghost — a buffer
     draft that already has a cover shows it dimmed rather than as an empty box). Bands are
     weighted by their own count, so the rail reads as a proportion as well as a set. Every
     count is the band's real length; a band with nothing in it is not drawn at all. */

  const RAIL_TILE_CAP = 12;
  type RailBand = 'today' | 'scheduled' | 'buffer';

  const railTile = (q: QueueItem, band: RailBand) => {
    const cover = cardImageUrl(q);
    return (
      <button
        key={q.id}
        type="button"
        onClick={() => onOpen(q)}
        data-rail-tile={band}
        title={noDash(q.title || q.hook) || 'Untitled post'}
        style={{
          flex: '1 1 0', minWidth: 0, padding: 0, cursor: 'pointer', display: 'block',
          height: 'clamp(44px, 9vw, 56px)', position: 'relative', overflow: 'hidden',
          borderRadius: 7, background: PLATE_TILE_SUNK,
          border: band === 'today' ? '2px solid var(--cb-accent)'
            : band === 'buffer' ? `1px dashed ${PLATE_TILE_GHOST}`
            : `1px solid ${PLATE_TILE_LINE}`,
        }}
      >
        {cover && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            onError={hideBroken}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'top',
              opacity: band === 'buffer' ? 0.42 : band === 'scheduled' ? 0.88 : 1,
            }}
          />
        )}
        <span aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(17,17,17,.55), rgba(17,17,17,0) 62%)' }} />
      </button>
    );
  };

  const railBand = (items: QueueItem[], band: RailBand, label: string) => {
    if (!items.length) return null;
    const tone = band === 'today' ? 'accent' : band === 'scheduled' ? 'plate' : 'plate-mute';
    const labelColor = band === 'today' ? 'var(--cb-accent)' : band === 'scheduled' ? PLATE_SOFT : PLATE_MUTE;
    return (
      <div key={band} style={{ flex: `${items.length} 1 0`, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {items.slice(0, RAIL_TILE_CAP).map((q) => railTile(q, band))}
        </div>
        <div aria-hidden style={{ height: 7, border: `1px solid ${PLATE_RULE_SOFT}`, borderTop: 0, marginTop: 9 }} />
        <div style={{ marginTop: 5, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 5, flexWrap: 'wrap' }}>
          <Num size="row" inline tone={tone}>{items.length}</Num>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: labelColor, lineHeight: 1.35 }}>{label}</span>
        </div>
      </div>
    );
  };

  const scheduledSpan = dateSpan(laterItems[0]?.publish_date, laterItems[laterItems.length - 1]?.publish_date);

  /** The ONE chip a compressed day row carries. Everything else a row used to chip (format,
   *  funnel, pillar, provenance, the swap mark, the read count) moved into that row's drill:
   *  the glance rail above already carries the artwork, and a four-chip row per day was the
   *  redundancy this rebuild set out to kill. */
  const statusChip = (q: QueueItem) => (
    <Chip tone={q.publish_date === today && stageOf(q) !== 'published' ? 'accent' : 'default'}>{statusOf(q)}</Chip>
  );

  /** The swap list: this slot's bench angles plus the ready-draft pool. */
  const swapList = (q: QueueItem) => {
    const bench = benchFor(q.id);
    if (!bench.length && !pool.length) return null;
    return (
      <div style={{ marginTop: 14 }}>
        <Eyebrow>A different idea for this slot</Eyebrow>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {bench.map((alt) => (
            <div key={alt.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, border: '1px solid var(--cb-line)', borderRadius: 12, padding: 10 }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink)' }}>{noDash(alt.title)}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--cb-ink-mute)' }}>{noDash(alt.hook)}</span>
              </span>
              <Pill onClick={() => onPickAngle(q.id, alt)}>Use this</Pill>
            </div>
          ))}
          {pool.length > 0 && <Eyebrow style={{ marginTop: 4 }}>From your ready drafts</Eyebrow>}
          {pool.map((it) => (
            <div key={it.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, border: '1px solid var(--cb-line)', borderRadius: 12, padding: 10 }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink)' }}>{noDash(it.title || 'Ready draft')}</span>
                {it.body && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--cb-ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noDash(it.body)}</span>}
              </span>
              <Pill onClick={() => onPickReplacement?.(q.id, it)}>Use this</Pill>
            </div>
          ))}
        </div>
      </div>
    );
  };

  /** Everything inside a row's collapsed drill: hook, media, copy, chips, actions. */
  const rowDrillBody = (q: QueueItem) => {
    const slides = slidesOf(q);
    const cover = cardImageUrl(q);
    const perf = perfFor(q);
    const prov = provenanceOf(q);
    const isOut = stageOf(q) === 'published';
    const swapped = !!angleSwaps[q.id];
    return (
      <>
        <Eyebrow>Hook</Eyebrow>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--cb-ink)', lineHeight: 1.4, marginTop: 5 }}>
          {noDash(stripBrand(q.hook || q.title)) || 'No hook written yet.'}
        </div>

        {slides.length >= 2 ? (
          <div style={{ marginTop: 12 }}>
            <Eyebrow>The slides</Eyebrow>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <Num size="row" inline>{slides.length}</Num>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>in the deck</span>
            </div>
            <SlideStrip srcs={slides} height={124} style={{ marginTop: 7 }} />
          </div>
        ) : q.generating ? (
          <Blank style={{ marginTop: 12, height: 96 }}>the image is still rendering</Blank>
        ) : cover ? (
          <img src={cover} alt="" loading="lazy" onError={hideBroken} style={{ marginTop: 12, width: 180, maxWidth: '100%', borderRadius: 12, border: '1px solid var(--cb-line)', display: 'block' }} />
        ) : null}

        <div style={{ marginTop: 13 }}>
          <Eyebrow>The copy</Eyebrow>
          {q.body ? (
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--cb-ink-soft)', marginTop: 5, ...CLAMP8 }}>{q.body}</div>
          ) : (
            <Blank style={{ marginTop: 6, height: 44 }}>{q.generating ? 'being written now' : 'no copy written yet'}</Blank>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 13 }}>
          <Chip>{kickerOf(q)}</Chip>
          <FunnelChip stage={q.funnel_stage} accent={accent} />
          {q.pillar && <Chip>{noDash(q.pillar)}</Chip>}
          {prov && <Chip>{noDash(prov.label)}</Chip>}
          {swapped && <Chip>fresh idea, same slot</Chip>}
          {typeof perf?.impressions === 'number' && (
            <>
              <Num size="row" inline>{perf.impressions.toLocaleString('en-GB')}</Num>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>reads</span>
            </>
          )}
          {prov?.quote && <span style={{ fontSize: 12.5, fontStyle: 'italic', color: 'var(--cb-ink-mute)' }}>“{noDash(prov.quote)}”</span>}
        </div>

        {/* Actions. A published row links out to the real post instead of edit pills. */}
        <div style={{ marginTop: 13, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {isOut ? (
            perf?.url
              ? <a href={perf.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cb-accent)', textDecoration: 'underline', textUnderlineOffset: 3 }}>View on LinkedIn →</a>
              : <Footnote style={{ marginTop: 0 }}>The live post link is <span style={{ color: 'var(--cb-ink-mute)' }}>—</span> not tracked yet.</Footnote>
          ) : skips[q.id] ? (
            <Pill onClick={() => onUnskip(q.id)}>Put this post back</Pill>
          ) : (
            <>
              {actionPill(q, 'Edit copy', { editing: true })}
              {actionPill(q, 'Edit time', { scheduling: true })}
              {!live && actionPill(q, 'Swap slot', { changing: true })}
              {!live && stageOf(q) === 'review' && <Pill tone="accent" onClick={() => onApprove(q.id)}>Approve</Pill>}
              {isScheduled(q) && onClearDay && <Pill onClick={() => void runDayWrite(q.publish_date || '', onClearDay(q.id, q.publish_date))}>Clear the day</Pill>}
              {isScheduled(q) && onLeaveDayEmpty && <Pill onClick={() => onLeaveDayEmpty(q.id, q.publish_date)}>Clear it and hold the day</Pill>}
              {isScheduled(q) && onBackToBuffer && <Pill onClick={() => onBackToBuffer(q.id)}>Back to the buffer</Pill>}
              <Pill onClick={() => onSkip(q.id)}>Remove this post</Pill>
            </>
          )}
        </div>
        {swapList(q)}
      </>
    );
  };

  /** The day cell every timeline row opens with, on ONE line (weekday + date numeral). The
   *  month lives in the week-range eyebrow at the top; repeating it per row was half the
   *  old row's height for none of its information. */
  const dayCell = (day: string, tone: 'today' | 'dated' | 'empty') => (
    <div style={{ flex: 'none', width: 74, display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: tone === 'today' ? 'var(--cb-ink)' : 'var(--cb-ink-mute)' }}>{weekdayShort(day)}</span>
      <Num size="row" inline tone={tone === 'today' ? 'ink' : tone === 'dated' ? 'soft' : 'mute'}>{dayNumOf(day)}</Num>
    </div>
  );

  /**
   * One dated post row, compressed to a single line: day, title, status, and the collapsed
   * "Open post" drill that still carries every write path. The cover thumbnail is gone on
   * purpose — the glance rail directly above draws the same artwork a day at a time, and the
   * drill shows it full size. `dim` marks the beyond-the-window group.
   */
  const postRow = (q: QueueItem, day: string, opts: { dim?: boolean; last?: boolean } = {}) => {
    const isToday = day === today;
    const isOut = stageOf(q) === 'published';
    return (
      <div
        key={q.id}
        data-day-row=""
        style={{
          display: 'flex', gap: 14, padding: '11px 0',
          borderBottom: opts.last ? undefined : '1px solid var(--cb-line)',
          opacity: opts.dim ? 0.78 : 1,
          background: flashId === q.id ? 'color-mix(in srgb, var(--cb-accent) 7%, var(--cb-paper))' : undefined,
        }}
      >
        {dayCell(day, isToday ? 'today' : 'dated')}
        <div style={{ flex: 'none', width: 20, position: 'relative' }} aria-hidden>
          <span style={{ position: 'absolute', left: 9, top: 0, bottom: -11, width: 1, background: 'var(--cb-line)' }} />
          <span style={{
            position: 'absolute', left: isToday ? 1 : 3.5, top: isToday ? 3 : 5,
            width: isToday ? 17 : 12, height: isToday ? 17 : 12, borderRadius: '50%',
            background: isToday ? 'var(--cb-accent)' : isOut ? mint : 'var(--cb-paper)',
            border: isToday ? '3px solid var(--cb-ink)' : isOut ? `1px solid ${mint}` : '1px solid var(--cb-ink-mute)',
          }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onOpen(q)}
              style={{
                flex: '1 1 200px', minWidth: 0, textAlign: 'left', background: 'none', border: 'none',
                padding: 0, cursor: 'pointer', fontFamily: 'var(--cb-serif)', fontWeight: 600,
                fontSize: 15.5, lineHeight: 1.35, color: 'var(--cb-ink)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}
            >{truncAt(noDash(stripBrand(q.hook || q.title)) || 'Untitled post', 72)}</button>
            {statusChip(q)}
          </div>
          <Drill label="Open post" ruled={false} summaryStyle={{ padding: '5px 0 0' }}>{rowDrillBody(q)}</Drill>
        </div>
      </div>
    );
  };

  /** A day with no post: weekend, held-empty, a calendar-only slot, or an open slot. */
  const emptyRow = (day: string, last: boolean) => {
    const weekend = isWeekendDay(day);
    const heldPost = board.queue.find((q) => q.publish_date === day && leftEmpty[q.id]);
    const held = heldPost ? heldPost.id : (leftEmpty[day] ? day : null);
    const calItems = calOnlyOnDay(day);
    const err = dayErr[day];
    const restoreFirst = recentlyCleared[day];
    const ready = restoreFirst
      ? [...readyToAdd].sort((a, b) => (a.id === restoreFirst ? -1 : b.id === restoreFirst ? 1 : 0))
      : readyToAdd;
    return (
      <div key={day} data-day-row="" style={{ display: 'flex', gap: 14, padding: '11px 0', borderBottom: last ? undefined : '1px solid var(--cb-line)' }}>
        {dayCell(day, 'empty')}
        <div style={{ flex: 'none', width: 20, position: 'relative' }} aria-hidden>
          <span style={{ position: 'absolute', left: 9, top: 0, bottom: -11, width: 1, background: 'var(--cb-line)' }} />
          <span style={{ position: 'absolute', left: 3.5, top: 5, width: 12, height: 12, borderRadius: '50%', border: '2px dashed var(--cb-ink-mute)', background: 'var(--cb-paper)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {weekend ? (
            <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>Weekend, not a posting day</div>
          ) : calItems.length ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 200px', minWidth: 0, fontFamily: 'var(--cb-serif)', fontWeight: 600, fontSize: 15, lineHeight: 1.35, color: 'var(--cb-ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{noDash(calItems[0].label)}</span>
              <Chip>planned</Chip>
              <Pill onClick={() => onOpenCal(calItems[0])}>Open this slot</Pill>
            </div>
          ) : held ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 200px', minWidth: 0, fontSize: 14.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>{weekdayLong(day)} is held empty on purpose.</span>
              <Pill onClick={() => onRefillDay?.(held)}>Put a post back on this day</Pill>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {/* Caption scale, not numeral scale: the kit's blank is sized for a lone
                    em dash, and a six-word caption at that size overflowed its own box. */}
                <Blank style={{ flex: '1 1 190px', minHeight: 32, maxWidth: 280, padding: '5px 12px', fontSize: 13.5, lineHeight: 1.35, textAlign: 'center' }}>nothing scheduled this day</Blank>
                {onScheduleToDay && ready.length > 0 && (
                  <Pill active={addDay === day} onClick={() => setAddDay(addDay === day ? null : day)}>Add a post</Pill>
                )}
                {onLeaveEmpty && <Pill onClick={() => onLeaveEmpty(day)}>Leave this day empty</Pill>}
              </div>
              {addDay === day && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ready.map((r) => (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, border: '1px solid var(--cb-line)', borderRadius: 12, padding: 10 }}>
                      <span style={{ minWidth: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--cb-ink)' }}>{noDash(r.hook || r.title) || 'Ready draft'}</span>
                      <Pill onClick={() => void runDayWrite(day, onScheduleToDay?.(r.id, day))}>Put it here</Pill>
                    </div>
                  ))}
                </div>
              )}
              {err && <Footnote>{noDash(err)}</Footnote>}
            </>
          )}
        </div>
      </div>
    );
  };

  /* ────────── render ────────── */

  return (
    <section className="tab" data-surface="week">

      {/* 1 — the real week range, then a headline computed off the live queue. */}
      <Eyebrow>This week · {fmtDay(days[0])} to {fmtDay(windowEnd)}</Eyebrow>
      <DeskH2>{headline}</DeskH2>

      {/* 2 — the week at a glance, ABOVE the plate (Ivan 08-02 round 3): one tile a day, carrying the real cover. It is also the
          artwork the compressed day rows below no longer repeat, AND the second control on
          the day selector (Ivan 08-02: "when u touch on any of the week at a glance it shows
          its preview linkedin html"). One state, two controls: these tiles and the day pills
          on the plate both write `pickedDay`, and the preview reads it. A weekend or empty
          tile selects its day too; the preview area then renders its own honest weekend /
          nothing-scheduled state, which already existed.

          THE THREE SIGNALS, kept on separate layers so they can all be true at once:
            border   — what KIND of day it is (lead magnet mint, today ink, weekend dashed)
            inset ring — which day is SELECTED (accent, drawn inside so the row never widens
                       and the tiles never reflow when the selection moves)
            mint band  — the lead magnet again, in shape as well as colour, so the tile still
                       reads as one at 390px where a 2px border is nearly nothing. */}
      <div style={{ marginTop: 22 }}>
        <Eyebrow>The week at a glance</Eyebrow>
        <div data-viz style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {days.map((d) => {
            const dayPosts = postsOnDay(d);
            const post = dayPosts[0];
            const cover = post ? cardImageUrl(post) : undefined;
            const weekend = isWeekendDay(d);
            const isToday = d === today;
            const on = d === selectedDay;
            const out = !!post && stageOf(post) === 'published';
            // ANY post that day, not only the one whose cover is drawn: on a two-post day
            // the tile still has to say a lead magnet lands here.
            const lm = dayPosts.some(isLeadMagnet);
            // Selection ring first (it owns the outermost inset), then today's own ring
            // stepped inside it on the rare day the mint border has taken today's slot.
            const rings = [
              on ? 'inset 0 0 0 2px var(--cb-accent)' : '',
              isToday && lm ? `inset 0 0 0 ${on ? 4 : 2}px var(--cb-ink)` : '',
            ].filter(Boolean).join(', ');
            return (
              <button
                key={d}
                type="button"
                className="cb-weekrail-tile"
                data-glance-tile={d}
                data-glance-lm={lm ? '' : undefined}
                tabIndex={0}
                onClick={() => setPickedDay(d)}
                aria-pressed={on}
                title={post ? (post.title || post.hook || weekdayLong(d)) : weekend ? `${weekdayLong(d)}, not a posting day` : `${weekdayLong(d)}, nothing scheduled`}
                aria-label={`${weekdayLong(d)} ${dayNumOf(d)}${lm ? ', lead magnet' : ''}`}
                style={{
                  flex: '1 1 0', minWidth: 0, padding: 0, cursor: 'pointer',
                  height: 'clamp(54px, 13vw, 82px)', position: 'relative', overflow: 'hidden',
                  borderRadius: 7, display: 'block', background: 'var(--cb-paper-sunk)',
                  border: lm ? '2px solid var(--cb-mint)'
                    : isToday ? '2px solid var(--cb-ink)'
                    : weekend ? '1px dashed var(--cb-line-bold)'
                    : '1px solid var(--cb-line-bold)',
                  boxShadow: rings || undefined,
                  // A weekend tile stays dimmed, but never so dim that a selected one
                  // cannot show its ring.
                  opacity: weekend ? (on ? 0.75 : 0.55) : 1,
                }}
              >
                {cover && <img src={cover} alt="" loading="lazy" onError={hideBroken} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />}
                {out && <span aria-hidden style={{ position: 'absolute', right: 4, top: 4, width: 8, height: 8, borderRadius: '50%', background: mint }} />}
                {lm && <span aria-hidden style={{ position: 'absolute', left: 4, right: 4, bottom: 3, height: 3, borderRadius: 2, background: 'var(--cb-mint)' }} />}
                <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: cover ? PLATE_INK : 'var(--cb-ink-mute)', background: cover ? 'linear-gradient(0deg, rgba(17,17,17,.62), rgba(17,17,17,0))' : 'none', padding: `10px 0 ${lm ? 7 : 3}px`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {weekdayShort(d)}
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ height: 7, borderLeft: '1px solid var(--cb-line-bold)', borderRight: '1px solid var(--cb-line-bold)', borderBottom: '1px solid var(--cb-line-bold)', marginTop: 8 }} aria-hidden />
        <Footnote>
          <Num size="row" inline>{daysWithPost}</Num> of the <Num size="row" inline>{workingDays}</Num> working days in this window carry a post. Weekends are not posting days. Pick a day to see it as it lands on LinkedIn.
          {/* The legend token renders ONLY when the drawn window really contains one, the
              same rule the calendar strip's mint key follows. */}
          {lmDays.length > 0 && (
            <>
              {' '}
              <span aria-hidden style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--cb-mint)', marginRight: 5, verticalAlign: 'baseline' }} />
              {lmDays.length === 1 ? 'The tinted day carries a lead magnet.' : 'The tinted days carry a lead magnet.'}
            </>
          )}
        </Footnote>
      </div>


      {/* 3 — ONE full-width plate. Its UP NEXT area hosts the LinkedIn preview itself
          (Ivan 08-02: "it could be inside that gray queue square up next"), so the post and
          the numbers about the post finally sit on the same piece of paper. The old outside
          preview column and the row that wrapped it are gone: nothing hangs below the plate,
          because there is nothing beside the plate any more.
          Left column = the ops read (counts, what ships next, the deck, the edit pills, the
          queue rail, the footer line). Right column = day pills + the framed preview. */}
      <style>{WEEK_CSS}</style>
      <Plate className="cb-week-plate" style={{ marginTop: 18 }} pad="clamp(20px, 2.8vw, 28px)">
      <div className="cb-week-grid">
      <div className="cb-week-col-left">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px 26px', alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 190px', minWidth: 0 }}>
            {/* An empty queue is ABSENT data, not a zero: it renders the honest blank. Real
                zeros INSIDE a real queue (0 today, 5 scheduled) are computed facts and stay. */}
            {queueTotal > 0 ? (
              <>
                <Num size="hero" tone="accent">{queueTotal}</Num>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: PLATE_SOFT, marginTop: 6, lineHeight: 1.35 }}>in the queue</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '4px 14px', marginTop: 10 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                    <Num size="big" inline tone="plate">{todayItems.length}</Num>
                    <PlateMute style={{ fontSize: 13.5, fontWeight: 700 }}>today</PlateMute>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                    <Num size="big" inline tone="plate-mute">{laterItems.length}</Num>
                    <PlateMute style={{ fontSize: 13.5, fontWeight: 700 }}>scheduled</PlateMute>
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
                    <Num size="big" inline tone="plate-mute">{bufferItems.length}</Num>
                    <PlateMute style={{ fontSize: 13.5, fontWeight: 700 }}>in buffer</PlateMute>
                  </span>
                </div>
              </>
            ) : (
              <>
                <Blank on="plate" style={{ height: 62 }}>nothing in the queue yet</Blank>
                <Footnote on="plate">No drafts are dated and none are waiting in the buffer.</Footnote>
              </>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 12 }} aria-hidden>
              <span style={{ flex: 1, borderTop: '1px dashed rgba(255,255,255,.5)' }} />
              <span style={{ width: 0, height: 0, borderLeft: '8px solid var(--cb-accent)', borderTop: '5px solid transparent', borderBottom: '5px solid transparent' }} />
            </div>
          </div>

          <div style={{ flex: '1 1 240px', minWidth: 0, borderLeft: '3px solid var(--cb-accent)', paddingLeft: 16 }}>
            {/* Round 4: this block shows the SELECTED day's post (fallback: up next), and
                the pills act on the post shown, so every day's post is editable from here. */}
            <Eyebrow on="plate">
              {stageIsFallback ? 'Up next'
                : stagePublished ? (selectedDay === today ? 'Out today' : `Out ${weekdayLong(selectedDay)} ${dayNumOf(selectedDay)}`)
                : selectedDay === today ? 'Ships today'
                : `On ${weekdayLong(selectedDay)} ${dayNumOf(selectedDay)}`}
            </Eyebrow>
            {stageItem ? (
              <>
                <div style={{ fontFamily: 'var(--cb-serif)', fontWeight: 600, fontSize: 'clamp(17px, 4.6vw, 21px)', lineHeight: 1.3, color: PLATE_INK, marginTop: 8 }}>
                  {noDash(stageItem.title || stageItem.hook) || 'Untitled post'}
                </div>
                <div style={{ marginTop: 11, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip tone="accent">{statusOf(stageItem)}{isScheduled(stageItem) ? `, ${fmtSchedLA(stageItem.scheduled_at, stageItem.publish_date)}` : ''}</Chip>
                  <Chip tone="plate">{kickerOf(stageItem)}</Chip>
                  {stageItem.funnel_stage && <Chip tone="plate">{stageItem.funnel_stage}</Chip>}
                </div>
                <div data-upnext-actions="" style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {stagePublished ? (
                    (() => { const perf = perfFor(stageItem); return perf?.url
                      ? <a href={perf.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: 'var(--cb-accent)', textDecoration: 'underline', textUnderlineOffset: 3 }}>View on LinkedIn →</a>
                      : null; })()
                  ) : (
                    <>
                      {platePill('Edit copy', { editing: true })}
                      {platePill('Edit time', { scheduling: true })}
                      {!live && platePill('Swap slot', { changing: true })}
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Blank on="plate" style={{ marginTop: 10, height: 52 }}>nothing is dated yet</Blank>
                <Footnote on="plate">No post carries a date this week. Drafts in the buffer take the next open slot.</Footnote>
              </>
            )}
          </div>
        </div>

        {/* A deck is information the single-cover preview can't show; a single cover is
            already the framed preview in the next column, so it never repeats here. The
            edit pills that used to close this block moved up into the up-next block. */}
        {plateItem && plateSlides.length >= 2 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <Eyebrow on="plate" style={{ fontSize: 11.5, letterSpacing: '0.12em' }}>The slides</Eyebrow>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 5 }}>
                <Num size="row" inline tone="plate-mute">{plateSlides.length}</Num>
                <PlateMute style={{ fontSize: 12, fontWeight: 700 }}>in the deck, first {Math.min(6, plateSlides.length)} shown</PlateMute>
              </span>
            </div>
            <SlideStrip srcs={plateSlides.slice(0, 6)} style={{ marginTop: 9 }} />
          </div>
        )}

        {/* The queue, drawn: one tile per queued item, banded and counted. This is what makes
            the buffer visible — undated drafts exist as marks here, not only as a sentence. */}
        {/* The rail sits toward the BOTTOM of its column, so both columns close near the
            footer rule. Growing from a 0 basis, it takes the slack the taller column
            (usually the preview) leaves; when the queue is long it collapses to the min.
            CAPPED at 120px (08-02 defect): uncapped, a tall preview beside a short left
            column opened a dead field of dark plate between the up-next block and the rail.
            The cap keeps the rail near its content and lets the column simply end early,
            which reads as composition rather than as a hole. */}
        {queueTotal > 0 && <div style={{ flex: '1 0 0', minHeight: 18, maxHeight: 120 }} aria-hidden />}
        {queueTotal > 0 && (
          <div data-viz style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(9px, 2.4vw, 22px)' }}>
            {railBand(todayItems, 'today', 'today')}
            {railBand(laterItems, 'scheduled', scheduledSpan ? `scheduled, ${scheduledSpan}` : 'scheduled')}
            {railBand(bufferItems, 'buffer', 'in buffer')}
          </div>
        )}

      </div>{/* /left column */}

      {/* The plate's right column: the day selector, then the LinkedIn preview ITSELF, on
          the plate. No status chip and no action row under the card — FeedPreview's own
          header already says "Scheduled · Mon 3 Aug", the edit pills sit in the left column
          and on the day rows below, and clicking the card opens the full post. */}
      <div className="cb-week-col-right">
        {/* No header here by ruling (Ivan 08-02 round 4): the card speaks for itself, its
            own top line already says "Scheduled · Mon 3 Aug". The glance rail above the
            plate is the selector; this column just shows the picked day's post. */}
        <div>
          {selectedItem ? (
            <>
              {selectedItem.generating && (
                <div style={{ marginBottom: 9 }}>
                  <Chip tone="plate">being written, the cover is still rendering</Chip>
                </div>
              )}
              {/* The paper mat. Two jobs: it frames the card as an artifact pinned to dark
                  paper, and it BREAKS THE CASCADE — the desk skin sets the plate's colour
                  with !important and every unstyled descendant inherits it, so the mat
                  re-declares page ink on page paper and the white card keeps its own
                  contrast no matter what the plate is painted. */}
              <div
                className="cb-week-preview-frame"
                data-plate-preview=""
                onClick={() => onOpen(selectedItem)}
                style={{
                  cursor: 'pointer',
                  color: 'var(--cb-ink)',
                  background: 'var(--cb-paper)',
                  border: `1px solid ${PLATE_BORDER}`,
                  borderRadius: 18,
                  padding: 'clamp(8px, 1.3vw, 12px)',
                }}
              >
                <FeedPreview
                  item={selectedItem}
                  board={board}
                  accent={accent}
                  fontStack={fontStack}
                  size="lg"
                  cover={selectedItem.generating ? 'render' : 'plate'}
                  live={live}
                  /* 3 lines: LinkedIn's real desktop fold. 4 was the stacked layout's number. */
                  clampLines={3}
                />
              </div>
            </>
          ) : isWeekendDay(selectedDay) ? (
            <>
              <Blank on="plate" style={{ height: 120 }}>weekend, not a posting day</Blank>
              <Footnote on="plate">The cadence runs Monday to Friday.</Footnote>
            </>
          ) : (
            <>
              <Blank on="plate" style={{ height: 120 }}>nothing scheduled this day</Blank>
              <Footnote on="plate">Pick another day above, or add a post to this one in the list below.</Footnote>
            </>
          )}
        </div>
      </div>{/* /right column */}
      </div>{/* /plate grid */}

      {/* The plate's footer fact, run FULL WIDTH under both columns: it closes the plate as
          one composition, and the column seam terminates on it. Pinning it to the bottom of
          the shorter column instead left a dead band of plate under the queue rail. */}
      <PlateRule gap={20} />
      <Footnote on="plate">
        {publishedItems.length > 0
          /* The rail above already carries "the rest keeps publishing on its slots" as
             marks, so the line stays a single fact and the panel keeps density headroom. */
          ? <><Num size="row" inline tone="plate-mute">{publishedItems.length}</Num> {publishedItems.length === 1 ? 'post is' : 'posts are'} out so far.</>
          : 'Nothing has published from this board yet.'}
      </Footnote>
      </Plate>

      {/* 4 — day by day, one compressed line each, every one still openable. */}
      <div style={{ marginTop: 28 }}>
        <SectionRule
          label="Day by day"
          count={days.reduce((n, d) => n + postsOnDay(d).length, 0) || undefined}
          blurb={days.some((d) => postsOnDay(d).length) ? 'dated on the days below' : 'no post carries a date in this window'}
        />
        <div className="timeline">
          {/* Weekends carry no row here: the glance rail above already draws them dashed and
              its footnote says so. A "Weekend, not a posting day" line per weekend repeated
              that fact twice a week. */}
          {days.filter((d) => postsOnDay(d).length > 0 || !isWeekendDay(d)).map((d, di, rowDays) => {
            const posts = postsOnDay(d);
            const last = di === rowDays.length - 1 && beyondWindow.length === 0;
            if (!posts.length) return emptyRow(d, last);
            return posts.map((q, qi) => postRow(q, d, { last: last && qi === posts.length - 1 }));
          })}

          {beyondWindow.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 14, padding: '6px 0 2px' }}>
                <div style={{ flex: 'none', width: 68 }} />
                <div style={{ flex: 'none', width: 20, position: 'relative' }} aria-hidden>
                  <span style={{ position: 'absolute', left: 9, top: 0, bottom: 0, width: 1, background: 'var(--cb-line)' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cb-ink-mute)' }}>Past this week</div>
              </div>
              {/* All of them fold: three open rows of NEXT week's posts on the This-week tab
                  was weight without information — the count and the drill carry it. */}
              <Drill label="open them" summaryLeft={<><b>{beyondWindow.length}</b> {beyondWindow.length === 1 ? 'post is' : 'posts are'} dated past this window</>} style={{ marginLeft: 102 }}>
                {beyondWindow.map((q, i) => (
                  <div key={q.id || i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', padding: '7px 0', borderTop: i ? '1px solid var(--cb-line)' : 'none' }}>
                    <span style={{ flex: 'none', width: 64, fontSize: 12, fontWeight: 800, color: 'var(--cb-ink-mute)' }}>{fmtDay(q.publish_date)}</span>
                    <button onClick={() => onOpen(q)} style={{ flex: '1 1 200px', minWidth: 0, textAlign: 'left', fontSize: 13.5, fontWeight: 600, color: 'var(--cb-ink)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{noDash(stripBrand(q.hook || q.title)) || 'Untitled'}</button>
                  </div>
                ))}
              </Drill>
            </>
          )}
        </div>

        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill onClick={onGoContent}>See everything in the pipeline</Pill>
          {bufferItems.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
              <Num size="row" inline tone="mute">{bufferItems.length}</Num>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cb-ink-mute)' }}>{bufferItems.length === 1 ? 'draft is' : 'drafts are'} written and waiting in the buffer, no date yet</span>
            </span>
          )}
        </div>
      </div>

      {/* 5 — the stat footer. Nothing here is typed in; a stat that cannot be computed is
             either an honest blank or is not rendered at all. */}
      <StatStrip>
        {cadence !== null
          ? <Stat value={cadence} caption={cadenceCaption} />
          : <StatBlank caption="posts a week, not tracked yet" />}
        {publishedItems.length > 0
          ? <Stat value={publishedItems.length} caption={`${publishedItems.length === 1 ? 'post' : 'posts'} out so far`} />
          : <StatBlank caption="posts out so far, none yet" />}
        {readsLastWeek !== null && (
          <Stat value={readsLastWeek.n.toLocaleString('en-GB')} caption={`reads, ${fmtDay(readsLastWeek.from)} to ${fmtDay(readsLastWeek.to)}`} />
        )}
      </StatStrip>
      {bufferItems.length > 0 && (
        <Footnote>
          Dates past {lastDated ? fmtDay(lastDated) : 'this week'} are not set yet.
        </Footnote>
      )}
      {/* onSetSchedule is part of the contract and stays on the props; the exact date/time
          entry lives in the detail drawer, which "Edit time" opens via onOpen(q,{scheduling}). */}
      {onSetSchedule === undefined && null}
    </section>
  );
}

export default DeskWeekSurface;
