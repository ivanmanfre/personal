// board-magic-link — mint + email a client-board sign-in link + 6-digit code.
//
// POST { slug, email } → request_board_login (service role) → if allowed, send
// via Resend from "Ivan Manfredi <login@ivanmanfredi.com>". ALWAYS responds
// { ok: true } regardless of allow-list outcome (no email-enumeration oracle);
// only malformed input hard-400s.
//
// The link is delivered as a HASH fragment (#ml=<token>), never a query param:
// fragments are not sent to servers, do not appear in access logs, referrers, or
// prerender captures. The 6-digit code is the fallback for clients who can't or
// won't click. Both redeem the same 15-minute login row (redeem_board_login).
//
// Auth: same anon-key-free posture as blueprint-send-email — this runs with the
// service-role key and is reachable only from the board origin (CORS allowlist).

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Sender identity. inboundonsteroids.com verified in Resend 2026-07-19 (DKIM+MX+SPF),
// so sign-in email now comes from the product brand, matching the board URL.
const FROM = "InboundOnSteroids <login@inboundonsteroids.com>";
// Board links live on the product brand. The ivanmanfredi.com route keeps
// working (same SPA, same RPCs) — this only changes where emails point.
const BOARD_BASE = "https://inboundonsteroids.com/client";

// White-label board hosts (2026-10-15). A sign-in asked for FROM the client's own domain
// links back to that domain and is sent under the client's name, never the agency's. Each
// host serves exactly the slugs listed (anything else gets the uniform ok and no email).
// Keep in sync with lib/boardHost.ts and vite.board-host.config.ts. The /client/<slug>
// route on our own domains is unchanged.
const HOSTED: Record<string, { slugs: string[]; url: string; from: string; brand: string }> = {
  "https://madebyswishdm.com": {
    slugs: ["swishdm-live"],
    url: "https://madebyswishdm.com/board/",
    from: "SwishDM <login@madebyswishdm.com>",
    brand: "SwishDM",
  },
};

const ALLOWED_ORIGINS = new Set([
  "https://ivanmanfredi.com",
  "https://inboundonsteroids.com",
  "http://localhost:5173",
  ...Object.keys(HOSTED),
]);

const CORS = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://ivanmanfredi.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Max-Age": "86400",
});

function jsonResponse(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS(origin) },
  });
}

// Resend secret: reuse the Vault secret blueprint-send-email already uses
// (RESEND_API_KEY_ASSESSMENT) so NO new secret has to be set. Falls back to an
// env RESEND_API_KEY if one is ever configured. See deploy-notes.md.
async function getVaultSecret(name: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_vault_secret", { p_name: name });
  if (error || !data) return null;
  return data as string;
}
async function resendKey(): Promise<string | null> {
  return (await getVaultSecret("RESEND_API_KEY_ASSESSMENT")) ?? Deno.env.get("RESEND_API_KEY") ?? null;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Brand-clean, plain HTML. No em dashes anywhere (brand law). Inline styles only
// (email clients strip <style>). Ink on white, one hairline, one ink button.
function buildEmail(slug: string, linkToken: string, code: string, hosted: { url: string; brand: string } | null) {
  const url = hosted
    ? `${hosted.url}#ml=${encodeURIComponent(linkToken)}`
    : `${BOARD_BASE}/${encodeURIComponent(slug)}#ml=${encodeURIComponent(linkToken)}`;
  const brand = escapeHtml(hosted ? hosted.brand : "InboundOnSteroids");
  const safeUrl = escapeHtml(url);
  const safeCode = escapeHtml(code);
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ffffff;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:40px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
            <tr>
              <td style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6b675e;padding-bottom:22px;">
                Content board sign in
              </td>
            </tr>
            <tr>
              <td style="font-size:22px;font-weight:700;color:#131210;line-height:1.3;padding-bottom:10px;">
                Your board sign-in link
              </td>
            </tr>
            <tr>
              <td style="font-size:15px;color:#3a3833;line-height:1.6;padding-bottom:26px;">
                Tap the button to open your content board. This link is good for 15 minutes.
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:28px;">
                <a href="${safeUrl}" style="display:inline-block;background:#131210;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:14px 30px;">
                  Open my board
                </a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid rgba(19,18,16,0.14);padding-top:24px;font-size:13px;color:#6b675e;line-height:1.6;">
                Prefer a code? Enter this on the sign-in screen:
              </td>
            </tr>
            <tr>
              <td style="font-size:30px;font-weight:700;letter-spacing:8px;color:#131210;padding-top:10px;padding-bottom:26px;">
                ${safeCode}
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#8a8780;line-height:1.6;">
                If you did not ask to sign in, you can ignore this email. Nothing happens until the link or code is used.
              </td>
            </tr>
            <tr>
              <td style="padding-top:26px;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#a5a29a;">
                ${brand}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = [
    "Your board sign-in link",
    "",
    "Open your content board (good for 15 minutes):",
    url,
    "",
    `Prefer a code? Enter this on the sign-in screen: ${code}`,
    "",
    "If you did not ask to sign in, ignore this email. Nothing happens until the link or code is used.",
    "",
    hosted ? hosted.brand : "InboundOnSteroids",
  ].join("\n");
  return { html, text };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS(origin) });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return jsonResponse({ error: "origin_not_allowed" }, 403, origin);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400, origin); }

  const slug = String(body?.slug || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  // Hard 400 only on malformed input (never on allow-list outcome).
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) return jsonResponse({ error: "bad_slug" }, 400, origin);
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jsonResponse({ error: "bad_email" }, 400, origin);

  // A white-label host only signs people in to its own board(s). Uniform ok otherwise.
  const hosted = HOSTED[origin] ?? null;
  if (hosted && !hosted.slugs.includes(slug)) return jsonResponse({ ok: true }, 200, origin);

  // Mint (service role). request_board_login enforces the manifest allow-list +
  // magic_link flag + hourly rate limit. On any not-allowed / rate-limited /
  // error outcome we STILL return ok:true below (no enumeration oracle).
  try {
    const { data, error } = await supabase.rpc("request_board_login", { p_slug: slug, p_email: email });
    const res = (data as any) || null;
    if (!error && res?.ok && res.link_token && res.code) {
      const apiKey = await resendKey();
      if (apiKey) {
        const { html, text } = buildEmail(slug, String(res.link_token), String(res.code), hosted);
        // Best-effort send. A Resend failure does not change the ok:true response
        // (still no oracle) but is logged server-side for the operator.
        const send = (from: string) => fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            from,
            to: [String(res.email || email)],
            subject: "Your board sign-in link",
            html,
            text,
            tags: [{ name: "type", value: "board_magic_link" }],
          }),
        });
        let r = await send(hosted ? hosted.from : FROM);
        // A white-label sender the key cannot send from must not cost the member their link:
        // log it and resend from the house sender (the link still points at their domain).
        if (!r.ok && hosted) {
          console.error("board-magic-link hosted_sender_failed", r.status, (await r.text()).slice(0, 200));
          r = await send(FROM);
        }
        if (!r.ok) console.error("board-magic-link resend_failed", r.status, (await r.text()).slice(0, 200));
        // Operator receipt: which sender and which board address the link points at (never the token).
        else console.log("board-magic-link sent", hosted ? "hosted" : "house", hosted ? hosted.url : `${BOARD_BASE}/${slug}`);
      } else {
        console.error("board-magic-link resend_key_missing");
      }
    }
  } catch (e) {
    console.error("board-magic-link error", e instanceof Error ? e.message : String(e));
  }

  // Uniform response: the caller cannot tell allowed from not-allowed.
  return jsonResponse({ ok: true }, 200, origin);
});
