import React from 'react';
import { Play } from 'lucide-react';

interface VideoSlotProps {
  src?: string;
  poster?: string;
  caption?: string;
  ratio?: string;
  /** Link to the walkthrough script doc, shown while the video isn't filmed yet. */
  scriptHref?: string;
}

export function VideoSlot({ src, poster, caption, ratio = '16 / 9', scriptHref }: VideoSlotProps) {
  return (
    <figure className="my-4">
      <div
        className="relative w-full overflow-hidden rounded-2xl border shadow-[0_24px_70px_-20px_rgba(0,0,0,0.3)]"
        style={{ aspectRatio: ratio, borderColor: 'var(--color-hairline-bold)', backgroundColor: 'var(--color-paper-sunk)' }}
      >
        {src ? (
          <video src={src} poster={poster} controls preload="metadata" className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center" role="img" aria-label="Video walkthrough — coming soon">
            <span className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-accent-soft)', color: 'var(--color-accent-ink)' }}>
              <Play aria-hidden="true" size={22} />
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">Walkthrough — coming</span>
            {scriptHref && (
              <a
                href={scriptHref}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs uppercase tracking-[0.1em] underline underline-offset-4 transition-opacity hover:opacity-70"
                style={{ color: 'var(--color-accent-ink)' }}
              >
                View script ↗
              </a>
            )}
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="mt-3 text-center font-mono text-xs uppercase tracking-[0.1em] text-ink-mute">{caption}</figcaption>
      )}
    </figure>
  );
}
