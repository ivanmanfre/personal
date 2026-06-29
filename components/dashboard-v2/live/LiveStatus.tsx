import React from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useLive } from './LiveProvider';

/**
 * Fixed bottom-right "engine activity" pill. Heartbeat dot + the engine's
 * current task (or a calm idle state), plus a sound toggle. Reads as "this
 * system is running right now" — the core of the demo's live feel.
 */
export const LiveStatus: React.FC = () => {
  const { now, soundOn, toggleSound, ready } = useLive();
  if (!ready) return null;

  return (
    <div className="dv-live" aria-label="Live engine activity">
      <span className={`dv-live-beat ${now ? 'is-working' : ''}`} aria-hidden="true" />
      {now ? (
        <span className="dv-live-task">
          <Loader2 className="dv-live-spin w-3.5 h-3.5" aria-hidden="true" />
          <span className="dv-live-text">{now.working}</span>
        </span>
      ) : (
        <span className="dv-live-task">
          <span className="dv-live-text dv-live-idle">Live · engine running</span>
        </span>
      )}
      <button
        type="button"
        className="dv-live-sound"
        onClick={toggleSound}
        aria-pressed={soundOn}
        title={soundOn ? 'Mute activity sounds' : 'Play a sound on each event'}
        aria-label={soundOn ? 'Mute activity sounds' : 'Enable activity sounds'}
      >
        {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};
