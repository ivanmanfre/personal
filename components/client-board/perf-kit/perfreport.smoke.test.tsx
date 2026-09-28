// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PerfReport from './PerfReport';
import type { ReportCtx } from '../report/ReportBlocks';
import { reportPeriods, REPORT_CONFIGS, type ReportPayload } from '../report/reportModel';

/** Test-only fabrication shaped like the client_board_report payload + outreach_truth. */
const payload: ReportPayload = {
  client: 'risedtc', start_date: '2026-07-21',
  people: [
    { n: 'Kara North', bk: '2026-09-22T15:14:42Z', w: ['2026-09-20T10:00:00Z'], conn: '2026-09-18T10:00:00Z' },
    { n: 'Tom Hale', c: 'Soda Co', bk: '2026-09-17T16:19:15Z', conn: '2026-09-16T10:00:00Z' },
    { n: 'Earlier Person', bk: '2026-08-20T10:00:00Z', w: ['2026-08-19T10:00:00Z'], conn: '2026-08-12T10:00:00Z' },
  ],
  came: [{ name: 'Mo Sample', title: 'Founder | Brand', via: 'asked', at: '2026-09-18T10:00:00Z' }],
  engaged: [
    { p: 'urn:li:activity:7000000000000000001', k: 'a', at: '2026-09-23T10:00:00Z', fit: true, checked: true, new: true },
  ],
  posts: [{ p: 'urn:li:activity:7000000000000000001', at: '2026-09-23T15:00:00Z', title: 'A DTC brand put Instagram Stories on its homepage' }],
  assists: [],
};
const board = { queue: [{ id: 'q1', stage: 'published', title: 'Working name', hook: 'A DTC brand put Instagram Stories on its homepage', published_at: '2026-09-23T15:00:00Z' }] };
const truth = {
  counted_at: '2026-09-27T22:03:09Z',
  booked: [{ name: 'Tom Hale', company: 'Soda Co', booked_at: '2026-09-17T16:19:15Z', brief_url: 'https://example.test/brief', days_to_book: 1 }],
  funnel: { contacted: 1586, accepted: 435, replied_people: 154, booked: 19 },
};
const cfg = REPORT_CONFIGS['risedtc-com'];
const periods = reportPeriods(cfg, '2026-09-27');
const ctx: ReportCtx = { cfg, periods, period: periods[0], onPeriod: () => {}, payload, board, audience: null, today: '2026-09-27' };

describe('PerfReport (ARCH-look Results trial)', () => {
  const html = renderToStaticMarkup(<PerfReport ctx={ctx} truth={truth} />);
  it('leads with calls booked for the period, then who, then who came to you', () => {
    expect(html).toContain('calls booked<br/>since 17 Sept');
    expect(html).toContain('Kara and Tom');
    expect(html).toContain('1 brand owner came to you on their own and asked to connect.');
  });
  it('draws the cohort funnel with its exact numbers and step shares', () => {
    expect(html).toContain('19 calls from 1,586 people contacted since the start.');
    for (const s of ['27%', '35%', '12%']) expect(html).toContain(s);
  });
  it('one card per call, with the brief only when there is one', () => {
    expect(html).toContain('2 calls since 17 Sept, the latest on 22 Sept.');
    expect(html.match(/Pre-call brief/g) || []).toHaveLength(1);
    expect(html).toContain('Booked a day after the connection request went out.');
  });
  it('keeps every figure, folded under All numbers, and never prints reads or cadence', () => {
    expect(html).toContain('All numbers');
    expect(html).toContain('person wrote back for the first time');
    expect(html).not.toMatch(/\breads?\b/i);
    for (const cad of ['posts a week', 'working day', 'every weekday']) expect(html).not.toContain(cad);
    expect(html).not.toContain('Working name');
    expect(html).not.toMatch(/#D220AC|magenta/i);
  });
});
