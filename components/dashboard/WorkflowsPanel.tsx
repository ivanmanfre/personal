import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, ExternalLink,
  Clock, ChevronDown, ChevronRight, Wrench, Lock, Folder, FileText,
} from 'lucide-react';
import { sendToEngineer } from '../../lib/sendToEngineer';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useExecutionLogs } from '../../hooks/useExecutionLogs';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { supabase } from '../../lib/supabase';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import AnimateIn from './shared/AnimateIn';
import { timeAgo } from './shared/utils';
import { pipelineConfig, pipelineRepoMapping } from './system-map/config';
import type { WorkflowStat } from '../../types/dashboard';
import type { GitHubRepo } from '../../hooks/useClientMonitoring';

/* ── Utilities ── */

function getWorkflowHealth(wf: WorkflowStat): 'healthy' | 'warning' | 'error' | 'inactive' {
  if (!wf.isActive) return 'inactive';
  if (wf.errorAcknowledged) return 'healthy';
  if (wf.lastExecutionStatus === 'error' || wf.errorCount24h > 3) return 'error';
  if (wf.errorCount24h > 0) return 'warning';
  return 'healthy';
}

const healthPriority: Record<string, number> = { error: 0, warning: 1, healthy: 2, inactive: 3 };

const CLIENT_REPO_PATTERNS = ['proswppp', 'swppp', 'secondmile', 'second-mile', 'lemonade', 'agencyops', 'agency-ops', 'the-reeder', 'thereeder', 'reeder', 'client-config-template', 'test-co'];
function isClientRepo(repoName: string): boolean {
  return CLIENT_REPO_PATTERNS.some((p) => repoName.toLowerCase().includes(p));
}

const chipDot: Record<string, string> = {
  blue: 'bg-blue-400', purple: 'bg-purple-400', emerald: 'bg-emerald-400', cyan: 'bg-cyan-400',
  orange: 'bg-orange-400', green: 'bg-green-400', amber: 'bg-amber-400', zinc: 'bg-zinc-400',
};

const repoLangColors: Record<string, string> = {
  TypeScript: 'bg-blue-500/15 text-blue-400', JavaScript: 'bg-yellow-500/15 text-yellow-400',
  Python: 'bg-green-500/15 text-green-400', HTML: 'bg-orange-500/15 text-orange-400',
  CSS: 'bg-purple-500/15 text-purple-400', Shell: 'bg-zinc-500/15 text-zinc-400',
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
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
  repos: GitHubRepo[];
  errors: number;
  hasError: boolean;
  hasWarn: boolean;
}

/* ── Component ── */

