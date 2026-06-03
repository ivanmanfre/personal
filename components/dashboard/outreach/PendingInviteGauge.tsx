import React from 'react';

export function PendingInviteGauge({ pending, ceiling, oldestPendingDays }: { pending: number; ceiling: number; oldestPendingDays?: number | null }) {
  const pct = ceiling > 0 ? Math.min((pending / ceiling) * 100, 100) : 0;
  const danger = pct >= 90, warn = pct >= 70;
  const bar = danger ? 'bg-red-500' : warn ? 'bg-amber-500' : 'bg-emerald-500';
  const txt = danger ? 'text-red-400' : warn ? 'text-amber-400' : 'text-zinc-300';
  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-zinc-200">Pending invites</span>
        <span className={`text-sm font-mono font-semibold ${txt}`}>{pending}<span className="text-zinc-600">/{ceiling}</span></span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${pct}%` }} /></div>
      {danger && <p className="text-[10px] text-red-400 mt-1">Near LinkedIn&apos;s pending-invite ceiling — new invites may be throttled. (Phase 2 adds auto-withdraw.)</p>}
      {oldestPendingDays != null && <p className="text-[10px] text-zinc-500 mt-1">Oldest pending: {oldestPendingDays}d</p>}
    </div>
  );
}

export default PendingInviteGauge;
