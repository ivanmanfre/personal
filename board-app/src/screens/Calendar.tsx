import { useMemo, useState, type DragEvent } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CircleCheck } from 'lucide-react';
import type { Post, PostStatus } from '../data/model';
import { addDays, dayKey, fmtWeekday, wallTime, wallToUtc, fmtWhen } from '../data/model';
import { useLocal } from '../data/store';
import { track } from '../data/track';
import { SPRING, Thumb, useIsPhone } from '../ui/kit';
import { useNav } from '../ui/nav';
import { TimeEdit, useCanRetime } from '../ui/TimeEdit';

/** A post's day on the calendar: when it went out, else when it is set to go out. */
const atOf = (p: Post, s: PostStatus) => (s === 'live' ? p.publishedAt || p.scheduledAt : p.scheduledAt);

const monthKey = (day: string) => day.slice(0, 7);
const shiftMonth = (mk: string, d: number) => {
  const [y, mo] = mk.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + d, 1));
  return t.toISOString().slice(0, 7);
};
const monthLabel = (mk: string) => new Date(mk + '-01T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Six or fewer Monday-first weeks that cover the month. */
function gridOf(mk: string) {
  const first = mk + '-01';
  const dow = (new Date(first + 'T12:00:00Z').getUTCDay() + 6) % 7;
  const start = addDays(first, -dow);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i));
    if (w > 0 && monthKey(days[0]) !== mk) break;
    weeks.push(days);
  }
  return weeks;
}

