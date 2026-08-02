// @vitest-environment jsdom
/**
 * DeskWeekSurface smoke test — candidate A layout ("preview inside the plate").
 *
 * Run:  npx vitest run components/client-board/deskweeksurface.smoke.test.tsx
 *
 * WHAT THIS LAYOUT ASSERTS ON TOP OF THE HONEST-STATE + REGISTER CONTRACT
 * - There is exactly ONE plate, it is full width, and the LinkedIn preview renders INSIDE
 *   it (the old outside `cb-week-preview-col` is gone).
 * - The day pills live on the plate, above the preview.
 * - The preview sits on a mat that re-declares page ink / page paper, so the plate's
 *   !important colour cannot cascade into the white card.
 * - Day-by-day rows are compressed: no cover thumbnail, exactly one chip (the status) on
 *   the visible line, and the drill still carries every write path.
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
    //     …and the preview, in the plate's right column, with NO repeated status chip or
    //     action pills under the card — the preview's own header carries the schedule line,
    //     the plate's left column carries the edit pills.
    expect(html).toContain('As it lands on LinkedIn');
    expect(html).toContain('cb-linkedin-preview');
    const previewCol = html.slice(html.indexOf('As it lands on LinkedIn'), html.indexOf('The week at a glance'));
    expect(previewCol).not.toContain('Edit copy');
    expect(previewCol).not.toContain('Edit time');
    // 3 — the week at a glance
    expect(html).toContain('The week at a glance');
    expect(html).toContain('working days in this window carry a post');
    // 4 — day by day
    expect(html).toContain('Day by day');
    expect(html).toContain('Open post');
    // 5 — the stat footer
    expect(html).toContain('posts a week, one a working day');
    expect(html).toContain('out so far');
  });

  it('renders the LinkedIn preview INSIDE the one full-width plate', () => {
    // One plate, not a plate plus a column beside it.
    expect((html.match(/class="cb-plate cb-week-plate"/g) || [])).toHaveLength(1);
    // The old outside preview column is gone entirely.
    expect(html).not.toContain('cb-week-preview-col');
    const plate = html.indexOf('cb-week-plate');
    const dayPills = html.indexOf('data-day-pills');
    const preview = html.indexOf('data-plate-preview');
    const glance = html.indexOf('The week at a glance');
    expect(plate).toBeGreaterThan(-1);
    // Day pills sit on the plate, above the preview; the preview sits on the plate, above
    // the glance rail (which is the first thing OUTSIDE the plate).
    expect(plate).toBeLessThan(dayPills);
    expect(dayPills).toBeLessThan(preview);
    expect(preview).toBeLessThan(glance);
    // The queue rail and the plate footer line stay inside the plate too.
    expect(html.indexOf('data-rail-tile')).toBeLessThan(glance);
    // The preview card really is the LinkedIn card, not a re-drawn stand-in.
    expect(html.slice(preview, glance)).toContain('cb-linkedin-preview');
  });

  it('isolates the white preview card from the plate ink cascade', () => {
    // The mat re-declares page ink on page paper. Without this the desk skin's
    // `.cb-plate { color: … !important }` inherits straight into the card.
    const frame = html.slice(html.indexOf('data-plate-preview'));
    const style = frame.slice(frame.indexOf('style="'), frame.indexOf('>', frame.indexOf('style="')));
    expect(style).toContain('color:var(--cb-ink)');
    expect(style).toContain('background:var(--cb-paper)');
    // FeedPreview's own header/body ink is literal, so the card holds contrast on white.
    expect(html.slice(html.indexOf('cb-linkedin-preview'))).toContain('color:#111');
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

  it('compresses day-by-day to one line: no cover thumb, status chip only', () => {
    const dayByDay = html.slice(html.indexOf('Day by day'));
    // The glance rail above already draws the artwork; the rows dropped their thumbnails.
    expect(dayByDay).not.toContain('class="thumb');
    const rows = dayByDay.split('data-day-row').slice(1);
    expect(rows.length).toBeGreaterThan(0);
    const postRows = rows.filter((r) => r.includes('Open post'));
    // The fixture dates two posts today and one later in the window.
    expect(postRows.length).toBeGreaterThanOrEqual(3);
    for (const row of postRows) {
      // The visible line is everything before the collapsed drill.
      const line = row.slice(0, row.indexOf('<details'));
      expect(line).not.toContain('class="thumb');
      // Exactly one chip on the line, and it is the status. Format / funnel / pillar /
      // provenance / read-count chips moved into the drill.
      expect((line.match(/class="chip"/g) || [])).toHaveLength(1);
    }
    // Every write path the old fat row carried is still one click away, inside the drill.
    for (const label of ['Edit copy', 'Edit time', 'Remove this post', 'Back to the buffer', 'Clear the day']) {
      expect(dayByDay).toContain(label);
    }
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

  it('renders an honest blank for an empty weekday; weekends carry NO day-by-day row', () => {
    expect(html).toContain('nothing scheduled this day');
    const weekendInWindow = [0, 1, 2, 3, 4, 5, 6].map(D).some(isWeekend);
    expect(weekendInWindow).toBe(true);
    // 08-02 dedup: the glance rail draws weekends dashed and its footnote names them;
    // a "Weekend, not a posting day" row in Day-by-day said the same thing twice a week.
    const dayByDay = html.slice(html.indexOf('Day by day'));
    expect(dayByDay).not.toContain('Weekend, not a posting day');
    expect(html).toContain('Weekends are not posting days');
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
