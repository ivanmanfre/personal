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

// Type-aware regeneration helper. Replaces the old pattern where callers
// hardcoded buildCarousel (which forced post_format='Carousel' even on text
// or single_image posts, silently turning every Re-author into a carousel).
// Sets status='generating' + records generating_started_at, then fires the
// right pipeline per type.
export async function regenerateDraft(draft: {
  id: string;
  type: string | null;
  topic: string | null;
  title: string | null;
  taxonomy: Record<string, any> | null;
}) {
  const { supabase } = await import('./supabase');
  const startedAt = new Date().toISOString();
  const nextTax = { ...(draft.taxonomy || {}), generating_started_at: startedAt };
  const { error: upErr } = await supabase.from('carousel_drafts').update({
    status: 'generating',
    taxonomy: nextTax,
  }).eq('id', draft.id);
  if (upErr) throw new Error(`status flip failed: ${upErr.message}`);

  if (draft.type === 'carousel') {
    return buildCarousel({
      carousel_id: draft.id,
      topic: draft.topic || draft.title || '',
      key_points: [],
      draft_id: draft.id,
    });
  }
  const tax = (draft.taxonomy || {}) as Record<string, any>;
  return generatePostContent({
    draft_id: draft.id,
    topic: draft.topic || draft.title || '',
    title: draft.title || draft.topic || '',
    author: 'Ivan',
    source: (tax.source as string) || 'Studio',
    post_format: draft.type === 'single_image' ? 'Single Image' : 'Text Post',
    post_format_details: draft.type === 'single_image' ? 'standard post with concept image' : 'standard text post',
    include_image: draft.type === 'single_image' ? 'Yes' : 'No',
    image_style: draft.type === 'single_image' ? ((tax.image_style as string) || 'Concept Visual') : undefined,
  });
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

// List every image in the post-stills bucket (the library). Returns newest
// first. Used by the editor's "From library" picker so a single uploaded
// image can be reused across many posts without re-uploading from disk.
//
// Path convention: `${draft_id}/${cacheBust}.${ext}`. We walk the bucket
// recursively (one folder per draft) and flatten. Caller can show a grid
// of thumbnails + apply on click via applyImageToDraft.
export interface PostStill {
  name: string;
  path: string;
  url: string;
  createdAt: string;
  sizeBytes: number;
  fromDraftId: string;
  // 'video' for .mp4/.mov/.webm; 'image' for everything else.
  kind: 'image' | 'video';
}

export function isVideoExt(name: string): boolean {
  return /\.(mp4|mov|webm|m4v)$/i.test(name);
}

export async function listPostStills(limit = 200): Promise<PostStill[]> {
  const { supabase } = await import('./supabase');
  // 1) List top-level folders (each is a draft_id)
  const { data: folders, error: foldersErr } = await supabase.storage
    .from('post-stills').list('', { limit: 1000, sortBy: { column: 'created_at', order: 'desc' } });
  if (foldersErr) throw new Error(`list bucket failed: ${foldersErr.message}`);
  // 2) For each folder fetch its files in parallel
  const folderNames = (folders || []).filter((f) => f.id === null).map((f) => f.name).slice(0, limit);
  const fileLists = await Promise.all(folderNames.map(async (folder) => {
    const { data: files } = await supabase.storage
      .from('post-stills').list(folder, { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });
    return (files || []).filter((f) => f.id !== null).map((f) => ({
      name: f.name,
      path: `${folder}/${f.name}`,
      url: supabase.storage.from('post-stills').getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
      createdAt: f.created_at || f.updated_at || '',
      sizeBytes: (f.metadata as any)?.size || 0,
      fromDraftId: folder,
      kind: isVideoExt(f.name) ? 'video' as const : 'image' as const,
    }));
  }));
  const flat = fileLists.flat();
  flat.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return flat.slice(0, limit);
}

// Apply an existing image URL (from the library) to a draft without
// re-uploading. Mirrors the post-write half of uploadPostImage: writes
// image_urls + promotes type from text → single_image when relevant.
export async function applyImageToDraft(input: { draft_id: string; url: string; current_type?: string | null }) {
  const { supabase } = await import('./supabase');
  if (!input.url || !/^https?:\/\//.test(input.url)) {
    throw new Error(`Invalid image URL: ${input.url}`);
  }
  const patch: Record<string, unknown> = { image_urls: [input.url] };
  if (input.current_type === 'text' || input.current_type === null || input.current_type === undefined) {
    patch.type = 'single_image';
  }
  const { error } = await supabase.from('carousel_drafts').update(patch).eq('id', input.draft_id);
  if (error) throw new Error(`apply image failed: ${error.message}`);
  return { ok: true, url: input.url };
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
  const SUPPORTED = /^(image\/(png|jpe?g|webp|gif)|video\/(mp4|quicktime|webm))$/i;
  if (!SUPPORTED.test(file.type)) {
    throw new Error(`Unsupported file type: ${file.type || 'unknown'} (use PNG / JPG / WebP / GIF / MP4 / MOV / WebM)`);
  }
  if (file.size > 100 * 1024 * 1024) {
    throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(1)} MB (max 100 MB)`);
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

// Publish a post to LinkedIn RIGHT NOW, skipping the schedule. Fires the
// on-demand entry on the Scheduled Post Publisher (n8n wf 0Ym6bP7gEmskPJZn):
// the webhook (re)queues this draft's scheduled_posts row as due-now and runs
// the SAME proven publish pipeline as scheduled posts. scheduled_posts is RLS
// SELECT-only for the anon key, so the requeue must happen server-side (service
// role inside n8n) — hence a webhook, not a direct Supabase write.
// Guarded server-side: an already-posted/posting draft is refused (no double
// post). The webhook is "onReceived" → returns immediately; the publish runs
// async (~10-30s) and realtime flips the draft to 'published' with the URN.
const PUBLISH_NOW_WEBHOOK = import.meta.env.VITE_PUBLISH_NOW_WEBHOOK || 'https://n8n.ivanmanfredi.com/webhook/publish-now';
const PUBLISH_NOW_SECRET = import.meta.env.VITE_PUBLISH_NOW_SECRET || 'pn-1ee9c4f2a7';

export async function publishPostNow(draft_id: string) {
  const res = await fetch(PUBLISH_NOW_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft_id, secret: PUBLISH_NOW_SECRET }),
  });
  if (!res.ok) throw new Error(`publish now failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json().catch(() => ({ ok: true }));
}

// === Animated videos (video-gen-v2 webhook + ivan-flow-video engine) ===
// The engine renders async: video-gen-v2 returns immediately, the engine renders
// in the background (~150s) and PATCHes carousel_drafts {video_url, video_status:'review'}.
// Realtime on carousel_drafts surfaces the result, so the UI just fires + waits.
const VIDEO_WEBHOOK = import.meta.env.VITE_VIDEO_GEN_WEBHOOK || 'https://n8n.ivanmanfredi.com/webhook/video-gen-v2';

// Redo a video: optionally write feedback (Author Spec folds it into the new spec),
// flip video_status to 'generating', then fire the render. style defaults to the
// draft's current style.
export async function redoVideo(input: { draft_id: string; style: string; feedback?: string }) {
  const { supabase } = await import('./supabase');
  // Persist the chosen style too — keeps the Animated-tab label correct and makes
  // a later Redo default to the same style instead of falling back to serpentine.
  const patch: Record<string, unknown> = { video_status: 'generating', video_style: input.style };
  if (input.feedback != null) patch.video_feedback = input.feedback;
  const { error } = await supabase.from('carousel_drafts').update(patch).eq('id', input.draft_id);
  if (error) throw new Error(`redo (status write) failed: ${error.message}`);
  // Fire the render. The n8n gateway occasionally 502s on a cold webhook hit;
  // one retry covers it. The engine then renders async (~150s) and PATCHes back
  // { video_url, video_status:'review' }, which realtime surfaces in the UI.
  let lastErr = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(VIDEO_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft_id: input.draft_id, style: input.style }),
    });
    if (res.ok) return res.json().catch(() => ({ ok: true }));
    lastErr = `${res.status} ${(await res.text()).slice(0, 200)}`;
  }
  throw new Error(`video-gen-v2 failed: ${lastErr}`);
}

