import { describe, it, expect } from 'vitest';
import { composeAngleBrief } from './runItBack';
describe('composeAngleBrief', () => {
  it('packs pillar + hook + source title into a re-run brief', () => {
    const b = composeAngleBrief({ pillar: 'Anti-slop', hook: 'Contrarian claim', title: 'The 3-step lead enrichment pipeline' });
    expect(b).toContain('Anti-slop');
    expect(b).toContain('Contrarian claim');
    expect(b).toContain('The 3-step lead enrichment pipeline');
    expect(b.toLowerCase()).toContain('run it back');
  });
  it('degrades gracefully when pillar/hook are unknown', () => {
    const b = composeAngleBrief({ pillar: '', hook: '', title: 'Some post' });
    expect(b).toContain('Some post');
  });
});
