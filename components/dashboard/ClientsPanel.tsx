import React, { useState } from 'react';
import { Server, AlertTriangle, CheckCircle2, XCircle, ExternalLink, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { useClientMonitoring } from '../../hooks/useClientMonitoring';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import type { ClientInstance } from '../../types/dashboard';

function timeAgo(ts: string | null): string {
  if (!ts) return 'never';
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

const severityColors: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400 border-red-500/20',
  medium: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  low: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

const ClientsPanel: React.FC = () => {
  const { clients, errors, stats, loading, refresh, errorsPerClient, getClientHealth } = useClientMonitoring();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['client_workflow_errors'] });
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [expandedError, setExpandedError] = useState<string | null>(null);

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

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
        <StatCard label="Clients w/ Errors" value={stats.clientsWithErrors} icon={<AlertTriangle className="w-5 h-5" />} color={stats.clientsWithErrors > 0 ? 'text-orange-400' : 'text-zinc-500'} />
      </div>

      {clients.length === 0 ? (
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-12 text-center">
          <Server className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500 mb-1">No clients registered</p>
          <p className="text-[11px] text-zinc-600">Send a WhatsApp message to n8nClaw: &quot;register client [name] [n8n-url] [api-key]&quot;</p>
        </div>
      ) : (
        <>
          {/* Client Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {clients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                health={getClientHealth(client)}
                errorCount={errorsPerClient(client.id).length}
                isExpanded={expandedClient === client.id}
                onToggle={() => setExpandedClient(expandedClient === client.id ? null : client.id)}
                errors={errorsPerClient(client.id)}
                expandedError={expandedError}
                onToggleError={(id) => setExpandedError(expandedError === id ? null : id)}
              />
            ))}
          </div>

          {/* Recent Errors */}
          {errors.length > 0 && (
            <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-zinc-500" />
                <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Recent Errors Across All Clients</h2>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-zinc-800/50">
                {errors.slice(0, 20).map((err) => {
                  const colors = severityColors[err.severity] || severityColors.medium;
                  const isExpanded = expandedError === err.id;
                  return (
                    <div key={err.id}>
                      <button
                        onClick={() => setExpandedError(isExpanded ? null : err.id)}
                        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/20 transition-colors text-left"
                      >
                        <div className="mt-1">
                          <StatusDot status={err.severity === 'high' ? 'error' : 'warning'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{err.clientName}</span>
                            <p className="text-sm text-zinc-300 truncate">{err.workflowName || err.workflowId}</p>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors}`}>
                              {err.severity}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-1 line-clamp-1">{err.errorMessage}</p>
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
                          <div className="flex items-center gap-3 text-[11px] text-zinc-500">
                            <span>First seen: {new Date(err.firstSeen).toLocaleString()}</span>
                            <span>Workflow: <span className="font-mono">{err.workflowId}</span></span>
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
  isExpanded: boolean;
  onToggle: () => void;
  errors: any[];
  expandedError: string | null;
  onToggleError: (id: string) => void;
}

const ClientCard: React.FC<ClientCardProps> = ({ client, health, errorCount, isExpanded, onToggle, errors, expandedError, onToggleError }) => {
  const healthColors: Record<string, string> = {
    healthy: 'border-emerald-500/20',
    warning: 'border-orange-500/20',
    error: 'border-red-500/20',
    inactive: 'border-zinc-700/50',
  };

  return (
    <div className={`bg-zinc-900/80 border rounded-xl overflow-hidden transition-colors ${healthColors[health]}`}>
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-zinc-800/20 transition-colors text-left">
        <StatusDot status={health} pulse={health === 'error'} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-200">{client.clientName}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-zinc-500">Checked {timeAgo(client.lastCheckedAt)}</span>
            {client.consecutiveFailures > 0 && (
              <span className="text-[11px] text-red-400/70 bg-red-500/10 px-1.5 py-0.5 rounded">{client.consecutiveFailures} failures</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {errorCount > 0 && (
            <span className="text-[11px] text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-medium">{errorCount}</span>
          )}
          <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${client.isActive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700/50'}`}>
            {client.isActive ? 'Active' : 'Disabled'}
          </span>
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
          {errors.length === 0 ? (
            <p className="px-4 py-4 text-zinc-600 text-xs text-center">No open errors</p>
          ) : (
            <div className="divide-y divide-zinc-800/30">
              {errors.map((err) => {
                const colors = severityColors[err.severity] || severityColors.medium;
                const isErrExpanded = expandedError === err.id;
                return (
                  <div key={err.id}>
                    <button
                      onClick={() => onToggleError(err.id)}
                      className="w-full px-4 py-2.5 flex items-start gap-2 hover:bg-zinc-800/20 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-zinc-300 truncate">{err.workflowName || err.workflowId}</p>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors}`}>{err.severity}</span>
                          {err.occurrenceCount > 1 && (
                            <span className="text-[10px] text-zinc-500 bg-zinc-800/60 px-1 py-0.5 rounded">{err.occurrenceCount}x</span>
                          )}
                        </div>
                        {err.aiAnalysis && (
                          <p className="text-[11px] text-blue-300/70 mt-0.5 line-clamp-1">{err.aiAnalysis}</p>
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
  );
};

export default ClientsPanel;
