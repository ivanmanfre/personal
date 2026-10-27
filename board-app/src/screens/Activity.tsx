import { Fragment } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Archive, ArrowRightLeft, Check, MessageSquareText, PenLine, RotateCcw } from 'lucide-react';
import type { Activity as Act, Model } from '../data/model';
import { addDays, dayKey, fmtDay, fmtWeekday, fmtWhen } from '../data/model';
import { actKind, plural, verbFor } from '../data/copy';
import { archived } from '../data/derive';
import { useLocal } from '../data/store';
import { Avatar, SectionHead, Thumb } from '../ui/kit';
import { useNav } from '../ui/nav';

const BADGE = { ok: Check, edit: PenLine, note: MessageSquareText, move: ArrowRightLeft, out: Archive };

function detail(a: Act, tz: string, tzLabel: string) {
  if (a.action === 'set_schedule' && typeof a.after === 'string' && a.after) {
    const w = fmtWhen(a.after, tz);
    return `to ${w.day}, ${w.time} ${tzLabel}`;
  }
  if ((a.action === 'note' || a.action === 'comment') && (a.note || a.text)) return `"${String(a.note || a.text).slice(0, 140)}"`;
  return '';
}

/* timeline-3 move: day groups with centred TODAY / YESTERDAY dividers, a thread between avatars,
   a small action badge on each avatar, and "who did what to which post" with weight contrast. */
// Collapse bursts: the same person doing the same thing within ten minutes reads as one line.
export function groupActivity(m: Model) {
  const tz = m.theme.tz;
  const sorted = [...m.activity].sort((a, b) => b.at.localeCompare(a.at));
  const rows: { lead: Act; all: Act[] }[] = [];
  for (const a of sorted) {
    const r = rows[rows.length - 1];
    if (r && r.lead.by === a.by && r.lead.action === a.action && a.action !== 'set_schedule' && a.action !== 'note' && a.action !== 'comment'
      && dayKey(r.lead.at, tz) === dayKey(a.at, tz) && Math.abs(new Date(r.all[r.all.length - 1].at).getTime() - new Date(a.at).getTime()) < 10 * 60e3) r.all.push(a);
    else rows.push({ lead: a, all: [a] });
  }
  return rows;
}

export function Timeline({ limit }: { limit?: number }) {
  const { model: m } = useNav();
  const reduce = useReducedMotion();
  const tz = m.theme.tz;
  const titleOf = (a: Act) => a.title || m.posts.find(p => p.id === a.ref)?.title;
  const rows = groupActivity(m);
  const shown = rows.slice(0, limit ?? rows.length);
  if (!shown.length) return <p className="text-[15px] text-mute">No changes recorded yet.</p>;
  const today = dayKey(new Date(), tz);
  const label = (k: string) => (k === today ? 'Today' : k === addDays(today, -1) ? 'Yesterday' : `${fmtWeekday(k)} ${fmtDay(k)}`);
  const groups: { day: string; rows: typeof rows }[] = [];
  for (const r of shown) {
    const k = dayKey(r.lead.at, tz);
    const g = groups[groups.length - 1];
    if (g && g.day === k) g.rows.push(r); else groups.push({ day: k, rows: [r] });
  }
  return (
    <div>
      {groups.map((g, gi) => (
        <Fragment key={g.day}>
          <div className={`flex items-center gap-4 ${gi ? 'mt-6' : ''} mb-3`}>
            <span className="h-px flex-1 bg-line" />
            <span className="eyebrow">{label(g.day)}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <ol className="relative">
            {g.rows.map(({ lead: a, all }, i) => {
              const Badge = BADGE[actKind(a.action)];
              const d = detail(a, tz, m.theme.tzLabel);
              const last = i === g.rows.length - 1;
              const titles = [...new Set(all.map(titleOf).filter(Boolean))] as string[];
              const many = all.length > 1;
              const unscheduled = a.action === 'set_schedule' && !a.after && !many;
              return (
                <motion.li
                  key={a.id}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(gi * 3 + i, 10) * 0.03 }}
                  className="relative flex gap-3.5 pb-4"
                >
                  {!last && <span className="absolute left-[17px] top-10 bottom-0 w-px bg-line" aria-hidden />}
                  <span className="relative shrink-0">
                    <Avatar name={a.by === 'Your content team' ? 'Content Team' : a.by} size={34} tone={a.by === 'You' || a.by === m.founder.first ? 'accent' : 'plain'} />
                    <span className="absolute -right-1 -bottom-1 h-[18px] w-[18px] rounded-full inline-flex items-center justify-center bg-paper border hair text-soft">
                      <Badge size={10} strokeWidth={2.2} />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1 pt-[6px]">
                    <p className="text-[14px] leading-[1.5] text-mute">
                      <span className="text-ink font-semibold">{a.by}</span> {unscheduled ? 'took' : verbFor(a.action)}{' '}
                      <span className="text-ink">{many ? plural(all.length, 'post') : titles[0] || 'a post'}</span>
                      {unscheduled ? <span> off the schedule</span> : d && <span> {d}</span>}
                    </p>
                    {many && titles.length > 0 && (
                      <p className="text-[12.5px] text-mute mt-1 clamp-2">{titles.slice(0, 3).join(' · ')}{titles.length > 3 ? ` · and ${titles.length - 3} more` : ''}</p>
                    )}
                  </div>
                  <span className="text-[12px] text-mute tnum pt-[7px] shrink-0">{fmtWhen(a.at, tz).time}</span>
                </motion.li>
              );
            })}
          </ol>
        </Fragment>
      ))}
    </div>
  );
}

