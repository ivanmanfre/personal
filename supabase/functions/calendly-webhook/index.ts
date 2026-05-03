// Calendly webhook → auto-advance paid_assessments.pipeline_stage to 'day2_scheduled'.
//
// Calendly fires `invitee.created` when someone books. Match by email to a paid_assessment
// row that's still in the 'paid' stage (or 'intake_submitted'), and stamp day2_scheduled_at.
//
// Setup: in Calendly → Integrations → Webhooks, create a webhook subscription for
// `invitee.created` pointing at https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/calendly-webhook.
// Optional: pass a signing secret in `CALENDLY_WEBHOOK_SECRET` (Supabase Vault) and
// Calendly's `Calendly-Webhook-Signature` header is verified.

// deno-lint-ignore-file no-explicit-any
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function getVaultSecret(name: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_vault_secret", { p_name: name });
  if (error || !data) return null;
  return data as string;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jr(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return jr({ error: "method_not_allowed" }, 405);
  const raw = await req.text();

  // Optional: verify Calendly signature
  const sig = req.headers.get("calendly-webhook-signature") || "";
  const secret = await getVaultSecret("CALENDLY_WEBHOOK_SECRET");
  if (secret) {
    const m = sig.match(/t=(\d+),\s*v1=([a-f0-9]+)/);
    if (!m) return jr({ error: "missing_signature" }, 401);
    const [, t, v1] = m;
    const expected = await hmacSha256Hex(secret, `${t}.${raw}`);
    if (expected !== v1) return jr({ error: "bad_signature" }, 401);
    if (Math.abs(Date.now() / 1000 - parseInt(t)) > 300) return jr({ error: "stale" }, 401);
  }

  let body: any;
  try { body = JSON.parse(raw); } catch { return jr({ error: "invalid_json" }, 400); }

  // We only care about invitee.created (a new booking)
  if (body.event !== "invitee.created") return jr({ ok: true, ignored: body.event });

  const payload = body.payload || {};
  const email = String(payload.email || "").trim().toLowerCase();
  const scheduledAt = payload.scheduled_event?.start_time || payload.event?.start_time || null;
  if (!email || !scheduledAt) return jr({ ok: false, reason: "missing email or start_time" });

  // Wave 0 / P30-1: Pull UTM/source attribution from Calendly tracking + utm_*
  // params. Calendly forwards the embedded prefill URL params into the webhook
  // under `tracking` (utm_source/medium/campaign/etc.) and `utm_*` direct keys.
  const tracking = payload.tracking || {};
  const utm_source = tracking.utm_source || payload.utm_source || null;
  const utm_medium = tracking.utm_medium || payload.utm_medium || null;
  const utm_campaign = tracking.utm_campaign || payload.utm_campaign || null;
  const utm_content = tracking.utm_content || payload.utm_content || null;
  const utm_term = tracking.utm_term || null;
  const referral_token = tracking.ref || tracking.referral_token || payload.ref || null;
  const booking_source_path = tracking.booking_source_path || tracking.utm_source_path || null;
  const SOURCE_BUCKETS = new Set([
    "linkedin","outreach","nurture","podcast","referral","google","direct","upwork","lm-share",
  ]);
  let source: string | null = null;
  if (utm_source && SOURCE_BUCKETS.has(utm_source)) source = utm_source;
  else if (referral_token) source = "referral";
  else if (utm_source) source = "other";

  const isTest =
    /(@anthropic\.com|@ivanmanfredi\.com|^test|^e2e)/i.test(email);

  // Calendar_events: try to upsert an attribution row keyed by google_event_id.
  // We don't always have a google_event_id from Calendly directly; if we have
  // the Calendly event uri, we use that as a fallback synthetic id. Schema
  // allows TEXT, so any unique string works.
  const calendlyEventUri =
    payload.scheduled_event?.uri || payload.event?.uri || payload.uri || null;
  if (calendlyEventUri) {
    try {
      await supabase.from("calendar_events").upsert(
        {
          google_event_id: `calendly:${String(calendlyEventUri).slice(-200)}`,
          title: payload.scheduled_event?.name || "Calendly booking",
          start_time: scheduledAt,
          end_time: payload.scheduled_event?.end_time || null,
          attendees: [email],
          platform: "calendly",
          source,
          referral_token,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_term,
          utm_content,
          booking_source_path,
          meeting_type: payload.scheduled_event?.name || null,
          is_test: isTest,
        },
        { onConflict: "google_event_id" },
      );
    } catch (e) {
      console.error("[calendly-webhook] calendar_events upsert failed:", String(e));
    }
  }

  // Find the most recent paid_assessment for this email that hasn't already advanced past day2.
  const { data: pa } = await supabase
    .from("paid_assessments")
    .select("stripe_session_id, pipeline_stage, day2_scheduled_at")
    .ilike("email", email)
    .order("paid_at", { ascending: false });

  if (!pa || pa.length === 0) {
    return jr({ ok: true, matched: false, reason: "no paid_assessment for email" });
  }

  // Pick the first one that's still pre-day2.
  const SKIP = new Set(["day2_done", "day7_done", "converted", "refunded"]);
  const target = pa.find((r: any) => !SKIP.has(r.pipeline_stage));
  if (!target) return jr({ ok: true, matched: false, reason: "all rows past day2" });

  const updates: any = { day2_scheduled_at: scheduledAt };
  // Only auto-advance pipeline_stage if it's still 'paid' or 'intake_submitted'.
  if (["paid", "intake_submitted"].includes(target.pipeline_stage)) {
    updates.pipeline_stage = "day2_scheduled";
  }

  const { error: updErr } = await supabase
    .from("paid_assessments")
    .update(updates)
    .eq("stripe_session_id", target.stripe_session_id);

  if (updErr) return jr({ ok: false, error: updErr.message }, 500);

  return jr({
    ok: true,
    matched: true,
    stripe_session_id: target.stripe_session_id,
    new_pipeline_stage: updates.pipeline_stage || target.pipeline_stage,
    day2_scheduled_at: scheduledAt,
  });
});
