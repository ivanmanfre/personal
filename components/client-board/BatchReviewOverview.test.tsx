// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import BatchReviewOverview from './BatchReviewOverview';
import DeskReviewSurface from './DeskReviewSurface';
import { BoardTeamProvider } from './team';
import type { Board, QueueItem } from '../ClientBoardPage';

const posts: QueueItem[] = [
  { id: 'shopping', title: 'How ChatGPT shopping works', kind: 'post', style: 'video', stage: 'review', video_url: 'https://example.invalid/video.mp4', media_url: 'https://example.invalid/video.mp4', image_urls: ['https://example.invalid/poster.png'], funnel_stage: 'reach', topic_label: 'AI shopping', creative_style: 'Animated explainer' },
  { id: 'cited', title: 'Getting cited is the easy part', kind: 'carousel', stage: 'review', image_urls: ['https://example.invalid/cited.png'], funnel_stage: 'reach', topic_label: 'AI brand perception', creative_style: 'Founder commentary' },
  { id: 'six', title: 'Ecommerce SEO is six jobs', kind: 'carousel', stage: 'review', image_urls: ['https://example.invalid/six.png'], funnel_stage: 'reach', topic_label: 'Ecommerce SEO', creative_style: 'Service overview' },
  { id: 'weekly', title: 'Weekly AI answer check', kind: 'carousel', stage: 'review', image_urls: ['https://example.invalid/weekly.png'], funnel_stage: 'trust', topic_label: 'AI comparison checks', creative_style: 'Step-by-step guide' },
  { id: 'four', title: 'Four ways you lose control', kind: 'carousel', stage: 'review', image_urls: ['https://example.invalid/four.png'], funnel_stage: 'trust', topic_label: 'AI brand perception', creative_style: 'Diagnostic framework' },
];
const stageOf = (post: QueueItem) => post.stage;
const statusFor = () => 'Awaiting approval';
const board = { company_name: 'SwishDM', brand: { wordmark: 'SwishDM' }, queue: posts, calendar: { items: [] } } as unknown as Board;
function Desk({ scope = 'swishdm-live', onOpen = vi.fn(), data = board, approvedIds }: { scope?: string; onOpen?: (...args: any[]) => void; data?: Board; approvedIds?: Set<string> }) {
  const [view, setView] = React.useState<'feed' | 'list' | 'calendar'>('list');
  return <DeskReviewSurface board={data} approvedIds={approvedIds} accent="#FC5B06" mint="#0668FC" stageOf={stageOf} onOpen={onOpen} onOpenIdea={() => {}} onApprove={() => {}} flashId={null} view={view} setView={setView as any} skips={{}} live reviewMode feedbackScope={scope} />;
}
beforeEach(() => { window.history.replaceState({}, '', '/'); localStorage.clear(); });
afterEach(cleanup);
it('shows all five unscheduled cards immediately and opens the exact existing queue item', () => {
  const onOpen = vi.fn(); const view = render(<Desk onOpen={onOpen} />);
  expect(view.container.querySelectorAll('[data-batch-review-card]')).toHaveLength(5);
  for (const post of posts) expect(screen.getByRole('heading', { name: post.title })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Open review: Weekly AI answer check' }));
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onOpen).toHaveBeenCalledWith(posts[3]);
  expect(screen.getByRole('button', { name: 'List' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Calendar' })).toBeTruthy();
});
it('renders the actual video poster, format and all editorial tags without treating a video URL as an image', () => {
  const view = render(<BatchReviewOverview items={posts} onOpen={() => {}} statusFor={statusFor} />);
  const card = view.container.querySelector('[data-batch-review-card="shopping"]') as HTMLElement;
  expect(within(card).getByRole('img').getAttribute('src')).toBe('https://example.invalid/poster.png');
  expect(card.querySelector('video')).toBeNull();
  expect(card.textContent).toContain('Video');
  expect(card.textContent).toContain('Reach · TOFU');
  expect(card.textContent).toContain('AI shopping');
  expect(card.textContent).toContain('Animated explainer');
  expect(card.textContent).toContain('Awaiting approval');
  expect(view.container.querySelector('img[src$=".mp4"]')).toBeNull();
});
it('keeps filtering, List, Calendar and the review disclosure available', () => {
  const view = render(<Desk />);
  expect(screen.queryByText('FORMAT')).toBeNull();
  expect(screen.getByRole('group', { name: 'View' }).textContent).toBe('Batch overviewListCalendar');
  const format = screen.getByRole('combobox', { name: 'Format' });
  fireEvent.change(format, { target: { value: 'video' } });
  expect(view.container.querySelectorAll('[data-batch-review-card]')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(view.container.querySelectorAll('[data-batch-review-card]')).toHaveLength(5);
  fireEvent.click(screen.getByRole('button', { name: 'List' }));
  expect(view.container.querySelector('[data-batch-review-card]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Batch overview' }));
  expect(view.container.querySelectorAll('[data-batch-review-card]')).toHaveLength(5);
  const buffer = screen.getByRole('button', { name: /In buffer/ });
  fireEvent.click(buffer);
  expect(view.container.querySelector('[data-batch-review-card]')).toBeNull();
  fireEvent.click(buffer);
  expect(view.container.querySelectorAll('[data-batch-review-card]')).toHaveLength(5);
});
it('preserves legacy clients and gives missing or failed media a readable fallback', () => {
  const legacy = render(<Desk scope="another-client" />);
  expect(legacy.container.querySelector('[data-batch-review-card]')).toBeNull();
  expect(screen.getByRole('button', { name: 'Review' })).toBeTruthy();
  cleanup();
  const fallback: QueueItem = { id: 'old', title: 'Old text post', kind: 'post', stage: 'review', body: 'The original text still opens for review.' };
  const view = render(<BatchReviewOverview items={[fallback, posts[0]]} onOpen={() => {}} statusFor={statusFor} />);
  expect(screen.getByText(fallback.title!)).toBeTruthy();
  // A text post gets no media box, so its body is not repeated on the card.
  expect(screen.queryByText(fallback.body!)).toBeNull();
  expect(view.container.querySelector('[data-batch-review-card="old"] .cb-batch-media')).toBeNull();
  expect(view.container.querySelector('[data-batch-review-card="old"] [data-post-review-tags]')).toBeNull();
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByText('Video preview opens in review.')).toBeTruthy();
  expect(view.container.querySelector('img')).toBeNull();
});
it('keeps truthful approval/date state and full-size keyboard review buttons', () => {
  render(<BatchReviewOverview items={[{ ...posts[4], funnel_stage: 'buyers' }]} onOpen={() => {}} statusFor={() => 'Approved'} dateFor={() => 'Proposed 22 Oct'} />);
  expect(screen.getByText('Approved')).toBeTruthy();
  expect(screen.getByText('Proposed 22 Oct')).toBeTruthy();
  expect(screen.getByLabelText('Post metadata').textContent).toContain('Buyers · BOFU');
  const open = screen.getByRole('button', { name: /Open review:/ });
  expect(open.style.minHeight).toBe('44px');
  expect(open.style.minWidth).toBe('44px');
  open.focus(); expect(document.activeElement).toBe(open);
});

it('keeps proposed dated posts, approved dated posts and approved buffer posts distinct', () => {
  const dated = { ...posts[0], publish_date: '2026-11-02', scheduled_at: '2026-11-02T15:00:00Z' };
  const approvedDated = { ...posts[1], stage: 'scheduled' as const, publish_date: '2026-11-03', scheduled_at: '2026-11-03T15:00:00Z' };
  const approvedBuffer = { ...posts[2], stage: 'scheduled' as const };
  const view = render(<Desk data={{ ...board, queue: [dated, approvedDated, approvedBuffer] }} approvedIds={new Set(['cited', 'six'])} />);
  const pending = view.container.querySelector('[data-batch-review-card="shopping"]')!;
  const scheduled = view.container.querySelector('[data-batch-review-card="cited"]')!;
  const buffer = view.container.querySelector('[data-batch-review-card="six"]')!;
  expect(pending.textContent).toContain('Awaiting approval');
  expect(pending.textContent).toContain('Proposed');
  expect(scheduled.textContent).toContain('Scheduled');
  expect(scheduled.textContent).toContain('Goes out');
  expect(buffer.textContent).toContain('Approved');
  expect(buffer.textContent).toContain('No date yet');
});

it('keeps the source visible on every card and links the recorded original without opening review', () => {
  const onOpen = vi.fn();
  const items = [
    { ...posts[0], source_detail: { kind: 'winner_replica', source_url: 'https://instagram.com/p/source/', note: 'Private editorial note' } },
    { ...posts[1], source_detail: { kind: 'call', call_title: 'Client recording' } },
    ...posts.slice(2),
  ];
  const view = render(<BatchReviewOverview items={items} onOpen={onOpen} statusFor={statusFor} />);
  expect(view.container.querySelectorAll('[data-post-source-origin]')).toHaveLength(5);
  expect(view.container.textContent).toContain('Source: Instagram');
  expect(view.container.textContent).toContain('Source: Client call');
  expect(view.container.textContent).toContain('Source pending');
  expect(view.container.textContent).not.toContain('Private editorial note');
  const source = screen.getByRole('link', { name: 'Open source' });
  expect(source.getAttribute('href')).toBe('https://instagram.com/p/source/');
  expect(source.style.minHeight).toBe('44px');
  fireEvent.click(source); expect(onOpen).not.toHaveBeenCalled();
});

it('shows ARCH original approved posts and pending drafts in the compact overview', () => {
 const original = { ...posts[1], body: 'Original approved copy.', stage: 'scheduled' as const, publish_date: '2026-11-03', scheduled_at: '2026-11-03T15:00:00Z' };
 const pending = { ...posts[0], publish_date: '2026-11-02' };
 const onOpen = vi.fn();
 const view = render(<Desk scope="arch-agency" data={{ ...board, queue: [original, pending] }} approvedIds={new Set(['cited'])} onOpen={onOpen} />);
 expect(view.container.querySelectorAll('[data-batch-review-card]')).toHaveLength(2);
 expect(screen.getByRole('button', { name: 'Batch overview' })).toBeTruthy();
 expect(screen.getByText('1 awaiting approval · 1 approved · 0 published')).toBeTruthy();
 expect(view.container.querySelector('[data-batch-review-card="cited"]')?.textContent).toContain('Approved · Scheduled');
 expect(view.container.querySelector('[data-batch-review-card="shopping"]')?.textContent).toContain('Awaiting approval');
 fireEvent.click(screen.getByRole('button', { name: `Open review: ${original.title}` }));
 expect(onOpen).toHaveBeenCalledWith(original);
 expect(original.body).toBe('Original approved copy.');
});

it('shows existing ARCH comments on overview cards when thread resolution is unavailable', () => {
 const comments = [{ id: 'comment-1', ref: 'cited', at: '2026-10-19T08:00:00Z', by: 'davor@example.invalid', text: 'Keep this copy.', parent: null }];
 const view = render(<BoardTeamProvider value={{ me: '', comments, approvalMeta: {}, canComment: false, canApprove: true, addComment: async () => ({ ok: false }) }}><BatchReviewOverview items={[posts[1]]} onOpen={() => {}} statusFor={() => 'Approved'} /></BoardTeamProvider>);
 expect(view.getByText('1 comment')).toBeTruthy();
 expect(view.queryByRole('button', { name: 'Open feedback' })).toBeNull();
});
