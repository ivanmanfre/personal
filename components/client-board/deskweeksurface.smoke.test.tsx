// @vitest-environment jsdom
/**
 * DeskWeekSurface smoke test.
 *
 * Run:  npx vitest run components/client-board/deskweeksurface.smoke.test.tsx
 *
 * Fabricated fixture (test-only): one generating draft, one published post with a real
 * LinkedIn url, one carousel with image_urls, at least one empty weekday, and a weekend.
 * The window is built relative to the client-timezone "today" the surface itself derives,
 * so the assertions hold on any day of the week.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DeskWeekSurface from './DeskWeekSurface';
import type { Board, QueueItem, Stage } from '../ClientBoardPage';

const CLIENT_TZ = 'America/Los_Angeles';
const todayLA = new Intl.DateTimeFormat('en-CA', { timeZone: CLIENT_TZ }).format(new Date());
/** Noon-UTC probe: offset-proof, so the fixture's dates line up with the surface's window
 *  no matter what timezone the test runs in. */
const shift = (iso: string, n: number) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * 86400000).toISOString().slice(0, 10);
const D = (n: number) => shift(todayLA, n);
const isWeekend = (iso: string) => {
  const wd = new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: CLIENT_TZ, weekday: 'short' });
  return wd === 'Sat' || wd === 'Sun';
};

/** The carousel goes on the first WEEKDAY after today, so at least one weekend day in the
 *  window always stays free to prove the non-posting-day row, and three weekdays stay empty
 *  to prove the honest blank. */
const CAROUSEL_DAY = [1, 2, 3, 4, 5, 6].map(D).find((d) => !isWeekend(d)) as string;

const PUBLISHED_TITLE = 'The Profit Gap: growth up, cash flat';
const LINKEDIN_URL = 'https://www.linkedin.com/posts/example-activity-1234567890';

const generatingItem: QueueItem = {
  id: 'q-generating',
  kind: 'carousel',
  style: 'carousel',
  stage: 'review',
  generating: true,
  hook: 'Your customers now ask an assistant what to buy',
  title: 'Carousel: the shopping checklist',
  body: 'Open the assistant and ask it what to buy in your category.\n\nIf your store does not show up, this is why.',
  funnel_stage: 'reach',
  publish_date: D(0),
  scheduled_at: `${D(0)}T15:00:00Z`,
  source_detail: { kind: 'call', call_title: 'Intro call', quote: 'nobody finds us in the assistants' },
};

const publishedItem: QueueItem = {
  id: 'q-published',
  kind: 'post',
  stage: 'published',
  hook: 'Twenty thousand a month.',
  title: PUBLISHED_TITLE,
  body: 'A brand we grew last year. Fifty percent growth. Then I sat with the founder and ran the actual dollars.',
  funnel_stage: 'trust',
  pillar: 'Teardown',
  publish_date: D(0),
  scheduled_at: `${D(0)}T16:30:00Z`,
  media_url: 'https://example.test/cover-published.jpg',
  source_label: 'From your sales calls',
};

const carouselItem: QueueItem = {
  id: 'q-carousel',
  kind: 'carousel',
  style: 'carousel',
  stage: 'review',
  hook: 'Six thousand into ads, nineteen hundred back',
  title: 'Carousel: the ad teardown',
  body: 'The ads did their one job. They got a cold stranger to click.',
  funnel_stage: 'reach',
  publish_date: CAROUSEL_DAY,
  scheduled_at: `${CAROUSEL_DAY}T16:00:00Z`,
  image_urls: [
    'https://example.test/slide-01.png',
    'https://example.test/slide-02.png',
    'https://example.test/slide-03.png',
    'https://example.test/slide-04.png',
    'https://example.test/slide-05.png',
  ],
};

const bufferItem: QueueItem = {
  id: 'q-buffer',
  kind: 'post',
  stage: 'review',
  hook: 'The margin check I run before touching a budget',
  title: 'The margin check',
  body: 'Revenue is up, the bank account is flat.',
  funnel_stage: 'trust',
};

const board: Board = {
  company_name: 'Example Brand',
  founder: { name: 'Example Founder', headline: 'Founder' },
  brand: { accent_hex: '#FFC71D', font_heading: 'Sora' } as Board['brand'],
  queue: [generatingItem, publishedItem, carouselItem, bufferItem],
  calendar: { start: todayLA, weeks: 4, items: [] },
  strategy: {
    total: 24,
    period: 'this month',
    pillars: [],
    cadence: { headline: 'Five posts a week, one per working day' },
  },
  performance: {
    posts: [
      { url: LINKEDIN_URL, title: PUBLISHED_TITLE, published_at: `${D(0)}T16:30:00Z`, impressions: 149 },
      { url: 'https://www.linkedin.com/posts/older', title: 'An older post', published_at: `${D(-3)}T16:00:00Z`, impressions: 1852 },
    ],
  },
};

const emptyBoard: Board = {
  company_name: 'Fresh Brand',
  queue: [],
  calendar: { start: todayLA, weeks: 4, items: [] },
};

const noop = () => {};
const asyncOk = async () => ({ ok: true });

function render(b: Board) {
  return renderToStaticMarkup(
    React.createElement(DeskWeekSurface, {
      board: b,
      accent: '#FFC71D',
      mint: '#2F7D4F',
      stageOf: (q: QueueItem) => q.stage as Stage,
      approvedIds: new Set<string>(),
      angleSwaps: {},
      skips: {},
      benchFor: () => [],
      pool: [],
      onPickReplacement: noop,
      onBackToBuffer: noop,
      onLeaveDayEmpty: noop,
      onSetSchedule: asyncOk,
      onClearDay: asyncOk,
      onScheduleToDay: asyncOk,
      recentlyCleared: {},
      leftEmpty: {},
      onLeaveEmpty: noop,
      onRefillDay: noop,
      onOpen: noop,
      onOpenCal: noop,
      onApprove: noop,
      onPickAngle: noop,
      onSkip: noop,
      onUnskip: noop,
      onGoContent: noop,
      flashId: null,
      modalOpen: false,
      live: true,
    })
  );
}

