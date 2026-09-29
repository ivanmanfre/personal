/**
 * PerfReport: the Performance (Results) tab in the ARCH monthly report's look (TRIAL,
 * 2026-09-29, Ivan: "i like the aesthetic, we could try that here"). Lazy-loaded by
 * DeskPerformanceSurface, so none of this ships in the board's first chunk.
 *
 * Same facts as the stage-1 Results report it replaces on screen, re-laid:
 *   hero      calls booked for the chosen period (callsLead's zero rule), who, came to you
 *   funnel    the report's since-the-start figures (new connections → people who wrote
 *             back for the first time → founders who said yes → calls booked), the same
 *             numbers the "Since the start" period and the month table add up to; exact
 *             numbers only (v2: no step %, a share the panel never printed)
 *   the calls a spotlight card per call in the period, with the pre-call brief when there is one
 *   came      the people who came to the client on their own
 *   weeks     the report model's 7-day slices (the "Week by week" table's own rows): new
 *             connections and people who wrote back for the first time, calls as badges, so
 *             the bars add up to the period's figures; the peak slice pre-selected; every exact figure, the slice table and the since-the-start
 *             table fold under "All numbers"
 *   posts     the posts ranked by the brand owners they reached
 * One computed takeaway line heads each section. Nothing here invents a number: every
 * figure comes from reportModel / ReportBlocks or the panel's own "What we track" counts
 * (v2, 2026-09-29, Ivan: "don't change the numbers").
 */
import React, { useMemo, useState, type CSSProperties, type PointerEvent } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { MotionRoot, useReveal, EASE } from './motion';
import { BlurFade, NumberTicker, AvatarCircles, MagicCard, BorderBeam, DotPattern } from './magicui';
import { AnimateNumber, FunnelShape } from './twentyfirst';
import { PK_CSS } from './styles';
import { useFigures, callsLead, reportFigures, fallbackNote, type ReportCtx } from '../report/ReportBlocks';
import { computeFigures, slices, dm, dayKey, addDays, type Period, type Figures, type CameVia } from '../report/reportModel';
import { initialsOf, namesLine, sliceSeries, axisLabel } from '../weekResults';

type Booked = { name?: string | null; company?: string | null; booked_at?: string | null; brief_url?: string | null };
type Truth = {
  booked?: Booked[] | null;
} | null | undefined;

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const wdm = (k: string) => `${WEEKDAY[new Date(k + 'T12:00:00Z').getUTCDay()]}, ${dm(k)}`;
const normName = (s?: string | null) => (s || '').replace(/[^\p{L}\s]/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();

function ticks(top: number): number[] {
  if (top <= 0) return [];
  const raw = top / 2.5;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((x) => x * p).find((x) => x >= raw) ?? raw;
  const out: number[] = [];
  for (let v = step; v < top * 0.97; v += step) out.push(v);
  return out;
}

function SecHead({ id, label, line }: { id: string; label: string; line: string | null }) {
  return (
    <BlurFade>
      <div className="pk-cap pk-capline">{label}</div>
      {line && <h2 id={id} className="pk-h2">{line}</h2>}
    </BlurFade>
  );
}

function DarkPicker({ ctx }: { ctx: ReportCtx }) {
  const groups = [
    { label: 'Report months', items: ctx.periods.filter((p) => p.kind === 'month') },
    { label: 'Weeks', items: ctx.periods.filter((p) => p.kind === 'week') },
    { label: 'Everything', items: ctx.periods.filter((p) => p.kind === 'all') },
  ].filter((g) => g.items.length);
  return (
    <span className="pk-pick">
      <select aria-label="Report period" value={ctx.period.key} onChange={(e) => ctx.onPeriod(e.target.value)}>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </optgroup>
        ))}
      </select>
      <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

/* ───────────────────────────── hero ───────────────────────────── */

const VIA: Record<CameVia, string> = {
  asked: 'asked to connect', viewed: 'viewed your profile', engaged: 'engaged with a post first',
  hand: 'raised a hand on a post', messaged: 'messaged you first',
};

