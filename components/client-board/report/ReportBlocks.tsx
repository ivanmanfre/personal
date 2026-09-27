/**
 * ReportBlocks — the report period on Home and Results, drawn in the desk board's own
 * vocabulary (desk-kit: Eyebrow, DeskH2, Num, Plate, Spark, Ledger, Card, Drill, Chip, Pill).
 * No new visual language: every size, weight, rule and radius here is one the board already
 * uses. The figures come from ./reportModel; nothing here computes a number of its own.
 *
 * Copy rules (Ivan 2026-09-27/28): calls booked lead, then the people who came to the client;
 * reads never appear in a headline, figure or chart; no cadence, no process, no rates on
 * outreach counts; a 0 that only means "the window is short" is not printed.
 */
import React from 'react';
import {
  Eyebrow, DeskH2, Footnote, Card, Plate, PlateMute, Num, Chip, Pill, Spark,
  Ledger, LedgerRow, LedgerCell, Drill,
} from '../desk-kit';
import {
  computeFigures, shown, series, slices, dm, dayKey,
  type ReportConfig, type ReportPayload, type ReportBoardSlice, type ReportAudienceSlice,
  type Period, type Figures, type CameVia, type SeriesKey, type Shown,
} from './reportModel';

/** Everything a surface needs to draw the report. Built once by the page. */
export type ReportCtx = {
  cfg: ReportConfig;
  periods: Period[];
  period: Period;
  onPeriod: (key: string) => void;
  payload: ReportPayload | null;
  board: ReportBoardSlice;
  audience?: ReportAudienceSlice;
  today: string;
};

const plural = (n: number, pair: [string, string]) => (n === 1 ? pair[0] : pair[1]);
const MUTE = 'var(--cb-ink-mute)';

function nameList(names: string[], max = 3): string {
  if (!names.length) return '';
  const shownN = names.slice(0, max);
  const rest = names.length - shownN.length;
  if (rest > 0) return `${shownN.join(', ')} and ${rest} more`;
  if (shownN.length === 1) return shownN[0];
  return `${shownN.slice(0, -1).join(', ')} and ${shownN[shownN.length - 1]}`;
}

/** Figures for the period and, for a week, the month the zero rule falls back to. */
export function useFigures(ctx: ReportCtx, p: Period = ctx.period): { f: Figures; fm: Figures | null; fAll: Figures } {
  return React.useMemo(() => {
    const f = computeFigures(ctx.cfg, p, ctx.payload, ctx.board, ctx.audience);
    const fm = p.kind === 'week' && p.month ? computeFigures(ctx.cfg, p.month, ctx.payload, ctx.board, ctx.audience) : null;
    const all = ctx.periods.find((x) => x.kind === 'all') as Period;
    const fAll = p.kind === 'all' ? f : computeFigures(ctx.cfg, all, ctx.payload, ctx.board, ctx.audience);
    return { f, fm, fAll };
  }, [ctx.cfg, p, ctx.payload, ctx.board, ctx.audience, ctx.periods]);
}

/* ─────────────────────────── picker ─────────────────────────── */

const PICKER_CSS = `
.cb-report-figs { display: grid; grid-template-columns: repeat(auto-fit, minmax(175px, 1fr)); gap: 22px 16px; }
@media (max-width: 640px) { .cb-report-figs { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px 12px; } }
.cb-report-tbl th { white-space: nowrap; }
@media (max-width: 640px) { .cb-report-tbl th { white-space: normal; font-size: 10.5px !important; letter-spacing: 0.06em !important; } .cb-report-tbl td.n { font-size: 18px !important; } }
.cb-report-pick { position: relative; display: inline-flex; align-items: center; }
.cb-report-pick select { appearance: none; -webkit-appearance: none; border: 1px solid var(--cb-line); border-radius: 999px; background: var(--cb-paper); color: var(--cb-ink); font-family: var(--cb-body); font-size: 13px; font-weight: 700; line-height: 1.35; padding: 8px 36px 8px 17px; cursor: pointer; max-width: 100%; }
.cb-report-pick select:hover { border-color: var(--cb-line-bold); }
.cb-report-pick select:focus-visible { outline: 2px solid var(--cb-accent); outline-offset: 2px; }
.cb-report-pick svg { position: absolute; right: 14px; pointer-events: none; }
`;

