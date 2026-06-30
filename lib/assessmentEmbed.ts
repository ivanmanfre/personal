// Pure builder: a scan's LM payload -> a results-forward embed URL for the live assessment engine.
const RESOURCES_BASE = 'https://resources.ivanmanfredi.com';

export interface AssessmentEmbedLm {
  slug?: string;
  seed_answers?: Record<string, number>;
}

export interface AssessmentEmbedOpts {
  prospectId?: string;
  src?: string;
}

/** base64-encode a JSON-safe object. Payload is question ids + integer indices (ASCII). */
function encodeSeed(seed: Record<string, number>): string {
  return btoa(JSON.stringify(seed));
}

/**
 * Build the iframe src for the live, results-forward assessment.
 * Returns null when the LM can't be embedded (no slug or no seed answers),
 * so the caller can skip the section entirely.
 */
export function buildAssessmentEmbedUrl(
  lm: AssessmentEmbedLm | undefined | null,
  opts?: AssessmentEmbedOpts
): string | null {
  if (!lm || !lm.slug) return null;
  const seed = lm.seed_answers;
  if (!seed || Object.keys(seed).length === 0) return null;
  const params = new URLSearchParams();
  params.set('mode', 'result');
  params.set('seed', encodeSeed(seed));
  params.set('src', opts?.src ?? 'scan_embed');
  if (opts?.prospectId) params.set('pid', opts.prospectId);
  return `${RESOURCES_BASE}/${encodeURIComponent(lm.slug)}/?${params.toString()}`;
}
