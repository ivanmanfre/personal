// lib/imagePresets.test.ts
import { describe, it, expect } from 'vitest';
import { chipsForClass, parseCommand } from './imagePresets';

describe('chipsForClass', () => {
  it('gives laptop-specific chips including an erase and a replace', () => {
    const chips = chipsForClass('laptop');
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(chips.some(c => c.op === 'erase')).toBe(true);
    expect(chips.some(c => c.op === 'replace')).toBe(true);
    expect(chips.map(c => c.label.toLowerCase()).join(' ')).toContain('remove');
  });
  it('falls back to a generic set for unknown class and still has an erase', () => {
    const chips = chipsForClass(undefined);
    expect(chips.length).toBeGreaterThanOrEqual(3);
    expect(chips.some(c => c.op === 'erase')).toBe(true);
  });
});

describe('parseCommand', () => {
  it('returns null for empty / whitespace', () => {
    expect(parseCommand('')).toBeNull();
    expect(parseCommand('   ')).toBeNull();
  });
  it('wraps free text as a whole-image refine intent', () => {
    const i = parseCommand('  make it warmer ');
    expect(i).toEqual({ op: 'refine', prompt: 'make it warmer', wholeImage: true });
  });
});
