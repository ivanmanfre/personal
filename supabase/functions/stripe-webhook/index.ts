// Stripe webhook handler for the $2,500 Agent-Ready Blueprint.
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

  // Fire welcome email via Resend. Best-effort: a failure here should NOT
  // fail the webhook (Stripe would retry, creating duplicate rows).
  try {
    await sendWelcomeEmail(sb, row);
  } catch (e) {
    console.error("welcome email failed:", String(e));
  }

  return new Response(JSON.stringify({ ok: true, session_id: session.id }), {
    status: 200,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});

async function sendWelcomeEmail(sb: any, row: Record<string, unknown>): Promise<void> {
  const apiKey = await getSecret(sb, "RESEND_API_KEY_ASSESSMENT");
  const from = await getSecret(sb, "RESEND_FROM");

  const sessionId = row.stripe_session_id as string;
  const email = row.email as string;
  const name = (row.name as string | null) ?? null;
  const welcomeUrl = `https://ivanmanfredi.com/assessment/welcome?session_id=${encodeURIComponent(sessionId)}`;
  const intakeUrl = `https://ivanmanfredi.com/assessment/intake?session_id=${encodeURIComponent(sessionId)}`;
  const calendlyUrl = "https://calendly.com/ivan-intelligents/30-minute-meeting-clone";

  const firstLine = name ? `Hi ${name.split(" ")[0]},` : "Hi there,";

  const text = `${firstLine}

Payment received. Thanks for booking the Agent-Ready Blueprint.

Two things to do now:

1. Fill out the intake questionnaire (~25 min, saves as you type):
   ${intakeUrl}

2. Book the Day 2 working session:
   ${calendlyUrl}

The 7-day flow:
  Day 1 - You fill the intake
  Day 2 - We run a working session (60 min)
  Day 3-6 - I produce your scorecard + 30-day roadmap
  Day 7 - Final presentation call

The $2,500 is credited 100% toward any follow-on engagement within 60 days. If I recommend you wait and fix the foundation first, that recommendation is the deliverable.

One thing to set expectation now: I pace to your absorption, not my delivery. Your Blueprint is the start. The first kickoff call sets the implementation budget for week 1 - we ship only what your team can actually integrate, leaving runway for the previous wave to land.

Full welcome page with details: ${welcomeUrl}

Reply to this email with any questions.

- Ivan Manfredi
Agent-Ready Ops(TM)
ivanmanfredi.com`;

  const html = `<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:40px auto;padding:0 20px;color:#1A1A1A;line-height:1.55;background:#F7F4EF;">
    <p style="margin:0 0 16px">${firstLine}</p>
    <p style="margin:0 0 16px">Payment received. Thanks for booking the Agent-Ready Blueprint.</p>
    <p style="margin:32px 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6B6861;font-family:'IBM Plex Mono',monospace">Two things to do now</p>
    <ol style="padding-left:20px;margin:0 0 24px">
      <li style="margin-bottom:12px"><strong>Fill the intake questionnaire</strong> (~25 min, saves as you type)<br><a href="${intakeUrl}" style="color:#344B29;font-weight:600">Open the intake -&gt;</a></li>
      <li style="margin-bottom:12px"><strong>Book the Day 2 working session</strong><br><a href="${calendlyUrl}" style="color:#344B29;font-weight:600">Pick a time -&gt;</a></li>
    </ol>
    <p style="margin:32px 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6B6861;font-family:'IBM Plex Mono',monospace">The 7-day flow</p>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:24px">
      <tr><td style="padding:6px 0;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#6B6861;width:80px">Day 1</td><td style="padding:6px 0;color:#4A4A48">You fill the intake</td></tr>
      <tr><td style="padding:6px 0;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#6B6861">Day 2</td><td style="padding:6px 0;color:#4A4A48">Working session (60 min)</td></tr>
      <tr><td style="padding:6px 0;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#6B6861">Day 3-6</td><td style="padding:6px 0;color:#4A4A48">I produce your scorecard + 30-day roadmap</td></tr>
      <tr><td style="padding:6px 0;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#6B6861">Day 7</td><td style="padding:6px 0;color:#4A4A48">Final presentation call</td></tr>
    </table>
    <p style="margin:0 0 16px;color:#4A4A48;font-size:14px">The $2,500 is credited 100% toward any follow-on engagement within 60 days. If I recommend you wait and fix the foundation first, that recommendation is the deliverable.</p>
    <p style="margin:0 0 16px;padding:12px 14px;background:#EAE3D5;border-left:2px solid #344B29;color:#4A4A48;font-size:14px">One thing to set expectation now: <strong>I pace to your absorption, not my delivery.</strong> Your Blueprint is the start &mdash; the first kickoff call sets the implementation budget for week 1. We ship only what your team can actually integrate, leaving runway for the previous wave to land.</p>
    <p style="margin:24px 0 16px"><a href="${welcomeUrl}" style="color:#344B29;font-weight:600">Full welcome page -&gt;</a></p>
    <p style="margin:32px 0 0;padding-top:16px;border-top:1px solid rgba(26,26,26,0.15);color:#6B6861;font-size:13px">Reply to this email with any questions.<br><br>- Iv&aacute;n Manfredi<br><span style="font-family:'IBM Plex Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.14em">Agent-Ready Ops&trade;</span></p>
  </body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      reply_to: "im@ivanmanfredi.com",
      subject: "Your Agent-Ready Blueprint is booked",
      text,
      html,
      tags: [
        { name: "type", value: "assessment_welcome" },
        { name: "stripe_session_id", value: sessionId.slice(0, 40) },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resend ${res.status}: ${body.slice(0, 200)}`);
  }
}
