import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * content_archetypes reader — the canonical catalog of content shapes:
 * 7 `post_structure` rows (STORY, HOW-TO, DATA-LED, ...) + 15 `carousel_style`
 * rows. Single source of truth for both the n8n `Rotation Constraints` router
 * and this dashboard panel — edit a row here (or via Supabase) and both sides
 * see it.
 *
 * Columns: id, kind ('post_structure'|'carousel_style'), name, slug,
 * one_liner, best_for, structural_directive, active, sort_order.
 *
 * Most carousel_style rows have best_for = null (their structural directive
 * lives in the local STYLE_CONFIGS render kit, not this table) — that's
 * expected; consumers should fall back to a hardcoded blurb when best_for is
 * absent.
 */

export interface ContentArchetype {
  id: string;
  kind: 'post_structure' | 'carousel_style';
  name: string;
  slug: string;
  oneLiner: string | null;
  bestFor: string | null;
  structuralDirective: string | null;
  active: boolean;
  sortOrder: number;
}

function mapArchetype(row: any): ContentArchetype {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    slug: row.slug,
    oneLiner: row.one_liner || null,
    bestFor: row.best_for || null,
    structuralDirective: row.structural_directive || null,
    active: row.active !== false,
    sortOrder: row.sort_order || 0,
  };
}

const SELECT = 'id, kind, name, slug, one_liner, best_for, structural_directive, active, sort_order';

export function useContentArchetypes() {
  const [archetypes, setArchetypes] = useState<ContentArchetype[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('content_archetypes')
      .select(SELECT)
      .eq('active', true)
      .order('kind', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) {
      setError(error.message);
      setArchetypes([]);
    } else {
      setError(null);
      setArchetypes((data || []).map(mapArchetype));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('content_archetypes_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_archetypes' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  return { archetypes, loading, error, refresh };
}
