// Source of truth for the recording-auto-title edge function, deployed to
// bjbvqvzbzczjbatgmccb. Pipeline: AssemblyAI transcription → Claude Haiku
// title generation → update recordings row. Called fire-and-forget from the
// dashboard after upload, and by the "Auto-title all" backfill button.
// Secrets read from supabase vault via get_vault_secret RPC (service-role).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, apikey, authorization",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const ASSEMBLYAI_URL = "https://api.assemblyai.com/v2/transcript";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

class NoAudioError extends Error {}

async function setStatus(sb: any, id: string, status: string, extra: Record<string, unknown> = {}) {
  await sb.from("recordings").update({ auto_title_status: status, ...extra }).eq("id", id);
}

async function getSecret(sb: any, name: string): Promise<string> {
  const { data, error } = await sb.rpc("get_vault_secret", { p_name: name });
  if (error) throw new Error(`vault read ${name}: ${error.message}`);
  if (!data) throw new Error(`vault secret ${name} not set`);
  return data as string;
}

async function transcribe(audioUrl: string, apiKey: string): Promise<string> {
  // speech_models is required in the current AssemblyAI API. universal-2 is
  // cheaper per-minute than universal-3-pro and plenty accurate for short
  // English screen recordings.
  const submitResp = await fetch(ASSEMBLYAI_URL, {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify({ audio_url: audioUrl, speech_models: ["universal-2"] }),
  });
  if (!submitResp.ok) throw new Error(`assemblyai submit: ${submitResp.status} ${await submitResp.text()}`);
  const submitted = await submitResp.json();
  const transcriptId = submitted.id;
  if (!transcriptId) throw new Error(`assemblyai: no transcript id`);

  const start = Date.now();
  while (Date.now() - start < 180_000) {
    await new Promise((r) => setTimeout(r, 3000));
    const r = await fetch(`${ASSEMBLYAI_URL}/${transcriptId}`, { headers: { authorization: apiKey } });
    if (!r.ok) throw new Error(`assemblyai poll: ${r.status}`);
    const data = await r.json();
    if (data.status === "completed") return String(data.text || "").trim();
    if (data.status === "error") {
      const msg = String(data.error || "unknown");
      if (/no spoken audio|does not appear to contain audio|language_detection/i.test(msg)) {
        throw new NoAudioError(msg);
      }
      throw new Error(`assemblyai error: ${msg}`);
    }
  }
  throw new Error("assemblyai timeout after 3m");
}

async function generateTitle(transcript: string, anthropicKey: string): Promise<string> {
  const snippet = transcript.slice(0, 4000);
  const prompt = [
    "Read this recording transcript and write a single short video title (4-8 words, no period, no emoji, title case).",
    "Return ONLY the title, nothing else - no quotes, no prefix, no explanation.",
    "",
    "Transcript:",
    snippet,
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
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`anthropic: ${r.status} ${detail.slice(0, 200)}`);
  }
  const data = await r.json();
  const raw = (data.content?.[0]?.text || "").trim();
  return raw.replace(/^[\"']+|[\"'.]+$/g, "").slice(0, 60) || "Untitled recording";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: CORS });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing_supabase_env" }), { status: 500, headers: CORS });
  }

  let payload: { recording_id?: string };
  try { payload = await req.json(); } catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: CORS }); }
  const id = payload.recording_id;
  if (!id) return new Response(JSON.stringify({ error: "missing_recording_id" }), { status: 400, headers: CORS });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let ASSEMBLYAI_KEY: string;
  let ANTHROPIC_KEY: string;
  try {
    ASSEMBLYAI_KEY = await getSecret(sb, "ASSEMBLYAI_API_KEY");
    ANTHROPIC_KEY = await getSecret(sb, "ANTHROPIC_API_KEY");
  } catch (err) {
    return new Response(JSON.stringify({ error: "vault_read_failed", detail: err instanceof Error ? err.message : String(err) }), { status: 500, headers: CORS });
  }

  const { data: rec, error: recErr } = await sb.from("recordings").select("id, original_path, title").eq("id", id).maybeSingle();
  if (recErr || !rec) return new Response(JSON.stringify({ error: "recording_not_found", detail: recErr?.message }), { status: 404, headers: CORS });
  if (!rec.original_path) return new Response(JSON.stringify({ error: "no_original_path" }), { status: 400, headers: CORS });

  try {
    await setStatus(sb, id, "transcribing");

    const { data: signed, error: sErr } = await sb.storage.from("recordings").createSignedUrl(rec.original_path, 3600);
    if (sErr || !signed?.signedUrl) throw new Error(`signed url failed: ${sErr?.message || "no url"}`);

    let transcript: string;
    try {
      transcript = await transcribe(signed.signedUrl, ASSEMBLYAI_KEY);
    } catch (err) {
      if (err instanceof NoAudioError) {
        // Screen recordings without narration are a legitimate case - mark them
        // as no_audio so the backfill button stops offering to retry them.
        await sb.from("recordings").update({
          auto_title: "(no audio)",
          auto_title_status: "no_audio",
          transcript_text: null,
        }).eq("id", id);
        return new Response(JSON.stringify({ ok: true, auto_title: "(no audio)", no_audio: true }), { status: 200, headers: CORS });
      }
      throw err;
    }

    await setStatus(sb, id, "titling", { transcript_text: transcript });

    const autoTitle = transcript.length > 20 ? await generateTitle(transcript, ANTHROPIC_KEY) : "(empty recording)";

    await sb.from("recordings").update({
      auto_title: autoTitle,
      auto_title_status: "done",
    }).eq("id", id);

    return new Response(JSON.stringify({ ok: true, auto_title: autoTitle, transcript_chars: transcript.length }), { status: 200, headers: CORS });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await setStatus(sb, id, "failed", { transcript_text: `ERROR: ${msg}` });
    return new Response(JSON.stringify({ error: "pipeline_failed", detail: msg }), { status: 500, headers: CORS });
  }
});
