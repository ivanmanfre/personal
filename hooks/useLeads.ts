import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { dashboardAction, toastError } from '../lib/dashboardActions';
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
  const [mutating, setMutating] = useState<Set<string>>(new Set());
  const startMutating = (id: string) => setMutating((s) => new Set(s).add(id));
  const stopMutating = (id: string) => setMutating((s) => { const n = new Set(s); n.delete(id); return n; });

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(200);
      setAllLeads((data || []).map(mapLead));
    } catch (err) {
      toastError('load leads', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const leads = useMemo(() =>
    statusFilter && statusFilter !== 'all'
      ? allLeads.filter((l) => l.status === statusFilter)
      : allLeads,
    [allLeads, statusFilter]
  );

  const statusCounts = useMemo(() =>
    allLeads.reduce((acc: Record<string, number>, l) => {
      const s = l.status || 'unknown';
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {}),
    [allLeads]
  );

  const icpDistribution = useMemo(() => {
    const dist = { low: 0, medium: 0, high: 0 };
    allLeads.forEach((l) => {
      if (l.icpScore == null) return;
      if (l.icpScore <= 3) dist.low++;
      else if (l.icpScore <= 6) dist.medium++;
      else dist.high++;
    });
    return dist;
  }, [allLeads]);

  const updateStatus = useCallback(async (id: string, status: string) => {
    const prev = allLeads.find((l) => l.id === id);
    startMutating(id);
    setAllLeads((p) => p.map((l) => (l.id === id ? { ...l, status } : l)));
    try {
      await dashboardAction('leads', id, 'status', status);
      await fetch();
    } catch (err) {
      toastError('update lead status', err);
      if (prev) setAllLeads((p) => p.map((l) => (l.id === id ? { ...l, status: prev.status } : l)));
    } finally {
      stopMutating(id);
    }
  }, [allLeads]);

  return { leads, statusCounts, icpDistribution, loading, mutating, refresh: fetch, updateStatus };
}
