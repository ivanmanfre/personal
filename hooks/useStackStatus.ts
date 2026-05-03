import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';

export interface StackStatusRow {
  tool: string;
  displayName: string;
  category: 'runtime' | 'cli' | 'container' | 'service' | string;
  version: string | null;
  latestVersion: string | null;
  status: 'ok' | 'minor_lag' | 'major_lag' | 'error' | 'unknown';
  metadata: Record<string, any>;
  lastChecked: string;
  displayOrder: number;
}

function mapRow(row: any): StackStatusRow {
  return {
    tool: row.tool,
    displayName: row.display_name || row.tool,
    category: row.category,
    version: row.version,
    latestVersion: row.latest_version,
    status: row.status,
    metadata: row.metadata || {},
    lastChecked: row.last_checked,
    displayOrder: row.display_order ?? 100,
  };
}

export function useStackStatus() {
  const [rows, setRows] = useState<StackStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetch = useCallback(async () => {
    if (!hasFetched.current) setLoading(true);
    try {
      const { data } = await supabase
        .from('dashboard_stack_status')
        .select('*')
        .order('display_order', { ascending: true })
        .order('tool', { ascending: true });
      setRows((data || []).map(mapRow));
    } catch (err) {
      toastError('load stack status', err);
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime subscription — picks up new tools as the sync cron upserts them
  useEffect(() => {
    const channel = supabase
      .channel('dashboard_stack_status_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'dashboard_stack_status' },
        () => { fetch(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetch]);

  const grouped = useMemo(() => {
    const out: Record<string, StackStatusRow[]> = {};
    for (const r of rows) {
      (out[r.category] ||= []).push(r);
    }
    return out;
  }, [rows]);

  const summary = useMemo(() => {
    const ok = rows.filter((r) => r.status === 'ok').length;
    const lag = rows.filter((r) => r.status === 'minor_lag' || r.status === 'major_lag').length;
    const err = rows.filter((r) => r.status === 'error').length;
    return { total: rows.length, ok, lag, err };
  }, [rows]);

  const lastSync = useMemo(() => {
    if (!rows.length) return null;
    return rows.reduce((max, r) => r.lastChecked > max ? r.lastChecked : max, rows[0].lastChecked);
  }, [rows]);

  return { rows, grouped, summary, lastSync, loading, refresh: fetch };
}
