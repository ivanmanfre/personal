import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, ExternalLink,
  Clock, ChevronDown, ChevronRight, Wrench, Loader2, Shield,
} from 'lucide-react';
import { sendToEngineer } from '../../lib/sendToEngineer';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { supabase } from '../../lib/supabase';
import { dashboardAction } from '../../lib/dashboardActions';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import AnimateIn from './shared/AnimateIn';
import FilterBar from './shared/FilterBar';
import { timeAgo } from './shared/utils';
import { pipelineConfig } from './system-map/config';
import type { WorkflowStat } from '../../types/dashboard';

/* ── Utilities ── */

function getWorkflowHealth(wf: WorkflowStat): 'healthy' | 'warning' | 'error' | 'inactive' {
  if (!wf.isActive) return 'inactive';
  // Only trust acknowledge if the LAST execution was successful
  if (wf.errorAcknowledged && wf.lastExecutionStatus !== 'error') return 'healthy';
  if (wf.lastExecutionStatus === 'error' || wf.errorCount24h > 3) return 'error';
  if (wf.errorCount24h > 0) return 'warning';
  return 'healthy';
}

const healthPriority: Record<string, number> = { error: 0, warning: 1, healthy: 2, inactive: 3 };

const chipDot: Record<string, string> = {
  blue: 'bg-blue-400', purple: 'bg-purple-400', emerald: 'bg-emerald-400', cyan: 'bg-cyan-400',
  orange: 'bg-orange-400', green: 'bg-green-400', amber: 'bg-amber-400', zinc: 'bg-zinc-400',
};

