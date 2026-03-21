import React, { useRef, useEffect, useState } from 'react';
import { Bot, Bell, Clock, MessageSquare, FileText, CheckCircle2, ChevronUp, User } from 'lucide-react';
import { useAgentData } from '../../hooks/useAgentData';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import PanelCard from './shared/PanelCard';
import { timeAgo } from './shared/utils';

const alertTypeColors: Record<string, string> = {
  performance_spike: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  pipeline_stall: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  high_scoring_leads: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  competitor_viral_reminder: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
};

function formatChatTime(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (diffDays === 0) return time;
  if (diffDays === 1) return `Yesterday ${time}`;
  if (diffDays < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${time}`;
}

function shouldShowDateSeparator(current: string, prev: string | null): boolean {
  if (!prev) return true;
  return new Date(current).toDateString() !== new Date(prev).toDateString();
}

function formatDateSeparator(ts: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

const AgentPanel: React.FC = () => {
  const { alerts, reminders, messageStats, summaries, chatMessages, chatHasMore, alertsByType, loading, refresh, acknowledgeAlert, completeReminder, loadMoreChat } = useAgentData();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['n8nclaw_proactive_alerts', 'n8nclaw_chat_messages'] });
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (!loading && chatMessages.length > 0 && !initialScrollDone) {
      chatEndRef.current?.scrollIntoView();
      setInitialScrollDone(true);
    }
  }, [loading, chatMessages.length, initialScrollDone]);

  const handleLoadMore = async () => {
    const container = chatContainerRef.current;
    const prevHeight = container?.scrollHeight || 0;
    setLoadingMore(true);
    await loadMoreChat();
    setLoadingMore(false);
    // Preserve scroll position after prepending messages
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight - prevHeight;
      });
    }
  };

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  if (alerts.length === 0 && reminders.length === 0 && summaries.length === 0 && messageStats.total === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Agent (n8nClaw)</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState title="No agent data" description="n8nClaw alerts, reminders, and chat summaries will appear here once the agent is active." icon={<Bot className="w-10 h-10" />} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Agent (n8nClaw)</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Messages" value={messageStats.total} icon={<MessageSquare className="w-5 h-5" />} color="text-cyan-400" subValue={`${messageStats.today} today`} />
        <StatCard label="This Week" value={messageStats.thisWeek} icon={<Bot className="w-5 h-5" />} color="text-violet-400" />
        <StatCard label="Alerts Generated" value={alerts.length} icon={<Bell className="w-5 h-5" />} color="text-orange-400" subValue={`${Object.keys(alertsByType).length} types`} />
        <StatCard label="Pending Reminders" value={reminders.length} icon={<Clock className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      {/* Chat History */}
      <PanelCard title="Chat History" icon={<MessageSquare className="w-3.5 h-3.5" />} badge={messageStats.total}>
        {chatMessages.length === 0 ? (
          <p className="px-4 py-10 text-zinc-600 text-sm text-center">No messages yet</p>
        ) : (
          <div ref={chatContainerRef} className="max-h-[500px] overflow-y-auto dashboard-scroll">
            {/* Load more */}
            {chatHasMore && (
              <div className="flex justify-center py-3">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                  {loadingMore ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            )}

            <div className="px-4 py-3 space-y-1">
              {chatMessages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const prevTs = i > 0 ? chatMessages[i - 1].createdAt : null;
                const showDate = shouldShowDateSeparator(msg.createdAt, prevTs);

                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div className="flex items-center gap-3 py-3">
                        <div className="flex-1 h-px bg-zinc-800/60" />
                        <span className="text-[10px] text-zinc-600 font-medium">{formatDateSeparator(msg.createdAt)}</span>
                        <div className="flex-1 h-px bg-zinc-800/60" />
                      </div>
                    )}
                    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {!isUser && (
                        <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/20 border border-violet-500/20 flex items-center justify-center mt-1">
                          <Bot className="w-3.5 h-3.5 text-violet-400" />
                        </div>
                      )}
                      <div className={`max-w-[80%] ${isUser ? 'order-first' : ''}`}>
                        <div
                          className={`px-3 py-2 rounded-xl text-sm leading-relaxed ${
                            isUser
                              ? 'bg-emerald-500/10 border border-emerald-500/15 text-zinc-200 rounded-br-md'
                              : 'bg-zinc-800/60 border border-zinc-700/30 text-zinc-300 rounded-bl-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        <p className={`text-[10px] text-zinc-600 mt-0.5 ${isUser ? 'text-right' : ''}`}>
                          {formatChatTime(msg.createdAt)}
                        </p>
                      </div>
                      {isUser && (
                        <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border border-emerald-500/20 flex items-center justify-center mt-1">
                          <User className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}
      </PanelCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Alerts timeline */}
        <PanelCard title="Alert Timeline" icon={<Bell className="w-3.5 h-3.5" />} badge={alerts.length} scrollable>
          {alerts.length === 0 ? (
            <p className="px-4 py-10 text-zinc-600 text-sm text-center">No alerts</p>
          ) : (
            <div className="divide-y divide-zinc-800/40">
              {alerts.slice(0, 20).map((a) => {
                const colors = alertTypeColors[a.alertType] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
                return (
                  <div key={a.id} className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors">
                    <div className="mt-1">
                      <StatusDot status={a.sent ? 'healthy' : 'inactive'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-zinc-300 truncate" title={a.title}>{a.title}</p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors}`}>
                          {a.alertType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{a.body}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[11px] text-zinc-600">{timeAgo(a.createdAt)} · {a.sent ? 'Delivered' : 'Pending'}</p>
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
        </PanelCard>

        {/* Right column */}
        <div className="space-y-4">
          {/* Reminders */}
          <PanelCard title="Pending Reminders" icon={<Clock className="w-3.5 h-3.5" />} badge={reminders.length}>
            <div className="divide-y divide-zinc-800/40">
              {reminders.length === 0 ? (
                <p className="px-4 py-8 text-zinc-600 text-sm text-center">No pending reminders</p>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className="px-4 py-3 hover:bg-zinc-800/30 transition-colors flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-300">{r.reminderText}</p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500">
                        <span title={new Date(r.remindAt).toLocaleString()}>{timeAgo(r.remindAt)}</span>
                        {r.recurrence && <span className="bg-zinc-800/60 px-1.5 py-0.5 rounded">{r.recurrence}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => completeReminder(r.id)}
                      className="shrink-0 mt-0.5 p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                      title="Mark complete"
                      aria-label="Mark reminder complete"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </PanelCard>

          {/* Daily summaries */}
          <PanelCard title="Daily Summaries" icon={<FileText className="w-3.5 h-3.5" />} badge={summaries.length}>
            {summaries.length === 0 ? (
              <p className="px-4 py-8 text-zinc-600 text-sm text-center">No summaries yet</p>
            ) : (
              <div className="divide-y divide-zinc-800/40">
                {summaries.map((s) => (
                  <div key={s.id} className="px-4 py-3 hover:bg-zinc-800/30 transition-colors">
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
          </PanelCard>
        </div>
      </div>
    </div>
  );
};

export default AgentPanel;
