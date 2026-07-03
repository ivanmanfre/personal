import { describe, it, expect } from 'vitest';
import { lineDiff, diffStats } from './lineDiff';

describe('lineDiff', () => {
  it('marks unchanged lines as ctx', () => {
    expect(lineDiff('a\nb', 'a\nb')).toEqual([
      { type: 'ctx', text: 'a' },
      { type: 'ctx', text: 'b' },
    ]);
  });

  it('detects a pure addition', () => {
    expect(lineDiff('a\nc', 'a\nb\nc')).toEqual([
      { type: 'ctx', text: 'a' },
      { type: 'add', text: 'b' },
      { type: 'ctx', text: 'c' },
    ]);
  });

  it('detects a pure deletion', () => {
    expect(lineDiff('a\nb\nc', 'a\nc')).toEqual([
      { type: 'ctx', text: 'a' },
      { type: 'del', text: 'b' },
      { type: 'ctx', text: 'c' },
    ]);
  });

  it('detects a replacement as del then add', () => {
    expect(lineDiff('hello', 'world')).toEqual([
      { type: 'del', text: 'hello' },
      { type: 'add', text: 'world' },
    ]);
  });

  it('handles empty old (all adds) and empty new (all dels)', () => {
    expect(lineDiff('', 'x')).toEqual([{ type: 'add', text: 'x' }]);
    expect(lineDiff('x', '')).toEqual([{ type: 'del', text: 'x' }]);
  });

  it('treats two empty strings as a single empty ctx line', () => {
    expect(lineDiff('', '')).toEqual([{ type: 'ctx', text: '' }]);
  });
});

describe('diffStats', () => {
  it('counts added and removed lines', () => {
    const d = lineDiff('a\nb\nc', 'a\nx\nc\nd');
    expect(diffStats(d)).toEqual({ added: 2, removed: 1 });
  });
});
