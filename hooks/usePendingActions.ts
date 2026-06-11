import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAutoRefresh } from './useAutoRefresh';
import {
  mapRow, sortItems, computeUnreadCount, computeTopSeverity, groupByCategory,
  type PendingItem, type Severity,
} from '../lib/pendingActions';

export type { PendingItem, Severity } from '../lib/pendingActions';

// Source tables whose changes should refetch the feed live. Tables not in the
// realtime publication simply never fire — harmless; the 60s base poll covers them.
const REALTIME_TABLES = [
  'skill_drafts', 'scheduled_checks', 'carousel_drafts', 'lm_drafts_v2',
  'outreach_prospects', 'paid_assessments', 'upwork_proposals', 'video_shorts',
  'contacts', 'dashboard_tasks', 'dashboard_workflow_stats',
];

export function usePendingActions() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [lastOpenedAt, setLastOpenedAt] = useState<string>('1970-01-01T00:00:00Z');
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetch = useCallback(async () => {
    if (!hasFetched.current) setLoading(true);
    try {
      const [{ data: rows, error }, stateRes] = await Promise.all([
        supabase.rpc('get_pending_actions'),
        supabase.from('notification_state').select('last_opened_at').single(),
      ]);
      if (error) throw error;
      setItems(sortItems((rows || []).map(mapRow)));
      if (stateRes.data?.last_opened_at) setLastOpenedAt(stateRes.data.last_opened_at);
    } catch {
      // keep last good snapshot; never block the dashboard
    } finally {
      setLoading(false);
      hasFetched.current = true;
    }
  }, []);

  // Fetch on mount (codebase pattern — useScheduledChecks does the same), then
  // let useAutoRefresh drive interval polls + realtime-table refetches.
  useEffect(() => { fetch(); }, [fetch]);
  useAutoRefresh(fetch, { realtimeTables: REALTIME_TABLES });

  const unreadCount = useMemo(() => computeUnreadCount(items, lastOpenedAt), [items, lastOpenedAt]);
  const topSeverity = useMemo<Severity | null>(() => computeTopSeverity(items, lastOpenedAt), [items, lastOpenedAt]);
  const groups = useMemo(() => groupByCategory(items), [items]);

  const markAllSeen = useCallback(async () => {
    const nowIso = new Date().toISOString();
    setLastOpenedAt(nowIso); // optimistic — clears the badge immediately
    try {
      await supabase.from('notification_state').update({ last_opened_at: nowIso }).eq('id', 1);
    } catch {
      // badge already cleared locally; next fetch reconciles
    }
  }, []);

  return { items, groups, totalPending: items.length, unreadCount, topSeverity, loading, markAllSeen, refresh: fetch };
}
