import { describe, it, expect } from 'vitest';
import { TOUR_STEPS } from './tourSteps';
import { DEMO_SAFE, getTourSteps } from './demoSafe';

const DEMO_PATH = new Set(['briefing', 'content']);

describe('tour steps', () => {
  it('has 6 task-based stops in operator order', () => {
    expect(TOUR_STEPS).toHaveLength(6);
    expect(TOUR_STEPS.map(s => s.id)).toEqual([
      'pipeline', 'create', 'edit', 'schedule', 'leadmagnet', 'performance',
    ]);
  });

  it('starts on the Posts pipeline, never the Morning Dispatch', () => {
    expect(TOUR_STEPS[0].section).toBe('content');
    expect(TOUR_STEPS[0].sub).toBe('posts');
    expect(TOUR_STEPS.some(s => s.section === 'briefing')).toBe(false);
  });

  it('every step targets a demo-path section', () => {
    for (const s of TOUR_STEPS) expect(DEMO_PATH.has(s.section)).toBe(true);
  });

  it('every step has narrator copy; non-sheet steps anchor a data-tour target', () => {
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.body.length).toBeGreaterThan(0);
      if (!s.opensSheet) expect(s.target?.startsWith('[data-tour=')).toBe(true);
    }
  });
});

describe('demo-safe filter', () => {
  it('never includes a non-demo-safe sub', () => {
    const unsafe = ['agent', 'newsletter', 'clips', 'video-pipeline'];
    for (const u of unsafe) expect(DEMO_SAFE.has(u)).toBe(false);
  });

  it('getTourSteps returns only steps whose sub is demo-safe', () => {
    const steps = getTourSteps();
    for (const s of steps) {
      if (s.sub) expect(DEMO_SAFE.has(s.sub)).toBe(true);
    }
    expect(steps.length).toBeGreaterThan(0);
  });
});
