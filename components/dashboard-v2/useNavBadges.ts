import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

const DAY = 86_400_000;
const ts = (v: string | null) => (v ? new Date(v).getTime() : 0);

export interface NavBadges {
  posts: number | null;
  outreach: number | null;
  health: number | null;
  scanvideos: number | null;
}

/**
 * Nav count-column sources. Each mirrors its section's own queue rule EXACTLY,
 * so the sidebar number always equals the number the section renders:
 * - posts    = Ivan-queue drafts in review (client_id null — same filter as the
 *              Posts board and Today's POSTS IN REVIEW tile; client drafts are
 *              never folded into Ivan's actionable count).
 * - outreach = replies waiting on Ivan (the owed rule proven in NextUpCard /
 *              useRepliesDesk, verbatim: reply_count>0, last_reply_at within 7d,
 *              needs_manual_reply OR (stage replied AND reply newer than last DM)).
 * - health   = workflows whose last execution errored.
 */
export function useNavBadges(): NavBadges {
  const [b, setB] = useState<NavBadges>({ posts: null, outreach: null, health: null, scanvideos: null });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      // The outreach badge counts replies OWED TO IVAN. Client-owned campaigns (RISE) live
      // in Client Ops, so scope to no-client campaigns — else a client's replied lead inflates
      // Ivan's badge. (outreach_prospects has no client_id column; scope via campaign.)
      const { data: ownCamps } = await supabase
        .from('outreach_campaigns').select('id').is('client_id', null);
      const ownIds = (ownCamps ?? []).map((c: any) => c.id);
      const [rev, owedCand, errs, scanVids] = await Promise.all([
        supabase
          .from('carousel_drafts')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'review')
          .is('client_id', null),
        supabase
          .from('outreach_prospects')
          .select('id,stage,reply_count,last_reply_at,last_dm_sent_at,needs_manual_reply')
          .in('campaign_id', ownIds)
          .neq('stage', 'archived')
          .gt('reply_count', 0)
          .order('last_reply_at', { ascending: false })
          .limit(200),
        supabase
          .from('dashboard_workflow_stats')
          .select('id', { count: 'exact', head: true })
          .eq('last_execution_status', 'error'),
        // Walkthrough videos awaiting operator review (draft). Authenticated
        // session sees every status; the badge mirrors the ScanVideoReview
        // actionable queue exactly.
        supabase
          .from('scan_videos')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'draft'),
      ]);
      if (!alive) return;
      const owed = (owedCand.data ?? []).filter(
        (p: any) =>
          p.reply_count > 0 &&
          Date.now() - ts(p.last_reply_at) <= 7 * DAY &&
          (p.needs_manual_reply || (p.stage === 'replied' && ts(p.last_reply_at) > ts(p.last_dm_sent_at))),
      ).length;
      setB({
        posts: rev.error ? null : rev.count ?? 0,
        outreach: owedCand.error ? null : owed,
        health: errs.error ? null : errs.count ?? 0,
        scanvideos: scanVids.error ? null : scanVids.count ?? 0,
      });
    };
    load();
    const t = setInterval(load, 120_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return b;
}
