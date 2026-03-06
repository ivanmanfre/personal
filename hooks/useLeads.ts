import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Lead } from '../types/dashboard';

function mapLead(row: any): Lead {
  return {
    id: row.id,
    linkedinUrl: row.linkedin_url,
    name: row.name,
    headline: row.headline,
    company: row.company,
    icpScore: row.icp_score,
    status: row.status,
    source: row.engagement_type,
    createdAt: row.created_at,
  };
}

export function useLeads(statusFilter?: string) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(200);
    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    const { data } = await query;
    setLeads((data || []).map(mapLead));
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const statusCounts = leads.reduce((acc: Record<string, number>, l) => {
    const s = l.status || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const icpDistribution = { low: 0, medium: 0, high: 0 };
  leads.forEach((l) => {
    if (l.icpScore == null) return;
    if (l.icpScore <= 3) icpDistribution.low++;
    else if (l.icpScore <= 6) icpDistribution.medium++;
    else icpDistribution.high++;
  });

  return { leads, statusCounts, icpDistribution, loading, refresh: fetch };
}
