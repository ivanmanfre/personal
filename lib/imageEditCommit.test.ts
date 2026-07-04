// lib/imageEditCommit.test.ts
import { describe, it, expect } from 'vitest';
import { replaceAt } from './studioActions';

describe('replaceAt', () => {
  it('swaps the url at the given index, leaving others intact', () => {
    expect(replaceAt(['a', 'b', 'c'], 1, 'B')).toEqual(['a', 'B', 'c']);
  });
  it('handles a single-image array', () => {
    expect(replaceAt(['only'], 0, 'new')).toEqual(['new']);
  });
  it('is a no-op clone when index is out of range', () => {
    const src = ['a', 'b'];
    const out = replaceAt(src, 5, 'x');
    expect(out).toEqual(['a', 'b']);
    expect(out).not.toBe(src);
  });
});
