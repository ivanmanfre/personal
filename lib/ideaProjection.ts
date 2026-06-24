// Idea projection — surfaces curator-scored content angles (lm_idea_candidates,
// status=reviewing, content_type=post) onto the Posts board's **Idea stage**.
//
// Design: the Idea stage is a live PROJECTION of pending candidates, not a copy.
// We fetch the curator feed and map each candidate into a CarouselDraft-shaped
// row with status='idea'. Approving calls the EXISTING lm-curator-decide edge
// fn (unchanged) → the Promoter creates the real generating draft and flips the
// candidate to 'promoted', so it naturally leaves the Idea stage. The idea
// (candidate) and the post (artifact) stay distinct rows; the user sees one
// continuous board: Idea → Generating → Review → … → Published.
import type { CarouselDraft } from '../hooks/useContentLibrary';

const SUPA = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://bjbvqvzbzczjbatgmccb.supabase.co';
const FEED_URL = `${SUPA}/functions/v1/lm-curator-feed`;
const DECIDE_URL = `${SUPA}/functions/v1/lm-curator-decide`;
const ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

export type IdeaDecision = 'approve' | 'reject' | 'defer';

export interface IdeaCandidate {
  id: string;
  source: string;
  content_type?: string | null;
  raw_topic: string;
  normalized_topic?: string | null;
  post_angle?: string | null;
  evidence: any;
  composite_score: number | null;
  icp_fit_score: number | null;
  virality_score: number | null;
  gap_score: number | null;
  beat_fit_score?: number | null;
  format_recommendation: string | null;
  offer_ladder_map: string | null;
  why_score: string | null;
  // Editorial Agent (Opus) assessment, when run at the idea stage (Phase 2).
  editorial_assessment?: string | null;
  editorial_strength?: string | null;
  status: string;
  ingested_at: string;
}

export const SOURCE_LABEL: Record<string, string> = {
  calls: 'Calls',
  kyle_call: 'Kyle coaching call',
  ivan_call: 'Ivan call',
  slack: 'Slack',
  hacker_news: 'Hacker News',
  search_demand: 'Search demand',
  reddit_se: 'Reddit/SE',
  breaking_news: 'Breaking news',
  model_launch: 'Model launch',
  x_search: 'X / search',
};

// format_recommendation → board post type (for the type filter + kicker).
export function ideaPostType(fmt?: string | null): 'text' | 'single_image' | 'carousel' | 'video' {
  const f = (fmt || '').toLowerCase();
  if (f.includes('carousel')) return 'carousel';
  if (f.includes('video')) return 'video';
  if (f.includes('img') || f.includes('image') || f.includes('single')) return 'single_image';
  return 'text';
}

function evidenceList(ev: any): Array<{ quote?: string; persona?: string; source?: string }> {
  if (!Array.isArray(ev)) return [];
  return ev
    .map((e: any) => ({
      quote: typeof e?.quote === 'string' ? e.quote : (typeof e?.excerpt === 'string' ? e.excerpt : undefined),
      persona: typeof e?.persona === 'string' ? e.persona : (typeof e?.author === 'string' ? e.author : undefined),
      source: typeof e?.source === 'string' ? e.source : (typeof e?.origin === 'string' ? e.origin : undefined),
    }))
    .filter((e) => e.quote || e.persona);
}

