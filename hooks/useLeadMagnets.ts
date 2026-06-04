import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';
import type { AgentLogEntry } from './useContentLibrary';

export interface LeadMagnetDraft {
  id: string;
  topic: string | null;
  format: string | null;
  status: string;
  postBody: string | null;
  resourceHtml: string | null;
  resourceUrl: string | null;
  emailCopy: string | null;
  coverUrl: string | null;
  ogUrl: string | null;
  slug: string | null;
  spec: Record<string, unknown> | null;
  qa: Record<string, unknown> | null;
  updatedAt: string;
  agentLog: AgentLogEntry[];
  topicStrength: string | null;
  notes: string | null;
  source: string | null;
  description: string | null;
}

// Canonical LM pipeline has 9 stages. Legacy/duplicate DB values are folded
// into their canonical bucket here so grouping, counts, filters and the status
// dropdown never surface the old "weird states" (draft / ready / complete) —
// regardless of what the n8n workflow still writes. This is the single place
// raw status is interpreted.
const LM_STATUS_ALIASES: Record<string, string> = {
  draft: 'idea',
  ready: 'published',
  complete: 'published',
  pending: 'idea',
};
export function normalizeLmStatus(raw?: string | null): string {
  const s = raw || 'idea';
  return LM_STATUS_ALIASES[s] || s;
}

function mapDraft(row: any): LeadMagnetDraft {
  return {
    id: row.id,
    topic: row.topic,
    format: row.format,
    status: normalizeLmStatus(row.status),
    postBody: row.post_body,
    resourceHtml: row.resource_html,
    resourceUrl: row.resource_url,
    emailCopy: row.email_copy,
    coverUrl: row.cover_url,
    ogUrl: row.og_url,
    slug: row.slug,
    spec: row.spec,
    qa: row.qa,
    updatedAt: row.updated_at,
    agentLog: Array.isArray(row.agent_log) ? row.agent_log : [],
    topicStrength: row.topic_strength,
    notes: row.notes,
    source: row.source,
    description: row.description,
  };
}

export function useLeadMagnets() {
  const [drafts, setDrafts] = useState<LeadMagnetDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('lm_drafts_v2')
        .select('id, topic, format, status, post_body, resource_html, resource_url, email_copy, cover_url, og_url, slug, spec, qa, updated_at, agent_log, topic_strength, notes, source, description')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setDrafts((data || []).map(mapDraft));
    } catch (err) {
      toastError('load lead magnets', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { drafts, loading, refresh };
}
