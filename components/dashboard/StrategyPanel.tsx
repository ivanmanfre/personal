import React from 'react';
import { Map } from 'lucide-react';
import { useStrategyMap } from '../../hooks/useStrategyMap';
import LoadingSkeleton from './shared/LoadingSkeleton';

const StrategyPanel: React.FC = () => {
  const { campaigns, leadMagnets, campaignsWithoutLM, paidAssessmentsThisMonth, paidAssessmentsTotal, activeClients, loading } = useStrategyMap();

  if (loading) return <LoadingSkeleton cards={6} rows={4} />;

  // Debug-render: temporary, replaced in later phases
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Map className="w-6 h-6 text-zinc-300" />
        <h1 className="text-2xl font-bold tracking-tight">Strategy Map</h1>
      </div>
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-4 text-xs text-zinc-400 font-mono">
        <p>campaigns: {campaigns.length} (active: {campaigns.filter(c => c.isActive).length})</p>
        <p>leadMagnets: {leadMagnets.length} (planned: {leadMagnets.filter(l => l.isPlanned).length})</p>
        <p>campaignsWithoutLM: {campaignsWithoutLM.length} → {campaignsWithoutLM.join(', ') || 'none'}</p>
        <p>paidAssessmentsThisMonth: {paidAssessmentsThisMonth}</p>
        <p>paidAssessmentsTotal: {paidAssessmentsTotal}</p>
        <p>activeClients: {activeClients}</p>
      </div>
    </div>
  );
};

export default StrategyPanel;
