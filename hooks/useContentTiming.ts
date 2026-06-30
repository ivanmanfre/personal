import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';

// Day-of-week x 6h-block aggregates, bucketed server-side in BA local time.
// Sources: outreach_send_heatmap() (attributes accepts/replies to the SEND slot)
// and content_post_heatmap() (own LinkedIn post performance by publish slot).
export interface OutreachSlot {
  dow: number;    // 0=Sun .. 6=Sat
  block: number;  // 0=Night 1=Morning 2=Midday 3=Evening
  sends: number;
  accepts: number;
  replies: number;
}

export interface ContentSlot {
  dow: number;
  block: number;
  posts: number;
  avgEngagement: number;
  avgImpressions: number;
}

export function useContentTiming() {
  const [outreach, setOutreach] = useState<OutreachSlot[]>([]);
  const [content, setContent] = useState<ContentSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [oRes, cRes] = await Promise.all([
        supabase.rpc('outreach_send_heatmap'),
        supabase.rpc('content_post_heatmap'),
      ]);
      if (oRes.error) throw oRes.error;
      if (cRes.error) throw cRes.error;
      setOutreach((oRes.data || []).map((r: any) => ({
        dow: Number(r.dow), block: Number(r.block),
        sends: Number(r.sends) || 0, accepts: Number(r.accepts) || 0, replies: Number(r.replies) || 0,
      })));
      setContent((cRes.data || []).map((r: any) => ({
        dow: Number(r.dow), block: Number(r.block),
        posts: Number(r.posts) || 0,
        avgEngagement: Number(r.avg_engagement) || 0,
        avgImpressions: Number(r.avg_impressions) || 0,
      })));
    } catch (err) {
      toastError('load content timing', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { outreach, content, loading, refresh: fetch };
}
