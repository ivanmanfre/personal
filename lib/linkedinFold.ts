/** Where LinkedIn actually cuts a post with "…see more".
 *
 *  Measured 2026-08-24 against the live logged-in feed (n=26 captions across desktop 1280
 *  and mobile-web 390). What the platform does:
 *
 *    desktop  caption box 526px · 14px / 17.5px · -webkit-line-clamp: 3
 *    mobile   caption box 364px · 14px / 20px   · -webkit-line-clamp: 3
 *    font     system-ui, -apple-system, "Segoe UI", Roboto · letter-spacing: normal
 *
 *  Two findings that shape this file:
 *
 *  1. The budget is LINES, not characters. Hard breaks are what really move the fold —
 *     across those captions the visible copy ran from 46 to 222 characters at an identical
 *     clamp, because a blank line costs a full line slot. A flat character cap (the old
 *     FOLD_AT = 210) reads plausibly on unbroken prose and is badly wrong on everything
 *     that breaks early.
 *
 *  2. Lines are measured in PIXELS, so glyph widths matter. An all-caps or emoji-heavy
 *     opener eats its line faster than a character count predicts. When a canvas is
 *     available we wrap on real measured text; the character model stays as the fallback
 *     for server rendering and tests, where no canvas exists.
 *
 *  Three of the 26 captions measured a clamp of 2 rather than 3, spread across video and
 *  multi-image without tracking either. That reads as a platform experiment rather than a
 *  rule, so 3 stands. It also means roughly one post in eight folds a line earlier than
 *  this predicts, and that is worth knowing before trusting the last line of a hook.
 *
 *  Validated by injecting this compiled module into the live feed and comparing its cut
 *  against the cut the browser actually rendered, caption by caption: desktop max error 3
 *  characters over 8 posts (mean 1.2), mobile max 1 over 2, including emoji and caps-heavy
 *  openers. The standing -1 is this function trimming the trailing space. The character
 *  fallback is looser — it drifted +7 and -83 on the same corpus — so a surface that folds
 *  without a canvas should be treated as approximate.
 */

export type FoldSurface = 'desktop' | 'mobile';

export const LI_FOLD: Record<FoldSurface, { lines: number; widthPx: number; charsPerLine: number }> = {
  // charsPerLine is the fallback only, set to the centre of the measured ranges
  // (desktop 73-85, mobile 49-60). widthPx is what the pixel path actually uses.
  desktop: { lines: 3, widthPx: 526, charsPerLine: 80 },
  mobile: { lines: 3, widthPx: 364, charsPerLine: 55 },
};

/** The feed's caption font, verbatim from getComputedStyle on a live post. */
export const LI_CAPTION_FONT =
  '400 14px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export type Measure = (text: string) => number;

let cachedCtx: CanvasRenderingContext2D | null | undefined;

/** A text measurer backed by canvas, or null when there is no usable canvas (SSR, jsdom).
 *  Verified with a probe string rather than trusted, because jsdom hands back a context
 *  whose measureText always returns 0 — which would silently fold every post to one line. */
function canvasMeasure(): Measure | null {
  if (cachedCtx === undefined) {
    cachedCtx = null;
    try {
      if (typeof document !== 'undefined') {
        const c = document.createElement('canvas').getContext('2d');
        if (c) {
          c.font = LI_CAPTION_FONT;
          if (c.measureText('MMMMiiii').width > 0) cachedCtx = c;
        }
      }
    } catch {
      cachedCtx = null;
    }
  }
  if (!cachedCtx) return null;
  const ctx = cachedCtx;
  const cache = new Map<string, number>();
  return (s) => {
    let w = cache.get(s);
    if (w === undefined) {
      w = ctx.measureText(s).width;
      cache.set(s, w);
    }
    return w;
  };
}

/** Greedy word wrap on measured width. A single token wider than the box is broken by
 *  character, the way the browser breaks an unspaced string. */
function pixelLines(seg: string, base: number, widthPx: number, measure: Measure, out: Array<[number, number]>): void {
  let start = 0;
  while (start < seg.length) {
    let end = -1;
    let probe = start;
    while (probe < seg.length) {
      const nextSpace = seg.indexOf(' ', probe);
      const stop = nextSpace === -1 ? seg.length : nextSpace;
      if (measure(seg.slice(start, stop)) <= widthPx) {
        end = stop;
        probe = stop + 1;
      } else break;
      if (nextSpace === -1) break;
    }
    if (end === -1) {
      let lo = start + 1;
      let hi = seg.length;
      while (lo < hi) {
        const m = ((lo + hi + 1) / 2) | 0;
        if (measure(seg.slice(start, m)) <= widthPx) lo = m;
        else hi = m - 1;
      }
      end = lo;
    }
    out.push([base + start, base + end]);
    start = end;
    while (seg[start] === ' ') start += 1;
  }
}

/** Character-count wrap. Fallback path: no canvas, so every glyph counts the same. */
function charLines(seg: string, base: number, charsPerLine: number, out: Array<[number, number]>): void {
  let i = 0;
  while (i < seg.length) {
    let end = Math.min(seg.length, i + charsPerLine);
    if (end < seg.length) {
      const sp = seg.lastIndexOf(' ', end);
      if (sp > i) end = sp;
    }
    out.push([base + i, base + end]);
    i = end;
    while (seg[i] === ' ') i += 1;
  }
}

/** Line spans of `text` once wrapped, honouring hard breaks. An empty line (the blank line
 *  between paragraphs) costs a full line slot, exactly as it does in the feed. */
function lineSpans(text: string, surface: FoldSurface, measure: Measure | null): Array<[number, number]> {
  const { widthPx, charsPerLine } = LI_FOLD[surface];
  const spans: Array<[number, number]> = [];
  let pos = 0;
  for (const seg of text.split('\n')) {
    const base = pos;
    if (seg.length === 0) spans.push([base, base]);
    else if (measure) pixelLines(seg, base, widthPx, measure, spans);
    else charLines(seg, base, charsPerLine, spans);
    pos = base + seg.length + 1; // +1 for the '\n' that followed it
  }
  return spans;
}

export interface FoldResult {
  /** Copy above the fold — what the reader decides on. */
  visible: string;
  /** Copy behind "…see more". */
  hidden: string;
  folded: boolean;
  /** Rendered lines the full body would occupy at this surface's width. */
  totalLines: number;
  /** True when the cut came from measured glyph widths rather than the character fallback. */
  measured: boolean;
}

/** Split a post body at the LinkedIn fold.
 *  `measure` is injectable so a test can drive the pixel path without a real canvas. */
export function linkedInFold(raw: string, surface: FoldSurface = 'desktop', measure?: Measure): FoldResult {
  const { lines: budget } = LI_FOLD[surface];
  const text = (raw || '').replace(/\r\n/g, '\n');
  const m = measure ?? canvasMeasure();
  if (!text.trim()) return { visible: text, hidden: '', folded: false, totalLines: 0, measured: !!m };

  const spans = lineSpans(text, surface, m);
  if (spans.length <= budget) {
    return { visible: text, hidden: '', folded: false, totalLines: spans.length, measured: !!m };
  }
  const cut = spans[budget - 1][1];
  return {
    visible: text.slice(0, cut).trimEnd(),
    hidden: text.slice(cut).trimStart(),
    folded: true,
    totalLines: spans.length,
    measured: !!m,
  };
}

/** Characters the reader sees before "…see more" — the real hook budget for this body. */
export function foldBudget(raw: string, surface: FoldSurface = 'desktop'): number {
  return linkedInFold(raw, surface).visible.length;
}
