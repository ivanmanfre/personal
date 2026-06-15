import { describe, it, expect } from 'vitest';
import { PROMISES, METRICS, LM_FORMATS, LM_PROMISES, ONE_IDEA_FORMATS, SCOPE } from './contentSystemContent';

describe('content-system page content', () => {
  it('has four reframe pillars, each with headline + benefit', () => {
    expect(PROMISES).toHaveLength(4);
    for (const p of PROMISES) {
      expect(p.headline.length).toBeGreaterThan(0);
      expect(p.benefit.length).toBeGreaterThan(0);
    }
  });
  it('has four buyer-facing metrics', () => {
    expect(METRICS).toHaveLength(4);
    for (const m of METRICS) { expect(m.value.length).toBeGreaterThan(0); expect(m.label.length).toBeGreaterThan(0); }
  });
  it('lists six live lead-magnet formats, each with a real sample screenshot', () => {
    expect(LM_FORMATS).toHaveLength(6);
    for (const f of LM_FORMATS) {
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.blurb.length).toBeGreaterThan(0);
      expect(f.shot).toMatch(/^\/content-system\/lm\/.+\.webp$/);
      expect(f.alt.length).toBeGreaterThan(0);
    }
  });
  it('has three lead-magnet promises with a how line', () => {
    expect(LM_PROMISES).toHaveLength(3);
    for (const p of LM_PROMISES) expect(p.how.length).toBeGreaterThan(0);
  });
  it('lists the formats one idea fans into', () => {
    expect(ONE_IDEA_FORMATS.length).toBeGreaterThanOrEqual(4);
  });
  it('has both in-scope and not-in-scope items', () => {
    expect(SCOPE.inScope.length).toBeGreaterThan(0);
    expect(SCOPE.notInScope.length).toBeGreaterThan(0);
  });
});
