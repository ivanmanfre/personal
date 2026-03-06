import React, { useState } from 'react';
import { Activity, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import type { WorkflowStat } from '../../types/dashboard';

type Group = 'all' | 'schedule' | 'event' | 'webhook' | 'sub-workflow' | 'manual';

function getWorkflowHealth(wf: WorkflowStat): 'healthy' | 'warning' | 'error' | 'inactive' {
  if (!wf.isActive) return 'inactive';
  if (wf.lastExecutionStatus === 'error' || wf.errorCount24h > 3) return 'error';
  if (wf.errorCount24h > 0) return 'warning';
  return 'healthy';
}

function timeAgo(ts: string | null): string {
  if (!ts) return 'never';
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
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
    { id: 'sub-workflow', label: 'Sub-workflows' },
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
        <h1 className="text-2xl font-bold">Workflows</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Workflows" value={stats.total} icon={<Activity className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Active" value={stats.active} icon={<span className="text-sm">🟢</span>} color="text-emerald-400" />
        <StatCard label="Errors (24h)" value={stats.totalErrors24h} icon={<span className="text-sm">🔴</span>} color={stats.totalErrors24h > 0 ? 'text-red-400' : 'text-zinc-400'} />
        <StatCard label="Success Rate" value={`${successRate}%`} icon={<span className="text-sm">📊</span>} color="text-violet-400" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {groups.map((g) => (
            <button key={g.id} onClick={() => setGroup(g.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${group === g.id ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'}`}>
              {g.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workflows..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600" />
        </div>
      </div>

      {/* Workflow list */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="divide-y divide-zinc-800">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-zinc-500 text-sm text-center">No workflows found</p>
          ) : (
            filtered.map((wf) => {
              const health = getWorkflowHealth(wf);
              const isExpanded = expanded === wf.workflowId;
              return (
                <div key={wf.workflowId}>
                  <button onClick={() => setExpanded(isExpanded ? null : wf.workflowId)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/50 transition-colors text-left">
                    <StatusDot status={health} pulse={health === 'error'} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">{wf.workflowName}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-zinc-500">
                        <span>{wf.triggerType}</span>
                        {wf.scheduleExpression && <span>· {wf.scheduleExpression}</span>}
                        <span>· {wf.nodeCount} nodes</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-xs">
                      <div className="text-right hidden sm:block">
                        <p className="text-zinc-400">Last run: {timeAgo(wf.lastExecutionAt)}</p>
                        <p className="text-zinc-500">
                          {wf.successCount24h}✓ {wf.errorCount24h > 0 ? <span className="text-red-400">{wf.errorCount24h}✗</span> : `${wf.errorCount24h}✗`}
                        </p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${wf.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'}`}>
                        {wf.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 pl-9 space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div><span className="text-zinc-500">Status:</span> <span className="text-zinc-300 ml-1">{wf.lastExecutionStatus || '—'}</span></div>
                        <div><span className="text-zinc-500">Duration:</span> <span className="text-zinc-300 ml-1">{wf.lastExecutionDurationMs ? `${(wf.lastExecutionDurationMs / 1000).toFixed(1)}s` : '—'}</span></div>
                        <div><span className="text-zinc-500">24h Total:</span> <span className="text-zinc-300 ml-1">{wf.totalExecutions24h}</span></div>
                        <div><span className="text-zinc-500">ID:</span> <span className="text-zinc-300 ml-1 font-mono">{wf.workflowId}</span></div>
                      </div>
                      {wf.lastErrorMessage && (
                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300">
                          {wf.lastErrorMessage}
                        </div>
                      )}
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
