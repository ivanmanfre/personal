// Stores one open. Tolerates the old schema: during a rollback the `view` column (db/303) may be gone while this
// function is still deployed, so an "unknown column view" error retries once without it. Never pretends: a failed
// insert returns ok false, and the log line carries the error code and message only (never the row, never an IP).

export type OpenRow = {
  company_slug: string; is_owner: boolean; device_type: string | null; referrer_host: string | null;
  ip_hash: string | null; user_agent: string | null; view: 'main' | 'team';
};
type DbError = { code?: string; message?: string } | null | undefined;
export type InsertDb = {
  from: (t: string) => { insert: (row: Record<string, unknown>) => { select: (c: string) => { single: () => PromiseLike<{ data: unknown; error?: DbError }> } } };
};
export type InsertResult = { ok: boolean; openId: number | null; legacy: boolean };

// PostgREST: PGRST204 "Could not find the 'view' column of 'scan_opens' in the schema cache"; Postgres: 42703.
export function isMissingViewColumn(e: DbError): boolean {
  if (!e) return false;
  const msg = String(e.message ?? '');
  return (e.code === 'PGRST204' || e.code === '42703') && /\bview\b/.test(msg);
}

export async function insertOpen(db: InsertDb, row: OpenRow, log: (line: string) => void = (l) => console.error(l)): Promise<InsertResult> {
  const attempt = async (r: Record<string, unknown>) => {
    try {
      const { data, error } = await db.from('scan_opens').insert(r).select('id').single();
      const id = (data as { id?: unknown } | null)?.id;
      return { id: typeof id === 'number' ? id : null, error: error ?? null };
    } catch (e) {
      return { id: null, error: { message: e instanceof Error ? e.message : 'insert threw' } as DbError };
    }
  };
  let res = await attempt(row);
  let legacy = false;
  if (res.id === null && isMissingViewColumn(res.error)) {
    const { view: _view, ...old } = row;
    legacy = true;
    res = await attempt(old);
  }
  if (res.id === null) {
    log(`scan-open insert failed${legacy ? ' (old schema retry)' : ''}: ${res.error?.code ?? 'no_code'} ${String(res.error?.message ?? 'no id returned').slice(0, 200)}`);
    return { ok: false, openId: null, legacy };
  }
  return { ok: true, openId: res.id, legacy };
}
