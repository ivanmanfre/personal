import { describe, it, expect } from 'vitest';
import { sliceSeries, axisLabel, namesLine, initialsOf } from './weekResults';
import { computeFigures, reportPeriods, REPORT_CONFIGS, type ReportPayload } from './report/reportModel';

/** Test-only fabrication shaped like the client_board_report payload. */
const payload: ReportPayload = {
  client: 'risedtc', start_date: '2026-07-21',
  people: [
    { n: 'Ann Able', bk: '2026-09-22T15:00:00Z', w: ['2026-09-20T10:00:00Z'], conn: '2026-09-18T10:00:00Z' },
    { n: 'Ben Bold', bk: '2026-09-17T16:00:00Z', w: ['2026-09-25T10:00:00Z'], conn: '2026-09-26T10:00:00Z' },
    { n: 'Cy Cole', bk: '2026-08-20T10:00:00Z', w: ['2026-08-19T10:00:00Z'], conn: '2026-08-12T10:00:00Z' },
    { n: 'Dee Dunn', w: ['2026-07-25T10:00:00Z'], conn: '2026-07-22T10:00:00Z' },
    { n: 'Eve Eng', w: ['2026-09-15T10:00:00Z'], conn: '2026-09-01T10:00:00Z' },
  ],
  came: [], engaged: [], posts: [], assists: [],
};
const cfg = REPORT_CONFIGS['risedtc-com'];
const today = '2026-09-29';
const periods = reportPeriods(cfg, today);
const ctx = { cfg, periods, payload, board: { queue: [] }, today };

describe('sliceSeries: one model with the panel', () => {
  const bars = sliceSeries(ctx);
  it('is the report months cut into the Week by week table rows', () => {
    expect(bars[0].label).toBe('21 Jul to 27 Jul');
    expect(bars.find((b) => b.start === '2026-09-17')?.label).toBe('17 Sept to 23 Sept');
    expect(bars[bars.length - 1].label).toBe('24 Sept to today');
    expect(bars[bars.length - 1].current).toBe(true);
  });
  it('adds up exactly to every period figure the panel prints', () => {
    for (const p of periods) {
      const f = computeFigures(cfg, p, payload, { queue: [] }, null);
      const inP = bars.filter((b) => b.start >= p.start && b.start < p.end);
      expect(inP.reduce((t, b) => t + b.calls, 0)).toBe(f.calls.n);
      expect(inP.reduce((t, b) => t + b.wrote, 0)).toBe(f.wrote);
      expect(inP.reduce((t, b) => t + b.reach, 0)).toBe(f.reach);
    }
  });
  it('labels the axis by first day, the month only when it changes', () => {
    const i = bars.findIndex((b) => b.start === '2026-09-17');
    expect(axisLabel(bars, 0)).toBe('21 Jul');
    expect(axisLabel(bars, i)).toBe('17');
  });
});

describe('names', () => {
  it('matches the report headline list', () => {
    expect(namesLine(['A', 'B', 'C', 'D', 'E'])).toBe('A, B, C and 2 more');
    expect(namesLine(['A', 'B'])).toBe('A and B');
    expect(initialsOf('\u{1FAD3} Alexander Harik')).toBe('AH');
  });
});
