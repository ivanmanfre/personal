// @vitest-environment jsdom
// Round-1 review reproducer (reviewOwner.test.ts), ported to assert the CORRECT behaviour (finding 9):
// an owner open (?me=1, or the edge function answering is_owner) never starts page-event collection.
import { afterEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('./dashboardAuth', () => ({ isAuthenticated: () => false }));

async function run(search: string, data: Record<string, unknown>) {
  vi.resetModules();
  invoke.mockReset();
  try { localStorage.clear(); } catch { /* ignore */ }
  Object.defineProperty(window, 'location', { value: { hostname: 'inboundonsteroids.com', search }, configurable: true });
  document.body.innerHTML = '<a href="https://calendly.com/x">Book</a>';
  invoke.mockResolvedValue({ data });
  const { trackScanOpen } = await import('./scanOpenTracker');
  const { trackOpenWithEvents, startScanEvents } = await import('./scanEvents');
  const sent: unknown[] = [];
  const stop = trackOpenWithEvents('owner-case', 'main', { track: trackScanOpen, start: (root, slug, id) => startScanEvents(root, slug, id, (b) => sent.push(b)) });
  await new Promise((r) => setTimeout(r, 0));
  const a = document.querySelector('a')!;
  a.addEventListener('click', (e) => e.preventDefault());
  a.click();
  stop();
  return { sent, body: invoke.mock.calls[0]?.[1]?.body };
}

describe('owner opens never send page events', () => {
  afterEach(() => { document.body.innerHTML = ''; });
  it('?me=1 with the edge answering is_owner: the open is recorded as the owner, no events', async () => {
    const { sent, body } = await run('?me=1', { ok: true, is_owner: true, open_id: 4242 });
    expect(body).toMatchObject({ company_slug: 'owner-case', owner_flag: true });
    expect(sent).toEqual([]);
  });
  it('an owner IP the server knows (is_owner true, no ?me=1): no events', async () => {
    const { sent } = await run('', { ok: true, is_owner: true, open_id: 4243 });
    expect(sent).toEqual([]);
  });
  it('a prospect open still sends its booking click', async () => {
    const { sent } = await run('?me=0', { ok: true, is_owner: false, open_id: 4244 });
    expect(sent).toHaveLength(1);
  });
});
