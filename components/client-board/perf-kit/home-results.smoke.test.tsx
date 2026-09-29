// @vitest-environment jsdom
// NIGHT MOCKUP (local only): the week page's results plate behind ?night prints only the
// report's own figures and slices, with the same words as the light plate.
import React from 'react';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WeekResultsPlate } from '../WeekResultsPlate';
import { sliceSeries } from '../weekResults';
import { ReportHome, type ReportCtx } from '../report/ReportBlocks';
import { reportPeriods, REPORT_CONFIGS, type ReportPayload } from '../report/reportModel';

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

describe('WeekResultsPlate at night', () => {
  let prev = '';
  beforeAll(() => { prev = window.location.href; window.history.replaceState({}, '', '/client/risedtc-com?night'); });
  afterAll(() => { window.history.replaceState({}, '', prev); });

  it('draws the ARCH hero with the same period, calls and names', () => {
    const html = renderToStaticMarkup(<WeekResultsPlate ctx={ctx} onSeeAll={() => {}} />);
    expect(html).toContain('hm-hero');
    expect(html).not.toContain('cb-wr-grid');
    // Night v4: v2's look is back (the caps eyebrow, initials circles, the lit note) with v3's
    // words: the glossary word "replied", and the person who came named with the day they did it.
    expect(html).toContain('<div class="pk-cap pk-capline">This month · 17 Sept to 17 Oct</div>');
    expect(html).toContain('3 since 21 Jul');
    expect(html).toContain('class="pk-avs"');
    expect(text(html)).toContain('Ann Able and Ben Bold');
    expect(html).toContain('people replied for the first time since 17 Sept');
    expect(html).toContain('<div class="pk-note">Mo Sample asked to connect with you on 27 Sept.</div>');
    expect(html).not.toMatch(/wrote back/);
    expect(html).not.toMatch(/The week shown|Tap a week/);
  });
  it('pre-selects the running slice and prints only report figures or slices', () => {
    const html = renderToStaticMarkup(<WeekResultsPlate ctx={ctx} onSeeAll={() => {}} />);
    const bars = sliceSeries(ctx).slice(-9);
    const cur = bars.find((b) => b.current)!;
    expect(html).toContain(`data-slice="${cur.label}" class="pk-col on partial" aria-pressed="true"`);
    expect((html.match(/aria-pressed="true"/g) || []).length).toBe(1);
    const home = renderToStaticMarkup(<ReportHome ctx={ctx} />);
    const allowed = new Set([...nums(home), ...bars.flatMap((b) => [b.calls, b.wrote, b.reach, ...b.label.match(/\d+/g)!].map(String))]);
    // The came line's date is the payload's own timestamp, checked in the first test.
    for (const n of nums(html.replace(/<div class="pk-note">[\s\S]*?<\/div>/, '').replace(/<div class="pk-cap pk-capline">[\s\S]*?<\/div>/, ''))) expect(allowed.has(n)).toBe(true);
  });
  it('never asks the client for anything', () => {
    const html = renderToStaticMarkup(<WeekResultsPlate ctx={ctx} onSeeAll={() => {}} />);
    expect(html).not.toMatch(/your turn|reply to them|needs you|waiting on you/i);
  });
});
