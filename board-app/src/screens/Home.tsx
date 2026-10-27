import { useState, type ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, CircleCheck, Undo2 } from 'lucide-react';
import type { Model, Post } from '../data/model';
import { ago, dayKey, fmtDay, fmtWeekday, fmtWhen } from '../data/model';
import { intentLabel, intentTone, plural, suffixFor, verbFor } from '../data/copy';
import { fmtInt, needsOk, nextOut, nextSevenDays, reviewMinutes, upcoming, weekDays, whenLabel } from '../data/derive';
import { useLocal } from '../data/store';
import { track } from '../data/track';
import { AnimatedNumber, Sheet, SOFT, SPRING, Thumb } from '../ui/kit';
import { useNav, type PeopleKind } from '../ui/nav';
import { groupActivity } from './Activity';

const todayEyebrow = (m: Model) => {
  const k = dayKey(new Date(), m.theme.tz);
  return `${fmtWeekday(k, 'long')} ${fmtDay(k)} · ${m.theme.tzLabel === 'UK' ? 'London' : m.theme.tzLabel === 'PT' ? 'Pacific time' : m.theme.tzLabel}`;
};

/* One quiet head for every block on Home: small uppercase label, optional "See all" on the right. */
function Head({ children, all, onAll, which }: { children: ReactNode; all?: string; onAll?: () => void; which?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2.5 min-h-[22px]">
      <div className="eyebrow flex items-center gap-2 min-w-0">{children}</div>
      {onAll && <button className="link !text-[12.5px] shrink-0" onClick={() => { track('expand', null, { which: `home:${which || 'see_all'}` }); onAll(); }}>{all || 'See all'} <ArrowRight size={13} /></button>}
    </div>
  );
}
const ROWS = 4;
const ROWS_OUT = 4;
const Count = ({ n }: { n: number }) => <span className="chip !h-[18px] !px-1.5 !text-[10.5px] !tracking-normal">{n}</span>;
const Quiet = ({ children }: { children: ReactNode }) => <p className="text-[13.5px] text-mute py-1">{children}</p>;

