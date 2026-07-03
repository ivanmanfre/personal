import { describe, it, expect } from 'vitest';
import { minSampleRanking, dedupeTicks } from './perfRankings';

describe('minSampleRanking', () => {
  it('splits rows at the min-sample threshold (default 3)', () => {
    const rows = [{ name: 'a', count: 6 }, { name: 'b', count: 3 }, { name: 'c', count: 2 }, { name: 'd', count: 1 }];
    const { ranked, pending } = minSampleRanking(rows);
    expect(ranked.map(r => r.name)).toEqual(['a', 'b']);
    expect(pending.map(r => r.name)).toEqual(['c', 'd']);
  });
  it('respects a custom minN and preserves input order', () => {
    const rows = [{ name: 'x', count: 5 }, { name: 'y', count: 4 }];
    expect(minSampleRanking(rows, 5).ranked.map(r => r.name)).toEqual(['x']);
  });
  it('handles empty input', () => {
    expect(minSampleRanking([])).toEqual({ ranked: [], pending: [] });
  });
});

describe('dedupeTicks', () => {
  it('keeps first occurrence, drops repeats, preserves order', () => {
    expect(dedupeTicks(['Jun 4', 'Jun 8', 'Jun 8', 'Jun 10', 'Jun 8'])).toEqual(['Jun 4', 'Jun 8', 'Jun 10']);
  });
  it('is a no-op on already-unique input', () => {
    expect(dedupeTicks(['Jun 4', 'Jun 11', 'Jun 18'])).toEqual(['Jun 4', 'Jun 11', 'Jun 18']);
  });
});
