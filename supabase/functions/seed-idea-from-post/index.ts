// "Run it back" — seed a Posts-board idea from a top-performing post.
// POST { title, topic?, pillar?, hook?, angleBrief } -> inserts one
// lm_idea_candidates row (content_type='post', status='reviewing') so it
// surfaces on the Posts board's Idea stage via the existing curator feed.
// User-initiated: not curator-scored, so sub-scores stay NULL (honest); a
// high-but-bounded composite ensures it's visible near the top since it's a
// re-run of a proven performer.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) return json({ error: "title is required" }, 400);
  const topic = typeof payload.topic === "string" ? payload.topic : "";
  const pillar = typeof payload.pillar === "string" ? payload.pillar : "";
  const hook = typeof payload.hook === "string" ? payload.hook : "";
  const angleBrief = typeof payload.angleBrief === "string" && payload.angleBrief
    ? payload.angleBrief
    : `Run it back on a top performer: "${title}".`;

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date().toISOString();
  const { data, error } = await supa
    .from("lm_idea_candidates")
    .insert({
      // 'manual' is the allowed source enum for user-seeded ideas; the
      // run-it-back origin is preserved in evidence[0].type + why_score.
      source: "manual",
      content_type: "post",
      status: "reviewing",
      raw_topic: title,
      post_angle: angleBrief,
      // evidence mirrors the curator's array shape so the board renders it.
      evidence: [{ type: "run_it_back", source_title: title, topic, pillar, hook }],
      // User pick of a proven performer — high-but-bounded so it's visible;
      // curator sub-scores intentionally left NULL (this wasn't model-scored).
      composite_score: 70,
      scored_at: now,
      ingested_at: now,
      why_score: 'Re-run of a proven top-performing post (you clicked "Run it back").',
    })
    .select("id")
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, id: data.id });
});
