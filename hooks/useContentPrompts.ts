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
    version: row.version || 1,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by || null,
  };
}

const SELECT = 'id, slug, title, body, kind, is_active, source_page, version, updated_at, updated_by';

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

  /** PATCH body + auto-bump version. Returns the updated row. */
  const savePrompt = useCallback(async (id: string, patch: { body?: string; title?: string; is_active?: boolean }) => {
    // Read current version for optimistic increment.
    const { data: row, error: readErr } = await supabase
      .from('content_prompts').select('version, body').eq('id', id).maybeSingle();
    if (readErr) throw new Error(`read failed: ${readErr.message}`);
    const nextVersion = ((row?.version as number) || 0) + 1;
    const update: Record<string, any> = {
      updated_at: new Date().toISOString(),
      updated_by: 'dashboard',
    };
    if (patch.body !== undefined) {
      update.body = patch.body;
      update.version = nextVersion;
    }
    if (patch.title !== undefined) update.title = patch.title;
    if (patch.is_active !== undefined) update.is_active = patch.is_active;
    const { error } = await supabase
      .from('content_prompts')
      .update(update)
      .eq('id', id);
    if (error) throw new Error(`save failed: ${error.message}`);
    return { ok: true, version: nextVersion };
  }, []);

  return { prompts, loading, error, refresh, savePrompt };
}
