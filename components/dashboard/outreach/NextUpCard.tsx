import React, { useMemo } from 'react';
import { Send, MessageSquare, UserCheck, Inbox, Mail } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import { timeAgo } from '../shared/utils';
import type { OutreachProspect } from '../../../types/dashboard';

interface Props {
  prospects: OutreachProspect[];
  cappedQueue: { connection_request: number; dm: number; inmail: number };
  inmailActivity: { sent: number; lastSent: string | null; recent: { name: string; sentAt: string }[] };
  onOpen: (p: OutreachProspect) => void;       // open detail / reply thread
  onArchive: (id: string, reason?: string) => void;
  onResolve: (id: string) => void;             // clear needs_manual_reply
}

const DAY = 86_400_000;
const ts = (s: string | null) => (s ? new Date(s).getTime() : 0);
const daysSince = (s: string | null) => (s ? Math.floor((Date.now() - ts(s)) / DAY) : null);

// The "who's next and when" command queue. Everything here is derived from the
// already-loaded `prospects` array — no extra fetch. Ordered by what actually
// needs Ivan: replies he owes > accepts about to auto-DM > what the sender fires next.
// Lanes with nothing in them hide themselves.
export const NextUpCard: React.FC<Props> = ({ prospects, cappedQueue, inmailActivity, onOpen, onArchive, onResolve }) => {
  const q = useMemo(() => {
    // Only count GENUINE inbound replies: needsManualReply is set on DM-send (not on inbound),
    // so it alone inflates the count. Require an actual reply (reply_count > 0) before a lead
    // counts as "owed a response".
    const repliesWaiting = prospects
      .filter((p) =>
        (p.replyCount ?? 0) > 0 &&
        (p.needsManualReply ||
          (p.stage === 'replied' && ts(p.lastReplyAt) > ts(p.lastDmSentAt)))
      )
      .sort((a, b) => ts(b.lastReplyAt) - ts(a.lastReplyAt)); // freshest reply first

    const acceptsToDm = prospects
      .filter((p) => p.stage === 'connected' && (p.dmCount ?? 0) === 0)
      .sort((a, b) => ts(b.connectedAt) - ts(a.connectedAt));

    // Change 4: removed invitesPending / deadInvites lane

    const nextToSend = prospects
      .filter((p) => p.stage === 'enriched')
      .sort(
        (a, b) =>
          (b.triggerConfidence ?? 0) - (a.triggerConfidence ?? 0) ||
          (b.icpScore ?? 0) - (a.icpScore ?? 0),
      );

    const invites7d = prospects.filter(
      (p) => p.connectionSentAt && Date.now() - ts(p.connectionSentAt) <= 7 * DAY,
    ).length;

    return { repliesWaiting, acceptsToDm, nextToSend, invites7d };
  }, [prospects]);

  // Change 4: removed deadInvites.length from totalWaiting
  const totalWaiting = q.repliesWaiting.length + q.acceptsToDm.length;
  const perDay = (q.invites7d / 7).toFixed(1);

  // Change 5: show next-sends lane if there are queued invites OR queued DMs/conn notes/inmails
  const hasNextSends = q.nextToSend.length > 0 || cappedQueue.dm > 0 || cappedQueue.connection_request > 0 || cappedQueue.inmail > 0;

  return (
    <PanelCard
      title="Next Up"
      accent="emerald"
      icon={<Send className="w-4 h-4" />}
      badge={totalWaiting > 0 ? `${totalWaiting} on you` : undefined}
      headerRight={
        <span className="text-[10px] text-zinc-500 font-mono tabular-nums">
          {q.invites7d} invites/wk · ~{perDay}/day · warm-first
        </span>
      }
    >
      <div className="divide-y divide-zinc-800/40">
        {/* Lane 1 — replies you owe (the money) */}
        {q.repliesWaiting.length > 0 && (
          <Lane
            marker="bg-red-400"
            icon={<MessageSquare className="w-3.5 h-3.5 text-red-400" />}
            label="Replies waiting on you"
            count={q.repliesWaiting.length}
          >
            <div className="space-y-1.5">
              {q.repliesWaiting.slice(0, 4).map((p) => {
                const stale = (daysSince(p.lastReplyAt) ?? 0) >= 7;
                return (
                  <div key={p.id} className="flex items-center gap-2">
                    <button
                      onClick={() => onOpen(p)}
                      className="flex-1 min-w-0 text-left group/row"
                    >
                      <span className="text-xs font-medium text-zinc-200 group-hover/row:text-emerald-300 transition-colors">{p.name}</span>
                      {p.company && <span className="text-[10px] text-zinc-500 ml-1.5 truncate">{p.company}</span>}
                      <span className={`text-[10px] ml-1.5 ${stale ? 'text-red-600' : 'text-zinc-500'}`}>
                        {p.lastReplyAt ? `replied ${timeAgo(p.lastReplyAt)}` : 'awaiting'}
                      </span>
                    </button>
                    <button
                      onClick={() => onOpen(p)}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 hover:bg-emerald-500/20 transition-colors shrink-0"
                    >
                      Open
                    </button>
                    <button
                      onClick={() => onResolve(p.id)}
                      title="Clear the needs-reply flag"
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium text-zinc-500 border border-zinc-700/40 hover:text-zinc-300 hover:border-zinc-600/60 transition-colors shrink-0"
                    >
                      Done
                    </button>
                  </div>
                );
              })}
              {q.repliesWaiting.length > 4 && (
                <span className="text-[10px] text-zinc-600">+{q.repliesWaiting.length - 4} more in Pipeline → Action Needed</span>
              )}
            </div>
          </Lane>
        )}

        {/* Lane 2 — just accepted, system drafts the DM next (read-only) */}
        {q.acceptsToDm.length > 0 && (
          <Lane
            marker="bg-pink-400"
            icon={<UserCheck className="w-3.5 h-3.5 text-pink-400" />}
            label="Accepted → DM drafting next"
            count={q.acceptsToDm.length}
          >
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {q.acceptsToDm.slice(0, 4).map((p) => p.name).join(', ')}
              {q.acceptsToDm.length > 4 && ` +${q.acceptsToDm.length - 4} more`}
              <span className="text-zinc-600"> · auto-drafts 6am–8pm ET, sends within ~2 min</span>
            </p>
          </Lane>
        )}

        {/* Lane 3 (new) — next sends: queued invites + DMs + connection notes */}
        {hasNextSends && (
          <Lane
            marker="bg-blue-400"
            icon={<Send className="w-3.5 h-3.5 text-blue-400" />}
            label="Next sends"
            count={q.nextToSend.length + cappedQueue.dm + cappedQueue.connection_request}
          >
            <div className="space-y-1">
              {q.nextToSend.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-[11px]">
                  <span className="text-zinc-300 truncate">{p.name}</span>
                  {p.company && <span className="text-zinc-500 truncate">{p.company}</span>}
                  {p.icpScore != null && (
                    <span className="ml-auto text-[10px] text-emerald-700 font-mono shrink-0">ICP {p.icpScore}</span>
                  )}
                </div>
              ))}
              {(cappedQueue.dm > 0 || cappedQueue.connection_request > 0) && (
                <p className="text-[10px] text-zinc-500">
                  + {cappedQueue.dm} DMs · {cappedQueue.connection_request} connection notes queued to send
                </p>
              )}
              <span className="text-[10px] text-zinc-600">sender fires hourly, warm-first ordering</span>
            </div>
          </Lane>
        )}

        {/* Lane 4 — InMail: sent audit-InMails (the sender fires these directly,
            so there's no pending queue; this shows what actually went out). */}
        <Lane
          marker="bg-violet-400"
          icon={<Mail className="w-3.5 h-3.5 text-violet-400" />}
          label="InMail"
          count={inmailActivity.sent}
        >
          {inmailActivity.sent > 0 ? (
            <div className="space-y-1">
              <p className="text-[11px] text-zinc-400">
                {inmailActivity.sent} sent{cappedQueue.inmail > 0 ? ` · ${cappedQueue.inmail} queued` : ''}
                {inmailActivity.lastSent && <span className="text-zinc-600"> · last {timeAgo(inmailActivity.lastSent)}</span>}
              </p>
              {inmailActivity.recent.length > 0 && (
                <p className="text-[10px] text-zinc-500 truncate">
                  recent: {inmailActivity.recent.map((r) => r.name).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-600">No InMails sent yet.</p>
          )}
        </Lane>

        {/* Nothing waiting */}
        {totalWaiting === 0 && !hasNextSends && (
          <div className="px-4 py-6 flex items-center gap-2 text-zinc-500">
            <Inbox className="w-4 h-4" />
            <span className="text-xs">Queue clear — nothing waiting on you right now.</span>
          </div>
        )}
      </div>
    </PanelCard>
  );
};

const Lane: React.FC<{
  marker: string;
  icon: React.ReactNode;
  label: string;
  count: number;
  children: React.ReactNode;
}> = ({ marker, icon, label, count, children }) => (
  <div className="flex gap-3 px-4 py-3">
    {/* sharp square marker (brand: no circular status dots) */}
    <span className={`mt-1 w-2 h-2 rounded-sm shrink-0 ${marker}`} />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[11px] font-medium text-zinc-300">{label}</span>
        <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-[10px] font-medium text-zinc-400 tabular-nums">{count}</span>
      </div>
      {children}
    </div>
  </div>
);

export default NextUpCard;
