// Funnel lens (2026-07-26): derived, advisory-only view of the week's idea mix.
// Labels are plain English on every surface (Reach / Trust / Buyers), never
// TOFU/MOFU/BOFU. The format mix stays the strategy axis; this only reports
// balance. Duplicated knowingly in the LM Curator Friday Digest n8n node and
// the lm-curator-feed edge fn (no shared runtime between n8n, Deno and Vite).
export type FunnelStage = 'reach' | 'trust' | 'buyers';

const BUYER_SOURCES = new Set(['calls', 'kyle_call', 'ivan_call']);
const REACH_SOURCES = new Set(['breaking_news', 'hacker_news', 'model_launch', 'x_search', 'reddit_se']);

export function funnelStageFor(source: string, format?: string | null): FunnelStage {
  const f = (format || '').toLowerCase();
  if (f.includes('case study') || f.includes('case-study')) return 'buyers';
  if (f.includes('teardown') || f.includes('opinion') || f.includes('hot take')) return 'reach';
  if (BUYER_SOURCES.has(source)) return 'buyers';
  if (REACH_SOURCES.has(source)) return 'reach';
  return 'trust';
}

export const STAGE_LABELS: Record<FunnelStage, string> = {
  reach: 'Reach',
  trust: 'Trust',
  buyers: 'Buyers',
};
