// Stripe webhook handler for the $2,500 Agent-Ready Assessment.
// Receives checkout.session.completed events and upserts a row into
// paid_assessments. Signature verification uses the Stripe scheme
// (timestamp + payload HMAC-SHA256) against STRIPE_WEBHOOK_SECRET from vault.
//
// Stripe setup:
//   Dashboard → Developers → Webhooks → Add endpoint
//   URL:    https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed
//   Copy the signing secret (whsec_...) into Supabase vault as STRIPE_WEBHOOK_SECRET.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, stripe-signature",
  "Access-Control-Max-Age": "86400",
};

async function getSecret(sb: any, name: string): Promise<string> {
  const { data, error } = await sb.rpc("get_vault_secret", { p_name: name });
  if (error) throw new Error(`vault read ${name}: ${error.message}`);
  if (!data) throw new Error(`vault secret ${name} not set`);
  return data as string;
}

// Stripe signature header format: t=<ts>,v1=<sig>[,v1=<sig>...]
function parseSigHeader(header: string): { t: number; sigs: string[] } {
  const out: { t: number; sigs: string[] } = { t: 0, sigs: [] };
  for (const pair of header.split(",")) {
    const [k, v] = pair.split("=");
    if (k === "t") out.t = parseInt(v, 10);
    else if (k === "v1") out.sigs.push(v);
  }
  return out;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  const { t, sigs } = parseSigHeader(header);
  if (!t || sigs.length === 0) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > toleranceSec) return false;
  const expected = await hmacSha256Hex(secret, `${t}.${payload}`);
  return sigs.some((s) => timingSafeEqualHex(s, expected));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: CORS });
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const sigHeader = req.headers.get("stripe-signature");
  if (!sigHeader) {
    return new Response(JSON.stringify({ error: "missing stripe-signature" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  let webhookSecret: string;
  try {
    webhookSecret = await getSecret(sb, "STRIPE_WEBHOOK_SECRET");
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const valid = await verifyStripeSignature(rawBody, sigHeader, webhookSecret);
  if (!valid) {
    return new Response(JSON.stringify({ error: "invalid signature" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (event.type !== "checkout.session.completed") {
    // Acknowledge but don't persist other event types.
    return new Response(JSON.stringify({ ignored: event.type }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const session = event.data?.object ?? {};
  const email: string | null =
    session.customer_details?.email ?? session.customer_email ?? null;

  if (!email) {
    return new Response(JSON.stringify({ error: "no email on session" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const row = {
    stripe_session_id: session.id,
    stripe_customer_id: session.customer ?? null,
    stripe_payment_intent: session.payment_intent ?? null,
    email,
    name: session.customer_details?.name ?? null,
    amount_cents: session.amount_total ?? 0,
    currency: (session.currency ?? "usd").toLowerCase(),
    status: "paid",
    paid_at: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    metadata: session.metadata ?? {},
  };

  const { error } = await sb
    .from("paid_assessments")
    .upsert(row, { onConflict: "stripe_session_id" });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, session_id: session.id }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
