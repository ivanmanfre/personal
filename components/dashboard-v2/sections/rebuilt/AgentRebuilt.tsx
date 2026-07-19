import React, { useRef, useEffect, useState, useCallback } from 'react';
import { RefreshCw, Send, ArrowDown, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useAgentData } from '../../../../hooks/useAgentData';
import { useAutoRefresh } from '../../../../hooks/useAutoRefresh';
import { useDashboard } from '../../../../contexts/DashboardContext';
import '../../editorial-cockpit.css';
import './agent/agent.css';

/**
 * AGENT (n8nClaw) — Black Box v4 rebuild of the WhatsApp chat mirror.
 *
 * The v1 messenger feed (emerald/violet gradient bubbles, zinc surfaces, 4-color
 * alert chips) is re-cast as a PRINTED TRANSMISSION LOG: paper surface, hairline
 * -separated entries, sender as a small functional label (IVAN / AGENT),
 * timestamps in the muted machine register, and machine (AGENT) replies set in
 * monospace-adjacent type so the human/machine seam reads like a printed log.
 * Unacknowledged alerts get THE BOX (the house component); the single red is
 * the WARNING count. Every write path (send / ack / complete) is imported
 * verbatim from useAgentData — nothing is re-implemented here.
 */

// ── Local time helpers (no cross-import from components/dashboard/*) ──────────
function fmtClock(ts: string, tz?: string): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    ...(tz ? { timeZone: tz } : {}),
  });
}

function formatChatTime(ts: string, tz?: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const time = fmtClock(ts, tz);
  if (diffDays === 0) return time;
  if (diffDays === 1) return `Yesterday ${time}`;
  if (diffDays < 7) return `${d.toLocaleDateString('en-US', { weekday: 'short', ...(tz ? { timeZone: tz } : {}) })} ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(tz ? { timeZone: tz } : {}) })} ${time}`;
}

function toDateKey(ts: string, tz?: string): string {
  const d = new Date(ts);
  if (!tz) return d.toDateString();
  return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz });
}

function shouldShowDateSeparator(current: string, prev: string | null, tz?: string): boolean {
  if (!prev) return true;
  return toDateKey(current, tz) !== toDateKey(prev, tz);
}

function formatDateSeparator(ts: string, tz?: string): string {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', ...(tz ? { timeZone: tz } : {}) });
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(ms);
  const min = Math.round(abs / 60000);
  const suffix = (n: number, unit: string) => (ms < 0 ? `in ${n}${unit}` : `${n}${unit} ago`);
  if (min < 1) return ms < 0 ? 'due now' : 'just now';
  if (min < 60) return suffix(min, 'm');
  const h = Math.round(min / 60);
  if (h < 24) return suffix(h, 'h');
  const dys = Math.round(h / 24);
  return suffix(dys, 'd');
}

// ── Stat lockup (reuses .ec-lockup grammar) ──────────────────────────────────
const Lockup: React.FC<{ value: number; label: React.ReactNode; sub?: string; muted?: boolean }> = ({ value, label, sub, muted }) => (
  <div className="ec-lockup" style={{ cursor: 'default' }}>
    <span className={`ec-lockup-num ${muted ? 'ec-lockup-num--muted' : ''}`}>{value}</span>
    <span className="ec-lockup-label">{label}</span>
    {sub ? <span className="ec-lockup-sub">{sub}</span> : null}
  </div>
);

// ── Accordion (alerts / reminders / summaries) ───────────────────────────────
const Accordion: React.FC<{
  title: string;
  count: number;
  defaultOpen?: boolean;
  dataEl: string;
  children: React.ReactNode;
}> = ({ title, count, defaultOpen = false, dataEl, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ag-acc">
      <button className="ag-acc-btn" data-ag={dataEl} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="ag-acc-lbl">{title}</span>
        <span className="ag-acc-count">{count}</span>
        <span className={`ag-acc-chev ${open ? 'ag-acc-chev--open' : ''}`}>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && <div className="ag-acc-body">{children}</div>}
    </div>
  );
};