export function PeriodPicker({ ctx }: { ctx: ReportCtx }) {
  const groups: Array<{ label: string; items: Period[] }> = ctx.cfg.kind === 'weekly'
    ? [
      { label: 'Weeks', items: ctx.periods.filter((p) => p.kind === 'week') },
      { label: 'Months', items: ctx.periods.filter((p) => p.kind === 'month') },
      { label: 'Everything', items: ctx.periods.filter((p) => p.kind === 'all') },
    ]
    : [
      { label: 'Report months', items: ctx.periods.filter((p) => p.kind === 'month') },
      { label: 'Everything', items: ctx.periods.filter((p) => p.kind === 'all') },
    ];
  return (
    <span className="cb-report-pick">
      <style>{PICKER_CSS}</style>
      <select aria-label="Report period" value={ctx.period.key} onChange={(e) => ctx.onPeriod(e.target.value)}>
        {groups.filter((g) => g.items.length).map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.items.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </optgroup>
        ))}
      </select>
      <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}

/* ─────────────────────────── headline ─────────────────────────── */

/** Calls booked never open on a 0: a period without one leads with its month (for a week)
 *  or the since-the-start figure, and the period's own "none yet" drops to a quiet line. */
export function callsLead(ctx: ReportCtx, f: Figures, fm: Figures | null, fAll: Figures): { n: number; names: string[]; phrase: string; none: string | null } {
  const p = ctx.period;
  if (f.calls.n > 0) return { n: f.calls.n, names: f.calls.names, phrase: p.phrase, none: null };
  const none = p.current ? `None yet ${p.phrase}.` : `None ${p.phrase}.`;
  if (fm && fm.calls.n > 0 && p.month) return { n: fm.calls.n, names: fm.calls.names, phrase: p.month.phrase, none };
  if (fAll.calls.n > 0) return { n: fAll.calls.n, names: fAll.calls.names, phrase: `since ${dm(ctx.cfg.start)}`, none };
  return { n: 0, names: [], phrase: p.phrase, none: null };
}

export function reportHeadline(ctx: ReportCtx, f: Figures, fm: Figures | null, fAll: Figures): React.ReactNode {
  const { cfg, period: p } = ctx;
  const lead = callsLead(ctx, f, fm, fAll);
  const names = nameList(lead.names);
  const calls: React.ReactNode = lead.n > 0
    ? <><b>{lead.n} {lead.n === 1 ? 'call' : 'calls'} booked</b> {lead.phrase}{names ? `, with ${names}` : ''}.</>
    : <>Your calls booked {p.phrase} land here.</>;
  const came = shown(f.came?.n, fm?.came?.n, p);
  const cameLine = came
    ? <> {came.value} {plural(came.value, cfg.who)} came to you on their own{came.scope && came.scope !== lead.phrase ? ` ${came.scope}` : ''}.</>
    : null;
  return <>{calls}{cameLine}</>;
}

/** One sentence for the accent strip above Results. Plain text, no names beyond three. */
export function reportStripText(ctx: ReportCtx): string {
  const f = computeFigures(ctx.cfg, ctx.period, ctx.payload, ctx.board, ctx.audience);
  const p = ctx.period;
  const fm = p.kind === 'week' && p.month ? computeFigures(ctx.cfg, p.month, ctx.payload, ctx.board, ctx.audience) : null;
  const all = ctx.periods.find((x) => x.kind === 'all') as Period;
  const fa = computeFigures(ctx.cfg, all, ctx.payload, ctx.board, ctx.audience);
  const lead = callsLead(ctx, f, fm, fa);
  if (lead.n > 0) return `${lead.n} ${lead.n === 1 ? 'call' : 'calls'} booked ${lead.phrase}: ${nameList(lead.names)}.`;
  return 'Your results, period by period.';
}

export function ReportHead({ ctx, f, fm, fAll, eyebrow }: { ctx: ReportCtx; f: Figures; fm: Figures | null; fAll: Figures; eyebrow?: string }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Eyebrow>{eyebrow ? `${eyebrow} · ` : ''}{ctx.period.eyebrow}</Eyebrow>
        <PeriodPicker ctx={ctx} />
      </div>
      <DeskH2 style={{ maxWidth: '34ch' }}>{reportHeadline(ctx, f, fm, fAll)}</DeskH2>
    </>
  );
}

/* ─────────────────────────── figures ─────────────────────────── */

