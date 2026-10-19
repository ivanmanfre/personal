// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DeskReviewSurface from './DeskReviewSurface';
import type { Board, QueueItem } from '../ClientBoardPage';

const active: QueueItem[] = [
  { id: 'open-post', title: 'How ChatGPT shopping works', kind: 'post', stage: 'review', image_urls: ['https://example.invalid/a.png'] },
  { id: 'dated-post', title: 'Dated post', kind: 'post', stage: 'review', scheduled_at: '2026-10-28T09:00:00Z', publish_date: '2026-10-28', image_urls: ['https://example.invalid/b.png'] },
];
const archived: QueueItem[] = [
  { id: 'old-post', title: 'Digital PR: a story that earned links', kind: 'post', stage: 'review', archived_at: '2026-10-19T09:00:00Z', image_urls: ['https://example.invalid/c.png'] },
];
const board = { company_name: 'SwishDM', brand: { wordmark: 'SwishDM' }, queue: active, calendar: { items: [] } } as unknown as Board;
const stageOf = (post: QueueItem) => post.stage;
function Desk({ onArchive, list = archived }: { onArchive?: (id: string, a: boolean) => Promise<{ ok: boolean; error?: string }>; list?: QueueItem[] }) {
  const [view, setView] = React.useState<'feed' | 'list' | 'calendar'>('list');
  return <DeskReviewSurface board={board} accent="#FC5B06" mint="#0668FC" stageOf={stageOf} onOpen={() => {}} onOpenIdea={() => {}} onApprove={() => {}} flashId={null} view={view} setView={setView as any} skips={{}} live reviewMode feedbackScope="swishdm-live" archived={list} onArchive={onArchive} />;
}
beforeEach(() => { window.history.replaceState({}, '', '/'); localStorage.clear(); });
afterEach(cleanup);

it('archived posts stay out of the active cards; the Archive section is collapsed with its count', () => {
  const view = render(<Desk onArchive={vi.fn().mockResolvedValue({ ok: true })} />);
  expect(view.container.querySelector('[data-batch-review-card="old-post"]')).toBeNull();
  const header = screen.getByText('Archive').closest('[role="button"]') as HTMLElement;
  expect(header.getAttribute('aria-expanded')).toBe('false');
  expect(header.textContent).toContain('1');
  fireEvent.click(header);
  expect(view.container.querySelector('[data-batch-review-card="old-post"]')).toBeTruthy();
});

it('an undated review post can be archived; a dated one cannot', async () => {
  const onArchive = vi.fn().mockResolvedValue({ ok: true });
  render(<Desk onArchive={onArchive} />);
  fireEvent.click(screen.getByRole('button', { name: 'Archive: How ChatGPT shopping works' }));
  await waitFor(() => expect(onArchive).toHaveBeenCalledWith('open-post', true));
  expect(screen.queryByRole('button', { name: 'Archive: Dated post' })).toBeNull();
});

it('Restore puts an archived post back and shows the error when the write fails', async () => {
  const onArchive = vi.fn().mockResolvedValue({ ok: false, error: 'This post has a date. Clear the date first, then archive it.' });
  render(<Desk onArchive={onArchive} />);
  fireEvent.click(screen.getByText('Archive').closest('[role="button"]') as HTMLElement);
  fireEvent.click(screen.getByRole('button', { name: 'Restore from archive: Digital PR: a story that earned links' }));
  await waitFor(() => expect(onArchive).toHaveBeenCalledWith('old-post', false));
  expect((await screen.findByRole('alert')).textContent).toContain('Clear the date first');
});

it('a viewer (no onArchive) sees no Archive or Restore controls', () => {
  render(<Desk />);
  expect(screen.queryByRole('button', { name: /^Archive: / })).toBeNull();
  fireEvent.click(screen.getByText('Archive').closest('[role="button"]') as HTMLElement);
  expect(screen.queryByRole('button', { name: /^Restore from archive: / })).toBeNull();
});

it('no archived posts = no Archive section', () => {
  render(<Desk list={[]} onArchive={vi.fn()} />);
  expect(screen.queryByText('Archive')).toBeNull();
});