// Assemble the full idea context as a markdown description — angle + why +
// editorial assessment + evidence quotes + signal + source. This is what the
// user asked to live "on the description of the Idea stage".
export function assembleIdeaDescription(c: IdeaCandidate): string {
  const srcLabel = SOURCE_LABEL[c.source] || c.source;
  const lines: string[] = [];
  const angle = (c.post_angle || c.normalized_topic || c.raw_topic || '').trim();
  if (angle) lines.push(angle);
  if (c.why_score) lines.push('', `**Why it scores** — ${c.why_score}`);
  if (c.editorial_assessment) {
    lines.push('', `**Editorial assessment**${c.editorial_strength ? ` (${c.editorial_strength})` : ''} — ${c.editorial_assessment}`);
  }
  const ev = evidenceList(c.evidence);
  if (ev.length) {
    lines.push('', '**Evidence**');
    ev.slice(0, 4).forEach((e) => {
      const who = [e.persona, e.source && (SOURCE_LABEL[e.source] || e.source)].filter(Boolean).join(' · ');
      if (e.quote) lines.push(`> "${e.quote}"${who ? `\n> — ${who}` : ''}`);
      else if (who) lines.push(`> ${who}`);
    });
  }
  const sig = [
    c.composite_score != null ? `Composite ${c.composite_score}/30` : null,
    c.icp_fit_score != null ? `ICP ${c.icp_fit_score}/10` : null,
    c.virality_score != null ? `Viral ${c.virality_score}/10` : null,
    c.gap_score != null ? `Gap ${c.gap_score}/10` : null,
  ].filter(Boolean).join(' · ');
  if (sig) lines.push('', `**Signal** — ${sig}`);
  lines.push(`**Source** — ${srcLabel}`);
  if (c.format_recommendation || c.offer_ladder_map) {
    lines.push(`**Recommended** — ${c.format_recommendation || '—'}${c.offer_ladder_map ? ` · ladder ${c.offer_ladder_map}` : ''}`);
  }
  return lines.join('\n');
}

// Map a curator candidate into a CarouselDraft-shaped board row at the Idea stage.
export function candidateToIdeaDraft(c: IdeaCandidate): CarouselDraft {
  const type = ideaPostType(c.format_recommendation);
  const title = (c.raw_topic || c.normalized_topic || 'Untitled idea').slice(0, 200);
  return {
    // Prefix the id so it can never collide with a real carousel_drafts uuid,
    // and so PostStudioPanel can recognise an idea row by id shape too.
    id: `idea:${c.id}`,
    title,
    topic: c.normalized_topic || c.raw_topic || null,
    type,
    status: 'idea',
    imageUrls: [],
    postBody: null,
    igCaption: null,
    qa: null,
    taxonomy: { source: c.source, pillar: null },
    styleId: null,
    scheduledAt: null,
    updatedAt: c.ingested_at,
    agentLog: [],
    topicStrength: c.composite_score != null ? `${c.composite_score}/30` : null,
    renderEngine: null,
    sourcePostId: null,
    slides: [],
    description: assembleIdeaDescription(c),
    videoUrl: null,
    videoSpec: null,
    videoStatus: null,
    videoStyle: null,
    videoFeedback: null,
    // Idea-only fields (optional on CarouselDraft) — drive the detail panel + actions.
    isIdea: true,
    ideaCandidateId: c.id,
    ideaScores: {
      composite: c.composite_score,
      icp: c.icp_fit_score,
      virality: c.virality_score,
      gap: c.gap_score,
    },
    ideaWhy: c.why_score || null,
    ideaAssessment: c.editorial_assessment || null,
    ideaStrength: c.editorial_strength || null,
    ideaSource: c.source,
    ideaFormat: c.format_recommendation || null,
    ideaLadder: c.offer_ladder_map || null,
    ideaEvidence: evidenceList(c.evidence),
  };
}

// Fetch the curator feed and project the pending POST candidates as Idea-stage rows.
export async function fetchIdeaDrafts(): Promise<CarouselDraft[]> {
  const r = await fetch(FEED_URL, { headers: { Authorization: 'Bearer ' + ANON_KEY } });
  if (!r.ok) throw new Error('idea-feed HTTP ' + r.status);
  const j = await r.json();
  const pending: IdeaCandidate[] = Array.isArray(j?.pending) ? j.pending : [];
  return pending
    .filter((c) => c.content_type === 'post')
    .map(candidateToIdeaDraft);
}

// Approve / reject / defer an idea — calls the existing (unchanged) decide edge fn.
export async function decideIdea(candidateId: string, decision: IdeaDecision, reason?: string): Promise<any> {
  const body: any = { candidate_id: candidateId, decision };
  if (reason) body.reason = reason;
  const res = await fetch(DECIDE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ANON_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'decide ' + res.status);
  }
  return res.json().catch(() => ({}));
}
