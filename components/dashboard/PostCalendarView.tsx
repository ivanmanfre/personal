import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Magnet, FileText } from 'lucide-react';
import {
  DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDashboard } from '../../contexts/DashboardContext';

/**
 * Generic month-grid calendar. Originally posts-only (carousel_drafts.scheduled_at);
 * now accepts any item with {id, title, status, scheduledAt, kind, tone} so the
 * unified Calendar section can render BOTH posts and lead magnets on the same
 * grid. Kind drives an inline glyph (Magnet for LM); tone drives the chip color.
 *
 * Design notes:
 *  - 7 cols × 6 rows = 42 cells; weeks start Monday.
 *  - Each cell shows up to 3 chips + "+N more" overflow.
 *  - Drag a chip to a different day → onReschedule(id, isoDate). Time-of-day is
 *    preserved by the caller. We send the yyyy-mm-dd part only.
 *  - Click a chip → onOpenItem(item) opens the editor sheet for that kind.
 *  - Reads user timezone from DashboardContext so day boundaries match the rest
 *    of the dashboard (avoids off-by-one for users east of UTC).
 */

export type CalendarItemKind = 'post' | 'lm';
export type CalendarTone = 'idea' | 'generating' | 'review' | 'approved' | 'scheduled' | 'published' | 'disqualified' | 'error' | 'failed' | 'cancelled';

export interface CalendarItem {
  id: string;
  title: string;
  kind: CalendarItemKind;
  scheduledAt: string | null;
  tone: CalendarTone;
  // Display-only status label (overrides built-in label for that tone if set)
  statusLabel?: string;
}

interface Props {
  items: CalendarItem[];
  onOpenItem: (item: CalendarItem) => void;
  /** Reschedule callback. Receives item + yyyy-mm-dd target. If draggable=false,
   *  this is never called and chips render as buttons-only. */
  onReschedule?: (item: CalendarItem, isoDate: string) => void | Promise<void>;
  draggable?: boolean;
}

// Tone → chip color. Sage for scheduled/approved/published, amber for review/failed,
// sky for generating, red for error, muted for idea/cancelled/disqualified.
const TONE_COLOR: Record<CalendarTone, string> = {
  idea:         'bg-zinc-500/15 ring-zinc-500/30 text-zinc-300',
  generating:   'bg-sky-500/15 ring-sky-500/30 text-sky-200',
  review:       'bg-amber-500/15 ring-amber-500/30 text-amber-200',
  approved:     'bg-emerald-500/15 ring-emerald-500/30 text-emerald-200',
  scheduled:    'bg-emerald-500/20 ring-emerald-500/40 text-emerald-200',
  published:    'bg-emerald-500/30 ring-emerald-500/50 text-emerald-100',
  disqualified: 'bg-zinc-500/10 ring-zinc-500/20 text-zinc-500 opacity-60',
  error:        'bg-red-500/15 ring-red-500/30 text-red-200',
  failed:       'bg-red-500/15 ring-red-500/30 text-red-200',
  cancelled:    'bg-zinc-500/10 ring-zinc-500/20 text-zinc-500 opacity-60',
};

