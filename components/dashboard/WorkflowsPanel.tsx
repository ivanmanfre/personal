import React, { useState, useMemo } from 'react';
import { Activity, ChevronDown, ChevronRight, Search, CheckCircle2, XCircle, AlertTriangle, ExternalLink, List, LayoutGrid, ArrowUpDown, Clock, Hash } from 'lucide-react';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import { timeAgo } from './shared/utils';
import type { WorkflowStat } from '../../types/dashboard';

type Group = 'all' | 'issues' | 'schedule' | 'event' | 'webhook' | 'sub-workflow' | 'manual';
type View = 'list' | 'map';
type SortKey = 'health' | 'name' | 'lastRun' | 'errors';

function getWorkflowHealth(wf: WorkflowStat): 'healthy' | 'warning' | 'error' | 'inactive' {
  if (!wf.isActive) return 'inactive';
  if (wf.errorAcknowledged) return 'healthy';
  if (wf.lastExecutionStatus === 'error' || wf.errorCount24h > 3) return 'error';
  if (wf.errorCount24h > 0) return 'warning';
  return 'healthy';
}

const healthPriority: Record<string, number> = { error: 0, warning: 1, healthy: 2, inactive: 3 };

/* ── Pipeline definitions for dependency map ── */

interface PipelineGroup {
  name: string;
  color: string;
  borderColor: string;
  workflows: string[];
}

const pipelineGroups: PipelineGroup[] = [
  {
    name: 'Content Pipeline',
    color: 'bg-blue-500/10 border-blue-500/25',
    borderColor: 'border-blue-500/40',
    workflows: [
      'Editorial Agent', 'Post Generation', 'Carousel Generation', 'Carousel Slide Re-gen',
      'Post Ready', 'Own Post Performance', 'Content Manager Agent', 'Execute Content Plan',
      'Weekly Topic Research',
    ],
  },
  {
    name: 'Competitor Intel',
    color: 'bg-purple-500/10 border-purple-500/25',
    borderColor: 'border-purple-500/40',
    workflows: [
      'Competitors Scraping', 'Extract Patterns', 'Competitor Alert Monitor',
    ],
  },
  {
    name: 'Lead Pipeline',
    color: 'bg-emerald-500/10 border-emerald-500/25',
    borderColor: 'border-emerald-500/40',
    workflows: [
      'Lead Pipeline', 'Leadshark', 'Email Outreach', 'Email Personalization',
      'Lead Magnets',
    ],
  },
  {
    name: 'Agent System',
    color: 'bg-cyan-500/10 border-cyan-500/25',
    borderColor: 'border-cyan-500/40',
    workflows: [
      'n8nClaw', 'Reminder Scheduler', 'Daily Conversation Summarizer',
      'Proactive Notifications', 'Daily Standup', 'Daily Night Brief',
    ],
  },
  {
    name: 'Client Operations',
    color: 'bg-orange-500/10 border-orange-500/25',
    borderColor: 'border-orange-500/40',
    workflows: [
      'Client Health Monitor', 'Error Handler', 'CLIENT BACKUPS', 'Connect Client Calendar',
      'Call Transcription',
    ],
  },
  {
    name: 'Upwork',
    color: 'bg-green-500/10 border-green-500/25',
    borderColor: 'border-green-500/40',
    workflows: [
      'Upwork Job Assessor', 'Upwork Invite Handler', 'Upwork Cookies', 'Zenfl',
    ],
  },
  {
    name: 'Proposals',
    color: 'bg-amber-500/10 border-amber-500/25',
    borderColor: 'border-amber-500/40',
    workflows: [
      'Proposal Generator', 'Proposal Comment', 'Send Proposal', 'Portfolio Embeddings',
    ],
  },
  {
    name: 'System & Backups',
    color: 'bg-zinc-500/10 border-zinc-500/25',
    borderColor: 'border-zinc-500/40',
    workflows: [
      'Dashboard Data Sync', 'Supabase Schema Backup', 'ClickUp Prompts Backup',
      'Slack Channel Notifier', 'Backup Health Check', 'GITHUB BACKUPS',
      'Apple Health Sync',
    ],
  },
];

