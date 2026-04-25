import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, ArrowRight, ExternalLink as ExtLink } from 'lucide-react';
import PanelCard from '../shared/PanelCard';
import { funnelTouchpoints } from '../../../lib/strategyConfig';

interface Props {
  paidAssessmentsThisMonth: number;
}

export const FunnelTouchpointsSection: React.FC<Props> = ({ paidAssessmentsThisMonth }) => {
  return (
    <PanelCard title="Funnel Touchpoints" accent="amber">
      <div className="space-y-3">
        <p className="text-[11px] text-zinc-500">The 4 touchpoints from the 2026-04-19 strategy doc. Lead magnets feed into Touchpoint #1 (not direct-to-CTA).</p>
        <div className="space-y-2">
          {funnelTouchpoints.map((tp, i) => (
            <React.Fragment key={tp.step}>
              <TouchpointRow
                touchpoint={tp}
                liveMetric={tp.step === 3 ? `${paidAssessmentsThisMonth} sold this month` : tp.metric}
              />
              {i < funnelTouchpoints.length - 1 && (
                <div className="flex justify-center">
                  <ArrowRight className="w-3 h-3 text-zinc-700" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </PanelCard>
  );
};

const TouchpointRow: React.FC<{ touchpoint: typeof funnelTouchpoints[0]; liveMetric: string | null }> = ({ touchpoint, liveMetric }) => {
  const Icon = touchpoint.buildStatus === 'built' ? CheckCircle2 : touchpoint.buildStatus === 'partial' ? AlertCircle : XCircle;
  const iconColor = touchpoint.buildStatus === 'built' ? 'text-emerald-400' : touchpoint.buildStatus === 'partial' ? 'text-amber-400' : 'text-zinc-600';
  return (
    <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
        <span className="text-[10px] font-mono text-zinc-500 w-4 shrink-0">{touchpoint.step}</span>
        <span className="text-sm text-zinc-200 font-medium flex-1 min-w-0 truncate">{touchpoint.name}</span>
        {touchpoint.url && (
          <a href={touchpoint.url} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-cyan-400 transition-colors shrink-0">
            <ExtLink className="w-3 h-3" />
          </a>
        )}
      </div>
      <p className="text-[11px] text-zinc-500 mt-1 ml-7">{touchpoint.description}</p>
      {liveMetric && <p className="text-[10px] text-zinc-400 mt-1 ml-7 font-mono">{liveMetric}</p>}
    </div>
  );
};
