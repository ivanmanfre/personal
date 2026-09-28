/**
 * WeekResultsPlate: the results block that opens the week page (2026-09-29, approved from
 * the week-view mockup). One dark plate, in the board's own accent:
 *   1  calls booked in the month (the last 30 days during a month's first week), big
 *   2  the window before + the running total, then who booked (initials + first names)
 *   3  last week's pace against the week before, plainly, even when it is down
 *   4  who wrote back in the last 7 days and how many of them were positive
 *   5  replies per week with a dot per call booked; the week in progress is hatched
 *   6  a link to the Outreach tab
 * Every number comes from ./weekResults, which reads only board.outreach_truth. The block
 * asks nothing of the client: no "your turn", no reply prompts.
 */
import React from 'react';
import { Plate, Eyebrow, PlateRule } from './desk-kit';
import { weekResults, resultsSubline, namesLine, firstNameOf, initialsOf, dayMonth, type WeekResultsTruth } from './weekResults';

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

export function WeekResultsPlate({ truth, today, tz, onSeeAll, style }: {
  truth: WeekResultsTruth;
  /** Today, YYYY-MM-DD, in the board's zone. */
  today: string;
  tz: string;
  /** Opens the Outreach tab. Absent = no link. */
  onSeeAll?: () => void;
  style?: React.CSSProperties;
}) {
  const r = React.useMemo(() => weekResults(truth, today, tz), [truth, today, tz]);
  if (!r) return null;
  const shownPeople = r.people.slice(0, 4);
  const extra = r.people.length - shownPeople.length;
  const top = Math.max(1, ...r.weeks.map((w) => w.people));
  const cols = { gridTemplateColumns: `repeat(${r.weeks.length}, minmax(0, 1fr))` };
  const axisLabel = (mon: string, i: number, current: boolean) => {
    if (current) return 'now';
    const prev = i > 0 ? r.weeks[i - 1].monday : null;
    return !prev || prev.slice(5, 7) !== mon.slice(5, 7) ? dayMonth(mon) : String(parseInt(mon.slice(8, 10), 10));
  };
  const nowWeek = r.weeks.find((w) => w.current);

  return (
    <Plate style={{ marginTop: 18, borderRadius: '25px 8px 8px 8px', ...style }} pad="clamp(20px, 2.6vw, 30px) clamp(18px, 3vw, 34px)">
      <style>{CSS}</style>
      <div className="cb-wr-grid" data-week-results="">
        <div>
          <Eyebrow on="plate" style={{ color: 'var(--cb-accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden style={{ width: 18, height: 1, background: 'var(--cb-accent)', display: 'inline-block' }} />
            From your outreach
          </Eyebrow>
          <div className="cb-wr-hero">
            <span className="cb-wr-n num" data-metric="">{r.n}</span>
            <span className="cb-wr-l">{r.n === 1 ? 'call' : 'calls'} booked<br />{r.label}</span>
          </div>
          <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.45, color: 'var(--cb-plate-mute)' }}>{resultsSubline(r)}</div>
          {r.people.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <div className="cb-wr-av" aria-hidden>
                {shownPeople.map((p) => <span key={p.name + p.day} title={p.company ? `${p.name}, ${p.company}` : p.name}>{initialsOf(p.name)}</span>)}
                {extra > 0 && <span className="more">+{extra}</span>}
              </div>
              <div style={{ minWidth: 0, fontSize: 13.5, lineHeight: 1.35, color: '#E8E8E3' }}>{namesLine(r.people.map((p) => firstNameOf(p.name)))}</div>
            </div>
          )}
          {r.pace && (
            <div data-week-results-pace="" style={{ marginTop: 14, fontSize: 14, lineHeight: 1.45, fontWeight: 700, color: 'var(--cb-plate-ink)' }}>{r.pace}</div>
          )}
        </div>

        <div className="cb-wr-right">
          <PlateRule gap={18} style={{ marginBottom: 16 }} />
          <div style={{ fontFamily: 'var(--cb-serif)', fontSize: 'clamp(17px, 4.4vw, 19px)', lineHeight: 1.3, color: 'var(--cb-plate-ink)' }}>
            {r.wrote.n > 0 ? (
              <><b style={{ color: 'var(--cb-accent)' }}>{r.wrote.n} {r.wrote.n === 1 ? 'person' : 'people'}</b> wrote back in the last 7 days. {r.wrote.positive} of them {r.wrote.positive === 1 ? 'was' : 'were'} positive.</>
            ) : (
              <>Nobody wrote back in the last 7 days.</>
            )}
          </div>
          {r.weeks.length >= 3 && (
            <>
              <ol className="cb-wr-chart" style={cols} data-viz="" aria-label="People who wrote back each week, with a dot for every call booked that week">
                {r.weeks.map((w) => (
                  <li key={w.monday} className={`cb-wr-col${w.current ? ' now' : ''}`}>
                    <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                      Week of {dayMonth(w.monday)}{w.current ? ', still counting' : ''}: {w.people} wrote back, {w.calls} {w.calls === 1 ? 'call' : 'calls'} booked.
                    </span>
                    <span className="cb-wr-dots" aria-hidden>
                      {w.calls > 5 ? <b style={{ fontSize: 10.5, color: 'var(--cb-accent)' }}>{w.calls}</b> : Array.from({ length: w.calls }, (_, i) => <i key={i} />)}
                    </span>
                    <span className="cb-wr-v" aria-hidden>{w.people}</span>
                    <span className="cb-wr-b" aria-hidden style={{ height: `${Math.max(2, (w.people / top) * 72)}%` }} />
                  </li>
                ))}
              </ol>
              <div className="cb-wr-axis" style={cols} aria-hidden>
                {r.weeks.map((w, i) => <span key={w.monday}>{axisLabel(w.monday, i, w.current)}</span>)}
              </div>
              <div className="cb-wr-legend" aria-hidden>
                <span><i />Wrote back</span>
                <span><i className="d" />Call booked</span>
                {nowWeek && <span><i className="h" />This week, still counting</span>}
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
