import React from 'react';
import { ExternalLink as ExtLink, EyeOff } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import { offerLadder } from '../../../lib/strategyConfig';

interface Props {
  paidAssessmentsThisMonth: number;
  paidAssessmentsTotal: number;
  activeClients: number;
}

export const OfferLadderSection: React.FC<Props> = ({ paidAssessmentsThisMonth, paidAssessmentsTotal, activeClients }) => {
  return (
    <PanelCard title="Offer Ladder" accent="emerald">
      <div className="space-y-2">
        {offerLadder.map(rung => (
          <RungRow
            key={rung.id}
            rung={rung}
            extraMetric={
              rung.id === 'agent-ready-2500' ? `${paidAssessmentsThisMonth} this month · ${paidAssessmentsTotal} total` :
              (rung.id === 'care-plan' || rung.id.startsWith('fractional')) ? (activeClients > 0 ? `${activeClients} active clients (any tier)` : null) :
              null
            }
          />
        ))}
      </div>
    </PanelCard>
  );
};

const RungRow: React.FC<{ rung: typeof offerLadder[0]; extraMetric: string | null }> = ({ rung, extraMetric }) => {
  const tierColor: Record<string, string> = {
    free: 'text-zinc-400',
    low: 'text-blue-400',
    mid: 'text-purple-400',
    high: 'text-amber-400',
    enterprise: 'text-emerald-400',
  };
  const statusColor: Record<string, string> = {
    live: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    internal: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
    planned: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    'sold-out': 'bg-red-500/15 text-red-400 border-red-500/25',
  };
  return (
    <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`font-mono font-bold w-28 shrink-0 ${tierColor[rung.priceTier]}`}>{rung.priceLabel}</span>
          <span className="text-sm text-zinc-200 font-medium truncate">{rung.name}</span>
          {rung.visibility === 'unlisted' && <EyeOff className="w-3 h-3 text-zinc-600 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${statusColor[rung.status]}`}>{rung.status}</span>
          {(rung.resourceUrl || rung.stripeUrl) && (
            <a href={rung.resourceUrl || rung.stripeUrl || '#'} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-cyan-400 transition-colors">
              <ExtLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
      <p className="text-[11px] text-zinc-500 mt-1 ml-[120px]">{rung.description}</p>
      {extraMetric && <p className="text-[10px] text-zinc-400 mt-1 ml-[120px] font-mono">{extraMetric}</p>}
    </div>
  );
};
