import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, CalendarClock, CircleCheck, ExternalLink, Image as ImageIcon, PenLine, RotateCcw, Undo2 } from 'lucide-react';
import type { Model, PostStatus } from '../data/model';
import { addDays, dayKey, fmtDay, fmtWeekday, fmtWhen, wallTime, wallToUtc } from '../data/model';
import { PhotoPicker, photoSwappable, usePhotos } from './Photos';
import { fmtInt, whenLabel } from '../data/derive';
import { plural } from '../data/copy';
import { useLocal } from '../data/store';
import { PeopleList } from '../screens/Outreach';
import { LinkedInPost } from './LinkedInPost';
import { Sheet } from './kit';
import { Comments } from './Comments';
import { useNav } from './nav';
import type { PeopleKind } from './nav';

export const STATUS_LABEL = (s: PostStatus, m: Model) => ({
  needs_ok: m.theme.mode === 'team' ? "Needs your team's OK" : 'Needs your OK',
  approved: 'Approved',
  buffer: 'In the buffer',
  scheduled: 'Scheduled',
  live: 'Live on LinkedIn',
  archived: 'Archived',
}[s]);

export function PeopleSheet({ m, kind, onClose }: { m: Model; kind: PeopleKind | null; onClose: () => void }) {
  const r = m.results;
  const conf = kind && {
    booked: { title: plural(r.bookedCount, 'call') + ' booked', people: r.booked, note: undefined as string | undefined },
    positive: { title: `${r.positive.length} said yes`, people: r.positive, note: r.positiveNote },
    replied: { title: `${r.repliedCount} replied`, people: r.replied, note: r.repliedNote },
    reached: { title: `${fmtInt(r.reached || 0)} ${r.reachedLabel}`, people: r.reachedPeople, note: undefined },
  }[kind];
  return (
    <Sheet open={!!kind} onClose={onClose} eyebrow={m.window.label} title={conf ? conf.title : ''}>
      {conf && (
        <div className="pt-5">
          {conf.note && <p className="text-[13.5px] text-mute mb-4">{conf.note}</p>}
          {kind === 'reached' && !conf.people.length && r.reachedByWeek.length ? (
            <div>
              <p className="text-[14px] text-soft mb-5">Week by week, {m.window.short}.</p>
              <div className="grid gap-2 pb-2 border-b hair" style={{ gridTemplateColumns: 'minmax(0,1fr) repeat(4, 64px)' }}>
                {['Week', 'Invited', 'Connected', 'Replied', 'Booked'].map((h, i) => <span key={h} className={`eyebrow !tracking-[0.06em] ${i ? 'text-right' : ''}`}>{h}</span>)}
              </div>
              {r.reachedByWeek.map(w => (
                <div key={w.start} className="grid gap-2 py-3 border-b hair text-[14px] tnum" style={{ gridTemplateColumns: 'minmax(0,1fr) repeat(4, 64px)' }}>
                  <span className="text-ink">{fmtDay(w.start)} to {w.end ? fmtDay(addDays(w.end, -1)) : 'today'}</span>
                  <span className="text-right text-soft">{w.invites}</span>
                  <span className="text-right text-soft">{w.accepted}</span>
                  <span className="text-right text-soft">{w.replies}</span>
                  <span className={`text-right ${w.booked ? 'text-accent-fg font-semibold' : 'text-soft'}`}>{w.booked}</span>
                </div>
              ))}
            </div>
          ) : (
            <PeopleList people={conf.people} />
          )}
        </div>
      )}
    </Sheet>
  );
}

