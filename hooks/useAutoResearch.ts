import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError } from '../lib/dashboardActions';
import type { AutoResearchSession, AutoResearchIteration } from '../types/dashboard';

function mapSession(row: any): AutoResearchSession {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    targetType: row.target_type,
    targetRef: row.target_ref,
    workflowId: row.workflow_id,
    promptPageId: row.prompt_page_id,
    metricName: row.metric_name,
    metricUnit: row.metric_unit,
    metricDirection: row.metric_direction,
    baselineValue: row.baseline_value,
    currentBestValue: row.current_best_value,
    improvementPct: row.improvement_pct,
    totalRuns: row.total_runs || 0,
    keptRuns: row.kept_runs || 0,
    status: row.status,
    category: row.category,
    config: row.config || {},
    lastRunAt: row.last_run_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapIteration(row: any): AutoResearchIteration {
  return {
    id: row.id,
    sessionId: row.session_id,
    runNumber: row.run_number,
    changeDescription: row.change_description,
    metricBefore: row.metric_before,
    metricAfter: row.metric_after,
    improvementPct: row.improvement_pct,
    kept: row.kept,
    details: row.details || {},
    createdAt: row.created_at,
  };
}

export function useAutoResearch() {
  const [sessions, setSessions] = useState<AutoResearchSession[]>([]);
  const [iterations, setIterations] = useState<Record<string, AutoResearchIteration[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loadingIterations, setLoadingIterations] = useState(false);
  const hasFetched = useRef(false);

  const fetchSessions = useCallback(async () => {
    if (!hasFetched.current) setLoading(true);
    try {
      const { data } = await supabase
        .from('auto_research_sessions')
        .select('*')
        .order('created_at', { ascending: false });
      setSessions((data || []).map(mapSession));
    } catch (err) {
      toastError('load research sessions', err);
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  }, []);

  const fetchIterations = useCallback(async (sessionId: string) => {
    setLoadingIterations(true);
    try {
      const { data } = await supabase
        .from('auto_research_iterations')
        .select('*')
        .eq('session_id', sessionId)
        .order('run_number', { ascending: true });
      setIterations((prev) => ({ ...prev, [sessionId]: (data || []).map(mapIteration) }));
    } catch (err) {
      toastError('load iterations', err);
    } finally {
      setLoadingIterations(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Auto-fetch iterations when session is selected
  useEffect(() => {
    if (selectedSessionId && !iterations[selectedSessionId]) {
      fetchIterations(selectedSessionId);
    }
  }, [selectedSessionId, iterations, fetchIterations]);

  const stats = useMemo(() => {
    const running = sessions.filter((s) => s.status === 'running').length;
    const completed = sessions.filter((s) => s.status === 'completed').length;
    const totalRuns = sessions.reduce((sum, s) => sum + s.totalRuns, 0);
    const totalKept = sessions.reduce((sum, s) => sum + s.keptRuns, 0);
    const avgImprovement = sessions.filter((s) => s.improvementPct != null);
    const avgImprovementPct = avgImprovement.length > 0
      ? avgImprovement.reduce((sum, s) => sum + (s.improvementPct || 0), 0) / avgImprovement.length
      : 0;
    const bestSession = sessions.reduce<AutoResearchSession | null>((best, s) => {
      if (s.improvementPct == null) return best;
      if (!best || Math.abs(s.improvementPct) > Math.abs(best.improvementPct || 0)) return s;
      return best;
    }, null);
    return { running, completed, total: sessions.length, totalRuns, totalKept, avgImprovementPct, bestSession };
  }, [sessions]);

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  const selectedIterations = useMemo(
    () => (selectedSessionId ? iterations[selectedSessionId] || [] : []),
    [selectedSessionId, iterations]
  );

  const updateSessionStatus = useCallback(async (id: string, status: string) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: status as any } : s)));
    try {
      await dashboardAction('auto_research_sessions', id, 'status', status);
    } catch (err) {
      toastError('update session status', err);
      await fetchSessions();
    }
  }, [fetchSessions]);

  return {
    sessions,
    loading,
    loadingIterations,
    refresh: fetchSessions,
    stats,
    selectedSession,
    selectedSessionId,
    setSelectedSessionId,
    selectedIterations,
    fetchIterations,
    updateSessionStatus,
  };
}
