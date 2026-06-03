import React, { useMemo, useState } from 'react';
import { MessageSquare, Send, ArrowLeft } from 'lucide-react';
import type { OutreachProspect, OutreachMessage } from '../../../../types/dashboard';
import EmptyState from '../../shared/EmptyState';
import { timeAgo } from '../../shared/utils';
import { toastSuccess, toastError } from '../../../../lib/dashboardActions';

const REPLY_WEBHOOK = 'https://n8n.ivanmanfredi.com/webhook/outreach-inbox-reply';
const REPLY_SECRET = 'ivreply_9f3k2p7q';

const ACTIVE_STAGES = ['connected', 'dm_sent', 'replied'];

interface InboxTabProps {
  prospects: OutreachProspect[];
  messages: Record<string, OutreachMessage[]>;
  fetchMessages: (prospectId: string) => Promise<void>;
  onSelectProspect: (p: OutreachProspect | null) => void;
}

// Optimistic bubble shape — superset of the fields we render.
type ChatBubble = Pick<OutreachMessage, 'id' | 'direction' | 'messageText'> & {
  sentAt?: string | null;
  createdAt?: string | null;
  isReaction?: boolean;
  optimistic?: boolean;
};

function bubbleTime(m: ChatBubble): string {
  return timeAgo(m.sentAt || m.createdAt || null);
}

