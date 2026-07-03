import { describe, it, expect } from 'vitest';
import { isPostScraped } from './scrapeStatus';

const base = { impressions: 0, likes: 0, comments: 0, shares: 0, metricsUpdatedAt: null as string | null };

describe('isPostScraped', () => {
  it('is scraped when a metrics timestamp is present', () => {
    expect(isPostScraped({ ...base, metricsUpdatedAt: '2026-07-03T00:00:00Z' })).toBe(true);
  });
  it('is scraped when legacy metrics exist even without a timestamp', () => {
    expect(isPostScraped({ ...base, impressions: 120 })).toBe(true);
    expect(isPostScraped({ ...base, likes: 3 })).toBe(true);
  });
  it('is NOT scraped when there is no timestamp and no metrics at all', () => {
    expect(isPostScraped(base)).toBe(false);
  });
});
