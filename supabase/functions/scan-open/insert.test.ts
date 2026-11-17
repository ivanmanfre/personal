import { describe, expect, it } from 'vitest';
import { insertOpen, isMissingViewColumn, type OpenRow } from './insert';

const ROW: OpenRow = { company_slug: 'acme', is_owner: false, device_type: 'mobile', referrer_host: null, ip_hash: 'H', user_agent: 'ua', view: 'main' };
type Resp = { data: unknown; error?: { code?: string; message?: string } | null } | 'throw';
function fakeDb(responses: Resp[]) {
  const rows: Record<string, unknown>[] = [];
  return {
    rows,
    from: (_t: string) => ({
      insert: (r: Record<string, unknown>) => ({
        select: (_c: string) => ({
          single: async () => {
            rows.push(r);
            const next = responses.shift() ?? { data: null, error: { message: 'unexpected' } };
            if (next === 'throw') throw new Error('socket hang up');
            return next;
          },
        }),
      }),
    }),
  };
}

describe('insertOpen (finding 5)', () => {
  it('stores the open and returns its id', async () => {
    const db = fakeDb([{ data: { id: 9 }, error: null }]);
    expect(await insertOpen(db, ROW, () => {})).toEqual({ ok: true, openId: 9, legacy: false });
    expect(db.rows[0]).toMatchObject({ view: 'main' });
  });
  it('on the old schema (no view column) retries once without it and keeps the open', async () => {
    const db = fakeDb([
      { data: null, error: { code: 'PGRST204', message: "Could not find the 'view' column of 'scan_opens' in the schema cache" } },
      { data: { id: 10 }, error: null },
    ]);
    expect(await insertOpen(db, ROW, () => {})).toEqual({ ok: true, openId: 10, legacy: true });
    expect(db.rows).toHaveLength(2);
    expect('view' in db.rows[1]).toBe(false);
    expect(db.rows[1]).toMatchObject({ company_slug: 'acme', ip_hash: 'H' });
  });
  it('a Postgres 42703 for view also retries', async () => {
    expect(isMissingViewColumn({ code: '42703', message: 'column "view" of relation "scan_opens" does not exist' })).toBe(true);
    expect(isMissingViewColumn({ code: '42703', message: 'column "foo" does not exist' })).toBe(false);
    expect(isMissingViewColumn({ code: '23505', message: 'duplicate key view' })).toBe(false);
  });
  it('never reports ok when the insert failed, and logs no row and no IP', async () => {
    const lines: string[] = [];
    const db = fakeDb([{ data: null, error: { code: '42501', message: 'permission denied for table scan_opens' } }]);
    expect(await insertOpen(db, ROW, (l) => lines.push(l))).toEqual({ ok: false, openId: null, legacy: false });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('42501');
    expect(lines[0]).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect(lines[0]).not.toContain('acme');
  });
  it('a failed retry is still a failure', async () => {
    const lines: string[] = [];
    const db = fakeDb([{ data: null, error: { code: 'PGRST204', message: "Could not find the 'view' column" } }, 'throw']);
    expect(await insertOpen(db, ROW, (l) => lines.push(l))).toEqual({ ok: false, openId: null, legacy: true });
    expect(lines[0]).toContain('old schema retry');
  });
  it('a thrown client error is a failure, never ok', async () => {
    expect((await insertOpen(fakeDb(['throw']), ROW, () => {})).ok).toBe(false);
  });
});
