// @vitest-environment jsdom
/**
 * Review-mode smoke (2026-08-26, ARCH panel review mode).
 *
 * The contract under test, from GOAL-arch-panel-review-mode-2026-08-26:
 *  - board.review_mode + live  -> the DetailModal carries the Approve/Request-changes bar
 *    (previously preview-only), and an approved draft renders the Approved ✓ state.
 *  - live WITHOUT the flag (RISE posture) -> byte-identical to before: no approve bar.
 *  - preview boards keep the bar exactly as before, flag or no flag.
 *
 * Static renders only: no effects fire, so history/version rendering is covered by the
 * versionOf logic living inside the component (exercised live in the P3 walkthrough).
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render as rtlRender, waitFor, cleanup, fireEvent } from '@testing-library/react';
import { DetailModal, setBoardZone } from '../ClientBoardPage';
import DeskReviewSurface from './DeskReviewSurface';
import type { Board, QueueItem, HistoryEntry } from '../ClientBoardPage';

const noopAct = async () => ({ ok: true });

const ITEM: QueueItem = {
  id: 'draft-1', kind: 'post', stage: 'review', title: 'The coin flip',
  hook: 'A broad-reach creator test gives you a hit or a zero.',
  body: 'A broad-reach creator test gives you a hit or a zero. '.repeat(4),
  publish_date: '2026-09-07',
} as QueueItem;

const BOARD = { company_name: 'ARCH', queue: [ITEM] } as unknown as Board;

function render(props: { isLive: boolean; reviewMode?: boolean; approved?: boolean }) {
  return renderToStaticMarkup(
    <DetailModal
      item={ITEM} board={BOARD} accent="#FFC71D" stage="review"
      onClose={() => {}} onApprove={() => {}}
      isLive={props.isLive} reviewMode={props.reviewMode} approved={props.approved}
      act={noopAct} slug="arch-agency"
    />,
  );
}

describe('DetailModal review mode', () => {
  it('keeps source context above the post and renders metadata without a label', () => {
    const item = { ...ITEM, body: 'The complete post body.', source_detail: {
      kind: 'source_commentary', source_url: 'https://example.com/original',
      explanation: 'Why this matters to the buyer.', claim_boundary: 'The figure is self-reported.',
    } } as QueueItem;
    const html = renderToStaticMarkup(<DetailModal item={item} board={BOARD} accent="#3562FF" stage="review"
      onClose={() => {}} onApprove={() => {}} isLive reviewMode act={noopAct} slug="arch-agency" />);
    expect(html.indexOf('data-post-source')).toBeLessThan(html.indexOf('The complete post body.'));
    expect(html.match(/Why this matters to the buyer\./g)).toHaveLength(1);
    expect(html).toContain('href="https://example.com/original"');
    expect(html).toContain('The figure is self-reported.');
  });
  it('live + review_mode: approve bar and request-changes render', () => {
    const html = render({ isLive: true, reviewMode: true });
    expect(html).toContain('Approve ✓');
    expect(html).toContain('Request changes');
    // The copy tells the truth about what approve does: marks, never schedules.
    expect(html).toContain('Approval saves your sign-off. Scheduling is separate.');
  });

  it('live + review_mode + approved: renders the Approved state, not the button', () => {
    const html = render({ isLive: true, reviewMode: true, approved: true });
    expect(html).toContain('Approved ✓');
    expect(html).not.toContain('>Approve ✓<');
    expect(html).toContain('Request changes');
  });

  it('live WITHOUT the flag (RISE posture): no approve bar at all — regression gate', () => {
    const html = render({ isLive: true });
    expect(html).not.toContain('Approve ✓');
    expect(html).not.toContain('Request changes');
    expect(html).toContain('It publishes on its slot.');
  });

  it('preview boards keep the bar exactly as before', () => {
    const html = render({ isLive: false });
    expect(html).toContain('Approve ✓');
    expect(html).toContain('Request changes');
  });
});

/* 27 Sep (Ivan): RISE never approves posts. Review mode (approval + source notes) belongs
   ONLY to boards with board.review_mode; commit 9073036 had forced it onto every live desk
   board. These pin the RISE posture and the ARCH posture side by side. */
const SOURCED: QueueItem = {
  id: 'draft-src', kind: 'post', stage: 'review', title: 'Sourced buffer post',
  hook: 'A post with internal provenance.', body: 'The buffer post body.',
  source_label: 'Competitor',
  source_detail: { kind: 'source_commentary', source: 'Chad Davis · Competitor', source_url: 'https://example.com/chad',
    explanation: 'Preserves the complaint.', claim_boundary: 'Self-reported.' },
} as unknown as QueueItem;
const RISE_BOARD = { company_name: 'RISE DTC', domain: 'risedtc.com', founder: { name: 'Mattan Danino', first_name: 'Mattan' }, queue: [SOURCED] } as unknown as Board;

