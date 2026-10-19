// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import RiseScanRequests from './RiseScanRequests';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }));
afterEach(() => { cleanup(); rpc.mockReset(); });

const row = (over: Record<string, unknown>) => ({ id: 'r1', input_url: 'brand.com', domain: 'brand.com', company_name: null, status: 'queued', stage: null, message: 'Queued', scan_url: null, created_at: '2026-10-20T10:00:00Z', finished_at: null, ...over });

it('links only a scan that passed review; a hold never shows a link', async () => {
  rpc.mockResolvedValue({ data: { ok: true, requests: [
    row({ id: 'a', domain: 'ready.com', status: 'ready', scan_url: 'https://resources.risedtc.com/scan/ready-1/' }),
    row({ id: 'b', domain: 'held.com', status: 'held', scan_url: null }),
  ] }, error: null });
  const r = render(<RiseScanRequests slug="risedtc-com" session="s1" />);
  await r.findByText('ready.com');
  expect(rpc).toHaveBeenCalledWith('rise_scan_request_list', { p_slug: 'risedtc-com', p_session: 's1' });
  const links = r.getAllByText('Open scan →');
  expect(links).toHaveLength(1);
  expect(links[0].getAttribute('href')).toBe('https://resources.risedtc.com/scan/ready-1/');
  expect(r.container.textContent).toContain('Ivan is checking this one before it goes out');
});

it('submits the pasted URL with the session and shows server refusals in plain words', async () => {
  rpc.mockImplementation(async (name: string) => name === 'rise_scan_request_list'
    ? { data: { ok: true, requests: [] }, error: null }
    : { data: { ok: false, error: 'bad_url' }, error: null });
  const r = render(<RiseScanRequests slug="risedtc-com" session="s1" />);
  fireEvent.change(r.getByLabelText('Brand website or LinkedIn company page'), { target: { value: ' instagram ' } });
  fireEvent.click(r.getByText('Run scan'));
  await r.findByRole('alert');
  expect(rpc).toHaveBeenCalledWith('rise_scan_request_submit', { p_slug: 'risedtc-com', p_session: 's1', p_url: 'instagram' });
  expect(r.getByRole('alert').textContent).toContain('LinkedIn company page');
});

it('surfaces a failed list read instead of an empty list', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'down' } });
  const r = render(<RiseScanRequests slug="risedtc-com" session="s1" />);
  await waitFor(() => expect(r.getByRole('alert').textContent).toContain('could not load'));
});
