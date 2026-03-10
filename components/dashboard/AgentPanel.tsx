import React from 'react';
import { Bot, Bell, Clock, MessageSquare, FileText, CheckCircle2 } from 'lucide-react';
import { useAgentData } from '../../hooks/useAgentData';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import { timeAgo } from './shared/utils';

const alertTypeColors: Record<string, string> = {
  performance_spike: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  pipeline_stall: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  high_scoring_leads: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  competitor_viral_reminder: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
};

const AgentPanel: React.FC = () => {
  const { alerts, reminders, messageStats, summaries, alertsByType, loading, refresh, acknowledgeAlert, completeReminder } = useAgentData();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['n8nclaw_proactive_alerts'] });

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Agent (n8nClaw)</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Messages" value={messageStats.total} icon={<MessageSquare className="w-5 h-5" />} color="text-cyan-400" subValue={`${messageStats.today} today`} />
        <StatCard label="This Week" value={messageStats.thisWeek} icon={<Bot className="w-5 h-5" />} color="text-violet-400" />
        <StatCard label="Alerts Generated" value={alerts.length} icon={<Bell className="w-5 h-5" />} color="text-orange-400" subValue={`${Object.keys(alertsByType).length} types`} />
        <StatCard label="Pending Reminders" value={reminders.length} icon={<Clock className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Alerts timeline */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-zinc-500" />
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Alert Timeline</h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-10 text-zinc-600 text-sm text-center">No alerts</p>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {alerts.slice(0, 20).map((a) => {
                  const colors = alertTypeColors[a.alertType] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
                  return (
                    <div key={a.id} className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/20 transition-colors">
                      <div className="mt-1">
                        <StatusDot status={a.sent ? 'healthy' : 'warning'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-zinc-300 truncate">{a.title}</p>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors}`}>
                            {a.alertType.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{a.body}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-[11px] text-zinc-600">{timeAgo(a.createdAt)} · {a.sent ? 'Sent' : 'Unsent'}</p>
                          {!a.sent && (
                            <button
                              onClick={() => acknowledgeAlert(a.id)}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                            >
                              <CheckCircle2 className="w-2.5 h-2.5" /> Ack
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Reminders */}
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Pending Reminders</h2>
            </div>
            <div className="divide-y divide-zinc-800/50">
              {reminders.length === 0 ? (
                <p className="px-4 py-8 text-zinc-600 text-sm text-center">No pending reminders</p>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className="px-4 py-3 hover:bg-zinc-800/20 transition-colors flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300">{r.reminderText}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500">
                        <span>{new Date(r.remindAt).toLocaleString()}</span>
                        {r.recurrence && <span className="bg-zinc-800/60 px-1.5 py-0.5 rounded">Repeats: {r.recurrence}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => completeReminder(r.id)}
                      className="shrink-0 mt-0.5 p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      title="Mark complete"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Daily summaries */}
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-zinc-500" />
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Daily Summaries</h2>
            </div>
            {summaries.length === 0 ? (
              <p className="px-4 py-8 text-zinc-600 text-sm text-center">No summaries yet</p>
            ) : (
              <div className="divide-y divide-zinc-800/50">
                {summaries.map((s) => (
                  <div key={s.id} className="px-4 py-3 hover:bg-zinc-800/20 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[11px] font-medium text-zinc-400">{new Date(s.date).toLocaleDateString()}</p>
                      <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{s.messageCount} msgs</span>
                    </div>
                    <p className="text-sm text-zinc-300 line-clamp-2">{s.summary}</p>
                    {s.topics.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {s.topics.slice(0, 4).map((t, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-zinc-800/60 rounded text-[10px] text-zinc-500 border border-zinc-700/30">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentPanel;
