// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DetailModal, FeedPreview, type Board, type QueueItem } from '../ClientBoardPage';

const item: QueueItem = { id: 'video', kind: 'post', style: 'video', stage: 'review', title: 'Shopping video', body: 'Source-grounded caption.', media_url: 'https://madebyswishdm.com/media/shopping.mp4', image_urls: ['https://madebyswishdm.com/media/still.png'] };
const board = { company_name: 'SwishDM', queue: [item] } as Board;

describe('Client video previews', () => {
  it('plays a buffer video beside its full caption in the review drawer', () => {
    const html = renderToStaticMarkup(<DetailModal item={item} board={board} accent="#FC5B06" stage="review" onClose={() => {}} onApprove={() => {}} isLive reviewMode act={async () => ({ ok: true })} slug="swishdm-live" />);
    expect(html).toMatch(/<video[^>]+src="https:\/\/madebyswishdm.com\/media\/shopping.mp4"/);
    expect(html).toContain('poster="https://madebyswishdm.com/media/still.png"');
    expect(html).toContain('Source-grounded caption.');
    expect(html).not.toContain('<img src="https://madebyswishdm.com/media/shopping.mp4"');
  });
  it('plays the same video in the feed review', () => {
    const html = renderToStaticMarkup(<FeedPreview item={item} board={board} accent="#FC5B06" fontStack="Lato" live />);
    expect(html).toContain('<video');
    expect(html).toContain('src="https://madebyswishdm.com/media/shopping.mp4"');
    expect(html).not.toContain('<img src="https://madebyswishdm.com/media/shopping.mp4"');
  });
});
