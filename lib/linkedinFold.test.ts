import { describe, it, expect } from 'vitest';
import { linkedInFold, LI_FOLD } from './linkedinFold';

/** The fold is a LINE budget, so these cases are about where lines start, not char counts. */
describe('linkedInFold', () => {
  it('leaves short copy alone', () => {
    const r = linkedInFold('One line that never reaches the fold.');
    expect(r.folded).toBe(false);
    expect(r.hidden).toBe('');
    expect(r.visible).toBe('One line that never reaches the fold.');
  });

  it('gives unbroken prose close to three full lines', () => {
    const body = 'word '.repeat(120).trim();
    const r = linkedInFold(body);
    expect(r.folded).toBe(true);
    // 3 lines x 80 chars, minus the word-boundary give-back.
    expect(r.visible.length).toBeGreaterThan(200);
    expect(r.visible.length).toBeLessThanOrEqual(3 * LI_FOLD.desktop.charsPerLine);
  });

  it('charges a blank line a full line slot', () => {
    // Braden's shape: hook line, blank line, teaser line — the fold lands after line 3.
    const body = 'I just funnel hacked 100 of a well-known creator\'s most viral videos...\n\n'
      + 'And turned EVERYTHING into a copy/paste formula\n\n'
      + 'Here is the part nobody talks about, which continues well past the fold and should be hidden.';
    const r = linkedInFold(body);
    expect(r.folded).toBe(true);
    // Line 1 = hook, line 2 = blank, line 3 = the teaser. Nothing after it survives.
    expect(r.visible).toBe(
      'I just funnel hacked 100 of a well-known creator\'s most viral videos...\n\n'
      + 'And turned EVERYTHING into a copy/paste formula'
    );
    expect(r.hidden.startsWith('Here is the part')).toBe(true);
  });

  it('folds an early-breaking post far sooner than a flat 210-char cap would', () => {
    // Measured shape: short shout line, blank, then body. LinkedIn showed 64 chars here.
    const body = '🚀 1.7K FOLLOWERS!\n\n' + 'Just clocked 1.7K followers on this platform and '.repeat(12);
    const r = linkedInFold(body);
    expect(r.folded).toBe(true);
    expect(r.visible.length).toBeLessThan(150);
    expect(r.visible.length).toBeLessThan(210); // the constant this replaced
  });

  it('folds tighter on mobile than on desktop', () => {
    const body = 'word '.repeat(120).trim();
    const d = linkedInFold(body, 'desktop').visible.length;
    const m = linkedInFold(body, 'mobile').visible.length;
    expect(m).toBeLessThan(d);
  });

  it('never cuts mid-word', () => {
    const body = 'word '.repeat(200).trim();
    const r = linkedInFold(body);
    expect(r.visible.endsWith('word')).toBe(true);
  });

  it('handles a single token longer than a line', () => {
    const r = linkedInFold('x'.repeat(500));
    expect(r.folded).toBe(true);
    expect(r.visible.length).toBe(3 * LI_FOLD.desktop.charsPerLine);
  });

  it('round-trips: visible + hidden preserves the copy', () => {
    const body = 'Alpha line here\n\nBeta line here\n\nGamma line that runs on for a while and keeps going past the fold entirely.';
    const r = linkedInFold(body);
    const rejoined = (r.visible + '\n\n' + r.hidden).replace(/\s+/g, ' ').trim();
    expect(rejoined).toBe(body.replace(/\s+/g, ' ').trim());
  });

  it('treats empty input as unfolded', () => {
    expect(linkedInFold('').folded).toBe(false);
    expect(linkedInFold('   ').folded).toBe(false);
  });
});
