import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import { aggregateImageStyleUsage, StyleUsage, DraftUsageRow } from '../lib/styleUsage';

/**
 * Real usage stats for single-image styles: how many published posts used each
 * taxonomy.image_style, plus the most recent renderable cover. Carousel layout
 * archetypes are intentionally excluded — carousel_drafts records no archetype
 * field, so there is nothing real to count there.
 */
export function useStyleUsage() {
  const [imageStyleStats, setImageStyleStats] = useState<Record<string, StyleUsage>>({});
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('carousel_drafts')
        .select('taxonomy, image_urls, created_at')
        .eq('type', 'single_image')
        .eq('status', 'published')
        .limit(500);
      if (error) throw error;
      setImageStyleStats(aggregateImageStyleUsage((data || []) as DraftUsageRow[]));
    } catch (err) {
      toastError('load style usage', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { imageStyleStats, loading, refresh: fetch };
}
