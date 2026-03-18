import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction } from '../lib/dashboardActions';
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
    updatedAt: row.updated_at,
  };
}

export function useWorkflowStats() {
  const [workflows, setWorkflows] = useState<WorkflowStat[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetch = useCallback(async () => {
    // Only show loading skeleton on initial load, not on refreshes
    if (!hasFetched.current) setLoading(true);
    try {
      const { data } = await supabase
        .from('dashboard_workflow_stats')
        .select('*')
        .eq('is_active', true)
        .order('workflow_name');
      setWorkflows((data || []).map(mapWf));
    } catch (err) {
      console.error('Failed to fetch workflow stats:', err);
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
    } catch {
      setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, errorAcknowledged: false } : w)));
    }
  }, []);

  return { workflows, loading, refresh: fetch, stats, byType, acknowledgeError };
}
