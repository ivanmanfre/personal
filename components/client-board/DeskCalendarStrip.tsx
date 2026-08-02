import React from 'react';
import type { Board, CalendarItem, QueueItem } from '../ClientBoardPage';
import { SectionRule, Footnote } from './desk-kit';

/**
 * DeskCalendarStrip — the compact month strip that replaces `CalendarSurface` inside the
 * desk skin's "All content" Calendar view.
 *
 * Presentation-only, matched to the approved static reference
 * (`phase3-panels/frag-review.html` → `<div data-view="cal">`): a section rule
 * ("Calendar · <range>" + a real `dated slots` metric), a 7-column month grid whose cells
 * carry a date numeral and a MARK per dated item, and a three/four-key legend.
 *
 * Deliberate deviations from the frag, both to hold the density budget:
 *  - cells are marks, not image tiles (the frag's square covers cost ~3× the height, and
 *    the tab already carries the same thumbnails in its list rows), and
 *  - the frag's trailing dated mini-list is NOT reproduced here — it duplicated the list
 *    view row-for-row (critic BLOCKER-4).
 *
 * Zero prose sentences, zero `<p>`, no hardcoded hex. Nothing is wired here: the
 * integrator swaps this in for `foldCalendar`.
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

type MarkState = 'out' | 'ahead';
type Mark = { item: CalendarItem; state: MarkState; approved: boolean };

/** A dated queue post, expressed as a CalendarItem so `onOpenCal` gets the exact shape
 *  ClientBoardPage's `openCalendarItem` already handles (ref → opens the real draft). */
function queueAsCalendarItem(q: QueueItem): CalendarItem {
  return {
    date: q.publish_date!,
    kind: q.lm_launch ? 'lm' : q.kind === 'carousel' ? 'carousel' : q.kind === 'lm' ? 'lm' : q.kind === 'newsletter' ? 'newsletter' : 'post',
    label: q.title || q.hook || 'Scheduled post',
    ref: q.id,
    stage: q.funnel_stage,
  };
}

