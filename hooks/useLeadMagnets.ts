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
  videoUrl: string | null;
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
  /** ISO timestamp of the most-recent posted promo. Populated if available;
   *  undefined/null suppresses the recency warning in the Repost confirm. */
  lastPostedAt?: string | null;
  /** Set only on curator-idea rows projected onto the Idea stage (see
   *  lmIdeaProjection.ts) — the lm_idea_candidates uuid, used to open the
   *  review panel + decide. Absent on real lm_drafts_v2 rows. */
  ideaCandidateId?: string;
  /** Composite curator score (0-100), idea rows only. */
  ideaScore?: number | null;
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
  // Legacy n8n workflow outputs — fold to canonical statuses so the UI never
  // surfaces "Lm Review" or "Generating content" as separate ghost groups.
  lm_review: 'review',
  generating_content: 'generating',
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
    videoUrl: row.video_url,
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
        .select('id, topic, format, status, post_body, resource_html, resource_url, email_copy, cover_url, video_url, og_url, slug, spec, qa, updated_at, agent_log, topic_strength, notes, source, description')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const mapped = (data || []).map(mapDraft);
      // Populate lastPostedAt: latest posted-promo time per draft, for the
      // Repost recency warning. One extra query; rows come newest-first so the
      // first occurrence per clickup_task_id is the most recent post.
      const { data: posted } = await supabase
        .from('scheduled_posts')
        .select('clickup_task_id, posted_at')
        .eq('status', 'posted')
        .not('posted_at', 'is', null)
        .order('posted_at', { ascending: false });
      const lastByTask = new Map<string, string>();
      for (const r of (posted || []) as any[]) {
        if (r.clickup_task_id && !lastByTask.has(r.clickup_task_id)) {
          lastByTask.set(r.clickup_task_id, r.posted_at);
        }
      }
      setDrafts(mapped.map((d) => ({ ...d, lastPostedAt: lastByTask.get(d.id) ?? null })));
    } catch (err) {
      toastError('load lead magnets', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + realtime subscription — parity with useContentLibrary
  // (Posts). Without this the LM editor showed a stale cover/status until a
  // manual refresh (e.g. the Gemini cover finishing mid-generation never
  // surfaced). Live INSERT/UPDATE/DELETE on lm_drafts_v2 now propagate.
  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('lm_drafts_v2-lead-magnets')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lm_drafts_v2' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as any)?.id as string | undefined;
            if (!id) return;
            setDrafts((prev) => prev.filter((d) => d.id !== id));
            return;
          }
          const row = payload.new as any;
          if (!row?.id) return;
          const next = mapDraft(row);
          setDrafts((prev) => {
            const i = prev.findIndex((d) => d.id === next.id);
            if (i === -1) return [next, ...prev];
            const copy = prev.slice();
            // mapDraft (realtime payload) doesn't carry lastPostedAt — preserve
            // the value computed during the last full refresh so the recency
            // warning survives cover/status updates.
            copy[i] = { ...next, lastPostedAt: next.lastPostedAt ?? prev[i].lastPostedAt };
            return copy;
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  return { drafts, loading, refresh };
}
