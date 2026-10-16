// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { DetailModal } from '../ClientBoardPage';
import { BoardTeamProvider } from './team';
const video = { id: 'wide-video', kind: 'post', style: 'video', stage: 'review', title: 'Shopping video', body: 'Complete caption.\n\nSecond paragraph.', media_url: 'https://example.com/demo.mp4', image_urls: ['https://example.com/poster.png'], source_detail: { kind: 'source_commentary', source: 'Public documentation', source_url: 'https://example.com/source' } } as any;
const board = { company_name: 'SwishDM', queue: [video] } as any;
function setup(item = video, extra: any = {}) { return render(<BoardTeamProvider value={{ me: 'john@swishdm.com', comments: [], approvalMeta: {}, canComment: true, canApprove: true, addComment: async () => ({ ok: true }) }}><DetailModal item={{ ...item }} board={board} accent="#FC5B06" stage="review" onClose={() => {}} onApprove={async () => ({ ok: true })} isLive reviewMode slug="swishdm-live" editDraft={async () => ({ ok: true })} act={async () => ({ ok: true })} {...extra} /></BoardTeamProvider>); }
afterEach(cleanup);
const tab = (r: ReturnType<typeof render>, label: string) => Array.from(r.container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(el => el.textContent === label)!;
it('opens one post preview with comments beside it and collapsed sources', () => {
 const r = setup(); expect(r.container.querySelector('[data-review-workspace]')).toBeTruthy();
 expect(r.getByRole('button', { name: 'Back to batch' })).toBeTruthy();
 expect(tab(r, 'Preview').getAttribute('aria-selected')).toBe('true');
 expect(r.container.querySelector('video')?.getAttribute('src')).toBe(video.media_url);
 expect(r.container.querySelector('[data-review-copy]')?.textContent).toContain('Second paragraph.');
 expect(r.container.querySelector('[data-review-source]')?.hasAttribute('open')).toBe(false);
 expect(r.getByRole('button', { name: 'Approve ✓' })).toBeTruthy();
 expect(r.queryByRole('button', { name: 'Request changes' })).toBeNull();
 expect(r.container.querySelector('[data-review-activity] [data-post-comments]')).toBeTruthy();
});
it('keeps draft edits and feedback when switching mobile views and saves through the existing baseline contract', async () => {
 const editDraft = vi.fn().mockResolvedValue({ ok: true }); const r = setup(video, { editDraft });
 fireEvent.click(tab(r, 'Comments & history')); fireEvent.click(r.getByRole('button', { name: 'Edit copy' }));
 fireEvent.change(r.getByRole('textbox', { name: 'Post copy' }), { target: { value: 'Changed caption.' } });
 fireEvent.click(tab(r, 'Preview')); fireEvent.click(tab(r, 'Comments & history'));
 expect((r.getByRole('textbox', { name: 'Post copy' }) as HTMLTextAreaElement).value).toBe('Changed caption.');
 fireEvent.click(r.getByRole('button', { name: 'Save edit' })); await waitFor(() => expect(editDraft).toHaveBeenCalledWith(video.id, 'Changed caption.', video.body));
 fireEvent.click(tab(r, 'Comments & history'));
 fireEvent.change(r.getByRole('textbox', { name: 'Add a comment' }), { target: { value: 'Change the ending.' } });
 fireEvent.click(tab(r, 'Preview')); fireEvent.click(tab(r, 'Comments & history'));
 expect((r.getByRole('textbox', { name: 'Add a comment' }) as HTMLTextAreaElement).value).toBe('Change the ending.');
});
it('retains carousel paging and text-only review without a redundant media tab', () => {
 const r = setup({ ...video, kind: 'carousel', style: 'carousel', media_url: null, image_urls: ['https://example.com/1.png','https://example.com/2.png'] });
 expect(r.container.querySelector('[data-review-li-preview] button[aria-label="Next page"]')).toBeTruthy();
 expect(r.container.querySelectorAll('[aria-label^="Document preview"]')).toHaveLength(1); cleanup();
 const t = setup({ ...video, style: 'text', media_url: null, image_urls: [] }); expect(t.queryByRole('tab', { name: 'Media' })).toBeNull(); expect(t.container.querySelector('[data-review-copy]')?.textContent).toContain('Complete caption.');
});
it('leaves other client drawers unchanged', () => {
 const r = setup(video, { slug: 'arch-agency' }); expect(r.container.querySelector('[data-review-workspace]')).toBeNull(); expect(r.queryByRole('tab', { name: 'Media' })).toBeNull(); expect(r.container.querySelector('.cb-sheet')).toBeTruthy();
});
it('retains the conflict guard and leaves the edit visible on a failed save', async () => {
 const r = setup(video, { initialEditing: true, editDraft: async () => ({ ok: false, error: 'changed_meanwhile' }) });
 fireEvent.change(r.getByRole('textbox', { name: 'Post copy' }), { target: { value: 'Keep my draft.' } });
 fireEvent.click(r.getByRole('button', { name: 'Save edit' }));
 await r.findByText(/This post was updated while you were editing/);
 expect((r.getByRole('textbox', { name: 'Post copy' }) as HTMLTextAreaElement).value).toBe('Keep my draft.');
});
it('keeps image removal, scheduling and buffer removal in the secondary tools', async () => {
 const setMedia = vi.fn().mockResolvedValue({ ok: true }); const setSchedule = vi.fn().mockResolvedValue({ ok: true }); const onHideBuffer = vi.fn().mockResolvedValue({ ok: true });
 const r = setup({ ...video, style: 'image', media_url: 'https://example.com/poster.png' }, { setMedia, setSchedule, onHideBuffer });
 fireEvent.click(r.getByText('Post tools and schedule'));
 fireEvent.click(r.getByRole('button', { name: 'Remove photo' }));
 await waitFor(() => expect(setMedia).toHaveBeenCalledWith(video.id, ''));
 expect(r.container.querySelector('.cb-review-media')).toBeNull();
 fireEvent.click(r.getByRole('button', { name: 'Change date & time' }));
 fireEvent.change(r.container.querySelector('input[type="date"]')!, { target: { value: '2026-10-21' } });
 fireEvent.click(r.getByRole('button', { name: 'Save time' }));
 await waitFor(() => expect(setSchedule).toHaveBeenCalledWith(video.id, expect.stringContaining('2026-10-21')));
 cleanup();
 const b = setup(video, { onHideBuffer }); fireEvent.click(b.getByText('Post tools and schedule')); fireEvent.click(b.getByRole('button', { name: 'Remove', exact: true }));
 await waitFor(() => expect(onHideBuffer).toHaveBeenCalledWith(video.id));
});

it('keeps the workspace read-only for viewers', () => {
 const r = render(<BoardTeamProvider value={{ me: 'viewer@example.invalid', comments: [], approvalMeta: {}, canComment: true, canApprove: false, addComment: async () => ({ ok: true }) }}><DetailModal item={video} board={board} accent="#FC5B06" stage="review" onClose={() => {}} onApprove={() => {}} isLive reviewMode slug="swishdm-live" act={async () => ({ ok: false })} /></BoardTeamProvider>);
 expect(r.queryByRole('button', { name: 'Approve ✓' })).toBeNull();
 expect(r.queryByRole('button', { name: 'Request changes' })).toBeNull();
 expect(r.queryByRole('button', { name: 'Edit copy' })).toBeNull();
 expect(r.container.querySelector('[data-view-only]')).toBeTruthy();
});

it('keeps the launch resource and comment keyword available in workspace tools', () => {
 const gate = { title: 'AI buyer report', url: 'https://example.com/buyer-report', keyword: 'BUYER' };
 const r = setup({ ...video, lm_gate: gate });
 fireEvent.click(r.getByText('Post tools and schedule'));
 expect(r.getByText(gate.title)).toBeTruthy();
 expect(r.getByText('comment BUYER')).toBeTruthy();
 expect(r.getByRole('link', { name: /example.com\/buyer-report/ }).getAttribute('href')).toBe(gate.url);
 expect(r.getByRole('button', { name: 'Approve ✓' })).toBeTruthy();
});

it('plays video inside the single LinkedIn preview while preserving the caption fold', () => {
 const long = 'Hook line that has to land.\n\n' + 'Body sentence that sits under the fold. '.repeat(30) + 'Final closing line.';
 const r = render(<DetailModal item={{ ...video, body: long }} board={{ ...board, founder: { name: 'Jonathan Kiekbusch', headline: 'Founder, SwishDM' } }} accent="#FC5B06" stage="review" onClose={() => {}} onApprove={async () => ({ ok: true })} isLive reviewMode slug="swishdm-live" editDraft={async () => ({ ok: true })} act={async () => ({ ok: true })} />);
 const li = r.container.querySelector('[data-review-li-preview]')!;
 expect(li.textContent).toContain('Jonathan Kiekbusch');
 expect(li.textContent).toContain('Founder, SwishDM');
 expect(li.textContent).toContain('Hook line that has to land.');
 expect(li.querySelector('video')?.getAttribute('src')).toBe(video.media_url);
 expect(li.querySelector('video')?.hasAttribute('controls')).toBe(true);
 expect(r.container.querySelector('.cb-review-media')).toBeNull();
 expect(r.container.querySelectorAll('video')).toHaveLength(1);
 const more = Array.from(li.querySelectorAll('button')).find(b => /see more/.test(b.textContent || ''))!;
 expect(li.textContent).not.toContain('Final closing line.');
 fireEvent.click(more);
 expect(li.textContent).toContain('Final closing line.');
 fireEvent.click(r.getByRole('button', { name: 'Edit copy' }));
 expect(r.getByRole('textbox', { name: 'Post copy' })).toBeTruthy();
 expect(r.container.querySelector('[data-review-li-preview]')).toBeNull();
});

it('shows one artwork and keeps the edit diff inside the activity sidebar', async () => {
 const r = setup({ ...video, style: 'image', media_url: 'https://example.com/artwork.png', image_urls: [] }, { fetchHistory: async () => [{ action: 'edit_copy', at: '2026-10-16T12:00:00Z', before: 'Old opening.', after: 'New opening.' }] });
 expect(r.container.querySelectorAll('img[src="https://example.com/artwork.png"]')).toHaveLength(1);
 await waitFor(() => expect(r.container.querySelector('[data-review-activity]')?.textContent).toContain('Edit history'));
 fireEvent.click(r.getByText('see what changed'));
 expect(r.container.querySelector('[data-review-activity]')?.textContent).toContain('New opening.');
 expect(r.container.querySelector('[data-review-activity]')?.textContent).toContain('Old opening.');
});

it('leaves video seeking keys with the player instead of changing posts', () => {
 const onNav = vi.fn(); const r = setup(video, { nav: { index: 1, total: 3 }, onNav });
 fireEvent.keyDown(r.container.querySelector('video')!, { key: 'ArrowRight' });
 expect(onNav).not.toHaveBeenCalled();
});
