// Render-label map — translate Supabase DB status values into the ClickUp board
// vocabulary Ivan reads daily, without doing a DB migration. The DB stays on
// 'idea' / 'ready' / 'generating' etc; the dashboard surfaces 'Suggestion' /
// 'Complete' / 'Generating content'. New `ready_to_post` status added as an
// intermediate state between approved and scheduled (mirrors ClickUp's Posts
// board).
// Post workflow: suggestion (idea) → click Generate → generating content
// → review → click Approve → scheduled → published.
// No ready_to_post: Approve schedules directly. No intermediate state needed.
export const POST_STATUSES = [
  'idea',
  'generating',
  'review',
  'approved',
  'scheduled',
  'published',
  'disqualified',
  'error',
] as const;

export const LM_STATUSES = [
  'idea',
  'generating',
  'generating_assets',
  'review',
  'approved',
  'scheduled',
  'published',
  'disqualified',
  'error',
] as const;

export type PostStatus = typeof POST_STATUSES[number];
export type LmStatus = typeof LM_STATUSES[number];

// DB value → ClickUp-vocab label. Keep keys exhaustive — if a DB value isn't
// here, fall back to humanizing the value (snake_case → Title Case).
const RAW_LABEL_MAP: Record<string, string> = {
  // Posts
  idea: 'Idea',
  generating: 'Generating content',
  review: 'Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
  disqualified: 'Disqualified',
  error: 'Error',
  // LM-only
  generating_assets: 'Generating resources',
  // Legacy/stray DB values — not in the canonical status set, but can appear
  // in lm_drafts_v2 rows that bypassed normalizeLmStatus (e.g. written by
  // older n8n workflows). Map to canonical display labels so the UI never
  // renders raw underscore values like "Lm Review".
  lm_review: 'In review',
  generating_content: 'Generating content',
  // Legacy/duplicate DB values — normalized away in useLeadMagnets, but kept
  // here so any raw leak still renders the canonical label.
  ready: 'Published',
  complete: 'Published',
  draft: 'Idea',
};

export function statusLabel(status: string): string {
  if (RAW_LABEL_MAP[status]) return RAW_LABEL_MAP[status];
  // Fallback humanization for unknown values
  return status.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}
