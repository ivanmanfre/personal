import React, { useState } from 'react';
import { AlertTriangle, ExternalLink as ExtLink } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import type { StrategyLeadMagnetRow } from '../../../types/dashboard';

interface Props {
  leadMagnets: StrategyLeadMagnetRow[];
  campaignsWithoutLM: string[];
}

type SortKey = 'demand' | 'status' | 'title';

export const LeadMagnetInventorySection: React.FC<Props> = ({ leadMagnets, campaignsWithoutLM }) => {
  const [sortKey, setSortKey] = useState<SortKey>('demand');
  const [showAll, setShowAll] = useState(false);

  const sorted = [...leadMagnets].sort((a, b) => {
    if (sortKey === 'demand') return b.demand - a.demand;
    if (sortKey === 'status') return a.status.localeCompare(b.status);
    return a.title.localeCompare(b.title);
  });

  const visible = showAll ? sorted : sorted.slice(0, 12);
  const plannedCount = leadMagnets.filter(l => l.isPlanned).length;
  const liveCount = leadMagnets.filter(l => l.status === 'scheduled' || l.status === 'live' || l.status === 'published').length;

  return (
    <PanelCard title="Lead Magnet Inventory" accent="purple">
      <div className="space-y-3">
        {/* Gap banner */}
        {campaignsWithoutLM.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="text-xs text-red-300">
              <p className="font-medium mb-0.5">{campaignsWithoutLM.length} active campaign{campaignsWithoutLM.length > 1 ? 's' : ''} without a matched lead magnet:</p>
              <p className="text-red-300/80">{campaignsWithoutLM.join(' · ')}</p>
              <p className="text-red-300/60 mt-1 text-[11px]">Outreach Email 1 will SKIP for prospects in these campaigns until a resource is mapped.</p>
            </div>
          </div>
        )}

        {/* Summary line */}
        <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
          <span>{leadMagnets.length} total</span>
          <span className="text-zinc-600">·</span>
          <span className="text-emerald-400">{liveCount} live/scheduled</span>
          <span className="text-zinc-600">·</span>
          <span className="text-amber-400">{plannedCount} planned</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="text-zinc-600">sort:</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="bg-zinc-800/60 border border-zinc-700/40 rounded px-2 py-0.5 text-[11px] text-zinc-300 cursor-pointer"
            >
              <option value="demand">Demand</option>
              <option value="status">Status</option>
              <option value="title">Title</option>
            </select>
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto -mx-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                <th className="text-left px-3 py-2">Title</th>
                <th className="text-left px-3 py-2">Format</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Mapped Campaigns</th>
                <th className="text-right px-3 py-2">Demand</th>
                <th className="text-center px-3 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {visible.map(lm => (
                <tr key={lm.id} className={lm.isPlanned ? 'bg-amber-500/5' : ''}>
                  <td className="px-3 py-2 text-zinc-200 max-w-[280px] truncate" title={lm.title}>{lm.title}</td>
                  <td className="px-3 py-2 text-zinc-400">{lm.format}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={lm.status} />
                  </td>
                  <td className="px-3 py-2 text-zinc-400 max-w-[200px] truncate" title={lm.mappedCampaigns.join(', ')}>
                    {lm.mappedCampaigns.length > 0 ? lm.mappedCampaigns.join(', ') : <span className="text-zinc-600">unmapped</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-mono font-semibold ${lm.demand > 0 ? 'text-zinc-200' : 'text-zinc-600'}`}>{lm.demand}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {lm.resourcePageUrl && (
                      <a href={lm.resourcePageUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-cyan-400 transition-colors inline-block">
                        <ExtLink className="w-3 h-3" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!showAll && sorted.length > 12 && (
          <button onClick={() => setShowAll(true)} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors">
            Show all {sorted.length} →
          </button>
        )}
      </div>
    </PanelCard>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colorMap: Record<string, string> = {
    'live': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    'published': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    'scheduled': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    'review': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    'draft': 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
    'planned': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  };
  const cls = colorMap[status] || 'bg-zinc-500/15 text-zinc-500 border-zinc-500/25';
  return <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${cls}`}>{status}</span>;
};
