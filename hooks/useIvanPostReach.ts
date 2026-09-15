import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { ReachCarrier } from '../lib/postReach';

/**
 * Who each of Ivan's own posts reached, keyed by LinkedIn post URL (exact string match to
 * own_posts.linkedin_url). Reads the narrow `ivan_post_reach()` RPC (SECURITY DEFINER,
 * granted to authenticated, returns only client_id='ivan' rows' network + demographics,
 * latest capture per post). client_post_metrics itself stays service-role only.
 *
 * A failed read leaves the map empty: posts then render exactly as they did before the
 * split existed. Never toasts, since the panel is fully usable without it.
 */
export function useIvanPostReach() {
  const [byUrl, setByUrl] = useState<Map<string, ReachCarrier>>(() => new Map());

  const fetch = useCallback(async () => {
    const { data, error } = await supabase.rpc('ivan_post_reach');
    if (error || !Array.isArray(data)) return;
    const next = new Map<string, ReachCarrier>();
    (data as { post_url: string; network: ReachCarrier['network']; demographics: ReachCarrier['demographics'] }[])
      .forEach((r) => {
        if (r && r.post_url) next.set(r.post_url, { network: r.network ?? null, demographics: r.demographics ?? null });
      });
    setByUrl(next);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { byUrl, refresh: fetch };
}
