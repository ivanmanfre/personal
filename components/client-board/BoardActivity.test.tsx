// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import BoardActivity from './BoardActivity';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }));
afterEach(() => { cleanup(); rpc.mockReset(); });
const open = (r: ReturnType<typeof render>) => { const details = r.container.querySelector('details')!; details.open = true; fireEvent(details, new Event('toggle')); };
it('loads board-wide changes on demand, uses member identity, and exposes exact before/after', async () => {
 rpc.mockResolvedValue({ data: { ok: true, items: [{ id: '1', action: 'team_role', ref: 'member@example.invalid', at: '2026-10-16T10:00:00Z', by: 'admin@example.invalid', before: { role: 'viewer' }, after: { role: 'approver' } }] }, error: null });
 const r = render(<BoardActivity slug="swishdm-live" session="fixture-session" token="shared" />); expect(rpc).not.toHaveBeenCalled(); open(r);
 await r.findByText('Changed a team role'); expect(rpc).toHaveBeenCalledWith('board_activity', { p_slug: 'swishdm-live', p_session: 'fixture-session', p_token: null });
 expect(r.container.textContent).toContain('admin@example.invalid');
 fireEvent.click(r.getByText('See what changed')); expect(r.container.textContent).toContain('"viewer"'); expect(r.container.textContent).toContain('"approver"');
});
it('keeps unfinished and failed file operations distinct from success', async () => {
 rpc.mockResolvedValue({ data: { ok: true, items: [{ id: '1', action: 'photo_operation', operation: 'delete', phase: 'started', at: '2026-10-16T10:00:00Z', by: 'board link' }] }, error: null });
 const r = render(<BoardActivity slug="swishdm-live" token="shared" />); open(r); await r.findByText('File deletion: started, completion unconfirmed');
 expect(r.container.textContent).not.toContain('Deleted a photo');
});
it('surfaces read failures instead of claiming there are no changes', async () => {
 rpc.mockResolvedValue({ data: null, error: { message: 'No permission' } }); const r = render(<BoardActivity slug="swishdm-live" token="shared" />); open(r);
 await r.findByRole('alert'); expect(r.queryByText('No recorded changes yet.')).toBeNull();
});
it('requests earlier rows using the server timestamp and UUID cursor', async () => {
 const items = Array.from({ length: 50 }, (_, i) => ({ id: String(i), action: 'comment', at: '2026-10-16T10:00:00Z', by: 'fixture', text: `comment-${i}` }));
 rpc.mockResolvedValueOnce({ data: { ok: true, items }, error: null }).mockResolvedValueOnce({ data: { ok: true, items: [] }, error: null });
 const r = render(<BoardActivity slug="swishdm-live" session="fixture" />); open(r); fireEvent.click(await r.findByRole('button', { name: 'Earlier changes' }));
 await waitFor(() => expect(rpc).toHaveBeenLastCalledWith('board_activity', expect.objectContaining({ p_before_at: items[49].at, p_before_id: '49' })));
});

it('names the affected post and retains the raw ref for unknown legacy targets', async () => {
 rpc.mockResolvedValue({ data: { ok: true, items: [
  { id: 'known', action: 'edit_title', ref: 'draft-uuid', title: 'Getting cited is the easy part', at: '2026-10-16T10:00:00Z', by: 'member@example.invalid' },
  { id: 'legacy', action: 'approve', ref: 'legacy-draft-uuid', title: null, at: '2026-10-16T09:00:00Z', by: 'board link' },
 ] }, error: null });
 const r = render(<BoardActivity slug="swishdm-live" session="fixture" />); open(r);
 await r.findByText('Getting cited is the easy part');
 expect(r.getByText('legacy-draft-uuid')).toBeTruthy();
 expect(r.queryByText('draft-uuid')).toBeNull();
});

it('distinguishes operator buffer placement from client approval and names provenance repairs', async () => {
 rpc.mockResolvedValue({ data: { ok: true, items: [
  { id: 'buffer', action: 'operator_buffer_approve', at: '2026-10-16T10:00:00Z', by: 'operator@example.invalid' },
  { id: 'source', action: 'source_provenance_verified', at: '2026-10-16T09:00:00Z', by: 'Content team / system' },
 ] }, error: null });
 const r = render(<BoardActivity slug="swishdm-live" session="fixture" />); open(r);
 await r.findByText('Sent a draft to client review');
 expect(r.getByText('Verified a post source')).toBeTruthy();
 expect(r.queryByText('Approved a post')).toBeNull();
});
