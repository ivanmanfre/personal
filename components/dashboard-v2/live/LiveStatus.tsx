import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useLive } from './LiveProvider';

/**
 * Fixed bottom-right "engine live" pill. Heartbeat dot + a real, live-updating
 * status line (next-post countdown, real counts, last-published age) + a sound
 * toggle. Everything shown is true at render time — no simulated activity.
 */
export const LiveStatus: React.FC = () => {
  const { text, soundOn, toggleSound, ready } = useLive();
  if (!ready) return null;

  return (
    <div className="dv-live" aria-label="Live engine status">
      <span className="dv-live-beat" aria-hidden="true" />
      <span className="dv-live-task">
        <span className="dv-live-text">{text}</span>
      </span>
      <button
        type="button"
        className="dv-live-sound"
        onClick={toggleSound}
        aria-pressed={soundOn}
        title={soundOn ? 'Mute activity sounds' : 'Play a sound when a post publishes or a reply lands'}
        aria-label={soundOn ? 'Mute activity sounds' : 'Enable activity sounds'}
      >
        {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};
