// Studio actions → the scroll-recorder service (compute + service-key DB writes).
// Reads go directly through Supabase (useContentLibrary); these are the write/compute calls.
const SVC = import.meta.env.VITE_PROCESSOR_URL || 'https://ivan-recorder-production.up.railway.app';
const TOKEN = import.meta.env.VITE_PROCESSOR_TOKEN || '';

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
  };
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${SVC}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export interface BuildResult {
  ok: boolean;
  draft_id: string | null;
  verdict: string;
  attempts: number;
  qa: { failing_slides: number[]; feedback: string };
  slides: { slide_number: number; url: string }[];
}

// Build a carousel from a topic. carousel_id = storage folder (any stable string).
export function buildCarousel(input: {
  carousel_id: string;
  topic: string;
  key_points?: string[];
  asset_needs?: { logos?: string[]; screenshots?: string[] } | null;
  draft_id?: string;
}): Promise<BuildResult> {
  return post('/carousel/build', input) as Promise<BuildResult>;
}

export function saveDraft(input: { id: string; title?: string; topic?: string; post_body?: string; ig_caption?: string; status?: string }) {
  return post('/carousel/draft', input);
}

export function setStatus(id: string, status: string) {
  return post('/carousel/status', { id, status });
}

export function scheduleCarousel(draft_id: string, scheduled_at: string) {
  return post('/carousel/schedule', { draft_id, scheduled_at });
}

// === Lead Magnets v2 (LM-gen-v2 webhook on n8n) =====================
const LM_WEBHOOK = import.meta.env.VITE_LM_GEN_WEBHOOK || 'https://n8n.ivanmanfredi.com/webhook/lm-gen-v2';

export interface LMGenPayload {
  draft_id: string;
  topic: string;
  format: string;
  phase: 'content' | 'assets';
  editorial_notes?: string;
  target_audience?: string;
}

async function fireLM(payload: LMGenPayload) {
  const res = await fetch(LM_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`lm-gen-v2 ${payload.phase} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export function generateLMContent(input: Omit<LMGenPayload, 'phase'>) {
  return fireLM({ ...input, phase: 'content' });
}

export function buildLMAssets(input: Omit<LMGenPayload, 'phase'>) {
  return fireLM({ ...input, phase: 'assets' });
}

// Regenerate just the LM cover image (Gemini Nano Banana Pro, ~2-3 min, ~$0.24).
// Fires a standalone n8n workflow that generates fresh cover copy + re-renders
// + PATCHes lm_drafts_v2.cover_url. Does NOT touch any other LM fields.
const LM_REGEN_COVER_WEBHOOK = import.meta.env.VITE_LM_REGEN_COVER_WEBHOOK || 'https://n8n.ivanmanfredi.com/webhook/lm-regen-cover-v2';

export async function regenLMCover(input: { draft_id: string }): Promise<{ ok: boolean; url?: string; duration_ms?: number }> {
  const res = await fetch(LM_REGEN_COVER_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`lm-regen-cover-v2 failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// === Post Generation v2 (post-gen-v2 webhook on n8n; text + single-image posts) ====
const POSTGEN_WEBHOOK = import.meta.env.VITE_POSTGEN_WEBHOOK || 'https://n8n.ivanmanfredi.com/webhook/post-gen-v2';

export interface PostGenPayload {
  draft_id: string;
  topic: string;
  title?: string;
  author?: string;
  source?: string;
  post_format: 'Text Post' | 'Single Image';
  post_format_details?: string;
  include_image: 'Yes' | 'No';
  image_style?: string;
}

export async function generatePostContent(payload: PostGenPayload) {
  const res = await fetch(POSTGEN_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`post-gen-v2 failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
