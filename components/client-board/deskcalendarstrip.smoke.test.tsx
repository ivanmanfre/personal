// @vitest-environment jsdom
/**
 * DeskCalendarStrip smoke test — lead-magnet mark colour + gated legend key,
 * title previews on the marks, and the optional drag-to-reschedule affordance.
 *
 * Static render only (renderToStaticMarkup): the strip has no effects, so this covers it.
 * Fixture dates are fixed (known Mon-anchored window) so the assertions never drift with
 * the wall clock.
 *
 * Run:  npx vitest run components/client-board/deskcalendarstrip.smoke.test.tsx
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, waitFor, cleanup, fireEvent } from '@testing-library/react';
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

/** A GATED carousel: no `lm_launch`, kind is 'carousel' — the 31 Jul checklist case. */
const GATED_CAROUSEL: QueueItem = {
  id: 'q-gate-1', kind: 'carousel', stage: 'scheduled', title: 'ChatGPT checklist carousel',
  hook: 'Gated hook', publish_date: '2026-08-06', funnel_stage: 'buyers',
  lm_gate: { title: 'The checklist', url: 'https://example.test/lm', keyword: 'CHECKLIST' },
} as unknown as QueueItem;

/** Already out — a shipped post never moves. */
const PUBLISHED_ITEM: QueueItem = {
  id: 'q-pub-1', kind: 'post', stage: 'published', title: 'Already published post',
  hook: 'Pub hook', publish_date: '2026-08-03', funnel_stage: 'reach',
} as unknown as QueueItem;

function renderStrip(queue: QueueItem[], onMoveItem?: (id: string, date: string) => Promise<{ ok: boolean; error?: string }>) {
  return renderToStaticMarkup(
    <div data-skin="desk" style={SKIN_VARS}>
      <DeskCalendarStrip board={makeBoard(queue)} onOpenCal={noop} onMoveItem={onMoveItem} />
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

  it('treats a GATED carousel as a lead magnet even without lm_launch (Ivan 08-02)', () => {
    const html = renderStrip([GATED_CAROUSEL, POST_ITEM]);

    // The gated carousel took the mint mark; the plain post did not.
    expect((html.match(/class="bar bar-lm"/g) || []).length).toBe(1);
    const lmMark = html.match(/<span class="bar bar-lm"[^>]*>/)?.[0] || '';
    expect(lmMark).toContain('--cb-mint');
    const postMark = html.match(/<span class="bar"[^>]*>/)?.[0] || '';
    expect(postMark).not.toContain('--cb-mint');

    // And the legend names it, so the colour is explained.
    expect((html.match(/lead magnets/g) || []).length).toBe(1);
  });
});

describe('DeskCalendarStrip title previews', () => {
  it('prints the post title on the day and carries the full text in a title attr', () => {
    const html = renderStrip([LM_ITEM, POST_ITEM]);

    // Visible preview text, in the width-gated class (never inline-sized under the floor).
    expect(html).toContain('cb-calstrip-title');
    expect(html).toContain('Plain scheduled post');
    expect(html).toContain('Lead magnet launch');
    // The preview span carries its own title attribute with the full label.
    expect(html).toMatch(/<span class="cb-calstrip-title" title="Plain scheduled post">Plain scheduled post<\/span>/);

    // Gate floor: the preview type is declared once, at 11.5px, in the scoped stylesheet.
    expect(html).toContain('font-size: 11.5px');
    // No sub-floor type anywhere in the emitted markup or its stylesheet.
    const sizes = [...html.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => parseFloat(m[1]));
    sizes.forEach((s) => expect(s).toBeGreaterThanOrEqual(11.5));
    const inlineSizes = [...html.matchAll(/font-size:([\d.]+)px/g)].map((m) => parseFloat(m[1]));
    inlineSizes.forEach((s) => expect(s).toBeGreaterThanOrEqual(11.5));
  });

  it('shows the first title plus a +N overflow count on a multi-item day', () => {
    const second = { ...POST_ITEM, id: 'q-post-2', title: 'Second post same day' } as QueueItem;
    const html = renderStrip([POST_ITEM, second]);

    expect(html).toContain('Plain scheduled post');
    expect(html).toContain('cb-calstrip-more');
    expect(html).toContain('+1');
    // Both marks still drew; the day's own title attr carries both labels.
    expect((html.match(/class="bar"/g) || []).length).toBe(2);
    expect(html).toContain('Plain scheduled post · Second post same day');
  });
});

