// Public sanitized read of a scorecard result by id.
// GET ?id=:uuid -> { id, scores, total, verdict, weakest_keys, share_count }
// No email, no UTM, no referrer leaked. Used by:
//   1. SPA result viewer at /scorecard/result/:id
//   2. Cloudflare Worker at share.ivanmanfredi.com for OG meta + image rendering

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const PRECONDITION_KEYS = [
  "structured_input",
  "decision_logic",
  "narrow_scope",
  "human_loop",
] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") return json({ error: "method not allowed" }, 405);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id || !UUID_RE.test(id)) {
    return json({ error: "invalid id" }, 400);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await sb
    .from("free_diagnostics")
    .select("id, scores, total, verdict, share_count")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("scorecard-get failed", error);
    return json({ error: "fetch failed" }, 500);
  }
  if (!data) return json({ error: "not found" }, 404);

  // Compute weakest precondition(s) so result viewer + OG card can highlight them
  const scores = data.scores as Record<string, number>;
  const lowest = Math.min(...PRECONDITION_KEYS.map((k) => scores[k] ?? 5));
  const weakest_keys = PRECONDITION_KEYS.filter((k) => scores[k] === lowest);

  return json({
    id: data.id,
    scores,
    total: data.total,
    verdict: data.verdict,
    weakest_keys,
    share_count: data.share_count ?? 0,
  });
});
