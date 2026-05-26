import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface AgencyVariantStatRow {
  axis: 'body' | 'closer';
  tag: string;
  sent_count: number;
  reply_count: number;
  reply_rate: number;
  sample_text: string | null;
}

export function useAgencyVariantStats() {
  const [rows, setRows] = useState<AgencyVariantStatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: fetchError } = await supabase.rpc('get_agency_dm_variant_stats');
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    const normalized = (data ?? []).map((r: AgencyVariantStatRow) => ({
      ...r,
      reply_rate: Number(r.reply_rate),
    }));
    setRows(normalized);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('agency-variant-stats')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'outreach_messages' },
        () => { void refresh(); },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [refresh]);

  return { rows, loading, error, refresh };
}
