import { describe, it, expect } from 'vitest';
import { weekResults, resultsSubline, namesLine, initialsOf } from './weekResults';

const TZ = 'America/Los_Angeles';
const truth = {
  counted_at: '2026-09-28T22:00:00Z',
  booked: [
    { name: 'Ann Able', company: 'A Co', booked_at: '2026-09-22T15:00:00Z' },
    { name: 'Ben Bold', company: 'B Co', booked_at: '2026-09-15T16:00:00Z' },
    { name: 'Cy Cole', company: 'C Co', booked_at: '2026-09-16T16:00:00Z' },
    { name: 'Cy Cole', company: 'C Co', booked_at: '2026-09-16T17:00:00Z' }, // duplicate row
    { name: 'Dee Dunn', company: null, booked_at: '2026-09-02T03:00:00Z' }, // 1 Sept in LA
    { name: 'Eve Eng', company: 'E Co', booked_at: '2026-08-20T16:00:00Z' },
  ],
  replied_7d: [{ name: 'x', reply_intent: 'positive' }, { name: 'y', reply_intent: 'negative' }, { name: 'z', reply_intent: null }],
  replied_weekly: [
    { week_monday: '2026-09-07', people: 10 },
    { week_monday: '2026-09-14', people: 12 },
    { week_monday: '2026-09-21', people: 9 },
    { week_monday: '2026-09-28', people: 1 },
  ],
  funnel: { contacted: 1200 },
};

describe('weekResults', () => {
  it('counts the calendar month in the board zone, one row per person', () => {
    const r = weekResults(truth, '2026-09-28', TZ)!;
    expect(r.window).toBe('month');
    expect(r.label).toBe('in September');
    expect(r.n).toBe(4);
    expect(r.people.map((p) => p.name)).toEqual(['Ann Able', 'Cy Cole', 'Ben Bold', 'Dee Dunn']);
    expect(r.prev).toEqual({ n: 1, label: 'in August' });
    expect(r.total).toBe(5);
    expect(resultsSubline(r)).toBe('1 in August. 5 since the first one on 20 Aug, from 1,200 people contacted.');
  });

  it('uses the last 30 days during the first 7 days of a month, and says so', () => {
    const r = weekResults(truth, '2026-10-03', TZ)!;
    expect(r.window).toBe('30d');
    expect(r.label).toBe('in the last 30 days');
    expect(r.n).toBe(3); // 4 Sept to 3 Oct: the 1 Sept booking falls out
    expect(r.prev.n).toBe(2);
    expect(r.prev.label).toBe('in the 30 days before');
  });

  it('states a slowdown plainly', () => {
    const r = weekResults(truth, '2026-09-28', TZ)!;
    expect(r.pace).toBe('1 call booked last week, down from 2 the week before.');
    const flat = weekResults({ ...truth, booked: truth.booked.slice(4) }, '2026-09-28', TZ)!;
    expect(flat.pace).toBe('No calls booked in the last two weeks.');
  });

  it('counts who wrote back in 7 days and the positive ones', () => {
    expect(weekResults(truth, '2026-09-28', TZ)!.wrote).toEqual({ n: 3, positive: 1 });
  });

  it('drops calls onto their week and marks the running week', () => {
    const w = weekResults(truth, '2026-09-28', TZ)!.weeks;
    expect(w.map((x) => x.calls)).toEqual([0, 2, 1, 0]);
    expect(w.map((x) => x.current)).toEqual([false, false, false, true]);
  });

  it('returns null without a counted blob', () => {
    expect(weekResults(null, '2026-09-28', TZ)).toBeNull();
    expect(weekResults({ booked: [] }, '2026-09-28', TZ)).toBeNull();
  });

  it('names and initials', () => {
    expect(namesLine(['A', 'B', 'C', 'D', 'E', 'F'])).toBe('A, B, C, D and 2 more');
    expect(namesLine(['A', 'B'])).toBe('A and B');
    expect(initialsOf('\u{1FAD3} Alexander Harik')).toBe('AH');
  });
});
