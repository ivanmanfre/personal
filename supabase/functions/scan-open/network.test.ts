import { describe, expect, it } from 'vitest';
import { lookupNetwork } from './network';

describe('lookupNetwork', () => {
  it('reads asn and org', async () => expect(await lookupNetwork('9.9.9.9', async () => new Response(JSON.stringify({ success: true, country_code: 'US', city: 'Boydton', connection: { asn: 8075, org: 'Microsoft Limited' } })))).toEqual({ asn: 8075, org: 'Microsoft Limited', country: 'US', city: 'Boydton' }));
  it('falls back to the isp name', async () => expect((await lookupNetwork('9.9.9.9', async () => new Response(JSON.stringify({ success: true, connection: { asn: 5089, isp: 'Virgin Media' } })))).org).toBe('Virgin Media'));
  it('failed lookup is all nulls', async () => expect(await lookupNetwork('9.9.9.9', async () => new Response('{"success":false}'))).toEqual({ asn: null, org: null, country: null, city: null }));
  it('lookup timeout still finalizes', async () => { const t0 = Date.now(); const r = await lookupNetwork('9.9.9.9', () => new Promise(() => {})); expect(r.asn).toBeNull(); expect(Date.now() - t0).toBeLessThan(2000); });
  it('thrown fetch is all nulls', async () => expect((await lookupNetwork('9.9.9.9', async () => { throw new Error('x'); })).org).toBeNull());
  it('a non-numeric asn is null', async () => expect((await lookupNetwork('9.9.9.9', async () => new Response(JSON.stringify({ success: true, connection: { asn: 'AS8075', org: 'Microsoft' } })))).asn).toBeNull());
});
