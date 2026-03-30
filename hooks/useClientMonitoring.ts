import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError, toastSuccess } from '../lib/dashboardActions';
import { pauseRefresh, resumeRefresh } from './useAutoRefresh';
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
    fixStatus: row.fix_status || null,
    fixAnalysis: row.fix_analysis || null,
    fixDescription: row.fix_description || null,
    fixAppliedAt: row.fix_applied_at || null,
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
  const [autofixEnabled, setAutofixEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState<Set<string>>(new Set());
  const startMutating = (id: string) => setMutating((s) => new Set(s).add(id));
  const stopMutating = (id: string) => setMutating((s) => { const n = new Set(s); n.delete(id); return n; });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
    const [clientsRes, errorsRes, workflowsRes, infraRes, reposRes, autofixRes] = await Promise.all([
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
      supabase
        .from('integration_config')
        .select('value')
        .eq('key', 'client_autofix_enabled')
        .single(),
    ]);

    const clientList = (clientsRes.data || []).filter((r: any) => r.client_name !== 'Ivan System').map(mapClient);
    const clientNameMap = new Map(clientList.map((c) => [c.id, c.clientName]));
    const clientUrlMap = new Map(clientList.map((c) => [c.id, c.n8nUrl]));

    setClients(clientList);
    setErrors(
      (errorsRes.data || []).filter((row: any) => clientNameMap.has(row.client_id)).map((row: any) => ({
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
    setAutofixEnabled(autofixRes.data?.value === 'true');
    } catch (err) {
      toastError('load client data', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const stats = useMemo(() => {
    const activeClients = clients.filter((c) => c.isActive);
    const unresolvedErrors = errors.filter((e) => !e.isResolved);
    const criticalErrors = unresolvedErrors.filter((e) => e.severity === 'high');
    const clientsWithErrors = new Set(unresolvedErrors.map((e) => e.clientId)).size;
    const monitoredCount = workflows.filter((w) => w.notificationsEnabled).length;
    return {
      total: clients.length,
      active: activeClients.length,
      unresolvedErrors: unresolvedErrors.length,
      criticalErrors: criticalErrors.length,
      clientsWithErrors,
      monitoredWorkflows: monitoredCount,
    };
  }, [clients, errors, workflows]);

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
    startMutating(id);
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, isActive } : c)));
    try {
      await dashboardAction('client_instances', id, 'is_active', String(isActive));
      await fetch();
    } catch (err) {
      toastError('toggle client', err);
      setClients((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: !isActive } : c)));
    } finally {
      stopMutating(id);
    }
  };

  const resolveError = async (id: string) => {
    const prev = errors.find((e) => e.id === id);
    startMutating(id);
    pauseRefresh();
    setErrors((p) => p.filter((e) => e.id !== id));
    try {
      await dashboardAction('client_workflow_errors', id, 'is_resolved', 'true');
      await fetch();
    } catch (err) {
      toastError('resolve error', err);
      if (prev) setErrors((p) => [...p, prev]);
    } finally {
      resumeRefresh();
      stopMutating(id);
    }
  };

  const resolveAllForClient = async (clientId: string) => {
    const clientErrors = errors.filter((e) => e.clientId === clientId);
    if (clientErrors.length === 0) return;
    startMutating(clientId);
    pauseRefresh();
    setErrors((p) => p.filter((e) => e.clientId !== clientId));
    try {
      await Promise.all(
        clientErrors.map((e) => dashboardAction('client_workflow_errors', e.id, 'is_resolved', 'true'))
      );
      await fetch();
    } catch (err) {
      toastError('resolve client errors', err);
      setErrors((p) => [...p, ...clientErrors]);
    } finally {
      resumeRefresh();
      stopMutating(clientId);
    }
  };

  const resolveAllErrors = async () => {
    if (errors.length === 0) return;
    const prev = [...errors];
    startMutating('_all');
    pauseRefresh();
    setErrors([]);
    try {
      await Promise.all(
        prev.map((e) => dashboardAction('client_workflow_errors', e.id, 'is_resolved', 'true'))
      );
      await fetch();
    } catch (err) {
      toastError('resolve all errors', err);
      setErrors(prev);
    } finally {
      resumeRefresh();
      stopMutating('_all');
    }
  };

  const updateInfrastructure = async (clientId: string, data: ClientInfrastructure) => {
    const updated = { ...infrastructure, [clientId]: data };
    setInfrastructure(updated);
    try {
      await supabase
        .from('system_settings')
        .upsert({ key: 'client_infrastructure', value: updated }, { onConflict: 'key' });
    } catch (err) {
      toastError('save infrastructure', err);
      setInfrastructure(infrastructure);
    }
  };

  const toggleWorkflowNotifications = async (id: string, enabled: boolean) => {
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, notificationsEnabled: enabled } : w)));
    try {
      await dashboardAction('client_monitored_workflows', id, 'notifications_enabled', String(enabled));
      await fetch();
    } catch (err) {
      toastError('toggle notifications', err);
      setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, notificationsEnabled: !enabled } : w)));
    }
  };

  const requestFix = async (id: string) => {
    startMutating(id);
    setErrors((prev) => prev.map((e) => (e.id === id ? { ...e, fixStatus: 'requested' } : e)));
    try {
      await dashboardAction('client_workflow_errors', id, 'fix_status', 'requested');
    } catch (err) {
      toastError('request fix', err);
      setErrors((prev) => prev.map((e) => (e.id === id ? { ...e, fixStatus: null } : e)));
    } finally {
      stopMutating(id);
    }
  };

  const applyFix = async (id: string) => {
    startMutating(id);
    setErrors((prev) => prev.map((e) => (e.id === id ? { ...e, fixStatus: 'fixing' } : e)));
    try {
      await dashboardAction('client_workflow_errors', id, 'fix_status', 'force_fix');
    } catch (err) {
      toastError('apply fix', err);
      setErrors((prev) => prev.map((e) => (e.id === id ? { ...e, fixStatus: 'safe_to_fix' } : e)));
    } finally {
      stopMutating(id);
    }
  };

  const toggleAutofix = async () => {
    const newValue = !autofixEnabled;
    setAutofixEnabled(newValue);
    try {
      await supabase
        .from('integration_config')
        .upsert({ key: 'client_autofix_enabled', value: String(newValue) }, { onConflict: 'key' });
    } catch (err) {
      toastError('toggle autofix', err);
      setAutofixEnabled(!newValue);
    }
  };

  const reposPerClient = (clientName: string): GitHubRepo[] => {
    const patterns = CLIENT_REPO_PATTERNS[clientName];
    if (!patterns) return [];
    return githubRepos.filter((repo) =>
      patterns.some((p) => repo.name.toLowerCase().includes(p))
    );
  };

  return {
    clients,
    errors,
    workflows,
    loading,
    mutating,
    refresh: fetch,
    stats,
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
    requestFix,
    applyFix,
    autofixEnabled,
    toggleAutofix,
  };
}