describe('DeskCalendarStrip drag to reschedule', () => {
  const move = async () => ({ ok: true });

  it('makes unshipped marks draggable and leaves published ones alone', () => {
    const html = renderStrip([POST_ITEM, PUBLISHED_ITEM], move);

    // Exactly one draggable mark: the scheduled post. The published one is not draggable.
    expect((html.match(/draggable="true"/g) || []).length).toBe(1);
    const draggable = html.match(/<span class="bar" draggable="true"[^>]*>/)?.[0] || '';
    expect(draggable).toContain('Plain scheduled post');
    expect(draggable).toContain('grab');

    // The published mark rendered, in the out colour, without a drag affordance.
    const marks = html.match(/<span class="bar[^"]*"[^>]*>/g) || [];
    expect(marks.length).toBe(2);
    const pub = marks.find((m) => !m.includes('draggable')) || '';
    expect(pub).toContain('--cb-ink');

    // And the client is told what the affordance is, in plain language.
    expect(html).toContain('Drag a post to another day to move it.');
  });

  it('renders no drag affordance at all when onMoveItem is absent', () => {
    const html = renderStrip([POST_ITEM, PUBLISHED_ITEM]);

    expect(html).not.toContain('draggable');
    expect(html).not.toContain('grab');
    expect(html).not.toContain('Drag a post to another day');
    // Read-only strip still draws both marks, on a native button (unchanged read-only markup).
    expect((html.match(/<span class="bar[^"]*"[^>]*>/g) || []).length).toBe(2);
    expect(html).toContain('<button type="button" class="cb-calstrip-cell"');
    expect(html).not.toContain('role="button"');
  });

  it('swaps the day cell to role=button when drag is on (a draggable child of <button> does not drag everywhere)', () => {
    const html = renderStrip([POST_ITEM, PUBLISHED_ITEM], move);
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
    expect(html).not.toContain('<button type="button" class="cb-calstrip-cell"');
  });
});

/** Minimal dataTransfer stand-in: jsdom has no DragEvent. */
function dt(id?: string) {
  return { effectAllowed: '', dropEffect: '', setData: () => {}, getData: () => id || '' };
}

describe('DeskCalendarStrip drag write path', () => {
  afterEach(cleanup);

  /** Grid opens on Monday 2026-08-03: [0]=03 published, [1]=04 scheduled, [3]=06 empty. */
  function mount(onMoveItem: (id: string, date: string) => Promise<{ ok: boolean; error?: string }>) {
    const r = render(
      <div data-skin="desk" style={SKIN_VARS}>
        <DeskCalendarStrip board={makeBoard([POST_ITEM, PUBLISHED_ITEM])} onOpenCal={noop} onMoveItem={onMoveItem} />
      </div>,
    );
    const cells = [...r.container.querySelectorAll('.cb-calstrip-cell')];
    const bar = r.container.querySelector('[draggable="true"]')!;
    return { ...r, cells, bar };
  }

  it('calls onMoveItem with the post id and the dropped ISO day', async () => {
    const onMove = vi.fn(async () => ({ ok: true }));
    const { cells, bar } = mount(onMove);

    fireEvent.dragStart(bar, { dataTransfer: dt('q-post-1') });
    fireEvent.dragOver(cells[3], { dataTransfer: dt('q-post-1') });
    fireEvent.drop(cells[3], { dataTransfer: dt('q-post-1') });

    await waitFor(() => expect(onMove).toHaveBeenCalledWith('q-post-1', '2026-08-06'));
  });

  it('does not write when the post is dropped back on its own day', async () => {
    const onMove = vi.fn(async () => ({ ok: true }));
    const { cells, bar } = mount(onMove);

    fireEvent.dragStart(bar, { dataTransfer: dt('q-post-1') });
    fireEvent.drop(cells[1], { dataTransfer: dt('q-post-1') });

    await new Promise((r) => setTimeout(r, 0));
    expect(onMove).not.toHaveBeenCalled();
  });

  it('surfaces a plain-language line when the move does not save (never silent)', async () => {
    const onMove = vi.fn(async () => ({ ok: false, error: 'PGRST116: row not found' }));
    const { cells, bar, findByText, queryByText } = mount(onMove);

    expect(queryByText(/did not save/)).toBeNull();

    fireEvent.dragStart(bar, { dataTransfer: dt('q-post-1') });
    fireEvent.drop(cells[3], { dataTransfer: dt('q-post-1') });

    const line = await findByText('That move did not save. Open the post to set its time.');
    expect(line).toBeTruthy();
    // The raw backend string never reaches the client.
    expect(queryByText(/PGRST116/)).toBeNull();
  });

  it('surfaces the same line when the write throws', async () => {
    const onMove = vi.fn(async () => { throw new Error('network'); });
    const { cells, bar, findByText } = mount(onMove);

    fireEvent.dragStart(bar, { dataTransfer: dt('q-post-1') });
    fireEvent.drop(cells[3], { dataTransfer: dt('q-post-1') });

    expect(await findByText('That move did not save. Open the post to set its time.')).toBeTruthy();
  });
});
