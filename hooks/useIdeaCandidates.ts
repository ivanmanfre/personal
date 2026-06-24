import { useState, useEffect, useCallback, useRef } from 'react';
import type { CarouselDraft } from './useContentLibrary';
import { fetchIdeaDrafts } from '../lib/ideaProjection';

// useIdeaCandidates — loads the curator-scored content ideas (lm_idea_candidates,
// reviewing + post) projected as Idea-stage board rows. The feed has no realtime
// channel, so we refresh on an interval + on demand. `removeIdea` drops a row
// optimistically right after an approve/reject so the Idea stage updates
// instantly (the candidate has already left 'reviewing' server-side).
export function useIdeaCandidates(pollMs = 60000) {
  const [ideas, setIdeas] = useState<CarouselDraft[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const removedRef = useRef<Set<string>>(new Set());

  const refreshIdeas = useCallback(async () => {
    try {
      const rows = await fetchIdeaDrafts();
      // Drop anything we just optimistically removed but the feed hasn't caught
      // up on yet (it's eventually consistent through the decide edge fn).
      setIdeas(rows.filter((r) => !removedRef.current.has(r.ideaCandidateId || '')));
    } catch (err) {
      console.warn('[idea-candidates] load failed:', err);
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
