// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import ClientBoardPage, { DetailModal } from '../ClientBoardPage';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: {
  rpc,
  storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
  functions: { invoke: async () => ({ data: null, error: null }) },
} }));

const queue = [
  { id: 'unsigned', kind: 'post', stage: 'scheduled', title: 'Unsigned draft', hook: 'Unsigned draft', body: 'Unsigned copy.', scheduled_at: '2026-10-21T08:00:00Z', publish_date: '2026-10-21' },
  { id: 'signed', kind: 'post', stage: 'review', title: 'Signed draft', hook: 'Signed draft', body: 'Signed copy.', scheduled_at: '2026-10-22T08:00:00Z', publish_date: '2026-10-22' },
];
const approvedMarks = (container: HTMLElement) => Array.from(container.querySelectorAll('.cb-batch-state, [data-review-actions] span[role="status"]')).filter(el => el.textContent?.includes('Approved'));
const board = { company_name: 'ARCH', domain: 'arch.agency', skin: 'desk', review_mode: true,
  founder: { name: 'Davorin Šmit', first_name: 'Davorin' }, queue, calendar: { start: '2026-10-19', weeks: 2, items: [] } };

function SwitchClient() { const go = useNavigate(); return <button onClick={() => go('/client/other?k=test&cat=all&skin=desk')}>Switch client</button>; }
function mount() {
  return render(<MemoryRouter initialEntries={['/client/arch-agency?k=test&cat=all&skin=desk']}>
    <SwitchClient /><Routes><Route path="/client/:slug" element={<ClientBoardPage />} /></Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('cb-approvals-arch-agency', JSON.stringify({ unsigned: 'scheduled', signed: 'scheduled' }));
  localStorage.setItem('client-board-view', 'feed');
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} })));
  window.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); rpc.mockReset(); });

