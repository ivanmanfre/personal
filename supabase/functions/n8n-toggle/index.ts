// Dashboard pause/resume control for n8n workflows.
// POST { workflowId, action: 'pause' | 'resume' } -> { ok, active }
// Auth: x-dashboard-auth header must match dashboard_hash row in app_secrets.
// Secrets read from app_secrets table (service_role bypasses RLS); avoids needing Supabase function-env access.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-dashboard-auth",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

const N8N_HOST = "https://n8n.ivanmanfredi.com";
const ID_RE = /^[A-Za-z0-9]{10,30}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Load both secrets from app_secrets in one query.
  const { data: secretRows, error: secretsErr } = await sb
    .from("app_secrets")
    .select("key, value")
    .in("key", ["n8n_api_key", "dashboard_hash"]);
  if (secretsErr || !secretRows || secretRows.length < 2) {
    return json({ error: "server misconfigured: missing app_secrets rows", detail: secretsErr?.message }, 500);
  }
  const secrets: Record<string, string> = {};
  for (const r of secretRows) secrets[r.key] = r.value;

  if (req.headers.get("x-dashboard-auth") !== secrets.dashboard_hash) {
    return json({ error: "unauthorized" }, 401);
  }

  let body: { workflowId?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const { workflowId, action } = body;
  if (!workflowId || !ID_RE.test(workflowId)) return json({ error: "invalid workflowId" }, 400);
  if (action !== "pause" && action !== "resume") return json({ error: "action must be pause or resume" }, 400);

  const n8nPath = action === "pause"
    ? `/api/v1/workflows/${workflowId}/deactivate`
    : `/api/v1/workflows/${workflowId}/activate`;

  const n8nRes = await fetch(`${N8N_HOST}${n8nPath}`, {
    method: "POST",
    headers: { "X-N8N-API-KEY": secrets.n8n_api_key, "Content-Type": "application/json" },
  });
  if (!n8nRes.ok) {
    const txt = await n8nRes.text();
    return json({ error: `n8n api ${n8nRes.status}`, detail: txt.slice(0, 300) }, 502);
  }
  const n8nBody = await n8nRes.json();

  // Mirror state in dashboard_workflow_stats so the UI updates immediately
  // (the periodic sync workflow is independent — this avoids stale UI between syncs).
  const isPause = action === "pause";
  const { error: updateErr } = await sb
    .from("dashboard_workflow_stats")
    .update({
      is_active: !isPause,
      manually_paused: isPause,
      updated_at: new Date().toISOString(),
    })
    .eq("workflow_id", workflowId);
  if (updateErr) console.error("dashboard mirror update failed", updateErr);

  return json({ ok: true, active: n8nBody.active, manually_paused: isPause });
});
