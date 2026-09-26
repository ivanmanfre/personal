// @vitest-environment jsdom
/**
 * Calendar grids vs the VIEWER's timezone (27 Sep). Both calendars must place a post on the
 * date it carries and print every date exactly once, whatever zone the browser sits in:
 *  (a) CalendarSurface (#calendar) put every post one cell late for viewers east of UTC
 *      (Mon 28 Sep on Tue 29 in Europe/Warsaw and Asia/Jerusalem), because the cell key was
 *      toISOString() of a LOCAL midnight;
 *  (b) CalendarSurface and DeskCalendarStrip stepped days by 24h of milliseconds, so the
 *      viewer's DST change printed one date twice ("24, 25, 25, 26" Oct in Europe, "31, 1,
 *      1, 2" in LA) and pushed every later post to the wrong weekday.
 * Node honours a runtime change of process.env.TZ, so each case forces the viewer zone.
 */
import { describe, it, expect, afterAll } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarSurface } from '../ClientBoardPage';
import DeskCalendarStrip from './DeskCalendarStrip';
import type { Board, QueueItem } from '../ClientBoardPage';

const ORIGINAL_TZ = process.env.TZ;
afterAll(() => { process.env.TZ = ORIGINAL_TZ; });

const post = (id: string, date: string, title: string): QueueItem =>
  ({ id, kind: 'post', stage: 'review', title, hook: title, publish_date: date, scheduled_at: `${date}T14:00:00+00:00` } as unknown as QueueItem);

// Mondays either side of both DST changes: 25 Oct (Europe/Israel) and 1 Nov (US).
const QUEUE = [
  post('p-0928', '2026-09-28', 'POST MON 28 SEP'),
  post('p-1026', '2026-10-26', 'POST MON 26 OCT'),
  post('p-1102', '2026-11-02', 'POST MON 2 NOV'),
  post('p-1106', '2026-11-06', 'POST FRI 6 NOV'),
];
const board = (): Board => ({
  company_name: 'RISE DTC', queue: QUEUE,
  calendar: { start: '2026-09-28', weeks: 4, items: [] },
} as unknown as Board);

const ZONES = ['Europe/Warsaw', 'Asia/Jerusalem', 'America/Los_Angeles', 'UTC'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Every consecutive pair of printed days must advance by exactly one date. */
function assertConsecutive(labels: string[]) {
  const nums = labels.map((l) => parseInt(l, 10));
  for (let i = 1; i < nums.length; i++) {
    const prev = nums[i - 1], cur = nums[i];
    expect(cur === prev + 1 || (cur === 1 && prev >= 28), `day ${labels[i - 1]} then ${labels[i]} (index ${i})`).toBe(true);
  }
}

describe.each(ZONES)('viewer in %s', (tz) => {
  it('CalendarSurface: posts on their own weekday, every date printed once', () => {
    process.env.TZ = tz;
    const html = renderToStaticMarkup(
      <CalendarSurface board={board()} accent="#FFC71D" mint="#2F7D4F" onOpen={() => {}} scheduledIds={new Set()} live />,
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const cells = Array.from(doc.querySelectorAll('.cb-cal-row .cb-cal-cell'));
    expect(cells.length % 7).toBe(0);
    const labels = cells.map((c) => (c.firstElementChild?.textContent || '').trim());
    assertConsecutive(labels);
    const cellOf = (title: string) => cells.findIndex((c) => (c.textContent || '').includes(title));
    for (const [title, day, weekday] of [
      ['POST MON 28 SEP', '28', 'Mon'], ['POST MON 26 OCT', '26', 'Mon'],
      ['POST MON 2 NOV', '2', 'Mon'], ['POST FRI 6 NOV', '6', 'Fri'],
    ] as const) {
      const i = cellOf(title);
      expect(i, `${title} rendered`).toBeGreaterThanOrEqual(0);
      expect(parseInt(labels[i], 10), `${title} day label`).toBe(parseInt(day, 10));
      expect(WEEKDAYS[i % 7], `${title} column`).toBe(weekday);
    }
    // The first cell is Mon 28 Sep itself.
    expect(labels[0]).toBe('28');
  });

  it('DeskCalendarStrip: no duplicate date across the DST change, posts on their weekday', () => {
    process.env.TZ = tz;
    const html = renderToStaticMarkup(<DeskCalendarStrip board={board()} onOpenCal={() => {}} />);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const cells = Array.from(doc.querySelectorAll('.cb-calstrip-cell'));
    expect(cells.length % 7).toBe(0);
    const labels = cells.map((c) => (c.firstElementChild?.textContent || '').trim());
    assertConsecutive(labels);
    const cellOf = (title: string) => cells.findIndex((c) => (c.getAttribute('title') || '').includes(title));
    for (const [title, day, weekday] of [
      ['POST MON 26 OCT', '26', 'Mon'], ['POST MON 2 NOV', '2', 'Mon'], ['POST FRI 6 NOV', '6', 'Fri'],
    ] as const) {
      const i = cellOf(title);
      expect(i, `${title} rendered`).toBeGreaterThanOrEqual(0);
      expect(parseInt(labels[i], 10), `${title} day label`).toBe(parseInt(day, 10));
      expect(WEEKDAYS[i % 7], `${title} column`).toBe(weekday);
    }
  });
});
