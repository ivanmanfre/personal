import { describe, it, expect } from 'vitest';
import { PROMISES, METRICS, LM_FORMATS, LM_PROMISES, ONE_IDEA_FORMATS, SCOPE } from './contentSystemContent';

describe('content-system page content', () => {
  it('has exactly six outcome promises, each with headline/benefit/how', () => {
    expect(PROMISES).toHaveLength(6);
    for (const p of PROMISES) {
      expect(p.headline.length).toBeGreaterThan(0);
      expect(p.benefit.length).toBeGreaterThan(0);
      expect(p.how.length).toBeGreaterThan(0);
    }
  });
  it('has four buyer-facing metrics', () => {
    expect(METRICS).toHaveLength(4);
    for (const m of METRICS) { expect(m.value.length).toBeGreaterThan(0); expect(m.label.length).toBeGreaterThan(0); }
  });
  it('lists ten lead-magnet formats and marks not-yet-live ones', () => {
    expect(LM_FORMATS).toHaveLength(10);
    const coming = LM_FORMATS.filter(f => f.coming);
    expect(coming.map(f => f.name)).toEqual(['Live AI Walkthrough']);
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
