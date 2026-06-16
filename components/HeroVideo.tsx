import React, { useRef, useState } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { prefersReduced } from './editorial';

/**
 * Hero product video for /content-system — an autoplaying, muted, looping kinetic
 * ad (rendered via the Hyperframes engine). Browsers require muted for autoplay,
 * so an unmute control surfaces the soundtrack. Honours prefers-reduced-motion:
 * shows the poster with a play button instead of autoplaying.
 */
export function HeroVideo({
  src = '/content-system/content-system-ad.mp4',
  poster = '/content-system/content-system-ad-poster.webp',
}: { src?: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [started, setStarted] = useState(!prefersReduced);
  const [playing, setPlaying] = useState(!prefersReduced);

  const toggleMute = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (v.paused) v.play().catch(() => {});
  };

  const togglePlay = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const start = () => {
    const v = ref.current;
    if (!v) return;
    setStarted(true);
    v.play().catch(() => {});
  };

  return (
    <figure className="m-0">
      <div
        className="relative overflow-hidden rounded-2xl border shadow-[0_30px_90px_-30px_rgba(0,0,0,0.45)]"
        style={{ borderColor: 'var(--color-hairline-bold)', backgroundColor: '#0A0D0B' }}
      >
        <video
          ref={ref}
          className="block w-full"
          src={src}
          poster={poster}
          autoPlay={!prefersReduced}
          muted
          playsInline
          preload="metadata"
          aria-label="Content System product demo"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />

        {/* Reduced-motion / not-started: poster play button */}
        {!started && (
          <button
            type="button" onClick={start} aria-label="Play demo"
            className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity hover:bg-black/20"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
              <Play size={26} className="ml-1" aria-hidden="true" />
            </span>
          </button>
        )}

        {/* Play / pause control */}
        {started && (
          <button
            type="button" onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium backdrop-blur transition-colors"
            style={{ backgroundColor: 'rgba(10,13,11,0.6)', color: '#F3F0E9', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            {playing ? 'Pause' : 'Play'}
          </button>
        )}

        {/* Unmute / mute control */}
        {started && (
          <button
            type="button" onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium backdrop-blur transition-colors"
            style={{ backgroundColor: 'rgba(10,13,11,0.6)', color: '#F3F0E9', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            {muted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
            {muted ? 'Sound' : 'Mute'}
          </button>
        )}
      </div>
    </figure>
  );
}

export default HeroVideo;
