// DEPLOY WITH: supabase functions deploy client-photo-delete --no-verify-jwt --project-ref bjbvqvzbzczjbatgmccb
// (browser-called; the platform JWT gate 401s the anon POST → auth handled in-function.)
//
// Deletes ONE photo from a client's lifestyle library (client-photos bucket,
// <slug>/ folder). storage.objects has a protect_delete() trigger that blocks
// direct SQL deletes, so removal must go through the Storage API under the
// service role. Auth mirrors client_board_edit_draft: a ?k= board token OR a
// magic-link session (sha256 of the session secret vs client_board_sessions).
// Scope guard: bare filename only (no "/"), joined to the caller's own slug —
// a session for slug X can never reach another client's folder.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // supabase-js functions.invoke attaches x-client-info + x-supabase-api-version;
  // omitting them fails the browser preflight (curl doesn't send them, so it passed).
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: { slug?: string; token?: string; session?: string; name?: string };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { slug, token, session, name } = body;

  if (!slug || !name) return json({ error: "slug, name required" }, 400);
  // Bare filename only — no path separators or traversal can escape the slug folder.
  if (name.includes("/") || name.includes("..")) return json({ error: "bad_name" }, 400);
  if (!token && !session) return json({ error: "not_authenticated" }, 401);

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    // AUTH — same gate as reading/editing the board.
    let by: string | null = null;
    if (token) {
      const { data: row } = await supa
        .from("client_boards")
        .select("id, expires_at")
        .eq("slug", slug).eq("token", token).maybeSingle();
      if (!row) return json({ error: "unauthorized" }, 403);
      if (row.expires_at && new Date(row.expires_at as string).getTime() <= Date.now()) {
        return json({ error: "board link expired" }, 403);
      }
    } else {
      const hash = await sha256Hex(session as string);
      const { data: sess } = await supa
        .from("client_board_sessions")
        .select("email, expires_at, revoked_at")
        .eq("slug", slug).eq("token_hash", hash).maybeSingle();
      if (!sess || sess.revoked_at || (sess.expires_at && new Date(sess.expires_at as string).getTime() <= Date.now())) {
        return json({ error: "not_authenticated" }, 401);
      }
      by = (sess.email as string) ?? null;
    }

    // DELETE via the Storage API (proper blob removal, no orphaned object).
    const path = `${slug}/${name}`;
    const { data: removed, error: rmErr } = await supa.storage.from("client-photos").remove([path]);
    if (rmErr) return json({ error: rmErr.message }, 500);
    const deleted = Array.isArray(removed) ? removed.length : 0;

    // Log for the operator's activity feed (best-effort; never blocks the delete).
    const { data: b } = await supa.from("client_boards").select("client_id").eq("slug", slug).maybeSingle();
    await supa.from("client_board_actions").insert({
      board_slug: slug,
      client_id: (b?.client_id as string) ?? slug,
      action: "delete_photo",
      ref: name,
      payload: { deleted, by },
    });

    return json({ ok: true, deleted });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