const AgentRebuilt: React.FC = () => {
  const { userTimezone } = useDashboard();
  const {
    alerts, reminders, messageStats, summaries, chatMessages, chatHasMore, alertsByType,
    loading, refresh, acknowledgeAlert, completeReminder, loadMoreChat,
    sendMessage, sending, pendingMessage,
  } = useAgentData(userTimezone);
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

  // Scroll to bottom — scoped to the log container so the page never jumps past
  // the header. Instant for auto, smooth only for the manual button.
  const scrollToBottom = useCallback((smooth = false) => {
    const el = chatContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : ('instant' as ScrollBehavior) });
  }, []);

  useEffect(() => {
    if (!loading && chatMessages.length > 0 && !initialScrollDone) {
      scrollToBottom();
      setInitialScrollDone(true);
      prevMsgLenRef.current = chatMessages.length;
    }
  }, [loading, chatMessages.length, initialScrollDone, scrollToBottom]);

  useEffect(() => {
    if (!initialScrollDone) return;
    const newLen = chatMessages.length;
    if (newLen > prevMsgLenRef.current && isNearBottomRef.current) scrollToBottom();
    prevMsgLenRef.current = newLen;
  }, [chatMessages.length, initialScrollDone, scrollToBottom]);

  useEffect(() => {
    if (pendingMessage) scrollToBottom();
  }, [pendingMessage, scrollToBottom]);

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
      requestAnimationFrame(() => { container.scrollTop = container.scrollHeight - prevHeight; });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

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

  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const unacked = alerts.filter((a) => !a.sent);
  const alertTypeCount = Object.keys(alertsByType).length;

  return (
    <div className="ec">
      {/* Document header */}
      <div className="ec-topline">
        <span className="ec-topline-brand">Agent</span>
        <span className="ec-topline-meta">
          n8nClaw · WhatsApp mirror · {now}
          {lastRefreshed ? ` · SYNCED ${fmtClock(lastRefreshed.toISOString(), userTimezone)}` : ''}
        </span>
      </div>

      <div className="ag-head">
        <h1 className="ec-hed ec-hed--today" style={{ fontSize: 'clamp(40px,4.4vw,60px)', margin: 0 }}>Agent</h1>
        <div className="ag-tools">
          <span className="ag-tool-meta">Live transmission log</span>
          <button className="ag-tool-icon" data-ag="refresh" onClick={refresh} title="Refresh" aria-label="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Stat strip — the 4 v1 cards reworked into admin-table lockups */}
      <div className="ag-strip">
        <Lockup value={messageStats.total} label={<>Total<br />messages</>} sub={`${messageStats.today} today`} />
        <Lockup value={messageStats.thisWeek} label={<>Logged<br />this week</>} sub="7-day window" />
        <Lockup value={alerts.length} label={<>Proactive<br />alerts</>} sub={`${alertTypeCount} type${alertTypeCount === 1 ? '' : 's'}`} muted={alerts.length === 0} />
        <Lockup value={reminders.length} label={<>Pending<br />reminders</>} sub={reminders.length ? 'awaiting completion' : 'none pending'} muted={reminders.length === 0} />
      </div>

      {/* ── The transmission log ─────────────────────────────────────────────── */}
      <div className="ag-log">
        <div className="ag-log-cap">
          <span className="ag-log-cap-h">Transmission log</span>
          <span className="ag-log-cap-count">{messageStats.total}</span>
          {sending && <span className="ag-log-status">Responding</span>}
        </div>

        <div ref={chatContainerRef} onScroll={handleScroll} className="ag-log-scroll dashboard-scroll">
          {loading && chatMessages.length === 0 ? (
            <div className="ag-log-empty">
              <div>
                <div className="ag-log-empty-h">Reading the log</div>
                <div className="ag-log-empty-note">n8nclaw_chat_messages</div>
              </div>
            </div>
          ) : chatMessages.length === 0 && !pendingMessage ? (
            <div className="ag-log-empty">
              <div>
                <div className="ag-log-empty-h">No transmissions on record</div>
                <div className="ag-log-empty-note">Entries mirror the WhatsApp channel. Send one below to open the log.</div>
              </div>
            </div>
          ) : (
            <>
              {chatHasMore && (
                <div className="ag-older">
                  <button className="ag-older-btn" data-ag="load-older" onClick={handleLoadMore} disabled={loadingMore}>
                    <ChevronUp className="w-3 h-3" />
                    {loadingMore ? 'Loading' : 'Load older entries'}
                  </button>
                </div>
              )}

              {chatMessages.map((msg, i) => {
                const isUser = msg.role === 'user';
                const prevTs = i > 0 ? chatMessages[i - 1].createdAt : null;
                const showDate = shouldShowDateSeparator(msg.createdAt, prevTs, userTimezone);
                const roleChanged = i > 0 && chatMessages[i - 1].role !== msg.role;
                return (
                  <React.Fragment key={msg.id}>
                    {showDate && (
                      <div className="ag-datesep"><span>{formatDateSeparator(msg.createdAt, userTimezone)}</span></div>
                    )}
                    <div className={`ag-entry ${isUser ? 'ag-entry--user' : 'ag-entry--agent'} ${roleChanged && !showDate ? 'ag-entry--turn' : ''}`}>
                      <div className="ag-entry-head">
                        <span className="ag-who">{isUser ? 'Ivan' : 'Agent'}</span>
                        <span className="ag-time">{formatChatTime(msg.createdAt, userTimezone)}</span>
                      </div>
                      <div className="ag-body">{msg.content}</div>
                    </div>
                  </React.Fragment>
                );
              })}

              {/* Optimistic pending entry — rendered in ink */}
              {pendingMessage && (
                <div className="ag-entry ag-entry--user ag-entry--pending">
                  <div className="ag-entry-head">
                    <span className="ag-who">Ivan</span>
                    <span className="ag-time">Sending</span>
                  </div>
                  <div className="ag-body">{pendingMessage}</div>
                </div>
              )}

              {/* Typing indicator — mechanical ink squares */}
              {sending && (
                <div className="ag-typing">
                  <span className="ag-who ag-who--agent" style={{ color: 'var(--ec-mutedc)' }}>Agent</span>
                  <span className="ag-typing-dots"><i /><i /><i /></span>
                </div>
              )}

              <div ref={chatEndRef} style={{ height: 1 }} />
            </>
          )}
        </div>

        {showScrollDown && (
          <button className="ag-scroll-btn" data-ag="scroll-bottom" onClick={() => scrollToBottom(true)} aria-label="Scroll to latest">
            <ArrowDown className="w-4 h-4" />
          </button>
        )}

        {/* Input bar */}
        <div className="ag-input">
          <div className="ag-input-row">
            <textarea
              ref={inputRef}
              data-ag="textarea"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Transmit to n8nClaw…"
              rows={1}
              disabled={sending}
              className="ag-textarea"
            />
            <button className="ag-send" data-ag="send" onClick={handleSend} disabled={sending || !input.trim()} aria-label="Send">
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="ag-hint">Enter transmits · Shift + Enter for a new line · mirrored to WhatsApp</p>
        </div>
      </div>

      {/* ── THE BOX: unacknowledged alerts. The count is this screen's one red.
           Kept straight (no tilt) — .ec-box's heavy rule + offset hairline are
           border + outline on the same element, and rotating that combination
           sub-pixel-skews the hairline off the rule at any fractional angle. ── */}
      {unacked.length > 0 && (
        <div className="ec-box" style={{ marginLeft: 0, marginRight: 0 }}>
          <div className="ec-box-head">
            Warning: <span className="ec-red">{unacked.length}</span> unacknowledged alert{unacked.length === 1 ? '' : 's'}
          </div>
          <div className="ag-box-list">
            {unacked.slice(0, 4).map((a) => (
              <div className="ag-box-row" key={a.id}>
                <div className="ag-box-row-body">
                  <div className="ag-box-title" title={a.title}>{a.title}</div>
                  <div className="ag-box-meta">{a.alertType.replace(/_/g, ' ')} · {timeAgo(a.createdAt)}</div>
                </div>
                <button className="ag-act" data-ag="ack" onClick={() => acknowledgeAlert(a.id)}>Ack</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Register: alerts / reminders / summaries ──────────────────────────── */}
      <div className="ag-section-lbl">Alerts, reminders and summaries</div>
      <div className="ag-accs">
        {/* Alerts */}
        <Accordion title="Alerts" count={alerts.length} defaultOpen={unacked.length > 0} dataEl="alerts-accordion">
          {alerts.length === 0 ? (
            <div className="ag-acc-empty">No alerts on record.</div>
          ) : (
            alerts.slice(0, 20).map((a) => (
              <div className="ag-row" key={a.id}>
                <span className={`ag-dot ${a.sent ? 'ag-dot--off' : 'ag-dot--on'}`} />
                <div className="ag-row-body">
                  <div className="ag-row-title" title={a.title}>{a.title}</div>
                  <div className="ag-row-sub">
                    <span className="ag-tag">{a.alertType.replace(/_/g, ' ')}</span>
                    <span className="ag-row-meta">{timeAgo(a.createdAt)}</span>
                  </div>
                </div>
                {!a.sent && (
                  <button className="ag-act" data-ag="ack" onClick={() => acknowledgeAlert(a.id)}>Ack</button>
                )}
              </div>
            ))
          )}
        </Accordion>

        {/* Reminders */}
        <Accordion title="Reminders" count={reminders.length} defaultOpen={reminders.length > 0} dataEl="reminders-accordion">
          {reminders.length === 0 ? (
            <div className="ag-acc-empty">No pending reminders.</div>
          ) : (
            reminders.map((r) => (
              <div className="ag-row" key={r.id}>
                <div className="ag-row-body">
                  <div className="ag-row-title">{r.reminderText}</div>
                  <div className="ag-row-sub">
                    <span className="ag-row-meta" title={new Date(r.remindAt).toLocaleString()}>{timeAgo(r.remindAt)}</span>
                    {r.recurrence && <span className="ag-tag">{r.recurrence}</span>}
                  </div>
                </div>
                <button
                  className="ag-act-icon"
                  data-ag="complete"
                  onClick={() => completeReminder(r.id)}
                  title="Mark complete"
                  aria-label="Mark reminder complete"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </Accordion>

        {/* Summaries */}
        <Accordion title="Summaries" count={summaries.length} dataEl="summaries-accordion">
          {summaries.length === 0 ? (
            <div className="ag-acc-empty">No summaries yet.</div>
          ) : (
            summaries.map((s) => (
              <div className="ag-row" key={s.id} style={{ display: 'block' }}>
                <div className="ag-sum-head">
                  <span className="ag-sum-date">{new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  <span className="ag-sum-count">{s.messageCount} msgs</span>
                </div>
                <div className="ag-sum-body">{s.summary}</div>
                {s.topics.length > 0 && (
                  <div className="ag-sum-topics">
                    {s.topics.slice(0, 4).map((t, i) => <span className="ag-tag" key={i}>{t}</span>)}
                  </div>
                )}
              </div>
            ))
          )}
        </Accordion>
      </div>
    </div>
  );
};

export default AgentRebuilt;
