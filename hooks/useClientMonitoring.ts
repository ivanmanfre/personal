import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ClientInstance, ClientWorkflowError } from '../types/dashboard';

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

export function useClientMonitoring() {
  const [clients, setClients] = useState<ClientInstance[]>([]);
  const [errors, setErrors] = useState<ClientWorkflowError[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    const [clientsRes, errorsRes] = await Promise.all([
      supabase.from('client_instances_safe').select('*').order('client_name'),
      supabase
        .from('client_workflow_errors')
        .select('*')
        .eq('is_resolved', false)
        .order('last_seen', { ascending: false })
        .limit(50),
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
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const activeClients = clients.filter((c) => c.isActive);
  const unresolvedErrors = errors.filter((e) => !e.isResolved);
  const criticalErrors = unresolvedErrors.filter((e) => e.severity === 'high');
  const clientsWithErrors = new Set(unresolvedErrors.map((e) => e.clientId)).size;

  const errorsPerClient = (clientId: string) =>
    errors.filter((e) => e.clientId === clientId);

  const getClientHealth = (client: ClientInstance): 'healthy' | 'warning' | 'error' | 'inactive' => {
    if (!client.isActive) return 'inactive';
    if (client.consecutiveFailures >= 3) return 'error';
    const clientErrors = errorsPerClient(client.id);
    if (clientErrors.some((e) => e.severity === 'high')) return 'error';
    if (clientErrors.length > 0) return 'warning';
    return 'healthy';
  };

  return {
    clients,
    errors,
    loading,
    refresh: fetch,
    stats: {
      total: clients.length,
      active: activeClients.length,
      unresolvedErrors: unresolvedErrors.length,
      criticalErrors: criticalErrors.length,
      clientsWithErrors,
    },
    errorsPerClient,
    getClientHealth,
  };
}
