import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * carousel_styles reader. RLS is OFF on the table so anon reads work.
 *
 * Columns (verified via Supabase MCP):
 *   id, name, slug, kit_css, authoring_notes, exemplar_urls (text[]),
 *   status, is_default, created_at
 *
 * `authoring_notes` is our "brief" — populated by scroll-recorder's
 * /carousel/style endpoint either from the user's text brief OR from a
 * Gemini-vision description of `exemplar_urls`.
 */

export interface CarouselStyle {
  id: string;
  name: string;
  slug: string;
  brief: string;            // → authoring_notes
  exemplarUrls: string[];   // → exemplar_urls
  status: string;
  isDefault: boolean;
  hasKit: boolean;          // kit_css length > 0 (default 'editorial' uses local kit)
  createdAt: string | null;
}

function mapStyle(row: any): CarouselStyle {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    brief: row.authoring_notes || '',
    exemplarUrls: Array.isArray(row.exemplar_urls) ? row.exemplar_urls : [],
    status: row.status || 'active',
    isDefault: !!row.is_default,
    hasKit: typeof row.kit_css === 'string' && row.kit_css.length > 0,
    createdAt: row.created_at || null,
  };
}

const SELECT = 'id, name, slug, authoring_notes, exemplar_urls, status, is_default, created_at, kit_css';

export function useCarouselStyles() {
  const [styles, setStyles] = useState<CarouselStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('carousel_styles')
      .select(SELECT)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false, nullsFirst: false });
    if (error) {
      setError(error.message);
      setStyles([]);
    } else {
      setError(null);
      setStyles((data || []).map(mapStyle));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('carousel_styles_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'carousel_styles' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  return { styles, loading, error, refresh };
}
