import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction } from '../lib/dashboardActions';
import type { ClientInstance, ClientWorkflowError, ClientMonitoredWorkflow } from '../types/dashboard';

function mapClient(row: any): ClientInstance {
  return {
    id: row.id,
    clientName: row.client_name,
    n8nUrl: row.n8n_url,
    isActive: row.is_active,
    lastCheckedAt: row.last_checked_at,
    consecutiveFailures: row.consecutive_failures || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapError(row: any): ClientWorkflowError {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    workflowId: row.workflow_id,
    workflowName: row.workflow_name,
    errorHash: row.error_hash,
    errorMessage: row.error_message,
    aiAnalysis: row.ai_analysis,
    severity: row.severity || 'medium',
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    occurrenceCount: row.occurrence_count || 1,
    isResolved: row.is_resolved,
    createdAt: row.created_at,
  };
}

function mapWorkflow(row: any): ClientMonitoredWorkflow {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name || '',
    workflowId: row.workflow_id,
    workflowName: row.workflow_name,
    isActive: row.is_active,
    notificationsEnabled: row.notifications_enabled,
    lastErrorAt: row.last_error_at,
    errorCount: row.error_count || 0,
    updatedAt: row.updated_at,
  };
}

export function useClientMonitoring() {
  const [clients, setClients] = useState<ClientInstance[]>([]);
  const [errors, setErrors] = useState<ClientWorkflowError[]>([]);
  const [workflows, setWorkflows] = useState<ClientMonitoredWorkflow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [clientsRes, errorsRes, workflowsRes] = await Promise.all([
      supabase.from('client_instances_safe').select('*').order('client_name'),
      supabase
        .from('client_workflow_errors')
        .select('*')
        .eq('is_resolved', false)
        .order('last_seen', { ascending: false })
        .limit(50),
      supabase
        .from('client_monitored_workflows_view')
        .select('*')
        .order('workflow_name'),
    ]);

    const clientList = (clientsRes.data || []).map(mapClient);
    const clientNameMap = new Map(clientList.map((c) => [c.id, c.clientName]));

    setClients(clientList);
    setErrors(
      (errorsRes.data || []).map((row: any) => ({
        ...mapError(row),
        clientName: clientNameMap.get(row.client_id) || '',
      }))
    );
    setWorkflows((workflowsRes.data || []).map(mapWorkflow));
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const activeClients = clients.filter((c) => c.isActive);
  const unresolvedErrors = errors.filter((e) => !e.isResolved);
  const criticalErrors = unresolvedErrors.filter((e) => e.severity === 'high');
  const clientsWithErrors = new Set(unresolvedErrors.map((e) => e.clientId)).size;

  const errorsPerClient = (clientId: string) =>
    errors.filter((e) => e.clientId === clientId);

  const workflowsPerClient = (clientId: string) =>
    workflows.filter((w) => w.clientId === clientId);

  const getClientHealth = (client: ClientInstance): 'healthy' | 'warning' | 'error' | 'inactive' => {
    if (!client.isActive) return 'inactive';
    if (client.consecutiveFailures >= 3) return 'error';
    const clientErrors = errorsPerClient(client.id);
    if (clientErrors.some((e) => e.severity === 'high')) return 'error';
    if (clientErrors.length > 0) return 'warning';
    return 'healthy';
  };

  const toggleClient = async (id: string, isActive: boolean) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, isActive } : c)));
    await dashboardAction('client_instances', id, 'is_active', String(isActive));
  };

  const resolveError = async (id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
    await dashboardAction('client_workflow_errors', id, 'is_resolved', 'true');
  };

  const toggleWorkflowNotifications = async (id: string, enabled: boolean) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, notificationsEnabled: enabled } : w)));
    await dashboardAction('client_monitored_workflows', id, 'notifications_enabled', String(enabled));
  };

  const monitoredCount = workflows.filter((w) => w.notificationsEnabled).length;

  return {
    clients,
    errors,
    workflows,
    loading,
    refresh: fetch,
    stats: {
      total: clients.length,
      active: activeClients.length,
      unresolvedErrors: unresolvedErrors.length,
      criticalErrors: criticalErrors.length,
      clientsWithErrors,
      monitoredWorkflows: monitoredCount,
    },
    errorsPerClient,
    workflowsPerClient,
    getClientHealth,
    toggleClient,
    resolveError,
    toggleWorkflowNotifications,
  };
}
