// Canonical pillar key→label map for own_posts.pillar. Editorial display copy
// (unchanged from PerformancePanel's original local map). Unknown non-null keys
// are surfaced with an "unmapped" flag so the UI can badge them instead of
// silently dropping or showing a raw snake_case slug.
export const PILLAR_LABELS: Record<string, string> = {
  translator: 'Agency Diagnostic',
  methodology: 'Build-in-public',
  teardown: 'Anti-slop',
  case_study: 'Case study',
  personal: 'Owner-POV',
};

export function normalizePillar(key: string | null | undefined): { key: string; label: string; unmapped: boolean } {
  if (!key) return { key: '', label: '', unmapped: false };
  const known = PILLAR_LABELS[key];
  return { key, label: known ?? key, unmapped: known === undefined };
}
