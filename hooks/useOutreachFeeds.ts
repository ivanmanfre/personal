import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toastError, toastSuccess } from '../lib/dashboardActions';
import type { HarvestSource, HiringRoleOffer, DomainScreenBands } from '../types/dashboard';

function mapHarvest(r: any): HarvestSource {
  return {
    id: r.id,
    name: r.name,
    linkedinUrl: r.linkedin_url || null,
    linkedinProfileId: r.linkedin_profile_id || null,
    sourceTier: r.source_tier || null,
    status: r.status || 'active',
    lastHarvestedAt: r.last_harvested_at || null,
    postsSeen: r.posts_seen || 0,
    engagersInserted: r.engagers_inserted || 0,
    notes: r.notes || null,
    createdAt: r.created_at || null,
  };
}

const emptyBands: DomainScreenBands = { hot: 0, warm: 0, cold: 0, total: 0 };

/**
 * Sibling to useOutreachPipeline — surfaces the three new prospect-source feeds
 * (harvest_sources, hiring_role_offer_map, domain_screens intent bands). Kept
 * separate so the heavy pipeline hook stays focused; both refresh independently.
 */
export function useOutreachFeeds() {
  const [harvestSources, setHarvestSources] = useState<HarvestSource[]>([]);
  const [hiringMap, setHiringMap] = useState<HiringRoleOffer[]>([]);
  const [bands, setBands] = useState<DomainScreenBands>(emptyBands);
  const [hotDomains, setHotDomains] = useState<Set<string>>(new Set());
  const [recentHotDomains, setRecentHotDomains] = useState<{ domain: string; intentScore: number | null; screenedAt: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoaded = useRef(false);

  const fetch = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true);
    try {
      const [harvestRes, hiringRes, screensRes] = await Promise.all([
        supabase
          .from('harvest_sources')
          .select('*')
          .order('engagers_inserted', { ascending: false, nullsFirst: false }),
        supabase
          .from('hiring_role_offer_map')
          .select('id, role_pattern, matched_offer, intercept_template, active')
          .order('id', { ascending: true }),
        supabase
          .from('domain_screens')
          .select('domain, intent_band, intent_score, screened_at')
          .order('screened_at', { ascending: false, nullsFirst: false })
          .limit(2000),
      ]);

      setHarvestSources((harvestRes.data || []).map(mapHarvest));

      setHiringMap((hiringRes.data || []).map((r: any) => ({
        id: r.id,
        rolePattern: r.role_pattern,
        matchedOffer: r.matched_offer || null,
        interceptTemplate: r.intercept_template || null,
        active: r.active ?? true,
      })));

      const screens = screensRes.data || [];
      const b: DomainScreenBands = { hot: 0, warm: 0, cold: 0, total: 0 };
      const hot = new Set<string>();
      const recentHot: { domain: string; intentScore: number | null; screenedAt: string | null }[] = [];
      for (const s of screens as any[]) {
        b.total += 1;
        if (s.intent_band === 'hot') {
          b.hot += 1;
          if (s.domain) hot.add(String(s.domain).trim().toLowerCase());
          if (recentHot.length < 12) recentHot.push({ domain: s.domain, intentScore: s.intent_score ?? null, screenedAt: s.screened_at ?? null });
        } else if (s.intent_band === 'warm') b.warm += 1;
        else b.cold += 1;
      }
      setBands(b);
      setHotDomains(hot);
      setRecentHotDomains(recentHot);

      hasLoaded.current = true;
    } catch (err) {
      toastError('load feed sources', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  // harvest_sources has RLS disabled → anon client can write directly (same
  // pattern the Review tab uses for commenting_targets).
  const setHarvestStatus = useCallback(async (id: string, status: string) => {
    const prev = harvestSources;
    setHarvestSources((s) => s.map((h) => (h.id === id ? { ...h, status } : h)));
    try {
      const { error } = await supabase.from('harvest_sources').update({ status }).eq('id', id);
      if (error) throw error;
      toastSuccess(`Source ${status === 'active' ? 'resumed' : status}`);
    } catch (err) {
      toastError('update source status', err);
      setHarvestSources(prev);
    }
  }, [harvestSources]);

  const addHarvestSource = useCallback(async (name: string, linkedinUrl: string, sourceTier: string) => {
    const trimmed = name.trim();
    if (!trimmed) { toastError('Enter a source name'); return; }
    try {
      const { error } = await supabase.from('harvest_sources').insert({
        name: trimmed,
        linkedin_url: linkedinUrl.trim() || null,
        source_tier: sourceTier || 'icp_authority',
        status: 'active',
      });
      if (error) throw error;
      toastSuccess(`Added "${trimmed}" — next harvest cycle picks it up`);
      await fetch();
    } catch (err) {
      toastError('add harvest source', err);
    }
  }, [fetch]);

  return {
    harvestSources,
    hiringMap,
    bands,
    hotDomains,
    recentHotDomains,
    loading,
    refresh: fetch,
    setHarvestStatus,
    addHarvestSource,
  };
}