function Hero({ ctx, f, fm, fAll }: { ctx: ReportCtx; f: Figures; fm: Figures | null; fAll: Figures }) {
  const lead = callsLead(ctx, f, fm, fAll);
  const scoped = lead.phrase !== ctx.period.phrase;
  const all = fAll.calls.n;
  const shown = lead.names.slice(0, 5);
  const came = f.came && f.came.n > 0 ? f.came : null;
  const who = ctx.cfg.who;
  const sub = ctx.period.kind !== 'all' && all > lead.n ? `${fmt(all)} since ${dm(ctx.cfg.start)}` : null;
  return (
    <section aria-labelledby="pk-hero" style={{ position: 'relative' }}>
      <BlurFade className="pk-cap pk-capline" offset={6}>{ctx.period.eyebrow}</BlurFade>
      {lead.n > 0 ? (
        <h1 id="pk-hero" className="pk-hero-h" style={{ margin: '12px 0 0' }}>
          <span className="pk-hero-n pk-grad"><NumberTicker value={lead.n} start delay={0.15} /></span>
          <BlurFade as="span" delay={0.18} style={{ display: 'block' }}>
            <span className="pk-hero-l pk-disp">{plural(lead.n, 'call', 'calls')} booked<br />{lead.phrase}</span>
            {sub && <span className="pk-hero-sub">{sub}</span>}
          </BlurFade>
        </h1>
      ) : (
        <BlurFade as="h2" id="pk-hero" delay={0.05} className="pk-h2" style={{ fontSize: 'clamp(36px, 9vw, 56px)' }}>
          No calls booked {ctx.period.phrase} yet.
        </BlurFade>
      )}
      {lead.none && scoped && <div className="pk-quiet">{lead.none} The number above is {lead.phrase}.</div>}
      {shown.length > 0 && (
        <div className="pk-who">
          <AvatarCircles delay={0.35} size={48} more={lead.names.length - shown.length} avatars={shown.map((n) => ({ initials: initialsOf(n), label: n }))} />
          <BlurFade delay={0.45} style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, lineHeight: 1.35, fontWeight: 700 }}>{namesLine(lead.names)}</div>
          </BlurFade>
        </div>
      )}
      {came && (
        <BlurFade delay={0.3} className="pk-note">
          {fmt(came.n)} {plural(came.n, who[0], who[1])} came to you on their own{scoped ? ` ${ctx.period.phrase}` : ''}{came.groups.length === 1
            ? (came.n === 1 ? ` and ${VIA[came.groups[0].via]}.` : `; all ${came.n} ${VIA[came.groups[0].via]}.`)
            : `: ${came.groups.map((g) => `${g.n} ${VIA[g.via]}`).join(', ')}.`}
        </BlurFade>
      )}
    </section>
  );
}

/* ───────────────────────────── funnel ───────────────────────────── */

const FN_STAGE = 54;
const FN_GAP = 40;

