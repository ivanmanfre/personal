import { describe, expect, it } from 'vitest';
import { finalizeOpen } from './finalize';

type Call = { fn: string; args: Record<string, unknown> };
function fakeDb(stored: Record<string, unknown> | null, rpcResult: unknown = { open_class: 'human' }, rpcThrows = false) {
  const calls: Call[] = [];
  return {
    calls,
    from: (_t: string) => ({
      select: (_c: string) => ({
        eq: (_k: string, _v: string) => ({
          maybeSingle: async () => ({ data: stored, error: null }),
        }),
      }),
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (rpcThrows) throw new Error('db down');
      return { data: rpcResult, error: null };
    },
  };
}
const MS = { asn: 8075, org: 'Microsoft Limited', country: 'US', city: 'Boydton' };

describe('finalizeOpen', () => {
  it('looks up a new hash and passes the network to the database', async () => {
    const db = fakeDb(null);
    let looked = 0;
    await finalizeOpen(db, { openId: 7, ip: '9.9.9.9', ipHash: 'H', isOwner: false }, async () => { looked++; return MS; });
    expect(looked).toBe(1);
    expect(db.calls).toEqual([{ fn: 'scan_open_finalize', args: { p_id: 7, p_asn: 8075, p_org: 'Microsoft Limited', p_country: 'US', p_city: 'Boydton' } }]);
  });
  it('a known hash with an ASN skips the lookup and lets the database reuse it', async () => {
    const db = fakeDb({ asn: 8075, org: 'Microsoft Limited' });
    let looked = 0;
    await finalizeOpen(db, { openId: 8, ip: '9.9.9.9', ipHash: 'H', isOwner: false }, async () => { looked++; return MS; });
    expect(looked).toBe(0);
    expect(db.calls[0].args).toEqual({ p_id: 8, p_asn: null, p_org: null, p_country: null, p_city: null });
  });
  it('a seeded hash with no ASN is looked up again', async () => {
    const db = fakeDb({ asn: null, org: 'IP Pools' });
    let looked = 0;
    await finalizeOpen(db, { openId: 9, ip: '9.9.9.9', ipHash: 'H', isOwner: false }, async () => { looked++; return { asn: 1234, org: 'IP Pools', country: 'GB', city: 'London' }; });
    expect(looked).toBe(1);
    expect(db.calls[0].args.p_asn).toBe(1234);
  });
  it('lookup timeout still finalizes', async () => {
    const db = fakeDb(null);
    await finalizeOpen(db, { openId: 10, ip: '9.9.9.9', ipHash: 'H', isOwner: false }, async () => ({ asn: null, org: null, country: null, city: null }));
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].args.p_asn).toBeNull();
  });
  it('owners are never looked up', async () => {
    const db = fakeDb(null);
    let looked = 0;
    await finalizeOpen(db, { openId: 11, ip: '9.9.9.9', ipHash: 'H', isOwner: true }, async () => { looked++; return MS; });
    expect(looked).toBe(0);
    expect(db.calls).toHaveLength(1);
  });
  it('a database failure never throws', async () => {
    const db = fakeDb(null, null, true);
    await expect(finalizeOpen(db, { openId: 12, ip: null, ipHash: null, isOwner: false }, async () => MS)).resolves.toBeNull();
  });
});
