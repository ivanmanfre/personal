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
import { DetailModal } from '../ClientBoardPage';
import type { Board, QueueItem } from '../ClientBoardPage';

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
  it('live + review_mode: approve bar and request-changes render', () => {
    const html = render({ isLive: true, reviewMode: true });
    expect(html).toContain('Approve ✓');
    expect(html).toContain('Request changes');
    // The copy tells the truth about what approve does: marks, never schedules.
    expect(html).toContain('Approving marks it good to post');
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
