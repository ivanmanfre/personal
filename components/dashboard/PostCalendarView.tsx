import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Magnet, FileText, Clock } from 'lucide-react';
import {
  DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';

/**
 * Generic month-grid calendar. Originally posts-only (carousel_drafts.scheduled_at);
 * now accepts any item with {id, title, status, scheduledAt, kind, tone} so the
 * unified Calendar section can render BOTH posts and lead magnets on the same
 * grid. Kind drives the glyph + color family (posts = emerald, LMs = violet);
 * tone drives the chip intensity/status.
 *
 * Design notes:
 *  - 7 cols × 6 rows = 42 cells; weeks start Monday.
 *  - Each cell shows up to 4 chips + "+N more" overflow. Each chip shows the
 *    scheduled time + title.
 *  - Drag a chip to a different day → onReschedule(id, isoDate). Time-of-day is
 *    preserved by the caller. We send the yyyy-mm-dd part only.
 *  - Click a chip → onOpenItem(item) opens the editor sheet for that kind.
 *
 * Timezone:
 *  - Everything the operator SEES — chip times, day buckets, the "today"
 *    highlight, and the initial month — is resolved in the operator's BROWSER
 *    LOCAL timezone, so the calendar reads in the operator's own time wherever
 *    they are. (Posts are still SCHEDULED relative to Buenos Aires audience
 *    windows in findNextSlot; this component is purely the local-time view of
 *    those instants.)
 *  - The grid itself is built from pure calendar integers (no Date/tz roundtrip)
 *    and day-keys / buckets / today are all derived with the SAME local basis,
 *    so the displayed number and the day it buckets to can never diverge.
 */

export type CalendarItemKind = 'post' | 'lm' | 'post-queue';
export type CalendarTone = 'idea' | 'generating' | 'review' | 'approved' | 'scheduled' | 'published' | 'disqualified' | 'error' | 'failed' | 'cancelled';

export interface CalendarItem {
  id: string;
  title: string;
  kind: CalendarItemKind;
  scheduledAt: string | null;
  tone: CalendarTone;
  // Display-only status label (overrides built-in label for that tone if set)
  statusLabel?: string;
  // For lm chips: the lm_drafts_v2 id used to open the LM editor (the chip's
  // `id` is the scheduled_posts row id, used for drag/reschedule).
  editId?: string;
}

interface Props {
  items: CalendarItem[];
  onOpenItem: (item: CalendarItem) => void;
  /** Reschedule callback. Receives item + yyyy-mm-dd target. If draggable=false,
   *  this is never called and chips render as buttons-only. */
  onReschedule?: (item: CalendarItem, isoDate: string) => void | Promise<void>;
  draggable?: boolean;
}

// Posts → emerald family. Tone drives intensity; amber for review, sky for
// generating, red for error, muted for idea/cancelled/disqualified.
const TONE_COLOR_POST: Record<CalendarTone, string> = {
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

// Lead magnets → violet family so they read as a different color than posts at a
// glance. Tone still drives intensity; errors stay red (errors should always
// read as red regardless of kind).
const TONE_COLOR_LM: Record<CalendarTone, string> = {
  idea:         'bg-violet-500/12 ring-violet-500/25 text-violet-300',
  generating:   'bg-violet-500/18 ring-violet-500/35 text-violet-200',
  review:       'bg-violet-500/20 ring-violet-500/40 text-violet-100',
  approved:     'bg-violet-500/22 ring-violet-500/42 text-violet-100',
  scheduled:    'bg-violet-500/28 ring-violet-500/48 text-violet-100',
  published:    'bg-violet-500/38 ring-violet-500/55 text-violet-50',
  disqualified: 'bg-violet-500/10 ring-violet-500/20 text-violet-400 opacity-60',
  error:        'bg-red-500/15 ring-red-500/30 text-red-200',
  failed:       'bg-red-500/15 ring-red-500/30 text-red-200',
  cancelled:    'bg-violet-500/10 ring-violet-500/20 text-violet-400 opacity-60',
};

const TONE_LABEL: Record<CalendarTone, string> = {
  idea: 'Idea', generating: 'Generating', review: 'Review', approved: 'Approved',
  scheduled: 'Scheduled', published: 'Published', disqualified: 'Disqualified',
  error: 'Error', failed: 'Failed', cancelled: 'Cancelled',
};

const pad = (n: number) => String(n).padStart(2, '0');

// yyyy-mm-dd key for an instant in the BROWSER LOCAL timezone. Used for "today"
// and for bucketing item instants onto their local calendar day.
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// yyyy-mm-dd key from pure calendar integers (month is 0-based). No Date/tz
// roundtrip — this is what makes the grid layout timezone-independent.
function ymdKey(y: number, month0: number, d: number): string {
  return `${y}-${pad(month0 + 1)}-${pad(d)}`;
}

// HH:MM (24h) in the browser local timezone, e.g. "20:00".
function formatTime(iso: string | null): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

// Short local timezone label (e.g. "EEST", "GMT-3") for the legend hint.
function localTzLabel(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value || '';
  } catch {
    return '';
  }
}

interface GridDay { y: number; month0: number; d: number; inMonth: boolean }

// Build the 42-cell month grid from pure UTC arithmetic so the result is a set
// of calendar integers, independent of the browser's local timezone.
function getMonthDays(year: number, month0: number): GridDay[] {
  const firstDow = new Date(Date.UTC(year, month0, 1)).getUTCDay(); // 0=Sun
  let startOffset = firstDow - 1; // shift to Monday-start
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const out: GridDay[] = [];
  // leading days from the previous month
  for (let i = startOffset; i > 0; i--) {
    const dt = new Date(Date.UTC(year, month0, 1 - i));
    out.push({ y: dt.getUTCFullYear(), month0: dt.getUTCMonth(), d: dt.getUTCDate(), inMonth: false });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    out.push({ y: year, month0: month0, d: i, inMonth: true });
  }
  let trailing = 1;
  while (out.length < 42) {
    const dt = new Date(Date.UTC(year, month0 + 1, trailing++));
    out.push({ y: dt.getUTCFullYear(), month0: dt.getUTCMonth(), d: dt.getUTCDate(), inMonth: false });
  }
  return out;
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
  const palette = item.kind === 'lm' ? TONE_COLOR_LM : TONE_COLOR_POST;
  const tone = palette[item.tone] || palette.idea;
  const Glyph = item.kind === 'lm' ? Magnet : item.kind === 'post-queue' ? Clock : FileText;
  const time = formatTime(item.scheduledAt);
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
      title={`${time ? time + ' · ' : ''}${item.statusLabel || TONE_LABEL[item.tone] || item.tone} — ${item.title}`}
    >
      <Glyph className="w-2.5 h-2.5 shrink-0 opacity-70" />
      {time && <span className="tabular-nums shrink-0 opacity-80">{time}</span>}
      <span className="truncate">{item.title || '(untitled)'}</span>
    </button>
  );
}

