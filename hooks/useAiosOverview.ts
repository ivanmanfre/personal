import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useWorkflowStats } from './useWorkflowStats';
import { useBrainStats } from './useBrainStats';

export type CapabilityKind = 'skill' | 'command' | 'panel' | 'integration' | 'edge_fn';

export type Capability = {
  kind: CapabilityKind;
  slug: string;
  name: string;
  description: string | null;
  group: string | null;
  source_path: string | null;
  last_used_at: string | null;
  invoke_count: number;
  status: string;
  metadata: Record<string, unknown>;
};

export type AiosOverview = {
  byKind: Record<string, Capability[]>;
  counts: Record<string, number>;
  workflows: { total: number; errors: number };
  memoryFiles: number;
  loading: boolean;
  error: string | null;
};

export function useAiosOverview(): AiosOverview {
  const [rows, setRows] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wf = useWorkflowStats();
  const brain = useBrainStats();

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase.rpc('aios_capabilities_overview');
      if (!alive) return;
      if (error) setError(error.message);
      else setRows((data as Capability[]) || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const byKind: Record<string, Capability[]> = {};
  const counts: Record<string, number> = {};
  for (const r of rows) {
    (byKind[r.kind] ||= []).push(r);
    counts[r.kind] = (counts[r.kind] || 0) + 1;
  }
  const memoryFiles = (brain.tierCounts || []).reduce(
    (s: number, t: { count?: number }) => s + (t.count || 0), 0);

  return {
    byKind,
    counts,
    workflows: { total: wf.stats?.total || 0, errors: wf.stats?.totalErrors24h || 0 },
    memoryFiles,
    loading: loading || wf.loading || brain.loading,
    error,
  };
}