const TONE_LABEL: Record<CalendarTone, string> = {
  idea: 'Idea', generating: 'Generating', review: 'Review', approved: 'Approved',
  scheduled: 'Scheduled', published: 'Published', disqualified: 'Disqualified',
  error: 'Error', failed: 'Failed', cancelled: 'Cancelled',
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

function ItemChip({ item, onOpen, draggable }: { item: CalendarItem; onOpen: () => void; draggable: boolean }) {
  // Stable draggable id: combine kind + id so a post + an LM with the same UUID
  // (extremely unlikely but theoretically possible across tables) can't collide.
  const draggableId = `${item.kind}:${item.id}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: draggableId, disabled: !draggable });
  const tone = TONE_COLOR[item.tone] || TONE_COLOR.idea;
  const Glyph = item.kind === 'lm' ? Magnet : FileText;
  return (
    <button
      ref={setNodeRef}
      {...(draggable ? attributes : {})}
      {...(draggable ? listeners : {})}
      onClick={(e) => {
        if (isDragging) { e.preventDefault(); return; }
        onOpen();
      }}
      className={`w-full text-left truncate rounded-sm ring-1 ring-inset px-1.5 py-0.5 text-[10.5px] font-medium inline-flex items-center gap-1 ${tone} ${isDragging ? 'opacity-40' : 'hover:brightness-110'}`}
      title={`${item.statusLabel || TONE_LABEL[item.tone] || item.tone} — ${item.title}`}
    >
      <Glyph className="w-2.5 h-2.5 shrink-0 opacity-70" />
      <span className="truncate">{item.title || '(untitled)'}</span>
    </button>
  );
}

function DayCell({
  date, inMonth, isToday, dayKey, items, onOpenItem, draggable,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  dayKey: string;
  items: CalendarItem[];
  onOpenItem: (item: CalendarItem) => void;
  draggable: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day-${dayKey}`, disabled: !draggable });
  const visible = items.slice(0, 4);
  const overflow = items.length - visible.length;
  return (
    <div
      ref={setNodeRef}
      className={`relative min-h-[96px] border border-zinc-800/60 p-1.5 flex flex-col gap-1 transition-colors ${
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
        {visible.map((it) => (
          <ItemChip key={`${it.kind}:${it.id}`} item={it} onOpen={() => onOpenItem(it)} draggable={draggable} />
        ))}
        {overflow > 0 && (
          <span className="text-[10px] text-zinc-500 pl-1">+{overflow} more</span>
        )}
      </div>
    </div>
  );
}

export default function PostCalendarView({ items, onOpenItem, onReschedule, draggable = true }: Props) {
  const { userTimezone } = useDashboard();
  const [cursor, setCursor] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const days = useMemo(() => getMonthDays(year, month), [year, month]);
  const todayKey = useMemo(() => localDateKey(new Date(), userTimezone), [userTimezone]);

  // Bucket items by their scheduled local date key. Items without scheduledAt
  // aren't displayed in the calendar.
  const buckets = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      if (!it.scheduledAt) continue;
      const key = localDateKey(new Date(it.scheduledAt), userTimezone);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    // Sort each day's items by scheduledAt ascending — earliest time first
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));
    }
    return map;
  }, [items, userTimezone]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = (e: DragEndEvent) => {
    if (!onReschedule) return;
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : '';
    if (!overId.startsWith('day-')) return;
    const targetKey = overId.slice(4);
    // Active id is kind:id — find the item
    const [kind, id] = activeId.split(':');
    const item = items.find((it) => it.kind === kind && it.id === id);
    if (!item) return;
    onReschedule(item, targetKey);
  };

  const monthlyCount = useMemo(
    () => days.filter((d) => d.inMonth).reduce((sum, d) => sum + (buckets.get(localDateKey(d.date, userTimezone))?.length || 0), 0),
    [days, buckets, userTimezone],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays className="w-4 h-4 text-zinc-500" />
        <h2 className="dv-section-h">
          {MONTH_NAMES[month]} <span className="dv-editorial-num text-[length:var(--t-lg)]">{year}</span>
        </h2>
        <span className="text-[length:var(--t-sm)] text-[color:var(--d-paper-dimmer)]">
          {monthlyCount} scheduled this month
        </span>
        {/* Legend */}
        <span className="hidden md:inline-flex items-center gap-3 text-[10.5px] text-zinc-500 ml-3">
          <span className="inline-flex items-center gap-1"><FileText className="w-2.5 h-2.5" /> Post</span>
          <span className="inline-flex items-center gap-1"><Magnet className="w-2.5 h-2.5" /> Lead magnet</span>
        </span>
        <div className="ml-auto inline-flex items-center gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-1.5 rounded hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-100"
            title="Previous month" aria-label="Previous month"
          ><ChevronLeft className="w-4 h-4" /></button>
          <button
            onClick={() => { const n = new Date(); setCursor(new Date(n.getFullYear(), n.getMonth(), 1)); }}
            className="px-2 py-1 text-[11.5px] rounded hover:bg-zinc-800/60 text-zinc-300"
          >Today</button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-1.5 rounded hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-100"
            title="Next month" aria-label="Next month"
          ><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="rounded-md border border-zinc-800/80 overflow-hidden">
          <div className="grid grid-cols-7 bg-zinc-900/60 border-b border-zinc-800/80">
            {DAY_LABELS.map((d) => (
              <div key={d} className="px-2 py-1.5 text-[10.5px] uppercase tracking-wider text-zinc-500 font-medium border-r border-zinc-800/60 last:border-r-0">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map(({ date, inMonth }) => {
              const dayKey = localDateKey(date, userTimezone);
              const cellItems = buckets.get(dayKey) || [];
              return (
                <DayCell
                  key={dayKey + (inMonth ? '' : '-out')}
                  date={date}
                  inMonth={inMonth}
                  isToday={dayKey === todayKey}
                  dayKey={dayKey}
                  items={cellItems}
                  onOpenItem={onOpenItem}
                  draggable={draggable}
                />
              );
            })}
          </div>
        </div>
      </DndContext>

      {draggable && (
        <p className="text-[11px] text-zinc-600">
          Drag an item to a different day to reschedule. Time-of-day is preserved.
        </p>
      )}
    </div>
  );
}
