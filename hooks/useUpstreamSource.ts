import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface UpstreamSource {
  kind: 'call' | 'web_research' | 'competitor' | 'manual' | 'curator' | 'unknown';
  title?: string;
  body?: string;
  url?: string;
  meta?: Record<string, string | number>;
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
            .select('raw_topic, raw_context, evidence, why_score, post_angle, source')
            .eq('id', candidateId)
            .single();
          if (!error && data) {
            setSource({
              kind: 'curator',
              title: data.raw_topic || 'Curator candidate',
              body: data.raw_context || data.why_score || '',
              meta: data.evidence ? { evidence: JSON.stringify(data.evidence).slice(0, 500) } : undefined,
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
