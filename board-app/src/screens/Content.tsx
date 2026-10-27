import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown, ExternalLink } from 'lucide-react';
import type { Model } from '../data/model';
import { fmtDay, fmtWhen } from '../data/model';
import { contentTotals, whoSaw, type ContentPost } from '../data/content';
import { plural } from '../data/copy';
import { fmtInt } from '../data/derive';
import { AnimatedNumber, SPRING, Thumb, useIsPhone } from '../ui/kit';
import { useNav } from '../ui/nav';
import { track } from '../data/track';

type Range = 'win' | 'all';

/* The board's time window, or every measured post with its first date written out. */
function contentRange(m: Model, r: Range) {
  const c = m.content;
  const first = c.firstAt ? fmtDay(c.firstAt.slice(0, 10)) : '';
  const rows = r === 'win' ? c.posts.filter(p => m.inWindow(p.at)) : c.posts;
  return {
    rows,
    label: r === 'win' ? m.window.label : `Since ${first}`,
    short: r === 'win' ? m.window.short : `since ${first}`,
    toggle: r === 'win' ? m.window.toggle : `Since ${first}`,
  };
}

/* Opens on the board's window, unless nothing went out in it yet. */
function defaultRange(m: Model): Range {
  return m.content.posts.some(p => m.inWindow(p.at)) ? 'win' : 'all';
}

const pct = (v: number) => `${v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)}%`;

