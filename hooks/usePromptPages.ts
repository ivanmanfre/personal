// Hook for the dashboard PromptsPanel: lists ClickUp Doc pages, fetches a
// page's markdown content on demand, and saves edits back via the
// `clickup-pages` Supabase edge function (which holds the ClickUp PAT).
//
// The Prompts Library lives in workspace 90132938061 / doc 2ky5ezad-853
// (per ClickUp Prompts Library memory). Defaults can be overridden if we
// later want the panel to point at another doc.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toastError, toastSuccess } from '../lib/dashboardActions';

export const PROMPTS_WORKSPACE_ID = '90132938061';
export const PROMPTS_DOC_ID = '2ky5ezad-853';

export type PromptTag =
  | 'Hook'
  | 'Voice'
  | 'Forbidden'
  | 'Topic'
  | 'Strategy'
  | 'QA'
  | 'Video'
  | 'Generation'
  | 'Other';

export interface PromptPage {
  id: string;
  name: string;
  parentPageId: string | null;
  dateUpdated: number | null;
  charCount: number;
  tag: PromptTag;
}

export interface PromptPageDetail extends PromptPage {
  content: string;
}

export function inferTag(pageName: string): PromptTag {
  if (/hook/i.test(pageName)) return 'Hook';
  if (/voice|tone|brand/i.test(pageName)) return 'Voice';
  if (/forbidden|banned|avoid/i.test(pageName)) return 'Forbidden';
  if (/topic|idea|inbox/i.test(pageName)) return 'Topic';
  if (/strategy|playbook|content/i.test(pageName)) return 'Strategy';
  if (/qa|review|editor/i.test(pageName)) return 'QA';
  if (/video|talking|script/i.test(pageName)) return 'Video';
  if (/post.gen|generation/i.test(pageName)) return 'Generation';
  return 'Other';
}

// ClickUp's pageListing endpoint returns nested pages — flatten into a list
// while preserving each page's parent so we can later show hierarchy.
function flattenPages(raw: any, parent: string | null = null, out: any[] = []): any[] {
  if (!raw) return out;
  const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.pages) ? raw.pages : [];
  for (const node of arr) {
    if (!node || typeof node !== 'object') continue;
    out.push({ ...node, _parent: parent });
    if (Array.isArray(node.pages) && node.pages.length) {
      flattenPages(node.pages, node.id, out);
    }
  }
  return out;
}

function mapPage(row: any): PromptPage {
  const name = String(row?.name || row?.title || '(untitled)');
  return {
    id: String(row?.id || ''),
    name,
    parentPageId: row?._parent ?? row?.parent_page_id ?? null,
    dateUpdated: typeof row?.date_updated === 'number'
      ? row.date_updated
      : (row?.date_updated ? Number(row.date_updated) : null),
    // ClickUp's pageListing doesn't return char count up-front; populate when
    // we fetch the full page. Default to 0 here so sort-by-size still works.
    charCount: 0,
    tag: inferTag(name),
  };
}

async function callProxy<T = any>(action: 'list' | 'get' | 'save', params: Record<string, string>, body?: unknown): Promise<T> {
  const search = new URLSearchParams({ action, ...params }).toString();
  const { data, error } = await supabase.functions.invoke(`clickup-pages?${search}`, {
    method: action === 'save' ? 'POST' : 'GET',
    body: action === 'save' ? body : undefined,
  });
  if (error) throw new Error(error.message || 'edge function error');
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(`${(data as any).error}${(data as any).status ? `: ${(data as any).status}` : ''}`);
  }
  return data as T;
}

export function usePromptPages() {
  const [pages, setPages] = useState<PromptPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PromptPageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const params = useMemo(
    () => ({ workspace_id: PROMPTS_WORKSPACE_ID, doc_id: PROMPTS_DOC_ID }),
    [],
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callProxy<{ pages: any }>('list', params);
      const flat = flattenPages(data.pages);
      setPages(flat.map(mapPage).filter((p) => p.id));
    } catch (e: any) {
      setError(e?.message || 'Failed to load prompt pages');
      toastError('load prompts', e);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const selectPage = useCallback(async (pageId: string | null) => {
    setSelectedId(pageId);
    setDetail(null);
    if (!pageId) return;
    setDetailLoading(true);
    try {
      const data = await callProxy<{ page: any }>('get', { ...params, page_id: pageId });
      const p = data.page || {};
      const content = typeof p.content === 'string' ? p.content : '';
      const meta = pages.find((x) => x.id === pageId);
      const name = String(p.name || meta?.name || '(untitled)');
      const detail: PromptPageDetail = {
        id: pageId,
        name,
        parentPageId: meta?.parentPageId ?? p.parent_page_id ?? null,
        dateUpdated: typeof p.date_updated === 'number' ? p.date_updated : meta?.dateUpdated ?? null,
        charCount: content.length,
        tag: inferTag(name),
        content,
      };
      setDetail(detail);
      // Backfill char count in the list row so size-sort reflects reality.
      setPages((prev) => prev.map((row) => row.id === pageId ? { ...row, charCount: content.length } : row));
    } catch (e: any) {
      toastError('load page', e);
    } finally {
      setDetailLoading(false);
    }
  }, [params, pages]);

  const savePage = useCallback(async (pageId: string, content: string, name?: string) => {
    setSaving(true);
    try {
      await callProxy('save', { ...params, page_id: pageId }, { content, name });
      toastSuccess('Saved to ClickUp');
      // Update local detail + list metadata after a successful save.
      setDetail((prev) => prev && prev.id === pageId
        ? { ...prev, content, name: name || prev.name, charCount: content.length, dateUpdated: Date.now() }
        : prev);
      setPages((prev) => prev.map((row) => row.id === pageId
        ? { ...row, name: name || row.name, charCount: content.length, dateUpdated: Date.now(), tag: inferTag(name || row.name) }
        : row));
      return true;
    } catch (e: any) {
      toastError('save page', e);
      return false;
    } finally {
      setSaving(false);
    }
  }, [params]);

  return {
    pages,
    loading,
    error,
    selectedId,
    detail,
    detailLoading,
    saving,
    refresh: fetchList,
    selectPage,
    savePage,
  };
}
