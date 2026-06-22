import { describe, it, expect } from 'vitest';
import { buildFeedSpecFromContentSystem } from './contentSystemFeed';
import { normalizeFeedSpec } from './linkedinFeedSpec';
import type { ContentSystem } from './scanTypes';

const cs: ContentSystem = {
  archetype: 'invisible',
  founder: { name: 'Dana Reyes', first_name: 'Dana', headline: 'Fractional CFO' },
  thesis: 'You are invisible online.',
  audience_estimate: { value: 'an audience built over years' },
  observable_signals: [{ label: 'a', detail: 'b' }],
  leaking_signals: [{ title: 'a', detail: 'b' }, { title: 'c', detail: 'd' }, { title: 'e', detail: 'f' }],
  system: { summary: 's', capabilities: ['a', 'b', 'c'] },
  sample_output: {
    title: 'This week',
    posts: [
      { format: 'Post', hook: 'Three cash-flow mistakes.', body: 'Full body one.\n\nSecond paragraph.' },
      { format: 'Carousel', hook: 'A pre-M&A checklist.' }, // no body -> falls back to hook
    ],
    metrics: [{ label: 'posts a week', value: '5' }],
  },
};

describe('buildFeedSpecFromContentSystem', () => {
  it('maps posts to text posts, using body when present', () => {
    const spec = buildFeedSpecFromContentSystem(cs, { companyName: 'Acme' });
    expect(spec.profile.name).toBe('Dana Reyes');
    expect(spec.profile.headline).toBe('Fractional CFO');
    expect(spec.posts).toHaveLength(2);
    expect(spec.posts[0]).toMatchObject({ type: 'text', body: 'Full body one.\n\nSecond paragraph.' });
  });

  it('falls back to hook when a post has no body', () => {
    const spec = buildFeedSpecFromContentSystem(cs);
    expect(spec.posts[1].body).toBe('A pre-M&A checklist.');
  });

  it('produces a spec that normalizeFeedSpec accepts', () => {
    const spec = buildFeedSpecFromContentSystem(cs, { companyName: 'Acme' });
    expect(() => normalizeFeedSpec(spec, 'tease')).not.toThrow();
  });

  it('uses companyName then "You" when founder name missing', () => {
    const spec = buildFeedSpecFromContentSystem({ ...cs, founder: null }, { companyName: 'Acme' });
    expect(spec.profile.name).toBe('Acme');
    const spec2 = buildFeedSpecFromContentSystem({ ...cs, founder: null });
    expect(spec2.profile.name).toBe('You');
  });

  it('returns empty posts when there are none', () => {
    const spec = buildFeedSpecFromContentSystem({ ...cs, sample_output: { title: 'x', posts: [] } });
    expect(spec.posts).toEqual([]);
  });
});
