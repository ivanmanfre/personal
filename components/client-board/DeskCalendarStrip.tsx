import React from 'react';
import type { Board, CalendarItem, QueueItem } from '../ClientBoardPage';
import { SectionRule, Footnote } from './desk-kit';
import { useNight, useQuiet } from './perf-kit/night';

/**
 * DeskCalendarStrip — the compact month strip that replaces `CalendarSurface` inside the
 * desk skin's "All content" Calendar view.
 *
 * Matched to the approved static reference (`phase3-panels/frag-review.html` →
 * `<div data-view="cal">`): a section rule ("Calendar · <range>" + a real `dated slots`
 * metric), a 7-column month grid whose cells carry a date numeral, a truncated title preview
 * and a MARK per dated item, and a compact legend (state keys, plus a mint "lead magnets" key
 * only when the drawn window contains one).
 *
 * Deliberate deviations from the frag, both to hold the density budget:
 *  - cells are marks, not image tiles (the frag's square covers cost ~3× the height, and
 *    the tab already carries the same thumbnails in its list rows), and
 *  - the frag's trailing dated mini-list is NOT reproduced here — it duplicated the list
 *    view row-for-row (critic BLOCKER-4).
 *
 * Zero prose sentences, zero `<p>`, no hardcoded hex. The only write path is the OPTIONAL
 * `onMoveItem` drag-to-reschedule prop; when it is absent the strip is read-only exactly as
 * before (preview boards keep their old behaviour).
 */

const DAY_MS = 86400000;
/** Onboarding call/review entries share the calendar but are not pieces of content —
 *  the same rule `CalendarSurface`'s totals use. */
const CONTENT_KINDS = new Set(['post', 'carousel', 'lm', 'newsletter', 'newsjack']);

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parseIso = (s: string) => new Date(`${s}T00:00:00`);
const shortDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
/** Grid rows always start on a Monday, so the M–S header can never lie. */
const mondayOf = (d: Date) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
};
const isWeekendDate = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/**
 * Title previews + the taller cell they need are CONTAINER-gated, not viewport-gated: the
 * strip is dropped into columns of different widths, and a viewport rule would print a
 * title into a 45px cell on a phone. Below the threshold the text is removed entirely and
 * the bar carries the day on its own, so the grid can never overflow its column. Browsers
 * without container queries fall back to a viewport rule; if neither matches, the strip is
 * exactly the (safe) pre-title layout.
 */
const CAL_CSS = `
.cb-calstrip-wrap { container-type: inline-size; container-name: cb-calstrip; }
.cb-calstrip-title {
  position: absolute; top: 23px; left: 7px; right: 7px;
  font-size: 11.5px; font-weight: 650; line-height: 1.28; letter-spacing: 0;
  color: var(--cb-ink-soft);
  overflow: hidden; text-overflow: ellipsis; word-break: break-word;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  pointer-events: none;
  display: none;
}
.cb-calstrip-more { font-size: 11.5px; font-weight: 800; color: var(--cb-ink-mute); display: none; }
/* The post's cover beside its title (Ivan 2026-09-28: keep the v3 calendar's previews).
   Width-gated with the title: a phone cell is 45px and carries the bar alone. */
.cb-calstrip-thumb {
  display: none; position: absolute; top: 26px; left: 7px; width: 40px; height: 50px;
  object-fit: cover; object-position: top; border-radius: 5px; border: 1px solid var(--cb-line);
  background: var(--cb-paper-sunk); pointer-events: none;
}
@container cb-calstrip (min-width: 520px) {
  /* !important because the 58px base stays INLINE (it is the read-only layout, and the
     desk-review smoke test asserts it); only the width-gated title layout raises it. */
  .cb-calstrip-cell { height: 118px !important; }
  .cb-calstrip-title { display: -webkit-box; font-size: 12.5px; -webkit-line-clamp: 4; top: 26px; }
  .cb-calstrip-more { display: inline; }
  .cb-calstrip-thumb { display: block; }
  .cb-calstrip-title.has-thumb { left: 53px; }
}
@supports not (container-type: inline-size) {
  @media (min-width: 900px) {
    /* !important because the 58px base stays INLINE (it is the read-only layout, and the
     desk-review smoke test asserts it); only the width-gated title layout raises it. */
  .cb-calstrip-cell { height: 118px !important; }
    .cb-calstrip-title { display: -webkit-box; font-size: 12.5px; -webkit-line-clamp: 4; top: 26px; }
    .cb-calstrip-more { display: inline; }
    .cb-calstrip-thumb { display: block; }
    .cb-calstrip-title.has-thumb { left: 53px; }
  }
}
`;

