// DEPLOY WITH: supabase functions deploy img-board-commit --no-verify-jwt --project-ref bjbvqvzbzczjbatgmccb
// (browser-called; platform JWT gate 401s without CORS → "Failed to send a request".
//  Auth handled in-function: writes gated by the board's slug+token.)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Persists a /client board image edit. client_boards is RLS deny-all for anon,
// so the read-modify-write of board (jsonb) + the image_edit_versions log run
// here with the service role. Mirrors lib/clientBoardImageActions.swapBoardItemImage.
// 2026-08-26: the write is a targeted client_board_apply_ops call, NOT a whole-board
// update -- see findBoardItemOp below.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey",
  "Access-Control-Max-Age": "86400",
  "Content-Type": "application/json",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

// Decide WHICH board section holds the item, and hand the write to
// client_board_apply_ops. Hardened 2026-08-26 (goal-run rise-panel-followthrough phase
// 5): this used to build a whole new board object which was then written back over the
// entire column, reverting board.outreach_truth and every other writer's key to whatever
// the blob looked like when this request started.
// Search order (queue, ideas, lead_magnets, then the singleton lm) is unchanged, so which
// item wins is unchanged; only the write shape changed. Arrays go through `set_by_id` so
// the ITEM INDEX is resolved inside the RPC under the row lock, never from this copy.
function findBoardItemOp(board: any, itemId: string, field: string, url: string): Record<string, unknown> | null {
  if (!board || typeof board !== "object") return null;
  for (const key of ["queue", "ideas", "lead_magnets"]) {
    const arr = board[key];
    if (!Array.isArray(arr)) continue;
    if (arr.some((item: any) => item && typeof item === "object" && item.id === itemId)) {
      return { op: "set_by_id", path: [key], id: itemId, field, value: url };
    }
  }
  const lm = board.lm;
  if (lm && typeof lm === "object" && !Array.isArray(lm) && lm.id === itemId) {
    return { op: "set", path: ["lm", field], value: url };
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: {
    slug?: string; token?: string; itemId?: string; field?: string;
    prevUrl?: string; newUrl?: string; op?: string; prompt?: string;
  };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { slug, token, itemId, field, prevUrl, newUrl, op, prompt } = body;
  // AUTH: writing is gated by the SAME slug+token as reading (get_client_board).
  // Without a valid, non-expired token the caller cannot persist — closes the
  // anonymous-defacement hole (a bare board id is no longer sufficient).
  if (!slug || !token || !itemId || !newUrl || (field !== "media_url" && field !== "cover_url")) {
    return json({ error: "slug, token, itemId, newUrl, field(media_url|cover_url) required" }, 400);
  }

  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Resolve + authorize in one query (mirrors get_client_board's gate). Also
    // yields the real row id the frontend never sees.
    const { data: row, error: readErr } = await supa
      .from("client_boards")
      .select("id, board, expires_at")
      .eq("slug", slug)
      .eq("token", token)
      .maybeSingle();
    if (readErr) return json({ error: `read ${readErr.message}` }, 500);
    if (!row) return json({ error: "unauthorized" }, 403);
    if (row.expires_at && new Date(row.expires_at as string).getTime() <= Date.now()) {
      return json({ error: "board link expired" }, 403);
    }

    // Targeted write: ONE jsonb_set on ONE field, applied by client_board_apply_ops
    // against the row it re-reads under lock. No whole-board round-trip, so a concurrent
    // outreach-truth recompute / queue sync / booking brief cannot be rolled back, and a
    // second image edit on a different card cannot be lost either.
    const boardOp = findBoardItemOp(row.board, itemId, field, newUrl);
    if (!boardOp) return json({ error: "item not found on this board" }, 404);
    const { data: receipt, error: updErr } = await supa.rpc("client_board_apply_ops", {
      p_slug: slug,
      p_ops: [boardOp],
    });
    if (updErr) return json({ error: `update ${updErr.message}` }, 500);

    const { error: insErr } = await supa.from("image_edit_versions").insert({
      draft_id: `${row.id}:${itemId}`,
      image_index: 0,
      prev_url: prevUrl ?? null,
      new_url: newUrl,
      op: `board:${op ?? "refine"}`,
      prompt: prompt ?? null,
    });
    if (insErr) return json({ error: `version ${insErr.message}` }, 500);

    return json({ ok: true, op: boardOp.op, outreach_truth_counted_at: (receipt as any)?.outreach_truth_counted_at ?? null });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