const WorkflowsPanel: React.FC = () => {
  const { workflows, stats, loading, refresh, acknowledgeError } = useWorkflowStats();
  const { logs, loading: logsLoading } = useExecutionLogs();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_workflow_stats'] });

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const [showRepos, setShowRepos] = useState<string | null>(null);
  const [showActivity, setShowActivity] = useState(true);
  const [sentToEngineer, setSentToEngineer] = useState<Record<string, 'sending' | 'sent'>>({});

  useEffect(() => {
    supabase.from('system_settings').select('value').eq('key', 'github_repos').single()
      .then(({ data }) => {
        if (data?.value) setRepos((data.value as GitHubRepo[]).filter((r) => !isClientRepo(r.name)));
      });
  }, []);

  const handleSendToEngineer = useCallback(async (wf: WorkflowStat) => {
    setSentToEngineer((prev) => ({ ...prev, [wf.workflowId]: 'sending' }));
    const ok = await sendToEngineer(wf.workflowName, wf.workflowId, wf.lastErrorMessage, wf.errorCount24h, wf.id);
    setSentToEngineer((prev) => ({ ...prev, [wf.workflowId]: ok ? 'sent' : 'sending' }));
    if (!ok) setTimeout(() => setSentToEngineer((prev) => { const n = { ...prev }; delete n[wf.workflowId]; return n; }), 2000);
  }, []);

  const pipelineStats = useMemo((): PipelineStat[] => {
    // First-match-wins: each workflow belongs to exactly ONE pipeline
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
      const pRepos = repos.filter((r) => {
        const patterns = pipelineRepoMapping[p.id] || [];
        return patterns.some((pat) => r.name.toLowerCase().includes(pat));
      });
      const errors = matched.reduce((s, w) => s + w.errorCount24h, 0);
      const hasError = matched.some((w) => getWorkflowHealth(w) === 'error');
      const hasWarn = matched.some((w) => getWorkflowHealth(w) === 'warning');
      return { id: p.id, name: p.name, color: p.color, workflows: matched, repos: pRepos, errors, hasError, hasWarn };
    });
  }, [workflows, repos]);

  const recentLogs = useMemo(() => logs.slice(0, 10), [logs]);

  const healthCounts = useMemo(() => {
    const counts = { healthy: 0, warning: 0, error: 0, inactive: 0 };
    workflows.forEach((wf) => { counts[getWorkflowHealth(wf)]++; });
    return counts;
  }, [workflows]);

  const successRate = (stats.totalSuccess24h + stats.totalErrors24h) > 0
    ? ((stats.totalSuccess24h / (stats.totalSuccess24h + stats.totalErrors24h)) * 100).toFixed(1)
    : '100';

  const workflowPipelineMap = useMemo(() => {
    const map = new Map<string, PipelineStat>();
    pipelineStats.forEach((p) => p.workflows.forEach((wf) => map.set(wf.workflowId, p)));
    return map;
  }, [pipelineStats]);

  if (loading) return <LoadingSkeleton cards={4} rows={8} />;

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* ── Stat Strip + Health Bar (compact) ── */}
      <AnimateIn>
        <div className="flex items-center gap-3 sm:gap-5 px-4 py-3 rounded-xl border border-zinc-800/50 bg-zinc-900/40 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-sm font-bold text-zinc-200 tabular-nums">{stats.total}</span>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">workflows</span>
          </div>
          <div className="w-px h-4 bg-zinc-800 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-sm font-bold text-zinc-200 tabular-nums">{stats.active}</span>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">active</span>
          </div>
          <div className="w-px h-4 bg-zinc-800 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <XCircle className={`w-3.5 h-3.5 ${stats.totalErrors24h > 0 ? 'text-red-400' : 'text-zinc-600'}`} />
            <span className={`text-sm font-bold tabular-nums ${stats.totalErrors24h > 0 ? 'text-red-400' : 'text-zinc-200'}`}>{stats.totalErrors24h}</span>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">errors 24h</span>
          </div>
          <div className="w-px h-4 bg-zinc-800 hidden sm:block" />
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-sm font-bold text-zinc-200 tabular-nums">{successRate}%</span>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">success</span>
          </div>

          <div className="flex-1 min-w-[40px]" />

          {/* Compact health indicator */}
          <div className="flex items-center gap-2">
            {healthCounts.error > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-red-400 tabular-nums">{healthCounts.error}</span>
              </span>
            )}
            {healthCounts.warning > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[10px] text-amber-400 tabular-nums">{healthCounts.warning}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-zinc-400 tabular-nums">{healthCounts.healthy}</span>
            </span>
            <div className="flex h-1.5 w-20 rounded-full overflow-hidden bg-zinc-800 gap-px">
              {healthCounts.error > 0 && <div className="bg-red-500 rounded-full" style={{ width: `${(healthCounts.error / workflows.length) * 100}%` }} />}
              {healthCounts.warning > 0 && <div className="bg-amber-500 rounded-full" style={{ width: `${(healthCounts.warning / workflows.length) * 100}%` }} />}
              {healthCounts.healthy > 0 && <div className="bg-emerald-500 rounded-full" style={{ width: `${(healthCounts.healthy / workflows.length) * 100}%` }} />}
            </div>
          </div>
        </div>
      </AnimateIn>

      {/* ── 4×2 Command Center Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {pipelineStats.filter((p) => p.workflows.length > 0).map((p, i) => {
          const errorWfCount = p.workflows.filter((w) => getWorkflowHealth(w) === 'error').length;
          const warnWfCount = p.workflows.filter((w) => getWorkflowHealth(w) === 'warning').length;
          const sortedWfs = [...p.workflows].sort((a, b) => healthPriority[getWorkflowHealth(a)] - healthPriority[getWorkflowHealth(b)]);

          return (
            <div key={p.id} className={`rounded-xl border border-t-2 bg-zinc-900/80 overflow-hidden transition-all duration-300 hover:border-zinc-700/60 ${
                p.hasError
                  ? 'ring-1 ring-red-500/20 border-zinc-800/60 border-t-red-500/60'
                  : `border-zinc-800/60 ${accentBorder[p.color] || 'border-t-zinc-700/50'}`
              }`}>

                {/* Tile Header */}
                <div className="px-3 py-2.5 flex items-center gap-2 border-b border-zinc-800/30 bg-zinc-800/15">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${p.hasError ? 'bg-red-400 animate-pulse' : chipDot[p.color] || 'bg-zinc-400'}`} />
                  <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider truncate flex-1">
                    {p.name.replace(' Pipeline', '').replace(' & Backups', '')}
                  </span>
                  <span className="text-[10px] text-zinc-600 tabular-nums">{p.workflows.length}</span>
                  {p.errors > 0 && (
                    <span className="text-[9px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/15">
                      {p.errors}e
                    </span>
                  )}
                  {p.repos.length > 0 && (
                    <button
                      onClick={() => setShowRepos(showRepos === p.id ? null : p.id)}
                      className={`text-[9px] px-1 py-0.5 rounded transition-colors ${showRepos === p.id ? 'text-zinc-300 bg-zinc-700/60' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                      {p.repos.length}r
                    </button>
                  )}
                </div>

                {/* Health summary strip */}
                <div className="px-3 py-1.5 bg-zinc-800/10 border-b border-zinc-800/20 flex items-center gap-2 text-[9px]">
                  {errorWfCount > 0 && <span className="text-red-400">{errorWfCount} error</span>}
                  {warnWfCount > 0 && <span className="text-amber-400">{warnWfCount} warn</span>}
                  {errorWfCount === 0 && warnWfCount === 0 && (
                    <span className="text-emerald-400/70">{p.workflows.length}/{p.workflows.length} healthy</span>
                  )}
                  <span className="flex-1" />
                  <span className="text-zinc-600 tabular-nums">
                    {p.workflows.reduce((s, w) => s + w.totalExecutions24h, 0)} runs
                  </span>
                </div>

                {/* Workflow rows */}
                <div className="max-h-[300px] overflow-y-auto dashboard-scroll">
                  {sortedWfs.map((wf) => {
                    const health = getWorkflowHealth(wf);
                    const isExpanded = expandedWorkflow === wf.workflowId;
                    return (
                      <div key={wf.workflowId} className={health === 'error' ? 'bg-red-950/10' : ''}>
                        <button
                          onClick={() => setExpandedWorkflow(isExpanded ? null : wf.workflowId)}
                          className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-zinc-800/30 transition-colors text-left border-b border-zinc-800/15"
                        >
                          <StatusDot status={health} pulse={health === 'error'} />
                          <span className="flex-1 min-w-0 text-[11px] text-zinc-300 truncate">{wf.workflowName}</span>
                          <span className="text-[9px] text-zinc-600 tabular-nums shrink-0 hidden sm:inline">{timeAgo(wf.lastExecutionAt)}</span>
                          {wf.errorCount24h > 0 && <span className="text-[9px] text-red-400 tabular-nums shrink-0">{wf.errorCount24h}e</span>}
                        </button>

                        {/* Expanded workflow detail */}
                        {isExpanded && (
                          <div className="px-3 pb-2.5 pt-1 space-y-2 bg-zinc-800/15 border-b border-zinc-800/30">
                            <div className="grid grid-cols-2 gap-1.5">
                              <div className="rounded-md bg-zinc-800/50 px-2 py-1.5 text-center">
                                <p className={`text-[11px] font-semibold tabular-nums ${wf.lastExecutionStatus === 'error' ? 'text-red-400' : 'text-zinc-300'}`}>
                                  {wf.lastExecutionStatus || '—'}
                                </p>
                                <p className="text-[8px] text-zinc-600">status</p>
                              </div>
                              <div className="rounded-md bg-zinc-800/50 px-2 py-1.5 text-center">
                                <p className="text-[11px] font-semibold tabular-nums text-zinc-300">{formatDuration(wf.lastExecutionDurationMs)}</p>
                                <p className="text-[8px] text-zinc-600">duration</p>
                              </div>
                              <div className="rounded-md bg-zinc-800/50 px-2 py-1.5 text-center">
                                <p className="text-[11px] font-semibold tabular-nums text-zinc-300">{wf.totalExecutions24h}</p>
                                <p className="text-[8px] text-zinc-600">runs 24h</p>
                              </div>
                              <div className="rounded-md bg-zinc-800/50 px-2 py-1.5 text-center">
                                <p className="text-[11px] font-semibold tabular-nums text-zinc-300">{wf.nodeCount}</p>
                                <p className="text-[8px] text-zinc-600">nodes</p>
                              </div>
                            </div>
                            {wf.scheduleExpression && (
                              <p className="text-[10px] text-zinc-500"><Clock className="w-2.5 h-2.5 inline mr-1" />{wf.scheduleExpression}</p>
                            )}
                            {wf.lastErrorMessage && (
                              <div className="p-2 bg-red-950/30 border border-red-500/15 rounded-md text-[10px] text-red-300/90 font-mono leading-relaxed break-all">
                                <span className="text-red-400/50 text-[8px] font-sans block mb-0.5">{timeAgo(wf.lastExecutionAt)}</span>
                                {wf.lastErrorMessage.length > 200 ? wf.lastErrorMessage.slice(0, 200) + '…' : wf.lastErrorMessage}
                              </div>
                            )}
                            <div className="flex items-center gap-1 flex-wrap">
                              <a href={`https://n8n.intelligents.agency/workflow/${wf.workflowId}`}
                                target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 hover:text-white hover:bg-zinc-700/60 transition-colors">
                                <ExternalLink className="w-2 h-2" /> n8n
                              </a>
                              {wf.errorCount24h > 0 && !wf.errorAcknowledged && (
                                <button onClick={(e) => { e.stopPropagation(); acknowledgeError(wf.id); }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                                  <CheckCircle2 className="w-2 h-2" /> Resolve
                                </button>
                              )}
                              {wf.errorCount24h > 0 && (
                                <button onClick={(e) => { e.stopPropagation(); handleSendToEngineer(wf); }}
                                  disabled={!!sentToEngineer[wf.workflowId]}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-medium transition-colors ${
                                    sentToEngineer[wf.workflowId] === 'sent' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                    : sentToEngineer[wf.workflowId] === 'sending' ? 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 cursor-wait'
                                    : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20'
                                  }`}>
                                  <Wrench className="w-2 h-2" />
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

                {/* Repos section (toggled) */}
                {showRepos === p.id && p.repos.length > 0 && (
                  <div className="border-t border-zinc-800/40 px-3 py-2 space-y-1">
                    <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5">Repositories</p>
                    {p.repos.map((repo) => {
                      const isOpen = expandedRepo === repo.name;
                      const hasContents = repo.contents && repo.contents.length > 0;
                      const dirs = (repo.contents || []).filter((f) => f.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
                      const files = (repo.contents || []).filter((f) => f.type === 'file').sort((a, b) => a.name.localeCompare(b.name));
                      return (
                        <div key={repo.name} className="rounded-md border border-zinc-800/40 bg-zinc-800/20 overflow-hidden">
                          <div className="flex items-center gap-1.5 p-2">
                            {hasContents ? (
                              <button onClick={() => setExpandedRepo(isOpen ? null : repo.name)}
                                className="p-0.5 hover:bg-zinc-700/50 rounded transition-colors">
                                {isOpen ? <ChevronDown className="w-2.5 h-2.5 text-zinc-500" /> : <ChevronRight className="w-2.5 h-2.5 text-zinc-500" />}
                              </button>
                            ) : <span className="w-3.5" />}
                            <div className="flex-1 min-w-0">
                              <a href={repo.html_url} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-zinc-200 font-medium truncate hover:text-blue-400 transition-colors block">{repo.name}</a>
                              <div className="flex items-center gap-1 mt-0.5">
                                {repo.language && <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${repoLangColors[repo.language] || 'bg-zinc-700/50 text-zinc-400'}`}>{repo.language}</span>}
                                {repo.private && <Lock className="w-2 h-2 text-zinc-600" />}
                              </div>
                            </div>
                          </div>
                          {isOpen && hasContents && (
                            <div className="border-t border-zinc-800/30 px-2 py-1 space-y-0.5">
                              {dirs.map((f) => (
                                <a key={f.path} href={`${repo.html_url}/tree/${repo.default_branch}/${f.path}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 py-0.5 text-[9px] text-zinc-300 hover:text-blue-400 transition-colors">
                                  <Folder className="w-2 h-2 text-blue-400/60 shrink-0" /><span className="truncate">{f.name}/</span>
                                </a>
                              ))}
                              {files.map((f) => (
                                <a key={f.path} href={`${repo.html_url}/blob/${repo.default_branch}/${f.path}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="flex items-center gap-1 py-0.5 text-[9px] text-zinc-400 hover:text-blue-400 transition-colors">
                                  <FileText className="w-2 h-2 text-zinc-600 shrink-0" /><span className="truncate">{f.name}</span>
                                  {f.size > 0 && <span className="text-[8px] text-zinc-600 ml-auto shrink-0">{formatSize(f.size)}</span>}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
          );
        })}
      </div>

      {/* ── Recent Activity (compact, collapsible) ── */}
      <AnimateIn delay={300}>
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 overflow-hidden">
          <button
            onClick={() => setShowActivity(!showActivity)}
            className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-zinc-800/20 transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Recent Activity</span>
            <span className="text-[10px] text-zinc-600 tabular-nums">{recentLogs.length}</span>
            <span className="flex-1" />
            {showActivity ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}
          </button>
          {showActivity && (
            <div className="px-4 pb-3 border-t border-zinc-800/30">
              {logsLoading ? (
                <p className="text-xs text-zinc-600 py-2">Loading...</p>
              ) : recentLogs.length === 0 ? (
                <p className="text-xs text-zinc-600 py-2">No recent executions</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-0.5 pt-2">
                  {recentLogs.map((exec) => (
                    <div key={exec.executionId} className="flex items-center gap-2 py-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        exec.status === 'success' ? 'bg-emerald-400' : exec.status === 'error' ? 'bg-red-400' : 'bg-amber-400'
                      }`} />
                      <span className="text-[10px] text-zinc-400 truncate flex-1">{exec.workflowName || exec.workflowId}</span>
                      <span className="text-[9px] text-zinc-600 tabular-nums shrink-0">{timeAgo(exec.startedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </AnimateIn>
    </div>
  );
};

export default WorkflowsPanel;
