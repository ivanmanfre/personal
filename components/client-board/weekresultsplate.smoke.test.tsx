// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeekResultsPlate } from './WeekResultsPlate';
import { sliceSeries } from './weekResults';
import { ReportHome, type ReportCtx } from './report/ReportBlocks';
import { reportPeriods, REPORT_CONFIGS, type ReportPayload } from './report/reportModel';

/** Test-only fabrication shaped like the client_board_report payload. */
const payload: ReportPayload = {
  client: 'risedtc', start_date: '2026-07-21',
  people: [
    { n: 'Ann Able', bk: '2026-09-22T15:00:00Z', w: ['2026-09-20T10:00:00Z'], y: ['2026-09-20T11:00:00Z'], conn: '2026-09-18T10:00:00Z' },
    { n: 'Ben Bold', bk: '2026-09-17T16:00:00Z', w: ['2026-09-25T10:00:00Z'], conn: '2026-09-26T10:00:00Z' },
    { n: 'Cy Cole', bk: '2026-08-20T10:00:00Z', w: ['2026-08-19T10:00:00Z'], conn: '2026-08-12T10:00:00Z' },
    { n: 'Dee Dunn', w: ['2026-08-25T10:00:00Z'], conn: '2026-08-22T10:00:00Z' },
  ],
  came: [{ name: 'Mo Sample', via: 'asked', at: '2026-09-27T10:00:00Z' }], engaged: [], posts: [], assists: [],
};
const cfg = REPORT_CONFIGS['risedtc-com'];
const periods = reportPeriods(cfg, '2026-09-29');
const ctx: ReportCtx = { cfg, periods, period: periods[0], onPeriod: () => {}, payload, board: { queue: [] }, audience: null, today: '2026-09-29' };

const text = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
const nums = (html: string) => (text(html).match(/\d[\d,]*/g) || []);

describe('WeekResultsPlate (one model with the report)', () => {
  const html = renderToStaticMarkup(<WeekResultsPlate ctx={ctx} onSeeAll={() => {}} />);
  it('prints the report period, its calls and the same names as the headline', () => {
    expect(html).toContain('This month · 17 Sept to 17 Oct');
    expect(html).toMatch(/>2<\/span><span class="cb-wr-l">calls booked<br\/>since 17 Sept/);
    expect(html).toContain('3 since 21 Jul');
    expect(html).toContain('Ann Able and Ben Bold');
    expect(renderToStaticMarkup(<ReportHome ctx={ctx} />)).toContain('with Ann Able and Ben Bold.');
  });
  it('uses the figures’ own words, no calendar month, no last 7 days', () => {
    expect(html).toContain('people wrote back for the first time since 17 Sept');
    expect(html).toContain('founder said yes');
    expect(html).toContain('1 brand owner came to you on their own');
    expect(html).not.toMatch(/September|last 7 days|last 30 days|positive/);
  });
  it('every number on the plate is a report figure or a slice of one', () => {
    const home = renderToStaticMarkup(<ReportHome ctx={ctx} />);
    // the report's own figures, plus the slice values and slice dates (the Week by week rows)
    const bars = sliceSeries(ctx).slice(-9);
    const allowed = new Set([...nums(home), ...bars.flatMap((b) => [b.calls, b.wrote, b.reach, ...b.label.match(/\d+/g)!].map(String))]);
    for (const n of nums(html)) expect(allowed.has(n)).toBe(true);
  });
  it('never asks the client for anything', () => {
    expect(html).not.toMatch(/your turn|reply to them|needs you|waiting on you/i);
  });
});
