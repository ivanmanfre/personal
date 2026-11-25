/// <reference lib="deno.ns" />
import { checkAnswer, type Post, prompt, type Turn } from "./review.ts";

const project = Deno.env.get("SUPABASE_URL")!;
const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const headers = {
  apikey: service,
  Authorization: "Bearer " + service,
  "Content-Type": "application/json",
};
const unipile = "https://api38.unipile.com:16836/api/v1";
type Pending = { id: string; chat_id: string; unipile_message_id: string };
type Native = {
  id: string;
  chat_id: string;
  account_id: string;
  is_sender: boolean | number;
  timestamp: string;
  text?: string;
  is_event?: number;
  event_type?: string;
  deleted?: number;
  hidden?: number;
  attachments?: unknown[];
};
async function json(url: string, options: RequestInit) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw Error("http_" + response.status);
  return await response.json();
}
const rpc = (fn: string, data: unknown = {}) =>
  json(project + "/rest/v1/rpc/" + fn, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

async function nativeTurns(row: Pending, account: string, key: string) {
  const turns: Turn[] = [];
  let cursor = "", target: Turn | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 5; page++) {
    const url = new URL(
      unipile + "/chats/" + encodeURIComponent(row.chat_id) + "/messages",
    );
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const batch = await json(url.href, { headers: { "X-API-KEY": key } });
    if (!Array.isArray(batch.items)) throw Error("invalid_thread");
    for (const m of batch.items as Native[]) {
      if (m.account_id !== account || m.chat_id !== row.chat_id) {
        throw Error("account_mismatch");
      }
      if (m.is_event || m.event_type) continue;
      if (
        !m.id || !Number.isFinite(Date.parse(m.timestamp)) ||
        ![0, 1, true, false].includes(m.is_sender)
      ) throw Error("invalid_turn");
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      // Deleted or attachment-only turns still establish direction; their contents cannot provide positive evidence.
      const t = {
        id: m.id,
        own: !!m.is_sender,
        text: m.deleted || m.hidden ? "" : m.text || "",
        timestamp: m.timestamp,
      };
      turns.push(t);
      if (m.id === row.unipile_message_id) target = t;
    }
    cursor = batch.cursor;
    if (!cursor) break;
    if (page === 4) throw Error("incomplete_history");
  }
  if (!target || target.own) throw Error("unbound_target");
  const at = Date.parse(target.timestamp);
  const history = turns.filter((t) => Date.parse(t.timestamp) <= at).sort((
    a,
    b,
  ) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  // A tie at chat origin cannot prove the buyer started the conversation.
  if (
    history.some((t) =>
      t.own && Date.parse(t.timestamp) === Date.parse(history[0].timestamp)
    )
  ) return { history, at, outbound: true };
  return { history, at, outbound: false };
}

Deno.serve(async (req) => {
  const authorization = req.headers.get("authorization");
  if (req.method !== "POST" || !authorization) {
    return new Response(null, { status: 403 });
  }
  try {
    // PostgREST verifies the caller's credential and enforces EXECUTE (service_role only).
    // Hosted workers and Vault can hold different valid service credentials.
    const access = await fetch(project + "/rest/v1/rpc/swishdm_dm_candidates", {
      method: "POST",
      headers: {
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (access.status === 401 || access.status === 403) {
      return new Response(null, { status: 403 });
    }
    if (!access.ok) throw Error("database_unavailable");
    const pending: Pending[] = await access.json();
    if (!pending.length) return Response.json({ reviewed: 0 });
    const config: { key: string; value: string }[] = await json(
      project +
        "/rest/v1/integration_config?select=key,value&key=in.(swishdm_unipile_account_id,unipile_api_key,railway_proxy_key,railway_proxy_url)",
      { headers },
    );
    const cfg = Object.fromEntries(config.map((r) => [r.key, r.value]));
    const posts: Post[] = await rpc("swishdm_dm_posts");
    const outcomes: string[] = [];
    await Promise.all(pending.map(async (row) => {
      const save = (post: string | null, evidence: unknown) =>
        rpc("swishdm_record_dm_review", {
          p_id: row.id,
          p_post: post,
          p_review: evidence,
        });
      try {
        const { history, at, outbound } = await nativeTurns(
          row,
          cfg.swishdm_unipile_account_id,
          cfg.unipile_api_key,
        );
        if (outbound) {
          outcomes.push(await save(null, { status: "outreach" }));
          return;
        }
        const eligible = posts.filter((p) => Date.parse(p.published_at) <= at);
        const ask = prompt + "\n" +
          JSON.stringify({ conversation: history, posts: eligible });
        const response = await json(cfg.railway_proxy_url, {
          method: "POST",
          headers: {
            "X-API-Key": cfg.railway_proxy_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-5-5",
            max_tokens: 450,
            messages: [{ role: "user", content: ask }],
          }),
        });
        const raw = response.content?.filter((b: { type: string }) =>
          b.type === "text"
        ).map((b: { text: string }) => b.text).join("").trim();
        const { post, evidence } = checkAnswer(
          JSON.parse(
            raw.replace(/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/g, ""),
          ),
          history,
          eligible,
        );
        // A just-published post may arrive in the daily metrics collection after the DM.
        const retry =
          evidence.status === "no_match" && Date.now() - at < 2 * 86400000
            ? { retry_at: new Date(Date.now() + 12 * 3600000).toISOString() }
            : {};
        outcomes.push(await save(post, { ...evidence, ...retry }));
      } catch (error) {
        const code = error instanceof Error &&
            /^(http_\d+|invalid_thread|account_mismatch|invalid_turn|incomplete_history|unbound_target|bad_status|unverified_evidence|conflicting_link|ambiguous_passage)$/
              .test(error.message)
          ? error.message
          : "review_unavailable";
        await save(null, {
          status: "retry",
          code,
          retry_at: new Date(Date.now() + 3600000).toISOString(),
        });
        outcomes.push(code);
      }
    }));
    return Response.json({ reviewed: outcomes.length, outcomes });
  } catch {
    return Response.json({ error: "worker_unavailable" }, { status: 503 });
  }
});
