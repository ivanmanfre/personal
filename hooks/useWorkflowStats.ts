import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
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
    updatedAt: row.updated_at,
  };
}

export function useWorkflowStats() {
  const [workflows, setWorkflows] = useState<WorkflowStat[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('dashboard_workflow_stats')
      .select('*')
      .order('workflow_name');
    setWorkflows((data || []).map(mapWf));
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const active = workflows.filter((w) => w.isActive);
  const totalErrors24h = workflows.reduce((s, w) => s + w.errorCount24h, 0);
  const totalSuccess24h = workflows.reduce((s, w) => s + w.successCount24h, 0);
  const errorRate = (totalSuccess24h + totalErrors24h) > 0
    ? (totalErrors24h / (totalSuccess24h + totalErrors24h) * 100).toFixed(1)
    : '0';

  const health: SystemHealth =
    totalErrors24h > 10 ? 'critical' :
    totalErrors24h > 3 ? 'degraded' : 'healthy';

  const byType = (type: string) => workflows.filter((w) => w.triggerType === type);

  return {
    workflows,
    loading,
    refresh: fetch,
    stats: { total: workflows.length, active: active.length, totalErrors24h, totalSuccess24h, errorRate, health },
    byType,
  };
}