const VIA_LABEL: Record<CameVia, [string, string]> = {
  asked: ['asked to connect', 'asked to connect'],
  viewed: ['viewed your profile', 'viewed your profile'],
  engaged: ['engaged with a post first', 'engaged with a post first'],
  hand: ['raised a hand on a post', 'raised a hand on a post'],
  messaged: ['messaged you first', 'messaged you first'],
};
const VIA_ROW: Record<CameVia, string> = {
  asked: 'Asked to connect', viewed: 'Viewed your profile', engaged: 'Engaged with a post before any message',
  hand: 'Raised a hand on a post', messaged: 'Messaged you first',
};

type Fig = { key: string; strong?: boolean; value: number; caption: React.ReactNode; sub?: React.ReactNode; weekZero?: string | null };

function FigBlock({ fig }: { fig: Fig }) {
  return (
    <div data-report-figure={fig.key} style={{ borderLeft: `3px solid ${fig.strong ? 'var(--cb-accent)' : 'var(--cb-line)'}`, paddingLeft: 14 }}>
      <Num size="big">{fig.value.toLocaleString('en-GB')}</Num>
      <Footnote style={{ marginTop: 6, color: 'var(--cb-ink-soft)' }}>{fig.caption}</Footnote>
      {fig.sub && <Footnote style={{ marginTop: 4 }}>{fig.sub}</Footnote>}
    </div>
  );
}

export function reportFigures(ctx: ReportCtx, f: Figures, fm: Figures | null, fAll: Figures, variant: 'home' | 'results', waiting = 0): Fig[] {
  const { cfg, period: p } = ctx;
  const figs: Fig[] = [];
  const scoped = (s: Shown, caption: (v: number) => string) => (s ? `${caption(s.value)}${s.scope ? ` ${s.scope}` : ''}` : '');
  const weekZero = (s: Shown) => (s && s.weekZero ? s.scope : null);
  // Calls booked: always shown, with the names; a period without one shows its month or
  // the since-the-start figure, and the period's own "none yet" as a quiet line.
  const lead = callsLead(ctx, f, fm, fAll);
  const scopedLead = lead.phrase !== p.phrase;
  figs.push({
    key: 'calls', strong: true, value: lead.n,
    caption: `${lead.n === 1 ? 'call booked' : 'calls booked'}${scopedLead ? ` ${lead.phrase}` : ''}`,
    sub: <>{lead.names.length ? nameList(lead.names, 4) : null}{!scopedLead && p.kind !== 'all' && fAll.calls.n > lead.n ? <>{lead.names.length ? <br /> : null}{fAll.calls.n} since {dm(cfg.start)}</> : null}</>,
    weekZero: lead.none ? lead.phrase : null,
  });
  if (waiting > 0) figs.push({ key: 'waiting', strong: true, value: waiting, caption: waiting === 1 ? 'post waiting for your approval' : 'posts waiting for your approval', sub: 'as of now' });
  const came = shown(f.came?.n, fm?.came?.n, p);
  if (came) {
    const src = came.weekZero ? fm : f;
    figs.push({
      key: 'came', value: came.value,
      caption: scoped(came, (v) => `${plural(v, cfg.who)} came to you`),
      sub: (src?.came?.groups || []).map((g) => `${g.n} ${VIA_LABEL[g.via][g.n === 1 ? 0 : 1]}`).join(' · '),
      weekZero: weekZero(came),
    });
  }
  const fe = shown(f.fitEngaged?.n, fm?.fitEngaged?.n, p);
  if (fe) {
    const src = fe.weekZero ? fm : f;
    figs.push({
      key: 'fit', value: fe.value,
      caption: scoped(fe, (v) => `${plural(v, cfg.fit)} engaged with your posts`),
      weekZero: weekZero(fe),
    });
  }
  const yes = shown(f.yes, fm?.yes, p);
  if (yes) figs.push({ key: 'yes', value: yes.value, caption: scoped(yes, (v) => plural(v, cfg.yesLabel)), weekZero: weekZero(yes) });
  const wrote = shown(f.wrote, fm?.wrote, p);
  if (wrote) figs.push({ key: 'wrote', value: wrote.value, caption: scoped(wrote, (v) => plural(v, cfg.wroteLabel)), weekZero: weekZero(wrote) });
  const reach = shown(f.reach, fm?.reach, p);
  if (reach) {
    figs.push({
      key: 'reach', value: reach.value,
      caption: scoped(reach, (v) => (cfg.reach === 'connections' ? (v === 1 ? 'new connection' : 'new connections') : (v === 1 ? 'new person reached' : 'new people reached'))),
      weekZero: weekZero(reach),
    });
  }
  if (variant === 'results') {
    const after = shown(f.callsAfterPost, fm?.callsAfterPost, p);
    if (after && !after.weekZero) figs.splice(1, 0, { key: 'after', value: after.value, caption: after.value === 1 ? 'call booked after engaging with a post' : 'calls booked after engaging with a post' });
    const posts = shown(f.postsOut, fm?.postsOut, p);
    if (posts) figs.push({ key: 'posts', value: posts.value, caption: scoped(posts, (v) => (v === 1 ? 'post out' : 'posts out')), weekZero: weekZero(posts) });
  }
  return figs;
}

