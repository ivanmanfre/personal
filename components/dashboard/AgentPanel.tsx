import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Bot, Bell, Clock, MessageSquare, FileText, CheckCircle2, ChevronUp, User, Send, ArrowDown } from 'lucide-react';
import { useAgentData } from '../../hooks/useAgentData';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import StatusDot from './shared/StatusDot';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
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

// Check if avatar should be shown (hide on consecutive same-sender messages)
function shouldShowAvatar(msgs: { role: string }[], index: number): boolean {
  if (index === 0) return true;
  return msgs[index].role !== msgs[index - 1].role;
}

// Typing indicator with animated dots
const TypingIndicator: React.FC = () => (
  <div className="flex gap-2.5 justify-start mt-1">
    <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/20 border border-violet-500/30 flex items-center justify-center">
      <Bot className="w-4 h-4 text-violet-400" />
    </div>
    <div className="bg-zinc-800/30 border border-zinc-700/25 rounded-2xl rounded-bl-lg px-4 py-3">
      <div className="flex gap-1.5 items-center h-4">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[bounce_1s_ease-in-out_infinite]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[bounce_1s_ease-in-out_0.15s_infinite]" />
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-[bounce_1s_ease-in-out_0.3s_infinite]" />
      </div>
    </div>
  </div>
);

