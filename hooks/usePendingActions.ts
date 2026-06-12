import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAutoRefresh } from './useAutoRefresh';
import { dashboardAction, toastError } from '../lib/dashboardActions';
import {
  mapRow, sortItems, groupByCategory, resolveActionFor,
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
  const [mutedCategories, setMutedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const fetch = useCallback(async () => {
    if (!hasFetched.current) setLoading(true);
    try {
      const [{ data: rows, error }, muted] = await Promise.all([
        supabase.rpc('get_pending_actions'),
        supabase.from('notification_muted_categories').select('category'),
      ]);
      if (error) throw error;
      setItems(sortItems((rows || []).map(mapRow)));
      setMutedCategories((muted.data || []).map((r: { category: string }) => r.category));
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

  // unread is per-item from the RPC; recompute counts from it.
  const unreadCount = useMemo(() => items.filter((i) => i.unread).length, [items]);
  const topSeverity = useMemo<Severity | null>(() => {
    const unread = items.filter((i) => i.unread);
    if (!unread.length) return null;
    const RANK: Record<Severity, number> = { tier1: 0, tier2: 1, tier3: 2 };
    return unread.reduce<Severity>((a, i) => (RANK[i.severity] < RANK[a] ? i.severity : a), 'tier3');
  }, [items]);
  const groups = useMemo(() => groupByCategory(items), [items]);

  // Mark a set of keys seen: optimistic unread=false, then persist.
  const markSeen = useCallback(async (keys: string[]) => {
    if (!keys.length) return;
    const set = new Set(keys);
    setItems((prev) => prev.map((i) => (set.has(i.itemKey) ? { ...i, unread: false } : i)));
    try {
      const { error } = await supabase.rpc('mark_pending_seen', { p_keys: keys });
      if (error) throw error;
    } catch (e) {
      toastError('mark seen', e);
      fetch(); // reconcile on failure
    }
  }, [fetch]);

  // Inline-resolve an item: rpc (whitelisted) or direct update; optimistic remove.
  const resolve = useCallback(async (item: PendingItem) => {
    const action = resolveActionFor(item.category, item.itemKey);
    if (!action) return;
    setItems((prev) => prev.filter((i) => i.itemKey !== item.itemKey));
    try {
      if (action.method === 'rpc') {
        await dashboardAction(action.table, action.id, action.field, action.value ?? '');
      } else {
        const { error } = await supabase.from(action.table).update({ [action.field]: action.value }).eq('id', action.id);
        if (error) throw error;
      }
    } catch (e) {
      toastError(`resolve ${item.category}`, e);
      fetch(); // restore the item on failure
    }
  }, [fetch]);

  const muteCategory = useCallback(async (category: string) => {
    setItems((prev) => prev.filter((i) => i.category !== category));
    setMutedCategories((prev) => (prev.includes(category) ? prev : [...prev, category]));
    try {
      const { error } = await supabase.rpc('mute_category', { p_category: category });
      if (error) throw error;
    } catch (e) { toastError('mute category', e); fetch(); }
  }, [fetch]);

  const unmuteCategory = useCallback(async (category: string) => {
    setMutedCategories((prev) => prev.filter((c) => c !== category));
    try {
      const { error } = await supabase.rpc('unmute_category', { p_category: category });
      if (error) throw error;
    } catch (e) { toastError('unmute category', e); }
    fetch(); // bring the category's items back
  }, [fetch]);

  return {
    items, groups, totalPending: items.length, unreadCount, topSeverity,
    mutedCategories, loading, markSeen, resolve, muteCategory, unmuteCategory, refresh: fetch,
  };
}
