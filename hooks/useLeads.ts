import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction } from '../lib/dashboardActions';
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
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(200);
      setAllLeads((data || []).map(mapLead));
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const leads = statusFilter && statusFilter !== 'all'
    ? allLeads.filter((l) => l.status === statusFilter)
    : allLeads;

  const statusCounts = allLeads.reduce((acc: Record<string, number>, l) => {
    const s = l.status || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const icpDistribution = { low: 0, medium: 0, high: 0 };
  allLeads.forEach((l) => {
    if (l.icpScore == null) return;
    if (l.icpScore <= 3) icpDistribution.low++;
    else if (l.icpScore <= 6) icpDistribution.medium++;
    else icpDistribution.high++;
  });

  const updateStatus = async (id: string, status: string) => {
    setAllLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await dashboardAction('leads', id, 'status', status);
  };

  return { leads, statusCounts, icpDistribution, loading, refresh: fetch, updateStatus };
}
