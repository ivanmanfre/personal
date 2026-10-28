import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CalendarDays, CircleCheck, Columns3 } from 'lucide-react';
import type { Post, PostStatus } from '../data/model';
import { fmtWhen } from '../data/model';
import { useLocal } from '../data/store';
import { SPRING, Thumb, useIsPhone } from '../ui/kit';
import { useNav } from '../ui/nav';
import { TimeEdit, useCanRetime } from '../ui/TimeEdit';
import { track } from '../data/track';
import { PostCalendar } from './Calendar';
import { PublishedPosts } from './Content';

type As = 'board' | 'calendar' | 'published';
const AS_KEY = 'board-posts-as';
const isAs = (v: string | null): v is As => v === 'board' || v === 'calendar' || v === 'published';
const readAs = (): As => {
  const q = new URLSearchParams(location.search).get('as');
  if (isAs(q)) return q;
  try { const v = localStorage.getItem(AS_KEY); return isAs(v) ? v : 'board'; } catch { return 'board'; }
};

type Col = { id: PostStatus; label: string; tone: string };

export function Pipeline() {
  const { model: m, openPost, openFocus } = useNav();
  const { statusOf } = useLocal();
  const canRetime = useCanRetime();
  const phone = useIsPhone();
  const reduce = useReducedMotion();
  const buffer = m.theme.mode === 'buffer';
  const cols: Col[] = [
    buffer
      ? { id: 'buffer', label: 'In the buffer', tone: 'var(--accent)' }
      : { id: 'needs_ok', label: m.theme.mode === 'team' ? "Needs your team's OK" : 'Needs your OK', tone: 'var(--accent)' },
    ...(buffer ? [] : [{ id: 'approved' as const, label: 'Approved', tone: 'color-mix(in srgb, var(--accent) 50%, var(--paper))' }]),
    { id: 'scheduled', label: 'Scheduled', tone: 'var(--soft)' },
  ];
  // Published posts have their own tab, with their numbers; the board columns only show what is still to come.
  const postsIn = (id: Col['id']) => {
    const list = m.posts.filter(p => statusOf(p) === id);
    if (id === 'scheduled') return list.sort((a, b) => (a.scheduledAt || '9').localeCompare(b.scheduledAt || '9'));
    return list;
  };
  const counts = cols.map(c => postsIn(c.id).length);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const [sel, setSel] = useState(0);
  const [as, setAsState] = useState<As>(readAs);
  const setAs = (v: As) => {
    setAsState(v);
    try { localStorage.setItem(AS_KEY, v); } catch { /* private mode */ }
    const q = new URLSearchParams(location.search);
    q.set('as', v);
    history.replaceState(null, '', `${location.pathname}?${q}`);
    track('expand', null, { which: `posts_as:${v}` });
  };
  const [more, setMore] = useState<Record<string, boolean>>({});

  const meta = (p: Post, s: PostStatus) => {
    if (s === 'scheduled') {
      if (!p.scheduledAt) return 'Time being set';
      const w = fmtWhen(p.scheduledAt, m.theme.tz);
      const time = canRetime(p, statusOf(p))
        ? <TimeEdit id={p.id} at={p.scheduledAt} text={`${w.time} ${m.theme.tzLabel}`} />
        : `${w.time} ${m.theme.tzLabel}`;
      return <>{new Date(p.scheduledAt) < new Date() ? 'Not out yet · was due ' : ''}{w.day}, {time}</>;
    }
    if (s === 'approved') return 'Goes into the next open slot';
    return p.format;
  };

  const column = (c: Col, i: number) => {
    const list = postsIn(c.id);
    const n = counts[i];
    // Show everything when only a couple would hide behind "Show more".
    const LIM = n <= 10 ? n : 8;
    const open = more[c.id];
    return (
      <div key={c.id} className="min-w-0">
        {!phone && (
          <div className="flex items-center gap-2 pb-3 mb-3 border-b hair">
            <span className="h-2 w-2 rounded-full" style={{ background: c.tone }} />
            <span className="text-[13.5px] font-semibold text-ink truncate">{c.label}</span>
            <span className="text-[12.5px] text-mute tnum ml-auto">{n}</span>
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
          {(open ? list : list.slice(0, LIM)).map(p => (
                <div
                  key={p.id} role="button" tabIndex={0}
                  onClick={() => (c.id === 'needs_ok' ? openFocus(p.id) : openPost(p.id))}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (c.id === 'needs_ok' ? openFocus(p.id) : openPost(p.id)); } }}
                  className="group text-left cursor-pointer rounded-[12px] border hair bg-raise p-2.5 hover:border-[var(--line-bold)] transition-colors"
                  data-testid="pipe-card"
                >
                  {p.image && !phone && <div className="mb-2.5"><Thumb src={p.image} text={p.hook} size="fill" ratio="2 / 1" rounded={8} /></div>}
                  <div className="flex gap-2.5 px-0.5">
                    {phone && <Thumb src={p.image} text={p.hook} size={60} rounded={8} />}
                    {c.id === 'needs_ok' && <span className="mt-[7px] h-1.5 w-1.5 rounded-full bg-accent shrink-0" />}
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-medium text-ink leading-snug clamp-2">{p.title}</div>
                      {(!p.image || phone) && <div className="text-[12.5px] text-mute leading-snug clamp-2 mt-1">{p.hook !== p.title ? p.hook : ''}</div>}
                      <div className="text-[12px] text-mute mt-1.5 truncate">{meta(p, c.id as PostStatus)}</div>
                    </div>
                  </div>
                </div>
              ))}
          {n === 0 && <div className="rounded-[12px] border border-dashed hair px-3 py-5 text-[13px] text-mute text-center">Nothing here</div>}
          {n > LIM && (
            <button className="btn btn-text btn-sm justify-self-start !px-1" onClick={() => { if (!open) track('expand', null, { which: `posts:${c.id}` }); setMore(x => ({ ...x, [c.id]: !x[c.id] })); }}>
              {open ? 'Show fewer' : `Show ${n - LIM} more`}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8 pt-6 sm:pt-8 pb-20">
      <div className="eyebrow mb-2">{as === 'published' ? 'Out on LinkedIn, with their numbers' : as === 'calendar' ? 'Every post on its day' : buffer ? 'Everything lined up, in order' : 'From draft to scheduled'}</div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 mb-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <h1 className="display text-[28px] sm:text-[32px]">Posts</h1>
          <div className="seg" role="group" aria-label="Show posts as">
            {([['board', 'Board', Columns3], ['calendar', 'Calendar', CalendarDays], ['published', 'Published', CircleCheck]] as const).map(([id, label, Icon]) => (
              <button key={id} aria-pressed={as === id} onClick={() => setAs(id)} data-testid={`posts-as-${id}`}>
                {as === id && <motion.span layoutId="seg-posts-as" className="absolute inset-0 rounded-full bg-sunk" transition={SPRING} />}
                <span className="relative inline-flex items-center gap-1.5"><Icon size={14} strokeWidth={1.8} />{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {as === 'published' ? <PublishedPosts /> : as === 'calendar' ? <PostCalendar /> : <>

      {/* partition-bar move: one proportional strip, a label and count under each part */}
      {phone && (
        <div className="mb-6">
          <div className="flex gap-[3px] mb-4" aria-hidden>
            {cols.map((c, i) => (
              <motion.span key={c.id} className="block h-2 rounded-full bar-x" style={{ flex: `${Math.max(counts[i] / total, 0.04)} 1 0`, background: c.tone, opacity: counts[i] ? 1 : 0.35 }} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ ...SPRING, delay: i * 0.05 }} />
            ))}
          </div>
          <div className="grid gap-1" role="tablist" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
            {cols.map((c, i) => (
              <button key={c.id} role="tab" aria-selected={sel === i} onClick={() => setSel(i)} className="relative text-left min-w-0 pb-2.5">
                <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: c.tone }} /><span className="numeral text-[22px]">{counts[i]}</span></span>
                <span className={`mt-1 block text-[11.5px] leading-tight ${sel === i ? 'text-ink font-semibold' : 'text-mute'}`}>{c.id === 'needs_ok' ? 'Needs OK' : c.label}</span>
                {sel === i && <motion.span layoutId="pipe-tab" className="absolute bottom-0 left-0 right-2 h-[2px] rounded-full bg-ink" transition={SPRING} />}
              </button>
            ))}
          </div>
        </div>
      )}
      {!phone && <div className="mb-7">
        <div className="flex items-start gap-[3px]">
          {cols.map((c, i) => (
            <button
              key={c.id}
              onClick={() => { setSel(i); document.getElementById(`col-${c.id}`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' }); }}
              className="min-w-0 text-left relative"
              style={{ flex: `${Math.max(counts[i] / total, 0.12)} 1 0`, minWidth: 92 }}
            >
              <motion.span className="block h-2 rounded-full bar-x" style={{ background: c.tone, opacity: counts[i] ? 1 : 0.35 }} initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ ...SPRING, delay: i * 0.05 }} />
              <span className="mt-2.5 block numeral text-[22px] sm:text-[26px]">{counts[i]}</span>
              <span className="mt-1 block text-[12.5px] leading-tight text-mute truncate">{c.id === 'needs_ok' ? 'Needs OK' : c.label}</span>
            </button>
          ))}
        </div>
      </div>}

      {phone ? (
        <div>
          <div className="flex items-center gap-2 pb-3 mb-3 border-b hair">
            <span className="text-[15px] font-semibold text-ink">{cols[sel].label}</span>
            <span className="text-[13px] text-mute tnum ml-auto">{counts[sel]}</span>
          </div>
          {column(cols[sel], sel)}
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))` }}>
          {cols.map((c, i) => <div id={`col-${c.id}`} key={c.id} className="min-w-0">{column(c, i)}</div>)}
        </div>
      )}
      </>}
    </div>
  );
}