describe('live board WITHOUT review_mode (RISE): buffer only', () => {
  it('drawer: no Approve, no Request changes, no source, no approval copy; normal tools stay', () => {
    const html = renderToStaticMarkup(<DetailModal item={SOURCED} board={RISE_BOARD} accent="#FFC71D" stage="review"
      onClose={() => {}} onApprove={() => {}} onHideBuffer={async () => ({ ok: true })} isLive act={noopAct} slug="risedtc-com" />);
    expect(html).not.toContain('Approve');
    expect(html).not.toContain('Request changes');
    expect(html).not.toContain('data-post-source');
    expect(html).not.toContain('Why this post');
    expect(html).not.toContain('Chad Davis');
    expect(html).not.toContain('Approval saves');
    expect(html).toContain('Ready in the buffer.');
    expect(html).toContain('>Edit<');
    expect(html).toContain('Remove');
  });

  const surface = (reviewMode: boolean) => {
    const board = { ...RISE_BOARD, queue: [SOURCED, { ...SOURCED, id: 'draft-2', title: 'Second buffer post' }] } as unknown as Board;
    return rtlRender(<DeskReviewSurface board={board} accent="#FFC71D" mint="#2F7D4F" stageOf={(q) => q.stage}
      onOpen={() => {}} onOpenIdea={() => {}} onApprove={async () => ({ ok: true })} flashId={null} view="list" setView={() => {}}
      skips={{}} live reviewMode={reviewMode} onFeedback={async () => ({ ok: true })} />);
  };
  const openAll = (c: HTMLElement) => Array.from(c.querySelectorAll('[role="button"][aria-expanded="false"]')).forEach((el) => fireEvent.click(el));

  it('All content: no pending-approval split, no Review 2-up, no Approve, no source', () => {
    const r = surface(false); openAll(r.container);
    Array.from(r.container.querySelectorAll('summary')).forEach((el) => fireEvent.click(el));
    // The scoped <style> block carries CSS comments; judge what renders.
    const html = r.container.innerHTML.replace(/<style>[\s\S]*?<\/style>/g, '');
    expect(html).not.toMatch(/pending approval/i);
    expect(html).not.toContain('Approve');
    expect(html).not.toContain('Approval saves');
    expect(html).not.toContain('data-buffer-group');
    expect(html).not.toContain('data-post-source');
    expect(html).not.toContain('Competitor');
    expect(Array.from(r.container.querySelectorAll('button')).some((b) => b.textContent === 'Review')).toBe(false);
    // The buffer posts still show, ready to schedule, with the normal tools.
    expect(html).toContain('Sourced buffer post');
    expect(html).toContain('Second buffer post');
    expect(html).toContain('Edit copy');
    expect(html).toContain('Edit time');
    cleanup();
  });

  it('with review_mode (ARCH) the review section is still there', () => {
    const r = surface(true); openAll(r.container);
    const html = r.container.innerHTML;
    expect(html).toMatch(/pending approval/i);
    expect(html).toContain('data-buffer-group="pending"');
    expect(Array.from(r.container.querySelectorAll('button')).some((b) => b.textContent === 'Review')).toBe(true);
    cleanup();
  });
});

describe('drawer history: client-safe authors and notes (27 Sep)', () => {
  const HISTORY: HistoryEntry[] = [
    { action: 'set_media', at: '2026-09-22T14:05:00Z', by: 'im@ivanmanfredi.com', note: "set via Claude 09-22 on Ivan's instruction: real page screenshot", before: '', after: 'https://x.supabase.co/storage/v1/object/public/a.png' },
    { action: 'note', event: 'video_lane_armed', at: '2026-09-21T10:00:00Z', by: 'im@ivanmanfredi.com', note: 'Thursday video lane V2 switched to AUTO-POST' },
    { action: 'set_schedule', at: '2026-09-20T16:00:00Z', by: 'claude (family photo off tactics post, 09-26)', before: null, after: '2026-09-28T14:00:00Z' },
    { action: 'request_changes', at: '2026-09-19T15:00:00Z', by: 'mattan@risedtc.com', note: 'Make the hook shorter' },
    { action: 'edit_copy', at: '2026-09-18T15:00:00Z', by: 'mattan@risedtc.com', before: 'Old line', after: 'New line' },
  ] as HistoryEntry[];

  it('never prints an email or an operator note; client rows read You, the rest read the company team', async () => {
    setBoardZone('risedtc-com');
    const r = rtlRender(<DetailModal item={SOURCED} board={RISE_BOARD} accent="#FFC71D" stage="review"
      onClose={() => {}} onApprove={() => {}} isLive act={noopAct} slug="risedtc-com" fetchHistory={async () => HISTORY} />);
    await waitFor(() => expect(r.container.innerHTML).toContain('History'));
    const text = r.container.textContent || '';
    expect(text).not.toContain('@');
    expect(text).not.toContain('ivanmanfredi');
    expect(text).not.toMatch(/claude/i);
    expect(text).not.toContain('set via');
    expect(text).not.toContain('video lane');
    expect(text).not.toContain('Note sent');
    expect(text).toContain('Photo changed · RISE DTC team');
    expect(text).toContain('Rescheduled · RISE DTC team');
    expect(text).toContain('now: Mon 28 Sept, 7:00 AM PT');
    expect(text).toContain('Change requested · You');
    expect(text).toContain('Make the hook shorter');
    expect(text).toContain('Copy edited · You');
    expect(text).toContain('see what changed');
    // Times read in the board's zone (PT), labelled.
    expect(text).toContain('22 Sept, 7:05 AM PT');
    cleanup();
  });
});
