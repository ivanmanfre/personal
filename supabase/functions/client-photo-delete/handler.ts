export const CORS = {
  'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // Preserve the live browser preflight fix.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Max-Age': '86400', 'Content-Type': 'application/json',
};
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: CORS });
type Result = { data: any; error: any };
type Api = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<Result>;
  remove: (path: string) => PromiseLike<Result>;
};
export async function handleDelete(req: Request, api: Api): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return reply({ ok: false, error: 'POST only' }, 405);
  let body: any;
  try { body = await req.json(); } catch { return reply({ ok: false, error: 'bad json' }, 400); }
  if (!body || typeof body.slug !== 'string' || typeof body.name !== 'string' || !body.slug || !body.name || body.name.includes('/') || body.name.includes('..') || body.slug.includes('/')) return reply({ ok: false, error: 'bad_name' }, 400);
  const args = { p_slug: body.slug, p_path: `${body.slug}/${body.name}`, p_operation: 'delete', p_session: body.session || null, p_token: body.session ? null : (body.token || null) };
  let operationId: string | undefined;
  try {
    const start = await api.rpc('board_photo_operation', { ...args, p_phase: 'started' });
    if (start.error || !start.data?.ok || !start.data.operation_id) return reply({ ok: false, error: 'Delete did not start: its activity record could not be saved.' });
    operationId = start.data.operation_id;
    let removed: Result;
    try { removed = await api.remove(args.p_path); } catch { removed = { data: null, error: true }; }
    const phase = removed.error ? 'failed' : 'completed';
    const finish = await api.rpc('board_photo_operation', { ...args, p_phase: phase, p_operation_id: operationId });
    if (finish.error || !finish.data?.ok) return reply({ ok: false, error: 'Deletion status is unconfirmed. Activity contains the attempt; refresh before retrying.', operation_id: operationId });
    if (removed.error) return reply({ ok: false, error: 'Storage did not confirm deletion. The failed attempt is in Activity.' });
    return reply({ ok: true, deleted: Array.isArray(removed.data) ? removed.data.length : 0 });
  } catch {
    return reply({ ok: false, error: operationId ? 'Deletion status is unconfirmed. Activity contains the attempt; refresh before retrying.' : 'Delete did not start: its activity record could not be saved.' });
  }
}
