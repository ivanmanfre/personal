// @vitest-environment jsdom
/**
 * FeedPreview fold smoke test.
 *
 * Run:  npx vitest run components/client-board/feedpreview-fold.smoke.test.tsx
 *
 * The client board is where a founder signs off on a hook, so the preview has to cut where
 * the feed cuts. Before 2026-08-24 it did not cut at all: FeedPreview took a `clampLines`
 * prop that no call site ever passed, so the cap was Infinity and the whole caption rendered
 * above the media. These assertions exist so that regression cannot come back quietly.
 *
 * The fold itself (3 rendered lines, measured against the live feed) is unit-tested in
 * lib/linkedinFold.test.ts. Here we only assert that FeedPreview is wired to it.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FeedPreview } from '../ClientBoardPage';
import type { Board, QueueItem } from '../ClientBoardPage';
import { linkedInFold } from '../../lib/linkedinFold';

const board: Board = {
  company_name: 'Example Brand',
  founder: { name: 'Example Founder', headline: 'Founder' },
  brand: { accent_hex: '#FFC71D', font_heading: 'Sora' } as Board['brand'],
  queue: [],
  calendar: { start: '2026-08-24', weeks: 4, items: [] },
  strategy: { total: 24, period: 'this month', pillars: [], cadence: { headline: 'Five a week' } },
  performance: { posts: [] },
} as unknown as Board;

/** Braden's shape: short hook, blank line, teaser — the fold lands after three lines. */
const EARLY_BREAK = [
  'I just funnel hacked 100 viral videos...',
  '',
  'And turned EVERYTHING into a copy/paste formula',
  '',
  'This paragraph is behind the fold and a founder must never see it above the cut, because',
  'on the real feed it simply is not there until someone taps see more.',
].join('\n');

/** Unbroken prose: the fold lands near three full lines, far later than the shape above. */
const PROSE = 'The creator is almost never the slow part of a content engine and here is why that matters '
  + 'for anyone trying to ship five posts a week without hiring a second person to chase drafts around. '
  + 'Everything after this point sits behind the fold and should not render above the media.';

const item = (body: string): QueueItem => ({
  id: 'q-fold',
  kind: 'post',
  style: 'text',
  stage: 'review',
  title: 'A post',
  hook: 'A hook',
  body,
  publish_date: '2026-08-24',
} as unknown as QueueItem);

const render = (body: string) =>
  renderToStaticMarkup(
    <FeedPreview item={item(body)} board={board} accent="#FFC71D" fontStack="Sora, sans-serif" />
  );

/** Strip tags so we compare rendered copy, not markup. */
const textOf = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('FeedPreview fold', () => {
  it('folds an early-breaking post and hides everything past the cut', () => {
    const html = render(EARLY_BREAK);
    expect(html).toContain('see more');
    expect(textOf(html)).toContain('And turned EVERYTHING into a copy/paste formula');
    expect(textOf(html)).not.toContain('behind the fold');
  });

  it('shows more of an unbroken post than of an early-breaking one', () => {
    const early = linkedInFold(EARLY_BREAK).visible.length;
    const prose = linkedInFold(PROSE).visible.length;
    expect(prose).toBeGreaterThan(early);
    // Both still fold — neither renders whole, which is the bug this replaced.
    expect(render(EARLY_BREAK)).toContain('see more');
    expect(render(PROSE)).toContain('see more');
  });

  it('leaves a body that fits the fold alone', () => {
    const html = render('Short enough to clear the fold.');
    expect(html).not.toContain('see more');
    expect(textOf(html)).toContain('Short enough to clear the fold.');
  });

  it('renders the fold with no clampLines prop supplied — the old regression', () => {
    // No prop is passed anywhere in this file, exactly as in the real call sites.
    expect(render(EARLY_BREAK)).toContain('see more');
  });
});