export function PostSheet({ m, postId, edit: editStart, onClose, onReview }: { m: Model; postId: string | null; edit?: boolean; onClose: () => void; onReview: (id: string) => void }) {
  const { statusOf, approve, unapprove, pull, unpull, restore, local, canAct, canApprove, reschedule, setPhoto } = useLocal();
  const { go } = useNav();
  const photos = usePhotos(m.slug);
  const post = m.posts.find(p => p.id === postId) || null;
  const [editing, setEditing] = useState(false);
  const [panel, setPanel] = useState<null | 'move' | 'photo'>(null);
  const [day, setDay] = useState('');
  const [time, setTime] = useState('09:00');
  const [line, setLine] = useState<number | null>(null);
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const clearFocus = useCallback(() => setFocusNote(null), []);
  useEffect(() => {
    setEditing(!!editStart && !!post);
    setPanel(null);
    setLine(null);
  }, [postId, editStart]); // eslint-disable-line

  if (!post) return <Sheet open={false} onClose={onClose} title="">{null}</Sheet>;
  const tz = m.theme.tz;
  const s = statusOf(post);
  const when = whenLabel(post, m);
  const today = dayKey(new Date(), tz);
  const moveDays = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const busyDays = new Set(m.posts.filter(p => p.id !== post.id && p.scheduledAt && (statusOf(p) === 'scheduled')).map(p => dayKey(p.scheduledAt!, tz)));
  const editable = s === 'needs_ok' || s === 'approved' || s === 'buffer' || s === 'scheduled';
  const canEdit = editable && canAct && (m.theme.mode === 'buffer' || canApprove);
  const canPhoto = canEdit && photoSwappable(post.style) && !!photos && photos.length > 0;
  const row = s === 'live' ? m.content.posts.find(r => r.postId === post.id) : undefined;
  const late = s === 'scheduled' && post.scheduledAt && new Date(post.scheduledAt) < new Date();
  const pulled = local.pulled[post.id];
  const openMove = () => {
    const at = post.scheduledAt;
    setDay(at ? dayKey(at, tz) : addDays(today, 1));
    setTime(at ? wallTime(at, tz) : '09:00');
    setPanel(p => (p === 'move' ? null : 'move'));
  };
  const target = day && /^\d{2}:\d{2}$/.test(time) ? wallToUtc(day, time, tz) : '';
  const past = !!target && new Date(target).getTime() < Date.now() + 60_000;
  const same = !!target && !!post.scheduledAt && new Date(target).getTime() === new Date(post.scheduledAt).getTime();
  const targetLabel = target ? (() => { const w = fmtWhen(target, tz); return `${w.day}, ${w.time} ${m.theme.tzLabel}`; })() : '';

  return (
    <Sheet open={!!postId} onClose={onClose} width={1040}
      eyebrow={<>{late ? `Not out yet · was due ${when}` : <>{STATUS_LABEL(s, m)}{when && s !== 'archived' ? ` · ${when}` : ''}</>}</>}
      title={<span className="clamp-2">{post.title}</span>}>
      <div className="pt-5 grid grid-cols-[minmax(0,1fr)] gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
        <div className="min-w-0 grid grid-cols-[minmax(0,1fr)] gap-5 content-start">
          <div className="flex flex-wrap items-center gap-2" data-testid="drawer-actions">
            {s === 'needs_ok' && canApprove && (
              <>
                <button className="btn btn-primary" onClick={() => approve(post.id)} data-testid="drawer-approve">Approve</button>
                <button className="btn btn-outline" onClick={() => onReview(post.id)}>Review with line notes</button>
              </>
            )}
            {s === 'approved' && (
              <div className="flex items-center gap-2.5 h-10 pl-4 pr-1.5 rounded-full bg-wash text-[14px] min-w-0 flex-1">
                <CircleCheck size={17} className="text-accent-fg shrink-0" />
                <span className="font-semibold text-accent-fg">Approved</span>
                <span className="text-soft truncate flex-1 min-w-0 max-sm:hidden">· goes into the next open slot</span>
                {post.status === 'needs_ok' && local.approved[post.id] && <button className="btn btn-text btn-sm ml-auto" onClick={() => unapprove(post.id)}><Undo2 size={14} /> Undo</button>}
              </div>
            )}
            {canEdit && !editing && <button className="btn btn-outline" onClick={() => setEditing(true)} data-testid="drawer-edit"><PenLine size={15} /> Edit</button>}
            {s === 'scheduled' && canEdit && !editing && <button className="btn btn-outline" aria-expanded={panel === 'move'} onClick={openMove} data-testid="drawer-move"><CalendarClock size={15} /> Move</button>}
            {canPhoto && !editing && <button className="btn btn-outline" aria-expanded={panel === 'photo'} onClick={() => setPanel(p => (p === 'photo' ? null : 'photo'))} data-testid="drawer-photo"><ImageIcon size={15} /> {post.image ? 'Change picture' : 'Add a picture'}</button>}
            {(s === 'buffer' || s === 'scheduled') && m.theme.mode === 'buffer' && canAct && !editing && <button className="btn btn-text" onClick={() => pull(post.id)} data-testid="drawer-pull">Pull</button>}
            {s === 'archived' && pulled && (
              <div className="flex items-center gap-2.5 h-10 pl-4 pr-1.5 rounded-full bg-sunk text-[14px] min-w-0 flex-1" data-testid="pulled-receipt">
                <span className="font-semibold text-ink">Pulled</span>
                <span className="text-soft truncate flex-1 min-w-0">· this one stays off LinkedIn</span>
                {pulled === 'pending' && <button className="btn btn-text btn-sm ml-auto" onClick={() => unpull(post.id)}><Undo2 size={14} /> Undo</button>}
              </div>
            )}
            {s === 'archived' && !pulled && canAct && <button className="btn btn-outline" onClick={() => restore(post.id)} data-testid="drawer-restore"><RotateCcw size={15} /> Restore</button>}
            {s === 'live' && post.url && (
              <a className="btn btn-outline" href={post.url} target="_blank" rel="noreferrer">Open on LinkedIn <ExternalLink size={14} /></a>
            )}
          </div>

          {panel === 'move' && (
            <div className="rounded-[14px] border hair p-4" data-testid="move-panel">
              <div className="eyebrow mb-3">Move to · {m.theme.tzLabel === 'PT' ? 'Pacific time' : m.theme.tzLabel === 'UK' ? 'UK time' : `${m.theme.tzLabel} time`}</div>
              <div className="flex flex-wrap gap-1.5">
                {moveDays.map(d => (
                  <button key={d} aria-pressed={day === d} className={`btn btn-sm relative ${day === d ? 'btn-primary' : 'btn-outline'}`} onClick={() => setDay(d)} data-testid="move-day">
                    {d === today ? 'Today' : `${fmtWeekday(d)} ${Number(d.slice(8))}`}
                    {busyDays.has(d) && <span className="absolute top-1 right-1.5 h-1.5 w-1.5 rounded-full" style={{ background: day === d ? 'var(--accent-ink)' : 'var(--accent)' }} aria-label="already has a post" />}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                <label className="text-[13px] text-soft inline-flex items-center gap-2">Time
                  <input type="time" step={900} value={time} onChange={e => setTime(e.target.value)} className="h-9 rounded-full border hair bg-paper px-3 text-[13.5px] text-ink tnum" data-testid="move-time" />
                </label>
                <button className="btn btn-primary btn-sm" disabled={!target || past || same} style={!target || past || same ? { opacity: 0.45 } : undefined}
                  onClick={() => { reschedule(post.id, target, targetLabel); setPanel(null); }} data-testid="move-confirm">
                  {target ? `Move to ${targetLabel}` : 'Move'}
                </button>
              </div>
              <p className="mt-2 text-[12px] text-mute">{past ? 'That time has already passed. Pick a later one.' : busyDays.size ? 'A dot means another post already goes out that day.' : ''}</p>
            </div>
          )}

          {panel === 'photo' && photos && (
            <PhotoPicker photos={photos} current={post.image} onPick={u => { setPhoto(post.id, u); setPanel(null); }} onClose={() => setPanel(null)} />
          )}

          {row && row.measured && (
            <div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-4">
                {([['Impressions', row.impressions], ['Reactions', row.reactions], ['Comments', row.comments], ['Profile views', row.profileViews]] as const).map(([k, v]) => (
                  <div key={k} className="stat !py-0.5 !pl-3.5"><div className="numeral text-[28px]">{fmtInt(v)}</div><div className="text-[12.5px] text-mute mt-1.5">{k}</div></div>
                ))}
              </div>
              <p className="mt-3 text-[12.5px] text-mute">
                {[row.reached ? `Reached ${fmtInt(row.reached)} people` : '', row.outPct != null ? `${row.outPct}% outside your network` : '',
                  row.icp && m.content.icp ? `${row.icp.n} of ${row.icp.of} who engaged ${m.content.icp.mode === 'owners' ? 'own a store' : 'fit your buyer'}` : '']
                  .filter(Boolean).join(' · ')}
                {' '}<button className="link !text-[12.5px]" onClick={() => { onClose(); go('content'); }}>All post numbers <ArrowRight size={12} /></button>
              </p>
            </div>
          )}
          {s === 'live' && (!row || !row.measured) && <p className="text-[13px] text-mute">LinkedIn numbers for this post are not in yet.</p>}

          <LinkedInPost post={post} model={m} editing={editing} onEditDone={() => setEditing(false)} activeLine={line} onLineMarker={setFocusNote} />

          <dl className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-2 gap-x-6 gap-y-3 pt-4 border-t hair">
            {post.source && <div><dt className="text-[12px] text-mute">Where it came from</dt><dd className="text-[14px] text-ink mt-0.5">{post.source}</dd></div>}
            {post.topic && <div><dt className="text-[12px] text-mute">Topic</dt><dd className="text-[14px] text-ink mt-0.5">{post.topic}</dd></div>}
            <div><dt className="text-[12px] text-mute">Format</dt><dd className="text-[14px] text-ink mt-0.5">{[post.format, post.angle].filter(Boolean).join(' · ')}</dd></div>
          </dl>
        </div>
        <aside className="min-w-0 hair max-lg:pt-6 max-lg:border-t lg:border-l lg:pl-8 lg:sticky lg:top-6 self-start">
          <Comments post={post} m={m} onLine={setLine} focusNote={focusNote} onFocused={clearFocus} />
        </aside>
      </div>
    </Sheet>
  );
}
