// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReportPipeline, linesData, isYes, funnelStages } from './PipelineBlocks';
import type { ReportCtx } from './ReportBlocks';
import { reportPeriods, REPORT_CONFIGS, type ReportPayload } from './reportModel';

/** Test-only fabrication shaped like the swishdm client_board_report payload (2026-10-15). */
const payload: ReportPayload = {
  client: 'swishdm', start_date: '2026-10-19',
  people: [
    { n: 'Test Founder', c: 'Test Store', l: 'owner', v: 'own', out: '2026-10-19T16:00:00Z', conn: '2026-10-20T16:00:00Z', w: ['2026-10-21T16:00:00Z'], y: ['2026-10-21T16:00:00Z'], li: 'soft_yes', lr: '2026-10-21T16:00:00Z' },
    { n: 'Test Marketer', c: 'Other Store', l: 'marketing', v: 'engaged', out: '2026-10-19T17:00:00Z', w: ['2026-10-20T10:00:00Z'], y: [], li: 'info_ask', lr: '2026-10-20T10:00:00Z' },
    { n: 'Test Analyst', c: 'Third Store', l: 'other', v: 'signals', out: '2026-10-20T17:00:00Z', w: [], y: [] },
  ],
  came: [], engaged: [], posts: [], assists: [],
};

function ctx(): ReportCtx {
  const cfg = { ...REPORT_CONFIGS['swishdm-live'], start: '2026-10-19' };
  const periods = reportPeriods(cfg, '2026-10-22');
  const all = periods.find((p) => p.kind === 'all') || periods[periods.length - 1];
  return { cfg, periods, period: all, onPeriod: () => {}, payload, board: { queue: [] }, audience: null, today: '2026-10-22' };
}

describe('SwishDM report', () => {
  it('feeds Outreach and Performance only, and keeps This week', () => {
    expect(REPORT_CONFIGS['swishdm-live'].outreachOnly).toBe(true);
    expect(REPORT_CONFIGS['swishdm-live'].homeResults).toBeFalsy();
    expect(REPORT_CONFIGS['risedtc-com'].outreachOnly).toBeFalsy();
    expect(REPORT_CONFIGS['arch-agency'].outreachOnly).toBeFalsy();
  });

  it('a yes is the walk-through or a call; a question is a reply', () => {
    const c = ctx();
    expect(isYes(c, 'positive')).toBe(true);
    expect(isYes(c, 'soft_yes')).toBe(true);
    expect(isYes(c, 'booking')).toBe(true);
    expect(isYes(c, 'info_ask')).toBe(false);
    expect(isYes(c, 'price_ask')).toBe(false);
  });

  it('groups by his buyer roles and his three lanes, never RISE words', () => {
    const data = linesData(ctx());
    expect(data.map((d) => d.ln.title)).toEqual(['Founders and CEOs', 'Marketing leads', 'Other roles']);
    expect(data[0].rows[0].label).toBe('People who engaged with your posts or profile');
    const html = renderToStaticMarkup(<ReportPipeline ctx={ctx()} accent="#FC5B06" log={[]} booked={[]} />);
    expect(html).toContain('said yes to the comparison or a call');
    expect(html).not.toMatch(/Store owners|a scan or a chat|founders are|What kinds of stores/);
    expect(funnelStages(ctx()).map((s) => s.v)).toEqual([3, 1, 2, 1, 0]);
  });
});
