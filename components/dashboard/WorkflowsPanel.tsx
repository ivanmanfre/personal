import React, { useState, useMemo } from 'react';
import { Activity, ChevronDown, ChevronRight, Search, CheckCircle2, XCircle, AlertTriangle, ExternalLink, List, ArrowUpDown, Clock, Hash, ScrollText, ChevronLeft, Filter } from 'lucide-react';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useExecutionLogs } from '../../hooks/useExecutionLogs';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import { timeAgo } from './shared/utils';
import type { WorkflowStat, ExecutionLog } from '../../types/dashboard';
import type { StatusFilter, ExecSortKey } from '../../hooks/useExecutionLogs';

type Group = 'all' | 'issues' | 'schedule' | 'event' | 'webhook' | 'sub-workflow' | 'manual';
type View = 'list' | 'logs';
type SortKey = 'health' | 'name' | 'lastRun' | 'errors';

function getWorkflowHealth(wf: WorkflowStat): 'healthy' | 'warning' | 'error' | 'inactive' {
  if (!wf.isActive) return 'inactive';
  if (wf.errorAcknowledged) return 'healthy';
  if (wf.lastExecutionStatus === 'error' || wf.errorCount24h > 3) return 'error';
  if (wf.errorCount24h > 0) return 'warning';
  return 'healthy';
}

const healthPriority: Record<string, number> = { error: 0, warning: 1, healthy: 2, inactive: 3 };

/* Pipeline definitions moved to system-map/config.ts */

/* ── Component ── */

