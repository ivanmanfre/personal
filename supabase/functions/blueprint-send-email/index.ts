// Send a (possibly Ivan-edited) buyer email for a published Blueprint via Resend.
// Two-step on purpose: blueprint-publish returns a DRAFT, Ivan reviews/edits, this sends.
// Auth: same Origin allowlist as blueprint-publish.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const ALLOWED_ORIGINS = new Set([
  "https://ivanmanfredi.com",
  "https://www.ivanmanfredi.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const CORS = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://ivanmanfredi.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Max-Age": "86400",
});

function jsonResponse(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS(origin) },
  });
}

async function getVaultSecret(name: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_vault_secret", { p_name: name });
  if (error || !data) return null;
  return data as string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS(origin) });
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return jsonResponse({ error: "origin_not_allowed" }, 403, origin);
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, origin);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400, origin); }

  const blueprintId = String(body.blueprint_id || "").trim();
  const to = String(body.to || "").trim();
  const subject = String(body.subject || "").trim();
  const text = String(body.text || "").trim();
  const html = String(body.html || "").trim();
  if (!blueprintId || !to || !subject || (!text && !html)) {
    return jsonResponse({ error: "missing_fields" }, 400, origin);
  }

  // Validate the blueprint is actually published before allowing send.
  const { data: bp } = await supabase
    .from("blueprints")
    .select("id, status, share_token, kind")
    .eq("id", blueprintId)
    .maybeSingle();
  if (!bp) return jsonResponse({ error: "blueprint_not_found" }, 404, origin);
  if (bp.status !== "published" || !bp.share_token) {
    return jsonResponse({ error: "not_published_yet" }, 400, origin);
  }

  const apiKey = await getVaultSecret("RESEND_API_KEY_ASSESSMENT");
  const from = (await getVaultSecret("RESEND_FROM")) ?? "Iván Manfredi <hello@ivanmanfredi.com>";
  if (!apiKey) return jsonResponse({ error: "resend_key_missing" }, 500, origin);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html,
        tags: [{ name: "type", value: "blueprint_buyer_send" }],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return jsonResponse({ error: "resend_failed", status: res.status, detail: t.slice(0, 300) }, 502, origin);
    }
  } catch (e) {
    return jsonResponse({ error: "resend_exception", detail: e instanceof Error ? e.message : String(e) }, 502, origin);
  }

  await supabase
    .from("blueprints")
    .update({ email_sent_at: new Date().toISOString(), email_sent_to: to })
    .eq("id", blueprintId);

  return jsonResponse({ ok: true, sent_to: to }, 200, origin);
});
