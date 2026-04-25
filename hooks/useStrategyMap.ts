import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { plannedLeadMagnets } from '../lib/strategyConfig';
import type { StrategyMapData, StrategyCampaignSummary, StrategyLeadMagnetRow } from '../types/dashboard';

const ALL_STAGES = ['enriched', 'warming', 'engaged', 'connection_sent', 'connected', 'dm_sent', 'replied', 'archived'] as const;

function emptyStageCounts() {
  return { enriched: 0, warming: 0, engaged: 0, connection_sent: 0, connected: 0, dm_sent: 0, replied: 0, archived: 0, total: 0 };
}

export function useStrategyMap() {
  const [data, setData] = useState<StrategyMapData>({
    campaigns: [],
    leadMagnets: [],
    campaignsWithoutLM: [],
    paidAssessmentsThisMonth: 0,
    paidAssessmentsTotal: 0,
    activeClients: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetch = useCallback(async () => {
    try {
      // 1. Campaigns (active + deactivated)
      const { data: campaignsRaw } = await supabase
        .from('outreach_campaigns')
        .select('id, name, is_active, niche_tags, apollo_filters')
        .order('is_active', { ascending: false })
        .order('name');

      // 2. Prospects grouped by campaign + stage
      const { data: prospectsRaw } = await supabase
        .from('outreach_prospects')
        .select('campaign_id, stage');

      // 3. Lead magnets (all of them)
      const { data: lmsRaw } = await supabase
        .from('lead_magnets')
        .select('id, title, format, status, resource_page_url, updated_at')
        .order('created_at', { ascending: false });

      // 4. content_industry_map for LM <-> campaign mapping
      const { data: mappingsRaw } = await supabase
        .from('content_industry_map')
        .select('content_id, content_type, industry_cluster')
        .eq('content_type', 'lead_magnet');

      // 5. Paid assessments (count this month + total)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: paThisMonthCount } = await supabase
        .from('paid_assessments')
        .select('id', { count: 'exact', head: true })
        .gte('paid_at', startOfMonth.toISOString())
        .eq('status', 'paid');

      const { count: paTotalCount } = await supabase
        .from('paid_assessments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'paid');

      // 6. Active client instances
      const { count: activeClientsCount } = await supabase
        .from('client_instances')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);

      // ── Build campaigns summary ──
      const stageCountsByCampaign = new Map<string, ReturnType<typeof emptyStageCounts>>();
      for (const c of (campaignsRaw || [])) {
        stageCountsByCampaign.set(c.id, emptyStageCounts());
      }
      for (const p of (prospectsRaw || [])) {
        const counts = stageCountsByCampaign.get(p.campaign_id);
        if (!counts) continue;
        if (ALL_STAGES.includes(p.stage as any)) {
          (counts as any)[p.stage]++;
        }
        counts.total++;
      }

      const campaigns: StrategyCampaignSummary[] = (campaignsRaw || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        isActive: c.is_active,
        niche: c.niche_tags || [],
        apolloTitles: c.apollo_filters?.person_titles || [],
        apolloLocations: c.apollo_filters?.person_locations || [],
        apolloKeywords: c.apollo_filters?.q_organization_keyword_tags || [],
        apolloEmployeeRanges: c.apollo_filters?.organization_num_employees_ranges || [],
        prospectCounts: stageCountsByCampaign.get(c.id) || emptyStageCounts(),
      }));

      // ── Build LM inventory + demand calc ──
      function clusterOfCampaign(name: string): string {
        const n = name.toLowerCase();
        if (n.includes('marketing') || n.includes('agency') || n.includes('agencies')) return 'agency';
        if (n.includes('consultanc') || n.includes('strategy')) return 'consulting';
        if (n.includes('accounting') || n.includes('tax')) return 'accounting';
        if (n.includes('research') || n.includes('insight')) return 'research';
        if (n.includes('architect') || n.includes('design')) return 'architecture';
        if (n.includes('law')) return 'law';
        if (n.includes('coach') || n.includes('advisor')) return 'coaching';
        return 'unknown';
      }

      const clusterToActiveCampaigns = new Map<string, StrategyCampaignSummary[]>();
      for (const c of campaigns.filter(c => c.isActive)) {
        const cluster = clusterOfCampaign(c.name);
        if (!clusterToActiveCampaigns.has(cluster)) clusterToActiveCampaigns.set(cluster, []);
        clusterToActiveCampaigns.get(cluster)!.push(c);
      }

      // Group mappings by content_id → set of clusters
      const clustersByLmId = new Map<string, Set<string>>();
      for (const m of (mappingsRaw || [])) {
        if (!clustersByLmId.has(m.content_id)) clustersByLmId.set(m.content_id, new Set());
        clustersByLmId.get(m.content_id)!.add(m.industry_cluster);
      }

      const liveLeadMagnets: StrategyLeadMagnetRow[] = (lmsRaw || []).map((lm: any) => {
        const clusters = clustersByLmId.get(lm.id) || new Set<string>();
        const mappedCampaigns: StrategyCampaignSummary[] = [];
        for (const cluster of clusters) {
          const cs = clusterToActiveCampaigns.get(cluster);
          if (cs) mappedCampaigns.push(...cs);
        }
        const demand = mappedCampaigns.reduce((sum, c) => sum + c.prospectCounts.enriched, 0);
        return {
          id: lm.id,
          title: lm.title,
          format: lm.format || 'Unknown',
          status: lm.status || 'unknown',
          resourcePageUrl: lm.resource_page_url,
          mappedCampaigns: mappedCampaigns.map(c => c.name),
          demand,
          isPlanned: false,
          lastUpdated: lm.updated_at,
        };
      });

      // Add planned LMs from static config
      const plannedRows: StrategyLeadMagnetRow[] = plannedLeadMagnets.map(p => {
        const cs = clusterToActiveCampaigns.get(p.industryCluster) || [];
        const demand = cs.reduce((sum, c) => sum + c.prospectCounts.enriched, 0);
        return {
          id: `planned:${p.slug}`,
          title: p.title,
          format: p.format,
          status: 'planned',
          resourcePageUrl: null,
          mappedCampaigns: cs.map(c => c.name),
          demand,
          isPlanned: true,
          lastUpdated: null,
        };
      });

      const leadMagnets = [...liveLeadMagnets, ...plannedRows];

      // ── Compute campaigns without ANY mapped LM (live or planned) ──
      const campaignsCovered = new Set<string>();
      for (const lm of leadMagnets) {
        for (const cn of lm.mappedCampaigns) campaignsCovered.add(cn);
      }
      const campaignsWithoutLM = campaigns
        .filter(c => c.isActive)
        .filter(c => !campaignsCovered.has(c.name))
        .map(c => c.name);

      setData({
        campaigns,
        leadMagnets,
        campaignsWithoutLM,
        paidAssessmentsThisMonth: paThisMonthCount || 0,
        paidAssessmentsTotal: paTotalCount || 0,
        activeClients: activeClientsCount || 0,
      });
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('useStrategyMap fetch failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 5 * 60 * 1000); // 5 min
    return () => clearInterval(interval);
  }, [fetch]);

  return { ...data, loading, lastRefreshed, refresh: fetch };
}
