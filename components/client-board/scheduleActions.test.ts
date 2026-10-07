import { describe, it, expect, vi } from 'vitest';
import { swapScheduledPost } from './scheduleActions';

const slot = '2026-10-08T16:35:00Z';
describe('scheduled post swap', () => {
  it('moves the exact slot to the replacement, returning the original to ready posts', async () => {
    const write = vi.fn().mockResolvedValue({ ok: true });
    expect(await swapScheduledPost('old', 'new', slot, write)).toEqual({ ok: true });
    expect(write.mock.calls).toEqual([['old', null], ['new', slot]]);
  });
  it('leaves the replacement alone when clearing fails', async () => {
    const write = vi.fn().mockResolvedValue({ ok: false, error: 'offline' });
    expect((await swapScheduledPost('old', 'new', slot, write)).ok).toBe(false);
    expect(write.mock.calls).toEqual([['old', null]]);
  });
  it('does not restore when the replacement may have committed but its response was lost', async () => {
    const schedules = new Map([['old', slot]]);
    const write = vi.fn(async (id: string, at: string | null) => {
      if (at) schedules.set(id, at); else schedules.delete(id);
      return id === 'new' ? { ok: false, uncertain: true } : { ok: true };
    });
    expect((await swapScheduledPost('old', 'new', slot, write)).error).toContain('check both posts');
    expect([...schedules]).toEqual([['new', slot]]);
    expect(write).toHaveBeenCalledTimes(2);
  });
  it('restores the original slot if the replacement is rejected', async () => {
    const write = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
    expect((await swapScheduledPost('old', 'new', slot, write)).error).toContain('original post is still scheduled');
    expect(write.mock.calls).toEqual([['old', null], ['new', slot], ['old', slot]]);
  });
  it('reports a failed restore without claiming the original is scheduled', async () => {
    const write = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValue({ ok: false });
    expect((await swapScheduledPost('old', 'new', slot, write)).error).toContain('check both posts');
  });
});