function matchWorkflow(wf: WorkflowStat, patterns: string[]): boolean {
  const name = wf.workflowName.toLowerCase();
  return patterns.some((p) => name.includes(p.toLowerCase()));
}

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
              onClick={() => setView('map')}
              className={`p-1.5 rounded-md transition-colors ${view === 'map' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Pipeline map"
            >
              <LayoutGrid className="w-4 h-4" />
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
      <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-3">
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

      {view === 'list' ? (
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
                        : 'bg-zinc-700/80 text-white'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
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
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
            <div className="divide-y divide-zinc-800/50">
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
      ) : (
        <DependencyMap workflows={workflows} />
      )}
    </div>
  );
};

/* ── Pipeline Map View ── */

const DependencyMap: React.FC<{ workflows: WorkflowStat[] }> = ({ workflows }) => {
  const grouped = pipelineGroups.map((pg) => {
    const matched = workflows.filter((wf) => matchWorkflow(wf, pg.workflows));
    return { ...pg, matched };
  });

  const assigned = new Set(grouped.flatMap((g) => g.matched.map((w) => w.workflowId)));
  const ungrouped = workflows.filter((wf) => !assigned.has(wf.workflowId));

  return (
    <div className="space-y-4">
      <p className="text-xs text-zinc-500">Workflows grouped by pipeline. Health dot shows 24h status. Click to open in n8n.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {grouped.map((pg) => {
          if (pg.matched.length === 0) return null;
          const errors = pg.matched.reduce((sum, w) => sum + w.errorCount24h, 0);
          const hasErrors = errors > 0;
          const allHealthy = pg.matched.every((wf) => getWorkflowHealth(wf) === 'healthy');
          return (
            <div key={pg.name} className={`rounded-xl border p-4 space-y-3 ${pg.color}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusDot status={hasErrors ? 'error' : allHealthy ? 'healthy' : 'warning'} />
                  <h3 className="text-sm font-semibold text-zinc-200">{pg.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-400">{pg.matched.length} workflows</span>
                  {hasErrors && (
                    <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                      {errors} errors
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {pg.matched.map((wf) => {
                  const health = getWorkflowHealth(wf);
                  return (
                    <a
                      key={wf.workflowId}
                      href={`https://n8n.intelligents.agency/workflow/${wf.workflowId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-900/60 border border-zinc-700/40 hover:bg-zinc-800/80 transition-colors group"
                      title={`${wf.workflowName} — ${wf.triggerType} — ${wf.successCount24h} ok / ${wf.errorCount24h} err (24h)`}
                    >
                      <StatusDot status={health} pulse={health === 'error'} />
                      <span className="text-zinc-300 group-hover:text-white truncate flex-1">
                        {wf.workflowName.replace(/^\[.*?\]\s*/, '')}
                      </span>
                      <span className="text-[9px] text-zinc-600 shrink-0">{wf.triggerType}</span>
                      {wf.errorCount24h > 0 && (
                        <span className="text-[9px] text-red-400 shrink-0">{wf.errorCount24h}err</span>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}

        {ungrouped.length > 0 && (
          <div className="rounded-xl border bg-zinc-800/10 border-zinc-700/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-400">Other</h3>
              <span className="text-[10px] text-zinc-500">{ungrouped.length} workflows</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {ungrouped.map((wf) => {
                const health = getWorkflowHealth(wf);
                return (
                  <a
                    key={wf.workflowId}
                    href={`https://n8n.intelligents.agency/workflow/${wf.workflowId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-zinc-900/60 border border-zinc-700/40 hover:bg-zinc-800/80 transition-colors group"
                    title={`${wf.workflowName} — ${wf.triggerType}`}
                  >
                    <StatusDot status={health} />
                    <span className="text-zinc-300 group-hover:text-white truncate flex-1">
                      {wf.workflowName.replace(/^\[.*?\]\s*/, '')}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowsPanel;
