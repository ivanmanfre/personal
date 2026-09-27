// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportHome, ReportResults, type ReportCtx } from './ReportBlocks';
import { reportPeriods, REPORT_CONFIGS, type ReportPayload } from './reportModel';

/** Test-only fabrication shaped like the client_board_report payload. */
const payload: ReportPayload = {
  client: 'risedtc', start_date: '2026-07-21',
  people: [
    { n: 'Karin Nelson', bk: '2026-09-22T15:14:42Z', w: ['2026-09-20T10:00:00Z'], conn: '2026-09-18T10:00:00Z' },
    { n: 'Trent Hill', bk: '2026-09-17T16:19:15Z' },
    { n: 'Earlier Person', bk: '2026-08-20T10:00:00Z', w: ['2026-08-19T10:00:00Z'] },
  ],
  came: [{ name: 'Max Sandquist', via: 'asked', at: '2026-09-18T10:00:00Z' }],
  engaged: [
    { p: 'urn:li:activity:7000000000000000001', k: 'a', at: '2026-09-23T10:00:00Z', fit: true, checked: true, new: true },
    { p: 'urn:li:activity:7000000000000000001', k: 'b', at: '2026-09-23T10:00:00Z', fit: false, checked: true, new: true },
  ],
  posts: [{ p: 'urn:li:activity:7000000000000000001', at: '2026-09-23T15:00:00Z', title: 'A DTC brand put Instagram Stories on its homepage' }],
  assists: [],
};
const board = {
  queue: [{ id: 'q1', stage: 'published', title: 'Format test 3: internal name', published_at: '2026-09-23T15:00:00Z' }],
  outreach_truth: { booked: [] },
  performance: { posts: [{ title: 'A DTC brand put Instagram Stories on its homepage', url: 'https://www.linkedin.com/posts/x-activity-7000000000000000001-abc', published_at: '2026-09-23T15:00:00Z', impressions: 4200 } as never] },
};

function ctxFor(key?: string): ReportCtx {
  const cfg = REPORT_CONFIGS['risedtc-com'];
  const periods = reportPeriods(cfg, '2026-09-27');
  return { cfg, periods, period: periods.find((p) => p.key === key) || periods[0], onPeriod: () => {}, payload, board, audience: null, today: '2026-09-27' };
}

describe('report blocks', () => {
  it('a week without a call never opens on a 0: it leads with the month and says none yet quietly', () => {
    const cfg = REPORT_CONFIGS['arch-agency'];
    const periods = reportPeriods(cfg, '2026-09-28');
    const archPayload: ReportPayload = { ...payload, client: 'arch', start_date: '2026-08-31', came: [], engaged: [], posts: [],
      people: [{ n: 'Ofir Bello', bk: '2026-09-27T19:44:02Z' }, { n: 'Gustav Pastucha', bk: '2026-09-24T13:52:02Z' }] };
    const ctx: ReportCtx = { cfg, periods, period: periods[0], onPeriod: () => {}, payload: archPayload, board: { queue: [] }, audience: null, today: '2026-09-28' };
    const html = renderToStaticMarkup(<ReportHome ctx={ctx} />);
    expect(html).toContain('2 calls booked</b> since 31 Aug, with Ofir Bello and Gustav Pastucha.');
    expect(html).toContain('Nothing new yet this week; figures above are since 31 Aug.');
    expect(html.match(/none yet/gi) || []).toHaveLength(0);
    expect(html).not.toMatch(/>0<\/span>/);
  });
  it('Home leads with calls booked and names them, then who came to you', () => {
    const html = renderToStaticMarkup(<ReportHome ctx={ctxFor()} />);
    expect(html).toContain('2 calls booked</b> since 17 Sept, with Karin Nelson and Trent Hill.');
    expect(html).toContain('1 brand owner came to you on their own.');
    expect(html).toContain('aria-label="Report period"');
    expect(html).not.toContain('who engaged');
  });
  it('a past period reads in the past tense and never says still counting', () => {
    const html = renderToStaticMarkup(<ReportHome ctx={ctxFor('m:2026-08-17')} />);
    expect(html).toContain('1 call booked</b> between 17 Aug and 17 Sept');
    expect(html).not.toMatch(/still counting/i);
  });
  it('Results keeps reads out of the report and folds them under More numbers', () => {
    const html = renderToStaticMarkup(<ReportResults ctx={ctxFor()} more={<div>legacy reads 4,200</div>} />);
    const [report, fold] = html.split('More numbers');
    expect(report).not.toMatch(/\breads?\b/i);
    expect(fold).toContain('legacy reads 4,200');
    expect(html).toContain('<details');
    expect(html).not.toContain('Format test');
    // "Led to a call" only when a post led to one
    expect(html).not.toContain('Led to a call');
    for (const cad of ['posts a week', 'working day', 'every weekday', 'Weekends']) expect(html).not.toContain(cad);
  });
});
