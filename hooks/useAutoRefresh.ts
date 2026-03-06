import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RefreshRate } from '../types/dashboard';

export function useAutoRefresh(
  fetchFn: () => Promise<void>,
  options?: { realtimeTables?: string[]; defaultRate?: RefreshRate }
) {
  const [rate, setRate] = useState<RefreshRate>(options?.defaultRate || 60000);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  const refresh = useCallback(async () => {
    await fetchRef.current();
    setLastRefreshed(new Date());
  }, []);

  // Polling
  useEffect(() => {
    const id = setInterval(refresh, rate);
    return () => clearInterval(id);
  }, [rate, refresh]);

  // Realtime subscriptions
  useEffect(() => {
    const tables = options?.realtimeTables;
    if (!tables?.length) return;
    const channels = tables.map((table) =>
      supabase
        .channel(`dash-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => refresh())
        .subscribe()
    );
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [options?.realtimeTables, refresh]);

  return { rate, setRate, lastRefreshed, refresh };
}
