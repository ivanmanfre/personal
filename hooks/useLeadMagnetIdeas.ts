import { useState, useEffect, useCallback, useRef } from 'react';
import type { LeadMagnetDraft } from './useLeadMagnets';
import { fetchLeadMagnetIdeaDrafts } from '../lib/lmIdeaProjection';

// useLeadMagnetIdeas — loads the curator-scored lead_magnet ideas
// (lm_idea_candidates, reviewing + content_type=lead_magnet) projected as
// Idea-stage rows for the Lead Magnet Studio board. Mirrors useIdeaCandidates
// (the Posts-board equivalent). No realtime channel, so refresh on interval.
// `removeIdea` drops a row optimistically right after an approve/reject so the
// Idea stage updates instantly (the candidate has already left 'reviewing'
// server-side).
export function useLeadMagnetIdeas(pollMs = 60000) {
  const [ideas, setIdeas] = useState<LeadMagnetDraft[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const removedRef = useRef<Set<string>>(new Set());

  const refreshIdeas = useCallback(async () => {
    try {
      const rows = await fetchLeadMagnetIdeaDrafts();
      setIdeas(rows.filter((r) => !removedRef.current.has(r.ideaCandidateId || '')));
    } catch (err) {
      console.warn('[lm-idea-candidates] load failed:', err);
    } finally {
      setLoadingIdeas(false);
    }
  }, []);

  const removeIdea = useCallback((candidateId: string) => {
    removedRef.current.add(candidateId);
    setIdeas((prev) => prev.filter((d) => d.ideaCandidateId !== candidateId));
  }, []);

  useEffect(() => {
    refreshIdeas();
    if (!pollMs) return;
    const t = setInterval(refreshIdeas, pollMs);
    return () => clearInterval(t);
  }, [refreshIdeas, pollMs]);

  return { ideas, loadingIdeas, refreshIdeas, removeIdea };
}
