import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError, toastSuccess } from '../lib/dashboardActions';
import type { WorkflowStat, SystemHealth } from '../types/dashboard';

function mapWf(row: any): WorkflowStat {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    workflowName: row.workflow_name,
    isActive: row.is_active,
    triggerType: row.trigger_type || 'manual',
    scheduleExpression: row.schedule_expression,
    lastExecutionAt: row.last_execution_at,
    lastExecutionStatus: row.last_execution_status,
    lastExecutionDurationMs: row.last_execution_duration_ms,
    successCount24h: row.success_count_24h || 0,
    errorCount24h: row.error_count_24h || 0,
    totalExecutions24h: row.total_executions_24h || 0,
    lastErrorMessage: row.last_error_message,
    nodeCount: row.node_count || 0,
    errorAcknowledged: row.error_acknowledged ?? false,
    manuallyPaused: row.manually_paused ?? false,
    updatedAt: row.updated_at,
  };
}

const DASHBOARD_HASH = import.meta.env.VITE_DASHBOARD_HASH || '';

export function useWorkflowStats() {
  const [workflows, setWorkflows] = useState<WorkflowStat[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetch = useCallback(async () => {
    // Only show loading skeleton on initial load, not on refreshes
    if (!hasFetched.current) setLoading(true);
    try {
      // Show active workflows AND manually-paused ones (so user can resume from the dashboard).
      const { data } = await supabase
        .from('dashboard_workflow_stats')
        .select('*')
        .or('is_active.eq.true,manually_paused.eq.true')
        .order('workflow_name');
      setWorkflows((data || []).map(mapWf));
    } catch (err) {
      toastError('load workflows', err);
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const stats = useMemo(() => {
    const active = workflows.filter((w) => w.isActive);
    const totalErrors24h = workflows.reduce((s, w) => s + w.errorCount24h, 0);
    const totalSuccess24h = workflows.reduce((s, w) => s + w.successCount24h, 0);
    const errorRate = (totalSuccess24h + totalErrors24h) > 0
      ? (totalErrors24h / (totalSuccess24h + totalErrors24h) * 100).toFixed(1)
      : '0';
    const health: SystemHealth =
      totalErrors24h > 10 ? 'critical' :
      totalErrors24h > 3 ? 'degraded' : 'healthy';
    return { total: workflows.length, active: active.length, totalErrors24h, totalSuccess24h, errorRate, health };
  }, [workflows]);

  const byType = useCallback(
    (type: string) => workflows.filter((w) => w.triggerType === type),
    [workflows]
  );

  const acknowledgeError = useCallback(async (id: string) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, errorAcknowledged: true } : w)));
    try {
      await dashboardAction('dashboard_workflow_stats', id, 'error_acknowledged', 'true');
      await fetch();
    } catch (err) {
      toastError('acknowledge error', err);
      setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, errorAcknowledged: false } : w)));
    }
  }, []);

  const togglePause = useCallback(async (workflowId: string, action: 'pause' | 'resume') => {
    // Optimistic update
    setWorkflows((prev) => prev.map((w) =>
      w.workflowId === workflowId
        ? { ...w, isActive: action === 'resume', manuallyPaused: action === 'pause' }
        : w
    ));
    try {
      const { data, error } = await supabase.functions.invoke('n8n-toggle', {
        body: { workflowId, action },
        headers: { 'x-dashboard-auth': DASHBOARD_HASH },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toastSuccess(action === 'pause' ? 'Workflow paused' : 'Workflow resumed');
      await fetch();
    } catch (err) {
      toastError(action === 'pause' ? 'pause workflow' : 'resume workflow', err);
      // Revert optimistic update
      await fetch();
    }
  }, [fetch]);

  return { workflows, loading, refresh: fetch, stats, byType, acknowledgeError, togglePause };
}