// Approve a reviewed video AND schedule it to the next open slot. Sets
// video_status='approved' + status='scheduled' + scheduled_at, which the Bridge
// (yzXqLDIpuNzuhUQq) picks up → scheduled_posts {post_format:'video',
// media_urls:[video_url]} → Scheduled Post Publisher → native LinkedIn video.
export async function approveVideo(draft_id: string) {
  const { supabase } = await import('./supabase');
  const { findNextSlot } = await import('./findNextSlot');
  const slot = await findNextSlot();
  const iso = slot.toISOString();
  const { error } = await supabase.from('carousel_drafts')
    .update({ video_status: 'approved', status: 'scheduled', scheduled_at: iso })
    .eq('id', draft_id);
  if (error) throw new Error(`approve+schedule failed: ${error.message}`);
  return { ok: true, draft_id, scheduled_at: iso };
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

export async function generateLMContent(input: Omit<LMGenPayload, 'phase'>) {
  // Flip the stage BEFORE firing, same as regenerateDraft does for posts — the
  // board card moves to Generating immediately and a second click can't
  // silently double-fire the pipeline.
  const { supabase } = await import('./supabase');
  const { error } = await supabase
    .from('lm_drafts_v2')
    .update({ status: 'generating' })
    .eq('id', input.draft_id);
  if (error) throw new Error(`status flip failed: ${error.message}`);
  return fireLM({ ...input, phase: 'content' });
}

export function buildLMAssets(input: Omit<LMGenPayload, 'phase'>) {
  return fireLM({ ...input, phase: 'assets' });
}

// Schedule (or reschedule) an LM's promo LinkedIn post. The promo post lives in
// scheduled_posts (the build/assets phase inserts it). Scheduling = (re)queue the
// most recent row for this LM at the chosen time, or insert one from the draft's
// post_body + cover if no row exists yet. Also moves the LM stage to 'scheduled'.
export async function scheduleLM(draft_id: string, scheduled_at: string) {
  // scheduled_posts is SELECT-only for the dashboard's anon key (RLS) — a direct
  // update silently matches 0 rows while the draft status flip succeeds, so the
  // card says scheduled but the queue keeps the stale time. The lm-schedule edge
  // function does the queue write with the service role and flips the draft.
  const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  const res = await fetch('https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/lm-schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + anonKey },
    body: JSON.stringify({ draft_id, scheduled_at }),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.ok) throw new Error(`schedule failed: ${out.error || res.status}${out.detail ? ' — ' + out.detail : ''}`);
  return { ok: true, draft_id, scheduled_at };
}

const LM_REPOST_WEBHOOK =
  import.meta.env.VITE_LM_GEN_WEBHOOK || 'https://n8n.ivanmanfredi.com/webhook/lm-gen-v2';
const LM_REPOST_SECRET = import.meta.env.VITE_LM_REPOST_SECRET || 'pn-1ee9c4f2a7';

/**
 * Repost an already-published lead magnet: n8n regenerates fresh, lint-filtered
 * promo copy for the SAME resource and inserts a new pending scheduled_posts row
 * (is_repost=true) at the next slot. Does not touch the resource or the original post.
 */
export async function repostLeadMagnet(draft_id: string): Promise<{ ok: boolean }> {
  const res = await fetch(LM_REPOST_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft_id, phase: 'repost', secret: LM_REPOST_SECRET }),
  });
  if (!res.ok) throw new Error(`repost failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json().catch(() => ({ ok: true }));
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

export function replaceAt(urls: string[], index: number, url: string): string[] {
  const out = [...urls];
  if (index >= 0 && index < out.length) out[index] = url;
  return out;
}

export async function commitImageEdit(a: {
  draftId: string; imageUrls: string[]; index: number; newUrl: string; op: string; prompt?: string;
}): Promise<string[]> {
  const { supabase } = await import('./supabase');
  const next = replaceAt(a.imageUrls, a.index, a.newUrl);
  await supabase.from('image_edit_versions').insert({
    draft_id: a.draftId, image_index: a.index,
    prev_url: a.imageUrls[a.index] ?? null, new_url: a.newUrl, op: a.op, prompt: a.prompt ?? null,
  });
  const { error } = await supabase.from('carousel_drafts').update({ image_urls: next }).eq('id', a.draftId);
  if (error) throw new Error(error.message);
  return next;
}

export async function revertImageEdit(a: {
  draftId: string; imageUrls: string[]; index: number; prevUrl: string;
}): Promise<string[]> {
  const { supabase } = await import('./supabase');
  const next = replaceAt(a.imageUrls, a.index, a.prevUrl);
  const { error } = await supabase.from('carousel_drafts').update({ image_urls: next }).eq('id', a.draftId);
  if (error) throw new Error(error.message);
  return next;
}
