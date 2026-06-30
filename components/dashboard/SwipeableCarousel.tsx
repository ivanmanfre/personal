import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Copy, Download, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * LinkedIn-style swipeable carousel preview for the editor.
 *
 * Replaces the 2-col thumbnail grid in CarouselEditor.renderMedia. Shows ONE
 * slide at a time at the native 4:5 aspect ratio (1080×1350) with arrows +
 * dot indicators + a "X / N" counter. Touch-swipe support for iPad reviews.
 *
 * Also offers slide-export affordances directly inline (no separate panel):
 *   - Copy URLs : newline-joined list, paste-ready for Canva "Upload from URL"
 *   - Open all  : opens each slide in a new tab so the OS can download/edit
 *
 * Keyboard nav: ← → arrows when focused.
 */

interface Props {
  urls: string[];
  /** Optional Drive thumbnail conversion — passes URLs through verbatim if not given. */
  toImgSrc?: (u: string) => string;
}

const SwipeableCarousel: React.FC<Props> = ({ urls, toImgSrc }) => {
  const [idx, setIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const total = urls.length;

  // Clamp idx if urls shrink (e.g. status flip discards stale slides).
  useEffect(() => {
    if (idx >= total) setIdx(Math.max(0, total - 1));
  }, [total, idx]);

  const go = (delta: number) => setIdx((i) => Math.max(0, Math.min(total - 1, i + delta)));

  // Keyboard nav — only when our container is focused. Prevents stealing
  // typing keystrokes from the LinkedIn caption textarea below.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement !== el) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [total]);

  const onTouchStart = (e: React.TouchEvent) => { touchStartXRef.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartXRef.current;
    if (start == null) return;
    const delta = e.changedTouches[0].clientX - start;
    if (Math.abs(delta) > 40) go(delta > 0 ? -1 : 1);
    touchStartXRef.current = null;
  };

  const copyAllUrls = async () => {
    try {
      await navigator.clipboard.writeText(urls.join('\n'));
      setCopied(true);
      toast.success(`Copied ${urls.length} slide URL${urls.length === 1 ? '' : 's'}`);
      setTimeout(() => setCopied(false), 1500);
    } catch (e: any) {
      toast.error(`Copy failed: ${e?.message || 'clipboard blocked'}`);
    }
  };

  const openAll = () => {
    if (!confirm(`Open ${urls.length} slides in new tabs?`)) return;
    urls.forEach((u, i) => setTimeout(() => window.open(u, '_blank', 'noopener,noreferrer'), i * 80));
  };

  if (total === 0) return null;

  const currentUrl = urls[idx];
  const renderedSrc = toImgSrc ? toImgSrc(currentUrl) : currentUrl;

  return (
    <div className="space-y-2">
      {/* Toolbar — counter + export affordances */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-500 tabular-nums">
          Slide <span className="text-zinc-300 font-medium">{idx + 1}</span> / {total}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={copyAllUrls}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-zinc-400 bg-zinc-900/60 ring-1 ring-zinc-800/80 hover:bg-zinc-800 hover:text-zinc-200 transition"
            title="Copy all slide URLs (one per line) — paste into Canva Upload-from-URL"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            URLs
          </button>
          <button
            onClick={openAll}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-zinc-400 bg-zinc-900/60 ring-1 ring-zinc-800/80 hover:bg-zinc-800 hover:text-zinc-200 transition"
            title="Open every slide in a new tab"
          >
            <Download className="w-3 h-3" /> Open all
          </button>
          <a
            href={currentUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-emerald-400/90 bg-zinc-900/60 ring-1 ring-zinc-800/80 hover:bg-zinc-800 hover:text-emerald-300 transition"
            title="Open this slide"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Stage — 4:5 frame matching LinkedIn carousel ratio (1080×1350) */}
      <div
        ref={containerRef}
        tabIndex={0}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative rounded-lg overflow-hidden bg-zinc-950 ring-1 ring-zinc-800/60 focus:outline-none focus:ring-emerald-600/40 group"
        style={{ aspectRatio: '4 / 5' }}
      >
        <img
          key={currentUrl}
          src={renderedSrc}
          alt={`Slide ${idx + 1} of ${total}`}
          className="absolute inset-0 w-full h-full object-contain bg-zinc-950"
          loading="eager"
        />

        {/* Arrow buttons — always visible (hover-only hid them on trackpad/iPad where
            there is no hover state). Darken slightly on hover for affordance. */}
        {idx > 0 && (
          <button
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-zinc-200 inline-flex items-center justify-center backdrop-blur transition"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
        {idx < total - 1 && (
          <button
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-zinc-200 inline-flex items-center justify-center backdrop-blur transition"
            aria-label="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dot strip */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-1">
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === idx ? 'w-5 bg-emerald-500/80' : 'w-1.5 bg-zinc-700 hover:bg-zinc-500'
              }`}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === idx}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SwipeableCarousel;
