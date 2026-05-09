import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'dashboard_v2_enabled';

/**
 * Reads the `dashboard_v2_enabled` flag from Supabase `integration_config`.
 * Caches in localStorage for instant first paint. Refreshes on mount.
 *
 * URL override (forces a value, ignores flag):
 *   /dashboard?v=1   → force v1
 *   /dashboard?v=2   → force v2
 */
export function useDashboardV2Flag(): boolean {
  // URL override wins — instant decision, no Supabase wait
  const urlOverride = (() => {
    if (typeof window === 'undefined') return null;
    const v = new URLSearchParams(window.location.search).get('v');
    if (v === '1') return false;
    if (v === '2') return true;
    return null;
  })();

  // Initial state from localStorage (instant) — Supabase refresh on mount
  const initial = (() => {
    if (urlOverride !== null) return urlOverride;
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  })();

  const [enabled, setEnabled] = useState(initial);

  useEffect(() => {
    if (urlOverride !== null) return; // URL wins, skip Supabase fetch
    let cancelled = false;
    supabase
      .from('integration_config')
      .select('value')
      .eq('key', 'dashboard_v2_enabled')
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const next = data?.value === 'true' || data?.value === true;
        setEnabled(next);
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      });
    return () => { cancelled = true; };
  }, [urlOverride]);

  return enabled;
}
