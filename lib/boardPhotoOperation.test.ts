import { expect, it, vi } from 'vitest';
import { uploadBoardFile } from './boardPhotoOperation';
const args = { p_slug: 'swishdm-live', p_path: 'swishdm-live/photo.png', p_session: 'fixture', p_token: null };
it('blocks storage when the durable intent cannot be saved', async () => {
 const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'no log' } }); const upload = vi.fn();
 expect((await uploadBoardFile(rpc, upload, args)).ok).toBe(false); expect(upload).not.toHaveBeenCalled();
});
it('does not claim success if storage succeeded but completion logging failed', async () => {
 const rpc = vi.fn().mockResolvedValueOnce({ data: { ok: true, operation_id: 'op' }, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'no log' } });
 expect(await uploadBoardFile(rpc, async () => ({ error: null }), args)).toMatchObject({ ok: false, error: expect.stringContaining('File uploaded') });
 expect(rpc).toHaveBeenLastCalledWith('board_photo_operation', expect.objectContaining({ p_operation_id: 'op', p_phase: 'completed' }));
});
it('records storage failures and reports failure, without retrying or deleting another object', async () => {
 const rpc = vi.fn().mockResolvedValue({ data: { ok: true, operation_id: 'op' }, error: null });
 expect(await uploadBoardFile(rpc, async () => ({ error: { message: 'Storage refused' } }), args)).toEqual({ ok: false, error: 'Storage refused' });
 expect(rpc).toHaveBeenLastCalledWith('board_photo_operation', expect.objectContaining({ p_phase: 'failed' }));
});
it('confirms success only after both storage and completion receipt', async () => {
 const order: string[] = []; const rpc = vi.fn(async (_fn, a) => { order.push(a.p_phase); return { data: { ok: true, operation_id: 'op' }, error: null }; });
 expect(await uploadBoardFile(rpc, async () => { order.push('storage'); return { error: null }; }, args)).toEqual({ ok: true });
 expect(order).toEqual(['started', 'storage', 'completed']);
});
