// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClientBoardPage, { DetailModal } from '../ClientBoardPage';
import { saveBoardSession } from '../../lib/boardSession';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc, storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) }, functions: { invoke: vi.fn() } } }));
const item = { id: 'audit-draft', kind: 'post', stage: 'review', title: 'Audit fixture', body: 'Original copy.' } as const;
const board = { company_name: 'SwishDM', domain: 'swishdm.com', skin: 'desk', review_mode: true, queue: [item], calendar: { start: null, weeks: 0, items: [] } } as any;
beforeEach(() => {
 localStorage.clear();
 vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
 window.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); rpc.mockReset(); });
it.each([true, false])('attributes keyed-URL edits to a session when present (%s), with legacy fallback', async (signedIn) => {
 if (signedIn) saveBoardSession('swishdm-live', { token: 'member-session', email: 'teammate@example.invalid', expires_at: '2099-01-01T00:00:00Z' });
 rpc.mockImplementation(async (name: string) => {
  if (name === 'get_client_board') return { data: { mode: 'live', board: structuredClone(board) }, error: null };
  return { data: { ok: true, items: [], log: [], approved: [] }, error: null };
 });
 const r = render(<MemoryRouter initialEntries={['/client/swishdm-live?k=shared-link&post=audit-draft']}><Routes><Route path="/client/:slug" element={<ClientBoardPage />} /></Routes></MemoryRouter>);
 const dialog = await r.findByRole('dialog');
 fireEvent.click(Array.from(dialog.querySelectorAll('button')).find(b => b.textContent === 'Edit')!);
 fireEvent.change(r.getByRole('textbox', { name: 'Post copy' }), { target: { value: 'Teammate change.' } });
 fireEvent.click(r.getByRole('button', { name: 'Save edit' }));
 const fn = signedIn ? 'client_board_edit_draft_v2' : 'client_board_edit_draft';
 await waitFor(() => expect(rpc).toHaveBeenCalledWith(fn, expect.objectContaining(signedIn ? { p_session: 'member-session', p_body: 'Teammate change.' } : { p_token: 'shared-link', p_body: 'Teammate change.' })));
 expect(rpc.mock.calls.filter(([name]) => name === (signedIn ? 'client_board_edit_draft' : 'client_board_edit_draft_v2'))).toHaveLength(0);
 expect(rpc).toHaveBeenCalledWith(signedIn ? 'client_board_draft_history_v2' : 'client_board_draft_history', expect.objectContaining(signedIn ? { p_session: 'member-session' } : { p_token: 'shared-link' }));
});
it('reloads persisted history after a successful edit while the drawer remains open', async () => {
 const fetchHistory = vi.fn().mockResolvedValue([]);
 const editDraft = vi.fn(async () => {
  fetchHistory.mockResolvedValue([{ action: 'edit_copy', at: '2026-10-16T12:00:00Z', by: 'teammate@example.invalid', before: 'Original copy.', after: 'Saved on server.' }]);
  return { ok: true };
 });
 const r = render(<DetailModal item={{ ...item } as any} board={board} accent="#FC5B06" stage="review" onClose={() => {}} onApprove={() => {}} isLive reviewMode initialEditing editDraft={editDraft} fetchHistory={fetchHistory} act={async () => ({ ok: true })} />);
 await waitFor(() => expect(fetchHistory).toHaveBeenCalledTimes(1));
 fireEvent.change(r.getByRole('textbox', { name: 'Post copy' }), { target: { value: 'Saved on server.' } });
 fireEvent.click(r.getByRole('button', { name: 'Save edit' }));
 await r.findByText('History');
 expect(fetchHistory).toHaveBeenCalledTimes(2);
 fireEvent.click(r.getByRole('button', { name: 'see what changed' }));
 expect(r.container.textContent).toContain('Saved on server.');
});
it('does not invent a history entry or refetch after a rejected edit', async () => {
 const fetchHistory = vi.fn().mockResolvedValue([]);
 const r = render(<DetailModal item={{ ...item } as any} board={board} accent="#FC5B06" stage="review" onClose={() => {}} onApprove={() => {}} isLive reviewMode initialEditing editDraft={async () => ({ ok: false, error: 'changed_meanwhile' })} fetchHistory={fetchHistory} act={async () => ({ ok: true })} />);
 await waitFor(() => expect(fetchHistory).toHaveBeenCalledTimes(1));
 fireEvent.change(r.getByRole('textbox', { name: 'Post copy' }), { target: { value: 'Rejected change.' } });
 fireEvent.click(r.getByRole('button', { name: 'Save edit' }));
 await r.findByText(/This post was updated while you were editing/);
 expect(fetchHistory).toHaveBeenCalledTimes(1);
 expect(r.queryByText('History')).toBeNull();
});
