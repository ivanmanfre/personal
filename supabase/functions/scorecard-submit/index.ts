// Free Agent-Ready Scorecard submission handler.
// POST { scores, verdict, email?, referrer?, utm? } -> inserts into free_diagnostics.
// If SCORECARD_FOLLOWUP_WEBHOOK_URL env var is set AND email is present,
// fires that webhook with the row payload (used by n8n to send the 30-day roadmap).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

const VALID_VERDICTS = new Set(["agent_ready", "close", "foundation"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function validScores(scores: unknown): scores is Record<string, number> {
  if (!scores || typeof scores !== "object") return false;
  const s = scores as Record<string, unknown>;
  for (const key of PRECONDITION_KEYS) {
    const v = s[key];
    if (typeof v !== "number" || v < 1 || v > 5 || !Number.isInteger(v)) return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: {
    scores?: unknown;
    verdict?: string;
    email?: string;
    referrer?: string;
    utm?: Record<string, string>;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (!validScores(body.scores)) {
    return json({ error: "invalid scores" }, 400);
  }
  if (!body.verdict || !VALID_VERDICTS.has(body.verdict)) {
    return json({ error: "invalid verdict" }, 400);
  }
  if (body.email && (typeof body.email !== "string" || !body.email.includes("@") || body.email.length > 320)) {
    return json({ error: "invalid email" }, 400);
  }

  const scores = body.scores as Record<string, number>;
  const total = PRECONDITION_KEYS.reduce((sum, k) => sum + scores[k], 0);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const row = {
    email: body.email ?? null,
    scores,
    total,
    verdict: body.verdict,
    referrer: body.referrer ?? null,
    utm: body.utm ?? null,
  };

  const { data, error } = await sb
    .from("free_diagnostics")
    .insert(row)
    .select("id")
    .single();

  if (error) {
    console.error("free_diagnostics insert failed", error);
    return json({ error: error.message }, 500);
  }

  // Fire follow-up webhook if configured and email is present.
  // Webhook is responsible for sending the personalized 30-day roadmap.
  const webhookUrl = Deno.env.get("SCORECARD_FOLLOWUP_WEBHOOK_URL");
  if (webhookUrl && body.email) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: data.id, ...row }),
      });
    } catch (err) {
      // Non-fatal — row is already saved; log and continue.
      console.error("scorecard followup webhook failed", err);
    }
  }

  return json({ ok: true, id: data.id, verdict: body.verdict });
});