export function PostCalendar() {
  const { model: m, openPost, openFocus } = useNav();
  const { statusOf, reschedule, canAct, canApprove, toast } = useLocal();
  const canRetime = useCanRetime();
  const phone = useIsPhone();
  const tz = m.theme.tz;
  const today = dayKey(new Date(), tz);
  const [month, setMonth] = useState(monthKey(today));
  const [pick, setPick] = useState(today);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [timing, setTiming] = useState<string | null>(null);

  const canMove = (p: Post) => canRetime(p, statusOf(p));

  const { byDay, undated } = useMemo(() => {
    const byDay = new Map<string, { p: Post; s: PostStatus; at: string }[]>();
    const undated: { p: Post; s: PostStatus }[] = [];
    for (const p of m.posts) {
      const s = statusOf(p);
      if (s === 'archived') continue;
      const at = atOf(p, s);
      if (!at) { if (s !== 'live') undated.push({ p, s }); continue; }
      const k = dayKey(at, tz);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push({ p, s, at });
    }
    for (const list of byDay.values()) list.sort((a, b) => a.at.localeCompare(b.at));
    return { byDay, undated };
  }, [m.posts, statusOf, tz]);

  const weeks = gridOf(month);
  const inMonth = [...byDay.entries()].filter(([k]) => monthKey(k) === month).flatMap(([, v]) => v);
  const count = {
    live: inMonth.filter(x => x.s === 'live').length,
    planned: inMonth.filter(x => x.s !== 'live').length,
  };

  const open = (p: Post, s: PostStatus) => (s === 'needs_ok' && canApprove ? openFocus(p.id) : openPost(p.id));
  const goMonth = (d: number) => { const next = shiftMonth(month, d); setMonth(next); track('expand', null, { which: `calendar:${next}` }); };

  /* Drag a scheduled post to another day. It keeps its time of day. */
  const onDrop = (day: string) => (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || drag;
    setDrag(null); setOver(null);
    const p = m.posts.find(x => x.id === id);
    if (!p || !p.scheduledAt || !canMove(p)) return;
    if (dayKey(p.scheduledAt, tz) === day) return;
    const at = wallToUtc(day, wallTime(p.scheduledAt, tz), tz);
    if (new Date(at).getTime() < Date.now() + 60_000) { toast('That day has already passed. Pick a later one.'); return; }
    const w = fmtWhen(at, tz);
    reschedule(p.id, at, `${w.day}, ${w.time} ${m.theme.tzLabel}`);
  };
  const dropOk = (day: string) => !!drag && day >= today;

  const tone = (s: PostStatus) =>
    s === 'needs_ok' ? { bar: 'var(--accent)', label: m.theme.mode === 'team' ? "Needs your team's OK" : 'Needs your OK' }
      : s === 'live' ? { bar: 'var(--mute)', label: 'Out' }
        : s === 'approved' ? { bar: 'color-mix(in srgb, var(--accent) 50%, var(--paper))', label: 'Approved' }
          : { bar: 'var(--soft)', label: 'Scheduled' };

  const chip = ({ p, s, at }: { p: Post; s: PostStatus; at: string }, compact = false) => {
    const t = tone(s);
    const retime = canMove(p) && s !== 'live';
    const movable = !phone && retime && timing !== p.id;
    return (
      <div key={p.id} role="button" tabIndex={0}
        draggable={movable}
        onDragStart={e => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setDrag(p.id); }}
        onDragEnd={() => { setDrag(null); setOver(null); }}
        onClick={() => open(p, s)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(p, s); } }}
        title={`${t.label} · ${wallTime(at, tz)} ${m.theme.tzLabel}${movable ? ' · drag to another day to move it, tap the time to change it' : ''}`}
        className={`group relative w-full text-left rounded-[8px] border hair bg-raise hover:border-[var(--line-bold)] transition-colors overflow-hidden ${movable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${drag === p.id ? 'opacity-40' : ''} ${s === 'live' ? 'opacity-70 hover:opacity-100' : ''}`}
        data-testid="cal-post" data-status={s}>
        <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: t.bar }} aria-hidden />
        <div className={`flex gap-2 ${compact ? 'p-1.5 pl-2.5' : 'p-2 pl-3'}`}>
          {phone && <Thumb src={p.image} text={p.hook} size={44} rounded={6} />}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[11px] text-mute tnum leading-none">
              {s === 'live' && <CircleCheck size={11} className="shrink-0" />}
              {retime
                ? <TimeEdit id={p.id} at={at} text={wallTime(at, tz)} tight={!phone} onOpen={b => setTiming(b ? p.id : null)} />
                : <span>{wallTime(at, tz)}</span>}
              {s === 'needs_ok' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent shrink-0" aria-label="needs your OK" />}
            </div>
            <div className={`mt-1 font-medium text-ink leading-snug ${phone ? 'text-[13.5px] clamp-2' : `text-[12px] ${compact ? 'clamp-1' : 'clamp-3'}`}`}>{p.title}</div>
          </div>
        </div>
      </div>
    );
  };

  const legend = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-mute">
      {(['needs_ok', 'scheduled', 'live'] as PostStatus[]).filter(s => s !== 'needs_ok' || m.reviewMode).map(s => (
        <span key={s} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-[3px] rounded-full" style={{ background: tone(s).bar }} />{tone(s).label}</span>
      ))}
      {canAct && <span className="max-lg:hidden">{phone ? 'Tap a time to change it.' : 'Drag a post to another day. Click its time to change the time.'}</span>}
    </div>
  );

  const head = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4">
      <div className="flex items-center gap-1">
        <button className="h-8 w-8 rounded-full inline-flex items-center justify-center text-soft hover:text-ink hover:bg-sunk" aria-label="Previous month" onClick={() => goMonth(-1)} data-testid="cal-prev"><ChevronLeft size={17} /></button>
        <button className="h-8 w-8 rounded-full inline-flex items-center justify-center text-soft hover:text-ink hover:bg-sunk" aria-label="Next month" onClick={() => goMonth(1)} data-testid="cal-next"><ChevronRight size={17} /></button>
      </div>
      <h2 className="font-display text-head text-[19px] sm:text-[21px]" style={{ fontWeight: 500, letterSpacing: '-0.01em' }} data-testid="cal-month">{monthLabel(month)}</h2>
      {month !== monthKey(today) && <button className="btn btn-outline btn-sm !h-[30px]" onClick={() => { setMonth(monthKey(today)); setPick(today); }}>Today</button>}
      <span className="text-[12.5px] text-mute tnum sm:ml-auto">
        {[count.planned ? `${count.planned} coming up` : '', count.live ? `${count.live} out` : ''].filter(Boolean).join(' · ') || 'Nothing this month'}
      </span>
    </div>
  );

  const tray = undated.length > 0 && (
    <section className="min-w-0" data-testid="cal-undated">
      <div className="flex items-center gap-2 pb-2.5 mb-3 border-b hair">
        <span className="text-[13px] font-semibold text-ink">No date yet</span>
        <span className="text-[12px] text-mute tnum ml-auto">{undated.length}</span>
      </div>
      <p className="text-[12px] text-mute mb-3 leading-[1.45]">
        {m.theme.mode === 'buffer' ? 'Lined up. Each one gets its day as the slots before it go out.' : 'Each one gets a day once it is approved.'}
      </p>
      <div className="grid gap-2">
        {undated.map(({ p, s }) => (
          <button key={p.id} onClick={() => open(p, s)} className="relative text-left rounded-[8px] border hair bg-raise p-2 pl-3 hover:border-[var(--line-bold)] overflow-hidden" data-testid="cal-undated-post">
            <span className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: tone(s).bar }} aria-hidden />
            <div className="text-[11px] text-mute">{s === 'needs_ok' ? tone(s).label : s === 'approved' ? 'Approved' : s === 'scheduled' ? 'Time being set' : 'In the buffer'}</div>
            <div className="mt-0.5 text-[12.5px] font-medium text-ink leading-snug clamp-2">{p.title}</div>
          </button>
        ))}
      </div>
    </section>
  );

  /* Phone: a compact month (a dot per post) and the picked day's posts under it. */
  if (phone) {
    const list = byDay.get(pick) || [];
    return (
      <div data-testid="post-calendar">
        {head}
        <div className="grid grid-cols-7 text-center text-[11px] text-mute mb-1">
          {weeks[0].map(d => <span key={d}>{fmtWeekday(d).slice(0, 2)}</span>)}
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {weeks.flat().map(d => {
            const items = byDay.get(d) || [];
            const outside = monthKey(d) !== month;
            return (
              <button key={d} onClick={() => setPick(d)} aria-pressed={pick === d} aria-label={`${fmtWeekday(d, 'long')} ${Number(d.slice(8))}, ${items.length} posts`}
                className={`relative h-12 flex flex-col items-center justify-center gap-1 rounded-[10px] ${pick === d ? 'bg-sunk' : ''} ${outside ? 'opacity-35' : ''}`}>
                <span className={`text-[13.5px] tnum leading-none ${d === today ? 'h-6 w-6 rounded-full inline-flex items-center justify-center font-semibold' : 'text-ink'}`}
                  style={d === today ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : undefined}>{Number(d.slice(8))}</span>
                <span className="flex gap-[3px] h-1.5">
                  {items.slice(0, 3).map(x => <span key={x.p.id} className="h-1.5 w-1.5 rounded-full" style={{ background: tone(x.s).bar }} />)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4">{legend}</div>
        <div className="mt-5">
          <div className="flex items-center gap-2 pb-2.5 mb-3 border-b hair">
            <span className="text-[14px] font-semibold text-ink">{pick === today ? 'Today' : `${fmtWeekday(pick, 'long')} ${Number(pick.slice(8))}`}</span>
            <span className="text-[12.5px] text-mute tnum ml-auto">{list.length}</span>
          </div>
          {list.length ? <div className="grid gap-2">{list.map(x => chip(x))}</div> : <p className="text-[13px] text-mute">Nothing on this day.</p>}
        </div>
        {tray && <div className="mt-8">{tray}</div>}
      </div>
    );
  }

  return (
    <div data-testid="post-calendar">
      {head}
      <div className={`grid gap-6 ${tray ? 'xl:grid-cols-[minmax(0,1fr)_240px]' : ''}`}>
        <div className="min-w-0">
          <div className="rounded-[12px] border hair overflow-hidden">
            <div className="grid grid-cols-7 border-b hair bg-sunk">
              {weeks[0].map(d => <div key={d} className="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mute">{fmtWeekday(d)}</div>)}
            </div>
            {weeks.map((w, wi) => (
              <div key={wi} className={`grid grid-cols-7 ${wi > 0 ? 'border-t hair' : ''}`}>
                {w.map((d, di) => {
                  const items = byDay.get(d) || [];
                  const outside = monthKey(d) !== month;
                  const past = d < today;
                  const target = over === d && dropOk(d);
                  return (
                    <div key={d}
                      onDragOver={e => { if (dropOk(d)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== d) setOver(d); } }}
                      onDragLeave={() => { if (over === d) setOver(null); }}
                      onDrop={onDrop(d)}
                      className={`relative ${past ? 'min-h-[76px]' : 'min-h-[104px]'} p-1.5 ${di > 0 ? 'border-l hair' : ''} ${past && !outside ? 'bg-[color-mix(in_srgb,var(--sunk)_60%,transparent)]' : ''}`}
                      data-testid="cal-day" data-day={d}>
                      {target && <motion.span layoutId="cal-drop" className="absolute inset-[3px] rounded-[9px] border-2 border-dashed pointer-events-none" style={{ borderColor: 'var(--accent)' }} transition={SPRING} />}
                      <div className={`flex items-center justify-between px-1 pb-1.5 ${outside ? 'opacity-40' : ''}`}>
                        <span className={`text-[12px] tnum leading-none ${d === today ? 'h-[22px] min-w-[22px] px-1 rounded-full inline-flex items-center justify-center font-semibold' : past ? 'text-mute' : 'text-soft'}`}
                          style={d === today ? { background: 'var(--accent)', color: 'var(--accent-ink)' } : undefined}>
                          {Number(d.slice(8)) === 1 ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : Number(d.slice(8))}
                        </span>
                      </div>
                      <div className={`grid gap-1.5 ${outside ? 'opacity-60' : ''}`}>
                        {items.map(x => chip(x, items.length > 2 || past))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-3">{legend}</div>
        </div>
        {tray}
      </div>
    </div>
  );
}
