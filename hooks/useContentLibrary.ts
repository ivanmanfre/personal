import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

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
  // Non-null on drafts that belong to a client board. Ivan's review queue must
  // EXCLUDE these — a Studio approve schedules to Ivan's own feed, and client
  // drafts are owned by their client board's own action path (client_board_action
  // RPC), never by carousel_drafts.status. Documented trap.
  // Optional so idea-stage projections (lib/ideaProjection.ts) needn't set it —
  // idea rows are never client rows, so `undefined` reads the same as null.
  clientId?: string | null;
  imageUrls: string[];
  postBody: string | null;
  igCaption: string | null;
  qa: { verdict?: string; failing_slides?: number[]; feedback?: string } | null;
  taxonomy: Record<string, any> | null;
  styleId: string | null;
  scheduledAt: string | null;
  updatedAt: string;
  agentLog: AgentLogEntry[];
  topicStrength: string | null;
  renderEngine: string | null;
  sourcePostId: string | null;     // urn:li:activity:... from Unipile
  slides: any[];                   // historical slide structures when image_urls is empty
  description: string | null;      // markdown source briefing (Description + Suggested Angle + Quotes) from ClickUp task
  // Animated video drafts (type='video') — render pipeline is video-gen-v2 + ivan-flow-video engine
  videoUrl: string | null;
  videoSpec: Record<string, any> | null;
  videoStatus: string | null;      // queued | generating | review | approved | failed
  videoStyle: string | null;       // serpentine-flow | product-ui-showcase | before-after
  videoFeedback: string | null;
  // === Idea-stage projection (optional) ===
  // Present only on rows projected from lm_idea_candidates onto the board's
  // Idea stage (see lib/ideaProjection.ts). Real carousel_drafts rows leave
  // these undefined. They drive the idea detail panel + Approve/Reject/Defer.
  isIdea?: boolean;
  ideaCandidateId?: string;
  ideaScores?: { composite: number | null; icp: number | null; virality: number | null; gap: number | null };
  ideaWhy?: string | null;
  ideaAssessment?: string | null;
  ideaStrength?: string | null;
  ideaSource?: string;
  ideaFormat?: string | null;
  ideaLadder?: string | null;
  ideaEvidence?: Array<{ quote?: string; persona?: string; source?: string }>;
}

const SELECT_COLS = 'id, title, topic, type, status, client_id, image_urls, post_body, ig_caption, qa, taxonomy, style_id, scheduled_at, updated_at, agent_log, topic_strength, render_engine, source_post_id, slides, description, video_url, video_spec, video_status, video_style, video_feedback';

function mapDraft(row: any): CarouselDraft {
  return {
    id: row.id,
    title: row.title || '(untitled)',
    topic: row.topic,
    type: row.type,
    status: row.status || 'draft',
    clientId: row.client_id ?? null,
    imageUrls: row.image_urls || [],
    postBody: row.post_body,
    igCaption: row.ig_caption,
    qa: row.qa,
    taxonomy: row.taxonomy,
    styleId: row.style_id,
    scheduledAt: row.scheduled_at,
    updatedAt: row.updated_at,
    agentLog: Array.isArray(row.agent_log) ? row.agent_log : [],
    topicStrength: row.topic_strength,
    renderEngine: row.render_engine,
    sourcePostId: row.source_post_id,
    slides: Array.isArray(row.slides) ? row.slides : [],
    description: row.description,
    videoUrl: row.video_url ?? null,
    videoSpec: row.video_spec ?? null,
    videoStatus: row.video_status ?? null,
    videoStyle: row.video_style ?? null,
    videoFeedback: row.video_feedback ?? null,
  };
}

export type DraftPatch = Partial<Pick<CarouselDraft, 'status' | 'scheduledAt' | 'postBody' | 'igCaption' | 'taxonomy' | 'imageUrls' | 'qa' | 'slides' | 'videoUrl' | 'videoStatus' | 'videoStyle' | 'videoFeedback'>>;

export function useContentLibrary() {
  const [drafts, setDrafts] = useState<CarouselDraft[]>([]);
  const [loading, setLoading] = useState(true);
  // Tombstone set — id → reaper timestamp. Optimistically-deleted ids are
  // suppressed from the visible list until the realtime DELETE confirms or
  // the timeout reverts on next refresh.
  const tombstonesRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('carousel_drafts')
        // This is Ivan's OWN content library. Client-owned drafts (client_id set,
        // e.g. RISE) live on their own Client Ops surface and must never surface
        // here — otherwise a client's pool photos (e.g. Mattan's lifestyle pics)
        // bleed onto the personal board/calendar. Same scoping the personal
        // outreach desk uses (OutreachWorkSurface: .is('client_id', null)).
        .is('client_id', null)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      tombstonesRef.current.clear();
      setDrafts((data || []).map(mapDraft));
    } catch (err) {
      // Posts is the demo's first surface — a transient read failure (e.g. a
      // Postgres statement timeout on this heavy query) should not throw a
      // raw toast onto it. Degrade silently; the empty/loaded state and the
      // refresh button remain. Realtime + the next refresh will reconcile.
      console.warn('[content-library] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // applyOptimistic — merge a patch into a single draft immediately, ahead
  // of the server confirming the write. The realtime channel (below) will
  // overwrite this with the authoritative value when it arrives. On mutation
  // error the caller is expected to call refresh() to reconcile.
  const applyOptimistic = useCallback((id: string, patch: DraftPatch) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  // applyOptimisticMany — same shape applied to a set of ids (bulk actions).
  const applyOptimisticMany = useCallback((ids: string[], patch: DraftPatch) => {
    const idSet = new Set(ids);
    setDrafts((prev) => prev.map((d) => (idSet.has(d.id) ? { ...d, ...patch } : d)));
  }, []);

  // applyOptimisticDelete — hide rows from the list until realtime confirms
  // the DELETE. Tombstones cleared on refresh.
  const applyOptimisticDelete = useCallback((ids: string[]) => {
    ids.forEach((id) => tombstonesRef.current.add(id));
    setDrafts((prev) => prev.filter((d) => !tombstonesRef.current.has(d.id)));
  }, []);

  // Initial load + realtime subscription. Replaces the 15s + 20s polling
  // pair the editor and panel were running. Pattern proven in useScan.
  useEffect(() => {
    refresh();

    const channel = supabase
      .channel('carousel_drafts-content-library')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'carousel_drafts' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as any)?.id as string | undefined;
            if (!id) return;
            tombstonesRef.current.delete(id);
            setDrafts((prev) => prev.filter((d) => d.id !== id));
            return;
          }
          const row = payload.new as any;
          if (!row?.id) return;
          // Personal library only — ignore client-owned rows (client_id set) so
          // a RISE insert/update never re-adds a client draft the initial query
          // scoped out. If a row flips to client-owned, drop it from local state.
          if (row.client_id != null) {
            setDrafts((prev) => prev.filter((d) => d.id !== row.id));
            return;
          }
          // Drop any stale tombstone for the same id (server resurrected it)
          tombstonesRef.current.delete(row.id);
          const next = mapDraft(row);
          setDrafts((prev) => {
            const i = prev.findIndex((d) => d.id === next.id);
            if (i === -1) return [next, ...prev];
            const copy = prev.slice();
            copy[i] = next;
            return copy;
          });
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [refresh]);

  return { drafts, loading, refresh, applyOptimistic, applyOptimisticMany, applyOptimisticDelete };
}
