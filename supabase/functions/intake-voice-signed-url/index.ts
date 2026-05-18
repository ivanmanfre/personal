// Path B voice agent — mints a short-lived ElevenAgents signed WebSocket URL
// for a validated intake session. Frontend calls this before startSession().
//
// Flow:
// 1. Client POSTs { session_id } (the same token used by text mode)
// 2. We validate the session against fractional_sessions / paid_assessments
// 3. We call ElevenLabs GET /v1/convai/conversation/get-signed-url?agent_id=...
//    to mint a one-shot signed URL (valid for 15 min)
// 4. Return { signed_url, agent_id, intake_token } to the client
// 5. Client passes intake_token as customLlmExtraBody on startSession so the
//    custom-LLM webhook can load state on each turn.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";
import { isOriginAllowed } from "../_shared/security.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const ELEVENAGENTS_INTAKE_AGENT_ID = Deno.env.get("ELEVENAGENTS_INTAKE_AGENT_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const origin = req.headers.get("origin");
  if (!isOriginAllowed(origin)) return jsonResponse({ error: "origin_not_allowed" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }

  const sessionId: string = String(body.session_id ?? "").trim();
  if (!sessionId) return jsonResponse({ error: "missing_session_id" }, 400);

  // Validate session — accept either fractional_sessions.session_token or
  // paid_assessments.stripe_session_id (mirrors assessment-intake-chat auth)
  const { data: fractionalSession } = await supabase
    .from("fractional_sessions")
    .select("id, status, expires_at")
    .eq("session_token", sessionId)
    .maybeSingle();

  let mode: "paid_assessment" | "fractional_m1" = "paid_assessment";

  if (fractionalSession) {
    const fs = fractionalSession as { id: string; status: string; expires_at: string | null };
    if (fs.status !== "active") return jsonResponse({ error: "session_inactive" }, 403);
    if (fs.expires_at && new Date(fs.expires_at) < new Date()) return jsonResponse({ error: "session_expired" }, 403);
    mode = "fractional_m1";
  } else {
    const { data: paid } = await supabase
      .from("paid_assessments")
      .select("stripe_session_id, status")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (!paid || (paid as any).status !== "paid") return jsonResponse({ error: "session_not_paid" }, 403);
  }

  // Mint signed URL from ElevenAgents
  const elevenUrl = `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(ELEVENAGENTS_INTAKE_AGENT_ID)}`;
  let signedUrl: string | null = null;
  try {
    const res = await fetch(elevenUrl, {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("[elevenagents-signed-url-failed]", res.status, errText.slice(0, 200));
      return jsonResponse({ error: "voice_unavailable", detail: res.status }, 502);
    }
    const data = await res.json();
    signedUrl = data?.signed_url ?? data?.signedUrl ?? null;
  } catch (e) {
    console.error("[elevenagents-fetch-error]", e instanceof Error ? e.message : String(e));
    return jsonResponse({ error: "voice_unavailable" }, 502);
  }
  if (!signedUrl) return jsonResponse({ error: "voice_unavailable" }, 502);

  return jsonResponse({
    ok: true,
    signed_url: signedUrl,
    agent_id: ELEVENAGENTS_INTAKE_AGENT_ID,
    intake_token: sessionId,
    mode,
  });
});
