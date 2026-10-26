import { describe, it, expect } from 'vitest';
import { reportPeriods, outreachDefaultPeriod, computeFigures, shown, series, slices, REPORT_CONFIGS, type ReportPayload } from './reportModel';

const RISE = REPORT_CONFIGS['risedtc-com'];
const ARCH = REPORT_CONFIGS['arch-agency'];
const emptyBoard = { queue: [], outreach_truth: { booked: [] }, performance: { posts: [] } };

describe('report periods', () => {
  it('RISE: report months on the 17th back to the 21 Jul start, then since the start', () => {
    const ps = reportPeriods(RISE, '2026-09-27');
    expect(ps.filter((p) => p.kind !== 'week').map((p) => [p.start, p.end])).toEqual([
      ['2026-09-17', '2026-10-17'], ['2026-08-17', '2026-09-17'], ['2026-07-21', '2026-08-17'], ['2026-07-21', '2026-09-28'],
    ]);
    expect(ps[0].current).toBe(true);
    expect(ps[1].phrase).toBe('between 17 Aug and 17 Sept');
    expect(ps.map((p) => p.label).join(' ')).not.toMatch(/still counting/i);
  });
  it('RISE also lists Mon-Sun weeks after its months, and the Outreach tab opens on this week', () => {
    const ps = reportPeriods(RISE, '2026-10-12');
    expect(ps[0].kind).toBe('month');
    const weeks = ps.filter((p) => p.kind === 'week');
    expect(weeks[0]).toMatchObject({ start: '2026-10-12', end: '2026-10-13', current: true, phrase: 'this week' });
    expect(weeks[1]).toMatchObject({ start: '2026-10-05', end: '2026-10-12', phrase: 'last week' });
    expect(weeks[weeks.length - 1].start).toBe('2026-07-21');
    expect(weeks[0].month?.start).toBe('2026-09-17');
    expect(outreachDefaultPeriod(ps).key).toBe(weeks[0].key);
    expect(outreachDefaultPeriod(reportPeriods(ARCH, '2026-10-12')).start).toBe('2026-10-12');
  });
  it('RISE rolls by itself on the 17th', () => {
    expect(reportPeriods(RISE, '2026-10-16')[0].start).toBe('2026-09-17');
    expect(reportPeriods(RISE, '2026-10-17')[0].start).toBe('2026-10-17');
  });
  it('ARCH: Mon-Sun weeks from Mon 31 Aug, then billing months on the 18th reaching back to the start, then since the start', () => {
    const ps = reportPeriods(ARCH, '2026-09-28');
    const weeks = ps.filter((p) => p.kind === 'week');
    expect(weeks.map((w) => w.start)).toEqual(['2026-09-28', '2026-09-21', '2026-09-14', '2026-09-07', '2026-08-31']);
    const months = ps.filter((p) => p.kind === 'month');
    expect(months.map((m) => [m.start, m.end])).toEqual([['2026-09-18', '2026-10-18'], ['2026-08-31', '2026-09-18']]);
    expect(weeks[0].month?.key).toBe(months[0].key);
    expect(ps[ps.length - 1].label).toBe('Since the start (31 Aug)');
  });
  it('ARCH: billing month runs 18th to 18th, the board still opens on this week (26 Oct)', () => {
    const today = '2026-10-26';
    const ps = reportPeriods(ARCH, today);
    expect(ps[0]).toMatchObject({ kind: 'week', start: '2026-10-26', current: true });
    const months = ps.filter((p) => p.kind === 'month');
    expect(months.map((m) => [m.start, m.end])).toEqual([
      ['2026-10-18', '2026-11-18'], ['2026-09-18', '2026-10-18'], ['2026-08-31', '2026-09-18'],
    ]);
    expect(months[0]).toMatchObject({ current: true, phrase: 'since 18 Oct' });
    expect(months[1].phrase).toBe('between 18 Sept and 18 Oct');
    expect(ps[0].month?.phrase).toBe('since 18 Oct');
    const all = ps.find((p) => p.kind === 'all')!;
    expect(slices(ARCH, all, ps, today).map((r) => r.label)).toEqual(['31 Aug to 18 Sept', '18 Sept to 18 Oct', '18 Oct to today']);
    expect(series(ARCH, ps, null, emptyBoard, 'calls').points.map((pt) => pt.label)).toEqual(['31 Aug', '18 Sept', '18 Oct']);
    expect(reportPeriods(ARCH, '2026-11-17')[0].month?.start).toBe('2026-10-18');
    expect(reportPeriods(ARCH, '2026-11-18')[0].month?.start).toBe('2026-11-18');
  });
});

