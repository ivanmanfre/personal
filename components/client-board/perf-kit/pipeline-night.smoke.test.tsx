// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PipelineNight, { weekSpan } from './pipeline-night';
import PerfReport from './PerfReport';
import type { ReportCtx } from '../report/ReportBlocks';
import { funnelStages } from '../report/PipelineBlocks';
import { reportPeriods, REPORT_CONFIGS, type ReportPayload } from '../report/reportModel';

/** Test-only fabrication shaped like the client_board_report payload (RISE). */
const payload: ReportPayload = {
  client: 'risedtc', start_date: '2026-07-21',
  people: [
    { n: 'Kara North', c: 'North Goods', l: 'owner', v: 'engaged', conn: '2026-09-10T10:00:00Z', w: ['2026-09-20T10:00:00Z'], y: ['2026-09-20T10:00:00Z'], bk: '2026-09-22T15:14:42Z', cat: 'fnb' },
    { n: 'Tom Hale', c: 'Soda Co', l: 'owner', v: 'search', conn: '2026-09-11T10:00:00Z', w: ['2026-09-26T10:00:00Z'], y: ['2026-09-26T10:00:00Z'], li: 'positive', lr: '2026-09-26T10:00:00Z', cat: 'fnb' },
    { n: 'Ann Asked', l: 'owner', v: 'asked', conn: '2026-09-01T10:00:00Z', w: ['2026-09-02T10:00:00Z'] },
    { n: 'Quiet One', l: 'owner', v: 'engaged' },
    { n: 'Mia Lead', c: 'Growth Co', v: 'fcmo', conn: '2026-08-20T10:00:00Z' },
  ],
  came: [], engaged: [], posts: [], assists: [],
};
const cfg = REPORT_CONFIGS['risedtc-com'];
const periods = reportPeriods(cfg, '2026-09-27');
const ctx: ReportCtx = { cfg, periods, period: periods[0], onPeriod: () => {}, payload, board: { queue: [] }, audience: null, today: '2026-09-27' };
const log = [{ prospect_id: 'p1', name: 'Tom Hale', company: 'Soda Co', last_reply_at: '2026-09-26T10:00:00Z', messages: [{ direction: 'inbound' as const, channel: 'linkedin', type: null, sent_at: '2026-09-26T10:00:00Z', text: 'Sure, send it over' }] }];
const booked = [{ name: 'Kara North', booked_at: '2026-09-22T15:14:42Z', brief_url: 'https://example.test/brief' }];

const strip = (h: string) => h.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');

describe('Outreach night v4 (v2 look, v3 words)', () => {
  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-27T12:00:00Z')); window.history.replaceState({}, '', '/?night'); });
  afterAll(() => { vi.useRealTimers(); window.history.replaceState({}, '', '/'); });

  it('one funnel in the one glossary, the same five numbers Performance draws', () => {
    const s = funnelStages(ctx);
    expect(s.map((x) => x.label)).toEqual(['Reached', 'Connected', 'Replied', 'Said yes', 'Booked a call']);
    expect(s.map((x) => x.v)).toEqual([5, 4, 3, 2, 1]);
    const out = strip(renderToStaticMarkup(<PipelineNight ctx={ctx} accent="#FFC71D" log={log} booked={booked} />));
    const perf = strip(renderToStaticMarkup(<PerfReport ctx={ctx} truth={{ booked }} />));
    for (const x of s) {
      // v2's funnel look: the number sits above its caps label
      expect(out).toContain(`${x.v} ${x.label}`);
      expect(perf).toContain(`${x.v} ${x.label}`);
    }
  });

  it('hero: gradient count, avatars beside the names they match, interested defined once, no helper lines', () => {
    const html = renderToStaticMarkup(<PipelineNight ctx={ctx} accent="#FFC71D" log={log} booked={booked} />);
    const t = strip(html);
    expect(t).toContain('1 call booked');
    expect(t).toContain('Kara North');
    expect(html).toContain('class="pk-hero-n pk-grad"');
    // one booked name, one avatar circle, no "+N"
    expect(html).toContain('class="pk-avs"');
    const avs = html.slice(html.indexOf('class="pk-avs"'), html.indexOf('class="pn-names"'));
    expect((avs.match(/class="pk-av"/g) || []).length).toBe(1);
    expect(avs).not.toContain('pk-av-more');
    expect(t).toContain("Said yes in the last 14 days and hasn't booked yet.");
    expect(t.split('in the last 14 days').length - 1).toBe(1);
    expect(t).not.toContain('Tap a stage');
    expect(t).not.toContain('most recent first');
    expect(t).not.toContain('A dot:');
    expect(t).toContain('Each person is counted once.');
  });

  it('ledger: the headline names both groups, the asked-to-connect row says already connected', () => {
    const t = strip(renderToStaticMarkup(<PipelineNight ctx={ctx} accent="#FFC71D" log={log} booked={booked} />));
    expect(t).toContain("Everyone we've contacted since 21 Jul, split into store owners and marketing leads.");
    expect(t).toContain('already connected');
    expect(t).toContain('Kinds of stores that wrote back');
  });

  it('people cards: Read the thread, the gold brief link, the dates', () => {
    const html = renderToStaticMarkup(<PipelineNight ctx={ctx} accent="#FFC71D" log={log} booked={booked} />);
    const t = strip(html);
    expect(t).toContain('Read the thread');
    expect(t).not.toMatch(/THE MESSAGES/i);
    expect(html).toMatch(/<a class="pn-lnk gold" href="https:\/\/example.test\/brief"[^>]*>Pre-call brief<\/a>/);
    expect(t).toContain('Booked 22 Sept');
    expect(t).toContain('26 Sept');
  });

  it('week spans read plainly', () => {
    expect(weekSpan({ start: '2026-08-17', end: '2026-08-24', current: false })).toBe('17 to 23 Aug');
    expect(weekSpan({ start: '2026-09-28', end: '2026-10-05', current: false })).toBe('28 Sept to 4 Oct');
    expect(weekSpan({ start: '2026-09-24', end: '2026-09-28', current: true })).toBe('24 Sept to today');
  });
});
