// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ClientBoardPage from '../ClientBoardPage';
import { saveBoardSession } from '../../lib/boardSession';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc, storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) } } }));
vi.mock('./DeskWeekSurface', () => ({ weekWindowCount: () => 1, default: (p: any) => <><button onClick={() => p.onSkip('slot')}>Remove fixture post</button><button onClick={() => p.onLeaveDayEmpty('slot')}>Hold fixture day</button><p>Removed state: {p.skips.slot ? 'yes' : 'no'}</p></> }));
beforeEach(() => {
 localStorage.clear(); saveBoardSession('swishdm-live', { token: 'member', email: 'fixture@example.invalid', expires_at: '2099-01-01T00:00:00Z' });
 window.scrollTo = vi.fn(); vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); rpc.mockReset(); });
const mount = () => render(<MemoryRouter initialEntries={['/client/swishdm-live?k=shared']}><Routes><Route path="/client/:slug" element={<ClientBoardPage />} /></Routes></MemoryRouter>);
function replies(ok: boolean) { rpc.mockImplementation(async name => ({ data: name === 'get_client_board' ? { mode: 'live', board: { company_name: 'SwishDM', skin: 'desk', theme: 'light', queue: [], calendar: { start: null, weeks: 0, items: [] } } } : name === 'board_slot_notes' ? { ok } : { ok: true, items: [], log: [] }, error: null })); }
it('keeps the prior slot state and shows an error if audit persistence fails', async () => {
 replies(false); const r = mount(); fireEvent.click(await r.findByRole('button', { name: 'Remove fixture post' }));
 await r.findByRole('alert'); expect(r.getByText('Removed state: no')).toBeTruthy();
 expect(rpc).toHaveBeenCalledWith('board_slot_notes', expect.objectContaining({ p_session: 'member', p_token: null }));
});
it('persists a composite hold as one batch before changing the local state', async () => {
 replies(true); const r = mount(); fireEvent.click(await r.findByRole('button', { name: 'Hold fixture day' }));
 await waitFor(() => expect(r.getByText('Removed state: yes')).toBeTruthy());
 expect(rpc).toHaveBeenCalledWith('board_slot_notes', expect.objectContaining({ p_events: [{ ref: 'slot', payload: { event: 'post_removed' } }, { ref: 'slot', payload: { event: 'day_left_empty' } }] }));
 expect(rpc.mock.calls.filter(([name]) => name === 'client_board_action_v2')).toHaveLength(0);
});
