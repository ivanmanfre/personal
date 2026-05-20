import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface OutreachClickRow {
  token: string;
  connection_name: string | null;
  company_name: string | null;
  company_domain: string | null;
  linkedin_profile_url: string | null;
  first_clicked_at: string;
  last_clicked_at: string;
  click_count: number;
  variants_seen: string[] | null;
}

const LIMIT = 30;

export function useOutreachClicks() {
  const [rows, setRows] = useState<OutreachClickRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: fetchError } = await supabase.rpc('get_recent_outreach_clicks', {
      p_limit: LIMIT,
    });
    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as OutreachClickRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('outreach-clicks-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'outreach_link_clicks' },
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
