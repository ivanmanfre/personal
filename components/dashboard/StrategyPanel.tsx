import React from 'react';
import { Map } from 'lucide-react';
import { useStrategyMap } from '../../hooks/useStrategyMap';
import LoadingSkeleton from './shared/LoadingSkeleton';
import { ICPCampaignsSection } from './strategy/ICPCampaignsSection';

const StrategyPanel: React.FC = () => {
  const { campaigns, leadMagnets, campaignsWithoutLM, paidAssessmentsThisMonth, paidAssessmentsTotal, activeClients, loading } = useStrategyMap();

  if (loading) return <LoadingSkeleton cards={6} rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Map className="w-6 h-6 text-zinc-300" />
        <h1 className="text-2xl font-bold tracking-tight">Strategy Map</h1>
      </div>

      <ICPCampaignsSection campaigns={campaigns} campaignsWithoutLM={campaignsWithoutLM} />

      {/* Phase 5+ sections appear here */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 text-xs text-zinc-500 font-mono">
        TODO Phase 5+: leadMagnets={leadMagnets.length}, paidAssessmentsThisMonth={paidAssessmentsThisMonth}, paidAssessmentsTotal={paidAssessmentsTotal}, activeClients={activeClients}
      </div>
    </div>
  );
};

export default StrategyPanel;
