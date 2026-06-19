import { describe, it, expect } from 'vitest';
import { normalizeFeedSpec, type FeedSpec } from './linkedinFeedSpec';

const base: FeedSpec = {
  profile: { name: 'Jane Doe', headline: 'Founder, Acme', avatarUrl: '/x.jpg' },
  posts: [{ type: 'text', body: 'Hello world' }],
  lmCard: { coverUrl: '/cover.jpg', title: 'The Guide' },
};

describe('normalizeFeedSpec', () => {
  it('throws when profile.name is blank', () => {
    expect(() => normalizeFeedSpec({ ...base, profile: { ...base.profile, name: '  ' } }))
      .toThrow(/profile\.name/);
  });

  it('throws when there are no posts', () => {
    expect(() => normalizeFeedSpec({ ...base, posts: [] })).toThrow(/at least one post/);
  });

  it('throws when a post body is empty', () => {
    expect(() => normalizeFeedSpec({ ...base, posts: [{ type: 'text', body: '' }] }))
      .toThrow(/non-empty body/);
  });

  it('throws when an image post lacks imageUrl', () => {
    expect(() => normalizeFeedSpec({ ...base, posts: [{ type: 'image', body: 'pic', imageUrl: '' }] }))
      .toThrow(/imageUrl/);
  });

  it('drops lmCard in tease mode even when supplied', () => {
    expect(normalizeFeedSpec(base, 'tease').lmCard).toBeNull();
  });

  it('includes lmCard with default pages (8) in full mode', () => {
    expect(normalizeFeedSpec(base, 'full').lmCard).toEqual({
      coverUrl: '/cover.jpg', title: 'The Guide', pages: 8,
    });
  });

  it('lmCard is null in full mode when none supplied', () => {
    const { lmCard, ...rest } = base; void lmCard;
    expect(normalizeFeedSpec(rest as FeedSpec, 'full').lmCard).toBeNull();
  });

  it('defaults to tease mode', () => {
    expect(normalizeFeedSpec(base).lmCard).toBeNull();
  });
});
