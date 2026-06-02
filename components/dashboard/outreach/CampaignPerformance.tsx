import React from 'react';
import { TrendingUp } from 'lucide-react';
import { campaignPerformance } from './outreachHelpers';
import type { OutreachProspect } from '../../../types/dashboard';

export function CampaignPerformance({ prospects }: { prospects: OutreachProspect[] }) {
  const rows = campaignPerformance(prospects);
  if (rows.length === 0) return null;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        <span className="text-sm font-medium text-zinc-200">Campaign Performance</span>
        <span className="text-[10px] text-zinc-500">sent · connected · replied</span>
      </div>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
              <th className="text-left px-2 py-2">Campaign</th>
              <th className="text-right px-2 py-2">Sent</th>
              <th className="text-right px-2 py-2">Connected</th>
              <th className="text-right px-2 py-2">Replied</th>
              <th className="text-right px-2 py-2">Reply %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {rows.map((r) => {
              const lowSignal = r.sent < 10;
              return (
                <tr key={r.campaignId}>
                  <td className="px-2 py-2 text-zinc-200 truncate max-w-[200px]" title={r.name}>{r.name}</td>
                  <td className="px-2 py-2 text-right font-mono text-zinc-300">{r.sent}</td>
                  <td className="px-2 py-2 text-right font-mono text-zinc-400">{r.connected}</td>
                  <td className="px-2 py-2 text-right font-mono text-zinc-400">{r.replied}</td>
                  <td className={`px-2 py-2 text-right font-mono ${lowSignal ? 'text-zinc-600' : r.replyRate > 0 ? 'text-emerald-400' : 'text-zinc-400'}`}>
                    {lowSignal ? '—' : `${r.replyRate}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[9px] text-zinc-600 mt-2 px-1">Reply % hidden until a campaign has ≥10 invites sent (small-N noise).</p>
    </div>
  );
}

export default CampaignPerformance;
