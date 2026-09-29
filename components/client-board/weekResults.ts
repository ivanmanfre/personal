/**
 * weekResults: the series behind the results plate on the week page and the weekly chart on
 * the Results trial (v2, 2026-09-29).
 *
 * ONE MODEL. Every figure here comes from reportModel.computeFigures over the board's own
 * report periods, the same call the panel's figures, headline and "Week by week" table
 * make. The weekly buckets are the report model's 7-day slices of each report month (RISE:
 * 17 Sept to 23 Sept, 24 Sept to today, ...), so the bars inside the chosen period add up
 * to the period's figures exactly, and every bar since the start adds up to the
 * since-the-start figures. v1 used calendar months, the last 7 days and Mon-Sun weeks off
 * outreach_truth, which printed numbers the rest of the panel did not (Ivan, 29 Sept).
 */
import { computeFigures, slices, dm, type Period, type ReportConfig, type ReportPayload, type ReportBoardSlice } from './report/reportModel';

export type SliceBar = {
  key: string;
  /** The slice as the "Week by week" table names it: "17 Sept to 23 Sept", "24 Sept to today". */
  label: string;
  /** First day, for the chart axis: "17 Sept". */
  start: string;
  end: string;
  current: boolean;
  calls: number;
  wrote: number;
  reach: number;
  came: number;
};

type Ctxish = { cfg: ReportConfig; periods: Period[]; payload: ReportPayload | null; board: ReportBoardSlice; today: string };

/** The 7-day slices of every report month since the start, oldest first. */
export function sliceSeries(ctx: Ctxish): SliceBar[] {
  const months = ctx.periods.filter((p) => p.kind === 'month').slice().reverse();
  const out: SliceBar[] = [];
  for (const m of months) {
    for (const s of slices(ctx.cfg, m, ctx.periods, ctx.today)) {
      const f = computeFigures(ctx.cfg, s, ctx.payload, ctx.board, null);
      out.push({
        key: s.key, label: s.label, start: s.start, end: s.end, current: s.current,
        calls: f.calls.n, wrote: f.wrote ?? 0, reach: f.reach ?? 0, came: f.came?.n ?? 0,
      });
    }
  }
  return out;
}

/** Axis label for a slice: its first day, the month only when it changes ("17 Aug", "24", "31", "7 Sept"). */
export function axisLabel(bars: SliceBar[], i: number): string {
  const k = bars[i].start;
  const prev = i > 0 ? bars[i - 1].start : null;
  return !prev || prev.slice(5, 7) !== k.slice(5, 7) ? dm(k) : String(parseInt(k.slice(8, 10), 10));
}

export function initialsOf(name: string): string {
  const parts = name.replace(/[^\p{L}\s'-]/gu, ' ').split(/\s+/).filter(Boolean);
  const a = parts[0]?.charAt(0) ?? '';
  const b = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (a + b).toUpperCase() || '?';
}

/** The report headline's own name list: "A", "A and B", "A, B and C", "A, B, C and 2 more". */
export function namesLine(names: string[], max = 3): string {
  const xs = names.filter(Boolean);
  if (!xs.length) return '';
  const shown = xs.slice(0, max);
  const rest = xs.length - shown.length;
  if (rest > 0) return `${shown.join(', ')} and ${rest} more`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}
