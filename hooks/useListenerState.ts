import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type ListenerStatus =
  | 'idle' | 'preparing' | 'recording' | 'stopping' | 'processing';

export interface ListenerState {
  status: ListenerStatus;
  meetingTitle: string | null;
  startedAt: string | null;
  elapsedSeconds: number;
  isMicMuted: boolean;
  currentLevelRms: number;
  updatedAt: string;
}

const INITIAL: ListenerState = {
  status: 'idle',
  meetingTitle: null,
  startedAt: null,
  elapsedSeconds: 0,
  isMicMuted: false,
  currentLevelRms: 0,
  updatedAt: new Date().toISOString(),
};

function rowToState(row: any): ListenerState {
  return {
    status: row.status,
    meetingTitle: row.meeting_title,
    startedAt: row.started_at,
    elapsedSeconds: row.elapsed_seconds ?? 0,
    isMicMuted: !!row.is_mic_muted,
    currentLevelRms: row.current_level_rms ?? 0,
    updatedAt: row.updated_at,
  };
}

export function useListenerState() {
  const [state, setState] = useState<ListenerState>(INITIAL);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function fetchOnce() {
      try {
        const { data, error } = await supabase
          .from('listener_state')
          .select('*')
          .eq('id', 1)
          .single();
        if (!mounted) return;
        if (error) {
          setConnected(false);
          return;
        }
        if (data) {
          setState(rowToState(data));
          setConnected(true);
        }
      } catch {
        if (mounted) setConnected(false);
      }
    }

    // Initial fetch + 1s poll (supabase-js realtime requires channel setup;
    // polling every 1s is simpler and matches the daemon's own polling cadence).
    fetchOnce();
    timer = setInterval(fetchOnce, 1000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  async function sendCommand(cmd: 'start' | 'stop' | 'mute' | 'unmute') {
    await supabase
      .from('listener_state')
      .update({ pending_command: cmd })
      .eq('id', 1);
  }

  return { state, connected, sendCommand };
}
