// supabase/functions/img-edit/index.ts
// DEPLOY WITH: supabase functions deploy img-edit --no-verify-jwt --project-ref bjbvqvzbzczjbatgmccb
// (browser-called; platform JWT gate 401s without CORS → "Failed to send a request".
//  Auth handled in-function: per-IP rate limit + SSRF allowlist.)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getClientIp } from "../_shared/security.ts";

const RATE_PER_MIN = 20; // per-IP; each edit is a paid generation (fal/Gemini)

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

const FAL_INPAINT_MODEL = "fal-ai/flux-lora-fill"; // verify slug at fal.ai/models
const GEMINI_MODEL = "gemini-3.1-flash-image-preview";

// SSRF guard: only fetch/forward images from known-good hosts (no internal URLs).
const ALLOWED_HOST_SUFFIXES = [".supabase.co", ".fal.media", ".fal.run", "drive.google.com", ".googleusercontent.com"];
function assertAllowedUrl(u: string | undefined, label: string): string | null {
  if (!u) return `${label} required`;
  let parsed: URL;
  try { parsed = new URL(u); } catch { return `${label} is not a valid URL`; }
  if (parsed.protocol !== "https:") return `${label} must be https`;
  const host = parsed.hostname.toLowerCase();
  const ok = ALLOWED_HOST_SUFFIXES.some((s) => host === s.replace(/^\./, "") || host.endsWith(s));
  return ok ? null : `${label} host not allowed`;
}

async function fetchAsBase64(url: string): Promise<{ b64: string; mime: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch source ${r.status}`);
  const mime = r.headers.get("content-type") || "image/png";
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return { b64: btoa(bin), mime };
}

function opToPrompt(op: string, prompt?: string): string {
  if (prompt && prompt.trim()) return prompt.trim();
  if (op === "erase") return "remove the selected object and fill the area naturally to match the surroundings";
  return "improve the selected region";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { image_url?: string; op?: string; mask_url?: string; prompt?: string; whole_image?: boolean; draft_id?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { image_url, op = "refine", mask_url, prompt, whole_image, draft_id } = body;
  if (!image_url || !draft_id) return json({ error: "image_url and draft_id required" }, 400);
  const badImg = assertAllowedUrl(image_url, "image_url");
  if (badImg) return json({ error: badImg }, 400);
  if (mask_url) { const badMask = assertAllowedUrl(mask_url, "mask_url"); if (badMask) return json({ error: badMask }, 400); }
  if (typeof prompt === "string" && prompt.length > 2000) return json({ error: "prompt too long" }, 400);

  // per-IP rate limit (fixed 60s window) to cap cost-abuse of a paid endpoint
  try {
    const rl = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const bucket = Math.floor(Date.now() / 60000);
    const { data: allowed } = await rl.rpc("bump_edge_rate", {
      p_bucket: bucket, p_ip: getClientIp(req), p_fn: "img-edit", p_limit: RATE_PER_MIN,
    });
    if (allowed === false) return json({ error: "rate limit exceeded, slow down" }, 429);
  } catch { /* fail-open: never let the limiter break a legit edit */ }

  const useGemini = whole_image === true || !mask_url;

  try {
    let resultBytes: Uint8Array;

    if (useGemini) {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not configured" }, 503);
      const { b64, mime } = await fetchAsBase64(image_url);
      const gRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: mime, data: b64 } },
              { text: opToPrompt(op, prompt) },
            ] }],
          }),
        },
      );
      if (!gRes.ok) return json({ error: `gemini ${gRes.status}`, detail: (await gRes.text()).slice(0, 500) }, 502);
      const g = await gRes.json();
      // Gemini REST returns camelCase `inlineData` in responses (request takes snake_case) — accept both.
      const part = g?.candidates?.[0]?.content?.parts?.find((p: any) => p?.inline_data?.data || p?.inlineData?.data);
      const b64data: string | undefined = part?.inline_data?.data ?? part?.inlineData?.data;
      if (!b64data) return json({ error: "gemini returned no image", raw: g }, 502);
      resultBytes = Uint8Array.from(atob(b64data), (c) => c.charCodeAt(0));
    } else {
      const FAL_KEY = Deno.env.get("FAL_KEY");
      if (!FAL_KEY) return json({ error: "FAL_KEY not configured" }, 503);
      const falRes = await fetch(`https://fal.run/${FAL_INPAINT_MODEL}`, {
        method: "POST",
        headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ image_url, mask_url, prompt: opToPrompt(op, prompt) }),
      });
      if (!falRes.ok) return json({ error: `fal ${falRes.status}`, detail: (await falRes.text()).slice(0, 500) }, 502);
      const out = await falRes.json();
      const url: string | undefined = out?.images?.[0]?.url ?? out?.image?.url;
      if (!url) return json({ error: "fal returned no image", raw: out }, 502);
      const rb = await fetch(url);
      resultBytes = new Uint8Array(await rb.arrayBuffer());
    }

    // sniff the real format so JPEG bytes aren't served as image/png (breaks LinkedIn publish)
    const isJpeg = resultBytes[0] === 0xff && resultBytes[1] === 0xd8;
    const ext = isJpeg ? "jpg" : "png";
    const contentType = isJpeg ? "image/jpeg" : "image/png";

    // upload PREVIEW (not committed) to post-stills
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const path = `${draft_id}/_edit_preview/${Date.now()}.${ext}`;
    const up = await supa.storage.from("post-stills").upload(path, resultBytes, { upsert: true, contentType });
    if (up.error) return json({ error: `upload ${up.error.message}` }, 500);
    const { data: pub } = supa.storage.from("post-stills").getPublicUrl(path);
    return json({ result_url: pub.publicUrl });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
