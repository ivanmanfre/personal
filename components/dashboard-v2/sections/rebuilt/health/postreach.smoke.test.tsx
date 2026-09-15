// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PostReachLine, PostReachRollup } from './PostReach';

/** Shaped like ivan_post_reach() rows (client_post_metrics.meta), test-only values. */
const A = {
  impressions: 5229,
  network: { in_pct: 20, out_pct: 80, members_reached: 3670 },
  demographics: {
    job_title: [{ label: 'Founder', pct: 12 }, { label: 'Chief Executive Officer', pct: 5 }, { label: 'Co-Founder', pct: 3 }],
    industry: [{ label: 'Software Development', pct: 14 }, { label: 'IT Services and IT Consulting', pct: 10 }],
  },
};
const B = {
  impressions: 251,
  network: { in_pct: 49, out_pct: 51, members_reached: 189 },
  demographics: { job_title: [{ label: 'Founder', pct: 14 }], industry: [{ label: 'IT Services and IT Consulting', pct: 19 }] },
};
const NONE = { impressions: 90 };

describe('PostReach (Ivan dashboard, Health > Overview)', () => {
  it('per post: split bar, both shares, members reached, top 2 job titles + top industry', () => {
    const html = renderToStaticMarkup(<PostReachLine reach={A} />);
    expect(html).toContain('data-viz="split"');
    expect(html).toContain('In network 20%');
    expect(html).toContain('Out of network 80%');
    expect(html).toContain('Reached 3,670');
    expect(html).toContain('Founder 12%, Chief Executive Officer 5%');
    expect(html).not.toContain('Co-Founder');
    expect(html).toMatch(/Industry<\/b> Software Development 14%/);
    expect(html).not.toContain('NaN');
  });

  it('a post with no captured split renders nothing', () => {
    expect(renderToStaticMarkup(<PostReachLine reach={null} />)).toBe('');
    expect(renderToStaticMarkup(<PostReachLine reach={{ network: { in_pct: 50 } }} />)).toBe('');
  });

  it('roll-up: impressions-weighted out of network + share of members reached', () => {
    const html = renderToStaticMarkup(<PostReachRollup posts={[A, B, NONE]} windowLabel="last 30 days" />);
    // (80*5229 + 51*251) / 5480 = 78.7 -> 79 out, (20*5229 + 49*251) / 5480 = 21.3 -> 21 in
    expect(html).toContain('Who your posts reached');
    expect(html).toContain('2 posts, last 30 days');
    expect(html).toMatch(/>79%</);
    expect(html).toContain('In network 21%');
    expect(html).toContain('Weighted by impressions across 2 posts.');
    expect(html).toContain('Share of members reached');
    // base 3670 + 189 = 3859. Founder (440.4 + 26.46) / 3859 = 12.1 -> 12%;
    // CEO 183.5 / 3859 = 4.8 -> 5%; Co-Founder 110.1 / 3859 = 2.9 -> 3%
    expect(html).toMatch(/data-share="role"[\s\S]{0,200}?>Founder 12% · Chief Executive Officer 5% · Co-Founder 3%</);
    // Software 513.8 / 3859 = 13.3 -> 13%; IT Services (367 + 35.91) / 3859 = 10.4 -> 10%
    expect(html).toMatch(/data-share="industry"[\s\S]{0,200}?>Software Development 13% · IT Services and IT Consulting 10%</);
    expect(html).not.toContain('NaN');
  });

  it('roll-up renders nothing when no post in the window carries the split', () => {
    expect(renderToStaticMarkup(<PostReachRollup posts={[NONE]} windowLabel="last 30 days" />)).toBe('');
  });
});
