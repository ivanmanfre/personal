import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import type { SignalCluster } from '../types/dashboard';

function mapCluster(row: any): SignalCluster {
  return {
    id: row.id,
    runDate: row.run_date,
    bucket: row.bucket,
    theme: row.theme,
    summary: row.summary,
    frequency: row.frequency || 0,
    quotes: Array.isArray(row.quotes) ? row.quotes : [],
    sourceMix: row.source_mix || {},
    suggestedAction: row.suggested_action,
    createdAt: row.created_at,
  };
}

export function useSignalClusters() {
  const [clusters, setClusters] = useState<SignalCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRunDate, setSelectedRunDate] = useState<string | null>(null);
  const hasFetched = useRef(false);

  const fetchClusters = useCallback(async () => {
    if (!hasFetched.current) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('signal_clusters')
        .select('*')
        .order('run_date', { ascending: false })
        .order('frequency', { ascending: false });
      if (error) throw error;
      setClusters((data || []).map(mapCluster));
    } catch (err) {
      toastError('load signal clusters', err);
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  }, []);

  useEffect(() => { fetchClusters(); }, [fetchClusters]);

  const runDates = useMemo(
    () => Array.from(new Set(clusters.map((c) => c.runDate))),
    [clusters]
  );

  useEffect(() => {
    if (runDates.length > 0) setSelectedRunDate((prev) => prev ?? runDates[0]);
  }, [runDates]);

  const visible = useMemo(
    () => clusters.filter((c) => !selectedRunDate || c.runDate === selectedRunDate),
    [clusters, selectedRunDate]
  );

  const contentClusters = useMemo(() => visible.filter((c) => c.bucket === 'content'), [visible]);
  const salesClusters = useMemo(() => visible.filter((c) => c.bucket === 'sales'), [visible]);

  return {
    loading,
    refresh: fetchClusters,
    runDates,
    selectedRunDate,
    setSelectedRunDate,
    contentClusters,
    salesClusters,
    totalThisRun: visible.length,
  };
}
