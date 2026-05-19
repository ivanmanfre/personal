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
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const BRIDGE_MODEL = "claude-haiku-4-5-20251001";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Generate a short, natural-sounding bridge sentence for text→voice resume.
// The agent is about to speak the FIRST thing the buyer hears after switching
// to voice. We want it to acknowledge what they were just on — paraphrased,
// not quoted — so it sounds like a human assistant catching up, not a bot
// echoing the last words back uncannily.
async function generateBridge(recentMessages: Array<{ role: string; content: string }>): Promise<string> {
  const transcript = recentMessages
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Buyer" : "Intake"}: ${m.content.slice(0, 280)}`)
    .join("\n");
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: BRIDGE_MODEL,
        max_tokens: 80,
        system: `You write ONE short spoken sentence for an intake assistant on a real voice call.

The buyer just switched from typing to voice. The assistant needs to acknowledge what they were on, paraphrased (NEVER quote their words verbatim — that sounds uncanny), and hand the floor back.

Rules:
- ≤16 words. Spoken English. No markdown.
- Reference the topic the buyer was on at a high level — "you were on the team-size thing", "we were talking about your ICP", "you'd just started on the offer". Plain noun phrases.
- End with a natural cue to continue: "go on", "take it from there", "keep going", "where were you".
- NEVER quote the buyer's words. NEVER start with "Great", "Perfect", "Awesome", "Got it", "Thanks".
- Allow ONE light acknowledgment at the start ("ok", "right", "yeah") — optional.
- Output ONLY the sentence. No preamble, no quotes.`,
        messages: [{
          role: "user",
          content: `Recent conversation (most recent last):\n\n${transcript}\n\nWrite the single bridge sentence.`,
        }],
      }),
    });
    if (!res.ok) {
      console.warn("[bridge-haiku-failed]", res.status);
      return "Ok, picking up from where we left off — go on whenever you're ready.";
    }
    const data = await res.json();
    const text = (data?.content?.[0]?.text ?? "").trim().replace(/^["'`]|["'`]$/g, "");
    if (!text || text.length > 200) {
      return "Ok, picking up from where we left off — go on whenever you're ready.";
    }
    return text;
  } catch (e) {
    console.warn("[bridge-error]", e instanceof Error ? e.message : String(e));
    return "Ok, picking up from where we left off — go on whenever you're ready.";
  }
}

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
  let fractionalSessionId: string | null = null;

  if (fractionalSession) {
    const fs = fractionalSession as { id: string; status: string; expires_at: string | null };
    if (fs.status !== "active") return jsonResponse({ error: "session_inactive" }, 403);
    if (fs.expires_at && new Date(fs.expires_at) < new Date()) return jsonResponse({ error: "session_expired" }, 403);
    mode = "fractional_m1";
    fractionalSessionId = fs.id;
  } else {
    const { data: paid } = await supabase
      .from("paid_assessments")
      .select("stripe_session_id, status")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (!paid || (paid as any).status !== "paid") return jsonResponse({ error: "session_not_paid" }, 403);
  }

  // Load chat history so we can build a paraphrased bridge sentence for the
  // agent's first voice reply (when the buyer is resuming an already-active
  // session, not starting fresh).
  const intakeQuery = fractionalSessionId
    ? supabase.from("assessment_intakes").select("chat_history").eq("fractional_session_id", fractionalSessionId)
    : supabase.from("assessment_intakes").select("chat_history").eq("stripe_session_id", sessionId);
  const { data: intakeRow } = await intakeQuery.maybeSingle();
  const chatHistory = (intakeRow?.chat_history ?? []) as Array<{ role: string; content: string }>;
  const hasUserTurns = chatHistory.some((m) => m.role === "user");

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

  // Generate paraphrased bridge sentence ONLY when the buyer has actually
  // typed something — fresh sessions use the agent's static first_message.
  const bridgeSentence = hasUserTurns ? await generateBridge(chatHistory) : null;

  return jsonResponse({
    ok: true,
    signed_url: signedUrl,
    agent_id: ELEVENAGENTS_INTAKE_AGENT_ID,
    intake_token: sessionId,
    mode,
    bridge_sentence: bridgeSentence,
  });
});