export default function DeskCalendarStrip({ board, onOpenCal, scheduledIds }: {
  board: Board;
  /** Opens the linked draft (or the planned-slot preview) — same callback CalendarSurface takes. */
  onOpenCal?: (item: CalendarItem) => void;
  /** Queue ids the client has already approved. Marks them solid; absent → no approved key. */
  scheduledIds?: Set<string>;
}) {
  const todayIso = isoOf(new Date());

  // ---- Marks: committed calendar entries + every dated queue post (no double count). ----
  const calItems = (board.calendar?.items || []).filter((it) => it.date && CONTENT_KINDS.has(it.kind));
  const linkedRefs = new Set(calItems.map((it) => it.ref).filter(Boolean) as string[]);
  const queueItems = (board.queue || []).filter((q) => q.publish_date && !linkedRefs.has(q.id));

  const marks: Mark[] = [
    ...calItems.map((it) => {
      const linked = it.ref ? (board.queue || []).find((q) => q.id === it.ref) : undefined;
      return {
        item: it,
        state: (linked?.stage === 'published' ? 'out' : 'ahead') as MarkState,
        approved: !!(it.ref && scheduledIds?.has(it.ref)),
      };
    }),
    ...queueItems.map((q) => ({
      item: queueAsCalendarItem(q),
      state: (q.stage === 'published' ? 'out' : 'ahead') as MarkState,
      approved: !!scheduledIds?.has(q.id),
    })),
  ].sort((a, b) => a.item.date.localeCompare(b.item.date));

  if (marks.length === 0) {
    return (
      <div data-surface="calendar-strip" style={{ marginTop: 20 }}>
        <SectionRule label="Calendar" />
        <Footnote style={{ marginTop: 12 }}>No dated slots yet.</Footnote>
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
  const engineStart = board.calendar?.start;
  const spanStart = mondayOf(parseIso(engineStart && engineStart < firstDated ? engineStart : firstDated));
  // Math.round on the ms delta, never a raw divide: a DST boundary inside the span shifts
  // it by an hour and a bare ceil() would buy a whole empty row.
  const spanDays = Math.round((parseIso(lastDated).getTime() - spanStart.getTime()) / DAY_MS);
  const weeks = Math.max(1, Math.min(10, Math.floor(spanDays / 7) + 1));
  const days: Date[] = [];
  for (let i = 0; i < weeks * 7; i++) days.push(new Date(spanStart.getTime() + i * DAY_MS));
  const gridEnd = days[days.length - 1];
  const gridEndIso = isoOf(gridEnd);
  const approvedShown = marks.some((m) => m.approved);

  // ---- Lead magnets get their own mark colour (Ivan, 08-02). Mint is the one palette var
  // this strip's post marks don't already spend (ink=out, accent=scheduled/approved), and it
  // is set on the board root for every skin. The solid-vs-washed state cue is kept, just in
  // the mint family; a squared corner (vs the post pill) backs the colour up at 390px, where
  // a bar is only a few px wide. Legend key renders ONLY when an LM actually lands inside
  // the drawn window (the 10-row cap can crop trailing dates). ----
  const isLm = (m: Mark) => m.item.kind === 'lm';
  const lmShown = marks.some((m) => isLm(m) && m.item.date <= gridEndIso);

  const markFill = (m: Mark) => {
    if (isLm(m)) {
      return m.state === 'out' || m.approved
        ? 'var(--cb-mint)'
        : 'color-mix(in srgb, var(--cb-mint) 42%, var(--cb-paper))';
    }
    return m.state === 'out'
      ? 'var(--cb-ink)'
      : m.approved ? 'var(--cb-accent)' : 'color-mix(in srgb, var(--cb-accent) 42%, var(--cb-paper))';
  };

  const legendKey = (fill: string, border: string | undefined, label: string) => (
    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <span aria-hidden style={{ width: 15, height: 15, borderRadius: 5, background: fill, border }} />
      {label}
    </span>
  );

  return (
    <div data-surface="calendar-strip" style={{ marginTop: 20 }}>
      <SectionRule
        label={`Calendar · ${shortDate(spanStart)} to ${shortDate(gridEnd)}`}
        count={marks.length}
        blurb={marks.length === 1 ? 'dated slot' : 'dated slots'}
      />

      <div style={{ maxWidth: 660, marginTop: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', color: 'var(--cb-ink-mute)', textAlign: 'center' }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
        </div>

        <div data-viz="" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginTop: 6 }}>
          {days.map((d) => {
            const key = isoOf(d);
            const dayMarks = byDay.get(key) || [];
            const isToday = key === todayIso;
            const clickable = dayMarks.length > 0 && !!onOpenCal;
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
            };
            const inner = (
              <>
                <span style={{ position: 'absolute', top: 5, left: 7, fontSize: 12, fontWeight: 800, color: dayMarks.length ? 'var(--cb-ink)' : 'var(--cb-ink-mute)' }}>{d.getDate()}</span>
                {dayMarks.length > 0 && (
                  <span style={{ position: 'absolute', left: 6, right: 6, bottom: 6, display: 'flex', gap: 3 }}>
                    {dayMarks.slice(0, 3).map((m, i) => (
                      <span
                        key={i}
                        className={isLm(m) ? 'bar bar-lm' : 'bar'}
                        style={{
                          flex: '1 1 0', minWidth: 0, height: 7, borderRadius: isLm(m) ? 2 : 999,
                          background: markFill(m),
                          border: m.state === 'ahead' && !m.approved
                            ? `1px solid ${isLm(m) ? 'var(--cb-mint)' : 'var(--cb-accent)'}`
                            : undefined,
                        }}
                      />
                    ))}
                  </span>
                )}
              </>
            );
            const title = dayMarks.map((m) => m.item.label).join(' · ');
            return clickable ? (
              <button key={key} type="button" title={title} aria-label={`${shortDate(d)}: ${title}`} onClick={() => onOpenCal!(dayMarks[0].item)} style={cell}>{inner}</button>
            ) : (
              <div key={key} title={title || undefined} style={cell}>{inner}</div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, alignItems: 'center', fontSize: 12.5, fontWeight: 700, color: 'var(--cb-ink-mute)' }}>
          {legendKey('var(--cb-ink)', undefined, 'out')}
          {legendKey('color-mix(in srgb, var(--cb-accent) 42%, var(--cb-paper))', '1px solid var(--cb-accent)', 'scheduled')}
          {approvedShown && legendKey('var(--cb-accent)', undefined, 'approved')}
          {legendKey('var(--cb-paper-sunk)', '2px solid var(--cb-ink)', 'today')}
        </div>
      </div>
    </div>
  );
}
