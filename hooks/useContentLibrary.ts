import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';

export interface AgentLogEntry {
  ts: string | null;
  agent: string;
  body: string;
  source?: string;        // 'n8n' (live) | 'clickup_backfill' (historical)
  comment_id?: string;    // present for backfilled entries
}

export interface CarouselDraft {
  id: string;
  title: string;
  topic: string | null;
  type: string | null;
  status: string;
  imageUrls: string[];
  postBody: string | null;
  igCaption: string | null;
  qa: { verdict?: string; failing_slides?: number[]; feedback?: string } | null;
  taxonomy: Record<string, any> | null;
  styleId: string | null;
  scheduledAt: string | null;
  updatedAt: string;
  agentLog: AgentLogEntry[];
}

function mapDraft(row: any): CarouselDraft {
  return {
    id: row.id,
    title: row.title || '(untitled)',
    topic: row.topic,
    type: row.type,
    status: row.status || 'draft',
    imageUrls: row.image_urls || [],
    postBody: row.post_body,
    igCaption: row.ig_caption,
    qa: row.qa,
    taxonomy: row.taxonomy,
    styleId: row.style_id,
    scheduledAt: row.scheduled_at,
    updatedAt: row.updated_at,
    agentLog: Array.isArray(row.agent_log) ? row.agent_log : [],
  };
}

export function useContentLibrary() {
  const [drafts, setDrafts] = useState<CarouselDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('carousel_drafts')
        .select('id, title, topic, type, status, image_urls, post_body, ig_caption, qa, taxonomy, style_id, scheduled_at, updated_at, agent_log')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setDrafts((data || []).map(mapDraft));
    } catch (err) {
      toastError('load carousel drafts', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { drafts, loading, refresh };
}
