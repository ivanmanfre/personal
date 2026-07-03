import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface PromptVersion {
  version: number;
  title: string | null;
  body: string | null;
  updatedBy: string | null;
  changedAt: string;
}

/**
 * Full-body version history for one prompt slug, newest first. Backed by
 * content_prompt_versions (populated by the snapshot trigger + backfill).
 */
export function usePromptVersions(slug: string | null) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!slug) {
      setVersions([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from('content_prompt_versions')
      .select('version, title, body, updated_by, changed_at')
      .eq('slug', slug)
      .order('version', { ascending: false })
      .limit(50);
    if (e) setError(e.message);
    setVersions(
      (data || []).map((r: any) => ({
        version: r.version,
        title: r.title,
        body: r.body,
        updatedBy: r.updated_by,
        changedAt: r.changed_at,
      }))
    );
    setLoading(false);
  }, [slug]);

  useEffect(() => { refresh(); }, [refresh]);

  return { versions, loading, error, refresh };
}
