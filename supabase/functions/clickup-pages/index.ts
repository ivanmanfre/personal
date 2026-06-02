// ClickUp Docs API proxy for the dashboard PromptsPanel.
// Keeps the ClickUp PAT server-side (Supabase vault: CLICKUP_TOKEN), exposes
// just three operations to the dashboard: list pages in a doc, fetch page
// content, and update page content.
//
// All calls are origin-gated to the dashboard origins. The dashboard itself is
// password-gated at the app level, matching the existing `blueprint-publish`
// pattern in this repo.
//
// Routes (action via query string):
//   GET  ?action=list&workspace_id=…&doc_id=…
//   GET  ?action=get&workspace_id=…&doc_id=…&page_id=…
//   POST ?action=save&workspace_id=…&doc_id=…&page_id=…  body: { name?, content }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://ivanmanfredi.com",
  "https://www.ivanmanfredi.com",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const CORS = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://ivanmanfredi.com",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, prefer",
  "Access-Control-Max-Age": "86400",
});

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS(origin) },
  });
}

const ID_RE = /^[A-Za-z0-9_\-]+$/;

async function getClickupToken(): Promise<string> {
  // Try the vault RPC first (consistent with recording-auto-title pattern),
  // fall back to a plain env var if the RPC is not provisioned yet.
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  try {
    const { data } = await sb.rpc("get_vault_secret", { p_name: "CLICKUP_TOKEN" });
    if (data) return data as string;
  } catch (_) { /* fall through */ }
  const envToken = Deno.env.get("CLICKUP_TOKEN");
  if (envToken) return envToken;
  throw new Error("CLICKUP_TOKEN not configured (vault or env)");
}

async function clickup(path: string, init: RequestInit, token: string) {
  const res = await fetch(`https://api.clickup.com${path}`, {
    ...init,
    headers: {
      "Authorization": token,
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS(origin) });
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: "origin_not_allowed" }, 403, origin);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  const workspaceId = url.searchParams.get("workspace_id") || "";
  const docId = url.searchParams.get("doc_id") || "";
  const pageId = url.searchParams.get("page_id") || "";

  if (!ID_RE.test(workspaceId) || !ID_RE.test(docId)) {
    return json({ error: "invalid_ids" }, 400, origin);
  }

  let token: string;
  try { token = await getClickupToken(); }
  catch (e) { return json({ error: "token_unavailable", detail: String(e) }, 500, origin); }

  try {
    if (action === "list" && req.method === "GET") {
      // ClickUp v3 listing: returns a flat array of pages (with parent_page_id
      // for nesting). max_page_depth=-1 returns all descendants.
      const r = await clickup(
        `/api/v3/workspaces/${workspaceId}/docs/${docId}/pageListing?max_page_depth=-1`,
        { method: "GET" },
        token,
      );
      if (!r.ok) return json({ error: "clickup_list_failed", status: r.status, body: r.body }, 502, origin);
      return json({ pages: r.body }, 200, origin);
    }

    if (action === "get" && req.method === "GET") {
      if (!ID_RE.test(pageId)) return json({ error: "invalid_page_id" }, 400, origin);
      const r = await clickup(
        `/api/v3/workspaces/${workspaceId}/docs/${docId}/pages/${pageId}?content_format=text%2Fmd`,
        { method: "GET" },
        token,
      );
      if (!r.ok) return json({ error: "clickup_get_failed", status: r.status, body: r.body }, 502, origin);
      return json({ page: r.body }, 200, origin);
    }

    if (action === "save" && req.method === "POST") {
      if (!ID_RE.test(pageId)) return json({ error: "invalid_page_id" }, 400, origin);
      let body: { name?: string; content?: string };
      try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, origin); }
      const payload: Record<string, unknown> = {
        content_format: "text/md",
        content_edit_mode: "replace",
      };
      if (typeof body.name === "string" && body.name.trim()) payload.name = body.name.trim();
      if (typeof body.content === "string") payload.content = body.content;
      if (payload.content === undefined && payload.name === undefined) {
        return json({ error: "nothing_to_save" }, 400, origin);
      }
      const r = await clickup(
        `/api/v3/workspaces/${workspaceId}/docs/${docId}/pages/${pageId}`,
        { method: "PUT", body: JSON.stringify(payload) },
        token,
      );
      if (!r.ok) return json({ error: "clickup_save_failed", status: r.status, body: r.body }, 502, origin);
      return json({ ok: true, body: r.body }, 200, origin);
    }

    return json({ error: "unknown_action" }, 400, origin);
  } catch (e) {
    return json({ error: "server_error", detail: String(e) }, 500, origin);
  }
});
