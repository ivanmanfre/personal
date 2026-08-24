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

  it('reports the character fallback under jsdom, where there is no canvas', () => {
    // If this ever flips to true in the test env, the pixel path is being exercised
    // untested — the guard in canvasMeasure() exists because jsdom returns width 0.
    expect(linkedInFold('anything at all').measured).toBe(false);
  });
});

/** The pixel path, driven by an injected measurer so it runs without a real canvas.
 *  Caps and emoji are deliberately wide, which is the whole reason this path exists. */
describe('linkedInFold — measured (pixel) path', () => {
  const WIDTH = LI_FOLD.desktop.widthPx;
  const measure: (s: string) => number = (s) =>
    Array.from(s).reduce((w, ch) => {
      if (/\p{Extended_Pictographic}/u.test(ch)) return w + 20;
      if (/[A-Z]/.test(ch)) return w + 12;
      if (ch === ' ') return w + 4;
      return w + 7;
    }, 0);

  it('flags itself as measured', () => {
    expect(linkedInFold('some copy', 'desktop', measure).measured).toBe(true);
  });

  it('folds a caps-heavy opener earlier than the same words in lower case', () => {
    const words = 'this opener shouts every single word across the line so it wraps sooner '.repeat(6);
    const loudVisible = linkedInFold(words.toUpperCase().trim(), 'desktop', measure).visible.length;
    const quietVisible = linkedInFold(words.trim(), 'desktop', measure).visible.length;
    // 12px a caps glyph against 7px a lower-case one, so roughly half the copy survives.
    expect(loudVisible).toBeLessThan(quietVisible);
  });

  it('charges emoji their real width', () => {
    const withEmoji = ('🚀 '.repeat(80) + 'tail copy that sits past the fold').trim();
    const plain = ('ab '.repeat(80) + 'tail copy that sits past the fold').trim();
    const r = linkedInFold(withEmoji, 'desktop', measure);
    expect(r.folded).toBe(true);
    // 24px an emoji+space against 18px for "ab ", so fewer tokens clear the fold.
    expect(r.visible.length).toBeLessThan(linkedInFold(plain, 'desktop', measure).visible.length);
  });

  it('hard-breaks a single token wider than the box', () => {
    const r = linkedInFold('x'.repeat(600), 'desktop', measure);
    expect(r.folded).toBe(true);
    // 7px per char into a 526px box = 75 chars a line, 3 lines.
    expect(r.visible.length).toBe(Math.floor(WIDTH / 7) * 3);
  });

  it('still charges a blank line a full slot', () => {
    const body = 'Short hook\n\nSecond beat\n\nEverything here is behind the fold and must not survive.';
    const r = linkedInFold(body, 'desktop', measure);
    expect(r.visible).toBe('Short hook\n\nSecond beat');
    expect(r.hidden.startsWith('Everything here')).toBe(true);
  });

  it('leaves a visible chunk that itself fits the budget', () => {
    // Soft wraps insert no newline, so the invariant is "re-folding it changes nothing",
    // not "every \n-delimited line fits".
    for (const body of ['word '.repeat(200).trim(), '🚀 '.repeat(90).trim(), 'ALL CAPS SHOUTING '.repeat(40).trim()]) {
      const r = linkedInFold(body, 'desktop', measure);
      expect(r.folded).toBe(true);
      const again = linkedInFold(r.visible, 'desktop', measure);
      expect(again.folded).toBe(false);
      expect(again.totalLines).toBeLessThanOrEqual(LI_FOLD.desktop.lines);
    }
  });

  it('folds tighter on mobile than desktop on the measured path too', () => {
    const body = 'word '.repeat(200).trim();
    const d = linkedInFold(body, 'desktop', measure).visible.length;
    const m = linkedInFold(body, 'mobile', measure).visible.length;
    expect(m).toBeLessThan(d);
  });
});