describe('live client approval confirmation', () => {
  it('does not show cached approvals while the server check is pending or failed', async () => {
    let finish!: (result: unknown) => void;
    const pending = new Promise(resolve => { finish = resolve; });
    rpc.mockImplementation(async (name: string) => {
      if (name === 'get_client_board') return { data: { mode: 'live', board }, error: null };
      if (name === 'client_board_slot_state') return pending;
      if (name === 'client_board_schedule') return { data: { ok: true, items: queue.map(q => ({ ...q, status: q.stage })) }, error: null };
      return { data: { ok: true, items: [], log: [] }, error: null };
    });
    const { container } = mount();
    await waitFor(() => expect(container.querySelectorAll('[data-batch-review-card]')).toHaveLength(2));
    expect(approvedMarks(container)).toHaveLength(0);
    expect(container.textContent).not.toContain('Goes out');
    await act(async () => { finish({ data: null, error: { message: 'Approval check failed' } }); await pending; });
    expect(approvedMarks(container)).toHaveLength(0);
  });

  it('shows only server-confirmed sign-offs and holds dated unsigned cards', async () => {
    rpc.mockImplementation(async (name: string) => {
      if (name === 'get_client_board') return { data: { mode: 'live', board }, error: null };
      if (name === 'client_board_slot_state') return { data: { ok: true, approved: ['signed'], removed: [], replacements: [], left_empty: [] }, error: null };
      if (name === 'client_board_schedule') return { data: { ok: true, items: queue.map(q => ({ ...q, status: q.stage })) }, error: null };
      return { data: { ok: true, items: [], log: [] }, error: null };
    });
    const { container } = mount();
    await waitFor(() => expect(approvedMarks(container)).toHaveLength(1));
    const unsigned = Array.from(container.querySelectorAll('[data-batch-review-card]')).find(c => c.textContent?.includes('Unsigned copy.'));
    const signed = Array.from(container.querySelectorAll('[data-batch-review-card]')).find(c => c.textContent?.includes('Signed copy.'));
    expect(unsigned?.textContent).toContain('Awaiting approval');
    expect(unsigned?.textContent).not.toContain('Goes out');
    expect(signed?.textContent).toContain('Goes out');
    expect(container.textContent).toContain('1 awaiting approval · 1 approved');
    expect(signed?.textContent).toContain('Approved · Scheduled');
  });
  it('waits for a successful approval write even when the initial read failed', async () => {
    let saveOk = false;
    rpc.mockImplementation(async (name: string) => {
      if (name === 'get_client_board') return { data: { mode: 'live', board }, error: null };
      if (name === 'client_board_slot_state') return { data: null, error: { message: 'Read failed' } };
      if (name === 'client_board_action') return { data: { ok: saveOk, error: 'Save failed' }, error: null };
      if (name === 'client_board_schedule') return { data: { ok: true, items: queue.map(q => ({ ...q, status: q.stage })) }, error: null };
      return { data: { ok: true, items: [], log: [] }, error: null };
    });
    const r = mount();
    fireEvent.click(await r.findByRole('button', { name: 'Open review: Signed draft' }));
    const approve = await r.findByRole('button', { name: 'Approve ✓' });
    fireEvent.click(approve);
    await r.findByText(/Approval did not save/);
    expect(approvedMarks(r.container)).toHaveLength(0);
    saveOk = true;
    fireEvent.click(approve);
    await waitFor(() => expect(approvedMarks(r.container)).toHaveLength(1));
  });

  it('keeps approval state separate when navigating between clients', async () => {
    localStorage.setItem('cb-approvals-other', '{}');
    rpc.mockImplementation(async (name: string, params: {p_slug?: string}) => {
      if (name === 'get_client_board') return { data: { mode: 'live', board }, error: null };
      if (name === 'client_board_slot_state') return { data: { ok: true, approved: params.p_slug === 'other' ? [] : ['signed', 'unsigned'] }, error: null };
      return { data: { ok: true, items: [], log: [] }, error: null };
    });
    const r = mount();
    await waitFor(() => expect(approvedMarks(r.container)).toHaveLength(2));
    fireEvent.click(r.getByRole('button', { name: 'Switch client' }));
    await waitFor(() => expect(approvedMarks(r.container)).toHaveLength(0));
    expect(JSON.parse(localStorage.getItem('cb-approvals-other') || '{}')).toEqual({});
    expect(JSON.parse(localStorage.getItem('cb-approvals-arch-agency') || '{}')).toEqual({ unsigned: 'scheduled', signed: 'scheduled' });
  });

  it('does not promise publishing in the details of an unsigned scheduled draft', () => {
    const r = render(<DetailModal item={queue[0] as any} board={board as any} accent="#4f46e5" stage="scheduled"
      onClose={() => {}} onApprove={() => {}} isLive reviewMode approved={false} act={async () => ({ok:true})} />);
    expect(r.container.textContent).toContain('Awaiting approval');
    expect(r.container.textContent).toContain('stays on hold until you approve');
    expect(r.container.textContent).not.toContain('It publishes on its date');
  });

  it('loads approvals when the next live client enables review mode after its slot read', async () => {
    let finish!: (result: unknown) => void;
    const pending = new Promise(resolve => { finish = resolve; });
    rpc.mockImplementation(async (name: string, params: {p_slug?: string}) => {
      if (name === 'get_client_board') return params.p_slug === 'other' ? pending : { data: { mode: 'live', board: {...board, review_mode:false} }, error: null };
      if (name === 'client_board_slot_state') return { data: { ok: true, approved: ['signed'] }, error: null };
      return { data: { ok: true, items: [], log: [] }, error: null };
    });
    const r = mount();
    await waitFor(() => expect(r.container.querySelector('[data-skin]')).not.toBeNull());
    fireEvent.click(r.getByRole('button', { name: 'Switch client' }));
    await waitFor(() => expect(rpc.mock.calls.some(([name, args]) => name === 'client_board_slot_state' && args.p_slug === 'other')).toBe(true));
    await act(async () => { finish({data:{mode:'live',board},error:null}); await pending; });
    const dated = await r.findByRole('button', {name:/Dated posts/i});
    if (dated.getAttribute('aria-expanded') === 'false') fireEvent.click(dated);
    await waitFor(() => expect(approvedMarks(r.container)).toHaveLength(1));
  });

});
