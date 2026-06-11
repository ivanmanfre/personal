import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react';

/**
 * SchedulePicker — drop-in replacement for the bare <Input type="datetime-local">
 * schedule fields. Same value contract: a "YYYY-MM-DDTHH:mm" local string, or ""
 * meaning "auto-pick the next free slot" (the editors' existing fallback).
 *
 * Opens UPWARD by default because every call site lives in a sticky bottom bar.
 */

const QUICK_TIMES = ['08:30', '09:30', '12:00', '13:30', '14:30', '18:00'];

const pad = (n: number) => String(n).padStart(2, '0');

function parseValue(v: string): { date: Date | null; time: string } {
  if (!v) return { date: null, time: '09:30' };
  const d = new Date(v);
  if (isNaN(d.getTime())) return { date: null, time: '09:30' };
  return { date: d, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

function toValue(day: Date, time: string): string {
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${time}`;
}

function fmtLabel(v: string): string {
  const d = new Date(v);
  if (!v || isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  // Monday-first column index
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function SchedulePicker({
  value,
  onChange,
  disabled,
  className,
  openDirection = 'up',
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  className?: string;
  openDirection?: 'up' | 'down';
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const parsed = parseValue(value);
  const [viewYM, setViewYM] = useState<{ y: number; m: number }>(() => {
    const base = parsed.date || new Date();
    return { y: base.getFullYear(), m: base.getMonth() };
  });
  const [time, setTime] = useState(parsed.time);

  // Re-sync internal time + visible month when the value changes from outside
  // (e.g. the auto-slot toast writes the picked slot back into the field).
  useEffect(() => {
    const p = parseValue(value);
    setTime(p.time);
    if (p.date) setViewYM({ y: p.date.getFullYear(), m: p.date.getMonth() });
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const cells = useMemo(() => monthGrid(viewYM.y, viewYM.m), [viewYM]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const selDay = parsed.date ? new Date(parsed.date.getFullYear(), parsed.date.getMonth(), parsed.date.getDate()) : null;

  const pickDay = (day: Date) => onChange(toValue(day, time));
  const pickTime = (t: string) => {
    setTime(t);
    const day = selDay || (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d; })();
    onChange(toValue(day, t));
  };

  return (
    <div ref={wrapRef} className={'relative ' + (className || '')}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title="Your local time. Auto picks the next free slot."
        className="inline-flex items-center gap-2 rounded-lg bg-zinc-950/60 ring-1 ring-inset ring-zinc-800/80 px-3 py-1.5 text-sm transition-all duration-150 hover:ring-zinc-600 focus:outline-none focus:ring-emerald-500/40 disabled:opacity-50"
      >
        <CalendarClock className="w-4 h-4 text-zinc-500 shrink-0" />
        {value ? (
          <span className="text-zinc-100 whitespace-nowrap">{fmtLabel(value)}</span>
        ) : (
          <span className="text-zinc-500 whitespace-nowrap inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Auto: next free slot
          </span>
        )}
        {value && (
          <span
            role="button"
            aria-label="Clear (use auto slot)"
            className="ml-0.5 -mr-1 p-0.5 rounded text-zinc-600 hover:text-zinc-300"
            onClick={(e) => { e.stopPropagation(); onChange(''); }}
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {open && (
        <div className={(openDirection === 'up' ? 'absolute bottom-full left-0 mb-2' : 'absolute top-full left-0 mt-2') + ' z-50 w-[300px] rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/50 p-3'}>
          {/* Month header */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900" aria-label="Previous month"
              onClick={() => setViewYM(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-semibold text-zinc-200">
              {new Date(viewYM.y, viewYM.m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}
            </div>
            <button type="button" className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900" aria-label="Next month"
              onClick={() => setViewYM(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday row */}
          <div className="grid grid-cols-7 mb-1">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <div key={d} className="text-center text-[10px] uppercase tracking-wider text-zinc-600 font-semibold py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const isPast = day < today;
              const isToday = day.getTime() === today.getTime();
              const isSel = !!selDay && day.getTime() === selDay.getTime();
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isPast}
                  onClick={() => pickDay(day)}
                  className={
                    'h-8 rounded-md text-sm transition-colors ' +
                    (isSel
                      ? 'bg-emerald-600 text-white font-semibold'
                      : isPast
                        ? 'text-zinc-700 cursor-not-allowed'
                        : 'text-zinc-200 hover:bg-zinc-800') +
                    (isToday && !isSel ? ' ring-1 ring-inset ring-emerald-500/50' : '')
                  }
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {/* Time */}
          <div className="mt-3 pt-3 border-t border-zinc-800/80">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {QUICK_TIMES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickTime(t)}
                  className={
                    'px-2 py-1 rounded-md text-xs font-mono transition-colors ' +
                    (time === t && value
                      ? 'bg-emerald-600/20 text-emerald-300 ring-1 ring-inset ring-emerald-500/50'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100 ring-1 ring-inset ring-zinc-800')
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => e.target.value && pickTime(e.target.value)}
                className="flex-1 rounded-lg bg-zinc-950/60 ring-1 ring-inset ring-zinc-800/80 px-2.5 py-1.5 text-sm text-zinc-100 focus:outline-none focus:ring-emerald-500/40 [color-scheme:dark]"
              />
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-100 ring-1 ring-inset ring-zinc-800 inline-flex items-center gap-1.5"
                title="Let the system pick the next free slot"
              >
                <Sparkles className="w-3.5 h-3.5" /> Auto
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-500"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
