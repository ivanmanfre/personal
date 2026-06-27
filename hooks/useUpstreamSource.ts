import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { strengthBand } from '../lib/ideaProjection';

export interface UpstreamSource {
  kind: 'call' | 'web_research' | 'competitor' | 'manual' | 'curator' | 'unknown';
  title?: string;
  body?: string;
  url?: string;
  meta?: Record<string, string | number>;
  // Curator idea context — populated when resolved from an lm_idea_candidates row
  // (taxonomy.source_candidate_id). This is the "origin idea" that fed generation:
  // why it scored, the verbatim evidence, the signal scores, the editorial take.
  why?: string | null;
  evidence?: Array<{ quote?: string; persona?: string; source?: string }>;
  scores?: { composite: number | null; icp: number | null; virality: number | null; gap: number | null };
  strengthBand?: 'High' | 'Mid' | 'Low' | null;
  editorial?: string | null;
  editorialStrength?: string | null;
}

// Normalize the candidate's evidence (array of {quote|excerpt, persona|author,
// source|origin}) into the shape the UI renders. Mirrors ideaProjection's reader.
function normalizeEvidence(ev: any): Array<{ quote?: string; persona?: string; source?: string }> {
  if (!Array.isArray(ev)) return [];
  return ev
    .map((e: any) => ({
      quote: typeof e?.quote === 'string' ? e.quote : (typeof e?.excerpt === 'string' ? e.excerpt : undefined),
      persona: typeof e?.persona === 'string' ? e.persona : (typeof e?.author === 'string' ? e.author : undefined),
      source: typeof e?.source === 'string' ? e.source : (typeof e?.origin === 'string' ? e.origin : undefined),
    }))
    .filter((e) => e.quote || e.persona);
}

/**
 * Resolve the actual upstream source material for a carousel / LM draft.
 *
 * Lookup strategy:
 *   1. If taxonomy has `source_candidate_id` → fetch lm_idea_candidates row directly.
 *      That row has raw_context + evidence + raw_topic — the curator's full source bundle.
 *   2. Else fall back to the `taxonomy.source` label + best-effort match:
 *        Client Calls    → no FK available; show source pointer only
 *        Web Research    → likely auto_research_sessions, not linked; show pointer
 *        Competitor      → likely competitor_posts; no FK; show pointer
 *        Manual          → no source
 *
 * Returns null if no source could be resolved.
 */
export function useUpstreamSource(taxonomy: Record<string, any> | null): UpstreamSource | null {
  const [source, setSource] = useState<UpstreamSource | null>(null);

  useEffect(() => {
    if (!taxonomy) { setSource(null); return; }
    const candidateId = taxonomy.source_candidate_id as string | undefined;
    const sourceLabel = (taxonomy.source as string | undefined) || '';

    (async () => {
      // Strategy 1: direct candidate fetch
      if (candidateId) {
        try {
          const { data, error } = await supabase
            .from('lm_idea_candidates')
            .select('raw_topic, raw_context, evidence, why_score, post_angle, source, composite_score, icp_fit_score, virality_score, gap_score, editorial_assessment, editorial_strength')
            .eq('id', candidateId)
            .single();
          if (!error && data) {
            setSource({
              kind: 'curator',
              title: data.raw_topic || 'Curator candidate',
              body: data.raw_context || '',
              why: data.why_score || null,
              evidence: normalizeEvidence(data.evidence),
              scores: {
                composite: data.composite_score ?? null,
                icp: data.icp_fit_score ?? null,
                virality: data.virality_score ?? null,
                gap: data.gap_score ?? null,
              },
              strengthBand: strengthBand(data.composite_score),
              editorial: data.editorial_assessment || null,
              editorialStrength: data.editorial_strength || null,
            });
            return;
          }
        } catch { /* fall through */ }
      }

      // Strategy 2: source-label pointer (no FK exists; show the label + suggest where the raw lives)
      const labelMap: Record<string, UpstreamSource['kind']> = {
        'Client Calls': 'call',
        'Web Research': 'web_research',
        'Competitor':   'competitor',
        'Manual':       'manual',
      };
      const kind = labelMap[sourceLabel] || 'unknown';
      if (kind === 'manual' || kind === 'unknown') { setSource(null); return; }
      setSource({
        kind,
        title: sourceLabel,
        body: kind === 'call'
          ? 'Sourced from a recorded client call. The full transcript lives in the transcripts table; the topic-specific excerpt is captured in the description above.'
          : kind === 'web_research'
            ? 'Sourced from web research. The original article / thread URLs live in auto_research_sessions.'
            : 'Sourced from a competitor post. The original LinkedIn URL is in competitor_posts.',
      });
    })();
  }, [taxonomy]);

  return source;
}
