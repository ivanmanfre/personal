// Publish a Blueprint draft (post_call only).
// 1. Generates a short share_token (or reuses existing)
// 2. Flips status='published', sets published_at
// 3. Best-effort writes embedding via OpenAI (skipped if OPENAI_API_KEY not in vault)
// 4. Returns the public URL + a pre-drafted buyer email (Ivan reviews + sends manually)
//
// Auth model: Origin allowlist (dashboard-only). No JWT/session required because the
// dashboard is password-gated at app level (matches the existing pattern).

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

function escapeHtml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS(origin) });
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return jsonResponse({ error: "origin_not_allowed" }, 403, origin);
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, origin);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400, origin); }
  const blueprintId = String(body.blueprint_id || "").trim();
  if (!blueprintId) return jsonResponse({ error: "missing blueprint_id" }, 400, origin);

  // Bootstrap: pulls blueprint + buyer + secrets in one call
  const { data: bootstrap, error: bootErr } = await supabase.rpc("bootstrap_blueprint_publish", { p_blueprint_id: blueprintId });
  if (bootErr || !bootstrap) return jsonResponse({ error: "bootstrap_failed", detail: bootErr?.message }, 500, origin);

  const bp = (bootstrap as any).blueprint;
  const paid = (bootstrap as any).paid;
  const secrets = (bootstrap as any).secrets;

  if (bp.kind === "test" && body.allow_test !== true) {
    return jsonResponse({ error: "cannot_publish_test", hint: "Pass {allow_test: true} to publish a test session anyway." }, 400, origin);
  }

  // Reuse existing token or generate new one
  let shareToken = bp.share_token as string | null;
  if (!shareToken) {
    const { data: tokenData } = await supabase.rpc("gen_blueprint_share_token");
    shareToken = String(tokenData || "");
    if (!shareToken) return jsonResponse({ error: "token_gen_failed" }, 500, origin);
  }

  // Best-effort embedding (skipped if no OpenAI key)
  let embeddingWritten = false;
  if (secrets.openai_key && bp.kind === "real") {
    try {
      const embedRes = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${secrets.openai_key}` },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: bp.embedding_text || JSON.stringify(bp.json_sections).slice(0, 8000),
          dimensions: 1536,
        }),
      });
      if (embedRes.ok) {
        const j = await embedRes.json();
        const embedding = j?.data?.[0]?.embedding;
        if (Array.isArray(embedding) && embedding.length === 1536) {
          await supabase.from("blueprints").update({ embedding }).eq("id", blueprintId);
          embeddingWritten = true;
        }
      } else {
        console.error("[embed-http]", embedRes.status, await embedRes.text());
      }
    } catch (e) {
      console.error("[embed-failed]", e instanceof Error ? e.message : String(e));
    }
  }

  // Flip status + token + published_at
  const { error: updErr } = await supabase
    .from("blueprints")
    .update({
      status: "published",
      share_token: shareToken,
      published_at: new Date().toISOString(),
    })
    .eq("id", blueprintId);
  if (updErr) return jsonResponse({ error: "publish_update_failed", detail: updErr.message }, 500, origin);

  const publicUrl = `https://ivanmanfredi.com/blueprint/${shareToken}`;
  const sections = (bp.json_sections || {}) as any;
  const company = String(sections?.reflective_summary?.match?.(/at \*\*([^*]+)\*\*/)?.[1] || "")
    || String(paid?.name || "").split(" ")[0]
    || "your firm";
  const buyerName = String(paid?.name || "").split(" ")[0] || null;

  // Pre-drafted buyer email (Ivan edits before sending)
  const greeting = buyerName ? `Hi ${buyerName},` : "Hi,";
  const fitName = sections?.engagement_fit?.recommendation || "next step";

  const draftSubject = `Your Agent-Ready Blueprint`;
  const draftText = `${greeting}

Your Agent-Ready Blueprint is ready. We folded everything from the intake plus what surfaced in our Day 2 working session into one document.

The short read: ${sections?.reflective_tldr || ""}

Recommended next step: ${fitName}.

Open the Blueprint here:
${publicUrl}

Edit the link or print to PDF as you need it. Happy to walk through any section live, just reply.

Iván`;

  const draftHtml = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:32px auto;padding:0 20px;color:#1A1A1A;line-height:1.6;background:#F4EFE8">
<p style="font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#2A8F65;margin:0 0 14px">Agent-Ready · Blueprint</p>
<p>${escapeHtml(greeting)}</p>
<p>Your <strong>Agent-Ready Blueprint</strong> is ready. We folded everything from the intake plus what surfaced in our Day 2 working session into one document.</p>
${sections?.reflective_tldr ? `<blockquote style="border-left:2px solid #2A8F65;margin:18px 0;padding:6px 14px;color:#1A1A1A;font-style:italic">${escapeHtml(sections.reflective_tldr)}</blockquote>` : ""}
<p>Recommended next step: <strong>${escapeHtml(fitName)}</strong>.</p>
<p style="margin:28px 0">
  <a href="${publicUrl}" style="display:inline-block;background:#1A1A1A;color:#F4EFE8;padding:12px 22px;text-decoration:none;font-weight:700">Open the Blueprint →</a>
</p>
<p style="color:#6B6861;font-size:14px">Or paste the link into your browser:<br><a href="${publicUrl}" style="color:#2A8F65;word-break:break-all">${publicUrl}</a></p>
<p>Happy to walk through any section live, just reply.</p>
<p>Iván</p>
<p style="margin-top:32px;padding-top:14px;border-top:1px solid rgba(0,0,0,0.08);font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:0.16em;text-transform:uppercase;color:#6B6861">Agent-Ready Ops™ · ivanmanfredi.com</p>
</body></html>`;

  return jsonResponse({
    ok: true,
    blueprint_id: blueprintId,
    share_token: shareToken,
    public_url: publicUrl,
    embedding_written: embeddingWritten,
    email_draft: {
      to: paid?.email,
      subject: draftSubject,
      text: draftText,
      html: draftHtml,
    },
  }, 200, origin);
});
