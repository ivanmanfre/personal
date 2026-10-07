import React, { useRef, useState } from 'react';
import { boardDayOf, clientTz } from '../ClientBoardPage';
import type { QueueItem } from '../ClientBoardPage';

const shiftDay = (day: string, n: number) => new Date(new Date(day + 'T12:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
const dateOf = (q: QueueItem) => boardDayOf(q.scheduled_at) || q.publish_date;
const titleOf = (q: QueueItem) => (q.hook || q.title || 'Untitled post').replace(/^\[[^\]]*\]\s*/, '');
const shortDate = (day: string) => new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' });
const CSS = `
.cb-schedule-week { margin: 20px 0 24px; color: var(--cb-ink); }
.cb-schedule-week-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 12px; }
.cb-schedule-week-head h2 { margin: 0 auto 0 0; font-size: 18px; font-weight: 700; }
.cb-schedule-week button { font: inherit; cursor: pointer; }
.cb-schedule-week button:focus-visible { outline: 2px solid var(--cb-accent); outline-offset: 2px; }
.cb-schedule-week button:disabled { opacity: .5; cursor: wait; }
.cb-week-nav, .cb-week-add { min-height: 44px; padding: 8px 12px; border: 1px solid var(--cb-line-bold); border-radius: 6px; background: var(--cb-paper); color: var(--cb-ink); font-size: 13px !important; }
.cb-schedule-days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.cb-schedule-day { min-width: 0; min-height: 128px; padding: 8px; border: 1px solid var(--cb-line-bold); border-radius: 7px; background: var(--cb-paper-sunk); color: var(--cb-ink); text-align: left; overflow: hidden; }
.cb-schedule-day[aria-pressed=true] { border: 2px solid var(--cb-accent); padding: 7px; }
.cb-schedule-day[data-empty=true] { border-style: dashed; }
.cb-schedule-day-date { display: block; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.cb-schedule-day img { width: 100%; height: 64px; object-fit: cover; object-position: top; border-radius: 3px; margin-bottom: 6px; }
.cb-schedule-day-title { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; overflow-wrap: anywhere; font-size: 12px; line-height: 1.35; }
.cb-schedule-day-empty { display: block; color: var(--cb-ink-mute); font-size: 12px; }
.cb-week-picker { margin-top: 12px; padding: 14px; border: 1px solid var(--cb-line-bold); border-radius: 7px; }
.cb-week-picker p { margin: 0 0 12px; font-size: 14px; }
.cb-week-pick-row { display: flex; gap: 12px; align-items: center; padding: 8px 0; border-top: 1px solid var(--cb-line); font-size: 14px; }
.cb-week-pick-row > span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.cb-week-add { flex: none; }
@media (max-width: 599px) {
  .cb-schedule-days { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .cb-schedule-day { padding: 6px; min-height: 100px; }
  .cb-schedule-day[aria-pressed=true] { padding: 5px; }
  .cb-schedule-day-title { -webkit-line-clamp: 2; }
  .cb-schedule-day img { height: 34px; }
}
`;

/** The displayed week stays fixed when posts move or its last slot is cleared. */
export default function ScheduleWeek({ queue, ready, onOpen, onAdd, coverFor, recentlyCleared = {} }: {
  queue: QueueItem[];
  ready: QueueItem[];
  onOpen: (q: QueueItem) => void;
  onAdd: (id: string, day: string) => Promise<{ ok: boolean; error?: string }>;
  coverFor?: (q: QueueItem) => string | undefined;
  recentlyCleared?: Record<string, string>;
}) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: clientTz() }).format(new Date());
  const monday = shiftDay(today, -((new Date(today + 'T12:00:00Z').getUTCDay() + 6) % 7));
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(monday, offset * 7 + i));
  const postsOn = (day: string) => queue.filter(q => dateOf(q) === day);
  const selectedPosts = selected ? postsOn(selected) : [];
  const candidates = [...ready].sort((a, b) => Number(b.id === recentlyCleared[selected || '']) - Number(a.id === recentlyCleared[selected || '']));
  const navigate = (n: number) => { setOffset(n); setSelected(null); setError(''); };
  const add = async (id: string) => {
    if (!selected || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await onAdd(id, selected);
      if (result.ok) setSelected(null);
      else setError(result.error || 'Could not add this post. Try again.');
    } catch { setError('Could not add this post. Try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="cb-schedule-week" aria-label="Weekly schedule">
    <style>{CSS}</style>
    <div className="cb-schedule-week-head">
      <h2>{offset === 0 ? 'This week' : `${shortDate(days[0])} to ${shortDate(days[6])}`}</h2>
      <button type="button" className="cb-week-nav" disabled={busy} aria-label="Previous week" onClick={() => navigate(offset - 1)}>←</button>
      {offset !== 0 && <button type="button" className="cb-week-nav" disabled={busy} onClick={() => navigate(0)}>This week</button>}
      <button type="button" className="cb-week-nav" disabled={busy} aria-label="Next week" onClick={() => navigate(offset + 1)}>→</button>
    </div>
    <div className="cb-schedule-days">
      {days.map((day, index) => {
        const posts = postsOn(day), post = posts[0], cover = post && coverFor?.(post);
        const label = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index];
        const emptyLabel = day < today ? 'Empty' : index > 4 ? 'Weekend' : 'Add';
        return <button type="button" className="cb-schedule-day" key={day} data-week-day={day} data-empty={!posts.length} aria-pressed={selected === day} disabled={busy}
          aria-label={`${label} ${shortDate(day)}: ${posts.length ? posts.map(titleOf).join(', ') : emptyLabel === 'Add' ? 'Add a post' : emptyLabel}`}
          onClick={() => { setSelected(day); setError(''); if (posts.length === 1) onOpen(post); }}>
          <span className="cb-schedule-day-date">{label} {Number(day.slice(8))}</span>
          {cover && <img src={cover} alt="" loading="lazy" />}
          {post ? <span className="cb-schedule-day-title">{titleOf(post)}{posts.length > 1 ? ` +${posts.length - 1}` : ''}</span> : <span className="cb-schedule-day-empty">{emptyLabel}</span>}
        </button>;
      })}
    </div>
    {selected && <div className="cb-week-picker">
      <p>{shortDate(selected)}{selectedPosts.length ? '' : ': nothing scheduled'}</p>
      {selectedPosts.length ? selectedPosts.map(q => <div className="cb-week-pick-row" key={q.id}><span>{titleOf(q)}</span><button type="button" className="cb-week-add" onClick={() => onOpen(q)}>{q.stage === 'published' ? 'View post' : 'Open post'}</button></div>)
        : selected < today ? <p>This date has passed.</p>
        : new Date(selected + 'T12:00:00Z').getUTCDay() % 6 === 0 ? <p>Weekends are not posting days.</p>
        : candidates.length ? <><p>Choose a ready post for this day.</p>{candidates.map(q => <div className="cb-week-pick-row" key={q.id}><span>{titleOf(q)}</span><button type="button" className="cb-week-add" aria-label={`Add ${titleOf(q)}`} disabled={busy} onClick={() => void add(q.id)}>{busy ? 'Adding…' : 'Add post'}</button></div>)}</>
        : <p>No ready posts available yet.</p>}
      {error && <p role="alert">{error}</p>}
    </div>}
  </section>;
}
