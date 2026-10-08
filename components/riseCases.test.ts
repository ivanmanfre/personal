import { describe, expect, it } from 'vitest';
import { caseUrl, caseVertical, casesFor } from './riseCases';

describe('riseCases', () => {
  it('reads a lash store as beauty and links each case to its risedtc.com page', () => {
    const cs = casesFor(['false eyelashes', 'strip lashes', 'princess-cut-full-glam-strip-lashes']);
    expect(cs.map((c) => c.name)).toEqual(['Josie Maran', 'InStyler', 'Black and Bloom']);
    expect(caseUrl(cs[0])).toBe('https://risedtc.com/projects/josie-maran/?utm_source=scan&utm_medium=case&utm_campaign=growth-scan&utm_content=josie-maran');
  });

  it('picks by the store category and falls back to apparel', () => {
    expect(caseVertical(['gold hoop earrings'])).toBe('accessories');
    expect(caseVertical(['linen shirts', 'summer dress'])).toBe('apparel');
    expect(caseVertical(['cast iron cookware'])).toBe('home');
    expect(caseVertical(['skinny jeans'])).toBe('apparel');
    expect(caseVertical([])).toBe('apparel');
  });

  it('every vertical shows three distinct cases with an image and at least one stat', () => {
    for (const w of [['lash'], ['earring'], ['grill'], ['shirt']]) {
      const cs = casesFor(w);
      expect(new Set(cs.map((c) => c.slug)).size).toBe(3);
      for (const c of cs) {
        expect(c.image).toMatch(/^https:\/\/risedtc\.com\/wp-content\//);
        expect(c.stats.length).toBeGreaterThan(0);
      }
    }
  });
});
