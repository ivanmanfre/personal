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
    executionId: row.execution_id || '',
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

export interface ClientInfrastructure {
  client_name: string;
  services: string[];
  github_repos: string[];
  supabase_url: string;
  notes: string;
}

export interface GitHubRepoFile {
  name: string;
  type: 'file' | 'dir';
  size: number;
  path: string;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
  private: boolean;
  description: string;
  language: string;
  default_branch: string;
  pushed_at: string;
  created_at: string;
  html_url: string;
  topics: string[];
  contents?: GitHubRepoFile[];
}

/** Map client names to GitHub repo name patterns */
const CLIENT_REPO_PATTERNS: Record<string, string[]> = {
  'ProSWPPP': ['proswppp', 'swppp'],
  'SecondMile': ['secondmile', 'second-mile'],
  'Lemonade': ['lemonade'],
  'Agency Ops': ['agencyops', 'agency-ops'],
  'The Reeder': ['the-reeder', 'thereeder', 'reeder'],
};

export function useClientMonitoring() {
  const [clients, setClients] = useState<ClientInstance[]>([]);
  const [errors, setErrors] = useState<ClientWorkflowError[]>([]);
  const [workflows, setWorkflows] = useState<ClientMonitoredWorkflow[]>([]);
  const [infrastructure, setInfrastructure] = useState<Record<string, ClientInfrastructure>>({});
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
    const [clientsRes, errorsRes, workflowsRes, infraRes, reposRes] = await Promise.all([
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
      supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'client_infrastructure')
        .single(),
      supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'github_repos')
        .single(),
    ]);

    const clientList = (clientsRes.data || []).map(mapClient);
    const clientNameMap = new Map(clientList.map((c) => [c.id, c.clientName]));
    const clientUrlMap = new Map(clientList.map((c) => [c.id, c.n8nUrl]));

    setClients(clientList);
    setErrors(
      (errorsRes.data || []).map((row: any) => ({
        ...mapError(row),
        clientName: clientNameMap.get(row.client_id) || '',
        n8nUrl: clientUrlMap.get(row.client_id) || '',
      }))
    );
    setWorkflows((workflowsRes.data || []).map(mapWorkflow));
    if (infraRes.data?.value) {
      setInfrastructure(infraRes.data.value as Record<string, ClientInfrastructure>);
    }
    if (reposRes.data?.value) {
      setGithubRepos(reposRes.data.value as GitHubRepo[]);
    }
    } catch (err) {
      console.error('Failed to fetch client monitoring data:', err);
    } finally {
      setLoading(false);
    }
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
    try {
      await dashboardAction('client_instances', id, 'is_active', String(isActive));
    } catch {
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: !isActive } : c)));
    }
  };

  const resolveError = async (id: string) => {
    const prev = errors.find((e) => e.id === id);
    setErrors((p) => p.filter((e) => e.id !== id));
    try {
      await dashboardAction('client_workflow_errors', id, 'is_resolved', 'true');
    } catch {
      if (prev) setErrors((p) => [...p, prev]);
    }
  };

  const resolveAllForClient = async (clientId: string) => {
    const clientErrors = errors.filter((e) => e.clientId === clientId);
    if (clientErrors.length === 0) return;
    setErrors((p) => p.filter((e) => e.clientId !== clientId));
    try {
      await Promise.all(
        clientErrors.map((e) => dashboardAction('client_workflow_errors', e.id, 'is_resolved', 'true'))
      );
    } catch {
      setErrors((p) => [...p, ...clientErrors]);
    }
  };

  const resolveAllErrors = async () => {
    if (errors.length === 0) return;
    const prev = [...errors];
    setErrors([]);
    try {
      await Promise.all(
        prev.map((e) => dashboardAction('client_workflow_errors', e.id, 'is_resolved', 'true'))
      );
    } catch {
      setErrors(prev);
    }
  };

  const updateInfrastructure = async (clientId: string, data: ClientInfrastructure) => {
    const updated = { ...infrastructure, [clientId]: data };
    setInfrastructure(updated);
    try {
      await supabase
        .from('system_settings')
        .upsert({ key: 'client_infrastructure', value: updated }, { onConflict: 'key' });
    } catch {
      setInfrastructure(infrastructure);
    }
  };

  const toggleWorkflowNotifications = async (id: string, enabled: boolean) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, notificationsEnabled: enabled } : w)));
    try {
      await dashboardAction('client_monitored_workflows', id, 'notifications_enabled', String(enabled));
    } catch {
      setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, notificationsEnabled: !enabled } : w)));
    }
  };

  const reposPerClient = (clientName: string): GitHubRepo[] => {
    const patterns = CLIENT_REPO_PATTERNS[clientName];
    if (!patterns) return [];
    return githubRepos.filter((repo) =>
      patterns.some((p) => repo.name.toLowerCase().includes(p))
    );
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
    resolveAllForClient,
    toggleWorkflowNotifications,
    resolveAllErrors,
    infrastructure,
    updateInfrastructure,
    githubRepos,
    reposPerClient,
  };
}