function Funnel({ ctx, fAll }: { ctx: ReportCtx; fAll: Figures }) {
  const [ref, shown] = useReveal<HTMLDivElement>(0.35);
  // The report's own since-the-start figures, with the figure cards' own words: the same
  // numbers the picker's "Since the start" and the month table below add up to.
  const all = ctx.periods.find((p) => p.kind === 'all') as Period;
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const stages = [
    fAll.reach != null ? { label: ctx.cfg.reach === 'connections' ? 'New connections' : 'New people reached', v: fAll.reach } : null,
    fAll.wrote != null ? { label: cap(ctx.cfg.wroteLabel[fAll.wrote === 1 ? 0 : 1]), v: fAll.wrote } : null,
    fAll.yes != null ? { label: cap(ctx.cfg.yesLabel[fAll.yes === 1 ? 0 : 1]), v: fAll.yes } : null,
    { label: 'Calls booked', v: fAll.calls.n },
  ].filter((x): x is { label: string; v: number } => !!x);
  if (stages.length < 2) return null;
  const max = Math.max(1, ...stages.map((s) => s.v));
  // Square-root widths: a 426-to-19 drop drawn linearly leaves the last stage invisible.
  // Every stage carries its exact number beside it; the shape carries no number of its own.
  const w = stages.map((s) => (s.v > 0 ? Math.max(8, Math.sqrt(s.v / max) * 100) : 1.5));
  const H = stages.length * FN_STAGE + (stages.length - 1) * FN_GAP;
  const centers = stages.map((_, i) => FN_STAGE / 2 + i * (FN_STAGE + FN_GAP));
  const cuts = stages.slice(1).map((_, i) => FN_STAGE + i * (FN_STAGE + FN_GAP) + FN_GAP / 2);
  const POUR = 1.05;
  const at = (y: number) => 0.1 + (y / H) * POUR;
  const first = stages[0];
  const last = stages[stages.length - 1];
  const line = `${fmt(first.v)} ${first.label.toLowerCase()} ${all.phrase}, ${fmt(last.v)} ${last.label.toLowerCase()}.`;
  return (
    <BlurFade as="section" delay={0.1} className="pk-panel pk-fnp">
      <BorderBeam />
      <div className="pk-cap pk-capline">{all.eyebrow}</div>
      <h2 className="pk-disp" style={{ margin: '12px 0 0', fontSize: 'clamp(21px, 5.4vw, 24px)', lineHeight: 1.2, letterSpacing: '-0.025em', textWrap: 'balance' } as CSSProperties}>{line}</h2>
      <div ref={ref} className="pk-fn" style={{ '--fn-stage': `${FN_STAGE}px`, '--fn-gap': `${FN_GAP}px` } as CSSProperties}>
        <div className="pk-fn-col" aria-hidden="true">
          <FunnelShape widths={w} centers={centers} slices={cuts} height={H} shown={shown} duration={POUR} />
        </div>
        <ol className="pk-fn-stages">
          {stages.map((s, i) => (
            <li key={s.label} className="pk-fn-row">
              <span className="pk-fn-num" style={i === stages.length - 1 ? { color: 'var(--cb-accent)' } : undefined}>
                <NumberTicker value={s.v} start={shown} delay={Math.max(0, at(centers[i]) - 0.3)} />
              </span>
              <span className="pk-cap pk-mute" style={{ marginTop: 6, letterSpacing: '.1em' }}>{s.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </BlurFade>
  );
}

/* ───────────────────────────── the calls ───────────────────────────── */

type CallRow = { name: string; company: string | null; day: string; brief: string | null };

function callsFor(ctx: ReportCtx, truth: Truth, lead: { names: string[]; phrase: string }, scope: Period): CallRow[] {
  const tz = ctx.cfg.tz;
  const booked = (truth?.booked || []).filter((b) => { const k = dayKey(b.booked_at, tz); return !!k && k >= scope.start && k < scope.end && k >= ctx.cfg.start; });
  const byName = new Map(booked.map((b) => [normName(b.name), b] as const));
  const people = ctx.payload?.people || [];
  const rows: CallRow[] = [];
  const seen = new Set<string>();
  for (const n of lead.names) {
    const key = normName(n);
    if (seen.has(key)) continue;
    seen.add(key);
    const b = byName.get(key);
    const p = people.find((x) => normName(x.n) === key && !!x.bk);
    const day = dayKey(b?.booked_at || p?.bk, tz);
    if (!day) continue;
    rows.push({
      name: n.replace(/^[^\p{L}]+/u, ''), company: (b?.company || p?.c || '').trim() || null, day,
      brief: b?.brief_url || null,
    });
  }
  return rows.sort((a, z) => z.day.localeCompare(a.day));
}

function CallCard({ c }: { c: CallRow }) {
  return (
    <MagicCard>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span className="pk-cap pk-mute">{wdm(c.day)}</span>
        <span className="pk-cap pk-pill"><i aria-hidden />Booked</span>
      </div>
      <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
        <AvatarCircles size={44} avatars={[{ initials: initialsOf(c.name), label: c.name }]} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 18, lineHeight: 1.2, fontWeight: 800, letterSpacing: '-0.015em' }}>{c.name}</div>
          {c.company && <div className="pk-mute" style={{ marginTop: 2, fontSize: 15, lineHeight: 1.25 }}>{c.company}</div>}
        </div>
      </div>
      {c.brief && <div style={{ marginTop: 'auto', paddingTop: 18 }}><a className="pk-link" href={c.brief} target="_blank" rel="noreferrer">Pre-call brief →</a></div>}
    </MagicCard>
  );
}

function Calls({ rows, n, phrase }: { rows: CallRow[]; n: number; phrase: string }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const shown = all ? rows : rows.slice(0, 6);
  const line = `${n} ${plural(n, 'call', 'calls')} booked ${phrase}, the latest on ${dm(rows[0].day)}.`;
  return (
    <section aria-labelledby="pk-calls" className="pk-sec">
      <SecHead id="pk-calls" label="The calls" line={line} />
      <ul className="pk-cards">
        {shown.map((c, i) => (
          <BlurFade as="li" key={`${c.name}-${c.day}`} delay={Math.min(i, 5) * 0.08}><CallCard c={c} /></BlurFade>
        ))}
      </ul>
      {rows.length > 6 && (
        <button type="button" className="pk-disc" style={{ width: 'auto', gap: 8 }} onClick={() => setAll((x) => !x)} aria-expanded={all}>
          {all ? 'Show fewer' : `The other ${rows.length - 6} ${plural(rows.length - 6, 'call', 'calls')}`}
        </button>
      )}
    </section>
  );
}

/* ───────────────────────────── came to you ───────────────────────────── */

const VIA_ROW: Record<CameVia, string> = {
  asked: 'Asked to connect', viewed: 'Viewed your profile', engaged: 'Engaged with a post before any message',
  hand: 'Raised a hand on a post', messaged: 'Messaged you first',
};

function Came({ ctx, f, fm }: { ctx: ReportCtx; f: Figures; fm: Figures | null }) {
  const useMonth = !f.came?.n && ctx.period.kind === 'week' && !!fm?.came?.n;
  const src = useMonth ? fm : f;
  const people = src?.came?.people || [];
  if (!people.length) return null;
  const scope = (useMonth ? ctx.period.month?.phrase : ctx.period.phrase) || '';
  const who = ctx.cfg.who;
  const line = `${people.length} ${plural(people.length, who[0], who[1])} came to you on their own ${scope}.`;
  return (
    <section aria-labelledby="pk-came" className="pk-sec">
      <SecHead id="pk-came" label="Came to you" line={line} />
      <BlurFade as="ul" className="pk-rows">
        {people.map((c, i) => {
          const role = (c.title || '').split('|')[0].trim();
          const k = dayKey(c.at, ctx.cfg.tz);
          return (
            <li key={`${c.name}-${i}`}>
              <div className="t">
                <div style={{ fontSize: 16, fontWeight: 800 }}>{c.name || 'Name not shown'}</div>
                {(role || c.company) && <div className="pk-mute" style={{ marginTop: 2, fontSize: 13.5, lineHeight: 1.4 }}>{role && c.company && !role.toLowerCase().includes(c.company.toLowerCase()) ? `${role}, ${c.company}` : (role || c.company)}</div>}
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: 'var(--cb-accent)' }}>{VIA_ROW[c.via]}{k ? ` · ${dm(k)}` : ''}</div>
              </div>
            </li>
          );
        })}
      </BlurFade>
    </section>
  );
}

