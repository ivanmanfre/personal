import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Reads the `content_prompts` rows whose slug starts with `style-` — the
 * mirror of each ClickUp Asset Style prompt page. Synced daily 04:00 UTC by
 * n8n workflow `1jOmMEhOzxkabJYs` (Prompts → Supabase Sync). Backfilled
 * manually when the sync list changes.
 *
 * Returned as a slug→body map so the Style Gallery panel can look up the
 * prompt for each AssetStyle entry without an N+1 query.
 */

export interface StylePrompt {
  slug: string;
  title: string;
  body: string;
  sourcePage: string | null;
}

export function useStylePrompts() {
  const [prompts, setPrompts] = useState<Record<string, StylePrompt>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('content_prompts')
        .select('slug, title, body, source_page')
        .like('slug', 'style-%')
        .eq('is_active', true);
      if (!alive) return;
      if (error) {
        setError(error.message);
        setPrompts({});
      } else {
        const map: Record<string, StylePrompt> = {};
        for (const r of data || []) {
          map[r.slug as string] = {
            slug: r.slug as string,
            title: r.title as string,
            body: r.body as string,
            sourcePage: (r.source_page as string) || null,
          };
        }
        setError(null);
        setPrompts(map);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return { prompts, loading, error };
}