const formatDuration = (ms: number | null) => {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

/* Accent colors for tile top border */
const accentBorder: Record<string, string> = {
  blue: 'border-t-blue-500/50', purple: 'border-t-purple-500/50',
  emerald: 'border-t-emerald-500/50', cyan: 'border-t-cyan-500/50',
  orange: 'border-t-orange-500/50', green: 'border-t-green-500/50',
  amber: 'border-t-amber-500/50', zinc: 'border-t-zinc-500/30',
};

/* ── Types ── */

interface PipelineStat {
  id: string;
  name: string;
  color: string;
  workflows: WorkflowStat[];
  errors: number;
  hasError: boolean;
  hasWarn: boolean;
  totalRuns: number;
}

/* ── Fix Status Badge ── */

const fixStatusConfig: Record<string, { label: string; colors: string; spin?: boolean; pulse?: boolean }> = {
  requested: { label: 'Queued...', colors: 'bg-amber-500/15 text-amber-400 border-amber-500/20', pulse: true },
  analyzing: { label: 'Analyzing...', colors: 'bg-amber-500/15 text-amber-400 border-amber-500/20', spin: true },
  safe_to_fix: { label: 'Fix ready', colors: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
  fixing: { label: 'Fixing...', colors: 'bg-amber-500/15 text-amber-400 border-amber-500/20', spin: true },
  fixed: { label: 'Fixed', colors: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
  not_fixable: { label: 'Manual needed', colors: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20' },
  failed: { label: 'Fix failed', colors: 'bg-red-500/15 text-red-400 border-red-500/20' },
};

const FixStatusBadge: React.FC<{ status: string; appliedAt?: string | null }> = ({ status, appliedAt }) => {
  const cfg = fixStatusConfig[status];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${cfg.colors}`}>
      {cfg.spin && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
      {cfg.pulse && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
      {cfg.label}
      {status === 'fixed' && appliedAt && <span className="text-[9px] opacity-70 ml-0.5">{timeAgo(appliedAt)}</span>}
    </span>
  );
};

interface IvanError {
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

/* ── Component ── */

const WorkflowsPanel: React.FC = () => {
  const { workflows, stats, loading, refresh, acknowledgeError } = useWorkflowStats();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_workflow_stats'] });

  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());
  const [sentToEngineer, setSentToEngineer] = useState<Record<string, 'sending' | 'sent'>>({});
  const [search, setSearch] = useState('');
  const [ivanErrors, setIvanErrors] = useState<IvanError[]>([]);
  const [expandedIvanError, setExpandedIvanError] = useState<string | null>(null);

  // Fetch Ivan System errors from client_workflow_errors
  const fetchIvanErrors = useCallback(async () => {
    // Look up Ivan System client_id via safe view (anon-accessible)
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
  // Re-fetch when main refresh fires
  useEffect(() => { if (lastRefreshed) fetchIvanErrors(); }, [lastRefreshed, fetchIvanErrors]);

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

  const toggleWorkflow = useCallback((id: string) => {
    setExpandedWorkflows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleSendToEngineer = useCallback(async (wf: WorkflowStat) => {
    setSentToEngineer((prev) => ({ ...prev, [wf.workflowId]: 'sending' }));
    const ok = await sendToEngineer(wf.workflowName, wf.workflowId, wf.lastErrorMessage, wf.errorCount24h, wf.id);
    setSentToEngineer((prev) => ({ ...prev, [wf.workflowId]: ok ? 'sent' : 'sending' }));
    if (!ok) setTimeout(() => setSentToEngineer((prev) => { const n = { ...prev }; delete n[wf.workflowId]; return n; }), 2000);
  }, []);

  const pipelineStats = useMemo((): PipelineStat[] => {
    const claimed = new Set<string>();
    const pipelineWorkflows = new Map<string, WorkflowStat[]>();
    pipelineConfig.forEach((p) => pipelineWorkflows.set(p.id, []));

    for (const p of pipelineConfig) {
      for (const wf of workflows) {
        if (claimed.has(wf.workflowId)) continue;
        const name = wf.workflowName.toLowerCase();
        if (p.workflows.some((pat) => name.includes(pat.toLowerCase()))) {
          pipelineWorkflows.get(p.id)!.push(wf);
          claimed.add(wf.workflowId);
        }
      }
    }

    return pipelineConfig.map((p) => {
      const matched = pipelineWorkflows.get(p.id) || [];
      const errors = matched.reduce((s, w) => s + w.errorCount24h, 0);
      const hasError = matched.some((w) => getWorkflowHealth(w) === 'error');
      const hasWarn = matched.some((w) => getWorkflowHealth(w) === 'warning');
      const totalRuns = matched.reduce((s, w) => s + w.totalExecutions24h, 0);
      return { id: p.id, name: p.name, color: p.color, workflows: matched, errors, hasError, hasWarn, totalRuns };
    });
  }, [workflows]);

  const healthCounts = useMemo(() => {
    const counts = { healthy: 0, warning: 0, error: 0, inactive: 0 };
    workflows.forEach((wf) => { counts[getWorkflowHealth(wf)]++; });
    return counts;
  }, [workflows]);

  const successRate = useMemo(() => {
    return (stats.totalSuccess24h + stats.totalErrors24h) > 0
      ? ((stats.totalSuccess24h / (stats.totalSuccess24h + stats.totalErrors24h)) * 100).toFixed(1)
      : '100';
  }, [stats.totalSuccess24h, stats.totalErrors24h]);

  // Sort pipelines: errors first, then warnings, then healthy
  const sortedPipelines = useMemo(() => {
    return pipelineStats
      .filter((p) => p.workflows.length > 0)
      .sort((a, b) => {
        const score = (p: PipelineStat) => p.hasError ? 0 : p.hasWarn ? 1 : 2;
        return score(a) - score(b);
      });
  }, [pipelineStats]);

  // Filter pipelines by search term (match workflowName within each pipeline)
  const searchFilteredPipelines = useMemo(() => {
    if (!search.trim()) return sortedPipelines;
    const q = search.toLowerCase();
    return sortedPipelines
      .map((p) => ({
        ...p,
        workflows: p.workflows.filter((wf) => wf.workflowName.toLowerCase().includes(q)),
      }))
      .filter((p) => p.workflows.length > 0);
  }, [sortedPipelines, search]);

  if (loading) return <LoadingSkeleton cards={4} rows={8} />;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* ── Stat Strip + Health Bar ── */}
      <AnimateIn>
        <div className="flex items-center gap-3 sm:gap-5 px-4 py-3 rounded-xl border border-zinc-800/50 bg-zinc-900/40 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
            <span className="text-sm font-bold text-zinc-200 tabular-nums">{stats.total}</span>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">workflows</span>
          </div>
          <div className="w-px h-4 bg-zinc-800 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            <span className="text-sm font-bold text-zinc-200 tabular-nums">{stats.active}</span>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">active</span>
          </div>
          <div className="w-px h-4 bg-zinc-800 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <XCircle className={`w-3.5 h-3.5 ${stats.totalErrors24h > 0 ? 'text-red-400' : 'text-zinc-600'}`} aria-hidden="true" />
            <span className={`text-sm font-bold tabular-nums ${stats.totalErrors24h > 0 ? 'text-red-400' : 'text-zinc-200'}`}>{stats.totalErrors24h}</span>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">errors 24h</span>
          </div>
          <div className="w-px h-4 bg-zinc-800 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
            <span className="text-sm font-bold text-zinc-200 tabular-nums">{successRate}%</span>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">success</span>
          </div>

          <div className="flex-1 min-w-[40px] hidden sm:block" />

          {/* Compact health indicator with text labels */}
          <div className="flex items-center gap-2 ml-auto">
            {healthCounts.error > 0 && (
              <span className="flex items-center gap-1" title={`${healthCounts.error} workflows with errors`}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
                <span className="text-[10px] text-red-400 tabular-nums">{healthCounts.error}</span>
                <span className="text-[9px] text-red-400/70 hidden sm:inline">err</span>
              </span>
            )}
            {healthCounts.warning > 0 && (
              <span className="flex items-center gap-1" title={`${healthCounts.warning} workflows with warnings`}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                <span className="text-[10px] text-amber-400 tabular-nums">{healthCounts.warning}</span>
                <span className="text-[9px] text-amber-400/70 hidden sm:inline">warn</span>
              </span>
            )}
            <span className="flex items-center gap-1" title={`${healthCounts.healthy} healthy workflows`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="text-[10px] text-zinc-400 tabular-nums">{healthCounts.healthy}</span>
              <span className="text-[9px] text-emerald-400/70 hidden sm:inline">ok</span>
            </span>
            <div
              className="flex h-1.5 w-20 rounded-full overflow-hidden bg-zinc-800 gap-px"
              role="meter"
              aria-label={`Workflow health: ${healthCounts.healthy} healthy, ${healthCounts.warning} warnings, ${healthCounts.error} errors`}
              aria-valuemin={0}
              aria-valuemax={workflows.length}
              aria-valuenow={healthCounts.healthy}
            >
              {healthCounts.error > 0 && <div className="bg-red-500 rounded-full" style={{ width: `${(healthCounts.error / workflows.length) * 100}%` }} />}
              {healthCounts.warning > 0 && <div className="bg-amber-500 rounded-full" style={{ width: `${(healthCounts.warning / workflows.length) * 100}%` }} />}
              {healthCounts.healthy > 0 && <div className="bg-emerald-500 rounded-full" style={{ width: `${(healthCounts.healthy / workflows.length) * 100}%` }} />}
            </div>
          </div>
        </div>
      </AnimateIn>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search workflows..."
      />

      {/* ── Command Center Grid (sorted: errors first) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
        {searchFilteredPipelines.map((p) => {
          const errorWfCount = p.workflows.filter((w) => getWorkflowHealth(w) === 'error').length;
          const warnWfCount = p.workflows.filter((w) => getWorkflowHealth(w) === 'warning').length;
          const sortedWfs = [...p.workflows].sort((a, b) => healthPriority[getWorkflowHealth(a)] - healthPriority[getWorkflowHealth(b)]);

          return (
            <div key={p.id} className={`rounded-xl border border-t-2 bg-zinc-900/80 overflow-hidden transition-all duration-300 hover:border-zinc-700/60 ${
                p.hasError
                  ? 'ring-1 ring-red-500/30 border-red-500/40 border-t-red-500/80 bg-red-950/20'
                  : p.hasWarn
                    ? 'border-amber-500/25 border-t-amber-500/50'
                    : `border-zinc-800/60 ${accentBorder[p.color] || 'border-t-zinc-700/50'}`
              }`}>

                {/* Tile Header — merged with health strip (single line) */}
                <div className="px-3 py-2 flex items-center gap-2 border-b border-zinc-800/30 bg-zinc-800/15">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.hasError ? 'bg-red-400 animate-pulse' : chipDot[p.color] || 'bg-zinc-400'}`} />
                  <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider truncate">
                    {p.name.replace(' Pipeline', '').replace(' & Backups', '')}
                  </span>
                  <span className="text-[10px] text-zinc-500 tabular-nums">{p.workflows.length}</span>
                  {errorWfCount > 0 && <span className="text-[9px] text-red-400">{errorWfCount}err</span>}
                  {warnWfCount > 0 && !errorWfCount && <span className="text-[9px] text-amber-400">{warnWfCount}w</span>}
                  <span className="flex-1" />
                  <span className="text-[9px] text-zinc-600 tabular-nums">{p.totalRuns}r</span>
                </div>

                {/* Workflow rows */}
                <div className="min-h-[80px] max-h-[260px] overflow-y-auto dashboard-scroll">
                  {sortedWfs.map((wf) => {
                    const health = getWorkflowHealth(wf);
                    const isExpanded = expandedWorkflows.has(wf.workflowId);
                    return (
                      <div key={wf.workflowId} className={health === 'error' ? 'bg-red-950/10' : ''}>
                        <button
                          onClick={() => toggleWorkflow(wf.workflowId)}
                          aria-expanded={isExpanded}
                          className="w-full px-3 py-1 flex items-center gap-2 hover:bg-zinc-800/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500/70 focus-visible:outline-offset-[-2px] transition-colors text-left border-b border-zinc-800/15"
                        >
                          <StatusDot status={health} pulse={health === 'error'} />
                          <span className="flex-1 min-w-0 text-[11px] text-zinc-300 truncate">{wf.workflowName}</span>
                          <span
                            className="text-[9px] text-zinc-600 tabular-nums shrink-0 hidden xl:inline"
                            title={wf.lastExecutionAt ? `Last run: ${new Date(wf.lastExecutionAt).toLocaleString()}` : wf.triggerType === 'webhook' ? 'Triggered on demand by another workflow or external call' : 'No executions recorded'}
                          >
                            {wf.lastExecutionAt
                              ? timeAgo(wf.lastExecutionAt)
                              : wf.triggerType === 'webhook' ? 'on demand' : '—'}
                          </span>
                          {wf.errorCount24h > 0 && (
                            <span className="text-[9px] text-red-400 tabular-nums shrink-0" title={`${wf.errorCount24h} errors in 24h`}>
                              {wf.errorCount24h}e
                            </span>
                          )}
                        </button>

                        {/* Expanded workflow detail */}
                        {isExpanded && (
                          <div className="px-3 pb-2.5 pt-1 space-y-2 bg-zinc-800/15 border-b border-zinc-800/30">
                            <div className="flex items-center gap-3 text-[10px]">
                              <span className={`font-medium ${wf.lastExecutionStatus === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>
                                {wf.lastExecutionStatus || '—'}
                              </span>
                              <span className="text-zinc-500">{formatDuration(wf.lastExecutionDurationMs)}</span>
                              <span className="text-zinc-500 tabular-nums">{wf.totalExecutions24h} runs</span>
                            </div>
                            {wf.scheduleExpression && (
                              <p className="text-[10px] text-zinc-500"><Clock className="w-2.5 h-2.5 inline mr-1" aria-hidden="true" />{wf.scheduleExpression}</p>
                            )}
                            {wf.lastErrorMessage && (
                              <div className="p-2 bg-red-950/30 border border-red-500/15 rounded-md text-[10px] text-red-300/90 font-mono leading-relaxed break-all max-h-[120px] overflow-y-auto dashboard-scroll">
                                <span className="text-red-400/50 text-[9px] font-sans block mb-0.5">{timeAgo(wf.lastExecutionAt)}</span>
                                {wf.lastErrorMessage}
                              </div>
                            )}
                            <div className="flex items-center gap-1 flex-wrap">
                              <a href={`https://n8n.ivanmanfredi.com/workflow/${wf.workflowId}`}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 hover:text-white hover:bg-zinc-700/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500/70 transition-colors">
                                <ExternalLink className="w-2 h-2" aria-hidden="true" /> n8n
                              </a>
                              {wf.errorCount24h > 0 && !wf.errorAcknowledged && (
                                <button onClick={(e) => { e.stopPropagation(); acknowledgeError(wf.id); }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500/70 transition-colors">
                                  <CheckCircle2 className="w-2 h-2" aria-hidden="true" /> Resolve
                                </button>
                              )}
                              {wf.errorCount24h > 0 && (
                                <button onClick={(e) => { e.stopPropagation(); handleSendToEngineer(wf); }}
                                  disabled={!!sentToEngineer[wf.workflowId]}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500/70 transition-colors ${
                                    sentToEngineer[wf.workflowId] === 'sent' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                    : sentToEngineer[wf.workflowId] === 'sending' ? 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 cursor-wait'
                                    : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20'
                                  }`}>
                                  <Wrench className="w-2 h-2" aria-hidden="true" />
                                  {sentToEngineer[wf.workflowId] === 'sent' ? 'Sent' : sentToEngineer[wf.workflowId] === 'sending' ? '…' : 'Engineer'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
          );
        })}
      </div>

      {/* ── Latest Errors (Ivan System) ── */}
      {ivanErrors.length > 0 && (
        <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-zinc-500" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em] flex-1">Latest Errors</h2>
            <span className="text-[10px] text-zinc-500">{ivanErrors.length} open</span>
            <button
              onClick={() => { if (confirm(`Clear all ${ivanErrors.length} errors?`)) resolveAllIvanErrors(); }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" /> Clear All
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto dashboard-scroll divide-y divide-zinc-800/40">
            {ivanErrors.map((err) => {
              const isExpanded = expandedIvanError === err.id;
              const sevColors = err.severity === 'high' ? 'bg-red-500/15 text-red-400 border-red-500/20' : err.severity === 'medium' ? 'bg-orange-500/15 text-orange-400 border-orange-500/20' : 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
              return (
                <div key={err.id}>
                  <button
                    onClick={() => setExpandedIvanError(isExpanded ? null : err.id)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors text-left"
                  >
                    <div className="mt-1">
                      <span className={`block w-2 h-2 rounded-full ${err.severity === 'high' ? 'bg-red-500 animate-pulse' : err.severity === 'medium' ? 'bg-orange-500' : 'bg-zinc-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-zinc-300 truncate">{err.workflowName || err.workflowId}</p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${sevColors}`}>{err.severity}</span>
                        {err.occurrenceCount > 1 && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{err.occurrenceCount}x</span>
                        )}
                        {err.fixStatus && <FixStatusBadge status={err.fixStatus} appliedAt={err.fixAppliedAt} />}
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1">{err.errorMessage}</p>
                    </div>
                    <span className="text-[10px] text-zinc-500 shrink-0 mt-1">{timeAgo(err.lastSeen)}</span>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-600 mt-1 shrink-0" /> : <ChevronRight className="w-4 h-4 text-zinc-600 mt-1 shrink-0" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 pl-9 space-y-2">
                      {err.errorMessage && (
                        <div className="p-2.5 bg-red-950/30 border border-red-500/15 rounded-lg text-xs text-red-300/90 font-mono leading-relaxed">
                          {err.errorMessage}
                        </div>
                      )}
                      {err.aiAnalysis && (
                        <div className="p-2.5 bg-blue-950/20 border border-blue-500/15 rounded-lg text-xs text-blue-300/90 leading-relaxed">
                          <span className="text-blue-400/70 font-medium">AI Analysis: </span>
                          {err.aiAnalysis}
                        </div>
                      )}
                      {err.fixAnalysis && (
                        <div className="p-2.5 bg-amber-950/20 border border-amber-500/15 rounded-lg text-xs text-amber-300/90 leading-relaxed">
                          <span className="text-amber-400/70 font-medium">Engineer Analysis: </span>
                          {err.fixAnalysis}
                          {err.fixDescription && (
                            <p className="mt-1 text-amber-400/60">Proposed fix: {err.fixDescription}</p>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                          <span>Workflow: <span className="font-mono">{err.workflowId}</span></span>
                          {err.executionId && (
                            <a
                              href={`https://n8n.ivanmanfredi.com/workflow/${err.workflowId}/executions/${err.executionId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" /> Execution
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {err.fixStatus === 'safe_to_fix' ? (
                            <>
                              <FixStatusBadge status={err.fixStatus} appliedAt={err.fixAppliedAt} />
                              <button
                                onClick={(e) => { e.stopPropagation(); applyFix(err.id); }}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                              >
                                <Wrench className="w-3 h-3" /> Apply Fix
                              </button>
                            </>
                          ) : err.fixStatus ? (
                            <FixStatusBadge status={err.fixStatus} appliedAt={err.fixAppliedAt} />
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); requestFix(err.id); }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                            >
                              <Wrench className="w-3 h-3" /> Tell Engineer
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); resolveIvanError(err.id); }}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Resolve
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowsPanel;
