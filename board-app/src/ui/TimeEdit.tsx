import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { Check, Clock3, X } from 'lucide-react';
import type { Post, PostStatus } from '../data/model';
import { dayKey, fmtWhen, wallTime, wallToUtc } from '../data/model';
import { useLocal } from '../data/store';
import { useNav } from './nav';

/** Dated posts that are not out yet can get a new time, if this person can move posts. */
export function useCanRetime() {
  const { model: m } = useNav();
  const { canAct, canApprove } = useLocal();
  return (p: Post, s: PostStatus) =>
    !!p.scheduledAt && (s === 'scheduled' || s === 'needs_ok') && canAct && (m.theme.mode === 'buffer' || canApprove);
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

/** The post's time as a button. Tapping it opens a time field; the day stays, only the time moves. */
export function TimeEdit({ id, at, text, onOpen, tight = false, className = '' }: { id: string; at: string; text: string; onOpen?: (open: boolean) => void; tight?: boolean; className?: string }) {
  const { model: m } = useNav();
  const { reschedule, toast } = useLocal();
  const tz = m.theme.tz;
  const [open, setOpenState] = useState(false);
  const [v, setV] = useState('');
  const box = useRef<HTMLSpanElement>(null);
  const setOpen = (b: boolean) => { setOpenState(b); onOpen?.(b); };
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', off);
    return () => window.removeEventListener('mousedown', off);
  }, [open]); // eslint-disable-line

  const save = () => {
    if (!/^\d{2}:\d{2}$/.test(v)) return;
    const next = wallToUtc(dayKey(at, tz), v, tz);
    if (new Date(next).getTime() === new Date(at).getTime()) { setOpen(false); return; }
    if (new Date(next).getTime() < Date.now() + 60_000) { toast('That time has already passed. Pick a later one.'); return; }
    const w = fmtWhen(next, tz);
    reschedule(id, next, `${w.day}, ${w.time} ${m.theme.tzLabel}`);
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" title="Change the time"
        onClick={e => { e.stopPropagation(); e.preventDefault(); setV(wallTime(at, tz)); setOpen(true); }}
        onKeyDown={stop}
        className={`group/t inline-flex items-center gap-1 rounded-[4px] tnum underline decoration-dotted decoration-[var(--line-bold)] underline-offset-[3px] hover:text-ink hover:decoration-[var(--ink)] ${className}`}
        data-testid="time-edit">
        {text}
        <Clock3 size={11} className="shrink-0 opacity-0 group-hover/t:opacity-100 max-sm:opacity-60 transition-opacity" aria-hidden />
      </button>
    );
  }
  return (
    <span ref={box} className={`${tight ? 'flex flex-1 min-w-0' : 'inline-flex'} items-center gap-1 align-middle`} onClick={stop} onMouseDown={stop} onPointerDown={stop}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); save(); } if (e.key === 'Escape') setOpen(false); }}>
      <input type="time" step={900} autoFocus value={v} onChange={e => setV(e.target.value)} aria-label={`New time, ${m.theme.tzLabel}`}
        className={`h-7 ${tight ? 'time-tight flex-1 min-w-0 w-0' : 'w-[92px]'} rounded-full border hair bg-paper px-2 text-[12.5px] text-ink tnum`} data-testid="time-input" />
      <button type="button" onClick={save} aria-label="Save the new time" title="Save"
        className="h-7 w-7 shrink-0 rounded-full inline-flex items-center justify-center" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }} data-testid="time-save">
        <Check size={14} />
      </button>
      {!tight && (
        <button type="button" onClick={() => setOpen(false)} aria-label="Keep the time" title="Cancel"
          className="h-7 w-7 shrink-0 rounded-full inline-flex items-center justify-center text-soft hover:text-ink hover:bg-sunk">
          <X size={14} />
        </button>
      )}
    </span>
  );
}
