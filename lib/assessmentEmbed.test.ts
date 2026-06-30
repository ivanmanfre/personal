import { describe, it, expect } from 'vitest';
import { buildAssessmentEmbedUrl } from './assessmentEmbed';

describe('buildAssessmentEmbedUrl', () => {
  const lm = { slug: 'agency-efficiency-score', seed_answers: { intake_format: 4, __persona: 0 } };

  it('returns null without a slug', () => {
    expect(buildAssessmentEmbedUrl({ seed_answers: { a: 1 } })).toBeNull();
  });

  it('returns null without seed answers', () => {
    expect(buildAssessmentEmbedUrl({ slug: 'x' })).toBeNull();
    expect(buildAssessmentEmbedUrl({ slug: 'x', seed_answers: {} })).toBeNull();
  });

  it('builds a results-forward url with a decodable seed', () => {
    const url = buildAssessmentEmbedUrl(lm, { prospectId: 'p123' })!;
    expect(url).toContain('https://resources.ivanmanfredi.com/agency-efficiency-score/');
    const q = new URL(url).searchParams;
    expect(q.get('mode')).toBe('result');
    expect(q.get('src')).toBe('scan_embed');
    expect(q.get('pid')).toBe('p123');
    expect(JSON.parse(atob(q.get('seed')!))).toEqual(lm.seed_answers);
  });
});
