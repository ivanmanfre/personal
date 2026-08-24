import React, { useEffect, useRef, useState } from 'react';
import { linkedInFold, LI_CAPTION_FONT, type FoldSurface } from '../../lib/linkedinFold';

/** A post caption rendered at LinkedIn's OWN geometry, then shrunk to fit whatever space
 *  the surrounding card gives it.
 *
 *  Why not simply draw the folded text in the card's own box: the fold decides WHICH words
 *  survive, and that part is already independent of our card width. But drawing those words
 *  at 13.5px inside a 400px card re-wraps them into a different number of lines, breaking in
 *  different places than the feed does. Right words, wrong shape, and the shape is most of
 *  what a founder is judging when they look at a hook.
 *
 *  So the caption is laid out in a real 526px box (desktop) or a real device-width box
 *  (mobile) at 14px in the feed's font, then scaled with `zoom`. Line count, break points,
 *  and how much of the budget a short opener burns all survive the shrink.
 *
 *  `zoom` rather than `transform: scale` because zoom participates in layout, so the block
 *  reserves its own height and a wrapped "…see more" cannot get clipped. Firefox below 126
 *  ignores it and renders life-size inside an overflow-hidden box, which degrades to a crop
 *  rather than to wrong information.
 */
export const LinkedInCaption: React.FC<{
  body: string;
  surface?: FoldSurface;
  /** Mobile only. The desktop column is a fixed 526px at every window size. */
  deviceWidth?: number;
  expanded?: boolean;
  onExpand?: () => void;
  /** Lets the caller tokenize @mentions / links without this component knowing how. */
  renderText?: (text: string) => React.ReactNode;
  /** Never scale past life size — a wide card should not blow the caption up. */
  maxScale?: number;
}> = ({ body, surface = 'desktop', deviceWidth, expanded = false, onExpand, renderText, maxScale = 1 }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [avail, setAvail] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const read = () => setAvail(el.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fold = linkedInFold(body, surface, { deviceWidth });
  const { box } = fold;
  const shown = expanded ? body : fold.visible;
  const showFoldToggle = fold.folded && !expanded;
  // Until the host has been measured, render life-size; the observer corrects it on mount.
  const scale = avail > 0 ? Math.min(maxScale, avail / box.widthPx) : 1;

  return (
    <div ref={hostRef} style={{ width: '100%', overflow: 'hidden' }}>
      <div
        style={{
          width: box.widthPx,
          zoom: scale,
          font: LI_CAPTION_FONT,
          lineHeight: `${box.lineHeightPx}px`,
          color: '#1d2226',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'break-word',
        }}
      >
        {renderText ? renderText(shown) : shown}
        {showFoldToggle ? (
          <>
            {' '}
            <button
              type="button"
              // The card underneath opens the post, so the fold toggle must not bubble.
              onClick={(e) => { e.stopPropagation(); onExpand?.(); }}
              style={{
                font: LI_CAPTION_FONT,
                color: '#666',
                background: 'none',
                border: 0,
                padding: 0,
                cursor: 'pointer',
              }}
            >
              …see more
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default LinkedInCaption;
