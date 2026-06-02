import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { CarouselDraft } from '../../hooks/useContentLibrary';
import { useDashboard } from '../../contexts/DashboardContext';
import { statusLabel } from '../../lib/statusLabels';

/**
 * Month-grid calendar view for the Posts surface. Reads carousel_drafts.scheduled_at
 * (not scheduled_posts) — the same data the board view paints — so a drag here
 * updates the same column the rest of the panel listens to. Replaces the
 * legacy ContentPanel kanban+calendar tab that ran against scheduled_posts.
 *
 * Design notes:
 *  - 7 cols × 6 rows = 42 cells; weeks start Monday.
 *  - Each cell shows up to 3 chips + "+N more" overflow.
 *  - Drag a chip to a different day → onReschedule(id, isoDate). Time-of-day is
 *    preserved by the caller (PostStudioPanel.onDateChange) — we send the
 *    yyyy-mm-dd part only.
 *  - Click a chip → onOpenDraft(id) opens the editor sheet.
 *  - Reads user timezone from DashboardContext so the day boundaries match
 *    the rest of the dashboard (avoids off-by-one for users east of UTC).
 */

interface Props {
  drafts: CarouselDraft[];
  onOpenDraft: (id: string) => void;
  onReschedule: (id: string, isoDate: string | null) => void | Promise<void>;
}

const STATUS_COLOR: Record<string, string> = {
  idea:         'bg-zinc-500/15 ring-zinc-500/30 text-zinc-300',
  generating:   'bg-sky-500/15 ring-sky-500/30 text-sky-200',
  review:       'bg-amber-500/15 ring-amber-500/30 text-amber-200',
  approved:     'bg-emerald-500/15 ring-emerald-500/30 text-emerald-200',
  scheduled:    'bg-emerald-500/20 ring-emerald-500/40 text-emerald-200',
  published:    'bg-emerald-500/30 ring-emerald-500/50 text-emerald-100',
  disqualified: 'bg-zinc-500/10 ring-zinc-500/20 text-zinc-500 opacity-60',
  error:        'bg-red-500/15 ring-red-500/30 text-red-200',
};

function localDateKey(d: Date, timezone?: string): string {
  if (timezone) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    });
    return fmt.format(d);
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthDays(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const days: { date: Date; inMonth: boolean }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), inMonth: false });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), inMonth: true });
  }
  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1);
    days.push({ date: d, inMonth: false });
  }
  return days;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function DraftChip({ draft, onOpen }: { draft: CarouselDraft; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: draft.id });
  const tone = STATUS_COLOR[draft.status] || STATUS_COLOR.idea;
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        // Prevent click firing immediately after a drop
        if (isDragging) { e.preventDefault(); return; }
        onOpen();
      }}
      className={`w-full text-left truncate rounded-sm ring-1 ring-inset px-1.5 py-0.5 text-[10.5px] font-medium ${tone} ${isDragging ? 'opacity-40' : 'hover:brightness-110'}`}
      title={`${statusLabel(draft.status)} — ${draft.title}`}
    >
      {draft.title || '(untitled)'}
    </button>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  dayKey,
  posts,
  onOpenDraft,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  dayKey: string;
  posts: CarouselDraft[];
  onOpenDraft: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayKey}` });
  const visible = posts.slice(0, 3);
  const overflow = posts.length - visible.length;
  return (
    <div
      ref={setNodeRef}
      className={`relative min-h-[88px] border border-zinc-800/60 p-1.5 flex flex-col gap-1 transition-colors ${
        inMonth ? 'bg-zinc-950/40' : 'bg-zinc-950/10 opacity-60'
      } ${isOver ? 'ring-1 ring-inset ring-emerald-400/60 bg-emerald-950/20' : ''}`}
    >
      <div className="flex items-center justify-between text-[10.5px]">
        <span className={`tabular-nums ${isToday ? 'text-emerald-300 font-semibold' : inMonth ? 'text-zinc-400' : 'text-zinc-600'}`}>
          {date.getDate()}
        </span>
        {isToday && <span className="text-[9px] uppercase tracking-wider text-emerald-400/70">today</span>}
      </div>
      <div className="flex flex-col gap-0.5">
        {visible.map((d) => (
          <DraftChip key={d.id} draft={d} onOpen={() => onOpenDraft(d.id)} />
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-zinc-500 pl-1">+{overflow} more</span>
        )}
      </div>
    </div>
  );
}

export default function PostCalendarView({ drafts, onOpenDraft, onReschedule }: Props) {
  const { userTimezone } = useDashboard();
  const [cursor, setCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const todayKey = useMemo(() => localDateKey(new Date(), userTimezone), [userTimezone]);

  // Bucket drafts by their scheduled local date key. Drafts without
  // scheduledAt aren't displayed in the calendar.
  const buckets = useMemo(() => {
    const map = new Map<string, CarouselDraft[]>();
    for (const d of drafts) {
      if (!d.scheduledAt) continue;
      const key = localDateKey(new Date(d.scheduledAt), userTimezone);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    // Sort each day's posts by scheduledAt ascending
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));
    }
    return map;
  }, [drafts, userTimezone]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const draftId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : '';
    if (!overId.startsWith('day-')) return;
    const targetKey = overId.slice(4); // strip "day-"
    onReschedule(draftId, targetKey);
  };

  const monthlyCount = useMemo(
    () => days.filter((d) => d.inMonth).reduce((sum, d) => sum + (buckets.get(localDateKey(d.date, userTimezone))?.length || 0), 0),
    [days, buckets, userTimezone],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarDays className="w-4 h-4 text-zinc-500" />
        <h2 className="text-[15px] font-semibold text-zinc-100">
          {MONTH_NAMES[month]} <span className="text-zinc-500 font-normal tabular-nums">{year}</span>
        </h2>
        <span className="text-[11.5px] text-zinc-500">{monthlyCount} scheduled this month</span>
        <div className="ml-auto inline-flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-1.5 rounded hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-100"
            title="Previous month"
            aria-label="Previous month"
          ><ChevronLeft className="w-4 h-4" /></button>
          <button
            onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }}
            className="px-2 py-1 text-[11.5px] rounded hover:bg-zinc-800/60 text-zinc-300"
          >Today</button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-1.5 rounded hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-100"
            title="Next month"
            aria-label="Next month"
          ><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="rounded-md border border-zinc-800/80 overflow-hidden">
          {/* Weekday header */}
          <div className="grid grid-cols-7 bg-zinc-900/60 border-b border-zinc-800/80">
            {DAY_LABELS.map((d) => (
              <div key={d} className="px-2 py-1.5 text-[10.5px] uppercase tracking-wider text-zinc-500 font-medium border-r border-zinc-800/60 last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          {/* Day grid */}
          <div className="grid grid-cols-7">
            {days.map(({ date, inMonth }) => {
              const dayKey = localDateKey(date, userTimezone);
              const posts = buckets.get(dayKey) || [];
              return (
                <DayCell
                  key={dayKey + (inMonth ? '' : '-out')}
                  date={date}
                  inMonth={inMonth}
                  isToday={dayKey === todayKey}
                  dayKey={dayKey}
                  posts={posts}
                  onOpenDraft={onOpenDraft}
                />
              );
            })}
          </div>
        </div>
      </DndContext>

      <p className="text-[11px] text-zinc-600">
        Drag a post to a different day to reschedule. Time-of-day is preserved (defaults to 09:00 for posts not previously scheduled).
      </p>
    </div>
  );
}
