import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeekResultsPlate } from './WeekResultsPlate';

const truth = {
  counted_at: '2026-09-28T22:00:00Z',
  booked: [
    { name: 'Ann Able', company: 'A Co', booked_at: '2026-09-22T15:00:00Z' },
    { name: 'Ben Bold', company: 'B Co', booked_at: '2026-09-15T16:00:00Z' },
    { name: 'Cy Cole', company: 'C Co', booked_at: '2026-09-16T16:00:00Z' },
  ],
  replied_7d: [{ name: 'x', reply_intent: 'positive' }, { name: 'y', reply_intent: 'negative' }],
  replied_weekly: [
    { week_monday: '2026-09-07', people: 10 },
    { week_monday: '2026-09-14', people: 12 },
    { week_monday: '2026-09-21', people: 9 },
    { week_monday: '2026-09-28', people: 1 },
  ],
  funnel: { contacted: 300 },
};

describe('WeekResultsPlate', () => {
  const html = renderToStaticMarkup(<WeekResultsPlate truth={truth} today="2026-09-28" tz="America/Los_Angeles" onSeeAll={() => {}} />);
  it('leads with calls booked in the month, then who', () => {
    expect(html).toMatch(/>3<\/span><span class="cb-wr-l">calls booked<br\/>in September/);
    expect(html).toContain('Ann, Cy and Ben');
    expect(html).toContain('1 call booked last week, down from 2 the week before.');
  });
  it('says who wrote back and hatches the running week', () => {
    expect(html).toContain('wrote back in the last 7 days. 1 of them was positive.');
    expect(html).toContain('cb-wr-col now');
    expect(html).toContain('This week, still counting');
    expect(html).toContain('See every call and reply');
  });
  it('never asks the client for anything', () => {
    expect(html).not.toMatch(/your turn|reply to them|needs you|waiting on you/i);
  });
  it('renders nothing without the counted blob', () => {
    expect(renderToStaticMarkup(<WeekResultsPlate truth={null} today="2026-09-28" tz="America/Los_Angeles" />)).toBe('');
  });
});