/** One quiet line under the number row when figures fell back from a short period to its
 *  month or the start (never a "none yet" under every card). */
export function fallbackNote(ctx: ReportCtx, figs: Fig[]): string | null {
  const p = ctx.period;
  const fell = figs.filter((x) => x.weekZero);
  if (!fell.length) return null;
  const scope = fell[0].weekZero as string;
  const when = p.current ? `yet ${p.phrase}` : p.phrase;
  return fell.length === figs.filter((x) => x.key !== 'waiting').length
    ? `Nothing new ${when}; figures above are ${scope}.`
    : `Where a figure says ${scope}, nothing new has come in ${when}.`;
}

export function ReportFigures({ figs, note }: { figs: Fig[]; note?: string | null }) {
  return (
    <>
      <div data-report="figures" className="cb-report-figs" style={{ marginTop: 20 }}>
        {figs.map((fig) => <FigBlock key={fig.key} fig={fig} />)}
      </div>
      {note && <Footnote style={{ marginTop: 14 }}>{note}</Footnote>}
    </>
  );
}

/* ─────────────────────────── Home ─────────────────────────── */

export function ReportHome({ ctx, waiting = 0 }: { ctx: ReportCtx; waiting?: number }) {
  const { f, fm, fAll } = useFigures(ctx);
  return (
    <div data-report="home" style={{ marginBottom: 34, paddingBottom: 30, borderBottom: '1px solid var(--cb-line)' }}>
      <ReportHead ctx={ctx} f={f} fm={fm} fAll={fAll} />
      {(() => { const figs = reportFigures(ctx, f, fm, fAll, 'home', waiting); return <ReportFigures figs={figs} note={fallbackNote(ctx, figs)} />; })()}
    </div>
  );
}

/* ─────────────────────────── Results ─────────────────────────── */

function plateToggle(active: boolean): React.CSSProperties {
  return active
    ? { borderColor: 'var(--cb-accent)', background: 'var(--cb-accent)', color: 'var(--cb-ink)', fontSize: 12, padding: '6px 14px' }
    : { borderColor: 'rgba(255,255,255,0.35)', background: 'none', color: 'var(--cb-plate-ink)', fontSize: 12, padding: '6px 14px' };
}

