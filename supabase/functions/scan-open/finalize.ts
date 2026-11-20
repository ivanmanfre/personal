// The tail of one scan-open call, after the row is inserted: find the caller's network (once per ip_hash) and ask
// the database to label the row. Never throws: a failure here must not change what the page or the tracker sees.

type Net = { asn: number | null; org: string | null; country: string | null; city: string | null };
export type FinalizeDb = {
  from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => PromiseLike<{ data: unknown }> } } };
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error?: unknown }>;
};
export type OpenRef = { openId: number; ip: string | null; ipHash: string | null; isOwner: boolean };

const NONE: Net = { asn: null, org: null, country: null, city: null };

export async function finalizeOpen(db: FinalizeDb, o: OpenRef, lookup: (ip: string) => Promise<Net>): Promise<unknown> {
  try {
    let net: Net = NONE;
    if (o.ip && o.ipHash && !o.isOwner) {
      // A stored network with an ASN is reused by the database itself (pass nulls). A seeded row without an ASN
      // (gateway-log backfill) is looked up again so it gains one.
      const { data } = await db.from('open_networks').select('asn').eq('ip_hash', o.ipHash).maybeSingle();
      const storedAsn = (data as { asn?: unknown } | null)?.asn;
      if (typeof storedAsn !== 'number') net = await lookup(o.ip);
    }
    const { data } = await db.rpc('scan_open_finalize', {
      p_id: o.openId, p_asn: net.asn, p_org: net.org, p_country: net.country, p_city: net.city,
    });
    return data ?? null;
  } catch {
    return null;
  }
}
