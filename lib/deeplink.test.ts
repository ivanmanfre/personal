import { describe, it, expect } from 'vitest';
import { buildNavUrl } from './deeplink';

describe('buildNavUrl', () => {
  it('replaces section + sub on the current URL', () => {
    const out = buildNavUrl('https://x.dev/dashboard?section=briefing', '?section=ops&sub=skills');
    const p = new URL(out).searchParams;
    expect(p.get('section')).toBe('ops');
    expect(p.get('sub')).toBe('skills');
  });

  it('clears a stale sub when the new deeplink has none', () => {
    const out = buildNavUrl('https://x.dev/dashboard?section=ops&sub=skills', '?section=clients');
    const p = new URL(out).searchParams;
    expect(p.get('section')).toBe('clients');
    expect(p.get('sub')).toBeNull();
  });

  it('preserves unrelated params and the leading-? optional form', () => {
    const out = buildNavUrl('https://x.dev/d?section=a&keep=1', 'section=reach&otab=inbox');
    const p = new URL(out).searchParams;
    expect(p.get('keep')).toBe('1');
    expect(p.get('section')).toBe('reach');
    expect(p.get('otab')).toBe('inbox');
  });
});
