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

const csWithImage: ContentSystem = {
  ...cs,
  sample_output: {
    title: 'This week',
    posts: [
      { format: 'Post', hook: 'Three cash-flow mistakes.', body: 'Full body one.\n\nSecond paragraph.' },
      { format: 'Image', hook: 'A brand moment.', body: 'Image post body.', image_url: 'https://cdn.example.com/img.jpg', image_kind: 'brand' },
    ],
    metrics: [{ label: 'posts a week', value: '5' }],
  },
};

const csWithLm: ContentSystem = {
  ...cs,
  sample_output: {
    ...cs.sample_output!,
    lm: { title: 'AI Ops Playbook', cover_url: 'https://cdn.example.com/cover.jpg', pages: 12 },
  },
};

const csWithLmNoPagesField: ContentSystem = {
  ...cs,
  sample_output: {
    ...cs.sample_output!,
    lm: { title: 'AI Ops Playbook', cover_url: 'https://cdn.example.com/cover.jpg' },
  },
};

// A scan whose posts include a dedicated 'Lead magnet' post (the common shape).
const csWithLmPost: ContentSystem = {
  ...cs,
  sample_output: {
    title: 'This week',
    posts: [
      { format: 'Post', hook: 'h1', body: 'Body one.' },
      { format: 'Lead magnet', hook: 'Grab the playbook.', body: 'LM post body.' },
      { format: 'Newsletter', hook: 'h3', body: 'Body three.' },
    ],
    lm: { title: 'The Playbook', cover_url: 'https://cdn.example.com/lm.jpg', pages: 8 },
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

  it('maps a post with image_url to an image post', () => {
    const spec = buildFeedSpecFromContentSystem(csWithImage);
    expect(spec.posts[1]).toMatchObject({ type: 'image', body: 'Image post body.', imageUrl: 'https://cdn.example.com/img.jpg' });
  });

  it('maps a post without image_url to a text post', () => {
    const spec = buildFeedSpecFromContentSystem(csWithImage);
    expect(spec.posts[0]).toMatchObject({ type: 'text', body: 'Full body one.\n\nSecond paragraph.' });
  });

  it('sets lmCard when cs.sample_output.lm has a cover_url', () => {
    const spec = buildFeedSpecFromContentSystem(csWithLm);
    expect(spec.lmCard).toEqual({ coverUrl: 'https://cdn.example.com/cover.jpg', title: 'AI Ops Playbook', pages: 12 });
  });

  it('passes lm.pages through as undefined when not provided', () => {
    const spec = buildFeedSpecFromContentSystem(csWithLmNoPagesField);
    expect(spec.lmCard).toEqual({ coverUrl: 'https://cdn.example.com/cover.jpg', title: 'AI Ops Playbook', pages: undefined });
  });

  it('leaves lmCard undefined when cs.sample_output.lm is absent', () => {
    const spec = buildFeedSpecFromContentSystem(cs);
    expect(spec.lmCard).toBeUndefined();
  });

  it('drops the lead-magnet post from the feed when the LM card is present (no duplicate)', () => {
    const spec = buildFeedSpecFromContentSystem(csWithLmPost);
    expect(spec.lmCard?.coverUrl).toBe('https://cdn.example.com/lm.jpg');
    expect(spec.posts).toHaveLength(2);
    expect(spec.posts.map((p) => p.body)).toEqual(['Body one.', 'Body three.']);
    expect(spec.posts.some((p) => p.body === 'LM post body.')).toBe(false);
  });

  it('keeps the lead-magnet post as text when there is no LM card', () => {
    const noCard: ContentSystem = {
      ...csWithLmPost,
      sample_output: { ...csWithLmPost.sample_output!, lm: undefined },
    };
    const spec = buildFeedSpecFromContentSystem(noCard);
    expect(spec.lmCard).toBeUndefined();
    expect(spec.posts).toHaveLength(3);
    expect(spec.posts.some((p) => p.body === 'LM post body.')).toBe(true);
  });

  it('maps a post with image_urls (>=2) to a carousel post', () => {
    const csWithCarousel: ContentSystem = {
      ...cs,
      sample_output: {
        title: 'This week',
        posts: [
          { format: 'Carousel', hook: 'Three slides.', body: 'Carousel body.', image_urls: ['a', 'b', 'c'] },
        ],
      },
    };
    const spec = buildFeedSpecFromContentSystem(csWithCarousel);
    expect(spec.posts[0]).toMatchObject({ type: 'carousel', slides: ['a', 'b', 'c'] });
  });

  it('maps a post with only image_url (no image_urls) to an image post', () => {
    const spec = buildFeedSpecFromContentSystem(csWithImage);
    expect(spec.posts[1]).toMatchObject({ type: 'image', imageUrl: 'https://cdn.example.com/img.jpg' });
  });
});
