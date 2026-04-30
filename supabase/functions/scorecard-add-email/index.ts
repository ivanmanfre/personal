// Add email to an existing scorecard row (post-submit email gate).
// POST { id, email } -> { ok: true }
// Also re-fires the SCORECARD_FOLLOWUP_WEBHOOK_URL so the drip workflow runs.

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { id?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (!body.id || !UUID_RE.test(body.id)) return json({ error: "invalid id" }, 400);
  if (!body.email || !body.email.includes("@") || body.email.length > 320) {
    return json({ error: "invalid email" }, 400);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: row, error: fetchErr } = await sb
    .from("free_diagnostics")
    .select("id, scores, total, verdict, email, referrer, utm")
    .eq("id", body.id)
    .maybeSingle();

  if (fetchErr || !row) return json({ error: "not found" }, 404);

  // If already has an email, no-op (don't allow overwriting)
  if (row.email) return json({ ok: true, already_set: true });

  const { error: updateErr } = await sb
    .from("free_diagnostics")
    .update({ email: body.email })
    .eq("id", body.id);

  if (updateErr) {
    console.error("email update failed", updateErr);
    return json({ error: "update failed" }, 500);
  }

  // Fire the drip webhook now that we have an email
  const webhookUrl = Deno.env.get("SCORECARD_FOLLOWUP_WEBHOOK_URL");
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          email: body.email,
          scores: row.scores,
          total: row.total,
          verdict: row.verdict,
          referrer: row.referrer,
          utm: row.utm,
        }),
      });
    } catch (err) {
      console.error("scorecard followup webhook failed", err);
    }
  }

  return json({ ok: true });
});
