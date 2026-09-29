/**
 * WeekResultsPlate: the results block that opens the week page (RISE).
 *
 * v2 (2026-09-29, Ivan: "don't change the numbers"): every figure is the report period's,
 * from the same model and with the same words as the panel's report headline and figures
 * (reportModel / ReportBlocks): calls booked for the period and who, the since-the-start
 * count, who came to you, people who wrote back for the first time, founders who said yes.
 * The chart is the report model's own 7-day slices (the "Week by week" table's rows), so
 * its bars add up to those figures. No calendar month, no "last 7 days", nothing that is
 * not already on the panel. The period follows the picker in "All numbers" below it.
 * The block asks nothing of the client: no "your turn", no reply prompts.
 */
import React from 'react';
import { Plate, Eyebrow, PlateRule } from './desk-kit';
import { useFigures, callsLead, reportFigures, type ReportCtx } from './report/ReportBlocks';
import { sliceSeries, axisLabel, namesLine, initialsOf } from './weekResults';

const CSS = `
.cb-wr-hero { display: flex; align-items: flex-end; gap: 14px; margin-top: 12px; }
.cb-wr-n { font-family: var(--cb-serif); font-weight: 700; font-size: clamp(76px, 22vw, 104px); line-height: .8; color: var(--cb-accent); font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
.cb-wr-l { font-family: var(--cb-serif); font-weight: 400; font-size: clamp(21px, 5.6vw, 26px); line-height: 1.12; padding-bottom: 2px; color: var(--cb-plate-ink); }
.cb-wr-av { display: flex; flex: none; }
.cb-wr-av span { width: 38px; height: 38px; border-radius: 50%; background: var(--cb-accent); color: #111; font: 800 11px/1 var(--cb-body); letter-spacing: .02em; display: grid; place-items: center; border: 2px solid var(--cb-plate); margin-left: -6px; }
.cb-wr-av span:first-child { margin-left: 0; }
.cb-wr-av span.more { background: #4a4a47; color: #fff; }
.cb-wr-chart { display: grid; gap: 6px; align-items: end; height: 132px; margin-top: 16px; list-style: none; padding: 0; }
.cb-wr-col { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; gap: 4px; min-width: 0; }
.cb-wr-v { font-size: 11px; font-weight: 700; color: #D6D6D0; font-variant-numeric: tabular-nums; }
.cb-wr-b { width: 100%; max-width: 44px; background: #6B6B66; border-radius: 4px 4px 0 0; min-height: 2px; }
.cb-wr-col.now .cb-wr-b { background: repeating-linear-gradient(45deg, #6B6B66 0 3px, #3a3a37 3px 6px); }
.cb-wr-col.in .cb-wr-b { background: #8f8f88; }
.cb-wr-dots { display: flex; flex-wrap: wrap-reverse; gap: 2px; justify-content: center; min-height: 7px; max-width: 26px; }
.cb-wr-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--cb-accent); display: block; }
.cb-wr-axis { display: grid; gap: 6px; margin-top: 6px; }
.cb-wr-axis span { font-size: 10px; color: var(--cb-plate-mute); text-align: center; white-space: nowrap; overflow: hidden; }
.cb-wr-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 12px; font-size: 12px; color: var(--cb-plate-mute); }
.cb-wr-legend i { display: inline-block; width: 9px; height: 9px; border-radius: 2px; background: #6B6B66; margin-right: 5px; vertical-align: -1px; }
.cb-wr-legend i.d { border-radius: 50%; background: var(--cb-accent); }
.cb-wr-legend i.h { background: repeating-linear-gradient(45deg, #6B6B66 0 2px, #3a3a37 2px 4px); }
.cb-wr-link { display: inline-block; margin-top: 18px; font: 800 14px var(--cb-body); color: var(--cb-plate-ink); background: none; border: 0; padding: 0 0 2px; border-bottom: 2px solid var(--cb-accent); cursor: pointer; }
.cb-wr-link:focus-visible { outline: 2px solid var(--cb-accent); outline-offset: 3px; }
@media (min-width: 900px) {
  .cb-wr-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 36px; align-items: start; }
  .cb-wr-grid > .cb-wr-right { border-left: 1px solid rgba(255,255,255,0.14); padding-left: 32px; }
  .cb-wr-grid > .cb-wr-right > .cb-plate-rule { display: none; }
}
`;

