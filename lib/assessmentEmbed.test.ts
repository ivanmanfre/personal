import { describe, it, expect } from 'vitest';
import { buildAssessmentEmbedUrl } from './assessmentEmbed';

describe('buildAssessmentEmbedUrl', () => {
  const lm = { slug: 'agency-efficiency-score', seed_answers: { intake_format: 4, __persona: 0 } };

  it('returns null without a slug', () => {
    expect(buildAssessmentEmbedUrl({ seed_answers: { a: 1 } })).toBeNull();
  });

  it('builds an interactive (non-seeded) embed url', () => {
    const url = buildAssessmentEmbedUrl(lm, { prospectId: 'p123' })!;
    expect(url).toContain('https://resources.ivanmanfredi.com/agency-efficiency-score/');
    const q = new URL(url).searchParams;
    // Deliberately NOT results-forward: the prospect takes it fresh, like their own leads.
    expect(q.get('mode')).toBeNull();
    expect(q.get('seed')).toBeNull();
    expect(q.get('src')).toBe('scan_embed');
    expect(q.get('pid')).toBe('p123');
  });

  it('threads brand identity + CTA params when provided', () => {
    const url = buildAssessmentEmbedUrl(lm, {
      bname: 'Step Digital',
      blogo: 'https://stepdigital.co/logo.png',
      cta: 'Free Strategy Call',
      ctaurl: 'https://stepdigital.co/',
    })!;
    const q = new URL(url).searchParams;
    expect(q.get('bname')).toBe('Step Digital');
    expect(q.get('blogo')).toBe('https://stepdigital.co/logo.png');
    expect(q.get('cta')).toBe('Free Strategy Call');
    expect(q.get('ctaurl')).toBe('https://stepdigital.co/');
  });

  it('drops a non-absolute ctaurl', () => {
    const url = buildAssessmentEmbedUrl(lm, { ctaurl: 'stepdigital.co/contact' })!;
    expect(new URL(url).searchParams.get('ctaurl')).toBeNull();
  });
});