export function ArchiveList() {
  const { model: m, openPost } = useNav();
  const { statusOf, restore, unpull, local, canAct } = useLocal();
  const base = m.posts.filter(p => p.status === 'archived' || local.pulled[p.id]);
  const list = archived(m, statusOf);
  return (
    <div>
      <SectionHead eyebrow={<>Archive · {plural(list.length, 'post')}</>} />
      {!base.length ? <p className="text-[15px] text-mute">Nothing archived.</p> : (
        <ul className="border-t hair">
          {base.map(p => {
            const back = statusOf(p) !== 'archived';
            return (
              <li key={p.id} className="flex items-center gap-3.5 py-3 border-b hair">
                <button onClick={() => openPost(p.id)} className="shrink-0" aria-label={`Open ${p.title}`}><Thumb src={p.image} text={p.hook} size={44} rounded={8} /></button>
                <div className="min-w-0 flex-1">
                  <button onClick={() => openPost(p.id)} className={`text-left text-[14.5px] truncate block max-w-full ${back ? 'text-mute line-through decoration-[var(--line-bold)]' : 'text-ink'}`}>{p.title}</button>
                  <div className="text-[12.5px] text-mute">{back ? 'Restored to the board' : local.pulled[p.id] ? 'Pulled just now' : p.archivedAt ? `Archived ${fmtWhen(p.archivedAt, m.theme.tz).day}` : 'Archived'}</div>
                </div>
                {!back && canAct && (local.pulled[p.id]
                  ? local.pulled[p.id] === 'pending' && <button className="btn btn-outline btn-sm shrink-0" onClick={() => unpull(p.id)}><RotateCcw size={14} /> Undo</button>
                  : <button className="btn btn-outline btn-sm shrink-0" onClick={() => restore(p.id)}><RotateCcw size={14} /> Restore</button>)}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ActivityPage() {
  const { model: m } = useNav();
  return (
    <div className="mx-auto w-full max-w-[820px] px-5 sm:px-8 pt-6 sm:pt-8 pb-20">
      <div className="eyebrow mb-2">Everything that changed on your board</div>
      <h1 className="display text-[28px] sm:text-[32px] mb-6">Changes log</h1>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-10">
        <Timeline />
        <div><ArchiveList /></div>
      </div>
      {m.activity.length >= 50 && <p className="mt-10 text-[13px] text-mute">Showing the latest 50 changes.</p>}
    </div>
  );
}
