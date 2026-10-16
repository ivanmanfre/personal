import { expect, it, vi } from 'vitest';
import { handleDelete } from './handler';
const req = (extra = {}) => new Request('https://example.invalid/delete', { method: 'POST', body: JSON.stringify({ slug: 'swishdm-live', name: 'photo.png', session: 'fixture', ...extra }) });
it('does not delete if durable audit start fails', async () => {
 const remove = vi.fn(); const rpc = vi.fn().mockResolvedValue({ data: null, error: true });
 expect((await (await handleDelete(req(), { rpc, remove })).json()).ok).toBe(false); expect(remove).not.toHaveBeenCalled();
});
it('preserves the actual live CORS headers', async () => {
 const r = await handleDelete(new Request('https://example.invalid', { method: 'OPTIONS' }), { rpc: vi.fn(), remove: vi.fn() });
 expect(r.headers.get('Access-Control-Allow-Headers')).toContain('x-client-info'); expect(r.headers.get('Access-Control-Allow-Headers')).toContain('x-supabase-api-version');
});
it('leaves a durable attempt and reports uncertainty if deletion completed but final log fails', async () => {
 const rpc = vi.fn().mockResolvedValueOnce({ data: { ok: true, operation_id: 'op' }, error: null }).mockResolvedValueOnce({ data: null, error: true });
 const remove = vi.fn().mockResolvedValue({ data: [{}], error: null });
 expect(await (await handleDelete(req(), { rpc, remove })).json()).toMatchObject({ ok: false, error: expect.stringContaining('unconfirmed') });
 expect(remove).toHaveBeenCalledWith('swishdm-live/photo.png');
 expect(rpc).toHaveBeenLastCalledWith('board_photo_operation', expect.objectContaining({ p_phase: 'completed', p_operation_id: 'op' }));
});
it('logs a failed storage operation and never reports successful deletion', async () => {
 const rpc = vi.fn().mockResolvedValue({ data: { ok: true, operation_id: 'op' }, error: null });
 const r = await handleDelete(req(), { rpc, remove: async () => ({ data: null, error: true }) });
 expect((await r.json()).ok).toBe(false); expect(rpc).toHaveBeenLastCalledWith('board_photo_operation', expect.objectContaining({ p_phase: 'failed' }));
});
it('rejects traversal before any RPC or storage call', async () => {
 const rpc = vi.fn(); const remove = vi.fn(); await handleDelete(req({ name: '../other/photo.png' }), { rpc, remove }); expect(rpc).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled();
});
it('uses signed-in identity and confirms completion before success', async () => {
 const rpc = vi.fn().mockResolvedValue({ data: { ok: true, operation_id: 'op' }, error: null });
 expect(await (await handleDelete(req({ token: 'shared' }), { rpc, remove: async () => ({ data: [{}], error: null }) })).json()).toEqual({ ok: true, deleted: 1 });
 expect(rpc).toHaveBeenNthCalledWith(1, 'board_photo_operation', expect.objectContaining({ p_session: 'fixture', p_token: null }));
});