/* ---------- Action line ---------- */
function ActionLine() {
  const { model: m, openFocus, openPost, go } = useNav();
  const { statusOf } = useLocal();
  const waiting = needsOk(m, statusOf);
  const next = nextOut(m, statusOf);
  const mode = m.theme.mode;

  let title: ReactNode, sub: ReactNode, actions: ReactNode;
  if (mode === 'buffer') {
    title = next ? <>Next out: {whenLabel(next, m)}</> : <>Nothing set to go out yet</>;
    sub = next ? <><span className="text-ink">{next.title}</span><span className="text-mute"> · goes out on its own unless you pull it</span></> : <>New posts land here as they are written.</>;
    actions = (
      <>
        {next && <button className="btn btn-primary" onClick={() => openPost(next.id)}>Open the post <ArrowRight size={16} /></button>}
        <button className="btn btn-text" onClick={() => go('posts')}>See everything lined up</button>
      </>
    );
  } else if (waiting.length) {
    const who = mode === 'team' ? "your team's OK" : 'your OK';
    title = <>{plural(waiting.length, 'post')} {waiting.length === 1 ? 'needs' : 'need'} {who}</>;
    sub = mode === 'team' ? <>Nothing goes out until your team approves it.</> : <>Nothing goes out until you approve it.</>;
    actions = (
      <button className="btn btn-primary" onClick={() => openFocus(waiting[0].id)} data-testid="review-cta">
        Review {waiting.length} · about {reviewMinutes(waiting.length)} min <ArrowRight size={16} />
      </button>
    );
  } else {
    title = <>Nothing waiting for {mode === 'team' ? "your team's" : 'your'} OK</>;
    sub = next ? <>Next out: {whenLabel(next, m)} · <span className="text-ink">{next.title}</span></> : <>New posts show up here when they are ready for a look.</>;
    actions = next ? <button className="btn btn-outline" onClick={() => openPost(next.id)}>Open the post <ArrowRight size={16} /></button> : null;
  }

  return (
    <div className="min-w-0 flex-1" data-k="action">
      <div className="eyebrow mb-2">{todayEyebrow(m)}</div>
      <h1 className="display text-[28px] sm:text-[32px] leading-[1.12]" data-testid="action-title">{title}</h1>
      <p className="mt-2 text-[14.5px] text-soft clamp-2 max-w-[640px]">{sub}</p>
      {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Results numbers (inline, right side of the top band) ---------- */
function ResultsBand() {
  const { model: m, openPeople, go } = useNav();
  const { statusOf } = useLocal();
  const r = m.results;
  let label: ReactNode;
  let tiles: { key: string; label: string; value: number; on: () => void }[];
  if (m.hasOutreach) {
    label = m.window.label;
    const t: { k: PeopleKind; label: string; value: number | null }[] = [
      { k: 'booked', label: 'Calls booked', value: r.bookedCount },
      { k: 'positive', label: 'Said yes', value: r.positive.length },
      { k: 'replied', label: 'Replied', value: r.repliedCount },
      { k: 'reached', label: r.reachedLabel === 'invited' ? 'Invited' : 'Reached', value: r.reached },
    ];
    tiles = t.filter(x => x.value != null).map(x => ({ key: x.k, label: x.label, value: x.value as number, on: () => openPeople(x.k) }));
  } else {
    // No outreach on this board yet, so the band carries the post numbers instead, in the same window.
    label = m.window.label;
    const out = m.content.posts.filter(p => m.inWindow(p.at));
    const seen = out.reduce((a, p) => a + (p.measured ? p.impressions : 0), 0);
    // Still to go out inside the same window (to the window's last day), so every tile counts one period.
    const end = m.window.kind === 'week' ? m.window.end : null;
    const toGo = upcoming(m, statusOf).filter(p => !end || dayKey(p.scheduledAt!, m.theme.tz) <= end).length;
    tiles = [
      { key: 'live', label: 'Published', value: out.length, on: () => go('content') },
      { key: 'next', label: end ? 'Still to go out' : 'Lined up', value: toGo, on: () => go('posts') },
      ...(seen ? [{ key: 'seen', label: 'Impressions', value: seen, on: () => go('content') }] : []),
    ];
  }
  return (
    <div className="shrink-0 min-w-0" data-k="results">
      <div className="eyebrow mb-2.5">{label}</div>
      <div className={`grid ${tiles.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} sm:grid-cols-4 gap-x-5 gap-y-4`}>
        {tiles.map(t => (
          <button key={t.key} onClick={t.on} className="group text-left stat !py-0.5 !pl-3.5 min-w-0" data-testid={`tile-${t.key}`}>
            <AnimatedNumber value={t.value} className="numeral text-[32px] sm:text-[36px]" />
            <div className="mt-1.5 flex items-center gap-1 text-[12.5px] text-soft whitespace-nowrap">
              {t.label}
              <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity text-mute" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* Results with the sentence, used at the top of the Outreach page. */
export function Results() {
  const { model: m, openPeople } = useNav();
  const r = m.results;
  if (!m.hasOutreach) return null;
  const names = r.booked.map(p => p.name);
  const extra = Math.max(r.bookedCount - names.length, 0);
  const em = (s: string) => <span className="text-ink" style={{ fontWeight: 400 }}>{s}</span>;
  let headline: ReactNode;
  if (r.bookedCount > 0) {
    const shown = names.slice(0, 3);
    const more = names.length - shown.length + extra;
    headline = (
      <>
        {plural(r.bookedCount, 'call')} booked {m.window.short}
        {shown.length > 0 && <>, with {shown.map((n, i) => (
          <span key={n}>{i > 0 && (i === shown.length - 1 && !more ? ' and ' : ', ')}{em(n)}</span>
        ))}{more > 0 && <> and {more} more</>}</>}.
      </>
    );
  } else if (r.repliedCount > 0) {
    headline = <>No calls booked {m.window.short} yet. {plural(r.repliedCount, 'person', 'people')} replied{r.positive.length ? <>, and {em(String(r.positive.length))} said yes</> : null}.</>;
  } else {
    headline = <>Invites are going out. Replies show here as they come in.</>;
  }
  const tiles: { k: PeopleKind; label: string; value: number | null }[] = [
    { k: 'booked', label: 'Calls booked', value: r.bookedCount },
    { k: 'positive', label: 'Said yes', value: r.positive.length },
    { k: 'replied', label: 'Replied', value: r.repliedCount },
    { k: 'reached', label: r.reachedLabel === 'invited' ? 'Invited' : 'Reached', value: r.reached },
  ];
  return (
    <section>
      <h2 className="display text-[20px] sm:text-[22px] leading-[1.3] max-w-[820px]" style={{ color: 'var(--soft)' }} data-testid="results-headline">{headline}</h2>
      <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5">
        {tiles.filter(t => t.value != null).map(t => (
          <button key={t.k} onClick={() => openPeople(t.k)} className="group text-left stat !py-1 !pl-4" data-testid={`tile-${t.k}`}>
            <AnimatedNumber value={t.value as number} className="numeral text-[36px] sm:text-[40px]" />
            <div className="mt-1.5 flex items-center gap-1.5 text-[13px] text-soft">
              {t.label}
              <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity text-mute" />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- Needs your OK ---------- */
function OkRow({ post }: { post: Post }) {
  const { openFocus } = useNav();
  const { statusOf, approve, unapprove, canApprove, local } = useLocal();
  const reduce = useReducedMotion();
  const done = statusOf(post) === 'approved';
  return (
    <motion.li layout={reduce ? false : 'position'} transition={SOFT} className="border-b hair py-2" data-k="row">
      <AnimatePresence mode="popLayout" initial={false}>
        {done ? (
          <motion.div
            key="receipt"
            layoutId={reduce ? undefined : `ok-${post.id}`}
            transition={SPRING}
            className="flex items-center gap-3 h-10 px-4 bg-wash"
            style={{ borderRadius: 999 }}
            data-testid="receipt"
          >
            <CircleCheck size={17} className="text-accent-fg shrink-0" />
            <span className="text-[13.5px] font-semibold text-accent-fg shrink-0">Approved</span>
            <span className="text-[13.5px] text-soft truncate min-w-0 flex-1">
              <span className="max-sm:hidden">· goes into the next open slot · </span><span className="text-mute">{post.title}</span>
            </span>
            {local.approved[post.id] && <button className="btn-text btn btn-sm !h-8 shrink-0" onClick={() => unapprove(post.id)}><Undo2 size={14} /> Undo</button>}
          </motion.div>
        ) : (
          <motion.div key="row" exit={{ opacity: 0, transition: { duration: 0.12 } }} className="grid items-center gap-x-3.5 gap-y-2" style={{ gridTemplateColumns: '40px minmax(0,1fr) auto' }}>
            <button onClick={() => openFocus(post.id)} aria-label={`Open ${post.title}`}><Thumb src={post.image} text={post.hook} size={40} rounded={7} /></button>
            <div className="min-w-0">
              <button onClick={() => openFocus(post.id)} className="text-left text-[14.5px] font-medium text-ink line-clamp-1 max-sm:line-clamp-2 max-sm:leading-snug hover:underline underline-offset-4 decoration-[var(--line-bold)]">{post.title}</button>
              <div className="text-[12.5px] text-mute mt-0.5 truncate">{post.format}{post.source ? ` · ${post.source}` : ''}</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button className={`btn btn-outline btn-sm !h-8 ${canApprove ? 'max-sm:hidden' : ''}`} onClick={() => openFocus(post.id)}>Open</button>
              {canApprove && (
                <motion.button layoutId={reduce ? undefined : `ok-${post.id}`} transition={SPRING} style={{ borderRadius: 999 }} className="btn btn-primary btn-sm !h-8" onClick={() => approve(post.id)} data-testid="approve-inline">
                  Approve
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function NeedsOk() {
  const { model: m, openFocus } = useNav();
  const { statusOf } = useLocal();
  const base = m.posts.filter(p => p.status === 'needs_ok');
  const shown = base.slice(0, ROWS);
  const rest = base.slice(ROWS).filter(p => statusOf(p) === 'needs_ok');
  const left = needsOk(m, statusOf).length;
  return (
    <section data-k="list">
      <Head all="Review all" onAll={left > 0 ? () => openFocus() : undefined} which="review_all">
        Needs {m.theme.mode === 'team' ? "your team's" : 'your'} OK <Count n={left} />
      </Head>
      <LayoutGroup id="ok">
        <ul className="border-t hair">{shown.map(p => <OkRow key={p.id} post={p} />)}</ul>
        {rest.length > 0 && (
          <motion.button layout="position" onClick={() => openFocus(rest[0].id)} className="mt-2.5 text-[13px] text-soft hover:text-ink inline-flex items-center gap-2">
            + {rest.length} more <span className="text-mute">in the review</span>
          </motion.button>
        )}
      </LayoutGroup>
    </section>
  );
}

/* ---------- Going out (next 7 days) ---------- */
function GoingOutRow({ post }: { post: Post }) {
  const { model: m, openPost } = useNav();
  const { statusOf, pull, unpull, local, canAct } = useLocal();
  const reduce = useReducedMotion();
  const buffer = m.theme.mode === 'buffer' && canAct;
  const pulled = statusOf(post) === 'archived';
  const w = fmtWhen(post.scheduledAt!, m.theme.tz);
  const k = dayKey(post.scheduledAt!, m.theme.tz);
  return (
    <motion.li layout={reduce ? false : 'position'} transition={SOFT} className="border-b hair py-2" data-k="row">
      <AnimatePresence mode="popLayout" initial={false}>
        {pulled ? (
          <motion.div key="r" layoutId={reduce ? undefined : `pull-${post.id}`} transition={SPRING} style={{ borderRadius: 999 }} className="flex items-center gap-3 h-10 px-4 bg-sunk">
            <span className="text-[13.5px] font-semibold text-ink shrink-0">Pulled</span>
            <span className="text-[13.5px] text-mute truncate flex-1 min-w-0"><span className="max-sm:hidden">· this one stays off LinkedIn · </span>{post.title}</span>
            {local.pulled[post.id] === 'pending' && <button className="btn btn-text btn-sm !h-8 shrink-0" onClick={() => unpull(post.id)} data-testid="pull-undo"><Undo2 size={14} /> Undo</button>}
          </motion.div>
        ) : (
          <motion.div key="row" exit={{ opacity: 0, transition: { duration: 0.12 } }} className="going-row grid items-center gap-x-3.5 gap-y-2">
            <div className="text-center">
              <div className="eyebrow !text-[10px] !tracking-[0.12em]">{fmtWeekday(k)}</div>
              <div className="numeral text-[20px] mt-0.5">{Number(k.slice(8))}</div>
            </div>
            <button onClick={() => openPost(post.id)} aria-label={`Open ${post.title}`} className="max-sm:hidden"><Thumb src={post.image} text={post.hook} size={40} rounded={7} /></button>
            <div className="min-w-0">
              <button onClick={() => openPost(post.id)} className="text-left text-[14.5px] font-medium text-ink line-clamp-1 max-sm:line-clamp-2 max-sm:leading-snug hover:underline underline-offset-4 decoration-[var(--line-bold)]">{post.title}</button>
              <div className="text-[12.5px] text-mute mt-0.5 truncate">{w.time} {m.theme.tzLabel} · {post.format}</div>
            </div>
            <div className="flex items-center gap-1">
              {buffer ? (
                <>
                  <button className="btn btn-outline btn-sm !h-8" onClick={() => openPost(post.id, true)}>Edit</button>
                  <motion.button layoutId={reduce ? undefined : `pull-${post.id}`} transition={SPRING} style={{ borderRadius: 999 }} className="btn btn-text btn-sm !h-8" onClick={() => pull(post.id)} data-testid="pull-inline">Pull</motion.button>
                </>
              ) : (
                <button className="btn btn-outline btn-sm !h-8" onClick={() => openPost(post.id)}>Open</button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

function GoingOut() {
  const { model: m, go } = useNav();
  const { statusOf } = useLocal();
  // Membership uses the board's status so a pulled row stays in place as a receipt.
  const list = nextSevenDays(m, p => p.status).filter(p => statusOf(p) === 'scheduled' || statusOf(p) === 'archived');
  const more = list.length - ROWS_OUT;
  return (
    <section data-k="list">
      <Head all="All posts" onAll={() => go('posts')} which="going_out">Going out · next 7 days <Count n={list.length} /></Head>
      {list.length ? (
        <LayoutGroup id="going">
          <ul className="border-t hair">{list.slice(0, ROWS_OUT).map(p => <GoingOutRow key={p.id} post={p} />)}</ul>
          {more > 0 && <button onClick={() => go('posts')} className="mt-2 text-[13px] text-soft hover:text-ink">+ {more} more <span className="text-mute">on Posts</span></button>}
        </LayoutGroup>
      ) : (
        <Quiet>Nothing is set for the next 7 days.</Quiet>
      )}
    </section>
  );
}

/* ---------- This week strip ---------- */
function WeekStrip() {
  const { model: m, openPost, go } = useNav();
  const { statusOf } = useLocal();
  const days = weekDays(m, statusOf);
  const any = days.some(d => d.posts.length);
  const wkLabel = `${fmtDay(days[0].day)} to ${fmtDay(days[6].day)}`;
  return (
    <section data-k="week">
      <Head all="All posts" onAll={() => go('posts')} which="week">This week · {wkLabel}</Head>
      {!any ? (
        <Quiet>Nothing is set to go out this week yet.{m.theme.mode !== 'buffer' && ' Approved posts go into the next open slot.'}</Quiet>
      ) : (
        <div className="flex gap-2.5 overflow-x-auto scroll-quiet -mx-5 px-5 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0 lg:overflow-visible lg:grid" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
          {days.map(d => {
            const p = d.posts[0];
            const s = p ? statusOf(p) : null;
            return (
              <button
                key={d.day}
                disabled={!p}
                onClick={() => p && openPost(p.id)}
                title={p?.title}
                aria-label={p ? `${fmtWeekday(d.day, 'long')}: ${p.title}` : undefined}
                className={`day-tile ${d.isToday ? 'day-today' : ''} text-left min-w-0 max-lg:w-[84px] max-lg:shrink-0 pt-2 group flex flex-col justify-start`}
              >
                <div className={`flex items-baseline gap-1.5 mb-1.5 ${d.isToday ? 'text-accent-fg' : p ? 'text-soft' : 'text-mute'}`}>
                  <span className="eyebrow !text-[10.5px] !tracking-[0.12em]" style={{ color: 'inherit' }}>{fmtWeekday(d.day).slice(0, 3)}</span>
                  <span className="text-[11.5px] tnum">{Number(d.day.slice(8))}</span>
                </div>
                {p ? (
                  <div className="transition-opacity group-hover:opacity-85" style={{ height: 76 }}>
                    <Thumb src={p.image} text={p.hook} size="fill" ratio="auto" rounded={8} className="h-full" />
                  </div>
                ) : (
                  <div className="rounded-[8px] border border-dashed hair" style={{ height: 76, opacity: d.isPast ? 0.35 : 0.6 }} />
                )}
                <div className="mt-1 h-4 text-[11px] text-mute tnum">
                  {p ? <>{s === 'live' ? 'Live' : new Date(p.scheduledAt!) < new Date() ? 'Not out yet' : `${fmtWhen(p.scheduledAt!, m.theme.tz).time} ${m.theme.tzLabel}`}{d.posts.length > 1 ? ` · +${d.posts.length - 1}` : ''}</> : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ---------- Side panels ---------- */
function OutreachMini() {
  const { model: m, go } = useNav();
  const f = m.funnel;
  if (!m.hasOutreach || !f) {
    return (
      <section data-k="outreach">
        <Head onAll={() => go('outreach')}>Outreach</Head>
        <Quiet>No outreach numbers yet.</Quiet>
      </section>
    );
  }
  const max = Math.max(f.steps[0]?.value || 0, 1);
  return (
    <section data-k="outreach">
      <Head onAll={() => go('outreach')} which="outreach">Outreach · {m.window.short}</Head>
      <div className="grid gap-y-1.5" style={{ gridTemplateColumns: '96px minmax(0,1fr) 54px 38px', columnGap: 10 }}>
        {f.steps.map((s, i) => {
          const prev = i > 0 ? f.steps[i - 1].value : 0;
          const pct = i > 0 && prev && s.value <= prev ? Math.round((s.value / prev) * 100) : null;
          return (
            <div key={s.label} className="contents">
              <span className="text-[12.5px] text-soft truncate self-center">{s.label}</span>
              <span className="self-center h-[6px] rounded-full bg-sunk overflow-hidden">
                <span className="block h-full rounded-full" style={{ width: `${s.value ? Math.max((s.value / max) * 100, 1.5) : 0}%`, background: 'color-mix(in srgb, var(--accent) 80%, var(--paper))' }} />
              </span>
              <span className="numeral text-[17px] text-right self-center">{fmtInt(s.value)}</span>
              <span className="text-[11.5px] text-mute text-right tnum self-center">{pct != null ? `${pct}%` : ''}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PeopleMini() {
  const { model: m, go } = useNav();
  // Same period as every other number on the page: people who replied or booked inside the window.
  const inWin = m.people.filter(p => m.inWindow(p.when));
  const list = inWin.slice(0, 4);
  return (
    <section data-k="people">
      <Head onAll={() => go('outreach')} which="people">People · {m.window.short} <Count n={inWin.length} /></Head>
      {!list.length ? <Quiet>Nobody new {m.window.short} yet. Everyone so far is on Outreach.</Quiet> : (
        <ul className="border-t hair">
          {list.map(p => {
            const tone = intentTone(p.intent);
            return (
              <li key={p.name + p.when} className="flex items-baseline gap-3 py-2 border-b hair min-w-0">
                <div className="min-w-0 flex-1 truncate">
                  <span className="text-[14px] text-ink">{p.name}</span>
                  {p.company && <span className="text-[12.5px] text-mute"> · {p.company}</span>}
                </div>
                <span className="text-[12px] font-semibold shrink-0" style={{ color: tone === 'accent' ? 'var(--accent-fg)' : tone === 'mute' ? 'var(--mute)' : 'var(--soft)' }}>{intentLabel(p.intent)}</span>
                <span className="text-[12px] text-mute tnum shrink-0 w-[74px] text-right">{ago(p.when)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LeadMagnetsMini({ onAll }: { onAll: () => void }) {
  const { model: m } = useNav();
  const list = [...m.leadMagnets].sort((a, b) => Number(b.statusRaw === 'live') - Number(a.statusRaw === 'live')).slice(0, 2);
  return (
    <section>
      <Head onAll={m.leadMagnets.length > list.length ? onAll : undefined} which="lead_magnets">Lead magnets <Count n={m.leadMagnets.length} /></Head>
      {!list.length ? <Quiet>No free resources yet.</Quiet> : (
        <ul className="border-t hair">
          {list.map(l => (
            <li key={l.id} className="flex items-baseline gap-3 py-2 border-b hair">
              <a href={l.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 text-[13.5px] text-ink truncate hover:underline underline-offset-4 decoration-[var(--line-bold)]">{l.title}</a>
              {l.optins != null && Number(l.optins) > 0 && <span className="text-[12px] text-mute tnum shrink-0">{plural(Number(l.optins), 'opt-in')}</span>}
              <span className={`text-[12px] shrink-0 ${l.statusRaw === 'live' ? 'text-accent-fg font-semibold' : 'text-mute'}`}>{l.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* One quiet line of content numbers. The full picture lives on the Content page. */
function ContentMini() {
  const { model: m, go } = useNav();
  const c = m.content;
  // The board's window only: the same period as every other panel. The full history lives on Content.
  const rows = c.posts.filter(p => m.inWindow(p.at));
  const measured = rows.filter(p => p.measured);
  const imp = measured.reduce((a, p) => a + p.impressions, 0);
  const pv = measured.reduce((a, p) => a + p.profileViews, 0);
  const last = c.posts[0];
  return (
    <section data-k="content">
      <Head onAll={() => go('content')} which="content">Content · {m.window.short}</Head>
      <div className="border-t hair pt-2.5 text-[13.5px] text-soft leading-snug" data-testid="content-line">
        {measured.length ? (
          <><span className="numeral text-[18px] text-head">{rows.length}</span> {rows.length === 1 ? 'post' : 'posts'} out <span className="text-mute">·</span> <span className="numeral text-[18px] text-head">{fmtInt(imp)}</span> impressions{pv > 0 && <> <span className="text-mute">·</span> <span className="numeral text-[18px] text-head">{fmtInt(pv)}</span> profile views</>}</>
        ) : rows.length ? (
          <>{plural(rows.length, 'post')} out {m.window.short}. LinkedIn numbers are not in yet.</>
        ) : (
          <span className="text-mute">Nothing out {m.window.short} yet.{last ? ` The last post went out ${fmtWhen(last.at, m.theme.tz).day}.` : ''}</span>
        )}
      </div>
    </section>
  );
}

function ChangesMini() {
  const { model: m, go } = useNav();
  const titleOf = (id?: string, t?: string) => t || m.posts.find(p => p.id === id)?.title;
  // Several edits by one person to one post on one day read as one line ("moved and changed the picture on").
  const rows: { lead: ReturnType<typeof groupActivity>[number]['lead']; all: ReturnType<typeof groupActivity>[number]['all']; verbs: string[] }[] = [];
  for (const g of groupActivity(m)) {
    const prev = rows[rows.length - 1];
    const same = prev && g.all.length === 1 && prev.all.length >= 1 && prev.lead.by === g.lead.by && prev.lead.ref && prev.lead.ref === g.lead.ref
      && dayKey(prev.lead.at, m.theme.tz) === dayKey(g.lead.at, m.theme.tz);
    const v = g.lead.action === 'set_schedule' && !g.lead.after && g.all.length === 1 ? 'unscheduled' : verbFor(g.lead.action);
    if (same) { if (!prev.verbs.includes(v)) prev.verbs.push(v); }
    else rows.push({ ...g, verbs: [v] });
    if (rows.length > 3) break;
  }
  rows.length = Math.min(rows.length, 3);
  const joinVerbs = (v: string[]) => {
    // "moved" + "changed the picture on" -> "moved and changed the picture on"; trailing prepositions stay on the last verb only.
    const bare = v.map((x, i) => (i < v.length - 1 ? x.replace(/ (on|to)$/, '') : x));
    return bare.length === 1 ? bare[0] : bare.slice(0, -1).join(', ') + ' and ' + bare[bare.length - 1];
  };
  return (
    <section>
      <Head onAll={() => go('activity')} which="changes">Changes log</Head>
      {!rows.length ? <Quiet>No changes recorded yet.</Quiet> : (
        <ul className="border-t hair">
          {rows.map(({ lead: a, all, verbs }) => (
            <li key={a.id} className="flex items-baseline gap-3 py-2 border-b hair">
              <p className="min-w-0 flex-1 text-[13px] leading-[1.45] text-mute truncate">
                <span className="text-ink font-semibold">{a.by}</span> {joinVerbs(verbs)}{' '}
                <span className="text-soft">{all.length > 1 ? plural(all.length, 'post') : titleOf(a.ref, a.title) || 'a post'}</span>
                {suffixFor(a.action) && <> {suffixFor(a.action)}</>}
              </p>
              <span className="text-[12px] text-mute tnum shrink-0">{ago(a.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------- Drawer bodies (the full lists behind "See all") ---------- */
function LeadMagnets({ m }: { m: Model }) {
  return (
    <div className="grid gap-x-5 gap-y-7 grid-cols-1 sm:grid-cols-2">
      {m.leadMagnets.map(l => (
        <a key={l.id} href={l.url} target="_blank" rel="noreferrer" className="group min-w-0 block">
          <Thumb src={l.cover} text={l.title} size="fill" ratio="16 / 10" rounded={10} />
          <div className="mt-2.5 text-[14.5px] text-ink font-medium clamp-2 group-hover:underline underline-offset-4 decoration-[var(--line-bold)]">{l.title}</div>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className={`chip ${l.statusRaw === 'live' ? 'chip-accent' : ''}`}>{l.status}</span>
            {l.optins != null && <span className="text-[12.5px] text-mute tnum">{plural(Number(l.optins), 'opt-in')}</span>}
          </div>
        </a>
      ))}
    </div>
  );
}

type Drawer = 'lm';

export function Home() {
  const { model: m } = useNav();
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  // Boards that approve show the waiting list; when nothing waits, or the board runs on its own, show what goes out next.
  const showOk = m.theme.mode !== 'buffer' && m.posts.some(p => p.status === 'needs_ok');
  // The week strip only earns its space beside the waiting list; with nothing waiting, "Going out" already lists the week.
  const { statusOf } = useLocal();
  const showWeek = showOk && weekDays(m, statusOf).some(d => d.posts.length);
  const openDrawer = (d: Drawer) => { track('expand', null, { which: `home:${d}` }); setDrawer(d); };
  const drawerConf: Record<Drawer, { title: string; body: ReactNode; width?: number }> = {
    lm: { title: plural(m.leadMagnets.length, 'lead magnet'), body: <LeadMagnets m={m} /> },
  };
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8 pt-6 lg:pt-7 pb-16 lg:pb-8">
      {/* Phone: one column in reading order. Desktop: a top band, then main (~62%) and side (~38%) columns, one screen. */}
      <div className="flex flex-col gap-7 lg:grid lg:gap-x-12 lg:gap-y-7 lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]">
        <section className="order-1 lg:order-none lg:col-span-2 grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)] lg:items-start gap-x-12 gap-y-6">
          <ActionLine />
          <ResultsBand />
        </section>
        <div className="contents lg:flex lg:flex-col lg:gap-6 min-w-0">
          <div className="order-3 lg:order-none min-w-0">{showOk ? <NeedsOk /> : <GoingOut />}</div>
          {showWeek && <div className="order-4 lg:order-none min-w-0"><WeekStrip /></div>}
          <div className="order-6 lg:order-none min-w-0"><ContentMini /></div>
          {m.hasOutreach && m.leadMagnets.length > 0 && <div className="order-8 lg:order-none min-w-0"><LeadMagnetsMini onAll={() => openDrawer('lm')} /></div>}
        </div>
        <aside className="contents lg:flex lg:flex-col lg:gap-5 min-w-0">
          {m.hasOutreach && <div className="order-7 lg:order-none min-w-0"><OutreachMini /></div>}
          {m.hasOutreach && <div className="order-5 lg:order-none min-w-0"><PeopleMini /></div>}
          {/* Without outreach the side column has room, so the lead magnets sit there. */}
          {!m.hasOutreach && m.leadMagnets.length > 0 && <div className="order-8 lg:order-none min-w-0"><LeadMagnetsMini onAll={() => openDrawer('lm')} /></div>}
          <div className="order-9 lg:order-none min-w-0"><ChangesMini /></div>
        </aside>
      </div>
      <Sheet open={!!drawer} onClose={() => setDrawer(null)} title={drawer ? drawerConf[drawer].title : ''} width={drawer ? drawerConf[drawer].width : undefined}>
        <div className="pt-5">{drawer && drawerConf[drawer].body}</div>
      </Sheet>
    </div>
  );
}
