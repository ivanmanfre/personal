import { describe, it, expect } from 'vitest';
import { LIFECYCLE_STAGES } from './lifecycle';

describe('lifecycle stages', () => {
  it('lists the pipeline in order', () => {
    expect(LIFECYCLE_STAGES.map(s => s.key)).toEqual([
      'idea', 'generating', 'review', 'approved', 'scheduled', 'published',
    ]);
  });
  it('each stage has a label and a severity', () => {
    for (const s of LIFECYCLE_STAGES) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(['neutral', 'warn', 'good', 'accent']).toContain(s.severity);
    }
  });
});