// Collapsible detail section
const DetailSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, icon, badge, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-zinc-500">{icon}</span>
          <span className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em]">{title}</span>
          {badge != null && badge > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-[10px] font-medium text-zinc-500">{badge}</span>
          )}
        </div>
        <ChevronUp className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${open ? '' : 'rotate-180'}`} />
      </button>
      {open && <div className="border-t border-zinc-800/40">{children}</div>}
    </div>
  );
};

const AgentPanel: React.FC = () => {
  const {
    alerts, reminders, messageStats, summaries, chatMessages, chatHasMore, alertsByType,
    loading, refresh, acknowledgeAlert, completeReminder, loadMoreChat,
    sendMessage, sending, pendingMessage,
  } = useAgentData();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['n8nclaw_proactive_alerts', 'n8nclaw_chat_messages'] });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [initialScrollDone, setInitialScrollDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [input, setInput] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const isNearBottomRef = useRef(true);
  const prevMsgLenRef = useRef(0);

  // Scroll to bottom — instant for auto-scroll, smooth only for manual button
  const scrollToBottom = useCallback((smooth = false) => {
    chatEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Initial scroll to bottom (once)
  useEffect(() => {
    if (!loading && chatMessages.length > 0 && !initialScrollDone) {
      scrollToBottom();
      setInitialScrollDone(true);
      prevMsgLenRef.current = chatMessages.length;
    }
  }, [loading, chatMessages.length, initialScrollDone, scrollToBottom]);

  // Auto-scroll ONLY when new messages actually arrive AND user is near bottom
  useEffect(() => {
    if (!initialScrollDone) return;
    const newLen = chatMessages.length;
    if (newLen > prevMsgLenRef.current && isNearBottomRef.current) {
      scrollToBottom();
    }
    prevMsgLenRef.current = newLen;
  }, [chatMessages.length, initialScrollDone, scrollToBottom]);

  // Scroll when pending message appears (user just sent)
  useEffect(() => {
    if (pendingMessage) scrollToBottom();
  }, [pendingMessage, scrollToBottom]);

  // Track scroll position via ref (no state = no re-renders)
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    isNearBottomRef.current = nearBottom;
    setShowScrollDown(!nearBottom && el.scrollHeight - el.clientHeight > 200);
  }, []);

  const handleLoadMore = async () => {
    const container = chatContainerRef.current;
    const prevHeight = container?.scrollHeight || 0;
    setLoadingMore(true);
    await loadMoreChat();
    setLoadingMore(false);
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight - prevHeight;
      });
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  // Send on Enter, newline on Shift+Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setInput('');
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.focus();
    }
    sendMessage(trimmed);
  };

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/25 flex items-center justify-center">
            <Bot className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">n8nClaw</h1>
            <p className="text-[11px] text-zinc-500 -mt-0.5">AI Agent — WhatsApp + Dashboard</p>
          </div>
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Messages" value={messageStats.total} icon={<MessageSquare className="w-5 h-5" />} color="text-cyan-400" subValue={`${messageStats.today} today`} />
        <StatCard label="This Week" value={messageStats.thisWeek} icon={<Bot className="w-5 h-5" />} color="text-violet-400" />
        <StatCard label="Alerts" value={alerts.length} icon={<Bell className="w-5 h-5" />} color="text-orange-400" subValue={`${Object.keys(alertsByType).length} types`} />
        <StatCard label="Reminders" value={reminders.length} icon={<Clock className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      {/* Chat Container */}
      <div className="relative bg-zinc-900/90 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-lg shadow-black/10">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em]">Chat</h2>
            <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-[10px] font-medium text-zinc-500">{messageStats.total}</span>
          </div>
          {sending && (
            <span className="text-[10px] text-violet-400 font-medium animate-pulse">Processing...</span>
          )}
        </div>

        {/* Messages Area */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="h-[350px] sm:h-[450px] lg:h-[540px] overflow-y-auto dashboard-scroll bg-gradient-to-b from-zinc-950/30 to-zinc-900/10"
        >
          {chatMessages.length === 0 && !pendingMessage ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/10 border border-violet-500/15 flex items-center justify-center mx-auto mb-4">
                  <Bot className="w-8 h-8 text-violet-400/60" />
                </div>
                <p className="text-zinc-500 text-sm font-medium">Start a conversation</p>
                <p className="text-zinc-600 text-xs mt-1">Messages are synced with WhatsApp</p>
              </div>
            </div>
          ) : (
            <div className="px-4 sm:px-6 py-4">
              {/* Load more */}
              {chatHasMore && (
                <div className="flex justify-center py-2">
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/30 transition-all disabled:opacity-50"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    {loadingMore ? 'Loading...' : 'Load older messages'}
                  </button>
                </div>
              )}

              <div className="space-y-0.5">
                {chatMessages.map((msg, i) => {
                  const isUser = msg.role === 'user';
                  const prevTs = i > 0 ? chatMessages[i - 1].createdAt : null;
                  const showDate = shouldShowDateSeparator(msg.createdAt, prevTs);
                  const showAv = shouldShowAvatar(chatMessages, i);
                  // Add top margin on role change for visual grouping
                  const roleChanged = i > 0 && chatMessages[i - 1].role !== msg.role;

                  return (
                    <React.Fragment key={msg.id}>
                      {showDate && (
                        <div className="flex items-center gap-3 py-2.5">
                          <div className="flex-1 h-px bg-zinc-700/50" />
                          <span className="text-[11px] text-zinc-500 font-medium tracking-wide">{formatDateSeparator(msg.createdAt)}</span>
                          <div className="flex-1 h-px bg-zinc-700/50" />
                        </div>
                      )}
                      <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} ${roleChanged && !showDate ? 'mt-3' : ''}`}>
                        {!isUser && (
                          showAv ? (
                            <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-600/20 border border-violet-500/30 flex items-center justify-center mt-0.5">
                              <Bot className="w-4 h-4 text-violet-400" />
                            </div>
                          ) : (
                            <div className="shrink-0 w-8" />
                          )
                        )}
                        <div className={`max-w-[90%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%] ${isUser ? 'order-first' : ''}`}>
                          <div
                            className={`px-4 py-2.5 text-sm leading-relaxed ${
                              isUser
                                ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/12 border border-emerald-500/20 text-zinc-200 rounded-2xl rounded-br-lg'
                                : 'bg-zinc-800/50 border border-zinc-700/25 text-zinc-300 rounded-2xl rounded-bl-lg'
                            }`}
                          >
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          {showAv && (
                            <p className={`text-[10px] text-zinc-600 mt-1 px-1 ${isUser ? 'text-right' : ''}`}>
                              {formatChatTime(msg.createdAt)}
                            </p>
                          )}
                        </div>
                        {isUser && (
                          showAv ? (
                            <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/15 border border-emerald-500/25 flex items-center justify-center mt-0.5">
                              <User className="w-4 h-4 text-emerald-400" />
                            </div>
                          ) : (
                            <div className="shrink-0 w-8" />
                          )
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* Pending user message (optimistic) */}
                {pendingMessage && (
                  <div className={`flex gap-2.5 justify-end ${chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role !== 'user' ? 'mt-3' : ''}`}>
                    <div className="max-w-[90%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%]">
                      <div className="px-4 py-2.5 rounded-2xl rounded-br-lg text-sm leading-relaxed bg-gradient-to-br from-emerald-500/20 to-emerald-600/12 border border-emerald-500/20 text-zinc-200">
                        <p className="whitespace-pre-wrap break-words">{pendingMessage}</p>
                      </div>
                      <p className="text-[10px] text-zinc-500 mt-1 px-1 text-right animate-pulse">Sending...</p>
                    </div>
                    <div className="shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-600/15 border border-emerald-500/25 flex items-center justify-center mt-0.5">
                      <User className="w-4 h-4 text-emerald-400" />
                    </div>
                  </div>
                )}

                {/* Typing indicator */}
                {sending && <TypingIndicator />}
              </div>

              <div ref={chatEndRef} className="h-1" />
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollDown && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-[72px] right-4 w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-all shadow-lg shadow-black/20 z-10"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        )}

        {/* Input Bar */}
        <div className="border-t border-zinc-800/40 bg-zinc-900/80 backdrop-blur-sm p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Message n8nClaw..."
              rows={1}
              disabled={sending}
              className="flex-1 resize-none bg-zinc-800/40 border border-zinc-700/30 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/40 focus:ring-1 focus:ring-violet-500/20 transition-all disabled:opacity-50 max-h-[160px]"
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="shrink-0 w-11 h-10 sm:w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-white hover:from-violet-400 hover:to-violet-500 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-violet-500/20 disabled:shadow-none"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5 px-1">
            Enter to send · Shift+Enter for new line · Synced with WhatsApp
          </p>
        </div>
      </div>

      {/* Detail Sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Alerts */}
        <DetailSection title="Alerts" icon={<Bell className="w-3.5 h-3.5" />} badge={alerts.length} defaultOpen={alerts.some((a) => !a.sent)}>
          {alerts.length === 0 ? (
            <p className="px-4 py-8 text-zinc-600 text-sm text-center">No alerts</p>
          ) : (
            <div className="divide-y divide-zinc-800/40 max-h-64 overflow-y-auto dashboard-scroll">
              {alerts.slice(0, 20).map((a) => {
                const colors = alertTypeColors[a.alertType] || 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
                return (
                  <div key={a.id} className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors">
                    <div className="mt-1">
                      <StatusDot status={a.sent ? 'healthy' : 'inactive'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm text-zinc-300 truncate" title={a.title}>{a.title}</p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors}`}>
                          {a.alertType.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{a.body}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[11px] text-zinc-600">{timeAgo(a.createdAt)}</p>
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
        </DetailSection>

        {/* Reminders */}
        <DetailSection title="Reminders" icon={<Clock className="w-3.5 h-3.5" />} badge={reminders.length} defaultOpen={reminders.length > 0}>
          {reminders.length === 0 ? (
            <p className="px-4 py-8 text-zinc-600 text-sm text-center">No pending reminders</p>
          ) : (
            <div className="divide-y divide-zinc-800/40 max-h-64 overflow-y-auto dashboard-scroll">
              {reminders.map((r) => (
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
              ))}
            </div>
          )}
        </DetailSection>

        {/* Summaries */}
        <DetailSection title="Summaries" icon={<FileText className="w-3.5 h-3.5" />} badge={summaries.length}>
          {summaries.length === 0 ? (
            <p className="px-4 py-8 text-zinc-600 text-sm text-center">No summaries yet</p>
          ) : (
            <div className="divide-y divide-zinc-800/40 max-h-64 overflow-y-auto dashboard-scroll">
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
        </DetailSection>
      </div>
    </div>
  );
};

export default AgentPanel;