export function WeekResultsPlate({ ctx, onSeeAll, style }: {
  ctx: ReportCtx;
  /** Opens the Outreach tab. Absent = no link. */
  onSeeAll?: () => void;
  style?: React.CSSProperties;
}) {
  const { f, fm, fAll } = useFigures(ctx);
  const bars = React.useMemo(() => sliceSeries(ctx).slice(-9), [ctx]);
  const lead = callsLead(ctx, f, fm, fAll);
  const figs = reportFigures(ctx, f, fm, fAll, 'home');
  const fig = (k: string) => figs.find((x) => x.key === k);
  const calls = fig('calls');
  const came = fig('came');
  const wrote = fig('wrote');
  const yes = fig('yes');
  const who = ctx.cfg.who;
  const shownNames = lead.names.slice(0, 4);
  const extra = lead.names.length - shownNames.length;
  const top = Math.max(1, ...bars.map((b) => b.wrote));
  const cols = { gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` };
  const p = ctx.period;
  const inPeriod = (b: { start: string }) => b.start >= p.start && b.start < p.end;
  const now = bars.find((b) => b.current);

  return (
    <Plate style={{ marginTop: 18, borderRadius: '25px 8px 8px 8px', ...style }} pad="clamp(20px, 2.6vw, 30px) clamp(18px, 3vw, 34px)">
      <style>{CSS}</style>
      <div className="cb-wr-grid" data-week-results="">
        <div>
          <Eyebrow on="plate" style={{ color: 'var(--cb-accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden style={{ width: 18, height: 1, background: 'var(--cb-accent)', display: 'inline-block', flex: 'none' }} />
            {p.eyebrow}
          </Eyebrow>
          <div className="cb-wr-hero">
            <span className="cb-wr-n num" data-metric="">{lead.n}</span>
            <span className="cb-wr-l">{lead.n === 1 ? 'call' : 'calls'} booked<br />{lead.phrase}</span>
          </div>
          {calls?.sub && <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.45, color: 'var(--cb-plate-mute)' }}>{calls.sub}</div>}
          {lead.none && <div style={{ marginTop: 6, fontSize: 13.5, color: 'var(--cb-plate-mute)' }}>{lead.none}</div>}
          {lead.names.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <div className="cb-wr-av" aria-hidden>
                {shownNames.map((n) => <span key={n} title={n}>{initialsOf(n)}</span>)}
                {extra > 0 && <span className="more">+{extra}</span>}
              </div>
              <div style={{ minWidth: 0, fontSize: 14, lineHeight: 1.35, color: '#E8E8E3' }}>{namesLine(lead.names)}</div>
            </div>
          )}
          {came && (
            <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.45, fontWeight: 700, color: 'var(--cb-plate-ink)' }}>
              {came.value} {came.value === 1 ? who[0] : who[1]} came to you on their own{came.sub ? `: ${came.sub}` : ''}.
            </div>
          )}
        </div>

        <div className="cb-wr-right">
          <PlateRule gap={18} style={{ marginBottom: 16 }} />
          {(wrote || yes) && (
            <div style={{ fontFamily: 'var(--cb-serif)', fontSize: 'clamp(17px, 4.4vw, 19px)', lineHeight: 1.3, color: 'var(--cb-plate-ink)' }}>
              {wrote && <><b style={{ color: 'var(--cb-accent)' }}>{wrote.value}</b> {wrote.caption}{wrote.weekZero ? '' : ` ${p.phrase}`}.</>}
              {yes && <> <b style={{ color: 'var(--cb-accent)' }}>{yes.value}</b> {yes.caption}.</>}
            </div>
          )}
          {bars.length >= 3 && (
            <>
              <ol className="cb-wr-chart" style={cols} data-viz="" aria-label="People who wrote back for the first time, week by week, with a dot for every call booked">
                {bars.map((b) => (
                  <li key={b.key} className={`cb-wr-col${b.current ? ' now' : inPeriod(b) ? ' in' : ''}`} data-slice={b.label}>
                    <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                      {b.label}: {b.wrote} wrote back for the first time, {b.calls} {b.calls === 1 ? 'call' : 'calls'} booked.
                    </span>
                    <span className="cb-wr-dots" aria-hidden>
                      {b.calls > 5 ? <b style={{ fontSize: 10.5, color: 'var(--cb-accent)' }}>{b.calls}</b> : Array.from({ length: b.calls }, (_, i) => <i key={i} />)}
                    </span>
                    <span className="cb-wr-v" aria-hidden>{b.wrote}</span>
                    <span className="cb-wr-b" aria-hidden style={{ height: `${Math.max(2, (b.wrote / top) * 72)}%` }} />
                  </li>
                ))}
              </ol>
              <div className="cb-wr-axis" style={cols} aria-hidden>
                {bars.map((b, i) => <span key={b.key}>{axisLabel(bars, i)}</span>)}
              </div>
              <div className="cb-wr-legend" aria-hidden>
                <span><i />Wrote back for the first time</span>
                <span><i className="d" />Call booked</span>
                {now && <span><i className="h" />{now.label}</span>}
              </div>
            </>
          )}
          {onSeeAll && <button type="button" className="cb-wr-link" onClick={onSeeAll}>See every call and reply →</button>}
        </div>
      </div>
    </Plate>
  );
}

export default WeekResultsPlate;
