import React, { useState, useMemo } from 'react';
import { Server, AlertTriangle, CheckCircle2, XCircle, ExternalLink, ChevronDown, ChevronRight, Shield, Bell, BellOff, Search } from 'lucide-react';
import { useClientMonitoring } from '../../hooks/useClientMonitoring';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import { timeAgo } from './shared/utils';
import type { ClientInstance, ClientMonitoredWorkflow } from '../../types/dashboard';

const severityColors: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400 border-red-500/20',
  medium: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  low: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

const ClientsPanel: React.FC = () => {
  const {
    clients, errors, workflows, stats, loading, refresh,
    errorsPerClient, workflowsPerClient, getClientHealth,
    toggleClient, resolveError, resolveAllForClient, toggleWorkflowNotifications,
  } = useClientMonitoring();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['client_workflow_errors'] });
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [clientTab, setClientTab] = useState<Record<string, 'workflows' | 'errors'>>({});

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  const getTab = (id: string) => clientTab[id] || 'workflows';
  const setTab = (id: string, tab: 'workflows' | 'errors') => setClientTab((p) => ({ ...p, [id]: tab }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Clients" value={stats.total} icon={<Server className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Active" value={stats.active} icon={<CheckCircle2 className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Open Errors" value={stats.unresolvedErrors} icon={<XCircle className="w-5 h-5" />} color={stats.unresolvedErrors > 0 ? 'text-red-400' : 'text-zinc-500'} />
        <StatCard label="Monitored Workflows" value={stats.monitoredWorkflows} icon={<Bell className="w-5 h-5" />} color={stats.monitoredWorkflows > 0 ? 'text-blue-400' : 'text-zinc-500'} />
      </div>

      {clients.length === 0 ? (
        <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-12 text-center">
          <Server className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 mb-1">No clients registered</p>
          <p className="text-[11px] text-zinc-600">Send a WhatsApp message to n8nClaw: &quot;register client [name] [n8n-url] [api-key]&quot;</p>
        </div>
      ) : (
        <>
          {/* Client Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {clients.map((client) => {
              const clientWorkflows = workflowsPerClient(client.id);
              const monitoredCount = clientWorkflows.filter((w) => w.notificationsEnabled).length;
              return (
                <ClientCard
                  key={client.id}
                  client={client}
                  health={getClientHealth(client)}
                  errorCount={errorsPerClient(client.id).length}
                  workflowCount={clientWorkflows.length}
                  monitoredCount={monitoredCount}
                  isExpanded={expandedClient === client.id}
                  onToggle={() => setExpandedClient(expandedClient === client.id ? null : client.id)}
                  tab={getTab(client.id)}
                  onTabChange={(tab) => setTab(client.id, tab)}
                  errors={errorsPerClient(client.id)}
                  workflows={clientWorkflows}
                  expandedError={expandedError}
                  onToggleError={(id) => setExpandedError(expandedError === id ? null : id)}
                  onToggleActive={(id, active) => {
                    if (active || confirm(`Disable monitoring for ${client.clientName}?`)) {
                      toggleClient(id, active);
                    }
                  }}
                  onResolveError={(id) => resolveError(id)}
                  onResolveAll={() => resolveAllForClient(client.id)}
                  onToggleNotifications={(id, enabled) => toggleWorkflowNotifications(id, enabled)}
                />
              );
            })}
          </div>

          {/* Recent Errors */}
          {errors.length > 0 && (
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-zinc-500" />
                <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em]">Recent Errors Across All Clients</h2>
              </div>
              <div className="max-h-96 overflow-y-auto dashboard-scroll divide-y divide-zinc-800/40">
                {errors.slice(0, 20).map((err) => {
                  const colors = severityColors[err.severity] || severityColors.medium;
                  const isExpanded = expandedError === err.id;
                  return (
                    <div key={err.id}>
                      <button
                        onClick={() => setExpandedError(isExpanded ? null : err.id)}
                        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors text-left"
                      >
                        <div className="mt-1">
                          <StatusDot status={err.severity === 'high' ? 'error' : 'warning'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{err.clientName}</span>
                            <p className="text-sm text-zinc-300 truncate" title={err.workflowName || err.workflowId}>{err.workflowName || err.workflowId}</p>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors}`}>
                              {err.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1" title={err.errorMessage}>{err.errorMessage}</p>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-600">
                            <span>{timeAgo(err.lastSeen)}</span>
                            {err.occurrenceCount > 1 && (
                              <span className="bg-zinc-800/60 px-1.5 py-0.5 rounded">{err.occurrenceCount}x</span>
                            )}
                          </div>
                        </div>
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
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                              <span>First seen: {new Date(err.firstSeen).toLocaleString()}</span>
                              <span>Workflow: <span className="font-mono">{err.workflowId}</span></span>
                              {err.executionId && err.n8nUrl && (
                                <a
                                  href={`${err.n8nUrl}/workflow/${err.workflowId}/executions/${err.executionId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" /> Execution
                                </a>
                              )}
                            </div>
                            <button
                              onClick={() => resolveError(err.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Resolve
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

interface ClientCardProps {
  client: ClientInstance;
  health: 'healthy' | 'warning' | 'error' | 'inactive';
  errorCount: number;
  workflowCount: number;
  monitoredCount: number;
  isExpanded: boolean;
  onToggle: () => void;
  tab: 'workflows' | 'errors';
  onTabChange: (tab: 'workflows' | 'errors') => void;
  errors: any[];
  workflows: ClientMonitoredWorkflow[];
  expandedError: string | null;
  onToggleError: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onResolveError: (id: string) => void;
  onResolveAll: () => void;
  onToggleNotifications: (id: string, enabled: boolean) => void;
}

const ClientCard: React.FC<ClientCardProps> = ({
  client, health, errorCount, workflowCount, monitoredCount,
  isExpanded, onToggle, tab, onTabChange,
  errors, workflows, expandedError, onToggleError,
  onToggleActive, onResolveError, onResolveAll, onToggleNotifications,
}) => {
  const [search, setSearch] = useState('');

  const healthColors: Record<string, string> = {
    healthy: 'border-emerald-500/20',
    warning: 'border-orange-500/20',
    error: 'border-red-500/20',
    inactive: 'border-zinc-700/50',
  };

  const filteredWorkflows = useMemo(() => search
    ? workflows.filter((w) => w.workflowName.toLowerCase().includes(search.toLowerCase()))
    : workflows, [workflows, search]);

  return (
    <div className={`bg-zinc-900/80 border rounded-xl overflow-hidden transition-colors ${healthColors[health]}`}>
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition-colors text-left">
        <StatusDot status={health} pulse={health === 'error'} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200 truncate" title={client.clientName}>{client.clientName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[11px] text-zinc-500">Checked {timeAgo(client.lastCheckedAt)}</span>
            {client.consecutiveFailures > 0 && (
              <span className="text-[11px] text-red-400/70 bg-red-500/10 px-1.5 py-0.5 rounded">{client.consecutiveFailures} failures</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
          {workflowCount > 0 && (
            <span className="text-[11px] text-zinc-400 bg-zinc-800/60 px-2 py-0.5 rounded-full">
              {workflowCount} wf
            </span>
          )}
          {monitoredCount > 0 && (
            <span className="text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-medium" title="Monitored workflows">
              <Bell className="w-2.5 h-2.5 inline -mt-px mr-0.5" />{monitoredCount}
            </span>
          )}
          {errorCount > 0 && (
            <span className="text-[11px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-medium" title={`${errorCount} unresolved error${errorCount > 1 ? 's' : ''}`}>{errorCount}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleActive(client.id, !client.isActive); }}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${client.isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50 hover:bg-emerald-500/15 hover:text-emerald-400 hover:border-emerald-500/20'}`}
            title={client.isActive ? 'Click to disable' : 'Click to enable'}
          >
            {client.isActive ? 'Active' : 'Disabled'}
          </button>
          <a
            href={client.n8nUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-zinc-600 hover:text-zinc-300 transition-colors p-1"
            title="Open n8n instance"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          {isExpanded ? <ChevronDown className="w-4 h-4 text-zinc-600" /> : <ChevronRight className="w-4 h-4 text-zinc-600" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-zinc-800/50">
          {/* Tab switcher */}
          <div className="flex border-b border-zinc-800/40">
            <button
              onClick={() => onTabChange('workflows')}
              className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${tab === 'workflows' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Workflows ({workflowCount})
            </button>
            <button
              onClick={() => onTabChange('errors')}
              className={`flex-1 px-3 py-2 text-[11px] font-medium transition-colors ${tab === 'errors' ? 'text-red-400 border-b-2 border-red-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              Errors ({errorCount})
            </button>
          </div>

          {tab === 'errors' && errors.length > 1 && (
            <div className="px-3 pt-2 flex justify-end">
              <button
                onClick={() => { if (confirm(`Resolve all ${errors.length} errors for ${client.clientName}?`)) onResolveAll(); }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
              >
                <CheckCircle2 className="w-3 h-3" /> Resolve All ({errors.length})
              </button>
            </div>
          )}

          {tab === 'workflows' ? (
            <div>
              {workflows.length > 8 && (
                <div className="px-3 pt-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Filter workflows..."
                      className="w-full bg-zinc-800/50 border border-zinc-700/40 rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                </div>
              )}
              {filteredWorkflows.length === 0 ? (
                <p className="px-4 py-4 text-zinc-600 text-xs text-center">
                  {workflows.length === 0 ? 'No workflows synced yet' : 'No matching workflows'}
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto dashboard-scroll divide-y divide-zinc-800/30">
                  {filteredWorkflows.map((wf) => (
                    <div key={wf.id} className="px-4 py-2 flex items-center gap-2 hover:bg-zinc-800/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-zinc-300 truncate" title={wf.workflowName}>{wf.workflowName}</p>
                          {!wf.isActive && (
                            <span className="text-[10px] text-zinc-600 bg-zinc-800/60 px-1 py-0.5 rounded">inactive</span>
                          )}
                        </div>
                        {wf.errorCount > 0 && (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-red-400/70">{wf.errorCount} errors</span>
                            {wf.lastErrorAt && (
                              <span className="text-[10px] text-zinc-600">last {timeAgo(wf.lastErrorAt)}</span>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => onToggleNotifications(wf.id, !wf.notificationsEnabled)}
                        className={`p-1.5 rounded-lg transition-colors ${wf.notificationsEnabled ? 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25' : 'bg-zinc-800/50 text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'}`}
                        title={wf.notificationsEnabled ? 'Notifications on — click to disable' : 'Notifications off — click to enable'}
                      >
                        {wf.notificationsEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {errors.length === 0 ? (
                <p className="px-4 py-4 text-zinc-600 text-xs text-center">No open errors</p>
              ) : (
                <div className="max-h-64 overflow-y-auto dashboard-scroll divide-y divide-zinc-800/30">
                  {errors.map((err) => {
                    const colors = severityColors[err.severity] || severityColors.medium;
                    const isErrExpanded = expandedError === err.id;
                    return (
                      <div key={err.id}>
                        <button
                          onClick={() => onToggleError(err.id)}
                          className="w-full px-4 py-2.5 flex items-start gap-2 hover:bg-zinc-800/30 transition-colors text-left"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-zinc-300 truncate" title={err.workflowName || err.workflowId}>{err.workflowName || err.workflowId}</p>
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors}`}>{err.severity}</span>
                              {err.occurrenceCount > 1 && (
                                <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1 py-0.5 rounded">{err.occurrenceCount}x</span>
                              )}
                            </div>
                            {err.aiAnalysis && (
                              <p className="text-[11px] text-blue-300/70 mt-0.5 line-clamp-1" title={err.aiAnalysis}>{err.aiAnalysis}</p>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-600 shrink-0 mt-0.5">{timeAgo(err.lastSeen)}</span>
                        </button>
                        {isErrExpanded && (
                          <div className="px-4 pb-2.5 space-y-1.5">
                            {err.errorMessage && (
                              <div className="p-2 bg-red-950/30 border border-red-500/15 rounded-lg text-[11px] text-red-300/90 font-mono leading-relaxed">
                                {err.errorMessage}
                              </div>
                            )}
                            {err.aiAnalysis && (
                              <div className="p-2 bg-blue-950/20 border border-blue-500/15 rounded-lg text-[11px] text-blue-300/90 leading-relaxed">
                                <span className="text-blue-400/70 font-medium">Analysis: </span>{err.aiAnalysis}
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              {err.executionId && err.n8nUrl && (
                                <a
                                  href={`${err.n8nUrl}/workflow/${err.workflowId}/executions/${err.executionId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  <ExternalLink className="w-3 h-3" /> Open Execution
                                </a>
                              )}
                              <button
                                onClick={() => onResolveError(err.id)}
                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Resolve
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientsPanel;
