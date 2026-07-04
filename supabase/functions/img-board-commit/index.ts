import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Persists a /client board image edit. client_boards is RLS deny-all for anon,
// so the read-modify-write of board (jsonb) + the image_edit_versions log run
// here with the service role. Mirrors lib/clientBoardImageActions.swapBoardItemImage.

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

function swapBoardItemImage(board: any, itemId: string, field: string, url: string): any {
  if (!board || typeof board !== "object") return board;
  const next: any = { ...board };
  const swapInArray = (arr: any) => {
    if (!Array.isArray(arr)) return { arr, found: false };
    let found = false;
    const out = arr.map((item: any) => {
      if (item && typeof item === "object" && item.id === itemId) {
        found = true;
        return { ...item, [field]: url };
      }
      return item;
    });
    return { arr: out, found };
  };
  let matched = false;
  for (const key of ["queue", "ideas", "lead_magnets"]) {
    if (!matched && Array.isArray(next[key])) {
      const { arr, found } = swapInArray(next[key]);
      if (found) { next[key] = arr; matched = true; }
    }
  }
  if (!matched && next.lm && typeof next.lm === "object" && !Array.isArray(next.lm) && next.lm.id === itemId) {
    next.lm = { ...next.lm, [field]: url };
    matched = true;
  }
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  let body: {
    boardId?: string; itemId?: string; field?: string;
    prevUrl?: string; newUrl?: string; op?: string; prompt?: string;
  };
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const { boardId, itemId, field, prevUrl, newUrl, op, prompt } = body;
  if (!boardId || !itemId || !newUrl || (field !== "media_url" && field !== "cover_url")) {
    return json({ error: "boardId, itemId, newUrl, field(media_url|cover_url) required" }, 400);
  }

  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row, error: readErr } = await supa.from("client_boards").select("board").eq("id", boardId).single();
    if (readErr) return json({ error: `read ${readErr.message}` }, 500);

    const nextBoard = swapBoardItemImage(row?.board, itemId, field, newUrl);
    const { error: updErr } = await supa.from("client_boards").update({ board: nextBoard }).eq("id", boardId);
    if (updErr) return json({ error: `update ${updErr.message}` }, 500);

    const { error: insErr } = await supa.from("image_edit_versions").insert({
      draft_id: `${boardId}:${itemId}`,
      image_index: 0,
      prev_url: prevUrl ?? null,
      new_url: newUrl,
      op: `board:${op ?? "refine"}`,
      prompt: prompt ?? null,
    });
    if (insErr) return json({ error: `version ${insErr.message}` }, 500);

    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