/**
 * NIGHT MOCKUP (local only, 2026-09-29): glass cells, today lit with an accent ring, the
 * published bar dimmed (the desk ink turns white at night), a thumbnail that only shows once
 * it has really loaded. The desk skin zeroes box-shadow on every element with !important,
 * so the glow sits on a pseudo-element. Rendered only behind ?night.
 */
const CAL_NIGHT_CSS = `
.cb-calstrip-cell.cb-cal-n { background: rgb(var(--nt-fg, 255 255 255) / 0.018) !important; border: 1px solid rgb(var(--nt-fg, 255 255 255) / 0.06) !important; }
.cb-calstrip-cell.cb-cal-n.has { background: linear-gradient(180deg, rgb(var(--nt-fg, 255 255 255) / 0.055), rgb(var(--nt-fg, 255 255 255) / 0.018)) !important; border-color: rgb(var(--nt-fg, 255 255 255) / 0.1) !important; }
.cb-calstrip-cell.cb-cal-n.wknd:not(.has) { background: repeating-linear-gradient(45deg, rgb(var(--nt-fg, 255 255 255) / 0.03) 0 4px, transparent 4px 9px) !important; border-style: dashed !important; }
.cb-calstrip-cell.cb-cal-n.today { border: 1.5px solid var(--cb-accent) !important; background: linear-gradient(180deg, color-mix(in srgb, var(--pk-acc, #FFC71D) 12%, transparent), color-mix(in srgb, var(--pk-acc, #FFC71D) 2%, transparent)) !important; }
.cb-calstrip-cell.cb-cal-n.today::after { content: ''; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none; box-shadow: 0 0 20px color-mix(in srgb, var(--pk-acc, #FFC71D) 40%, transparent), 0 0 44px color-mix(in srgb, var(--pk-acc, #FFC71D) 14%, transparent); }
.cb-calstrip-cell.cb-cal-n.today .cb-cal-daynum { color: var(--cb-accent-fg, var(--cb-accent)) !important; }
.cb-cal-n .cb-calstrip-title { color: rgb(var(--nt-fg, 255 255 255) / 0.82); }
.cb-cal-n .cb-calstrip-more { color: rgb(var(--nt-fg, 255 255 255) / 0.66); }
/* the strip's head: caps label + count pill, over a lit rule (v2's section look) */
.cb-cal-head { position: relative; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 4px 0 12px; font-family: var(--cb-body, Manrope), sans-serif; font-size: 12px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; color: rgb(var(--nt-fg, 255 255 255)); }
.cb-cal-head::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 1px; background: linear-gradient(90deg, var(--cb-accent), rgb(var(--nt-fg, 255 255 255) / .14) 34%, rgb(var(--nt-fg, 255 255 255) / .04)); }
.cb-cal-head span { display: inline-flex; align-items: center; min-width: 26px; justify-content: center; padding: 2px 9px; border-radius: 999px; background: color-mix(in srgb, var(--cb-accent) 14%, transparent); font-size: 12.5px; letter-spacing: 0; color: var(--cb-accent-fg, var(--cb-accent)); font-variant-numeric: tabular-nums; }
.cb-cal-n .cb-calstrip-thumb { border-color: rgb(var(--nt-fg, 255 255 255) / 0.12); background: none; }
.cb-cal-n .cb-calstrip-thumb:not([data-ok]) { visibility: hidden; }
/* no cover loaded: the title takes the cover's place instead of sitting indented beside a hole */
.cb-cal-n .cb-calstrip-thumb:not([data-ok]) + .cb-calstrip-title.has-thumb { left: 7px; }
@media (prefers-reduced-motion: no-preference) and (hover: hover) {
  .cb-calstrip-cell.cb-cal-n { transition: border-color .2s ease, transform .2s cubic-bezier(.25,1,.5,1); }
  button.cb-calstrip-cell.cb-cal-n:hover, div[role=button].cb-calstrip-cell.cb-cal-n:hover { border-color: color-mix(in srgb, var(--pk-acc, #FFC71D) 45%, transparent) !important; transform: translateY(-2px); }
}
`;

