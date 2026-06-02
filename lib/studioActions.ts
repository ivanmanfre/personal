// Studio actions — the Railway "scroll-recorder" service that used to host
// these endpoints returns 404 for all /carousel/* routes. Every mutation now
// either writes directly to Supabase or fires the appropriate n8n webhook.
// Reads still go through useContentLibrary as before.

export interface BuildResult {
  ok: boolean;
  draft_id: string | null;
  verdict: string;
  attempts: number;
  qa: { failing_slides: number[]; feedback: string };
  slides: { slide_number: number; url: string }[];
}

const POSTGEN_URL = 'https://n8n.ivanmanfredi.com/webhook/post-gen-v2';

// Build a carousel: fires Post Gen v2 with post_format='Carousel'. The workflow's
// internal "Is Carousel?" branch routes to the Carousel Generation sub-workflow.
export async function buildCarousel(input: {
  carousel_id: string;
  topic: string;
  key_points?: string[];
  asset_needs?: { logos?: string[]; screenshots?: string[] } | null;
  draft_id?: string;
}): Promise<BuildResult> {
  const draftId = input.draft_id || input.carousel_id;
  const res = await fetch(POSTGEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      draft_id: draftId,
      topic: input.topic,
      title: input.topic,
      author: 'Ivan',
      source: 'Studio',
      post_format: 'Carousel',
      post_format_details: (input.key_points || []).join('\n'),
      include_image: 'No',
    }),
  });
  if (!res.ok) throw new Error(`build carousel failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  // Webhook is "onReceived" — returns {message:"Workflow was started"} immediately.
  // We return a BuildResult shape with placeholders so callers' optional chaining works.
  return { ok: true, draft_id: draftId, verdict: 'PENDING', attempts: 0, qa: { failing_slides: [], feedback: '' }, slides: [] };
}

export async function saveDraft(input: {
  id: string;
  title?: string;
  topic?: string;
  post_body?: string;
  ig_caption?: string;
  status?: string;
  // Taxonomy is a JSONB column; pass partial keys and we merge with existing.
  // The merge happens in this function so callers don't need to fetch first.
  taxonomy?: Record<string, unknown>;
  // Slides is also JSONB. Pass the FULL next array (we don't deep-merge slides).
  slides?: any[];
}) {
  const { supabase } = await import('./supabase');
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.topic !== undefined) patch.topic = input.topic;
  if (input.post_body !== undefined) patch.post_body = input.post_body;
  if (input.ig_caption !== undefined) patch.ig_caption = input.ig_caption;
  if (input.status !== undefined) patch.status = input.status;
  if (input.slides !== undefined) patch.slides = input.slides;
  // Taxonomy: read-modify-write merge so partial updates don't blow away keys.
  if (input.taxonomy !== undefined) {
    const { data: row, error: readErr } = await supabase
      .from('carousel_drafts').select('taxonomy').eq('id', input.id).maybeSingle();
    if (readErr) throw new Error(`saveDraft taxonomy read failed: ${readErr.message}`);
    patch.taxonomy = { ...(row?.taxonomy || {}), ...input.taxonomy };
  }
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await supabase.from('carousel_drafts').update(patch).eq('id', input.id);
  if (error) throw new Error(`saveDraft failed: ${error.message}`);
  return { ok: true };
}

// Upload a user-picked image for a single_image or text post.
// Writes to the `post-stills` public bucket; returns the public URL.
// On success, patches carousel_drafts:
//   - image_urls = [publicUrl]  (replaces any existing image)
//   - type = 'single_image'      (when the post was previously 'text')
// The same URL form the rest of the pipeline already understands; renders via
// CarouselEditor's existing image branch (toImgSrc handles non-Drive URLs verbatim).
export async function uploadPostImage(input: { draft_id: string; file: File; current_type?: string | null }) {
  const { supabase } = await import('./supabase');
  const file = input.file;
  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'} (use PNG / JPG / WebP / GIF)`);
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 10 MB)`);
  }
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
  // Path is draft-scoped so re-uploads naturally overwrite via upsert; cache-busting
  // via a short numeric suffix derived from updated_at avoids serving the old image.
  const cacheBust = String(file.lastModified || file.size).slice(-6);
  const path = `${input.draft_id}/${cacheBust}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from('post-stills')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (upErr) throw new Error(`upload failed: ${upErr.message}`);
  const { data: pub } = supabase.storage.from('post-stills').getPublicUrl(path);
  const publicUrl = pub.publicUrl;
  if (!publicUrl) throw new Error('upload succeeded but no public URL returned');

  const patch: Record<string, unknown> = { image_urls: [publicUrl] };
  // Promote a plain-text post to single_image once it has an attached image.
  if (input.current_type === 'text' || input.current_type === null || input.current_type === undefined) {
    patch.type = 'single_image';
  }
  const { error: dbErr } = await supabase.from('carousel_drafts').update(patch).eq('id', input.draft_id);
  if (dbErr) throw new Error(`db update failed: ${dbErr.message}`);
  return { ok: true, url: publicUrl };
}

export async function setStatus(id: string, status: string) {
  const { supabase } = await import('./supabase');
  const { error } = await supabase.from('carousel_drafts').update({ status }).eq('id', id);
  if (error) throw new Error(`setStatus failed: ${error.message}`);
  return { ok: true };
}

// Schedule a post directly against Supabase. Bridge workflow yzXqLDIpuNzuhUQq
// picks up status='scheduled' rows and INSERTs the publisher queue row.
export async function scheduleCarousel(draft_id: string, scheduled_at: string) {
  const { supabase } = await import('./supabase');
  const { error } = await supabase.from('carousel_drafts').update({
    status: 'scheduled',
    scheduled_at,
  }).eq('id', draft_id);
  if (error) throw new Error(`schedule failed: ${error.message}`);
  return { ok: true, draft_id, scheduled_at };
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

export async function saveLMDraft(input: {
  id: string;
  post_body?: string | null;
  email_copy?: string | null;
  resource_html?: string | null;
  spec_patch?: Record<string, unknown>;
}): Promise<void> {
  const { supabase } = await import('./supabase');
  const update: Record<string, unknown> = {};
  if (input.post_body !== undefined) update.post_body = input.post_body;
  if (input.email_copy !== undefined) update.email_copy = input.email_copy;
  if (input.resource_html !== undefined) update.resource_html = input.resource_html;
  if (input.spec_patch && Object.keys(input.spec_patch).length) {
    const { data: row } = await supabase.from('lm_drafts_v2').select('spec').eq('id', input.id).single();
    update.spec = { ...((row?.spec as Record<string, unknown>) || {}), ...input.spec_patch };
  }
  const { error } = await supabase.from('lm_drafts_v2').update(update).eq('id', input.id);
  if (error) throw error;
}

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
