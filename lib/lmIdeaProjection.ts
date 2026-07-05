// Lead-magnet idea projection — surfaces curator-scored lead_magnet candidates
// (lm_idea_candidates, status=reviewing, content_type=lead_magnet) onto the Lead
// Magnet Studio board's **Idea stage**, mirroring how ideaProjection.ts does it
// for the Posts board. The candidate stays a distinct row; approving it (via the
// existing LmIdeasPanel → lm-curator-decide) promotes it into a real lm_drafts_v2
// draft, so it naturally leaves the Idea stage. This module only READS the feed.
import type { LeadMagnetDraft } from '../hooks/useLeadMagnets';
import { type IdeaCandidate, strengthBand, assembleIdeaDescription } from './ideaProjection';

const SUPA = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const FEED_URL = `${SUPA}/functions/v1/lm-curator-feed`;
const ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

// Curator format_recommendation → canonical LM Studio format. The Studio filters
// out any row whose format isn't in its canonical set (FORMATS_SET), so an idea
// row MUST carry a canonical format or it silently vanishes. Unknown → 'Guide'.
const CURATOR_FORMAT_MAP: Record<string, string> = {
  calculator: 'Calculator',
  checklist: 'Checklist',
  guide: 'Guide',
  assessment: 'Interactive Assessment',
  interactiveassessment: 'Interactive Assessment',
  n8nworkflow: 'N8N Workflow',
  workflow: 'N8N Workflow',
  stackpicker: 'Stack Picker',
  architecture: 'Annotated Architecture',
  annotatedarchitecture: 'Annotated Architecture',
  walkthrough: 'Live AI Walkthrough',
  liveaiwalkthrough: 'Live AI Walkthrough',
  aikit: 'AI Kit',
  skillpack: 'Skill Pack',
};
function mapCuratorFormat(fmt?: string | null): string {
  const key = (fmt || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return CURATOR_FORMAT_MAP[key] || 'Guide';
}

// Map a curator lead_magnet candidate into a LeadMagnetDraft-shaped board row at
// the Idea stage. Id is prefixed so it can never collide with a real lm_drafts_v2
// uuid, and so the panel can recognise an idea row by `ideaCandidateId`.
export function candidateToLmIdeaDraft(c: IdeaCandidate): LeadMagnetDraft {
  return {
    id: `idea:${c.id}`,
    topic: c.normalized_topic || c.raw_topic || null,
    format: mapCuratorFormat(c.format_recommendation),
    status: 'idea',
    postBody: null,
    resourceHtml: null,
    resourceUrl: null,
    emailCopy: null,
    coverUrl: null,
    videoUrl: null,
    ogUrl: null,
    slug: null,
    spec: null,
    qa: null,
    updatedAt: c.ingested_at,
    agentLog: [],
    topicStrength: strengthBand(c.composite_score),
    notes: null,
    source: c.source,
    description: assembleIdeaDescription(c),
    ideaCandidateId: c.id,
    ideaScore: c.composite_score,
  };
}

// Fetch the curator feed and project the pending LEAD-MAGNET candidates as
// Idea-stage rows (everything the feed marks non-post — mirrors LmIdeasPanel's
// matchesContentType lead-magnet bucket).
export async function fetchLeadMagnetIdeaDrafts(): Promise<LeadMagnetDraft[]> {
  const r = await fetch(FEED_URL, { headers: { Authorization: 'Bearer ' + ANON_KEY } });
  if (!r.ok) throw new Error('lm-idea-feed HTTP ' + r.status);
  const j = await r.json();
  const pending: IdeaCandidate[] = Array.isArray(j?.pending) ? j.pending : [];
  return pending
    .filter((c) => c.content_type !== 'post')
    .map(candidateToLmIdeaDraft);
}
