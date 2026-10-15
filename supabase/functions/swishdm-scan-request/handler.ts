export type ScanRequest = {
  brand: string; brand_url: string; rival: string; rival_url: string | null;
  product: string; name: string; email: string; linkedin_url: string | null;
  source: "form";
};

type Admission = "accepted" | "duplicate" | "full";
const origins = new Set(["https://madebyswishdm.com", "https://www.madebyswishdm.com"]);
const keys = new Set(["brand", "brand_url", "rival", "rival_url", "product", "name", "email", "linkedin_url", "consent", "source"]);

function reply(body: object, status: number, origin?: string): Response {
  const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store", vary: "Origin" });
  if (origin && origins.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", "POST, OPTIONS");
    headers.set("access-control-allow-headers", "content-type");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function publicUrl(value: unknown, optional = false): string | null {
  if (optional && (value === undefined || value === null || value === "")) return null;
  if (typeof value !== "string" || value.length > 500 || !/^https:\/\//i.test(value)) throw Error("url");
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !/^[a-z0-9.-]+$/.test(host) || !host.includes(".") || host.endsWith(".") ||
      host.startsWith(".") || host.includes("..") ||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) ||
      /(^|\.)localhost$/.test(host) || /(^|\.)[0-9]+$/.test(host) ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host)) throw Error("url");
  url.hash = "";
  return url.toString();
}

function field(body: Record<string, unknown>, key: string, max: number): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw Error("field");
  return value.trim();
}

export function validate(body: unknown): ScanRequest {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw Error("body");
  const data = body as Record<string, unknown>;
  if (Object.keys(data).some((key) => !keys.has(key)) || data.consent !== true || data.source !== "form") throw Error("body");
  const email = field(data, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw Error("email");
  const linkedin = publicUrl(data.linkedin_url, true);
  if (linkedin && !/^(www\.)?linkedin\.com$/.test(new URL(linkedin).hostname)) throw Error("linkedin");
  return {
    brand: field(data, "brand", 120), brand_url: publicUrl(data.brand_url)!,
    rival: field(data, "rival", 120), rival_url: publicUrl(data.rival_url, true),
    product: field(data, "product", 240), name: field(data, "name", 120), email,
    linkedin_url: linkedin, source: "form",
  };
}

export async function handleRequest(
  req: Request, openFlag: string | undefined,
  admit: (request: ScanRequest) => Promise<Admission>,
): Promise<Response> {
  const origin = req.headers.get("origin") ?? "";
  if (!origins.has(origin)) return reply({ error: "Unavailable" }, 403);
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204, headers: {
      "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type", vary: "Origin",
    },
  });
  if (req.method !== "POST") return reply({ error: "Unavailable" }, 405, origin);
  if (openFlag !== "1") return reply({ error: "Requests are closed" }, 503, origin);
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ error: "Invalid request" }, 400, origin);
  if (Number(req.headers.get("content-length")) > 8192) return reply({ error: "Invalid request" }, 400, origin);
  let data: ScanRequest;
  try {
    const reader = req.body?.getReader();
    if (!reader) throw Error("body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8192) {
        await reader.cancel();
        throw Error("size");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    data = validate(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
  } catch {
    return reply({ error: "Invalid request" }, 400, origin);
  }
  try {
    const result = await admit(data);
    if (result === "full") return reply({ error: "Requests are at capacity" }, 429, origin);
    return reply({ ok: true, message: "Request received for review" }, 202, origin);
  } catch {
    return reply({ error: "Unavailable" }, 500, origin);
  }
}
