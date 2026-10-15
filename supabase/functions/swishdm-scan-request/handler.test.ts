import { assertEquals } from "jsr:@std/assert@1";
import { handleRequest } from "./handler.ts";

const origin = "https://madebyswishdm.com";
const valid = {
  brand: "Example Store", brand_url: "https://example.com", rival: "Rival Store",
  rival_url: "https://rival.example.com", product: "Outdoor gear", name: "Jane",
  email: "jane@example.com", linkedin_url: "", consent: true, source: "form",
};
const request = (body: unknown, requestOrigin = origin) => new Request("https://example.supabase.co/functions/v1/swishdm-scan-request", {
  method: "POST", headers: { origin: requestOrigin, "content-type": "application/json" }, body: JSON.stringify(body),
});

Deno.test("closed or malformed flag never calls admission", async () => {
  for (const flag of [undefined, "", "true", "0", " 1 "]) {
    let calls = 0;
    const response = await handleRequest(request(valid), flag, async () => { calls++; return "accepted"; });
    assertEquals(response.status, 503);
    assertEquals(calls, 0);
  }
});

Deno.test("open receiver accepts the current form shape without starting a scan", async () => {
  let seen: unknown;
  const response = await handleRequest(request(valid), "1", async (data) => { seen = data; return "accepted"; });
  assertEquals(response.status, 202);
  assertEquals(seen, {
    brand: "Example Store", brand_url: "https://example.com/", rival: "Rival Store",
    rival_url: "https://rival.example.com/", product: "Outdoor gear", name: "Jane",
    email: "jane@example.com", linkedin_url: null, source: "form",
  });
});

Deno.test("consent, schema, email and unsafe URLs fail before admission", async () => {
  const invalid = [
    { ...valid, consent: false }, { ...valid, email: "bad@" }, { ...valid, brand: "" },
    { ...valid, source: "anything" }, { ...valid, extra: "unexpected" },
    { ...valid, brand_url: "http://localhost:8080" },
    { ...valid, brand_url: "https://127.0.0.1" },
    { ...valid, brand_url: "https://[::1]" },
    { ...valid, brand_url: "https://user:pass@example.com" },
    { ...valid, rival_url: "https://example.com:8443" },
    { ...valid, brand_url: "https://example.com@127.0.0.1" },
    { ...valid, brand_url: "ftp://example.com" },
    { ...valid, linkedin_url: "https://evil-linkedin.com/profile" },
    { ...valid, brand_url: "https://example..com" },
  ];
  for (const body of invalid) {
    let calls = 0;
    const response = await handleRequest(request(body), "1", async () => { calls++; return "accepted"; });
    assertEquals(response.status, 400);
    assertEquals(calls, 0);
  }
});

Deno.test("oversized JSON never reaches admission", async () => {
  let calls = 0;
  const response = await handleRequest(request({ ...valid, brand: "A".repeat(9000) }), "1", async () => {
    calls++; return "accepted";
  });
  assertEquals(response.status, 400);
  assertEquals(calls, 0);
});

Deno.test("duplicate hides request existence and full does not promise a report", async () => {
  const statuses = [];
  for (const result of ["accepted", "duplicate", "full"] as const) {
    const response = await handleRequest(request(valid), "1", async () => result);
    statuses.push([response.status, await response.text()]);
  }
  assertEquals(statuses[1], statuses[0]);
  assertEquals(statuses[2][0], 429);
});

Deno.test("CORS is restricted and errors are generic", async () => {
  const preflight = await handleRequest(new Request("https://example.supabase.co/functions/v1/swishdm-scan-request", {
    method: "OPTIONS", headers: { origin, "access-control-request-method": "POST" },
  }), "1", async () => "accepted");
  assertEquals(preflight.status, 204);
  assertEquals(preflight.headers.get("access-control-allow-origin"), origin);
  const wrong = await handleRequest(request(valid, "https://evil.example"), "1", async () => "accepted");
  assertEquals(wrong.status, 403);
  assertEquals(wrong.headers.get("access-control-allow-origin"), null);
  const failed = await handleRequest(request(valid), "1", async () => { throw new Error("database secret"); });
  assertEquals(failed.status, 500);
  assertEquals((await failed.text()).includes("database secret"), false);
});
