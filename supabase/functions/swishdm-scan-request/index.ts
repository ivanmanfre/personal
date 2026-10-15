import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { handleRequest, type ScanRequest } from "./handler.ts";

Deno.serve((req) => handleRequest(req, Deno.env.get("SWISHDM_SCAN_REQUESTS_OPEN"), async (data: ScanRequest) => {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw Error("service unavailable");
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data: result, error } = await sb.rpc("swishdm_scan_request_admit", { p_request: data });
  if (error || !["accepted", "duplicate", "full"].includes(result)) throw Error("admission unavailable");
  return result;
}));
