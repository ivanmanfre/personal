import React from 'react';
import { MicOff, Square, Loader2 } from 'lucide-react';
import { useListenerState } from '../../hooks/useListenerState';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const LiveRecordingBanner: React.FC = () => {
  const { state, sendCommand } = useListenerState();

  if (state.status === 'idle') return null;

  const isRecording = state.status === 'recording';
  const isTransient =
    state.status === 'preparing' || state.status === 'stopping' || state.status === 'processing';

  const levelPct = Math.max(0, Math.min(1, state.currentLevelRms * 6)) * 100;

  return (
    <div className="rounded-xl border border-red-900/40 bg-gradient-to-r from-red-950/40 to-zinc-900/60 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {isRecording && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        )}
        {isTransient && <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-zinc-100">
            {isRecording && (
              <span className="font-mono tabular-nums font-medium">
                {formatElapsed(state.elapsedSeconds)}
              </span>
            )}
            {state.meetingTitle && (
              <>
                {isRecording && <span className="text-zinc-600">·</span>}
                <span className="truncate">{state.meetingTitle}</span>
              </>
            )}
            {state.status === 'preparing' && <span className="text-amber-400">Preparing…</span>}
            {state.status === 'stopping' && <span className="text-amber-400">Stopping…</span>}
            {state.status === 'processing' && (
              <span className="text-amber-400">Transcribing…</span>
            )}
            {state.isMicMuted && isRecording && (
              <span className="flex items-center gap-1 text-xs text-orange-400">
                <MicOff className="w-3 h-3" /> Mic muted
              </span>
            )}
          </div>
          {isRecording && (
            <div className="mt-1.5 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-orange-500 transition-[width] duration-100"
                style={{ width: `${levelPct}%` }}
              />
            </div>
          )}
        </div>

        {isRecording && (
          <button
            onClick={() => sendCommand('stop')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600/90 hover:bg-red-600 text-white text-xs font-medium transition-colors"
          >
            <Square className="w-3 h-3" fill="currentColor" /> Stop
          </button>
        )}
      </div>
    </div>
  );
};

export default LiveRecordingBanner;
