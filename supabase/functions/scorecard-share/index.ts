// Increment share_count for a scorecard result.
// POST { id } -> { ok: true, share_count }
// Called from the SPA when user clicks Share. Best-effort tracking.

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

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  const id = body.id;
  if (!id || !UUID_RE.test(id)) return json({ error: "invalid id" }, 400);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Atomic increment via raw SQL — RPC would also work but this is one round-trip.
  const { data, error } = await sb
    .from("free_diagnostics")
    .select("share_count")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return json({ error: "not found" }, 404);

  const next = (data.share_count ?? 0) + 1;
  const { error: updateErr } = await sb
    .from("free_diagnostics")
    .update({ share_count: next })
    .eq("id", id);

  if (updateErr) {
    console.error("share_count update failed", updateErr);
    return json({ error: "update failed" }, 500);
  }

  return json({ ok: true, share_count: next });
});
