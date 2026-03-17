import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Activity, CheckCircle2, XCircle, AlertTriangle, ExternalLink,
  Clock, Hash, ChevronDown, ChevronRight, X, Wrench,
  Lock, Folder, FileText,
} from 'lucide-react';
import { sendToEngineer } from '../../lib/sendToEngineer';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useExecutionLogs } from '../../hooks/useExecutionLogs';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { supabase } from '../../lib/supabase';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import { timeAgo } from './shared/utils';
import { pipelineConfig, pipelineEdges, pipelinePositions, pipelineRepoMapping } from './system-map/config';
import type { WorkflowStat, ExecutionLog } from '../../types/dashboard';
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
  const lower = repoName.toLowerCase();
  return CLIENT_REPO_PATTERNS.some((p) => lower.includes(p));
}

/* Static color maps (Tailwind purge-safe) */
const chipBg: Record<string, string> = {
  blue: 'bg-blue-500/10 border-blue-500/20', purple: 'bg-purple-500/10 border-purple-500/20',
  emerald: 'bg-emerald-500/10 border-emerald-500/20', cyan: 'bg-cyan-500/10 border-cyan-500/20',
  orange: 'bg-orange-500/10 border-orange-500/20', green: 'bg-green-500/10 border-green-500/20',
  amber: 'bg-amber-500/10 border-amber-500/20', zinc: 'bg-zinc-500/10 border-zinc-600/20',
};
const chipDot: Record<string, string> = {
  blue: 'bg-blue-400', purple: 'bg-purple-400', emerald: 'bg-emerald-400', cyan: 'bg-cyan-400',
  orange: 'bg-orange-400', green: 'bg-green-400', amber: 'bg-amber-400', zinc: 'bg-zinc-400',
};
const chipText: Record<string, string> = {
  blue: 'text-blue-400', purple: 'text-purple-400', emerald: 'text-emerald-400', cyan: 'text-cyan-400',
  orange: 'text-orange-400', green: 'text-green-400', amber: 'text-amber-400', zinc: 'text-zinc-400',
};
const svgColors: Record<string, string> = {
  blue: '#60a5fa', purple: '#c084fc', emerald: '#34d399', cyan: '#22d3ee',
  orange: '#fb923c', green: '#4ade80', amber: '#fbbf24', zinc: '#a1a1aa',
};
const svgColorsFaint: Record<string, string> = {
  blue: 'rgba(96,165,250,0.1)', purple: 'rgba(192,132,252,0.1)', emerald: 'rgba(52,211,153,0.1)', cyan: 'rgba(34,211,238,0.1)',
  orange: 'rgba(251,146,60,0.1)', green: 'rgba(74,222,128,0.1)', amber: 'rgba(251,191,36,0.1)', zinc: 'rgba(161,161,170,0.08)',
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

/* ── Types ── */

type DetailView =
  | { type: 'pipeline'; pipelineId: string }
  | { type: 'workflow'; workflowId: string }
  | { type: 'execution'; executionId: string }
  | null;

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

/* ── SVG Topology Helpers ── */

function cubicPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

/* ── Component ── */

const WorkflowsPanel: React.FC = () => {
  const { workflows, stats, loading, refresh, acknowledgeError } = useWorkflowStats();
  const { logs, loading: logsLoading } = useExecutionLogs();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_workflow_stats'] });

  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [detail, setDetail] = useState<DetailView>(null);
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);
  const [expandedExec, setExpandedExec] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [sentToEngineer, setSentToEngineer] = useState<Record<string, 'sending' | 'sent'>>({});

  useEffect(() => {
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'github_repos')
      .single()
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
    return pipelineConfig.map((p) => {
      const matched = workflows.filter((wf) => {
        const name = wf.workflowName.toLowerCase();
        return p.workflows.some((pat) => name.includes(pat.toLowerCase()));
      });
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
    pipelineStats.forEach((p) => {
      p.workflows.forEach((wf) => map.set(wf.workflowId, p));
    });
    return map;
  }, [pipelineStats]);

  if (loading) return <LoadingSkeleton cards={4} rows={8} />;

  const selectedPipeline = detail?.type === 'pipeline'
    ? pipelineStats.find((p) => p.id === detail.pipelineId)
    : null;
  const selectedWorkflow = detail?.type === 'workflow'
    ? workflows.find((w) => w.workflowId === detail.workflowId)
    : null;
  const selectedExecution = detail?.type === 'execution'
    ? logs.find((l) => l.executionId === detail.executionId)
    : null;

  return (
    <div className="space-y-6 relative">
      {/* ── Header with pipeline chips ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {pipelineStats.map((p) => (
              <button
                key={p.id}
                onClick={() => setDetail({ type: 'pipeline', pipelineId: p.id })}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 border ${
                  detail?.type === 'pipeline' && detail.pipelineId === p.id
                    ? `${chipBg[p.color] || chipBg.zinc} ${chipText[p.color] || 'text-zinc-400'}`
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${p.hasError ? 'bg-red-400' : p.hasWarn ? 'bg-amber-400' : chipDot[p.color] || 'bg-zinc-400'}`} />
                {p.name.replace(' Pipeline', '').replace(' & Backups', '')}
                {p.errors > 0 && <span className="text-red-400">{p.errors}</span>}
              </button>
            ))}
          </div>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Workflows" value={stats.total} icon={<Activity className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Active" value={stats.active} icon={<CheckCircle2 className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Errors (24h)" value={stats.totalErrors24h} icon={<XCircle className="w-5 h-5" />} color={stats.totalErrors24h > 0 ? 'text-red-400' : 'text-zinc-500'} />
        <StatCard label="Success Rate" value={`${successRate}%`} icon={<AlertTriangle className="w-5 h-5" />} color="text-violet-400" />
      </div>

      {/* ── SVG Topology Map ── */}
      <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 overflow-hidden relative">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle, rgb(161 161 170) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        <svg viewBox="0 0 850 350" className="relative w-full h-auto" style={{ minHeight: 280 }}>
          <defs>
            {pipelineEdges.map((e, i) => {
              const sc = pipelineConfig.find((p) => p.id === e.source);
              const tc = pipelineConfig.find((p) => p.id === e.target);
              return (
                <linearGradient key={i} id={`grad-${e.source}-${e.target}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={svgColors[sc?.color || 'zinc']} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={svgColors[tc?.color || 'zinc']} stopOpacity={0.5} />
                </linearGradient>
              );
            })}
          </defs>

          {/* Connection lines */}
          {pipelineEdges.map((e, i) => {
            const sp = pipelinePositions[e.source];
            const tp = pipelinePositions[e.target];
            if (!sp || !tp) return null;
            const d = cubicPath(sp.x, sp.y, tp.x, tp.y);
            return (
              <g key={i}>
                <path d={d} fill="none" stroke={`url(#grad-${e.source}-${e.target})`}
                  strokeWidth="1.5" strokeDasharray="6 4" opacity={0.4}>
                  <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="2s" repeatCount="indefinite" />
                </path>
                <text x={(sp.x + tp.x) / 2} y={(sp.y + tp.y) / 2 - 8}
                  textAnchor="middle" className="fill-zinc-600" style={{ fontSize: 9 }}>
                  {e.label}
                </text>
              </g>
            );
          })}

          {/* Pipeline nodes */}
          {pipelineStats.map((p) => {
            const pos = pipelinePositions[p.id];
            if (!pos) return null;
            const isSelected = detail?.type === 'pipeline' && detail.pipelineId === p.id;
            const isHovered = hoveredNode === p.id;
            const nodeColor = svgColors[p.color] || svgColors.zinc;
            const r = p.id === 'content' ? 36 : 30;
            return (
              <g key={p.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                className="cursor-pointer"
                onClick={() => setDetail({ type: 'pipeline', pipelineId: p.id })}
                onMouseEnter={() => setHoveredNode(p.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {(isSelected || isHovered) && (
                  <circle r={r + 8} fill="none" stroke={nodeColor} strokeWidth="1" opacity={0.3}>
                    {isSelected && <animate attributeName="opacity" values="0.3;0.15;0.3" dur="2s" repeatCount="indefinite" />}
                  </circle>
                )}
                {p.hasError && (
                  <circle r={r} fill="none" stroke="#ef4444" strokeWidth="2" opacity="0">
                    <animate attributeName="r" values={`${r};${r + 12};${r}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle r={r} fill={svgColorsFaint[p.color] || svgColorsFaint.zinc}
                  stroke={p.hasError ? '#ef4444' : p.hasWarn ? '#f59e0b' : nodeColor}
                  strokeWidth={isSelected ? 2 : 1} opacity={isHovered ? 1 : 0.85} />
                <text y={-4} textAnchor="middle" className="fill-zinc-200 font-medium" style={{ fontSize: 11 }}>
                  {p.name.replace(' Pipeline', '').replace(' & Backups', '')}
                </text>
                <text y={12} textAnchor="middle" className="fill-zinc-500" style={{ fontSize: 9 }}>
                  {p.workflows.length} wf
                </text>
                {p.errors > 0 && (
                  <g transform={`translate(${r - 4}, ${-r + 4})`}>
                    <circle r="8" fill="#18181b" />
                    <circle r="7" fill="#ef4444" opacity="0.9">
                      <animate attributeName="opacity" values="0.9;0.5;0.9" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                    <text textAnchor="middle" y={3.5} className="fill-white font-bold" style={{ fontSize: 8 }}>{p.errors}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Bento Metrics Grid ── */}
      <div className="grid grid-cols-6 lg:grid-cols-12 gap-3" style={{ gridAutoRows: '80px' }}>
        {/* System Health Bar */}
        <div className="col-span-6 lg:col-span-12 row-span-1 rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-3 flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">System Health</span>
            <div className="flex items-center gap-3 ml-auto text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-zinc-400">{healthCounts.healthy}</span></span>
              {healthCounts.warning > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-amber-400">{healthCounts.warning}</span></span>}
              {healthCounts.error > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-red-400">{healthCounts.error}</span></span>}
              {healthCounts.inactive > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-600" /><span className="text-zinc-500">{healthCounts.inactive}</span></span>}
            </div>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800 gap-px">
            {healthCounts.error > 0 && <div className="bg-red-500 rounded-full" style={{ width: `${(healthCounts.error / workflows.length) * 100}%` }} />}
            {healthCounts.warning > 0 && <div className="bg-amber-500 rounded-full" style={{ width: `${(healthCounts.warning / workflows.length) * 100}%` }} />}
            {healthCounts.healthy > 0 && <div className="bg-emerald-500 rounded-full" style={{ width: `${(healthCounts.healthy / workflows.length) * 100}%` }} />}
            {healthCounts.inactive > 0 && <div className="bg-zinc-600 rounded-full" style={{ width: `${(healthCounts.inactive / workflows.length) * 100}%` }} />}
          </div>
        </div>

        {/* Health Matrix */}
        <div className="col-span-6 lg:col-span-5 row-span-2 rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-3">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium block mb-2">Workflow Health</span>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(11, minmax(0, 1fr))' }}>
            {workflows.map((wf) => {
              const health = getWorkflowHealth(wf);
              const pipeline = workflowPipelineMap.get(wf.workflowId);
              const dotColor = health === 'error' ? 'bg-red-400' : health === 'warning' ? 'bg-amber-400' : health === 'inactive' ? 'bg-zinc-700/50' : (chipDot[pipeline?.color || 'zinc'] || 'bg-zinc-400');
              return (
                <button key={wf.workflowId}
                  className={`w-3 h-3 rounded-sm transition-all duration-200 hover:scale-150 hover:rounded-full ${dotColor} ${health === 'error' ? 'animate-pulse' : ''}`}
                  title={wf.workflowName}
                  onClick={() => setDetail({ type: 'workflow', workflowId: wf.workflowId })}
                />
              );
            })}
          </div>
          <div className="flex gap-3 mt-2">
            {[{ label: 'Healthy', cls: 'bg-emerald-400/60' }, { label: 'Warning', cls: 'bg-amber-400/60' }, { label: 'Error', cls: 'bg-red-400' }, { label: 'Inactive', cls: 'bg-zinc-700/50' }].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm ${l.cls}`} />
                <span className="text-[9px] text-zinc-600">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="col-span-6 lg:col-span-4 row-span-2 rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-3 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium block mb-2">Recent Activity</span>
          {logsLoading ? (
            <p className="text-xs text-zinc-600">Loading...</p>
          ) : recentLogs.length === 0 ? (
            <p className="text-xs text-zinc-600">No recent executions</p>
          ) : (
            <div className="relative pl-4">
              <div className="absolute left-[5px] top-1 bottom-1 w-px bg-gradient-to-b from-zinc-700 via-zinc-800 to-transparent" />
              {recentLogs.map((exec) => {
                const pipeline = workflowPipelineMap.get(exec.workflowId);
                return (
                  <button key={exec.executionId}
                    onClick={() => setDetail({ type: 'execution', executionId: exec.executionId })}
                    className="relative flex gap-2.5 pb-2.5 group cursor-pointer text-left w-full">
                    <div className={`relative z-10 mt-1 w-2 h-2 rounded-full shrink-0 ring-2 ring-zinc-900/80 ${
                      exec.status === 'success' ? 'bg-emerald-400' : exec.status === 'error' ? 'bg-red-400' : 'bg-amber-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-zinc-300 truncate group-hover:text-zinc-100 transition-colors">
                          {exec.workflowName || exec.workflowId}
                        </span>
                        {pipeline && (
                          <span className={`shrink-0 text-[8px] px-1 py-0.5 rounded-full ${chipBg[pipeline.color] || ''} ${chipText[pipeline.color] || 'text-zinc-400'}`}>
                            {pipeline.name.replace(' Pipeline', '').replace(' & Backups', '')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-zinc-600 tabular-nums">{timeAgo(exec.startedAt)}</span>
                        <span className="text-[10px] text-zinc-600 tabular-nums">{formatDuration(exec.durationMs)}</span>
                      </div>
                      {exec.status === 'error' && exec.errorMessage && (
                        <p className="text-[10px] text-red-400/70 mt-0.5 truncate">{exec.errorMessage}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pipeline Breakdown */}
        <div className="col-span-6 lg:col-span-3 row-span-2 rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-3">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium block mb-2">By Pipeline</span>
          <div className="space-y-2">
            {pipelineStats.map((p) => {
              const total24h = p.workflows.reduce((s, w) => s + w.totalExecutions24h, 0);
              const maxTotal = Math.max(...pipelineStats.map((pp) => pp.workflows.reduce((s, w) => s + w.totalExecutions24h, 0)), 1);
              const pct = Math.round((total24h / maxTotal) * 100);
              return (
                <button key={p.id} className="w-full text-left group" onClick={() => setDetail({ type: 'pipeline', pipelineId: p.id })}>
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-zinc-400 group-hover:text-zinc-200 transition-colors truncate">{p.name.replace(' Pipeline', '').replace(' & Backups', '')}</span>
                    <span className="text-zinc-600 tabular-nums shrink-0 ml-1">{total24h}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div className={`h-full rounded-full ${chipDot[p.color] || 'bg-zinc-400'} opacity-70`} style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Detail Panel ── */}
      {detail && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none" onClick={() => setDetail(null)} />
      )}
      <aside className={`fixed top-0 right-0 bottom-0 z-50 w-full md:w-[440px] bg-zinc-900/95 backdrop-blur-2xl border-l border-zinc-800/50 flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        detail ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {selectedPipeline && <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${chipDot[selectedPipeline.color] || 'bg-zinc-400'}`} />}
            <h2 className="text-sm font-semibold text-zinc-200 truncate">
              {selectedPipeline?.name || selectedWorkflow?.workflowName || (selectedExecution ? (selectedExecution.workflowName || `#${selectedExecution.executionId}`) : '')}
            </h2>
          </div>
          <button onClick={() => setDetail(null)} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 px-4 py-3 space-y-4">
          {selectedPipeline && (
            <PipelineDetail
              pipeline={selectedPipeline}
              expandedWorkflow={expandedWorkflow}
              setExpandedWorkflow={setExpandedWorkflow}
              expandedRepo={expandedRepo}
              setExpandedRepo={setExpandedRepo}
              acknowledgeError={acknowledgeError}
              handleSendToEngineer={handleSendToEngineer}
              sentToEngineer={sentToEngineer}
            />
          )}
          {selectedWorkflow && (
            <WorkflowDetail
              workflow={selectedWorkflow}
              pipeline={workflowPipelineMap.get(selectedWorkflow.workflowId)}
              logs={logs.filter((l) => l.workflowId === selectedWorkflow.workflowId).slice(0, 15)}
              expandedExec={expandedExec}
              setExpandedExec={setExpandedExec}
              acknowledgeError={acknowledgeError}
              handleSendToEngineer={handleSendToEngineer}
              sentToEngineer={sentToEngineer}
            />
          )}
          {selectedExecution && (
            <ExecutionDetail execution={selectedExecution} pipeline={workflowPipelineMap.get(selectedExecution.workflowId)} />
          )}
        </div>
      </aside>
    </div>
  );
};

/* ── Pipeline Detail ── */

const PipelineDetail: React.FC<{
  pipeline: PipelineStat;
  expandedWorkflow: string | null;
  setExpandedWorkflow: (id: string | null) => void;
  expandedRepo: string | null;
  setExpandedRepo: (id: string | null) => void;
  acknowledgeError: (id: string) => void;
  handleSendToEngineer: (wf: WorkflowStat) => void;
  sentToEngineer: Record<string, 'sending' | 'sent'>;
}> = ({ pipeline, expandedWorkflow, setExpandedWorkflow, expandedRepo, setExpandedRepo, acknowledgeError, handleSendToEngineer, sentToEngineer }) => {
  const sorted = [...pipeline.workflows].sort((a, b) =>
    healthPriority[getWorkflowHealth(a)] - healthPriority[getWorkflowHealth(b)]
  );

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-zinc-800/40 p-2.5 text-center">
          <p className="text-lg font-semibold tabular-nums text-zinc-200">{pipeline.workflows.length}</p>
          <p className="text-[10px] text-zinc-500">Workflows</p>
        </div>
        <div className="rounded-lg bg-zinc-800/40 p-2.5 text-center">
          <p className={`text-lg font-semibold tabular-nums ${pipeline.errors > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{pipeline.errors}</p>
          <p className="text-[10px] text-zinc-500">Errors 24h</p>
        </div>
        <div className="rounded-lg bg-zinc-800/40 p-2.5 text-center">
          <p className="text-lg font-semibold tabular-nums text-zinc-200">{pipeline.repos.length}</p>
          <p className="text-[10px] text-zinc-500">Repos</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-2">Workflows</p>
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-800/20 overflow-hidden divide-y divide-zinc-800/30">
          {sorted.length === 0 ? (
            <p className="px-3 py-4 text-xs text-zinc-600 text-center">No workflows</p>
          ) : sorted.map((wf) => {
            const health = getWorkflowHealth(wf);
            const isOpen = expandedWorkflow === wf.workflowId;
            return (
              <div key={wf.workflowId}>
                <button onClick={() => setExpandedWorkflow(isOpen ? null : wf.workflowId)}
                  className="w-full px-3 py-2.5 flex items-center gap-2.5 hover:bg-zinc-800/30 transition-colors text-left">
                  <StatusDot status={health} pulse={health === 'error'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-zinc-200 truncate">{wf.workflowName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1 py-0.5 rounded">{wf.triggerType}</span>
                      {wf.scheduleExpression && <span className="text-[10px] text-zinc-600">{wf.scheduleExpression}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-zinc-500 flex items-center gap-0.5 justify-end"><Clock className="w-2.5 h-2.5" />{timeAgo(wf.lastExecutionAt)}</p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <span className="text-[10px] text-emerald-400/80">{wf.successCount24h}</span>
                      {wf.errorCount24h > 0 && <span className="text-[10px] text-red-400">{wf.errorCount24h}e</span>}
                    </div>
                  </div>
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-600 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div><span className="text-zinc-500">Status:</span> <span className={wf.lastExecutionStatus === 'error' ? 'text-red-400' : 'text-zinc-300'}>{wf.lastExecutionStatus || '—'}</span></div>
                      <div><span className="text-zinc-500">Duration:</span> <span className="text-zinc-300">{wf.lastExecutionDurationMs ? `${(wf.lastExecutionDurationMs / 1000).toFixed(1)}s` : '—'}</span></div>
                      <div><span className="text-zinc-500">24h Total:</span> <span className="text-zinc-300">{wf.totalExecutions24h}</span></div>
                      <div><span className="text-zinc-500">Nodes:</span> <span className="text-zinc-300">{wf.nodeCount}</span></div>
                    </div>
                    {wf.lastErrorMessage && (
                      <div className="p-2 bg-red-950/30 border border-red-500/15 rounded-lg text-[11px] text-red-300/90 font-mono leading-relaxed">
                        <span className="text-red-400/50 text-[9px] font-sans block mb-0.5">{timeAgo(wf.lastExecutionAt)}</span>
                        {wf.lastErrorMessage}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <a href={`https://n8n.intelligents.agency/workflow/${wf.workflowId}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 hover:text-white hover:bg-zinc-700/60 transition-colors">
                        <ExternalLink className="w-2.5 h-2.5" /> n8n
                      </a>
                      {wf.errorCount24h > 0 && !wf.errorAcknowledged && (
                        <button onClick={() => acknowledgeError(wf.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Resolve
                        </button>
                      )}
                      {wf.errorCount24h > 0 && (
                        <button onClick={() => handleSendToEngineer(wf)} disabled={!!sentToEngineer[wf.workflowId]}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                            sentToEngineer[wf.workflowId] === 'sent' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            : sentToEngineer[wf.workflowId] === 'sending' ? 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 cursor-wait'
                            : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20'
                          }`}>
                          <Wrench className="w-2.5 h-2.5" />
                          {sentToEngineer[wf.workflowId] === 'sent' ? 'Sent' : sentToEngineer[wf.workflowId] === 'sending' ? '...' : 'Engineer'}
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

      {pipeline.repos.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-2">Repositories</p>
          <div className="space-y-1.5">
            {pipeline.repos.map((repo) => {
              const isOpen = expandedRepo === repo.name;
              const hasContents = repo.contents && repo.contents.length > 0;
              const dirs = (repo.contents || []).filter((f) => f.type === 'dir').sort((a, b) => a.name.localeCompare(b.name));
              const files = (repo.contents || []).filter((f) => f.type === 'file').sort((a, b) => a.name.localeCompare(b.name));
              return (
                <div key={repo.name} className="rounded-lg border border-zinc-800/40 bg-zinc-800/20 overflow-hidden">
                  <div className="flex items-center gap-2 p-2.5">
                    {hasContents ? (
                      <button onClick={() => setExpandedRepo(isOpen ? null : repo.name)} className="p-0.5 hover:bg-zinc-700/50 rounded transition-colors">
                        {isOpen ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
                      </button>
                    ) : <span className="w-4" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="text-[12px] text-zinc-200 font-medium truncate hover:text-blue-400 transition-colors">{repo.name}</a>
                        {repo.private && <Lock className="w-2.5 h-2.5 text-zinc-600 shrink-0" />}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {repo.language && <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${repoLangColors[repo.language] || 'bg-zinc-700/50 text-zinc-400'}`}>{repo.language}</span>}
                        <span className="text-[9px] text-zinc-600">pushed {timeAgo(repo.pushed_at)}</span>
                      </div>
                    </div>
                    <a href={repo.html_url} target="_blank" rel="noopener noreferrer" className="text-zinc-700 hover:text-blue-400 transition-colors shrink-0">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {isOpen && hasContents && (
                    <div className="border-t border-zinc-800/30 px-2.5 py-1.5 space-y-0.5">
                      {dirs.map((f) => (
                        <a key={f.path} href={`${repo.html_url}/tree/${repo.default_branch}/${f.path}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 py-0.5 text-[10px] text-zinc-300 hover:text-blue-400 transition-colors">
                          <Folder className="w-2.5 h-2.5 text-blue-400/60 shrink-0" /><span className="truncate">{f.name}/</span>
                        </a>
                      ))}
                      {files.map((f) => (
                        <a key={f.path} href={`${repo.html_url}/blob/${repo.default_branch}/${f.path}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-blue-400 transition-colors">
                          <FileText className="w-2.5 h-2.5 text-zinc-600 shrink-0" /><span className="truncate">{f.name}</span>
                          {f.size > 0 && <span className="text-[9px] text-zinc-600 ml-auto shrink-0">{formatSize(f.size)}</span>}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

/* ── Workflow Detail ── */

const WorkflowDetail: React.FC<{
  workflow: WorkflowStat;
  pipeline?: PipelineStat;
  logs: ExecutionLog[];
  expandedExec: string | null;
  setExpandedExec: (id: string | null) => void;
  acknowledgeError: (id: string) => void;
  handleSendToEngineer: (wf: WorkflowStat) => void;
  sentToEngineer: Record<string, 'sending' | 'sent'>;
}> = ({ workflow, pipeline, logs, expandedExec, setExpandedExec, acknowledgeError, handleSendToEngineer, sentToEngineer }) => {
  const health = getWorkflowHealth(workflow);
  return (
    <>
      <div className="flex items-center gap-3">
        <StatusDot status={health} pulse={health === 'error'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{workflow.triggerType}</span>
            {workflow.scheduleExpression && <span className="text-[11px] text-zinc-600">{workflow.scheduleExpression}</span>}
            <span className="text-[11px] text-zinc-600 flex items-center gap-0.5"><Hash className="w-2.5 h-2.5" />{workflow.nodeCount} nodes</span>
          </div>
        </div>
        {pipeline && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${chipBg[pipeline.color] || ''} ${chipText[pipeline.color] || 'text-zinc-400'}`}>
            {pipeline.name.replace(' Pipeline', '').replace(' & Backups', '')}
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-lg bg-zinc-800/40 p-2 text-center">
          <p className="text-sm font-semibold tabular-nums text-emerald-400">{workflow.successCount24h}</p>
          <p className="text-[9px] text-zinc-500">Success</p>
        </div>
        <div className="rounded-lg bg-zinc-800/40 p-2 text-center">
          <p className={`text-sm font-semibold tabular-nums ${workflow.errorCount24h > 0 ? 'text-red-400' : 'text-zinc-300'}`}>{workflow.errorCount24h}</p>
          <p className="text-[9px] text-zinc-500">Errors</p>
        </div>
        <div className="rounded-lg bg-zinc-800/40 p-2 text-center">
          <p className="text-sm font-semibold tabular-nums text-zinc-200">{workflow.totalExecutions24h}</p>
          <p className="text-[9px] text-zinc-500">Total 24h</p>
        </div>
        <div className="rounded-lg bg-zinc-800/40 p-2 text-center">
          <p className="text-sm font-semibold tabular-nums text-zinc-200">{workflow.lastExecutionDurationMs ? `${(workflow.lastExecutionDurationMs / 1000).toFixed(1)}s` : '—'}</p>
          <p className="text-[9px] text-zinc-500">Duration</p>
        </div>
      </div>

      {workflow.lastErrorMessage && (
        <div className="p-2.5 bg-red-950/30 border border-red-500/15 rounded-lg text-[11px] text-red-300/90 font-mono leading-relaxed">
          <span className="text-red-400/50 text-[9px] font-sans block mb-0.5">{timeAgo(workflow.lastExecutionAt)}</span>
          {workflow.lastErrorMessage}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <a href={`https://n8n.intelligents.agency/workflow/${workflow.workflowId}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 hover:text-white hover:bg-zinc-700/60 transition-colors">
          <ExternalLink className="w-3 h-3" /> Open in n8n
        </a>
        {workflow.errorCount24h > 0 && !workflow.errorAcknowledged && (
          <button onClick={() => acknowledgeError(workflow.id)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
            <CheckCircle2 className="w-3 h-3" /> Mark Resolved
          </button>
        )}
        {workflow.errorCount24h > 0 && (
          <button onClick={() => handleSendToEngineer(workflow)} disabled={!!sentToEngineer[workflow.workflowId]}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${
              sentToEngineer[workflow.workflowId] === 'sent' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
              : sentToEngineer[workflow.workflowId] === 'sending' ? 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/40 cursor-wait'
              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20'
            }`}>
            <Wrench className="w-3 h-3" />
            {sentToEngineer[workflow.workflowId] === 'sent' ? 'Sent' : sentToEngineer[workflow.workflowId] === 'sending' ? 'Sending...' : 'Send to Engineer'}
          </button>
        )}
      </div>

      {logs.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-2">Recent Executions</p>
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-800/20 overflow-hidden divide-y divide-zinc-800/30">
            {logs.map((exec) => {
              const isOpen = expandedExec === exec.executionId;
              return (
                <div key={exec.executionId}>
                  <button onClick={() => setExpandedExec(isOpen ? null : exec.executionId)}
                    className="w-full px-3 py-2 flex items-center gap-2 hover:bg-zinc-800/30 transition-colors text-left">
                    <StatusDot status={exec.status === 'error' ? 'error' : exec.status === 'success' ? 'healthy' : 'warning'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1 py-0.5 rounded font-medium ${
                          exec.status === 'success' ? 'text-emerald-400 bg-emerald-500/10' : exec.status === 'error' ? 'text-red-400 bg-red-500/10' : 'text-amber-400 bg-amber-500/10'
                        }`}>{exec.status}</span>
                        {exec.mode && <span className="text-[9px] text-zinc-600">{exec.mode}</span>}
                      </div>
                      {exec.status === 'error' && exec.errorMessage && (
                        <p className="text-[10px] text-red-400/70 mt-0.5 truncate">{exec.errorNode ? `[${exec.errorNode}] ` : ''}{exec.errorMessage}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-zinc-500">{timeAgo(exec.startedAt)}</p>
                      <p className="text-[9px] text-zinc-600">{formatDuration(exec.durationMs)}</p>
                    </div>
                    {isOpen ? <ChevronDown className="w-3 h-3 text-zinc-600" /> : <ChevronRight className="w-3 h-3 text-zinc-600" />}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-2.5 space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div><span className="text-zinc-500">Started:</span> <span className="text-zinc-300">{new Date(exec.startedAt).toLocaleString()}</span></div>
                        <div><span className="text-zinc-500">Duration:</span> <span className="text-zinc-300">{formatDuration(exec.durationMs)}</span></div>
                        <div><span className="text-zinc-500">Last Node:</span> <span className="text-zinc-300">{exec.lastNodeExecuted || '—'}</span></div>
                        <div><span className="text-zinc-500">ID:</span> <span className="text-zinc-300 font-mono text-[10px]">#{exec.executionId}</span></div>
                      </div>
                      {exec.errorMessage && (
                        <div className="p-2 bg-red-950/30 border border-red-500/15 rounded-lg text-[11px] text-red-300/90 font-mono leading-relaxed break-words">
                          {exec.errorNode && <span className="text-red-400/70 font-semibold">[{exec.errorNode}] </span>}
                          {exec.errorMessage}
                        </div>
                      )}
                      <a href={`https://n8n.intelligents.agency/workflow/${exec.workflowId}/executions/${exec.executionId}`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 hover:text-white hover:bg-zinc-700/60 transition-colors">
                        <ExternalLink className="w-2.5 h-2.5" /> Open in n8n
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
};

/* ── Execution Detail ── */

const ExecutionDetail: React.FC<{ execution: ExecutionLog; pipeline?: PipelineStat }> = ({ execution, pipeline }) => {
  const statusColors: Record<string, string> = {
    success: 'text-emerald-400 bg-emerald-500/10', error: 'text-red-400 bg-red-500/10', waiting: 'text-amber-400 bg-amber-500/10',
  };
  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusColors[execution.status] || 'text-zinc-400 bg-zinc-800/60'}`}>{execution.status}</span>
        {pipeline && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${chipBg[pipeline.color] || ''} ${chipText[pipeline.color] || 'text-zinc-400'}`}>{pipeline.name.replace(' Pipeline', '').replace(' & Backups', '')}</span>}
        {execution.mode && <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{execution.mode}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div><span className="text-zinc-500">Started:</span><br /><span className="text-zinc-300">{new Date(execution.startedAt).toLocaleString()}</span></div>
        {execution.finishedAt && <div><span className="text-zinc-500">Finished:</span><br /><span className="text-zinc-300">{new Date(execution.finishedAt).toLocaleString()}</span></div>}
        <div><span className="text-zinc-500">Duration:</span><br /><span className="text-zinc-300">{formatDuration(execution.durationMs)}</span></div>
        <div><span className="text-zinc-500">Execution ID:</span><br /><span className="text-zinc-300 font-mono">#{execution.executionId}</span></div>
        <div><span className="text-zinc-500">Last Node:</span><br /><span className="text-zinc-300">{execution.lastNodeExecuted || '—'}</span></div>
        {execution.retryOf && <div><span className="text-zinc-500">Retry of:</span><br /><span className="text-zinc-300 font-mono">#{execution.retryOf}</span></div>}
      </div>

      {execution.errorMessage && (
        <div className="p-2.5 bg-red-950/30 border border-red-500/15 rounded-lg text-[11px] text-red-300/90 font-mono leading-relaxed break-words">
          {execution.errorNode && <span className="text-red-400/70 font-semibold">[{execution.errorNode}] </span>}
          {execution.errorMessage}
        </div>
      )}

      {execution.nodesExecuted && execution.nodesExecuted.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1.5">Nodes Executed ({execution.nodesExecuted.length})</p>
          <div className="flex flex-wrap gap-1">
            {execution.nodesExecuted.map((node, i) => (
              <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${node === execution.errorNode ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-zinc-800/60 text-zinc-400'}`}>{node}</span>
            ))}
          </div>
        </div>
      )}

      <a href={`https://n8n.intelligents.agency/workflow/${execution.workflowId}/executions/${execution.executionId}`}
        target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 hover:text-white hover:bg-zinc-700/60 transition-colors">
        <ExternalLink className="w-3 h-3" /> Open in n8n
      </a>
    </>
  );
};

export default WorkflowsPanel;