/**
 * QUIET MOCKUP (local only, 2026-09-29, "private-bank quiet, receipts first"): the night
 * strip on a light ground. White cells for days with a post, pale wells for empty ones, today
 * a flat 2px yellow edge, ink titles; the head's rule and count go ink. Rendered only
 * behind ?quiet (on top of CAL_NIGHT_CSS, hence the matching !important).
 */
const CAL_QUIET_CSS = `
[data-quiet] .cb-calstrip-cell.cb-cal-n { background: #EFEFEC !important; border: 1px solid rgba(17,17,17,0.07) !important; }
[data-quiet] .cb-calstrip-cell.cb-cal-n.has { background: #FFFFFF !important; border-color: rgba(17,17,17,0.09) !important; }
[data-quiet] .cb-calstrip-cell.cb-cal-n.wknd:not(.has) { background: repeating-linear-gradient(45deg, rgba(17,17,17,0.04) 0 4px, transparent 4px 9px) !important; border: 1px dashed rgba(17,17,17,0.14) !important; }
[data-quiet] .cb-calstrip-cell.cb-cal-n.today { border: 2px solid var(--cb-accent) !important; background: #FFFFFF !important; }
[data-quiet] .cb-calstrip-cell.cb-cal-n.today::after { display: none; }
[data-quiet] .cb-calstrip-cell.cb-cal-n.today .cb-cal-daynum { color: #111 !important; }
[data-quiet] .cb-cal-n .cb-calstrip-title { color: #111; }
[data-quiet] .cb-cal-n .cb-calstrip-more { color: rgba(17,17,17,0.62); }
[data-quiet] .cb-cal-head::after { background: rgba(17,17,17,0.12); }
[data-quiet] .cb-cal-head span { background: rgba(17,17,17,0.07); color: #111; }
[data-quiet] .cb-cal-n .cb-calstrip-thumb { border-color: rgba(17,17,17,0.1); }
@media (prefers-reduced-motion: no-preference) and (hover: hover) {
  [data-quiet] button.cb-calstrip-cell.cb-cal-n:hover, [data-quiet] div[role=button].cb-calstrip-cell.cb-cal-n:hover { border-color: rgba(17,17,17,0.3) !important; }
}
`;

type MarkState = 'out' | 'ahead';
type Mark = { item: CalendarItem; state: MarkState; approved: boolean; lm: boolean };

/**
 * Lead magnet, classified exactly as `DeskWeekSurface.isLeadMagnet` classifies it, so the
 * glance rail and this strip can never disagree about which day carries one. `lm_gate`
 * counts (Ivan 08-02): a gated carousel IS a lead magnet — the gate is the whole point —
 * even when the writer never set `lm_launch` (the 31 Jul ChatGPT checklist carousel is the
 * live case).
 */
function isLeadMagnetQ(q: Pick<QueueItem, 'lm_launch' | 'kind' | 'lm_gate'>): boolean {
  return !!q.lm_launch || q.kind === 'lm' || !!q.lm_gate;
}

