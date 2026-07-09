// scan-open — records one open of a /scan/<slug> hypertarget page.
//
// Called fire-and-forget from ScanReportPage on load. The browser can't be
// trusted to know Ivan's IP, so the IP decision happens HERE, server-side:
//
//   is_owner = owner_flag (dashboard-authed browser / ?me=1)  OR
//              request IP is a known-owner IP (owner_ips)
//
// Any open with owner_flag=true upserts its IP hash into owner_ips, so Ivan's
// home / office / phone IPs self-seed from normal authed browsing. After that,
// opens from those IPs are excluded even in incognito or when he clicks a raw
// sent link — closing the LinkedIn/phone gap the client-only flag can't.
//
// Body: { company_slug, owner_flag?, device_type?, referrer_host?, user_agent? }
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), IP_HASH_SALT.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clientIp(req: Request): string | null {
  // Supabase/edge sits behind a proxy; x-forwarded-for is "client, proxy1, …".
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

function clamp(s: string | null | undefined, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPA_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SALT = Deno.env.get("IP_HASH_SALT") || "scan-open-fallback-salt";

    const body = await req.json().catch(() => ({}));
    const slug = String(body.company_slug || "").trim();
    if (!slug || !SLUG_RE.test(slug)) return json({ error: "bad slug" }, 400);

    const ownerFlag = body.owner_flag === true;
    const ip = clientIp(req);
    const ipHash = ip ? await sha256Hex(SALT + ip) : null;

    const supabase = createClient(SUPA_URL, SUPA_KEY, {
      auth: { persistSession: false },
    });

    // IP-based owner match (the second exclusion layer).
    let ipIsOwner = false;
    if (ipHash) {
      const { data: known } = await supabase
        .from("owner_ips")
        .select("ip_hash")
        .eq("ip_hash", ipHash)
        .maybeSingle();
      ipIsOwner = !!known;
    }

    const isOwner = ownerFlag || ipIsOwner;

    // Auto-learn: an authed open teaches us this IP is Ivan's, forever after.
    if (ownerFlag && ipHash) {
      await supabase
        .from("owner_ips")
        .upsert(
          { ip_hash: ipHash, last_seen: new Date().toISOString(), note: "auto: dashboard/?me=1 open" },
          { onConflict: "ip_hash" },
        );
    }

    await supabase.from("scan_opens").insert({
      company_slug: slug,
      is_owner: isOwner,
      device_type: clamp(body.device_type, 16),
      referrer_host: clamp(body.referrer_host, 253),
      ip_hash: ipHash,
      user_agent: clamp(body.user_agent, 512),
    });

    return json({ ok: true, is_owner: isOwner });
  } catch (_e) {
    // Never surface tracker errors — the page must not break on a bad open.
    return json({ ok: false }, 200);
  }
});