/* ───────────────────────────── week by week ───────────────────────────── */

function Bar({ v, top, kind, shown, delay }: { v: number; top: number; kind: 'msg' | 'rep'; shown: boolean; delay: number }) {
  const reduce = useReducedMotion();
  return (
    <span className={`pk-bar pk-bar-${kind}`} style={{ height: `${(v / top) * 100}%` }}>
      <m.span className="pk-fill" initial={reduce ? false : { scaleY: 0 }} animate={shown ? { scaleY: 1 } : undefined} transition={{ duration: 0.6, ease: EASE, delay }} />
      <m.span className="pk-val" initial={reduce ? false : { opacity: 0, y: 4 }} animate={shown ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.3, ease: EASE, delay: delay + 0.35 }}>{fmt(v)}</m.span>
    </span>
  );
}

function AllNumbers({ ctx, f, fm, fAll }: { ctx: ReportCtx; f: Figures; fm: Figures | null; fAll: Figures }) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const figs = reportFigures(ctx, f, fm, fAll, 'results');
  const note = fallbackNote(ctx, figs);
  const tables = useMemo(() => {
    const allP = ctx.periods.find((x) => x.kind === 'all') as Period;
    const mk = (p: Period) => slices(ctx.cfg, p, ctx.periods, ctx.today).map((s) => ({ p: s, f: computeFigures(ctx.cfg, s, ctx.payload, ctx.board, ctx.audience) }));
    const cur = ctx.period.kind === 'all' ? [] : mk(ctx.period);
    return { cur, all: mk(allP) };
  }, [ctx]);
  const table = (rows: typeof tables.cur, first: string, caption: string) => rows.length < 2 ? null : (
    <>
      <div className="pk-cap pk-subcap">{caption}</div>
      <table className="pk-nums">
        <thead><tr><th scope="col">{first}</th><th scope="col">Calls</th><th scope="col">Came to you</th><th scope="col">Wrote back</th><th scope="col">{ctx.cfg.reach === 'connections' ? 'New conn.' : 'Reached'}</th></tr></thead>
        <tbody>
          {rows.map(({ p, f: rf }) => (
            <tr key={p.key}>
              <th scope="row">{p.label}</th>
              {[rf.calls.n, rf.came?.n ?? 0, rf.wrote ?? 0, rf.reach ?? 0].map((v, i) => <td key={i} className={i === 0 && v > 0 ? 'hit' : v ? undefined : 'zero'}>{fmt(v)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
  return (
    <div style={{ marginTop: 20, borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 4 }}>
      <button type="button" className="pk-disc" aria-expanded={open} aria-controls="pk-all" onClick={() => setOpen((o) => !o)}>
        <span>All numbers</span>
        <m.svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reduce ? 0 : 0.25, ease: EASE }}>
          <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </m.svg>
      </button>
      <m.div id="pk-all" className="pk-disc-body" style={{ overflow: 'hidden' }} initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} transition={{ duration: reduce ? 0 : 0.35, ease: EASE }} aria-hidden={!open}>
        <div className="pk-cap pk-subcap" style={{ marginTop: 6 }}>{ctx.period.eyebrow}</div>
        <ul className="pk-figs">
          {figs.map((x) => (
            <li key={x.key} data-report-figure={x.key}>
              <b style={x.strong ? { color: 'var(--cb-accent)' } : undefined}>{fmt(x.value)}</b>
              <span>{x.caption}{x.sub ? <small>{x.sub}</small> : null}</span>
            </li>
          ))}
        </ul>
        {note && <div className="pk-quiet">{note}</div>}
        {table(tables.cur, 'Week', 'Week by week')}
        {table(tables.all, 'Month', `Report month by report month, since ${dm(ctx.cfg.start)}`)}
        <div style={{ height: 12 }} />
      </m.div>
    </div>
  );
}

function Weeks({ ctx, f, fm, fAll }: { ctx: ReportCtx; f: Figures; fm: Figures | null; fAll: Figures }) {
  const reduce = useReducedMotion();
  const [ref, shown] = useReveal<HTMLDivElement>(0.3);
  const weeks = useMemo(() => sliceSeries(ctx).slice(-9), [ctx]);
  const peakI = useMemo(() => {
    let best = -1;
    weeks.forEach((w, i) => { if (w.wrote > 0 && (best < 0 || w.wrote > weeks[best].wrote)) best = i; });
    return best < 0 ? null : best;
  }, [weeks]);
  const [sel, setSel] = useState<number | null>(peakI);
  const [hover, setHover] = useState<number | null>(null);
  if (weeks.length < 2) return <section className="pk-sec"><AllNumbers ctx={ctx} f={f} fm={fm} fAll={fAll} /></section>;
  const active = hover ?? sel;
  const peak = Math.max(1, ...weeks.map((w) => Math.max(w.reach, w.wrote)));
  const top = peak * 1.16;
  const grid = ticks(peak);
  const cur = active !== null ? weeks[active] : null;
  const onEnter = (i: number) => (e: PointerEvent) => { if (e.pointerType === 'mouse') setHover(i); };
  const line = peakI !== null ? `Most people wrote back for the first time ${weeks[peakI].label}.` : 'Week by week.';
  const connLabel = ctx.cfg.reach === 'connections' ? 'New connections' : 'Reached';
  return (
    <section aria-labelledby="pk-weeks" className="pk-sec">
      <SecHead id="pk-weeks" label="Week by week" line={line} />
      <BlurFade className="pk-panel pk-wkp">
        <ul className="pk-legend" aria-hidden="true">
          <li><span className="pk-sw pk-sw-msg" />{connLabel}</li>
          <li><span className="pk-sw pk-sw-rep" />Wrote back for the first time</li>
          <li><span className="pk-sw pk-sw-call" />Call booked</li>
        </ul>
        <div ref={ref} className="pk-chart">
          <div className="pk-grid" aria-hidden="true">
            {grid.map((v) => <span key={v} className="pk-gl" style={{ bottom: `${(v / top) * 100}%` }} />)}
            <span className="pk-gl base" />
          </div>
          <div className="pk-cols" onPointerLeave={() => setHover(null)}>
            {weeks.map((w, i) => (
              <button
                key={w.key}
                type="button"
                className={`pk-col${active === i ? ' on' : ''}${w.current ? ' partial' : ''}`}
                aria-pressed={sel === i}
                aria-label={`${w.label}: ${fmt(w.reach)} ${connLabel.toLowerCase()}, ${fmt(w.wrote)} wrote back for the first time${w.calls ? `, ${w.calls} ${plural(w.calls, 'call', 'calls')} booked` : ''}.`}
                onClick={() => setSel(i)}
                onPointerEnter={onEnter(i)}
              >
                <span className="pk-slot">
                  {w.calls > 0 && (
                    <m.span className="pk-badge" initial={reduce ? false : { opacity: 0, scale: 0.5, y: 6 }} animate={shown ? { opacity: 1, scale: 1, y: 0 } : undefined} transition={{ type: 'spring', bounce: 0.45, duration: 0.5, delay: 0.55 + i * 0.08 }}>
                      {w.calls}
                    </m.span>
                  )}
                </span>
                <span className="pk-bars" aria-hidden="true">
                  <Bar v={w.reach} top={top} kind="msg" shown={shown} delay={0.08 + i * 0.06} />
                  <Bar v={w.wrote} top={top} kind="rep" shown={shown} delay={0.16 + i * 0.06} />
                </span>
                <span className="pk-wl" aria-hidden="true">
                  <span className="pk-wl-t">{axisLabel(weeks, i)}</span>
                  {w.current && <small>to today</small>}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="pk-readout" aria-live="polite">
          {cur ? (
            <>
              <div className="pk-rd-week">
                <span className="pk-cap pk-mute">{cur.label}</span>
                <span className="pk-rd-hint" aria-hidden="true">Tap a week</span>
              </div>
              <dl className="pk-rd-stats">
                <div><dt>{connLabel}</dt><dd><AnimateNumber value={cur.reach} /></dd></div>
                <div className="hi"><dt>Wrote back for the first time</dt><dd><AnimateNumber value={cur.wrote} /></dd></div>
                <div className={cur.calls > 0 ? 'hi' : 'none'}><dt>{plural(cur.calls, 'Call booked', 'Calls booked')}</dt><dd><AnimateNumber value={cur.calls} /></dd></div>
              </dl>
            </>
          ) : <div className="pk-mute">Tap a week to see its numbers.</div>}
        </div>
        <AllNumbers ctx={ctx} f={f} fm={fm} fAll={fAll} />
      </BlurFade>
    </section>
  );
}

/* ───────────────────────────── posts ───────────────────────────── */

function Posts({ ctx, f }: { ctx: ReportCtx; f: Figures }) {
  const [all, setAll] = useState(false);
  const rows = f.posts;
  if (!rows.length) return null;
  const fit = ctx.cfg.fit;
  const best = rows.find((r) => r.collected && (r.fit || 0) > 0);
  const reachedAny = rows.filter((r) => r.collected && (r.fit || 0) > 0).length;
  const count = `${rows.length} ${plural(rows.length, 'post', 'posts')} ${ctx.period.phrase}.`;
  const line = best
    ? `${count} The ${dm(best.day)} post reached ${reachedAny === 1 ? '' : 'the most, '}${best.fit} ${plural(best.fit || 0, fit[0], fit[1])}.`
    : count;
  const anyCall = rows.some((r) => r.calls > 0);
  const shown = all ? rows : rows.slice(0, 8);
  return (
    <section aria-labelledby="pk-posts" id="cb-report-posts" className="pk-sec">
      <SecHead id="pk-posts" label="Your posts" line={line} />
      <BlurFade as="ul" className="pk-rows">
        <li aria-hidden="true" style={{ padding: '10px 0' }}>
          <span className="t pk-cap pk-mute" style={{ fontSize: 9.5 }}>Post, {ctx.cfg.postsRank}</span>
          <span className="pk-cap pk-mute" style={{ fontSize: 9.5 }}>{ctx.cfg.fitColumn}</span>
          {anyCall && <span className="pk-cap pk-mute" style={{ fontSize: 9.5 }}>Led to a call</span>}
        </li>
        {shown.map((r) => (
          <li key={r.key}>
            <div className="t">
              <div className="pk-cap pk-mute">{dm(r.day)}</div>
              <div style={{ marginTop: 4, fontSize: 15.5, fontWeight: 600, lineHeight: 1.35 }}>
                {r.title.length > 90 ? `${r.title.slice(0, r.title.lastIndexOf(' ', 90))}…` : r.title}
                {r.own && <span className="pk-chip">your own post</span>}
              </div>
              {!r.collected && <div className="pk-mute" style={{ marginTop: 4, fontSize: 12.5 }}>engagement not collected for this post</div>}
            </div>
            <span className="n" style={r.collected && r.fit ? { color: 'var(--cb-accent)' } : { color: 'rgba(255,255,255,.35)' }}>{r.collected && r.fit ? r.fit : '–'}</span>
            {anyCall && <span className="n">{r.calls > 0 ? r.calls : ''}</span>}
          </li>
        ))}
      </BlurFade>
      {rows.length > 8 && (
        <button type="button" className="pk-disc" style={{ width: 'auto' }} onClick={() => setAll((x) => !x)} aria-expanded={all}>
          {all ? 'Show fewer' : `The other ${rows.length - 8} ${plural(rows.length - 8, 'post', 'posts')}`}
        </button>
      )}
    </section>
  );
}

/* ───────────────────────────── page ───────────────────────────── */

export default function PerfReport({ ctx, truth }: { ctx: ReportCtx; truth: Truth }) {
  const { f, fm, fAll } = useFigures(ctx);
  const lead = callsLead(ctx, f, fm, fAll);
  const scope: Period = lead.phrase === ctx.period.phrase ? ctx.period
    : (ctx.period.month && lead.phrase === ctx.period.month.phrase ? ctx.period.month : ctx.periods.find((p) => p.kind === 'all') as Period);
  const calls = useMemo(() => callsFor(ctx, truth, lead, scope), [ctx, truth, lead.names.join('|'), scope.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <MotionRoot>
      <style>{PK_CSS}</style>
      <div className="pk" data-perf-report="">
        <div aria-hidden className="pk-glow" />
        <DotPattern />
        <header className="pk-head">
          <span className="pk-cap" style={{ color: 'rgba(255,255,255,.6)' }}>Results</span>
          <DarkPicker ctx={ctx} />
        </header>
        <div className="pk-top">
          <Hero ctx={ctx} f={f} fm={fm} fAll={fAll} />
          <Funnel ctx={ctx} fAll={fAll} />
        </div>
        <Calls rows={calls} n={lead.n} phrase={lead.phrase} />
        <Came ctx={ctx} f={f} fm={fm} />
        <Weeks ctx={ctx} f={f} fm={fm} fAll={fAll} />
        <Posts ctx={ctx} f={f} />
        <div className="pk-foot">
          {ctx.period.eyebrow}. Calls booked, replies and connections come from your LinkedIn outreach; the funnel counts everyone since the start. Posts are ranked by the {ctx.cfg.fit[1]} who engaged with them.
        </div>
      </div>
    </MotionRoot>
  );
}
