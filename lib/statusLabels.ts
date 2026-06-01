// Render-label map — translate Supabase DB status values into the ClickUp board
// vocabulary Ivan reads daily, without doing a DB migration. The DB stays on
// 'idea' / 'ready' / 'generating' etc; the dashboard surfaces 'Suggestion' /
// 'Complete' / 'Generating content'. New `ready_to_post` status added as an
// intermediate state between approved and scheduled (mirrors ClickUp's Posts
// board).
export const POST_STATUSES = [
  'idea',
  'generating',
  'review',
  'approved',
  'ready_to_post',
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
  'ready',
  'disqualified',
  'error',
  'draft',
] as const;

export type PostStatus = typeof POST_STATUSES[number];
export type LmStatus = typeof LM_STATUSES[number];

// DB value → ClickUp-vocab label. Keep keys exhaustive — if a DB value isn't
// here, fall back to humanizing the value (snake_case → Title Case).
const RAW_LABEL_MAP: Record<string, string> = {
  // Posts
  idea: 'Suggestion',
  generating: 'Generating content',
  review: 'Review',
  approved: 'Approved',
  ready_to_post: 'Ready to post',
  scheduled: 'Scheduled',
  published: 'Published',
  disqualified: 'Disqualified',
  error: 'Error',
  // LM-only
  generating_assets: 'Generating assets',
  ready: 'Complete',
  draft: 'Draft',
};

export function statusLabel(status: string): string {
  if (RAW_LABEL_MAP[status]) return RAW_LABEL_MAP[status];
  // Fallback humanization for unknown values
  return status.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}
