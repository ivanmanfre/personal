// Network lookup for one caller IP, used once per new ip_hash by scan-open.
// The raw IP goes to the lookup service and is never stored; only the result is kept (by hash) in open_networks.
// Any error, timeout or unsuccessful answer returns all nulls: the open is still stored and classified.

export type Network = { asn: number | null; org: string | null; country: string | null; city: string | null };

const NONE: Network = { asn: null, org: null, country: null, city: null };
const TIMEOUT_MS = 1500;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);

export async function lookupNetwork(ip: string, fetchImpl: typeof fetch = fetch): Promise<Network> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => { ctrl.abort(); resolve(null); }, TIMEOUT_MS);
  });
  try {
    const res = await Promise.race([
      fetchImpl(`https://ipwho.is/${encodeURIComponent(ip)}`, { signal: ctrl.signal }),
      timeout,
    ]);
    if (!res) return { ...NONE };
    const j = await Promise.race([res.json(), timeout]) as Record<string, unknown> | null;
    if (!j || j.success !== true) return { ...NONE };
    const conn = (j.connection ?? {}) as Record<string, unknown>;
    return {
      asn: typeof conn.asn === 'number' && Number.isInteger(conn.asn) ? conn.asn : null,
      org: str(conn.org) ?? str(conn.isp),
      country: str(j.country_code),
      city: str(j.city),
    };
  } catch {
    return { ...NONE };
  } finally {
    clearTimeout(timer);
  }
}
