// @vitest-environment jsdom
/**
 * DeskReviewSurface smoke test.
 *
 * The component fans `fetchHistory` across the queue inside a useEffect (real async data,
 * per the shared brief). react-dom/server's renderToStaticMarkup never runs effects, so a
 * pure static render cannot exercise the loaded-history / zero-history states the brief asks
 * for. This file switches to the jsdom environment (default vitest env for the repo is
 * 'node') and uses @testing-library/react's render + waitFor instead, so the effect actually
 * resolves before we assert on it. Everything else (fixture shape, assertions) matches the
 * brief's spec.
 *
 * Run:  npx vitest run components/client-board/deskreviewsurface.smoke.test.tsx
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, waitFor, cleanup, fireEvent } from '@testing-library/react';
import DeskReviewSurface from './DeskReviewSurface';
import DeskCalendarStrip from './DeskCalendarStrip';
import type { Board, QueueItem, HistoryEntry } from '../ClientBoardPage';

const ACCENT = '#FFC71D';

const SKIN_VARS: React.CSSProperties = {
  ['--cb-ink' as any]: '#111111',
  ['--cb-ink-soft' as any]: '#333333',
  ['--cb-ink-mute' as any]: '#5F5F59',
  ['--cb-paper' as any]: '#FFFFFF',
  ['--cb-paper-sunk' as any]: '#F5F5F5',
  ['--cb-line' as any]: '#E0E0E0',
  ['--cb-line-bold' as any]: 'rgba(17,17,17,0.26)',
  ['--cb-serif' as any]: '"Sora", system-ui, sans-serif',
  ['--cb-body' as any]: '"Manrope", system-ui, sans-serif',
  ['--cb-accent' as any]: ACCENT,
  ['--cb-mint' as any]: '#2F7D4F',
  ['--cb-plate' as any]: '#333333',
  ['--cb-plate-ink' as any]: '#FFFFFF',
  ['--cb-plate-mute' as any]: '#96968F',
  ['--cb-plate-line' as any]: 'rgba(255,255,255,0.14)',
};

function queueFixture(): QueueItem[] {
  return [
    { id: 'q-scheduled-1', kind: 'post', stage: 'review', title: 'Ships-today post', hook: 'Hook A', body: 'Body A '.repeat(20), publish_date: new Date().toISOString().slice(0, 10), funnel_stage: 'reach' },
    { id: 'q-scheduled-2', kind: 'carousel', stage: 'scheduled', title: 'Carousel: teardown', hook: 'Hook B', publish_date: '2026-08-06', funnel_stage: 'trust', image_urls: ['https://example.com/1.png', 'https://example.com/2.png'] },
    { id: 'q-buffer-1', kind: 'post', stage: 'review', title: 'Buffer post title', hook: 'Hook C', body: 'Body C '.repeat(20), funnel_stage: 'buyers' },
    { id: 'q-drafted-1', kind: 'post', stage: 'drafted', title: 'Being written post', hook: 'Hook D', generating: true, live_step: 'Drafting…' },
    { id: 'q-published-1', kind: 'post', stage: 'published', title: 'Published post title', hook: 'Hook E', body: 'Body E', publish_date: '2026-07-20' },
  ];
}

function makeBoard(): Board {
  return {
    company_name: 'Test Co',
    brand: { wordmark: 'TESTCO' },
    founder: { name: 'Mattan Danino', first_name: 'Mattan' },
    queue: queueFixture(),
    ideas: [{ id: 'idea-1', title: 'An idea worth writing', pillar: 'reach' }],
    calendar: { start: '2026-07-20', weeks: 3, items: [{ date: '2026-07-22', kind: 'newsletter', label: 'The weekly memo' }] },
  } as unknown as Board;
}

const stageOf = (q: QueueItem) => q.stage;
const noop = () => {};
const noopAsync = async () => ({ ok: true });

function Harness({ fetchHistory }: { fetchHistory?: (ref: string) => Promise<HistoryEntry[]> }) {
  const [view, setView] = React.useState<'list' | 'board' | 'feed' | 'calendar'>('list');
  return (
    <div data-skin="desk" style={SKIN_VARS}>
      <DeskReviewSurface
        board={makeBoard()}
        accent={ACCENT}
        mint="#2F7D4F"
        stageOf={stageOf}
        onOpen={noop}
        onOpenIdea={noop}
        onApprove={noop}
        onRemove={noop}
        flashId={null}
        view={view}
        setView={setView}
        skips={{}}
        live
        foldCalendar={<div data-testid="fold-calendar">calendar</div>}
        fetchHistory={fetchHistory}
      />
    </div>
  );
}

describe('DeskReviewSurface', () => {
  it('renders the pipeline blocks, pipeline-first order, and a collapsed history diff', async () => {
    const history: Record<string, HistoryEntry[]> = {
      'q-scheduled-1': [
        {
          action: 'edit_copy',
          at: '2026-07-31T04:45:00Z',
          by: 'Mattan',
          before: 'Open ChatGPT and ask it what to buy 🤯',
          after: 'Open ChatGPT and ask it what to buy in your category 🤯',
        },
      ],
    };
    const fetchHistory = async (ref: string) => history[ref] || [];

    const { container } = render(<Harness fetchHistory={fetchHistory} />);
    const html = () => container.innerHTML;

    // (a) key blocks present
    expect(html()).toContain('All content');
    expect(html()).toContain('in the pipeline');
    expect(html()).toContain('In buffer');
    expect(html()).toContain('Out');
    expect(html()).toContain('List');
    expect(html()).toContain('Calendar');

    // (b) data-metric and data-viz appear
    expect(html()).toContain('data-metric');
    expect(html()).toContain('data-viz');

    // (c) a drill renders collapsed — the row-level "Open post" drills exist before the
    // history even loads, so this holds regardless of the effect's timing.
    expect(html()).toMatch(/<details class="drill"(?![^>]*\bopen\b)[^>]*>/);
    expect(html()).not.toMatch(/<details[^>]*\bopen\b[^>]*>/);

    // Pipeline-first order: the buffer post appears before the published post in the markup.
    const bufferIdx = html().indexOf('Buffer post title');
    const publishedIdx = html().indexOf('Published post title');
    expect(bufferIdx).toBeGreaterThan(-1);
    expect(publishedIdx).toBeGreaterThan(-1);
    expect(bufferIdx).toBeLessThan(publishedIdx);

    // (d) the duplicated "Dated posts" block is gone: every dated row is printed once, by its
    // section, and the dated enumeration now lives in the Calendar view only.
    expect(html()).not.toContain('Dated posts');
    const occurrences = (needle: string) => html().split(needle).length - 1;
    expect(occurrences('Published post title')).toBe(1);
    expect(occurrences('Carousel: teardown')).toBe(1);

    // Wait for the fanned fetchHistory() Promise.all to resolve, then assert the diff drill.
    await waitFor(() => expect(html()).toContain('changes on this board'));
    expect(html()).toContain('see the edit');
    expect(html()).toContain('characters');
    // The diff drill is collapsed by default too.
    const diffDrillMatch = html().match(/<details class="drill"[^>]*>[\s\S]*?see the edit/);
    expect(diffDrillMatch).not.toBeNull();

    cleanup();
  });

  it('renders honest empty/absent states — no fabricated zero', async () => {
    const fetchHistory = async () => [] as HistoryEntry[];
    const { container } = render(<Harness fetchHistory={fetchHistory} />);
    const html = () => container.innerHTML;

    await waitFor(() => expect(html()).toContain('No changes recorded yet.'));
    // Zero history: no count number is shown next to the (absent) "changes on this board" line.
    expect(html()).not.toContain('changes on this board');
    expect(html()).not.toMatch(/>0<\/span>\s*changes/);

    cleanup();
  });

  it('never renders a raw identity, labels reschedules, and counts the ones on screen', async () => {
    const history: Record<string, HistoryEntry[]> = {
      'q-scheduled-1': [
        { action: 'edit_copy', at: '2026-07-31T04:45:00Z', by: 'mattan@risedtc.com', before: 'Open ChatGPT', after: 'Open ChatGPT and ask' },
        { action: 'set_schedule', at: '2026-07-30T21:10:00Z', by: 'im@ivanmanfredi.com', before: '2026-07-31T20:30:00Z', after: '2026-07-31T23:30:00Z' },
      ],
      'q-scheduled-2': [
        { action: 'set_schedule', at: '2026-07-27T20:10:00Z', by: 'claude-code (operator session)', before: '2026-08-06T16:00:00Z', after: '2026-08-06T19:00:00Z' },
      ],
      'q-published-1': [{ action: 'approve', at: '2026-07-20T09:00:00Z', by: null }],
    };
    const { container } = render(<Harness fetchHistory={async (ref) => history[ref] || []} />);
    const html = () => container.innerHTML;
    const chipText = () => Array.from(container.querySelectorAll('.chip')).map((n) => n.textContent || '');

    await waitFor(() => expect(html()).toContain('changes on this board'));

    // (a) identity: no email, no session id, no tooling name anywhere in a chip.
    expect(chipText().length).toBeGreaterThan(0);
    chipText().forEach((t) => {
      expect(t).not.toContain('@');
      expect(t.toLowerCase()).not.toContain('claude');
      expect(t.toLowerCase()).not.toContain('session');
    });
    // The founder's email resolves to his first name; every other writer to one desk label.
    expect(chipText()).toContain('Mattan');
    expect(chipText()).toContain('TESTCO desk');

    // (b) reschedules read as a client label + the move, and the footer counts the same rows.
    expect(html()).toContain('Rescheduled');
    expect(html()).not.toContain('set schedule');
    expect(html()).toContain('2 reschedules');
    expect(html()).toContain('1 copy edits');
    expect(html()).toMatch(/31 Jul 13:30\s*→\s*16:30/);
    expect(html()).toMatch(/6 Aug 09:00\s*→\s*12:00/);

    // (c) the founder filter reads the SAME mapping, so it keeps his emailed rows and drops
    // the desk's — the count follows.
    const founderPill = Array.from(container.querySelectorAll('button')).find((b) => (b.textContent || '').startsWith('Mattan'));
    expect(founderPill).toBeTruthy();
    fireEvent.click(founderPill!);
    expect(chipText()).not.toContain('TESTCO desk');
    expect(html()).toContain('0 reschedules');
    expect(html()).toContain('1 copy edits');

    cleanup();
  });

  it('DeskCalendarStrip renders a computed month strip of marks (static render)', () => {
    const html = renderToStaticMarkup(
      <div data-skin="desk" style={SKIN_VARS}>
        <DeskCalendarStrip board={makeBoard()} onOpenCal={noop} scheduledIds={new Set(['q-scheduled-2'])} />
      </div>,
    );

    // Header: computed range + a real, gate-visible "dated slots" metric.
    expect(html).toContain('Calendar · 20 Jul to 9 Aug');
    expect(html).toContain('dated slots');
    expect(html).toContain('data-metric');
    // 4 dated queue posts (today's, 6 Aug, 20 Jul published) + 1 committed calendar entry.
    expect(html).toMatch(/>4</);

    // Marks, not words: drawn bars inside a data-viz grid, and a clickable day per item.
    expect(html).toContain('data-viz');
    expect((html.match(/class="bar"/g) || []).length).toBe(4);
    expect((html.match(/<button/g) || []).length).toBe(4);
    // 3 week rows of 7 = 21 day cells.
    expect((html.match(/height:58px/g) || []).length).toBe(21);
    // Zero prose.
    expect(html).not.toContain('<p');
  });

  it('renders nothing for the changes log when fetchHistory is absent (preview boards)', () => {
    const { container } = render(<Harness />);
    const html = container.innerHTML;
    expect(html).not.toContain('Changes log');
    expect(html).not.toContain('reading the log');
    cleanup();
  });
});
