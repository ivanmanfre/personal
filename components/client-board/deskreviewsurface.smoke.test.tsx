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

/* The calendar-strip span, derived exactly the way DeskCalendarStrip derives it: the Monday
   on or before the first dated day (the fixture's engine start, 20 Jul) through the Sunday
   that closes the LAST dated day — which is the fixture's ships-today post, i.e. today. */
const CAL_DAY_MS = 86400000;
const calParse = (s: string) => new Date(`${s}T00:00:00`);
const calTodayIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
const CAL_SPAN_START = calParse('2026-07-20'); // a Monday, and the fixture's earliest dated day
const CAL_LAST_DATED = [calTodayIso, '2026-08-06', '2026-07-22'].sort().pop() as string;
const CAL_WEEKS = Math.max(1, Math.min(10, Math.floor(Math.round((calParse(CAL_LAST_DATED).getTime() - CAL_SPAN_START.getTime()) / CAL_DAY_MS) / 7) + 1));
const CAL_GRID_END = new Date(CAL_SPAN_START.getTime() + (CAL_WEEKS * 7 - 1) * CAL_DAY_MS)
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** 2026-08-07 contract: Published / Changes log / Photo library start collapsed. Tests that
 *  assert their CONTENT click the header open first (header itself always renders). */
const openDisclosure = (container: HTMLElement, label: string) => {
  const heads = Array.from(container.querySelectorAll('[role="button"][aria-expanded="false"]'));
  const head = heads.find((el) => (el.textContent || '').includes(label));
  if (head) fireEvent.click(head);
};


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

