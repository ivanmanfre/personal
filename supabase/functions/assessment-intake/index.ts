// Intake questionnaire handler for the Agent-Ready Blueprint.
// - GET  ?session_id=X  -> returns existing draft (or 404 if no paid row)
// - POST { session_id, answers, submit? } -> upserts draft; if submit=true
//   flips status to 'submitted' and records submitted_at.
// Session ID acts as the capability token — only buyers with a paid row can
// write to their intake. Validated against paid_assessments on every call.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);

  if (req.method === "GET") {
    const sessionId = url.searchParams.get("session_id");
    if (!sessionId) return json({ error: "missing session_id" }, 400);

    const { data: paid } = await sb
      .from("paid_assessments")
      .select("stripe_session_id, email, name")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (!paid) return json({ error: "session not found" }, 404);

    const { data: intake } = await sb
      .from("assessment_intakes")
      .select("answers, status, submitted_at, started_at")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    return json({
      buyer: { email: paid.email, name: paid.name },
      answers: intake?.answers ?? {},
      status: intake?.status ?? "not_started",
      submitted_at: intake?.submitted_at ?? null,
    });
  }

  if (req.method === "POST") {
    let body: { session_id?: string; answers?: Record<string, unknown>; submit?: boolean };
    try {
      body = await req.json();
    } catch {
      return json({ error: "invalid json" }, 400);
    }

    const sessionId = body.session_id;
    if (!sessionId) return json({ error: "missing session_id" }, 400);
    if (!body.answers || typeof body.answers !== "object") {
      return json({ error: "missing answers" }, 400);
    }

    const { data: paid } = await sb
      .from("paid_assessments")
      .select("stripe_session_id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (!paid) return json({ error: "session not found" }, 404);

    const row: Record<string, unknown> = {
      stripe_session_id: sessionId,
      answers: body.answers,
      status: body.submit ? "submitted" : "in_progress",
    };
    if (body.submit) row.submitted_at = new Date().toISOString();

    const { error } = await sb
      .from("assessment_intakes")
      .upsert(row, { onConflict: "stripe_session_id" });

    if (error) return json({ error: error.message }, 500);

    return json({ ok: true, status: row.status });
  }

  return json({ error: "method not allowed" }, 405);
});
