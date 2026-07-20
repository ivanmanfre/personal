// idea-angle-summary — tight angle headlines for the Posts board Idea list.
//
// The Idea list shows one scored candidate per row; its Angle cell rendered the
// raw scored topic, which is often a full clause and clips. This fn summarizes
// each candidate's angle into a 5-9 word headline with Claude Haiku and CACHES
// it on lm_idea_candidates.angle_summary, so Haiku runs once per idea.
//
// Called from the dashboard (lib/ideaProjection.ts) on every idea load. It
// returns the full { id: angle_summary } map for the current reviewing/post
// candidates (cached ones instantly; a bounded batch of new ones summarized in
// this request). Any not summarized this call fill on a later load — the idea
// simply shows its raw topic until then.
//
// Pattern (secrets, model, service-role client) mirrors recording-auto-title.
// Anthropic is called DIRECTLY (not via the Railway proxy) per the house rule
// that the direct API stays for agent-adjacent calls.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

// Cap new summaries per request so a big first backfill can't stall the board;
// the remainder fill on subsequent loads. Small concurrency to stay well under
// Anthropic rate limits while keeping the batch fast.
const MAX_NEW_PER_CALL = 12;
const CONCURRENCY = 6;

async function getSecret(sb: any, name: string): Promise<string> {
  const { data, error } = await sb.rpc("get_vault_secret", { p_name: name });
  if (error) throw new Error(`vault read ${name}: ${error.message}`);
  if (!data) throw new Error(`vault secret ${name} not set`);
  return data as string;
}

// The scored angle text we summarize — richest available, same precedence the
// board's description assembler uses (post_angle > normalized_topic > raw_topic).
function angleSource(row: any): string {
  return String(row.post_angle || row.normalized_topic || row.raw_topic || "").trim();
}

async function summarizeAngle(row: any, anthropicKey: string): Promise<string> {
  const angle = angleSource(row).slice(0, 600);
  const why = String(row.why_score || "").slice(0, 400);
  const prompt = [
    "You label content ideas for an internal dashboard list. Given a content idea's angle (and why it scored), write ONE tight headline that captures the angle at a glance for a busy operator scanning the list.",
    "Rules: 5 to 9 words. Concrete and specific. Plain language. No period, no quotes, no emoji, no colon subtitle. No em dashes. No \"X, not Y\" contrasts. Never use: unlock, leverage, harness, seamless, elevate, supercharge, delve, robust, holistic, game-changer, transformative.",
    "Return ONLY the headline text.",
    "",
    `Angle: ${angle}`,
    why ? `Why it scores: ${why}` : "",
  ].join("\n");

  const r = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 40,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`anthropic ${r.status} ${(await r.text()).slice(0, 200)}`);
  const data = await r.json();
  const raw = String(data.content?.[0]?.text || "").trim();
  // Strip wrapping quotes / trailing punctuation, keep it to a single line.
  return raw.replace(/^["'\s]+|["'.\s]+$/g, "").split("\n")[0].slice(0, 120);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing_supabase_env" }), { status: 500, headers: CORS });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Only the candidates the board actually renders as ideas.
  const { data: rows, error } = await sb
    .from("lm_idea_candidates")
    .select("id, raw_topic, normalized_topic, post_angle, why_score, angle_summary")
    .eq("status", "reviewing")
    .eq("content_type", "post");
  if (error) {
    return new Response(JSON.stringify({ error: "select_failed", detail: error.message }), { status: 500, headers: CORS });
  }

  const summaries: Record<string, string> = {};
  const todo: any[] = [];
  for (const row of rows || []) {
    if (row.angle_summary) summaries[row.id] = row.angle_summary;
    else if (angleSource(row)) todo.push(row);
  }

  let ANTHROPIC_KEY: string | null = null;
  if (todo.length) {
    try {
      ANTHROPIC_KEY = await getSecret(sb, "ANTHROPIC_API_KEY");
    } catch (err) {
      // Vault miss shouldn't blank the list — return the cached summaries we have.
      return new Response(JSON.stringify({ summaries, cached: Object.keys(summaries).length, generated: 0, warning: "vault_read_failed" }), { status: 200, headers: CORS });
    }
  }

  const batch = todo.slice(0, MAX_NEW_PER_CALL);
  let generated = 0;
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const slice = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      slice.map(async (row) => {
        const summary = await summarizeAngle(row, ANTHROPIC_KEY as string);
        if (!summary) return null;
        const { error: upErr } = await sb.from("lm_idea_candidates").update({ angle_summary: summary }).eq("id", row.id);
        if (upErr) throw new Error(upErr.message);
        return { id: row.id as string, summary };
      }),
    );
    for (const res of results) {
      if (res.status === "fulfilled" && res.value) {
        summaries[res.value.id] = res.value.summary;
        generated++;
      }
    }
  }

  return new Response(
    JSON.stringify({ summaries, cached: Object.keys(summaries).length - generated, generated, remaining: Math.max(0, todo.length - batch.length) }),
    { status: 200, headers: CORS },
  );
});
