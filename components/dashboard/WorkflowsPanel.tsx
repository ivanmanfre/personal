import React, { useState } from 'react';
import { Activity, ChevronDown, ChevronRight, Search, CheckCircle2, XCircle, AlertTriangle, ExternalLink } from 'lucide-react';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import { timeAgo } from './shared/utils';
import type { WorkflowStat } from '../../types/dashboard';

type Group = 'all' | 'schedule' | 'event' | 'webhook' | 'sub-workflow' | 'manual';

function getWorkflowHealth(wf: WorkflowStat): 'healthy' | 'warning' | 'error' | 'inactive' {
  if (!wf.isActive) return 'inactive';
  if (wf.lastExecutionStatus === 'error' || wf.errorCount24h > 3) return 'error';
  if (wf.errorCount24h > 0) return 'warning';
  return 'healthy';
}

const WorkflowsPanel: React.FC = () => {
  const { workflows, stats, loading, refresh } = useWorkflowStats();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_workflow_stats'] });
  const [group, setGroup] = useState<Group>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  if (loading) return <LoadingSkeleton cards={4} rows={8} />;

  const groups: { id: Group; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'schedule', label: 'Scheduled' },
    { id: 'event', label: 'Events' },
    { id: 'webhook', label: 'Webhooks' },
    { id: 'sub-workflow', label: 'Sub-wf' },
    { id: 'manual', label: 'Manual' },
  ];

  let filtered = group === 'all' ? workflows : workflows.filter((w) => w.triggerType === group);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((w) => w.workflowName.toLowerCase().includes(q));
  }

  const successRate = (stats.totalSuccess24h + stats.totalErrors24h) > 0
    ? ((stats.totalSuccess24h / (stats.totalSuccess24h + stats.totalErrors24h)) * 100).toFixed(1)
    : '100';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Workflows" value={stats.total} icon={<Activity className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Active" value={stats.active} icon={<CheckCircle2 className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Errors (24h)" value={stats.totalErrors24h} icon={<XCircle className="w-5 h-5" />} color={stats.totalErrors24h > 0 ? 'text-red-400' : 'text-zinc-500'} />
        <StatCard label="Success Rate" value={`${successRate}%`} icon={<AlertTriangle className="w-5 h-5" />} color="text-violet-400" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {groups.map((g) => (
            <button key={g.id} onClick={() => setGroup(g.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${group === g.id ? 'bg-zinc-700/80 text-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workflows..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-900/80 border border-zinc-800/80 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors" />
        </div>
      </div>

      {/* Workflow list */}
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
        <div className="divide-y divide-zinc-800/50">
          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-zinc-600 text-sm text-center">No workflows found</p>
          ) : (
            filtered.map((wf) => {
              const health = getWorkflowHealth(wf);
              const isExpanded = expanded === wf.workflowId;
              return (
                <div key={wf.workflowId}>
                  <button onClick={() => setExpanded(isExpanded ? null : wf.workflowId)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors text-left">
                    <StatusDot status={health} pulse={health === 'error'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{wf.workflowName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{wf.triggerType}</span>
                        {wf.scheduleExpression && <span className="text-[11px] text-zinc-600">{wf.scheduleExpression}</span>}
                        <span className="text-[11px] text-zinc-600">{wf.nodeCount} nodes</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-[11px] text-zinc-500">Last: {timeAgo(wf.lastExecutionAt)}</p>
                        <div className="flex items-center gap-1.5 justify-end mt-0.5">
                          <span className="flex items-center gap-0.5 text-[11px] text-emerald-400/80">
                            <CheckCircle2 className="w-3 h-3" />{wf.successCount24h}
                          </span>
                          <span className={`flex items-center gap-0.5 text-[11px] ${wf.errorCount24h > 0 ? 'text-red-400' : 'text-zinc-600'}`}>
                            <XCircle className="w-3 h-3" />{wf.errorCount24h}
                          </span>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${wf.isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'}`}>
                        {wf.isActive ? 'Active' : 'Off'}
                      </span>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-600" /> : <ChevronRight className="w-4 h-4 text-zinc-600" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 pl-9 space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div><span className="text-zinc-500">Status:</span> <span className="text-zinc-300 ml-1">{wf.lastExecutionStatus || '—'}</span></div>
                        <div><span className="text-zinc-500">Duration:</span> <span className="text-zinc-300 ml-1">{wf.lastExecutionDurationMs ? `${(wf.lastExecutionDurationMs / 1000).toFixed(1)}s` : '—'}</span></div>
                        <div><span className="text-zinc-500">24h Total:</span> <span className="text-zinc-300 ml-1">{wf.totalExecutions24h}</span></div>
                        <div><span className="text-zinc-500">ID:</span> <span className="text-zinc-300 ml-1 font-mono text-[11px]">{wf.workflowId}</span></div>
                      </div>
                      {wf.lastErrorMessage && (
                        <div className="p-2.5 bg-red-950/30 border border-red-500/15 rounded-lg text-xs text-red-300/90 font-mono leading-relaxed">
                          {wf.lastErrorMessage}
                        </div>
                      )}
                      <a
                        href={`https://n8n.intelligents.agency/workflow/${wf.workflowId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 hover:text-white hover:bg-zinc-700/60 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> Open in n8n
                      </a>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkflowsPanel;
