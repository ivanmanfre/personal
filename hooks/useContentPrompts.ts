import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * content_prompts is the canonical home for every Claude system prompt the
 * content engine uses (66 rows as of 2026-06-04 — voice / forbidden / hook /
 * post-gen / qa / editorial / 11 carousel layouts / 6 single-image styles /
 * lead-magnet variants / etc.).
 *
 * Dashboard becomes the editor. ClickUp doc 2ky5ezad-853 is functionally
 * disconnected: the Prompts → Supabase Sync workflow is deactivated; live n8n
 * runs read from this table only. Editing here is now the source of truth.
 *
 * Realtime subscription so multiple browser tabs stay in sync.
 */

export interface ContentPrompt {
  id: string;
  slug: string;
  title: string;
  body: string;
  kind: string;          // 'prompt' for everything we have today
  isActive: boolean;
  sourcePage: string | null;  // 'clickup:2ky5ezad-XXXX' (legacy origin)
  category: string | null;    // server-side backfill of categorize()'s slug heuristic; null = "Other"
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

function mapRow(row: any): ContentPrompt {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title || row.slug,
    body: row.body || '',
    kind: row.kind || 'prompt',
    isActive: row.is_active !== false,
    sourcePage: row.source_page || null,
    category: row.category || null,
    version: row.version || 1,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by || null,
  };
}

const SELECT = 'id, slug, title, body, kind, is_active, source_page, category, version, updated_at, updated_by';

export function useContentPrompts() {
  const [prompts, setPrompts] = useState<ContentPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('content_prompts')
      .select(SELECT)
      .order('slug', { ascending: true });
    if (error) {
      setError(error.message);
      setPrompts([]);
    } else {
      setError(null);
      setPrompts((data || []).map(mapRow));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel('content_prompts_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_prompts' }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  /** PATCH body/title. Version bump is owned by the DB trigger.
   * Compare-and-swap on version: if another writer landed first, returns
   * {ok:false, conflict:true} and writes nothing. */
  const savePrompt = useCallback(async (
    id: string,
    patch: { body?: string; title?: string; is_active?: boolean },
    expectedVersion: number,
  ) => {
    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
      updated_by: 'dashboard',
    };
    if (patch.body !== undefined) update.body = patch.body;
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.is_active !== undefined) update.is_active = patch.is_active;
    const { data, error } = await supabase
      .from('content_prompts')
      .update(update)
      .eq('id', id)
      .eq('version', expectedVersion)
      .select('id, version, updated_at, updated_by');
    if (error) throw new Error(`save failed: ${error.message}`);
    if (!data || data.length === 0) return { ok: false as const, conflict: true as const };
    const row = data[0];
    return {
      ok: true as const,
      row: { id: row.id, version: row.version, updatedAt: row.updated_at, updatedBy: row.updated_by || null },
    };
  }, []);

  /** Patch one row's version/provenance in local state after our own save lands —
   * no refetch, so the next save's CAS expectedVersion is immediately current. */
  const applyRowPatch = useCallback((
    id: string,
    patch: { version: number; updated_at: string; updated_by: string | null },
  ) => {
    setPrompts((prev) => prev.map((p) => (
      p.id === id
        ? { ...p, version: patch.version, updatedAt: patch.updated_at, updatedBy: patch.updated_by }
        : p
    )));
  }, []);

  return { prompts, loading, error, refresh, savePrompt, applyRowPatch };
}
