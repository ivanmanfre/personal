import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { dashboardAction } from '../../../../../lib/dashboardActions';

/*
 * Ivan System error feed — lifted verbatim from WorkflowsPanel so the hero
 * strip and the Workflows tab read ONE source. Every write path reuses the
 * generic dashboard_action RPC (lib/dashboardActions.dashboardAction); no
 * mutation is re-implemented here. Client scope resolved via the anon-safe
 * view client_instances_safe, exactly as v1.
 */

export interface IvanError {
  id: string;
  workflowId: string;
  workflowName: string | null;
  errorMessage: string | null;
  aiAnalysis: string | null;
  severity: string;
  lastSeen: string;
  occurrenceCount: number;
  executionId: string;
  fixStatus: string | null;
  fixAnalysis: string | null;
  fixDescription: string | null;
  fixAppliedAt: string | null;
}

export function useIvanErrors(refreshKey?: unknown) {
  const [ivanErrors, setIvanErrors] = useState<IvanError[]>([]);

  const fetchIvanErrors = useCallback(async () => {
    const { data: clientData } = await supabase
      .from('client_instances_safe')
      .select('id')
      .eq('client_name', 'Ivan System')
      .single();
    if (!clientData) return;
    const { data } = await supabase
      .from('client_workflow_errors')
      .select('*')
      .eq('client_id', clientData.id)
      .eq('is_resolved', false)
      .order('last_seen', { ascending: false })
      .limit(20);
    if (data) {
      setIvanErrors(data.map((r: any) => ({
        id: r.id,
        workflowId: r.workflow_id,
        workflowName: r.workflow_name,
        errorMessage: r.error_message,
        aiAnalysis: r.ai_analysis,
        severity: r.severity || 'medium',
        lastSeen: r.last_seen,
        occurrenceCount: r.occurrence_count || 1,
        executionId: r.execution_id || '',
        fixStatus: r.fix_status || null,
        fixAnalysis: r.fix_analysis || null,
        fixDescription: r.fix_description || null,
        fixAppliedAt: r.fix_applied_at || null,
      })));
    }
  }, []);

  useEffect(() => { fetchIvanErrors(); }, [fetchIvanErrors]);
  // Re-fetch whenever the shared refresh pulse fires (lastRefreshed).
  useEffect(() => { if (refreshKey) fetchIvanErrors(); }, [refreshKey, fetchIvanErrors]);

  const requestFix = useCallback(async (id: string) => {
    setIvanErrors((prev) => prev.map((e) => (e.id === id ? { ...e, fixStatus: 'requested' } : e)));
    try {
      await dashboardAction('client_workflow_errors', id, 'fix_status', 'requested');
    } catch {
      setIvanErrors((prev) => prev.map((e) => (e.id === id ? { ...e, fixStatus: null } : e)));
    }
  }, []);

  const applyFix = useCallback(async (id: string) => {
    setIvanErrors((prev) => prev.map((e) => (e.id === id ? { ...e, fixStatus: 'fixing' } : e)));
    try {
      await dashboardAction('client_workflow_errors', id, 'fix_status', 'force_fix');
    } catch {
      setIvanErrors((prev) => prev.map((e) => (e.id === id ? { ...e, fixStatus: 'safe_to_fix' } : e)));
    }
  }, []);

  const resolveIvanError = useCallback(async (id: string) => {
    setIvanErrors((prev) => prev.filter((e) => e.id !== id));
    try {
      await dashboardAction('client_workflow_errors', id, 'is_resolved', 'true');
    } catch {
      fetchIvanErrors();
    }
  }, [fetchIvanErrors]);

  const resolveAllIvanErrors = useCallback(async () => {
    const prev = [...ivanErrors];
    setIvanErrors([]);
    try {
      await Promise.all(prev.map((e) => dashboardAction('client_workflow_errors', e.id, 'is_resolved', 'true')));
    } catch {
      setIvanErrors(prev);
    }
  }, [ivanErrors]);

  return { ivanErrors, refresh: fetchIvanErrors, requestFix, applyFix, resolveIvanError, resolveAllIvanErrors };
}
