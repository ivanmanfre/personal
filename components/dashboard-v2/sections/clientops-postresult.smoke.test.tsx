// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LiveLane, PostResult } from './ClientOps';
import type { Draft, PostStat } from './clientops2/shared';

/**
 * Client Ops shows the two numbers the buyer slot exists to produce: inbound DMs the
 * engine traced back to a post, and the share of that post's judged engagers who run a
 * brand. This surface is behind a password + Supabase OTP, so it is verified here
 * rather than by screenshot.
 *
 * The rows below are the REAL payload shape of operator_client_post_stats, copied from a
 * live call on 2026-09-06 (risedtc). The point of the test is the contract the operator
 * relies on: zeros are drawn (they are the finding), and "not judged yet" is drawn as
 * itself rather than as 0%.
 */
const LIVE: PostStat = {
  post_id: '9bb51325-f1da-430a-b46e-0064594c5fe0',
  activity_id: '7498016455804768256',
  social_id: 'urn:li:activity:7498016455804768256',
  title: 'Why the F*ck are you still paying an ADS "manager"',
  post_url: 'https://www.linkedin.com/posts/mattandanino_x-activity-7498016455804768256-aaaa',
  published_at: '2026-08-25T14:00:29.473+00:00',
  impressions: 198, reactions: 3, comments: 0, profile_views: 0,
  inbound_dms: 1, engagers: 3, judged: 3, owners: 0, providers: 2, owner_share: 0,
};
const REACHED: PostStat = {
  ...LIVE,
  post_id: 'adc1152f-5c5d-437e-8b46-219887c576a4',
  activity_id: '7501647892869394432',
  title: 'Five years ago, you hired an agency to do the work',
  impressions: 321, inbound_dms: 0, engagers: 8, judged: 8, owners: 2, providers: 4, owner_share: 0.25,
};
const UNHARVESTED: PostStat = {
  ...LIVE, post_id: 'c0000000-0000-0000-0000-000000000000', activity_id: '7400000000000000000',
  title: 'A post nobody has harvested yet',
  impressions: 140, inbound_dms: 0, engagers: 0, judged: 0, owners: 0, providers: 0, owner_share: null,
};

const draft = (id: string, activityId: string, title: string): Draft => ({
  id, title, status: 'published', qa_score: null, qa: null, agent_log: [], taxonomy: null,
  source_post_id: activityId, idea_source_label: null, idea_source_ref: null, idea_icp_score: null,
  board_visible: false, created_at: '2026-08-25T00:00:00Z', published_at: '2026-08-25T14:00:00Z',
  post_body: null, type: 'text', has_media: true, scheduled_at: null,
});

describe('Client Ops post results', () => {
  it('draws the attributed DM count and the owner share, zeros included', () => {
    const html = renderToStaticMarkup(<PostResult s={LIVE} />);
    expect(html).toContain('198 reads');
    expect(html).toContain('1 inbound DM');
    // The zero IS the finding on this surface: nobody who reacted runs a brand.
    expect(html).toContain('0% owners (0/3)');
  });

  it('says "not judged yet" instead of 0% when nothing has been harvested', () => {
    const html = renderToStaticMarkup(<PostResult s={UNHARVESTED} />);
    expect(html).toContain('owners not judged yet');
    expect(html).not.toContain('0% owners');
  });

  it('renders nothing at all for a post with no stat row', () => {
    expect(renderToStaticMarkup(<PostResult s={undefined} />)).toBe('');
  });

  it('joins a published draft to its stat on the bare activity id', () => {
    const html = renderToStaticMarkup(
      <LiveLane
        live={[]}
        published={[
          draft('d1', '7498016455804768256', 'The honest version of how we scaled'),
          draft('d2', '7501647892869394432', 'Execution stopped being what an agency sells'),
        ]}
        postStats={[LIVE, REACHED]}
        toggleBusyId={null}
        onToggle={() => {}}
        loading={false}
      />,
    );
    expect(html).toContain('1 inbound DM');
    expect(html).toContain('25% owners (2/8)');
  });

  it('renders the lane unchanged when the stats read failed (null, never zeros)', () => {
    const html = renderToStaticMarkup(
      <LiveLane
        live={[]}
        published={[draft('d1', '7498016455804768256', 'The honest version of how we scaled')]}
        postStats={null}
        toggleBusyId={null}
        onToggle={() => {}}
        loading={false}
      />,
    );
    expect(html).toContain('The honest version of how we scaled');
    expect(html).not.toContain('inbound DM');
  });
});