function Tile({ label, value, sub, text }: { label: string; value?: number; sub?: string; text?: string }) {
  return (
    <div className="stat !py-0.5 !pl-3.5 min-w-0" data-testid="content-tile">
      {text != null ? <span className="numeral text-[28px] sm:text-[30px]">{text}</span> : <AnimatedNumber value={value || 0} className="numeral text-[28px] sm:text-[30px]" />}
      <div className="mt-1.5 text-[12.5px] text-soft leading-tight">{label}</div>
      {sub && <div className="text-[11.5px] text-mute mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

function Bars({ title, rows }: { title: string; rows: { label: string; pct: number }[] }) {
  const reduce = useReducedMotion();
  if (!rows.length) return null;
  const max = Math.max(...rows.map(r => r.pct), 1);
  return (
    <div>
      <div className="text-[12.5px] font-semibold text-ink mb-2">{title}</div>
      <div className="grid gap-y-1.5" style={{ gridTemplateColumns: 'minmax(0, 150px) minmax(0,1fr) 40px', columnGap: 10 }}>
        {rows.map((r, i) => (
          <div key={r.label} className="contents">
            <span className="text-[12.5px] text-soft truncate self-center" title={r.label}>{r.label}</span>
            <span className="self-center h-[6px] rounded-full bg-sunk overflow-hidden">
              <motion.span className="block h-full rounded-full bar-x" style={{ width: `${(r.pct / max) * 100}%`, background: 'color-mix(in srgb, var(--accent) 80%, var(--paper))' }}
                initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ ...SPRING, delay: i * 0.03 }} />
            </span>
            <span className="text-[12px] text-mute text-right tnum self-center">{pct(r.pct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Detail({ r, m }: { r: ContentPost; m: Model }) {
  const { openPost } = useNav();
  const facts: [string, string][] = [];
  const icp = m.content.icp;
  if (icp && r.icp) facts.push([icp.mode === 'owners' ? 'Store owners among engagers' : 'Engagers who fit your buyer', `${r.icp.n} of ${r.icp.of}`]);
  facts.push(['Profile views', fmtInt(r.profileViews)]);
  if (r.reached) facts.push(['People reached', fmtInt(r.reached)]);
  if (r.outPct != null) facts.push(['Outside your network', `${r.outPct}%`]);
  facts.push(['Reposts', fmtInt(r.reposts)]);
  facts.push(['New followers', fmtInt(r.followers)]);
  if (r.inboundDms != null) facts.push(['Messages after the post', fmtInt(r.inboundDms)]);
  if (r.named48 != null) facts.push(['Named profile viewers, first 48h', fmtInt(r.named48)]);
  if (r.lookedUp48 != null) facts.push(['Store owners who looked you up, first 48h', fmtInt(r.lookedUp48)]);
  if (r.buyerDms48 != null) facts.push(['Buyer messages, first 48h', fmtInt(r.buyerDms48)]);
  if (r.ledToCall) facts.push(['Calls booked after engaging', fmtInt(r.ledToCall)]);
  const roles = r.demo?.job_title.slice(0, 3).map(x => `${x.label} ${x.pct}%`).join(' · ');
  const sen = r.demo?.seniority.slice(0, 3).map(x => `${x.label} ${x.pct}%`).join(' · ');
  return (
    <div className="pb-4 pt-1 pl-[52px] max-sm:pl-0">
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2.5">
        {facts.map(([k, v]) => (
          <div key={k} className="min-w-0"><dt className="text-[11.5px] text-mute leading-tight">{k}</dt><dd className="text-[14px] text-ink tnum mt-0.5">{v}</dd></div>
        ))}
      </dl>
      {(roles || sen) && (
        <div className="mt-3 grid gap-1 text-[12.5px] text-soft">
          {roles && <p><span className="text-mute">Top viewer roles:</span> {roles}</p>}
          {sen && <p><span className="text-mute">Seniority:</span> {sen}</p>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {r.postId && <button className="btn btn-outline btn-sm" onClick={() => openPost(r.postId!)}>Open the post</button>}
        {r.url && <a className="btn btn-text btn-sm" href={r.url} target="_blank" rel="noreferrer">On LinkedIn <ExternalLink size={13} /></a>}
      </div>
      <p className="sr-only">{fmtWhen(r.at, m.theme.tz).day}</p>
    </div>
  );
}

function PostTable({ rows, m }: { rows: ContentPost[]; m: Model }) {
  const phone = useIsPhone();
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const icp = m.content.icp;
  const LIM = 12;
  const list = all ? rows : rows.slice(0, LIM);
  const best = Math.max(...rows.map(r => r.impressions), 0);
  const anyMeasured = rows.some(r => r.measured);
  const cols = anyMeasured ? ['Seen', 'Reactions', 'Comments', 'Profile views', ...(icp ? [icp.label] : [])] : [];
  const tpl = anyMeasured ? `minmax(0,1fr) repeat(4, 84px)${icp ? ' 104px' : ''} 20px` : 'minmax(0,1fr) 20px';
  if (!rows.length) return <p className="text-[14px] text-mute py-2">Nothing went out in this range.</p>;
  return (
    <div>
      {!phone && anyMeasured && (
        <div className="grid items-end gap-2 pb-2 border-b hair" style={{ gridTemplateColumns: tpl }}>
          <span className="eyebrow">Post</span>
          {cols.map(c => <span key={c} className="eyebrow text-right !tracking-[0.06em] leading-tight">{c}</span>)}
          <span />
        </div>
      )}
      <ul className={anyMeasured ? '' : 'border-t hair'}>
        {list.map(r => {
          const isOpen = open === r.key;
          const day = fmtWhen(r.at, m.theme.tz).day;
          return (
            <li key={r.key} className="border-b hair">
              <button type="button" onClick={() => { if (!isOpen) track('expand', r.postId || null, { which: 'content_row' }); setOpen(isOpen ? null : r.key); }} aria-expanded={isOpen}
                className="w-full text-left grid items-center gap-2 py-2.5 group" style={phone ? undefined : { gridTemplateColumns: tpl }} data-testid="content-row">
                <div className="flex items-center gap-3 min-w-0">
                  <Thumb src={r.image} text={r.hook} size={40} rounded={7} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] text-ink truncate group-hover:underline underline-offset-4 decoration-[var(--line-bold)]">{r.title}</div>
                    <div className="text-[12px] text-mute flex items-center gap-2 min-w-0">
                      <span className="shrink-0">{day}</span>
                      {r.measured && r.impressions === best && rows.length > 1 && best > 0 && <span className="chip chip-accent !h-[17px] !px-1.5 !text-[10px]">Most seen</span>}
                      {phone && r.measured && <span className="truncate">{fmtInt(r.impressions)} seen · {plural(r.reactions, 'reaction')} · {plural(r.comments, 'comment')}</span>}
                      {!r.measured && (phone || !anyMeasured) && <span className="truncate">· LinkedIn numbers not in yet</span>}
                    </div>
                  </div>
                  {phone && <ChevronDown size={15} className={`text-mute shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
                </div>
                {!phone && anyMeasured && (r.measured ? (
                  <>
                    <span className="text-right tnum text-[13.5px] text-ink">{fmtInt(r.impressions)}</span>
                    <span className="text-right tnum text-[13.5px] text-soft">{fmtInt(r.reactions)}</span>
                    <span className="text-right tnum text-[13.5px] text-soft">{fmtInt(r.comments)}</span>
                    <span className="text-right tnum text-[13.5px] text-soft">{fmtInt(r.profileViews)}</span>
                    {icp && <span className={`text-right tnum text-[13.5px] ${r.icp?.n ? 'text-accent-fg font-semibold' : 'text-soft'}`}>{r.icp ? `${r.icp.n} of ${r.icp.of}` : <span className="text-mute">·</span>}</span>}
                  </>
                ) : (
                  <span className="text-right text-[12px] text-mute" style={{ gridColumn: `span ${cols.length}` }}>Not measured yet</span>
                ))}
                {!phone && <ChevronDown size={15} className={`justify-self-end text-mute transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
              </button>
              {isOpen && (r.measured ? <Detail r={r} m={m} /> : (
                <div className="pb-4 pl-[52px] max-sm:pl-0 text-[13px] text-mute">
                  LinkedIn numbers for this post are not in yet.
                  {r.postId && <> <OpenLink id={r.postId} /></>}
                </div>
              ))}
            </li>
          );
        })}
      </ul>
      {rows.length > LIM && (
        <button className="btn btn-outline btn-sm mt-4" onClick={() => { if (!all) track('expand', null, { which: 'content_all_posts' }); setAll(a => !a); }}>{all ? 'Show fewer' : `Show all ${rows.length}`}</button>
      )}
    </div>
  );
}

function OpenLink({ id }: { id: string }) {
  const { openPost } = useNav();
  return <button className="link !text-[13px]" onClick={() => openPost(id)}>Open the post <ArrowRight size={13} /></button>;
}

function Side({ title, children, note }: { title: ReactNode; children: ReactNode; note?: ReactNode }) {
  return (
    <section>
      <div className="eyebrow mb-3">{title}</div>
      {children}
      {note && <p className="mt-2.5 text-[11.5px] text-mute leading-snug">{note}</p>}
    </section>
  );
}

export function ContentPage() {
  const { model: m } = useNav();
  const c = m.content;
  const [range, setRange] = useState<Range>(() => defaultRange(m));
  const R = contentRange(m, range);
  const hasBoth = !!c.firstAt && c.posts.some(p => !m.inWindow(p.at));
  const t = useMemo(() => contentTotals(R.rows, c.icp?.mode ?? null), [R.rows, c.icp]);
  const who = useMemo(() => whoSaw(R.rows), [R.rows]);
  const came = c.came.filter(x => (range === 'win' ? m.inWindow(x.at) : true));
  const months = c.months;

  let headline: ReactNode;
  if (!R.rows.length) headline = <>Nothing went out {R.short}.</>;
  else if (!t.measured) headline = <>{plural(t.published, 'post')} out {R.short}. LinkedIn numbers are not in yet.</>;
  else {
    headline = (
      <>
        {plural(t.published, 'post')} out {R.short}, seen <span className="text-ink" style={{ fontWeight: 400 }}>{fmtInt(t.impressions)}</span> times.
        {t.best && t.measured > 1 && t.bestX && t.bestX >= 1.5 && <> The {fmtWhen(t.best.at, m.theme.tz).day.replace(/^\w+ /, '')} post did {fmtInt(t.best.impressions)}, {t.bestX >= 10 ? Math.round(t.bestX) : t.bestX.toFixed(1).replace(/\.0$/, '')} times the others' average.</>}
      </>
    );
  }

  const icpTile = c.icp && t.icp && t.icp.of > 0
    ? <Tile label={c.icp.mode === 'owners' ? 'Store owners among engagers' : 'Engagers who fit your buyer'} text={pct((t.icp.n / t.icp.of) * 100)} sub={`${t.icp.n} of ${fmtInt(t.icp.of)}${c.icp.mode === 'fit' ? ' people' : ''}`} />
    : null;

  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8 pt-6 sm:pt-8 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-5">
        <div className="min-w-0">
          <div className="eyebrow mb-2">{R.label}</div>
          <h1 className="display text-[28px] sm:text-[32px]">Content</h1>
        </div>
        {hasBoth && (
          <div className="seg" role="group" aria-label="Time range">
            {(['win', 'all'] as const).map(s => (
              <button key={s} aria-pressed={range === s} onClick={() => { track('expand', null, { which: `content_range:${s}` }); setRange(s); }}>
                {range === s && <motion.span layoutId="seg-content" className="absolute inset-0 rounded-full bg-sunk" transition={SPRING} />}
                <span className="relative">{contentRange(m, s).toggle}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <h2 className="display text-[20px] sm:text-[22px] leading-[1.3] max-w-[860px]" style={{ color: 'var(--soft)' }} data-testid="content-headline">{headline}</h2>

      {t.measured > 0 && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-x-5 gap-y-5" data-testid="content-totals">
          <Tile label="Posts out" value={t.published} />
          <Tile label="Impressions" value={t.impressions} sub={t.measured > 1 ? `${fmtInt(t.perPost)} a post` : undefined} />
          <Tile label="Reactions" value={t.reactions} />
          <Tile label="Comments" value={t.comments} />
          <Tile label="Profile views" value={t.profileViews} sub="from the posts" />
          <Tile label="New followers" value={t.followers} />
          {t.rate != null && <Tile label="Engagement rate" text={pct(t.rate)} sub="per impression" />}
          {icpTile}
        </div>
      )}
      {t.measured > 0 && (t.reposts > 0 || t.inboundDms != null || t.ledToCall > 0 || (!icpTile && !!c.icp)) && (
        <p className="mt-4 text-[12.5px] text-mute" data-testid="content-also">
          {[t.reposts ? plural(t.reposts, 'repost') : '',
            t.inboundDms != null ? `${plural(t.inboundDms, 'message')} received after a post` : '',
            t.ledToCall ? `${plural(t.ledToCall, 'call')} booked by someone who engaged with a post` : '',
            !icpTile && c.icp ? `${c.icp.short} not checked for these posts yet` : '',
          ].filter(Boolean).join(' · ')}
        </p>
      )}

      <section className="mt-10 min-w-0">
        <div className="eyebrow mb-3">Post by post · newest first</div>
        <PostTable key={range} rows={R.rows} m={m} />
        {c.icp && R.rows.some(r => r.icp) && (
          <p className="mt-3 text-[11.5px] text-mute leading-snug">
            {c.icp.mode === 'owners'
              ? `${c.icp.label}: people who engaged with the post and own a store, out of everyone who engaged.`
              : `${c.icp.label}: people who engaged and match the buyer you sell to, out of everyone we checked.`}
          </p>
        )}
      </section>

      {c.measuring && <section className="mt-12 min-w-0" data-testid="who-saw">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 mb-4">
          <div className="eyebrow">Who saw it · {R.short}</div>
          {who.outPct != null && (
            <div className="flex items-center gap-3 text-[12.5px] min-w-[260px]">
              <span className="text-mute tnum whitespace-nowrap">{pct(100 - who.outPct)} your network</span>
              <span className="flex flex-1 h-[6px] rounded-full overflow-hidden bg-sunk min-w-[80px]" aria-hidden>
                <span style={{ width: `${100 - who.outPct}%`, background: 'color-mix(in srgb, var(--accent) 45%, var(--paper))' }} />
                <span style={{ width: `${who.outPct}%`, background: 'var(--accent)' }} />
              </span>
              <span className="text-soft tnum whitespace-nowrap">{pct(who.outPct)} outside it</span>
            </div>
          )}
        </div>
        {who.posts ? (
          <div className="grid grid-cols-[minmax(0,1fr)] sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-7 pt-4 border-t hair">
            <Bars title="Seniority" rows={who.seniority} />
            <Bars title="Job titles" rows={who.job_title} />
            <Bars title="Company size" rows={who.company_size} />
            <Bars title="Industry" rows={who.industry} />
            <Bars title="Location" rows={who.location} />
          </div>
        ) : <p className="text-[13.5px] text-mute pt-3 border-t hair">{R.rows.length ? 'LinkedIn has not shared who saw these posts yet.' : 'Shows once a post goes out.'}</p>}
        {who.posts > 0 && (
          <p className="mt-3 text-[11.5px] text-mute">LinkedIn's viewer breakdown across {plural(who.posts, 'post')}, weighted by how many people each post reached.{c.known && range === 'all' ? ` ${fmtInt(c.known.known)} of the ${fmtInt(c.known.total)} people who engaged were already in your outreach.` : ''}</p>
        )}
      </section>}

      {(c.signals || came.length > 0 || (months.length > 1 && range === 'all')) && (
        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2 lg:gap-12">
          {c.signals && (
            <Side title={<>Who is looking · {fmtDay(c.signals.from)} to {fmtDay(c.signals.to)}</>}
              note={<>LinkedIn only names a viewer who allows it, so these are the least it could be.{c.signals.trackingFrom ? ` Store owners finding you on their own are counted from ${fmtDay(c.signals.trackingFrom)}.` : ''}</>}>
              <div className="grid grid-cols-2 gap-x-5 gap-y-5">
                <Tile label="Named profile viewers" value={c.signals.named} sub={`${c.signals.named7d} in the last 7 days`} />
                <Tile label="Of them, people we wrote to" value={c.signals.written} />
                <Tile label="People who engaged with posts" value={c.signals.engaged} sub={`${plural(c.signals.engagedOrganic, 'store owner')} we had not written to`} />
                <Tile label="Store owners who found you" value={c.signals.organic} sub="on their own" />
              </div>
              <p className="mt-4 text-[13px] text-soft">{plural(c.signals.buyerPosts, 'post')} written for buyers, and {plural(c.signals.buyerDms, 'message')} from buyers in the same 30 days.{c.signals.other ? ` ${c.signals.other} viewers were recruiters, agencies or other sellers.` : ''}</p>
            </Side>
          )}
          {came.length > 0 && (
            <Side title={<>Came to you on their own · {R.short}</>}>
              <ul className="border-t hair">
                {came.slice(0, 6).map(x => (
                  <li key={x.name + x.at} className="py-2 border-b hair min-w-0">
                    <div className="flex items-baseline gap-3 min-w-0">
                      <span className="text-[14px] text-ink truncate min-w-0 flex-1">{x.name}{x.company && <span className="text-[12.5px] text-mute"> · {x.company}</span>}</span>
                      <span className="text-[12px] text-mute tnum shrink-0">{fmtDay(x.at.slice(0, 10))}</span>
                    </div>
                    <div className="text-[12px] text-soft truncate">{x.via}{x.role && !x.company ? ` · ${x.role}` : ''}</div>
                  </li>
                ))}
              </ul>
              {came.length > 6 && <p className="mt-2 text-[12px] text-mute">and {came.length - 6} more</p>}
            </Side>
          )}
          {months.length > 1 && range === 'all' && (
            <Side title="Month by month" note={months.some(x => x.medianReactions != null) ? 'Typical reactions: the middle post of the month, counted when each post was 7 days old.' : undefined}>
              <div className="grid text-[13px] tnum" style={{ gridTemplateColumns: 'minmax(0,1fr) 60px 104px 96px' }}>
                {['Month', 'Posts', 'Impressions', 'Typical reactions'].map((h, i) => <span key={h} className={`eyebrow !tracking-[0.06em] pb-2 border-b hair leading-tight self-end ${i ? 'text-right' : ''}`}>{h}</span>)}
                {months.map(x => (
                  <Fragment key={x.month}>
                    <span className="py-2 border-b hair text-ink">{new Date(x.month + '-15T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).replace('Sept', 'Sep')}</span>
                    <span className="py-2 border-b hair text-right text-soft">{x.posts}</span>
                    <span className="py-2 border-b hair text-right text-soft">{fmtInt(x.impressions)}</span>
                    <span className="py-2 border-b hair text-right text-soft">{x.medianReactions != null ? fmtInt(Math.round(x.medianReactions)) : '·'}</span>
                  </Fragment>
                ))}
              </div>
            </Side>
          )}
        </div>
      )}

      <p className="mt-12 text-[12px] text-mute max-w-[760px]">
        {c.measuring
          ? <>Numbers come from LinkedIn{c.updatedAt ? `, last read ${fmtWhen(c.updatedAt, m.theme.tz).day}, ${fmtWhen(c.updatedAt, m.theme.tz).time} ${m.theme.tzLabel}` : ''}. Nothing here is an estimate.</>
          : <>Post numbers start once your LinkedIn account is connected for measuring.</>}
        {c.notMeasured.length > 0 && <> Not measured yet: {c.notMeasured.join(', ')}.</>}
      </p>
    </div>
  );
}
