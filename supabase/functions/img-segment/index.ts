// supabase/functions/img-segment/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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

// --- fal slug (verify at fal.ai/models when FAL_KEY exists) ---
const FAL_SEGMENT_MODEL = "fal-ai/sam2/image";

// SSRF guard: only forward images from known-good hosts (no internal URLs).
const ALLOWED_HOST_SUFFIXES = [".supabase.co", ".fal.media", ".fal.run", "drive.google.com", ".googleusercontent.com"];
function assertAllowedUrl(u: string): string | null {
  let parsed: URL;
  try { parsed = new URL(u); } catch { return "image_url is not a valid URL"; }
  if (parsed.protocol !== "https:") return "image_url must be https";
  const host = parsed.hostname.toLowerCase();
  const ok = ALLOWED_HOST_SUFFIXES.some((s) => host === s.replace(/^\./, "") || host.endsWith(s));
  return ok ? null : "image_url host not allowed";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const FAL_KEY = Deno.env.get("FAL_KEY");
  if (!FAL_KEY) return json({ error: "FAL_KEY not configured" }, 503);

  let body: { image_url?: string; x?: number; y?: number };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { image_url, x, y } = body;
  if (!image_url || typeof x !== "number" || typeof y !== "number") {
    return json({ error: "image_url, x, y required" }, 400);
  }
  const badImg = assertAllowedUrl(image_url);
  if (badImg) return json({ error: badImg }, 400);

  try {
    const falRes = await fetch(`https://fal.run/${FAL_SEGMENT_MODEL}`, {
      method: "POST",
      headers: { "Authorization": `Key ${FAL_KEY}`, "Content-Type": "application/json" },
      // point-prompt input — confirm schema at fal.ai/models
      body: JSON.stringify({ image_url, prompts: [{ x, y, label: 1 }] }),
    });
    if (!falRes.ok) {
      const t = await falRes.text();
      return json({ error: `fal ${falRes.status}`, detail: t.slice(0, 500) }, 502);
    }
    const out = await falRes.json();
    // --- response parse (verified live against fal-ai/sam2/image: mask is at out.image.url) ---
    const maskUrl: string | undefined =
      out?.image?.url ?? out?.image_url ?? out?.masks?.[0]?.url ?? out?.combined_mask?.url;
    if (!maskUrl) return json({ error: "fal returned no mask", raw: out }, 502);
    const bbox = out?.bbox ?? out?.masks?.[0]?.bbox ?? [x, y, 0, 0];
    return json({ mask_url: maskUrl, bbox, object_class: out?.object_class });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
