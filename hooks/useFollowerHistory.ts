import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';

// Daily snapshots of Ivan's own LinkedIn follower/connection count.
// Populated by the sync-linkedin-followers edge function (Unipile) on a daily cron.
export interface FollowerPoint {
  date: string; // ISO date (YYYY-MM-DD)
  followers: number;
  connections: number | null;
}

export function useFollowerHistory() {
  const [history, setHistory] = useState<FollowerPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supabase
        .from('linkedin_follower_history')
        .select('*')
        .order('date', { ascending: true })
        .limit(365);
      if (res.error) throw res.error;
      setHistory((res.data || []).map((r: any) => ({
        date: r.date,
        followers: Number(r.follower_count) || 0,
        connections: r.connections_count == null ? null : Number(r.connections_count),
      })));
    } catch (err) {
      toastError('load follower history', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const current = history[history.length - 1];
    const prev = history[history.length - 2];
    const weekAgo = history.length >= 8 ? history[history.length - 8] : undefined;
    return {
      followers: current?.followers ?? null,
      connections: current?.connections ?? null,
      dayDelta: current && prev ? current.followers - prev.followers : null,
      weekDelta: current && weekAgo ? current.followers - weekAgo.followers : null,
    };
  }, [history]);

  return { history, stats, loading, refresh: fetchData };
}