describe('figures', () => {
  const payload: ReportPayload = {
    client: 'risedtc', start_date: '2026-07-21',
    people: [
      { n: 'Karin Nelson', bk: '2026-09-22T15:14:42Z', w: ['2026-09-20T10:00:00Z'], y: ['2026-09-20T10:00:00Z'], conn: '2026-09-18T10:00:00Z' },
      { n: 'Trent Hill', bk: '2026-09-17T16:19:15Z', w: ['2026-08-30T10:00:00Z'] },
      { n: 'Old', bk: '2026-08-20T10:00:00Z' },
    ],
    came: [{ name: 'Max', via: 'asked', at: '2026-09-18T10:00:00Z' }],
    engaged: [
      { p: 'urn:li:activity:1111111111111111111', k: 'a', at: '2026-09-23T10:00:00Z', fit: true, checked: true, new: true },
      { p: 'urn:li:activity:1111111111111111111', k: 'b', at: '2026-09-23T10:00:00Z', fit: false, checked: true, new: true },
    ],
    posts: [{ p: 'urn:li:activity:1111111111111111111', at: '2026-09-23T15:00:00Z', title: 'A post' }],
    assists: [],
  };
  it('counts a period by the client zone day and names the calls, newest first', () => {
    const [cur] = reportPeriods(RISE, '2026-09-27');
    const f = computeFigures(RISE, cur, payload, emptyBoard, null);
    expect(f.calls).toEqual({ n: 2, names: ['Karin Nelson', 'Trent Hill'] });
    expect(f.came?.n).toBe(1);
    expect(f.wrote).toBe(1);
    expect(f.fitEngaged).toEqual({ n: 1, of: 2 });
    expect(f.posts[0]).toMatchObject({ title: 'A post', fit: 1, engaged: 2, own: true });
  });
  it('lists a published queue post whose metrics row has not synced yet, so the list matches posts out', () => {
    const [cur] = reportPeriods(RISE, '2026-09-29');
    const board = { ...emptyBoard, queue: [
      { id: 'q1', stage: 'published', hook: 'A post', published_at: '2026-09-23T15:00:00Z', social_id: 'urn:li:activity:1111111111111111111' },
      { id: 'q2', stage: 'published', hook: 'Carousel that just went out', publish_date: '2026-09-28' },
      { id: 'q3', stage: 'scheduled', hook: 'Not out yet', publish_date: '2026-09-30' },
    ] };
    const f = computeFigures(RISE, cur, payload, board, null);
    expect(f.postsOut).toBe(2);
    expect(f.posts).toHaveLength(2);
    expect(f.posts.find((r) => r.key === 'q2')).toMatchObject({ title: 'Carousel that just went out', collected: false, own: false, fit: null });
    expect(f.posts.find((r) => r.title === 'A post')).toMatchObject({ own: false, fit: 1 });
  });
  it('falls back to outreach_truth.booked without the report read, de-duplicating a person', () => {
    const [cur] = reportPeriods(RISE, '2026-09-27');
    const board = { ...emptyBoard, outreach_truth: { booked: [
      { name: 'Karin Nelson', booked_at: '2026-09-22T15:14:42Z' },
      { name: 'Karin Nelson', booked_at: '2026-09-22T15:14:42Z' },
    ] } };
    const f = computeFigures(RISE, cur, null, board, null);
    expect(f.calls.n).toBe(1);
    expect(f.came).toBeNull();
    expect(f.wrote).toBeNull();
  });
  it('the zero rule: a short week falls back to the month, a month 0 is hidden', () => {
    const [week] = reportPeriods(ARCH, '2026-09-28');
    expect(shown(0, 2, week)).toEqual({ value: 2, scope: 'since 18 Sept', weekZero: true });
    expect(shown(0, 0, week)).toBeNull();
    const month = reportPeriods(RISE, '2026-09-27')[0];
    expect(shown(0, null, month)).toBeNull();
    expect(shown(3, null, month)).toEqual({ value: 3, scope: null, weekZero: false });
  });
  it('the chart draws report months, or weeks while there are fewer than three months', () => {
    const rp = reportPeriods(RISE, '2026-09-27');
    expect(series(RISE, rp, payload, emptyBoard, 'calls').points.map((p) => p.value)).toEqual([0, 1, 2]);
    const ap = reportPeriods(ARCH, '2026-09-28');
    expect(series(ARCH, ap, null, emptyBoard, 'calls').unit).toBe('week');
  });
  it('slices a report month into 7-day rows and never labels one still counting', () => {
    const rp = reportPeriods(RISE, '2026-09-27');
    const rows = slices(RISE, rp[0], rp, '2026-09-27');
    expect(rows.map((r) => r.label)).toEqual(['17 Sept to 23 Sept', '24 Sept to today']);
  });
});
