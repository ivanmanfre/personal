import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Daily snapshot of Ivan's own LinkedIn follower/connection count into
// linkedin_follower_history. Source: Unipile retrieve-profile (own profile id).
// Cron-invoked, no input, idempotent upsert keyed on BA-local date.
Deno.serve(async () => {
  try {
    const dsn = Deno.env.get("FOLLOWER_UNIPILE_DSN")!;
    const key = Deno.env.get("FOLLOWER_UNIPILE_KEY")!;
    const account = Deno.env.get("FOLLOWER_UNIPILE_ACCOUNT")!;
    const liId = Deno.env.get("FOLLOWER_LINKEDIN_ID")!;

    const res = await fetch(
      `https://${dsn}/api/v1/users/${liId}?account_id=${account}`,
      { headers: { "X-API-KEY": key, accept: "application/json" } },
    );
    if (!res.ok) {
      const body = await res.text();
      return json({ ok: false, stage: "unipile", status: res.status, body: body.slice(0, 300) }, 502);
    }
    const profile = await res.json();
    const followers = profile.follower_count;
    const connections = typeof profile.connections_count === "number" ? profile.connections_count : null;
    if (typeof followers !== "number") {
      return json({ ok: false, stage: "parse", keys: Object.keys(profile) }, 502);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    // BA is UTC-3 year round (no DST) — align the daily row with the dashboard's scheduling timezone.
    const baDate = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const { error } = await supabase
      .from("linkedin_follower_history")
      .upsert(
        { date: baDate, follower_count: followers, connections_count: connections, fetched_at: new Date().toISOString() },
        { onConflict: "date" },
      );
    if (error) return json({ ok: false, stage: "upsert", error: error.message }, 500);

    return json({ ok: true, date: baDate, follower_count: followers, connections_count: connections });
  } catch (e) {
    return json({ ok: false, stage: "exception", error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
