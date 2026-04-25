import React from 'react';
import { Map } from 'lucide-react';
import { useStrategyMap } from '../../hooks/useStrategyMap';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import { ICPCampaignsSection } from './strategy/ICPCampaignsSection';
import { LeadMagnetInventorySection } from './strategy/LeadMagnetInventorySection';
import { OfferLadderSection } from './strategy/OfferLadderSection';
import { FunnelTouchpointsSection } from './strategy/FunnelTouchpointsSection';
import { CrossReferencesSection } from './strategy/CrossReferencesSection';
import { SourceOfTruthSection } from './strategy/SourceOfTruthSection';

const StrategyPanel: React.FC = () => {
  const {
    campaigns, leadMagnets, campaignsWithoutLM,
    paidAssessmentsThisMonth, paidAssessmentsTotal, activeClients,
    loading, lastRefreshed, refresh,
  } = useStrategyMap();

  if (loading) return <LoadingSkeleton cards={6} rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-6 h-6 text-zinc-300" />
          <h1 className="text-2xl font-bold tracking-tight">Strategy Map</h1>
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      <ICPCampaignsSection campaigns={campaigns} campaignsWithoutLM={campaignsWithoutLM} />
      <LeadMagnetInventorySection leadMagnets={leadMagnets} campaignsWithoutLM={campaignsWithoutLM} />
      <OfferLadderSection
        paidAssessmentsThisMonth={paidAssessmentsThisMonth}
        paidAssessmentsTotal={paidAssessmentsTotal}
        activeClients={activeClients}
      />
      <FunnelTouchpointsSection paidAssessmentsThisMonth={paidAssessmentsThisMonth} />
      <CrossReferencesSection />
      <SourceOfTruthSection />
    </div>
  );
};

export default StrategyPanel;
