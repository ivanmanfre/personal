import { describe, it, expect } from 'vitest';
import { reachShares, weightedSplit, splitOf, formatShares } from './postReach';
import type { ReachCarrier } from './postReach';

const post = (reached: number | null, industry: { label: string; pct: number }[], inPct = 50) => ({
  network: { in_pct: inPct, out_pct: 100 - inPct, members_reached: reached },
  demographics: { industry },
});

describe('postReach', () => {
  it('shares are pct * members reached, over the reached of posts listing the category', () => {
    // A label that tops most lists on small posts is still small by members reached.
    const posts = [
      post(1000, [{ label: 'Software', pct: 20 }, { label: 'Advertising', pct: 5 }]),
      post(100, [{ label: 'Advertising', pct: 30 }]),
      post(100, [{ label: 'Advertising', pct: 30 }]),
      post(50, []), // lists no industry: excluded from the base
      post(null, [{ label: 'Advertising', pct: 90 }]), // no members reached: no weight
    ];
    const r = reachShares(posts, 'industry', 3)!;
    // Software 200 / 1200 = 16.7 -> 17; Advertising (50 + 30 + 30) / 1200 = 9.2 -> 9
    expect(r.labels).toEqual([{ label: 'Software', pct: 17 }, { label: 'Advertising', pct: 9 }]);
    expect(r.posts).toBe(3);
    expect(r.reached).toBe(1200);
    expect(formatShares(r.labels)).toBe('Software 17% · Advertising 9%');
  });

  it('returns null when nothing qualifies, and drops labels that round to 0%', () => {
    expect(reachShares([post(null, [{ label: 'X', pct: 10 }])], 'industry')).toBeNull();
    expect(reachShares([post(1000, [{ label: 'Tiny', pct: 0.2 }])], 'industry')).toBeNull();
    expect(reachShares([], 'job_title')).toBeNull();
  });

  it('weights the split, counting an unweighted post once, and skips posts without it', () => {
    const rows: (ReachCarrier & { w: number })[] = [{ ...post(1, [], 20), w: 300 }, { ...post(1, [], 80), w: 0 }, { w: 999 }];
    const s = weightedSplit(rows, (p) => p.w)!;
    // (80*300 + 20*1) / 301 = 79.8 -> 80 out
    expect(s).toEqual({ inPct: 20, outPct: 80, n: 2 });
    expect(weightedSplit([{}], () => 1)).toBeNull();
    expect(splitOf({ network: { in_pct: 40 } })).toBeNull();
  });
});
