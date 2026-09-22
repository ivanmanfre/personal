/**
 * The "this month" block (instantly-picks 2026-09-22). Every number reads board.outreach_truth.month,
 * written server-side by rise_outreach_truth_compute(); a missing key renders an en dash, never 0.
 * MONTH below is the live risedtc-com blob's month key read back at 2026-09-22T22:08:56Z.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import OutreachTopOfPanel from './OutreachTopOfPanel';
import type { Board } from '../ClientBoardPage';

const MONTH = {
  window_start: '2026-09-17', window_end: null, next_report: '2026-10-17',
  invites: 130, accepted: 33, replies: 13, booked: 1,
  by_week: [
    { start: '2026-09-17', end: '2026-09-24', invites: 120, accepted: 30, replies: 12, booked: 1 },
    { start: '2026-09-24', end: null, invites: 10, accepted: 3, replies: 2, booked: 0 },
  ],
};

const BASE = {
  counted_at: '2026-09-22T22:08:56Z',
  semantics_version: 'clientweekpacket-2026-08-25',
  funnel: { contacted: 1449, accepted: 400, replied_people: 138, booked: 18 },
  booked: [],
  replied_7d: [],
  replied_weekly: [{ week_monday: '2026-09-21', people: 9 }],
};

const render = (ot: Record<string, unknown>) =>
  renderToStaticMarkup(<OutreachTopOfPanel board={{ outreach_truth: ot } as unknown as Board} accent="#c8f135" />);

/** The month block's own markup, cut out of the full surface. */
const block = (html: string) => {
  const i = html.indexOf('data-month-block');
  if (i < 0) return '';
  const start = html.lastIndexOf('<div', i);
  const end = html.indexOf('Next report', i);
  return html.slice(start, html.indexOf('</div>', end) + 6);
};
const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('OutreachTopOfPanel month block', () => {
  it('renders the month numbers and the by-week rows from outreach_truth.month', () => {
    const html = render({ ...BASE, month: MONTH });
    const b = block(html);
    expect(b).toContain('data-replies="13"');
    expect(b).toContain('data-booked="1"');
    expect(b).toContain('data-accepted="33"');
    expect(b).toContain('data-window-start="2026-09-17"');
    const t = text(b);
    expect(t).toContain('This month (17 Sep to today): 13 replies · 1 call booked · 33 invites accepted');
    expect(t).toContain('17 Sep to 23 Sep 12 1 30');
    expect(t).toContain('24 Sep to today 2 0 3');
    expect(t).toContain('Next report 17 Oct.');
    // sits above the existing surface content
    expect(html.indexOf('data-month-block')).toBeLessThan(html.indexOf('People who wrote back'));
  });

  it('renders an en dash for all three numbers when month is absent', () => {
    const b = block(render({ ...BASE }));
    expect(b).not.toBe('');
    expect(b).toContain('data-replies="–"');
    expect(b).toContain('data-booked="–"');
    expect(b).toContain('data-accepted="–"');
    expect(text(b)).toContain('This month (– to today): – replies · – calls booked · – invites accepted');
    expect(text(b)).toContain('Next report –.');
  });

  it('never renders 0 for a missing key', () => {
    const b = block(render({ ...BASE, month: { window_start: '2026-09-17', next_report: '2026-10-17', by_week: [{ start: '2026-09-17', end: null }] } }));
    expect(b).not.toMatch(/data-(replies|booked|accepted)="0"/);
    expect(text(b)).not.toMatch(/\b0\b/);
    expect(text(b)).toContain('17 Sep to today – – –');
  });

  it('adds nothing to a board written by another compute (ARCH)', () => {
    const html = render({ ...BASE, semantics_version: 'arch-launch-2026-08-26' });
    expect(html).not.toContain('data-month-block');
  });

  it('uses no em dash in the block', () => {
    expect(block(render({ ...BASE, month: MONTH }))).not.toContain(String.fromCharCode(0x2014));
    expect(block(render({ ...BASE }))).not.toContain(String.fromCharCode(0x2014));
  });
});
