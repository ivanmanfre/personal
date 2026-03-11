import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useDashboard } from '../contexts/DashboardContext';

// Global editing state — when any component is editing, all auto-refreshes pause
let editingCount = 0;
const listeners = new Set<() => void>();
function isEditing() { return editingCount > 0; }

export function pauseRefresh() {
  editingCount++;
  listeners.forEach((fn) => fn());
}

export function resumeRefresh() {
  editingCount = Math.max(0, editingCount - 1);
  listeners.forEach((fn) => fn());
}

export function useAutoRefresh(
  fetchFn: () => Promise<void>,
  options?: { realtimeTables?: string[] }
) {
  const { refreshRate: rate, lastRefreshed, setLastRefreshed } = useDashboard();
  const [, forceUpdate] = useState(0);
  const fetchRef = useRef(fetchFn);
  fetchRef.current = fetchFn;

  // Subscribe to editing state changes
  useEffect(() => {
    const listener = () => forceUpdate((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const refresh = useCallback(async () => {
    if (isEditing()) return;
    await fetchRef.current();
    setLastRefreshed(new Date());
  }, [setLastRefreshed]);

  // Polling — skips when editing
  useEffect(() => {
    const id = setInterval(() => {
      if (!isEditing()) refresh();
    }, rate);
    return () => clearInterval(id);
  }, [rate, refresh]);

  // Stabilize realtimeTables ref via string key to prevent channel churn
  const tablesKey = (options?.realtimeTables || []).join(',');

  useEffect(() => {
    if (!tablesKey) return;
    const tables = tablesKey.split(',');
    const channels = tables.map((table) =>
      supabase
        .channel(`dash-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          if (!isEditing()) refresh();
        })
        .subscribe()
    );
    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [tablesKey, refresh]);

  return { lastRefreshed, refresh };
}
