// @vitest-environment jsdom
/**
 * useCompetitors — the pure stats function.
 *
 * Correction ledger C12 / C13 / C14 (goal-run audience-learning-01-trace-2026-09-09):
 *   C12  competitor_role was never selected, so a format reference could become a
 *        peer-performance baseline.
 *   C13  the `: 0` fallback rendered a real 0 for every account with no post in
 *        the slice, and an arithmetic mean over a right-skewed handful of posts
 *        is carried by one outlier.
 *   C14  the panel called the hook with no window at all.
 *
 * These tests pin the repaired behaviour. Nothing here touches the network: the
 * whole computation is `competitorStatsFor(patterns, posts, days, now)`.
 */
import { describe, it, expect } from 'vitest';
import { competitorStatsFor, medianOf } from './useCompetitors';
import type { CompetitorPostWithRole } from './useCompetitors';
import type { CompetitorPattern } from '../types/dashboard';

const NOW = Date.parse('2026-09-09T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function pattern(name: string, id = name): CompetitorPattern {
  return { id, competitorName: name, postCount: 40, patternsJson: null, patternText: null };
}
function post(
  name: string, likes: number, comments: number, ageDays: number,
  role: string | null = 'topical', id = `${name}-${ageDays}-${likes}`,
): CompetitorPostWithRole {
  return {
    id, competitorName: name, competitorRole: role, postText: '', postDate: daysAgo(ageDays),
    likesCount: likes, commentsCount: comments, repostsCount: 0, postType: 'text',
    topicCategory: null, hookPattern: null, isTopPerformer: false, hasOpportunity: false,
    theOpportunity: null, suggestedAngle: null, suggestedFormat: null,
    linkedinPostUrl: null, linkedinProfileUrl: null, opportunityActioned: false,
  };
}

describe('medianOf', () => {
  it('is null on an empty list, never 0', () => {
    expect(medianOf([])).toBeNull();
  });
  it('takes the middle value, and the mean of the two middles on an even list', () => {
    expect(medianOf([5, 1, 3])).toBe(3);
    expect(medianOf([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('competitorStatsFor: an account with no post in the window', () => {
  const patterns = [pattern('Quiet Co'), pattern('Busy Co')];
  const posts = [
    post('Busy Co', 10, 2, 3),
    post('Busy Co', 20, 4, 10),
    // Quiet Co's only post is 200 days old: outside every window offered
    post('Quiet Co', 900, 90, 200),
  ];

  it('reports null, NOT 0, for both averages and both medians', () => {
    const { stats } = competitorStatsFor(patterns, posts, 30, NOW);
    const quiet = stats.find((s) => s.competitorName === 'Quiet Co')!;
    expect(quiet.recentPostCount).toBe(0);
    expect(quiet.avgLikes).toBeNull();
    expect(quiet.avgComments).toBeNull();
    expect(quiet.median).toBeNull();
    expect(quiet.medianComments).toBeNull();
    // and it is emphatically not a zero
    expect(quiet.avgLikes).not.toBe(0);
    expect(quiet.median).not.toBe(0);
  });

  it('still reports the account, so it is visible as unmeasured rather than dropped', () => {
    const { stats } = competitorStatsFor(patterns, posts, 30, NOW);
    expect(stats.map((s) => s.competitorName).sort()).toEqual(['Busy Co', 'Quiet Co']);
  });

  it('computes the busy account over the window only, with n disclosed', () => {
    const { stats } = competitorStatsFor(patterns, posts, 30, NOW);
    const busy = stats.find((s) => s.competitorName === 'Busy Co')!;
    expect(busy.recentPostCount).toBe(2);
    expect(busy.avgLikes).toBe(15);
    expect(busy.median).toBe(15);
    expect(busy.medianComments).toBe(3);
  });
});

describe('competitorStatsFor: the median is not the mean', () => {
  it('one outlier moves the mean and leaves the median alone', () => {
    const posts = [
      post('Skewed Co', 5, 0, 1), post('Skewed Co', 6, 0, 2),
      post('Skewed Co', 7, 0, 3), post('Skewed Co', 900, 0, 4),
    ];
    const { stats } = competitorStatsFor([pattern('Skewed Co')], posts, 30, NOW);
    const s = stats[0];
    expect(s.avgLikes).toBe(230);   // dragged by the one big post
    expect(s.median).toBe(6.5);     // the figure to read first
  });
});

describe('competitorStatsFor: roles', () => {
  const patterns = [pattern('Peer Co'), pattern('Look Co'), pattern('New Co')];
  const posts = [
    post('Peer Co', 10, 1, 2, 'topical'),
    post('Look Co', 5000, 400, 2, 'style_only'),
    post('Look Co', 4000, 300, 5, 'style_only'),
    post('New Co', 12, 2, 2, null),
  ];

  it('a format reference never enters the performance baseline', () => {
    const r = competitorStatsFor(patterns, posts, 30, NOW);
    expect(r.stats.map((s) => s.competitorName).sort()).toEqual(['New Co', 'Peer Co']);
    expect(r.styleOnly.map((s) => s.competitorName)).toEqual(['Look Co']);
    // it is kept and measured on its own, not deleted
    expect(r.styleOnly[0].recentPostCount).toBe(2);
    expect(r.styleOnly[0].median).toBe(4500);
  });

  it('an account with no role yet stays in the baseline and is counted as unclassified', () => {
    const r = competitorStatsFor(patterns, posts, 30, NOW);
    expect(r.unclassified).toBe(1);
    expect(r.stats.find((s) => s.competitorName === 'New Co')!.recentPostCount).toBe(1);
  });
});

describe('competitorStatsFor: the window is reported, not implied', () => {
  it('carries the window and the date of the newest post inside it', () => {
    const posts = [post('Peer Co', 10, 1, 2), post('Peer Co', 8, 1, 9)];
    const r = competitorStatsFor([pattern('Peer Co')], posts, 30, NOW);
    expect(r.windowDays).toBe(30);
    expect(r.asOf).toBe(daysAgo(2));
  });

  it('reports asOf as null when nothing falls in the window, rather than today', () => {
    const posts = [post('Peer Co', 10, 1, 400)];
    const r = competitorStatsFor([pattern('Peer Co')], posts, 30, NOW);
    expect(r.asOf).toBeNull();
  });

  it('an absent window means every post, and says so', () => {
    const posts = [post('Peer Co', 10, 1, 400)];
    const r = competitorStatsFor([pattern('Peer Co')], posts, undefined, NOW);
    expect(r.windowDays).toBeNull();
    expect(r.stats[0].recentPostCount).toBe(1);
  });
});