describe('DeskWeekSurface', () => {
  const html = render(board);

  it('renders every block, in frag order', () => {
    // 1 — eyebrow + computed headline (a fact with a number, no couplet)
    expect(html).toContain('This week');
    expect(/There (is|are) <b>/.test(html)).toBe(true);
    expect(html).toContain('in the queue behind it');
    // 2 — the plate
    expect(html).toContain('cb-plate');
    expect(html).toContain('in the queue');
    expect(html).toContain('Ships today');
    expect(html).toContain('Edit copy');
    expect(html).toContain('Edit time');
    // Swap slot is preview-only: the live modal carries no change-request pane
    // (canAct && !isLive), so the pill is gated off on live boards.
    expect(html).not.toContain('Swap slot');
    // 3 — the LinkedIn preview of the selected post
    expect(html).toContain('The post, as it lands on LinkedIn');
    expect(html).toContain('cb-linkedin-preview');
    // 4 — the queue rail
    expect(html).toContain('The week at a glance');
    expect(html).toContain('working days in this window carry a post');
    // 5 — day by day
    expect(html).toContain('Day by day');
    expect(html).toContain('Open post');
    // 6 — the stat footer
    expect(html).toContain('posts a week, one a working day');
    expect(html).toContain('out so far');
  });

  it('draws the plate queue rail: one tile per queued item, in counted bands', () => {
    // The fixture's queue: 1 dated today, 1 dated later, 1 undated in the buffer.
    const tiles = html.match(/data-rail-tile="(today|scheduled|buffer)"/g) || [];
    expect(tiles).toHaveLength(3);
    expect(tiles.filter((t) => t.includes('today'))).toHaveLength(1);
    expect(tiles.filter((t) => t.includes('scheduled'))).toHaveLength(1);
    // The buffer draft exists as a MARK on the plate, not only as a sentence at the foot.
    expect(tiles.filter((t) => t.includes('buffer'))).toHaveLength(1);
    expect(html).toContain('in buffer');
    // …and the rail sits INSIDE the dark plate, above the outside-the-plate day rail.
    expect(html.indexOf('cb-plate')).toBeLessThan(html.indexOf('data-rail-tile'));
    expect(html.indexOf('data-rail-tile')).toBeLessThan(html.indexOf('The week at a glance'));
  });

  it('emits the gate hooks: data-metric numerals and a data-viz encoding', () => {
    expect(html).toContain('data-metric');
    expect(html).toContain('data-viz');
    expect(html).toContain('class="num cb-num-serif"');
  });

  it('ships every drill collapsed', () => {
    const opens = html.match(/<details[^>]*\sopen/g) || [];
    expect(opens).toHaveLength(0);
    expect(html).toContain('<details class="drill"');
  });

  it('shows the generating draft as still rendering, never as a finished post', () => {
    // The selected day defaults to today, whose first slot is the generating draft.
    expect(html).toContain('cover rendering');
    expect(html).toContain('being written, the cover is still rendering');
    // The typographic cover plate is the "finished post" tell — it must not render here.
    expect(html).not.toContain('cb-cover-plate');
  });

  it('renders the carousel slides from image_urls', () => {
    expect(html).toContain('slide-01.png');
    expect(html).toContain('slide-05.png');
    expect(html).toContain('in the deck');
  });

  it('links a published row out to its real post instead of edit pills', () => {
    expect(html).toContain(LINKEDIN_URL);
    expect(html).toContain('View on LinkedIn');
    expect(html).toContain('>out<');
    // The published post's reads belong to it alone: a same-day DRAFT must not inherit them.
    expect((html.match(/>149</g) || [])).toHaveLength(1);
  });

  it('renders an honest blank for an empty weekday and marks weekends non-posting', () => {
    expect(html).toContain('nothing scheduled this day');
    const weekendInWindow = [0, 1, 2, 3, 4, 5, 6].map(D).some(isWeekend);
    expect(weekendInWindow).toBe(true);
    expect(html).toContain('Weekend, not a posting day');
  });

  it('only chips REAL provenance, never a curation fallback', () => {
    expect(html).toContain('From your sales call');
    expect(html).not.toMatch(/hand-?picked/i);
    expect(html).not.toMatch(/picked by/i);
  });

  it('keeps the locked copy register', () => {
    expect(html).not.toMatch(/waiting on your yes|needs your approval/i);
    expect(html).not.toMatch(/\bICP\b|Apollo|Sales Navigator|\bscorer\b|onboarding|\bcampaign\b/);
    // Zero <p> tags (svg <path>/<polyline> are not paragraphs).
    expect(html).not.toMatch(/<p[\s>]/);
  });

  describe('absent data', () => {
    const blankHtml = render(emptyBoard);

    it('renders honest blanks, and never a zero in a stat slot', () => {
      expect(blankHtml).toContain('not tracked yet');
      expect(blankHtml).toContain('nothing in the queue yet');
      expect(blankHtml).toContain('nothing scheduled this day');
      // Stat values render inside <b>; an absent stat must never land a 0 there.
      expect(blankHtml).not.toMatch(/<b[^>]*>0<\/b>/);
    });

    it('omits reads-last-week entirely when performance cannot support it', () => {
      expect(blankHtml).not.toContain('reads, ');
      // and renders it when it can
      expect(html).toContain('reads, ');
      expect(html).toContain('1,852');
    });
  });
});
