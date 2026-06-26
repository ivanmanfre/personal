import React, { useMemo } from 'react';
import { Send, MessageSquare, UserCheck, Clock, Inbox } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import { timeAgo } from '../shared/utils';
import type { OutreachProspect } from '../../../types/dashboard';

interface Props {
  prospects: OutreachProspect[];
  onOpen: (p: OutreachProspect) => void;       // open detail / reply thread
  onArchive: (id: string, reason?: string) => void;
  onResolve: (id: string) => void;             // clear needs_manual_reply
}

const DAY = 86_400_000;
const DEAD_INVITE_DAYS = 14; // invites older than this almost never accept
const ts = (s: string | null) => (s ? new Date(s).getTime() : 0);
const daysSince = (s: string | null) => (s ? Math.floor((Date.now() - ts(s)) / DAY) : null);

// The "who's next and when" command queue. Everything here is derived from the
// already-loaded `prospects` array — no extra fetch. Ordered by what actually
// needs Ivan: replies he owes > accepts about to auto-DM > invites to prune >
// what the sender fires next. Lanes with nothing in them hide themselves.
export const NextUpCard: React.FC<Props> = ({ prospects, onOpen, onArchive, onResolve }) => {
  const q = useMemo(() => {
    const repliesWaiting = prospects
      .filter((p) => p.needsManualReply)
      .sort((a, b) => ts(b.lastReplyAt) - ts(a.lastReplyAt)); // freshest reply first

    const acceptsToDm = prospects
      .filter((p) => p.stage === 'connected' && (p.dmCount ?? 0) === 0)
      .sort((a, b) => ts(b.connectedAt) - ts(a.connectedAt));

    const invitesPending = prospects
      .filter((p) => p.stage === 'connection_sent')
      .sort((a, b) => ts(a.connectionSentAt) - ts(b.connectionSentAt)); // oldest first
    const deadInvites = invitesPending.filter(
      (p) => (daysSince(p.connectionSentAt) ?? 0) >= DEAD_INVITE_DAYS,
    );

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

    return { repliesWaiting, acceptsToDm, invitesPending, deadInvites, nextToSend, invites7d };
  }, [prospects]);

  const totalWaiting = q.repliesWaiting.length + q.acceptsToDm.length + q.deadInvites.length;
  const perDay = (q.invites7d / 7).toFixed(1);

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
                      <span className={`text-[10px] ml-1.5 ${stale ? 'text-red-400/80' : 'text-zinc-500'}`}>
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

        {/* Lane 3 — invites aging out; dead ones get a prune button */}
        {q.invitesPending.length > 0 && (
          <Lane
            marker="bg-cyan-400"
            icon={<Clock className="w-3.5 h-3.5 text-cyan-400" />}
            label="Invites pending acceptance"
            count={q.invitesPending.length}
          >
            {q.deadInvites.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[10px] text-red-400/80">
                  {q.deadInvites.length} stale {q.deadInvites.length === 1 ? 'invite' : 'invites'} ({DEAD_INVITE_DAYS}+ days, unlikely to accept) — prune to clean counts:
                </p>
                {q.deadInvites.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-xs text-zinc-300 truncate">
                      {p.name}
                      {p.company && <span className="text-[10px] text-zinc-500 ml-1.5">{p.company}</span>}
                      <span className="text-[10px] text-zinc-600 ml-1.5">{daysSince(p.connectionSentAt)}d pending</span>
                    </span>
                    <button
                      onClick={() => onArchive(p.id, 'stale_invite')}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium text-zinc-500 border border-zinc-700/40 hover:text-red-300 hover:border-red-500/30 transition-colors shrink-0"
                    >
                      Archive
                    </button>
                  </div>
                ))}
                {q.deadInvites.length > 4 && (
                  <span className="text-[10px] text-zinc-600">+{q.deadInvites.length - 4} more stale</span>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500">
                Oldest pending {daysSince(q.invitesPending[0].connectionSentAt)}d — all within the accept window.
              </p>
            )}
          </Lane>
        )}

        {/* Lane 4 — what the sender fires next (read-only) */}
        {q.nextToSend.length > 0 && (
          <Lane
            marker="bg-blue-400"
            icon={<Send className="w-3.5 h-3.5 text-blue-400" />}
            label="Next invites to send"
            count={q.nextToSend.length}
          >
            <div className="space-y-1">
              {q.nextToSend.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-[11px]">
                  <span className="text-zinc-300 truncate">{p.name}</span>
                  {p.company && <span className="text-zinc-500 truncate">{p.company}</span>}
                  {p.icpScore != null && (
                    <span className="ml-auto text-[10px] text-emerald-400/80 font-mono shrink-0">ICP {p.icpScore}</span>
                  )}
                </div>
              ))}
              <span className="text-[10px] text-zinc-600">sender fires hourly, warm-first ordering</span>
            </div>
          </Lane>
        )}

        {/* Nothing waiting */}
        {totalWaiting === 0 && q.nextToSend.length === 0 && (
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