export function CallsChart({ ctx }: { ctx: ReportCtx }) {
  const [which, setWhich] = React.useState<SeriesKey>('calls');
  const opts: Array<{ k: SeriesKey; label: string }> = [
    { k: 'calls', label: 'Calls booked' },
    ...(ctx.payload ? [{ k: 'wrote' as SeriesKey, label: 'Wrote back' }, { k: 'came' as SeriesKey, label: 'Came to you' }] : []),
  ];
  const s = React.useMemo(() => series(ctx.cfg, ctx.periods, ctx.payload, ctx.board, which), [ctx.cfg, ctx.periods, ctx.payload, ctx.board, which]);
  if (s.points.length < 2) return null;
  const sel = ctx.period;
  let hi = s.points.findIndex((pt) => pt.key === sel.key);
  if (hi < 0 && sel.kind === 'week' && s.unit === 'month') hi = s.points.findIndex((pt) => pt.key === sel.month?.key);
  if (hi < 0) hi = s.points.findIndex((pt) => pt.current);
  const total = s.points.reduce((t, pt) => t + pt.value, 0);
  const what = opts.find((o) => o.k === which)?.label || '';
  return (
    <Plate style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <Num size="hero" tone="accent">{total.toLocaleString('en-GB')}</Num>
          <Footnote on="plate" style={{ marginTop: 6 }}>
            {which === 'came' ? `${ctx.cfg.who[1]} came to you` : which === 'wrote' ? 'people wrote back' : 'calls booked'} since {dm(ctx.cfg.start)}
          </Footnote>
        </div>
        {opts.length > 1 && (
          <div role="group" aria-label="What the chart counts" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {opts.map((o) => <Pill key={o.k} onClick={() => setWhich(o.k)} aria-pressed={o.k === which} style={plateToggle(o.k === which)}>{o.label}</Pill>)}
          </div>
        )}
      </div>
      <Spark
        on="plate"
        values={s.points.map((pt) => pt.value)}
        topLabels={s.points.map((pt) => pt.value)}
        labels={s.points.map((pt) => pt.label)}
        highlight={hi >= 0 ? hi : undefined}
        barPad="clamp(0px, 2.2vw, 28px)"
        height="clamp(190px, 44vw, 260px)"
        style={{ marginTop: 18 }}
      />
      <div style={{ marginTop: 12, fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        <PlateMute>{what}, {s.unit === 'month' ? 'month by month' : 'week by week'}</PlateMute>
      </div>
    </Plate>
  );
}

function SliceLedger({ ctx }: { ctx: ReportCtx }) {
  const rows = React.useMemo(() => slices(ctx.cfg, ctx.period, ctx.periods, ctx.today)
    .map((p) => ({ p, f: computeFigures(ctx.cfg, p, ctx.payload, ctx.board, ctx.audience) })), [ctx]);
  if (rows.length < 2) return null;
  const cols: Array<{ k: string; label: string; get: (f: Figures) => number | null }> = [
    { k: 'calls', label: 'Calls', get: (f) => f.calls.n },
    { k: 'came', label: 'Came to you', get: (f) => f.came?.n ?? null },
    { k: 'wrote', label: 'Wrote back', get: (f) => f.wrote },
    { k: 'reach', label: ctx.cfg.reach === 'connections' ? 'New connections' : 'Reached', get: (f) => f.reach },
  ].filter((c) => c.k === 'calls' || rows.some((r) => (c.get(r.f) || 0) > 0));
  const title = ctx.period.kind === 'all'
    ? (rows[0].p.kind === 'week' ? 'Week by week' : 'Report month by report month')
    : 'Week by week';
  return (
    <div style={{ marginTop: 28 }}>
      <Eyebrow tone="ink">{title}</Eyebrow>
      <Ledger className="cb-report-tbl" style={{ marginTop: 10 }} columns={[{ label: ctx.period.kind === 'all' && rows[0].p.kind !== 'week' ? 'Month' : 'Week' }, ...cols.map((c) => ({ label: c.label, align: 'right' as const, width: '1%' }))]}>
        {rows.map(({ p, f }) => (
          <LedgerRow key={p.key}>
            <LedgerCell valign="middle"><span style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.3 }}>{p.label}</span></LedgerCell>
            {cols.map((c) => { const v = c.get(f) ?? 0; return <LedgerCell key={c.k} num align="right" valign="middle" style={v ? undefined : { color: MUTE, fontWeight: 500 }}>{v}</LedgerCell>; })}
          </LedgerRow>
        ))}
      </Ledger>
    </div>
  );
}