function DayCell({
  dayNum, inMonth, isToday, dayKey, items, onOpenItem, draggable,
}: {
  dayNum: number;
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
      } ${isToday ? 'ring-1 ring-inset ring-emerald-400/40' : ''} ${isOver ? 'ring-1 ring-inset ring-emerald-400/60 bg-emerald-950/20' : ''}`}
    >
      <div className="flex items-center justify-between text-[10.5px]">
        <span className={`tabular-nums ${isToday ? 'text-emerald-300 font-semibold' : inMonth ? 'text-zinc-400' : 'text-zinc-600'}`}>
          {dayNum}
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
  // Cursor = the {year, month0} being viewed. Initialised to the operator's
  // CURRENT month in their browser local timezone.
  const [cursor, setCursor] = useState<{ year: number; month0: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month0: now.getMonth() };
  });

  const tzLabel = useMemo(() => localTzLabel(), []);
  const { year, month0 } = cursor;
  const days = useMemo(() => getMonthDays(year, month0), [year, month0]);
  const todayKey = useMemo(() => localDateKey(new Date()), []);

  // Bucket items by their scheduled local date key (browser local). Items
  // without scheduledAt aren't displayed in the calendar.
  const buckets = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      if (!it.scheduledAt) continue;
      const key = localDateKey(new Date(it.scheduledAt));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    // Sort each day's items by scheduledAt ascending — earliest time first
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));
    }
    return map;
  }, [items]);

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
    () => days.filter((d) => d.inMonth).reduce((sum, d) => sum + (buckets.get(ymdKey(d.y, d.month0, d.d))?.length || 0), 0),
    [days, buckets],
  );

  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month0: now.getMonth() });
  };
  const addMonth = (delta: number) => {
    const total = month0 + delta;
    setCursor({ year: year + Math.floor(total / 12), month0: ((total % 12) + 12) % 12 });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays className="w-4 h-4 text-zinc-500" />
        <h2 className="dv-section-h">
          {MONTH_NAMES[month0]} <span className="dv-editorial-num text-[length:var(--t-lg)]">{year}</span>
        </h2>
        <span className="text-[length:var(--t-sm)] text-[color:var(--d-paper-dimmer)]">
          {monthlyCount} scheduled this month
        </span>
        {/* Legend — color + glyph distinguish posts from lead magnets */}
        <span className="hidden md:inline-flex items-center gap-3 text-[10.5px] text-zinc-500 ml-3">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-emerald-500/40 ring-1 ring-inset ring-emerald-500/50" />
            <FileText className="w-2.5 h-2.5" /> Post
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-violet-500/40 ring-1 ring-inset ring-violet-500/50" />
            <Magnet className="w-2.5 h-2.5" /> Lead magnet
          </span>
          <span className="text-zinc-600">· times in your local time{tzLabel ? ` (${tzLabel})` : ''}</span>
        </span>
        <div className="ml-auto inline-flex items-center gap-1">
          <button
            onClick={() => addMonth(-1)}
            className="p-1.5 rounded hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-100"
            title="Previous month" aria-label="Previous month"
          ><ChevronLeft className="w-4 h-4" /></button>
          <button
            onClick={goToday}
            className="px-2 py-1 text-[11.5px] rounded hover:bg-zinc-800/60 text-zinc-300"
          >Today</button>
          <button
            onClick={() => addMonth(1)}
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
            {days.map(({ y, month0: m0, d, inMonth }) => {
              const dayKey = ymdKey(y, m0, d);
              const cellItems = buckets.get(dayKey) || [];
              return (
                <DayCell
                  key={dayKey + (inMonth ? '' : '-out')}
                  dayNum={d}
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
