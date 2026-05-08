// hooks/useScan.ts
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Scan } from '../lib/scanTypes';

const SCAN_COLUMNS = [
  'id', 'company_slug', 'domain', 'status', 'created_at', 'completed_at',
  'company_name', 'company_size', 'revenue_range', 'domain_age_years',
  'email_infra', 'logo_url', 'anthropic_verified', 'openai_verified',
  'automation_score', 'automation_grade', 'top_gap_title', 'top_gap_summary',
  'report_url', 'report_json',
].join(', ');

export function useScan(companySlug: string | null, opts: { realtime?: boolean } = {}) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!companySlug) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchScan() {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('scans')
        .select(SCAN_COLUMNS)
        .eq('company_slug', companySlug)
        .eq('status', 'complete')
        .maybeSingle();

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setScan(data as unknown as Scan | null);
      }
      setLoading(false);
    }

    fetchScan();

    if (opts.realtime) {
      const channel = supabase
        .channel(`scan-${companySlug}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'scans',
            filter: `company_slug=eq.${companySlug}`,
          },
          (payload) => {
            const updated = payload.new as Scan;
            if (updated.status === 'complete') {
              setScan(updated);
              setLoading(false);
            }
          }
        )
        .subscribe();

      channelRef.current = channel;
    }

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [companySlug, opts.realtime]);

  return { scan, loading, error };
}