/** A dated queue post, expressed as a CalendarItem so `onOpenCal` gets the exact shape
 *  ClientBoardPage's `openCalendarItem` already handles (ref → opens the real draft). */
function queueAsCalendarItem(q: QueueItem): CalendarItem {
  return {
    date: q.publish_date!,
    // Kind is left exactly as it was: it is the shape `openCalendarItem` consumes, and the
    // gate widening below is a COLOUR fact (`Mark.lm`), not a re-typing of the post.
    kind: q.lm_launch ? 'lm' : q.kind === 'carousel' ? 'carousel' : q.kind === 'lm' ? 'lm' : q.kind === 'newsletter' ? 'newsletter' : 'post',
    label: q.title || q.hook || 'Scheduled post',
    ref: q.id,
    stage: q.funnel_stage,
  };
}

const MOVE_FAILED = 'That move did not save. Open the post to set its time.';

export default function DeskCalendarStrip({ board, onOpenCal, scheduledIds, onMoveItem, queueFilter }: {
  board: Board;
  /** Opens the linked draft (or the planned-slot preview) — same callback CalendarSurface takes. */
  onOpenCal?: (item: CalendarItem) => void;
  /** Queue ids the client has already approved. Marks them solid; absent → no approved key. */
  scheduledIds?: Set<string>;
  /**
   * OPTIONAL reschedule write. When present, marks for posts that have not gone out become
   * draggable and every eligible day cell becomes a drop target. Absent → nothing is
   * draggable at all (preview boards stay read-only). Date is 'YYYY-MM-DD'.
   */
  onMoveItem?: (id: string, date: string) => Promise<{ ok: boolean; error?: string }>;
  /** Optional category filter (2026-08-07): when present, marks are limited to queue rows
   *  that pass it; unlinked calendar entries (no queue row to judge) stay visible. */
  queueFilter?: (q: QueueItem) => boolean;
}) {
  const todayIso = isoOf(new Date());
  const night = useNight();
  const quiet = useQuiet();
  const [hoverKey, setHoverKey] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [moveError, setMoveError] = React.useState<string | null>(null);
  const dragRef = React.useRef<{ id: string; from: string } | null>(null);

  // ---- Marks: committed calendar entries + every dated queue post (no double count). ----
  const calItemsAll = (board.calendar?.items || []).filter((it) => it.date && CONTENT_KINDS.has(it.kind));
  const calItems = queueFilter
    ? calItemsAll.filter((it) => {
        const linked = it.ref ? (board.queue || []).find((q) => q.id === it.ref) : undefined;
        return linked ? queueFilter(linked) : true;
      })
    : calItemsAll;
  const linkedRefs = new Set(calItemsAll.map((it) => it.ref).filter(Boolean) as string[]);
  const queueItems = (board.queue || []).filter((q) => q.publish_date && !linkedRefs.has(q.id) && (!queueFilter || queueFilter(q)));

  const allMarks: Mark[] = [
    ...calItems.map((it) => {
      const linked = it.ref ? (board.queue || []).find((q) => q.id === it.ref) : undefined;
      return {
        item: it,
        state: (linked?.stage === 'published' ? 'out' : 'ahead') as MarkState,
        approved: !!(it.ref && scheduledIds?.has(it.ref)),
        // A linked queue row is the truth about the gate; an unlinked calendar entry can
        // only speak through its own kind.
        lm: it.kind === 'lm' || (!!linked && isLeadMagnetQ(linked)),
      };
    }),
    ...queueItems.map((q) => ({
      item: queueAsCalendarItem(q),
      state: (q.stage === 'published' ? 'out' : 'ahead') as MarkState,
      approved: !!scheduledIds?.has(q.id),
      lm: isLeadMagnetQ(q),
    })),
  ].sort((a, b) => a.item.date.localeCompare(b.item.date));

  // ---- History floor (2026-08-26). Boards that import the client's LinkedIn archive
  // carry `published` marks dated years back (ARCH: May 2025). Spanning from the archive
  // minimum, with the 10-row cap below, rendered ONLY the archive and cropped the actual
  // plan clean off the grid ("Calendar · 26 May to 3 Aug" — of last year). This is a
  // month strip: anything dated more than 4 weeks before today belongs to the list views.
  // If every mark is older than the floor (stale demo board), fall back to the old span
  // rather than claiming "no dated slots".
  const floorIso = isoOf(mondayOf(new Date(Date.now() - 28 * DAY_MS)));
  const recentMarks = allMarks.filter((m) => m.item.date >= floorIso);
  const marks = recentMarks.length > 0 ? recentMarks : allMarks;

  if (marks.length === 0) {
    return (
      <div data-surface="calendar-strip" style={{ marginTop: 20 }}>
        <SectionRule label="Calendar" />
        <Footnote style={{ marginTop: 12 }}>Nothing on the calendar yet.</Footnote>
      </div>
    );
  }

  const byDay = new Map<string, Mark[]>();
  marks.forEach((m) => { byDay.set(m.item.date, [...(byDay.get(m.item.date) || []), m]); });

  // ---- Span: the Monday on or before the first dated day (or the engine start, whichever
  // is earlier), through the Sunday that closes the last dated day. Capped at 10 rows so a
  // single stray date can never turn the strip into a wall. ----
  const firstDated = marks[0].item.date;
  const lastDated = marks[marks.length - 1].item.date;
  // The engine start can pull the span back, but never past the history floor: a board
  // whose engine started months ago would otherwise regrow the same stale wall the floor
  // exists to prevent.
  const engineStart = board.calendar?.start;
  const spanFrom = engineStart && engineStart < firstDated && engineStart >= floorIso ? engineStart : firstDated;
  const spanStart = mondayOf(parseIso(spanFrom));
  // Math.round on the ms delta, never a raw divide: a DST boundary inside the span shifts
  // it by an hour and a bare ceil() would buy a whole empty row.
  const spanDays = Math.round((parseIso(lastDated).getTime() - spanStart.getTime()) / DAY_MS);
  const weeks = Math.max(1, Math.min(10, Math.floor(spanDays / 7) + 1));
  const days: Date[] = [];
  // Step by calendar DATE, never by 24h of milliseconds: local midnight + n * 24h lands on
  // 23:00 of the same day after a DST fall-back and printed that date twice ("24, 25, 25, 26"
  // in Europe, "31, 1 Nov, 1 Nov, 2" in LA), pushing every later post to the wrong weekday.
  for (let i = 0; i < weeks * 7; i++) days.push(new Date(spanStart.getFullYear(), spanStart.getMonth(), spanStart.getDate() + i));
  const gridEnd = days[days.length - 1];
  const gridEndIso = isoOf(gridEnd);
  const approvedShown = marks.some((m) => m.approved);

  // ---- Lead magnets get their own mark colour (Ivan, 08-02). Mint is the one palette var
  // this strip's post marks don't already spend (ink=out, accent=scheduled/approved), and it
  // is set on the board root for every skin. The solid-vs-washed state cue is kept, just in
  // the mint family; a squared corner (vs the post pill) backs the colour up at 390px, where
  // a bar is only a few px wide. Legend key renders ONLY when an LM actually lands inside
  // the drawn window (the 10-row cap can crop trailing dates). ----
  const isLm = (m: Mark) => m.lm;
  const lmShown = marks.some((m) => isLm(m) && m.item.date <= gridEndIso);

  const markFill = (m: Mark) => {
    if (quiet) {
      // Quiet: published recedes to grey, scheduled is an ink outline, approved solid ink,
      // a lead magnet is always its own solid colour (squared). No yellow: nothing here is a booked call.
      if (isLm(m)) return 'var(--cb-mint)';
      return m.state === 'out' ? 'rgba(17,17,17,0.16)' : m.approved ? '#111111' : '#FFFFFF';
    }
    if (night) {
      // Night: published recedes, scheduled glows in the accent, lead magnets keep mint.
      if (isLm(m)) return m.state === 'out' || m.approved ? 'var(--cb-mint)' : 'color-mix(in srgb, var(--cb-mint) 40%, #151515)';
      return m.state === 'out' ? 'rgb(var(--nt-fg, 255 255 255) / 0.24)' : m.approved ? 'var(--cb-accent)' : 'color-mix(in srgb, var(--cb-accent) 55%, #151515)';
    }
    if (isLm(m)) {
      return m.state === 'out' || m.approved
        ? 'var(--cb-mint)'
        : 'color-mix(in srgb, var(--cb-mint) 42%, var(--cb-paper))';
    }
    return m.state === 'out'
      ? 'var(--cb-ink)'
      : m.approved ? 'var(--cb-accent)' : 'color-mix(in srgb, var(--cb-accent) 42%, var(--cb-paper))';
  };

  // ---- Reschedule by drag (Ivan, 08-02). Only offered when the board handed us a writer.
  // A post that is already OUT never moves, and an entry with no queue ref has nothing to
  // move. Weekends accept drops only if this board actually dates content on weekends —
  // the grid's own data decides, no invented rule. Touch is deliberately NOT wired: the
  // existing tap-through to the card (onOpenCal) stays the phone path. ----
  const dragEnabled = !!onMoveItem;
  const weekendsUsed = marks.some((m) => isWeekendDate(parseIso(m.item.date)));
  const movableId = (m: Mark): string | null => (dragEnabled && m.state !== 'out' && m.item.ref ? m.item.ref : null);

  const runMove = async (id: string, date: string) => {
    if (!onMoveItem) return;
    setMoveError(null);
    setPendingId(id);
    try {
      const r = await onMoveItem(id, date);
      if (!r || !r.ok) setMoveError(MOVE_FAILED);
    } catch {
      setMoveError(MOVE_FAILED);
    } finally {
      setPendingId(null);
    }
  };

  const dropHandlers = (key: string, canDrop: boolean) => {
    if (!canDrop) return {};
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!dragRef.current) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (hoverKey !== key) setHoverKey(key);
      },
      onDragLeave: (e: React.DragEvent) => {
        // dragleave also fires when the pointer crosses into a child; ignore those.
        const to = e.relatedTarget as Node | null;
        if (to && e.currentTarget.contains(to)) return;
        setHoverKey((k) => (k === key ? null : k));
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        setHoverKey(null);
        const drag = dragRef.current;
        dragRef.current = null;
        // Only ever write from a drag THIS strip started; a stray payload never reaches the RPC.
        if (!drag) return;
        const id = e.dataTransfer.getData('text/plain') || drag.id;
        if (!id || drag.from === key) return;
        void runMove(id, key);
      },
    };
  };

  const legendKey = (fill: string, border: string | undefined, label: string) => (
    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span aria-hidden style={{ width: 15, height: 15, borderRadius: 5, background: fill, border }} />
      {label}
    </span>
  );

  return (
    <div data-surface="calendar-strip" style={{ marginTop: 20 }}>
      <style>{night ? CAL_CSS + CAL_NIGHT_CSS + (quiet ? CAL_QUIET_CSS : '') : CAL_CSS}</style>
      {night ? (
        <div className="cb-cal-head">{shortDate(spanStart)} to {shortDate(gridEnd)} <span>{marks.length}</span></div>
      ) : (
      <SectionRule
        label={`Calendar · ${shortDate(spanStart)} to ${shortDate(gridEnd)}`}
        count={marks.length}
        blurb={marks.length === 1 ? 'post on the calendar' : 'posts on the calendar'}
      />
      )}

      <div className="cb-calstrip-wrap" style={{ marginTop: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--cb-ink-mute)', textAlign: 'center' }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
        </div>

        <div data-viz="" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginTop: 6 }}>
          {days.map((d) => {
            const key = isoOf(d);
            const dayMarks = byDay.get(key) || [];
            const isToday = key === todayIso;
            const clickable = dayMarks.length > 0 && !!onOpenCal;
            const canDrop = dragEnabled && (!isWeekendDate(d) || weekendsUsed);
            const isDropHover = hoverKey === key;
            const cell: React.CSSProperties = {
              position: 'relative',
              height: 58,
              padding: 0,
              borderRadius: 10,
              border: isToday ? '2px solid var(--cb-ink)' : '1px solid var(--cb-line)',
              background: dayMarks.length ? 'var(--cb-paper)' : 'var(--cb-paper-sunk)',
              textAlign: 'left',
              font: 'inherit',
              cursor: clickable ? 'pointer' : 'default',
              width: '100%',
              display: 'block',
              // Outline, not border/box-size: a drop cue must not reflow the grid.
              outline: isDropHover ? '2px solid var(--cb-accent)' : undefined,
              outlineOffset: isDropHover ? 1 : undefined,
            };
            const lead = dayMarks[0];
            const extra = dayMarks.length - 1;
            const leadQ = lead?.item.ref ? (board.queue || []).find((q) => q.id === lead.item.ref) : undefined;
            const cover = leadQ ? (leadQ.media_url || (leadQ.image_urls || []).find(Boolean) || leadQ.image || leadQ.cover_url || undefined) : undefined;
            const fullTitle = dayMarks.map((m) => m.item.label).join(' · ');
            const inner = (
              <>
                <span className={night ? 'cb-cal-daynum' : undefined} style={{ position: 'absolute', top: 5, left: 7, fontSize: 12, fontWeight: 800, color: dayMarks.length ? 'var(--cb-ink)' : 'var(--cb-ink-mute)', pointerEvents: 'none' }}>{d.getDate()}</span>
                {extra > 0 && (
                  <span className="cb-calstrip-more" style={{ position: 'absolute', top: 5, right: 7, pointerEvents: 'none' }}>{`+${extra}`}</span>
                )}
                {cover && <img className="cb-calstrip-thumb" src={cover} alt="" loading="lazy" onLoad={night ? (e) => { e.currentTarget.setAttribute('data-ok', ''); } : undefined} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
                {lead && (
                  /* Night v3: a post is called by its own first line (hook), falling back to the title. */
                  <span className={cover ? 'cb-calstrip-title has-thumb' : 'cb-calstrip-title'} title={lead.item.label}>{night && leadQ?.hook ? leadQ.hook : lead.item.label}</span>
                )}
                {dayMarks.length > 0 && (
                  <span style={{ position: 'absolute', left: 6, right: 6, bottom: 6, display: 'flex', gap: 3 }}>
                    {dayMarks.slice(0, 3).map((m, i) => {
                      const mid = movableId(m);
                      const pending = !!mid && pendingId === mid;
                      return (
                        <span
                          key={i}
                          className={isLm(m) ? 'bar bar-lm' : 'bar'}
                          // Omitted entirely (not `false`) when there is no writer, so a
                          // read-only board carries no drag affordance at all.
                          draggable={mid && !pending ? true : undefined}
                          title={mid ? m.item.label : undefined}
                          onDragStart={mid && !pending ? (e: React.DragEvent) => {
                            dragRef.current = { id: mid, from: key };
                            e.dataTransfer.effectAllowed = 'move';
                            e.dataTransfer.setData('text/plain', mid);
                            setMoveError(null);
                          } : undefined}
                          onDragEnd={mid ? () => { dragRef.current = null; setHoverKey(null); } : undefined}
                          style={{
                            flex: '1 1 0', minWidth: 0, height: dragEnabled ? 9 : 7, borderRadius: isLm(m) ? 2 : 999,
                            background: markFill(m),
                            border: m.state === 'ahead' && !m.approved
                              ? (quiet ? (isLm(m) ? undefined : '1.5px solid #111111') : `1px solid ${isLm(m) ? 'var(--cb-mint)' : 'var(--cb-accent)'}`)
                              : undefined,
                            cursor: mid && !pending ? 'grab' : undefined,
                            opacity: pending ? 0.45 : undefined,
                            pointerEvents: pending ? 'none' : undefined,
                          }}
                        />
                      );
                    })}
                  </span>
                )}
              </>
            );
            const nightCls = night ? ` cb-cal-n${dayMarks.length ? ' has' : ''}${isToday ? ' today' : ''}${isWeekendDate(d) ? ' wknd' : ''}` : '';
            const shared = { className: `cb-calstrip-cell${nightCls}`, title: fullTitle || undefined, style: cell, ...dropHandlers(key, canDrop) };
            const open = () => onOpenCal!(dayMarks[0].item);
            if (!clickable) return <div key={key} {...shared}>{inner}</div>;
            // Read-only boards keep the native <button>. Drag-enabled boards do NOT: a
            // draggable child of a <button> does not start a drag in every engine (the form
            // control swallows the mousedown), which would make the whole feature silently
            // dead outside Chromium. role=button + Enter/Space keeps click and keyboard identical.
            return dragEnabled ? (
              <div
                key={key}
                {...shared}
                role="button"
                tabIndex={0}
                aria-label={`${shortDate(d)}: ${fullTitle}`}
                onClick={open}
                onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
              >{inner}</div>
            ) : (
              <button key={key} type="button" {...shared} aria-label={`${shortDate(d)}: ${fullTitle}`} onClick={open}>{inner}</button>
            );
          })}
        </div>

        {quiet ? (
          /* Quiet: the same keys in the light strip's own fills. */
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: 'rgba(17,17,17,0.66)' }}>
            {legendKey('rgba(17,17,17,0.16)', undefined, 'Published')}
            {legendKey('#FFFFFF', '1.5px solid #111111', 'Scheduled')}
            {approvedShown && legendKey('#111111', undefined, 'Approved')}
            {lmShown && legendKey('var(--cb-mint)', undefined, 'Lead magnets')}
            {legendKey('#FFFFFF', '2px solid var(--cb-accent)', 'Today')}
          </div>
        ) : night ? (
          /* Night: v2's legend look (accent scheduled, lit today), v3's words. */
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: 'rgb(var(--nt-fg, 255 255 255) / 0.66)' }}>
            {legendKey('rgb(var(--nt-fg, 255 255 255) / 0.24)', undefined, 'Published')}
            {legendKey('color-mix(in srgb, var(--cb-accent) 55%, #151515)', '1px solid var(--cb-accent)', 'Scheduled')}
            {approvedShown && legendKey('var(--cb-accent)', undefined, 'Approved')}
            {lmShown && legendKey('var(--cb-mint)', undefined, 'Lead magnets')}
            {legendKey('color-mix(in srgb, var(--pk-acc, #FFC71D) 10%, transparent)', '1.5px solid var(--cb-accent)', 'Today')}
          </div>
        ) : (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>
          {legendKey('var(--cb-ink)', undefined, 'published')}
          {legendKey('color-mix(in srgb, var(--cb-accent) 42%, var(--cb-paper))', '1px solid var(--cb-accent)', 'scheduled')}
          {approvedShown && legendKey('var(--cb-accent)', undefined, 'approved')}
          {lmShown && legendKey('var(--cb-mint)', undefined, 'lead magnets')}
          {legendKey('var(--cb-paper-sunk)', '2px solid var(--cb-ink)', 'today')}
        </div>
        )}

        {/* Night: no helper line; the marks still drag. */}
        {dragEnabled && !night && <Footnote>Drag a post to another day to move it.</Footnote>}
        {moveError && <Footnote style={{ color: 'var(--cb-ink)' }}>{moveError}</Footnote>}
      </div>
    </div>
  );
}