function CameList({ ctx, f, fm }: { ctx: ReportCtx; f: Figures; fm: Figures | null }) {
  const useMonth = !f.came?.n && ctx.period.kind === 'week' && !!fm?.came?.n;
  const src = useMonth ? fm : f;
  const people = src?.came?.people || [];
  if (!people.length) return null;
  const scope = useMonth ? ctx.period.month?.phrase : ctx.period.phrase;
  const day = (ts: string) => { const k = dayKey(ts, ctx.cfg.tz); return k ? dm(k) : ''; };
  return (
    <Card style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <Eyebrow>{ctx.cfg.who[1][0].toUpperCase() + ctx.cfg.who[1].slice(1)} who came to you</Eyebrow>
        <Chip>{people.length} {scope}</Chip>
      </div>
      <div style={{ marginTop: 10 }}>
        {people.map((c, i) => {
          const role = (c.title || '').split('|')[0].trim();
          return (
            <div key={`${c.name}-${i}`} style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', padding: '11px 0', borderTop: i ? '1px solid var(--cb-line)' : undefined }}>
              <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--cb-ink)' }}>{c.name || 'Name not shown'}</div>
                {(role || c.company) && (
                  <div style={{ marginTop: 2, fontSize: 12.5, fontWeight: 600, color: MUTE, lineHeight: 1.4 }}>
                    {role && c.company && !role.toLowerCase().includes(c.company.toLowerCase()) ? `${role}, ${c.company}` : (role || c.company)}
                  </div>
                )}
              </div>
              <div style={{ flex: 'none', fontSize: 12.5, fontWeight: 700, color: MUTE, textAlign: 'right' }}>
                {VIA_ROW[c.via]} · {day(c.at)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PostsLedger({ ctx, f }: { ctx: ReportCtx; f: Figures }) {
  const rows = f.posts;
  if (!rows.length) return null;
  const anyCall = rows.some((r) => r.calls > 0);
  const fitCap = ctx.cfg.fitColumn;
  const head = rows.slice(0, 8);
  const rest = rows.slice(8);
  const row = (r: (typeof rows)[number]) => (
    <LedgerRow key={r.key}>
      <LedgerCell>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: MUTE }}>{dm(r.day)}</div>
        <div style={{ marginTop: 3, fontSize: 14.5, fontWeight: 600, lineHeight: 1.3 }}>
          {r.title.length > 90 ? `${r.title.slice(0, r.title.lastIndexOf(' ', 90))}…` : r.title}
          {r.own && <Chip style={{ marginLeft: 6, padding: '2px 10px', fontSize: 11.5 }}>your own post</Chip>}
        </div>
        <div style={{ marginTop: 5, fontSize: 12.5, fontWeight: 600, color: MUTE }}>
          {r.collected ? null : 'engagement not collected for this post'}
        </div>
      </LedgerCell>
      <LedgerCell num align="right" width="1%" style={r.fit ? undefined : { color: MUTE, fontWeight: 500 }}>{r.collected && r.fit ? r.fit : '–'}</LedgerCell>
      {anyCall && <LedgerCell num align="right" width="1%">{r.calls > 0 ? r.calls : ''}</LedgerCell>}
    </LedgerRow>
  );
  const cols = [
    { label: 'Post' },
    { label: fitCap, align: 'right' as const, width: '1%' },
    ...(anyCall ? [{ label: 'Led to a call', align: 'right' as const, width: '1%' }] : []),
  ];
  return (
    <div id="cb-report-posts" style={{ marginTop: 36 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
        <Eyebrow tone="ink">{ctx.cfg.postsTitle}</Eyebrow>
        <Footnote style={{ marginTop: 0 }}>{rows.length} {rows.length === 1 ? 'post' : 'posts'} {ctx.period.phrase}, {ctx.cfg.postsRank}</Footnote>
      </div>
      <Ledger className="cb-report-tbl" style={{ marginTop: 10 }} columns={cols}>{head.map(row)}</Ledger>
      {rest.length > 0 && (
        <Drill label="open it" summaryLeft={<>The other <b>{rest.length}</b> {rest.length === 1 ? 'post' : 'posts'}</>} style={{ marginTop: 4 }}>
          <Ledger className="cb-report-tbl" columns={cols}>{rest.map(row)}</Ledger>
        </Drill>
      )}
    </div>
  );
}

/** Results: the report for the chosen period, then everything the old page carried,
 *  reads included, folded shut under "More numbers". */
export function ReportResults({ ctx, more }: { ctx: ReportCtx; more: React.ReactNode }) {
  const { f, fm, fAll } = useFigures(ctx);
  return (
    <div data-report="results">
      <ReportHead ctx={ctx} f={f} fm={fm} fAll={fAll} eyebrow="Results" />
      <CallsChart ctx={ctx} />
      {(() => { const figs = reportFigures(ctx, f, fm, fAll, 'results'); return <ReportFigures figs={figs} note={fallbackNote(ctx, figs)} />; })()}
      <SliceLedger ctx={ctx} />
      <CameList ctx={ctx} f={f} fm={fm} />
      <PostsLedger ctx={ctx} f={f} />
      <Drill
        style={{ marginTop: 40 }}
        label="open it"
        summaryLeft={<><b>More numbers</b> <span style={{ color: MUTE, fontWeight: 600 }}>reads, reach and who saw your posts</span></>}
      >
        {more}
      </Drill>
    </div>
  );
}
