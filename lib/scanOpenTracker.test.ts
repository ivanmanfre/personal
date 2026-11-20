import { beforeEach, describe, expect, it, vi } from 'vitest';

const invoke = vi.fn();
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } } }));
vi.mock('./dashboardAuth', () => ({ isAuthenticated: () => false }));

function setHost(host: string) {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).window = { location: { hostname: host, search: '' } };
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) };
  (globalThis as Record<string, unknown>).document = { referrer: 'https://www.linkedin.com/' };
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Mozilla/5.0 (iPhone) Mobile' }, configurable: true });
}

describe('trackScanOpen', () => {
  beforeEach(() => { vi.resetModules(); invoke.mockReset(); });
  it('deduplicates a view without suppressing the other view of the same scan', async () => {
    setHost('inboundonsteroids.com');
    invoke.mockResolvedValueOnce({ data: { open_id: 71 } }).mockResolvedValueOnce({ data: { open_id: 72 } });
    const { trackScanOpen } = await import('./scanOpenTracker');
    expect(await trackScanOpen('sample-scan')).toBe(71);
    expect(await trackScanOpen('sample-scan', 'team')).toBe(72);
    expect(await trackScanOpen('sample-scan', 'main')).toBe(71);
    expect(await trackScanOpen('sample-scan', 'team')).toBe(72);
    expect(invoke.mock.calls.map(([, request]) => request.body.view)).toEqual(['main', 'team']);
  });
  it('resolves to the open id and sends the view', async () => {
    setHost('inboundonsteroids.com');
    invoke.mockResolvedValue({ data: { ok: true, is_owner: false, open_id: 4242 } });
    const { trackScanOpen } = await import('./scanOpenTracker');
    expect(await trackScanOpen('acme-1', 'team')).toBe(4242);
    expect(invoke.mock.calls[0][1].body).toMatchObject({ company_slug: 'acme-1', view: 'team', device_type: 'mobile', referrer_host: 'www.linkedin.com' });
  });
  it('defaults to the main view and fires once per slug', async () => {
    setHost('inboundonsteroids.com');
    invoke.mockResolvedValue({ data: { ok: true, open_id: 1 } });
    const { trackScanOpen } = await import('./scanOpenTracker');
    expect(await trackScanOpen('acme-2')).toBe(1);
    expect(await trackScanOpen('acme-2')).toBe(1);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][1].body.view).toBe('main');
  });
  it('is null on failure, on preview hosts and without an id', async () => {
    setHost('inboundonsteroids.com');
    invoke.mockRejectedValue(new Error('net'));
    let m = await import('./scanOpenTracker');
    expect(await m.trackScanOpen('acme-3')).toBeNull();
    invoke.mockResolvedValue({ data: { ok: false } });
    expect(await m.trackScanOpen('acme-4')).toBeNull();
    vi.resetModules();
    setHost('localhost');
    m = await import('./scanOpenTracker');
    expect(await m.trackScanOpen('acme-5')).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
