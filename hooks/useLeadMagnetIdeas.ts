import { useState, useEffect, useCallback } from 'react';
import type { LeadMagnetDraft } from './useLeadMagnets';
import { fetchLeadMagnetIdeaDrafts } from '../lib/lmIdeaProjection';

// useLeadMagnetIdeas — loads the curator-scored lead_magnet ideas
// (lm_idea_candidates, reviewing + content_type=lead_magnet) projected as
// Idea-stage rows for the Lead Magnet Studio board. Mirrors useIdeaCandidates
// (the Posts-board equivalent). No realtime channel, so refresh on interval.
export function useLeadMagnetIdeas(pollMs = 60000) {
  const [ideas, setIdeas] = useState<LeadMagnetDraft[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);

  const refreshIdeas = useCallback(async () => {
    try {
      setIdeas(await fetchLeadMagnetIdeaDrafts());
    } catch (err) {
      console.warn('[lm-idea-candidates] load failed:', err);
    } finally {
      setLoadingIdeas(false);
    }
  }, []);

  useEffect(() => {
    refreshIdeas();
    if (!pollMs) return;
    const t = setInterval(refreshIdeas, pollMs);
    return () => clearInterval(t);
  }, [refreshIdeas, pollMs]);

  return { ideas, loadingIdeas, refreshIdeas };
}
