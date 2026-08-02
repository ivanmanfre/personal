// @vitest-environment jsdom
/**
 * DeskCalendarStrip smoke test — lead-magnet mark colour + gated legend key.
 *
 * Static render only (renderToStaticMarkup): the strip has no effects, so this covers it.
 * Fixture dates are fixed (known Mon-anchored window) so the assertions never drift with
 * the wall clock.
 *
 * Run:  npx vitest run components/client-board/deskcalendarstrip.smoke.test.tsx
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DeskCalendarStrip from './DeskCalendarStrip';
import type { Board, QueueItem } from '../ClientBoardPage';

const SKIN_VARS: React.CSSProperties = {
  ['--cb-ink' as any]: '#111111',
  ['--cb-ink-mute' as any]: '#5F5F59',
  ['--cb-paper' as any]: '#FFFFFF',
  ['--cb-paper-sunk' as any]: '#F5F5F5',
  ['--cb-line' as any]: '#E0E0E0',
  ['--cb-accent' as any]: '#FFC71D',
  ['--cb-mint' as any]: '#2F7D4F',
};

const noop = () => {};

/** One lead-magnet launch + one plain post, both dated inside the same drawn window. */
function makeBoard(queue: QueueItem[]): Board {
  return {
    company_name: 'Test Co',
    brand: { wordmark: 'TESTCO' },
    founder: { name: 'Mattan Danino', first_name: 'Mattan' },
    queue,
    ideas: [],
    calendar: { start: '2026-08-03', weeks: 2, items: [] },
  } as unknown as Board;
}

const LM_ITEM: QueueItem = {
  id: 'q-lm-1', kind: 'post', stage: 'scheduled', title: 'Lead magnet launch',
  hook: 'LM hook', publish_date: '2026-08-05', funnel_stage: 'buyers', lm_launch: true,
} as unknown as QueueItem;

const POST_ITEM: QueueItem = {
  id: 'q-post-1', kind: 'post', stage: 'scheduled', title: 'Plain scheduled post',
  hook: 'Post hook', publish_date: '2026-08-04', funnel_stage: 'reach',
} as unknown as QueueItem;

function renderStrip(queue: QueueItem[]) {
  return renderToStaticMarkup(
    <div data-skin="desk" style={SKIN_VARS}>
      <DeskCalendarStrip board={makeBoard(queue)} onOpenCal={noop} />
    </div>,
  );
}

describe('DeskCalendarStrip lead-magnet marks', () => {
  it('renders the LM mark in the distinct mint var + class, posts unchanged, legend gated on', () => {
    const html = renderStrip([LM_ITEM, POST_ITEM]);

    // Both dated items drew a mark inside the data-viz grid.
    expect(html).toContain('data-viz');
    expect((html.match(/class="bar( bar-lm)?"/g) || []).length).toBe(2);

    // The LM mark carries the distinct class and the mint var; exactly one of them.
    expect((html.match(/class="bar bar-lm"/g) || []).length).toBe(1);
    const lmMark = html.match(/<span class="bar bar-lm"[^>]*>/)?.[0] || '';
    expect(lmMark).toContain('--cb-mint');
    expect(lmMark).not.toContain('--cb-accent');

    // The plain post mark stays on the existing scheme — no mint anywhere in it.
    const postMark = html.match(/<span class="bar"[^>]*>/)?.[0] || '';
    expect(postMark).toContain('--cb-accent');
    expect(postMark).not.toContain('--cb-mint');

    // Legend names the colour in client language, once.
    expect((html.match(/lead magnets/g) || []).length).toBe(1);
  });

  it('renders NO lead-magnet legend key and no mint mark when the window has no LM', () => {
    const html = renderStrip([POST_ITEM]);

    expect(html).toContain('data-viz');
    expect(html).not.toContain('lead magnets');
    expect(html).not.toContain('bar-lm');
    // No mark uses the mint var (the string may not appear at all).
    const marks = html.match(/<span class="bar[^"]*"[^>]*>/g) || [];
    expect(marks.length).toBe(1);
    marks.forEach((m) => expect(m).not.toContain('--cb-mint'));
  });

  it('renders nothing dated (legend included) when the board has no dated items', () => {
    const html = renderStrip([]);
    expect(html).toContain('No dated slots yet.');
    expect(html).not.toContain('lead magnets');
    expect(html).not.toContain('data-viz');
  });
});
