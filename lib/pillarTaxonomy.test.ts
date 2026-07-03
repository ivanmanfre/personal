import { describe, it, expect } from 'vitest';
import { normalizePillar, PILLAR_LABELS } from './pillarTaxonomy';

describe('normalizePillar', () => {
  it('maps a known key to its editorial label', () => {
    expect(normalizePillar('teardown')).toEqual({ key: 'teardown', label: 'Anti-slop', unmapped: false });
  });
  it('flags an unknown non-null key as unmapped, keeping the raw key as label', () => {
    expect(normalizePillar('field_notes')).toEqual({ key: 'field_notes', label: 'field_notes', unmapped: true });
  });
  it('treats null/empty as a non-unmapped empty (caller skips these)', () => {
    expect(normalizePillar(null)).toEqual({ key: '', label: '', unmapped: false });
    expect(normalizePillar('')).toEqual({ key: '', label: '', unmapped: false });
  });
  it('exposes the 5 canonical labels verbatim', () => {
    expect(PILLAR_LABELS).toMatchObject({
      translator: 'Agency Diagnostic', methodology: 'Build-in-public',
      teardown: 'Anti-slop', case_study: 'Case study', personal: 'Owner-POV',
    });
  });
});