const WorkflowsPanel: React.FC = () => {
  const { workflows, stats, loading, refresh, acknowledgeError } = useWorkflowStats();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['dashboard_workflow_stats'] });
  const [view, setView] = useState<View>('list');
  const [group, setGroup] = useState<Group>('all');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('health');

  // Health counts for the summary bar
  const healthCounts = useMemo(() => {
    const counts = { healthy: 0, warning: 0, error: 0, inactive: 0 };
    workflows.forEach((wf) => { counts[getWorkflowHealth(wf)]++; });
    return counts;
  }, [workflows]);

  if (loading) return <LoadingSkeleton cards={4} rows={8} />;

  const groups: { id: Group; label: string; count?: number }[] = [
    { id: 'all', label: 'All' },
    { id: 'issues', label: 'Issues', count: healthCounts.error + healthCounts.warning },
    { id: 'schedule', label: 'Scheduled' },
    { id: 'event', label: 'Events' },
    { id: 'webhook', label: 'Webhooks' },
    { id: 'sub-workflow', label: 'Sub-wf' },
    { id: 'manual', label: 'Manual' },
  ];

  let filtered = workflows;
  if (group === 'issues') {
    filtered = filtered.filter((wf) => {
      const h = getWorkflowHealth(wf);
      return h === 'error' || h === 'warning';
    });
  } else if (group !== 'all') {
    filtered = filtered.filter((w) => w.triggerType === group);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((w) => w.workflowName.toLowerCase().includes(q));
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortKey) {
      case 'health':
        return healthPriority[getWorkflowHealth(a)] - healthPriority[getWorkflowHealth(b)];
      case 'errors':
        return b.errorCount24h - a.errorCount24h;
      case 'name':
        return a.workflowName.localeCompare(b.workflowName);
      case 'lastRun':
        return new Date(b.lastExecutionAt || 0).getTime() - new Date(a.lastExecutionAt || 0).getTime();
      default:
        return 0;
    }
  });

  const successRate = (stats.totalSuccess24h + stats.totalErrors24h) > 0
    ? ((stats.totalSuccess24h / (stats.totalSuccess24h + stats.totalErrors24h)) * 100).toFixed(1)
    : '100';

  const total = workflows.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Workflows</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-800/60 rounded-lg p-0.5">
            <button
              onClick={() => setView('list')}
              className={`p-1.5 rounded-md transition-colors ${view === 'list' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView('logs')}
              className={`p-1.5 rounded-md transition-colors ${view === 'logs' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Execution logs"
            >
              <ScrollText className="w-4 h-4" />
            </button>
          </div>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Workflows" value={stats.total} icon={<Activity className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Active" value={stats.active} icon={<CheckCircle2 className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Errors (24h)" value={stats.totalErrors24h} icon={<XCircle className="w-5 h-5" />} color={stats.totalErrors24h > 0 ? 'text-red-400' : 'text-zinc-500'} />
        <StatCard label="Success Rate" value={`${successRate}%`} icon={<AlertTriangle className="w-5 h-5" />} color="text-violet-400" />
      </div>

      {/* Health summary bar */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-3">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">System Health</span>
          <div className="flex items-center gap-3 ml-auto text-[11px]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-zinc-400">{healthCounts.healthy} healthy</span></span>
            {healthCounts.warning > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-amber-400">{healthCounts.warning} warning</span></span>}
            {healthCounts.error > 0 && <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /><span className="text-red-400">{healthCounts.error} error</span></span>}
          </div>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-zinc-800 gap-px">
          {healthCounts.error > 0 && <div className="bg-red-500 rounded-full" style={{ width: `${(healthCounts.error / total) * 100}%` }} />}
          {healthCounts.warning > 0 && <div className="bg-amber-500 rounded-full" style={{ width: `${(healthCounts.warning / total) * 100}%` }} />}
          {healthCounts.healthy > 0 && <div className="bg-emerald-500 rounded-full" style={{ width: `${(healthCounts.healthy / total) * 100}%` }} />}
          {healthCounts.inactive > 0 && <div className="bg-zinc-600 rounded-full" style={{ width: `${(healthCounts.inactive / total) * 100}%` }} />}
        </div>
      </div>

      {view === 'logs' ? (
        <ExecutionLogsView workflows={workflows} />
      ) : (
        <>
          {/* Filters + Sort */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1 flex-wrap">
              {groups.map((g) => (
                <button key={g.id} onClick={() => setGroup(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                    group === g.id
                      ? g.id === 'issues'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                        : 'bg-zinc-700 text-white'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                  }`}>
                  {g.label}{g.count != null ? ` (${g.count})` : ''}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search workflows..."
                className="w-full pl-9 pr-3 py-2 bg-zinc-900/80 border border-zinc-800/80 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors" />
            </div>
            {/* Sort dropdown */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-600" />
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="bg-zinc-900/80 border border-zinc-800/80 rounded-lg text-xs text-zinc-400 py-1.5 px-2 focus:outline-none focus:border-zinc-600 appearance-none cursor-pointer"
              >
                <option value="health">Health</option>
                <option value="errors">Errors</option>
                <option value="lastRun">Last Run</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          {/* Workflow list */}
          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
            <div className="divide-y divide-zinc-800/40">
              {sorted.length === 0 ? (
                <p className="px-4 py-10 text-zinc-600 text-sm text-center">No workflows found</p>
              ) : (
                sorted.map((wf) => {
                  const health = getWorkflowHealth(wf);
                  const isExpanded = expanded === wf.workflowId;
                  return (
                    <div key={wf.workflowId}>
                      <button onClick={() => setExpanded(isExpanded ? null : wf.workflowId)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors text-left">
                        <StatusDot status={health} pulse={health === 'error'} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200 truncate" title={wf.workflowName}>{wf.workflowName}</p>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{wf.triggerType}</span>
                            {wf.scheduleExpression && <span className="text-[11px] text-zinc-600">{wf.scheduleExpression}</span>}
                            <span className="text-[11px] text-zinc-600 flex items-center gap-0.5"><Hash className="w-2.5 h-2.5" />{wf.nodeCount}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-[11px] text-zinc-500 flex items-center gap-1 justify-end">
                              <Clock className="w-3 h-3" />{timeAgo(wf.lastExecutionAt)}
                            </p>
                            <div className="flex items-center gap-1.5 justify-end mt-0.5">
                              <span className="flex items-center gap-0.5 text-[11px] text-emerald-400/80">
                                <CheckCircle2 className="w-3 h-3" />{wf.successCount24h}
                              </span>
                              {wf.errorCount24h > 0 && (
                                <span className="flex items-center gap-0.5 text-[11px] text-red-400">
                                  <XCircle className="w-3 h-3" />{wf.errorCount24h}
                                </span>
                              )}
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
                            <div><span className="text-zinc-500">Status:</span> <span className={`ml-1 ${wf.lastExecutionStatus === 'error' ? 'text-red-400' : 'text-zinc-300'}`}>{wf.lastExecutionStatus || '—'}</span></div>
                            <div><span className="text-zinc-500">Duration:</span> <span className="text-zinc-300 ml-1">{wf.lastExecutionDurationMs ? `${(wf.lastExecutionDurationMs / 1000).toFixed(1)}s` : '—'}</span></div>
                            <div><span className="text-zinc-500">24h Total:</span> <span className="text-zinc-300 ml-1">{wf.totalExecutions24h}</span></div>
                            <div><span className="text-zinc-500">ID:</span> <span className="text-zinc-300 ml-1 font-mono text-[11px]">{wf.workflowId}</span></div>
                          </div>
                          {wf.lastErrorMessage && (
                            <div className="p-2.5 bg-red-950/30 border border-red-500/15 rounded-lg text-xs text-red-300/90 font-mono leading-relaxed">
                              <span className="text-red-400/50 text-[10px] font-sans block mb-1">{timeAgo(wf.lastExecutionAt)}</span>
                              {wf.lastErrorMessage}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://n8n.intelligents.agency/workflow/${wf.workflowId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 hover:text-white hover:bg-zinc-700/60 transition-colors"
                            >
                              <ExternalLink className="w-3 h-3" /> Open in n8n
                            </a>
                            {wf.errorCount24h > 0 && !wf.errorAcknowledged && (
                              <button
                                onClick={() => acknowledgeError(wf.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Mark Resolved
                              </button>
                            )}
                            {wf.errorAcknowledged && (
                              <span className="text-[11px] text-zinc-500 italic">Acknowledged</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ── Execution Logs View ── */

const ExecutionLogsView: React.FC<{ workflows: WorkflowStat[] }> = ({ workflows }) => {
  const { logs, loading, refresh, filters, updateFilter, page, setPage, stats, workflowNames } = useExecutionLogs();
  const [expandedExec, setExpandedExec] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Build workflow dropdown from all known workflows (not just current page)
  const allWorkflows = useMemo(() => {
    const map = new Map<string, string>();
    workflows.forEach((w) => map.set(w.workflowId, w.workflowName));
    workflowNames.forEach(([id, name]) => map.set(id, name));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [workflows, workflowNames]);

  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'success', label: 'Success' },
    { id: 'error', label: 'Errors' },
    { id: 'waiting', label: 'Waiting' },
  ];

  const statusColors: Record<string, string> = {
    success: 'text-emerald-400 bg-emerald-500/10',
    error: 'text-red-400 bg-red-500/10',
    waiting: 'text-amber-400 bg-amber-500/10',
    canceled: 'text-zinc-400 bg-zinc-500/10',
    unknown: 'text-zinc-500 bg-zinc-800/60',
  };

  const formatDuration = (ms: number | null) => {
    if (ms == null) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-4">
      {/* Search + filter toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search errors, workflow names, nodes..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-900/80 border border-zinc-800/80 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${showFilters ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20' : 'text-zinc-500 hover:text-zinc-300 bg-zinc-900/80 border border-zinc-800/80'}`}
        >
          <Filter className="w-3.5 h-3.5" /> Filters
        </button>
        <button onClick={refresh} className="px-3 py-2 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-300 bg-zinc-900/80 border border-zinc-800/80 transition-colors">
          Refresh
        </button>
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Status */}
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Status</label>
              <div className="flex gap-1 flex-wrap">
                {statusFilters.map((sf) => (
                  <button key={sf.id} onClick={() => updateFilter('status', sf.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors ${filters.status === sf.id ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}>
                    {sf.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Workflow */}
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">Workflow</label>
              <select
                value={filters.workflowId}
                onChange={(e) => updateFilter('workflowId', e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-xs text-zinc-300 py-1.5 px-2 focus:outline-none focus:border-zinc-600"
              >
                <option value="">All workflows</option>
                {allWorkflows.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">From</label>
              <input type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-xs text-zinc-300 py-1.5 px-2 focus:outline-none focus:border-zinc-600" />
            </div>
            <div>
              <label className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-1.5">To</label>
              <input type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)}
                className="w-full bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-xs text-zinc-300 py-1.5 px-2 focus:outline-none focus:border-zinc-600" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-600" />
              <select
                value={filters.sort}
                onChange={(e) => updateFilter('sort', e.target.value as ExecSortKey)}
                className="bg-zinc-800/60 border border-zinc-700/40 rounded-lg text-xs text-zinc-400 py-1.5 px-2 focus:outline-none focus:border-zinc-600"
              >
                <option value="date">Most Recent</option>
                <option value="duration">Slowest First</option>
              </select>
            </div>
            {(filters.status !== 'all' || filters.workflowId || filters.search || filters.dateFrom || filters.dateTo) && (
              <button
                onClick={() => {
                  updateFilter('status', 'all');
                  updateFilter('workflowId', '');
                  updateFilter('search', '');
                  updateFilter('dateFrom', '');
                  updateFilter('dateTo', '');
                }}
                className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear all filters
              </button>
            )}
            <span className="ml-auto text-[11px] text-zinc-500">
              {stats.total.toLocaleString()} execution{stats.total !== 1 ? 's' : ''} found
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-zinc-600 text-sm">Loading executions...</div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <ScrollText className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No executions found</p>
            <p className="text-[11px] text-zinc-600 mt-1">
              {stats.total === 0 ? 'Waiting for sync workflow to populate data...' : 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {logs.map((exec) => {
              const isExpanded = expandedExec === exec.executionId;
              const colors = statusColors[exec.status] || statusColors.unknown;
              return (
                <div key={exec.executionId}>
                  <button
                    onClick={() => setExpandedExec(isExpanded ? null : exec.executionId)}
                    className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors text-left"
                  >
                    <StatusDot status={exec.status === 'error' ? 'error' : exec.status === 'waiting' ? 'warning' : exec.status === 'success' ? 'healthy' : 'inactive'} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-zinc-200 truncate" title={exec.workflowName || exec.workflowId}>
                          {exec.workflowName || exec.workflowId}
                        </p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${colors}`}>
                          {exec.status}
                        </span>
                        {exec.mode && (
                          <span className="text-[10px] text-zinc-600 bg-zinc-800/60 px-1 py-0.5 rounded hidden sm:inline">
                            {exec.mode}
                          </span>
                        )}
                      </div>
                      {exec.status === 'error' && exec.errorMessage && (
                        <p className="text-[11px] text-red-400/70 mt-0.5 truncate" title={exec.errorMessage}>
                          {exec.errorNode ? `[${exec.errorNode}] ` : ''}{exec.errorMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-[11px] text-zinc-500">{timeAgo(exec.startedAt)}</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{formatDuration(exec.durationMs)}</p>
                      </div>
                      <span className="text-[11px] text-zinc-600 font-mono">#{exec.executionId}</span>
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-600" /> : <ChevronRight className="w-4 h-4 text-zinc-600" />}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 pl-9 space-y-2">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div><span className="text-zinc-500">Started:</span> <span className="text-zinc-300 ml-1">{new Date(exec.startedAt).toLocaleString()}</span></div>
                        <div><span className="text-zinc-500">Duration:</span> <span className="text-zinc-300 ml-1">{formatDuration(exec.durationMs)}</span></div>
                        <div><span className="text-zinc-500">Mode:</span> <span className="text-zinc-300 ml-1">{exec.mode || '—'}</span></div>
                        <div><span className="text-zinc-500">Last Node:</span> <span className="text-zinc-300 ml-1">{exec.lastNodeExecuted || '—'}</span></div>
                      </div>
                      {exec.errorMessage && (
                        <div className="p-2.5 bg-red-950/30 border border-red-500/15 rounded-lg text-xs text-red-300/90 font-mono leading-relaxed break-words">
                          {exec.errorNode && <span className="text-red-400/70 font-semibold">[{exec.errorNode}] </span>}
                          {exec.errorMessage}
                        </div>
                      )}
                      {exec.nodesExecuted && exec.nodesExecuted.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          <span className="text-[11px] text-zinc-500 mr-1">Nodes:</span>
                          {exec.nodesExecuted.map((node, i) => (
                            <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${node === exec.errorNode ? 'bg-red-500/15 text-red-400 border border-red-500/20' : 'bg-zinc-800/60 text-zinc-400'}`}>
                              {node}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <a
                          href={`https://n8n.intelligents.agency/workflow/${exec.workflowId}/executions/${exec.executionId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 bg-zinc-800/60 border border-zinc-700/40 hover:text-white hover:bg-zinc-700/60 transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" /> Open in n8n
                        </a>
                        {exec.retryOf && (
                          <span className="text-[11px] text-zinc-500">Retry of #{exec.retryOf}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {stats.pages > 1 && (
          <div className="border-t border-zinc-800/50 px-4 py-2.5 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white disabled:text-zinc-700 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Previous
            </button>
            <span className="text-[11px] text-zinc-500">
              Page {page + 1} of {stats.pages}
            </span>
            <button
              onClick={() => setPage(Math.min(stats.pages - 1, page + 1))}
              disabled={page >= stats.pages - 1}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white disabled:text-zinc-700 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowsPanel;
