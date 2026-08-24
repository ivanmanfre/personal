/** Where LinkedIn actually cuts a post with "…see more".
 *
 *  Measured 2026-08-24 against the live logged-in desktop feed (n=10 captions) and the
 *  mobile-web feed at 390px (n=4). The finding that matters: LinkedIn clamps the caption
 *  to a fixed number of RENDERED LINES, not to a character count, and the clamp is the
 *  same 3 lines for text, single-image and carousel/document posts alike.
 *
 *    desktop  caption column 526px · 14px / 17.5px · -webkit-line-clamp: 3 · 73-83 chars per line
 *    mobile   caption column 364px · 14px / 20px   · -webkit-line-clamp: 3 · 49-60 chars per line
 *
 *  Because the budget is in lines, hard breaks are what really move the fold: across those
 *  ten desktop captions the visible copy ranged from 53 to 222 characters at an identical
 *  clamp. A post that opens with a short line and a blank line spends two thirds of its
 *  budget before the reader has read anything. That is why a flat character cap (the old
 *  FOLD_AT = 210) reads plausibly on unbroken prose and is badly wrong on everything else.
 *
 *  One video caption measured a clamp of 2 rather than 3. That is a single row, so it is
 *  recorded here and deliberately NOT encoded as a rule.
 */

export type FoldSurface = 'desktop' | 'mobile';

export const LI_FOLD: Record<FoldSurface, { lines: number; charsPerLine: number }> = {
  // charsPerLine is the centre of the measured range, not a guess: desktop 73-83, mobile 49-60.
  desktop: { lines: 3, charsPerLine: 80 },
  mobile: { lines: 3, charsPerLine: 55 },
};

export interface FoldResult {
  /** Copy above the fold — what the reader decides on. */
  visible: string;
  /** Copy behind "…see more". */
  hidden: string;
  folded: boolean;
  /** Rendered lines the full body would occupy at this surface's width. */
  totalLines: number;
}

/** Line spans of `text` once wrapped at `charsPerLine`, honouring hard breaks.
 *  An empty line (the blank line between paragraphs) costs a full line slot, exactly as
 *  it does in the feed. */
function lineSpans(text: string, charsPerLine: number): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const segments = text.split('\n');
  let pos = 0;
  for (const seg of segments) {
    const base = pos;
    if (seg.length === 0) {
      spans.push([base, base]);
    } else {
      let i = 0;
      while (i < seg.length) {
        let end = Math.min(seg.length, i + charsPerLine);
        if (end < seg.length) {
          // Break on a word boundary; a single token longer than the line just gets cut.
          const sp = seg.lastIndexOf(' ', end);
          if (sp > i) end = sp;
        }
        spans.push([base + i, base + end]);
        i = end;
        while (seg[i] === ' ') i += 1;
      }
    }
    pos = base + seg.length + 1; // +1 for the '\n' that followed it
  }
  return spans;
}

/** Split a post body at the LinkedIn fold. */
export function linkedInFold(raw: string, surface: FoldSurface = 'desktop'): FoldResult {
  const { lines: budget, charsPerLine } = LI_FOLD[surface];
  const text = (raw || '').replace(/\r\n/g, '\n');
  if (!text.trim()) return { visible: text, hidden: '', folded: false, totalLines: 0 };

  const spans = lineSpans(text, charsPerLine);
  if (spans.length <= budget) {
    return { visible: text, hidden: '', folded: false, totalLines: spans.length };
  }
  const cut = spans[budget - 1][1];
  return {
    visible: text.slice(0, cut).trimEnd(),
    hidden: text.slice(cut).trimStart(),
    folded: true,
    totalLines: spans.length,
  };
}

/** Characters the reader sees before "…see more" — the real hook budget for this body. */
export function foldBudget(raw: string, surface: FoldSurface = 'desktop'): number {
  return linkedInFold(raw, surface).visible.length;
}
