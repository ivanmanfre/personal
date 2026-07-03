import { describe, it, expect } from 'vitest';
import { resolveDraft } from './promptDraftResolver';

const row = (over = {}) => ({ id: '1', body: 'B1', title: 'T1', updatedAt: '2026-07-02T10:00:00Z', updatedBy: 'dashboard', ...over });

describe('resolveDraft', () => {
  it('seeds draft from row when not dirty', () => {
    const s = resolveDraft({ body: '', title: '', externalUpdate: null }, row(), false);
    expect(s).toEqual({ body: 'B1', title: 'T1', externalUpdate: null });
  });
  it('clears everything when no row selected', () => {
    const s = resolveDraft({ body: 'x', title: 'y', externalUpdate: null }, null, true);
    expect(s).toEqual({ body: '', title: '', externalUpdate: null });
  });
  it('NEVER overwrites a dirty draft on external update — flags it instead', () => {
    const s = resolveDraft(
      { body: 'my edit', title: 'T1', externalUpdate: null },
      row({ body: 'REVERTED', updatedAt: '2026-07-02T11:00:00Z', updatedBy: 'external' }),
      true,
    );
    expect(s.body).toBe('my edit');
    expect(s.externalUpdate).toEqual({ updatedAt: '2026-07-02T11:00:00Z', updatedBy: 'external' });
  });
  it('re-seeds silently when clean and row changes', () => {
    const s = resolveDraft({ body: 'B1', title: 'T1', externalUpdate: null }, row({ body: 'B2' }), false);
    expect(s.body).toBe('B2');
    expect(s.externalUpdate).toBeNull();
  });
});