export const InboxTab: React.FC<InboxTabProps> = ({ prospects, messages, fetchMessages, onSelectProspect }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Optimistic outbound bubbles, keyed by prospect id (cleared on re-fetch).
  const [optimistic, setOptimistic] = useState<Record<string, ChatBubble[]>>({});
  // Locally-cleared needs-reply badges (so the badge disappears after a send).
  const [clearedReply, setClearedReply] = useState<Set<string>>(new Set());

  // ─── Conversation list: active conversations only ───
  const conversations = useMemo(() => {
    const list = prospects.filter((p) => ACTIVE_STAGES.includes(p.stage));
    const replyTs = (p: OutreachProspect) => p.lastReplyAt || p.updatedAt || '';
    return list.sort((a, b) => {
      // Genuine inbound replies (reply_count > 0) sort first — NOT needs_manual_reply,
      // which the pipeline sets when WE send a DM (so it's true for silent prospects too).
      const aNeeds = a.replyCount > 0 && !clearedReply.has(a.id);
      const bNeeds = b.replyCount > 0 && !clearedReply.has(b.id);
      if (aNeeds !== bNeeds) return aNeeds ? -1 : 1;
      return replyTs(b).localeCompare(replyTs(a));
    });
  }, [prospects, clearedReply]);

  const selected = useMemo(
    () => conversations.find((p) => p.id === selectedId) || null,
    [conversations, selectedId],
  );

  const select = (p: OutreachProspect) => {
    setSelectedId(p.id);
    setReply('');
    setSendError(null);
    // Render the thread inline in the right pane — do NOT open the full
    // ProspectDetailModal here (it would cover the inbox). Full details stay
    // reachable via the "Details" affordance in the thread header.
    void fetchMessages(p.id);
  };

  const backToList = () => {
    setSelectedId(null);
  };

  // "Needs reply" = THEY actually replied (reply_count > 0) and we haven't answered.
  // needs_manual_reply is unreliable (pipeline sets it on DM-send, not on inbound).
  const needsReply = (p: OutreachProspect) => p.replyCount > 0 && !clearedReply.has(p.id);

  // Thread = fetched messages + any optimistic bubbles not yet reflected by a re-fetch.
  const thread: ChatBubble[] | undefined = useMemo(() => {
    if (!selectedId) return undefined;
    const loaded = messages[selectedId];
    if (loaded === undefined) return undefined; // not yet fetched
    const opt = optimistic[selectedId] || [];
    return [...(loaded as ChatBubble[]), ...opt];
  }, [selectedId, messages, optimistic]);

  const handleSend = async () => {
    const text = reply.trim();
    if (!text || !selectedId || sending) return;
    setSending(true);
    setSendError(null);

    // Optimistic outbound bubble.
    const tempId = `optimistic-${Date.now()}`;
    setOptimistic((prev) => ({
      ...prev,
      [selectedId]: [
        ...(prev[selectedId] || []),
        {
          id: tempId,
          direction: 'outbound',
          messageText: text,
          createdAt: new Date().toISOString(),
          sentAt: new Date().toISOString(),
          optimistic: true,
        },
      ],
    }));

    try {
      const res = await fetch(REPLY_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_id: selectedId, text, secret: REPLY_SECRET }),
      });
      let body: { ok?: boolean; error?: string } = {};
      try {
        body = await res.json();
      } catch {
        /* tolerate empty/non-JSON success bodies */
      }
      if (!res.ok || body.ok === false) {
        throw new Error(body.error || `Send failed (HTTP ${res.status})`);
      }
      // Success: clear textarea, drop optimistic (re-fetch will carry the real row),
      // re-fetch the thread, and locally clear the needs-reply badge.
      setReply('');
      setClearedReply((prev) => new Set(prev).add(selectedId));
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[selectedId];
        return next;
      });
      await fetchMessages(selectedId);
      toastSuccess('Reply sent');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send reply';
      setSendError(msg);
      // Roll back the optimistic bubble; keep the typed text so Ivan can retry.
      setOptimistic((prev) => ({
        ...prev,
        [selectedId]: (prev[selectedId] || []).filter((b) => b.id !== tempId),
      }));
      toastError('send reply', err);
    } finally {
      setSending(false);
    }
  };

  // ─── Sub-renders ───
  const listPane = (
    <div className="space-y-1.5 overflow-y-auto pr-1">
      {conversations.length === 0 ? (
        <EmptyState
          title="Inbox clear"
          description="No active conversations right now."
          icon={<MessageSquare className="w-10 h-10" />}
        />
      ) : (
        conversations.map((p) => {
          const active = p.id === selectedId;
          const subtitle = [p.title || p.headline, p.company].filter(Boolean).join(' @ ');
          return (
            <button
              key={p.id}
              onClick={() => select(p)}
              className={`w-full text-left rounded-xl p-3 border transition-colors flex items-start justify-between gap-2 ${
                active
                  ? 'bg-emerald-500/10 border-emerald-500/40'
                  : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="font-medium text-zinc-200 text-sm truncate">{p.name}</p>
                  {needsReply(p) ? (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      needs reply
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/30 text-zinc-500 border border-zinc-700/40">
                      awaiting
                    </span>
                  )}
                </div>
                {subtitle && <p className="text-[11px] text-zinc-500 truncate mt-0.5">{subtitle}</p>}
              </div>
              <span className="text-[10px] text-zinc-500 shrink-0 mt-0.5">
                {timeAgo(p.lastReplyAt || p.updatedAt)}
              </span>
            </button>
          );
        })
      )}
    </div>
  );

  const threadPane = !selected ? (
    <div className="hidden md:flex flex-1 items-center justify-center text-center">
      <div className="text-zinc-600">
        <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Select a conversation</p>
      </div>
    </div>
  ) : (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Thread header */}
      <div className="flex items-center gap-2 pb-3 mb-3 border-b border-zinc-800">
        <button
          onClick={backToList}
          className="md:hidden flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="min-w-0">
          <p className="font-medium text-zinc-200 text-sm truncate">{selected.name}</p>
          <p className="text-[11px] text-zinc-500 truncate">
            {[selected.title || selected.headline, selected.company].filter(Boolean).join(' @ ')}
          </p>
        </div>
        <button
          onClick={() => onSelectProspect(selected)}
          className="ml-auto shrink-0 text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 border border-zinc-700/50 rounded px-2 py-1 transition-colors"
        >
          Details
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[200px]">
        {thread === undefined ? (
          <p className="text-xs text-zinc-500 py-4 text-center">Loading…</p>
        ) : thread.length === 0 ? (
          <p className="text-xs text-zinc-600 py-4 text-center">No messages yet.</p>
        ) : (
          thread.map((m) => {
            if (m.isReaction) {
              return (
                <p key={m.id} className="text-[10px] text-zinc-600 italic text-center">
                  reacted {bubbleTime(m)}
                </p>
              );
            }
            const outbound = m.direction === 'outbound';
            return (
              <div key={m.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                    outbound
                      ? `bg-emerald-500/15 text-emerald-100 border border-emerald-500/25 ${m.optimistic ? 'opacity-60' : ''}`
                      : 'bg-zinc-800/70 text-zinc-300 border border-zinc-700/40'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.messageText}</p>
                  <span className="block text-[10px] text-zinc-500 mt-1">{bubbleTime(m)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply box */}
      <div className="pt-3 mt-3 border-t border-zinc-800 space-y-2">
        {sendError && <p className="text-[11px] text-red-400">{sendError}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Type a reply…"
            rows={2}
            disabled={sending}
            className="flex-1 resize-none rounded-xl bg-zinc-900/80 border border-zinc-800 focus:border-emerald-500/40 outline-none text-xs text-zinc-200 px-3 py-2 placeholder:text-zinc-600 disabled:opacity-50"
          />
          <button
            onClick={() => void handleSend()}
            disabled={sending || !reply.trim()}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Send className="w-3 h-3" /> {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );

  // Mobile: single pane. Show thread full-width once a conversation is selected.
  const mobilePane = selected ? threadPane : listPane;

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-3 md:p-4">
      {/* Desktop: two panes */}
      <div className="hidden md:flex gap-4 h-[600px]">
        <div className="w-[320px] shrink-0 flex flex-col min-h-0">{listPane}</div>
        <div className="flex-1 flex flex-col min-h-0 border-l border-zinc-800 pl-4">{threadPane}</div>
      </div>
      {/* Mobile: single pane */}
      <div className="md:hidden flex flex-col h-[560px]">{mobilePane}</div>
    </div>
  );
};

export default InboxTab;