function Harness({ fetchHistory, foldPhotos = null }: { fetchHistory?: (ref: string) => Promise<HistoryEntry[]>; foldPhotos?: React.ReactNode }) {
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
        foldPhotos={foldPhotos}
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
    expect(html()).toContain('Published');
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
    openDisclosure(container, 'Published');
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
    openDisclosure(container, 'Changes log');
    await waitFor(() => expect(html()).toContain('changes on this board'));
    expect(html()).toContain('see the edit');
    expect(html()).toContain('characters');
    // The diff drill is collapsed by default too.
    const diffDrillMatch = html().match(/<details class="drill"[^>]*>[\s\S]*?see the edit/);
    expect(diffDrillMatch).not.toBeNull();
    // The edited post's card carries its own tiny history affordance, still collapsed.
    const postLog = container.querySelector('[data-post-log="q-scheduled-1"]');
    expect(postLog).not.toBeNull();
    expect(postLog!.textContent).toContain('changed 1 time');
    expect(html()).not.toMatch(/<details[^>]*\bopen\b[^>]*>/);

    cleanup();
  });

  it('renders honest empty/absent states — no fabricated zero', async () => {
    const fetchHistory = async () => [] as HistoryEntry[];
    const { container } = render(<Harness fetchHistory={fetchHistory} />);
    const html = () => container.innerHTML;

    openDisclosure(container, 'Changes log');
    await waitFor(() => expect(html()).toContain('No changes recorded yet.'));
    // Zero history: no count number is shown next to the (absent) "changes on this board" line.
    expect(html()).not.toContain('changes on this board');
    expect(html()).not.toMatch(/>0<\/span>\s*changes/);
    // ...and no card grows a history affordance ("0 changes" is banned by omission).
    expect(container.querySelectorAll('[data-post-log]').length).toBe(0);
    expect(html()).not.toContain('changed ');

    cleanup();
  });

  it('never renders a raw identity, labels reschedules, and counts the ones on screen', async () => {
    // Multi-post fixture: post A (q-scheduled-1) has 2 whitelisted entries, post B
    // (q-buffer-1) has NONE client-visible — only an ops-note-typed entry that the
    // whitelist must drop everywhere (global log AND per-post affordance).
    const OPS_NOTE = 'born-inert marker XQ-77 goal-run stamp';
    const history: Record<string, HistoryEntry[]> = {
      'q-scheduled-1': [
        { action: 'edit_copy', at: '2026-07-31T04:45:00Z', by: 'mattan@risedtc.com', before: 'Open ChatGPT', after: 'Open ChatGPT and ask' },
        { action: 'set_schedule', at: '2026-07-30T21:10:00Z', by: 'im@ivanmanfredi.com', before: '2026-07-31T20:30:00Z', after: '2026-07-31T23:30:00Z' },
      ],
      'q-scheduled-2': [
        { action: 'set_schedule', at: '2026-07-27T20:10:00Z', by: 'claude-code (operator session)', before: '2026-08-06T16:00:00Z', after: '2026-08-06T19:00:00Z' },
      ],
      'q-buffer-1': [
        { action: 'note', event: 'ops_marker', at: '2026-07-29T11:00:00Z', by: 'claude-code (operator session)', note: OPS_NOTE } as HistoryEntry,
      ],
      'q-published-1': [{ action: 'approve', at: '2026-07-20T09:00:00Z', by: null }],
    };
    const { container } = render(<Harness fetchHistory={async (ref) => history[ref] || []} />);
    const html = () => container.innerHTML;
    const chipText = () => Array.from(container.querySelectorAll('.chip')).map((n) => n.textContent || '');

    openDisclosure(container, 'Changes log');
    await waitFor(() => expect(html()).toContain('changes on this board'));

    // (a) identity: no email, no session id, no tooling name anywhere in a chip.
    expect(chipText().length).toBeGreaterThan(0);
    chipText().forEach((t) => {
      expect(t).not.toContain('@');
      expect(t.toLowerCase()).not.toContain('claude');
      expect(t.toLowerCase()).not.toContain('session');
    });
    // ...and nowhere in the whole markup either (per-post rows use spans, not chips).
    expect(html()).not.toContain('risedtc.com');
    expect(html()).not.toContain('ivanmanfredi.com');
    expect(html()).not.toContain('claude-code');
    expect(html()).not.toContain('operator session');
    // The founder's email resolves to his first name; every other writer to one desk label.
    expect(chipText()).toContain('Mattan');
    expect(chipText()).toContain('TESTCO desk');

    // Ops-note-typed entries never render, anywhere on the surface.
    expect(html()).not.toContain(OPS_NOTE);
    expect(html()).not.toContain('XQ-77');

    // Published section starts collapsed (2026-08-07 contract); open it so q-published-1's
    // card (and its per-post log) is on screen before counting.
    openDisclosure(container, 'Published');
    // Per-post history affordance: post A's card carries its own 2-entry log, collapsed.
    const postLogA = container.querySelector('[data-post-log="q-scheduled-1"]');
    expect(postLogA).not.toBeNull();
    expect(postLogA!.textContent).toContain('changed 2 times');
    expect(postLogA!.querySelector('details')).not.toBeNull();
    expect(postLogA!.querySelector('details[open]')).toBeNull();
    // Post B (ops note only) shows NO affordance — zero-history cards render nothing.
    expect(container.querySelector('[data-post-log="q-buffer-1"]')).toBeNull();
    // Exactly the three posts with whitelisted entries carry one.
    expect(container.querySelectorAll('[data-post-log]').length).toBe(3);

    // Global log is compact: at most 3 rows outside the fold; the 4th entry folds.
    expect(container.querySelectorAll('[data-log-row]').length).toBeLessThanOrEqual(3);
    expect(html()).toContain('more changes');

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
    // The span is derived, not typed: the fixture's ships-today post is dated TODAY, so the
    // strip grows a row every time the calendar week turns over. Hardcoding the end date
    // ("9 Aug") made this assertion rot on 2026-08-10 — it is now read from the same rule
    // the strip uses (Monday on/before the first dated day → Sunday closing the last one).
    expect(html).toContain(`Calendar · 20 Jul to ${CAL_GRID_END}`);
    expect(html).toContain('dated slots');
    expect(html).toContain('data-metric');
    // 4 dated queue posts (today's, 6 Aug, 20 Jul published) + 1 committed calendar entry.
    expect(html).toMatch(/>4</);

    // Marks, not words: drawn bars inside a data-viz grid, and a clickable day per item.
    expect(html).toContain('data-viz');
    expect((html.match(/class="bar"/g) || []).length).toBe(4);
    expect((html.match(/<button/g) || []).length).toBe(4);
    // Whole week rows of 7 day cells, however many the derived span needs.
    expect((html.match(/height:58px/g) || []).length).toBe(CAL_WEEKS * 7);
    // Zero prose.
    expect(html).not.toContain('<p');
  });

  it('renders the photo library section header collapsed; node appears on open', () => {
    const { container } = render(<Harness foldPhotos={<div data-test-photos="" />} />);
    expect(container.innerHTML).toContain('The photo library');
    // 2026-08-07 contract: starts collapsed — node absent until the header is clicked.
    expect(container.querySelector('[data-test-photos]')).toBeNull();
    openDisclosure(container, 'The photo library');
    expect(container.querySelector('[data-test-photos]')).not.toBeNull();
    // Content-bearing block once open: NOT buried inside a <details> drill.
    const node = container.querySelector('[data-test-photos]')!;
    expect(node.closest('details')).toBeNull();
    cleanup();
  });

  it('renders neither the photo library header nor node when foldPhotos is null (preview boards)', () => {
    const { container } = render(<Harness foldPhotos={null} />);
    expect(container.innerHTML).not.toContain('The photo library');
    expect(container.querySelector('[data-test-photos]')).toBeNull();
    cleanup();
  });

  // The Personal topic swaps the ledger rows for LinkedIn-style cards. A carousel used to
  // render there as its cover image alone: nine slides behind one dead frame, nothing to
  // swipe, nothing to click. The card has to page a deck.
  it('pages a carousel on the Personal topic instead of showing a dead cover', () => {
    const slides = Array.from({ length: 9 }, (_, i) => `https://example.com/deck/slide-0${i + 1}.png`);
    const board = makeBoard();
    board.queue = [
      { id: 'q-personal-deck', kind: 'carousel', stage: 'review', register: 'personal',
        title: 'Carousel: The Year Ladder', hook: 'Hook', body: 'Body '.repeat(20),
        image_urls: slides } as unknown as QueueItem,
    ];
    window.history.replaceState(null, '', '/client/test?topic=personal');
    const { container } = render(
      <div data-skin="desk" style={SKIN_VARS}>
        <DeskReviewSurface
          board={board} accent={ACCENT} mint="#2F7D4F" stageOf={stageOf}
          onOpen={noop} onOpenIdea={noop} onApprove={noop} onRemove={noop}
          flashId={null} view="list" setView={noop} skips={{}} live
          foldPhotos={null} foldCalendar={<div />}
        />
      </div>,
    );
    const html = container.innerHTML;
    // Every page is mounted in a snapping track, page 1 is current, and the pager is reachable.
    expect(html).toContain('1 / 9');
    expect(html).toContain('aria-label="Next page"');
    expect((html.match(/slide-0\d\.png/g) || []).length).toBe(9);
    const track = container.querySelector('.no-scrollbar') as HTMLElement | null;
    expect(track).not.toBeNull();
    expect(track!.children).toHaveLength(9);
    window.history.replaceState(null, '', '/');
    cleanup();
  });

  it('renders nothing for the changes log when fetchHistory is absent (preview boards)', () => {
    const { container } = render(<Harness />);
    const html = container.innerHTML;
    expect(html).not.toContain('Changes log');
    expect(html).not.toContain('reading the log');
    cleanup();
  });
});
