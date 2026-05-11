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

const POLL_INTERVAL_MS = 10_000;

export function useScan(companySlug: string | null, opts: { realtime?: boolean } = {}) {
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!companySlug) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchScan(): Promise<boolean> {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('scans')
        .select(SCAN_COLUMNS)
        .eq('company_slug', companySlug)
        .eq('status', 'complete')
        .maybeSingle();

      if (cancelled) return false;

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return false;
      }

      if (data) {
        setScan(data as unknown as Scan);
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
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
              if (updated.report_json) {
                setScan(updated);
                setLoading(false);
              } else {
                // Realtime payload missing report_json — fetch the full row
                fetchScan();
              }
            }
          }
        )
        .subscribe();

      channelRef.current = channel;

      // Polling fallback: realtime WebSocket can drop silently over long scans
      pollRef.current = setInterval(async () => {
        if (cancelled) return;
        const done = await fetchScan();
        if (done && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [companySlug, opts.realtime]);

  return { scan, loading, error };
}
