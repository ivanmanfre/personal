// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ScheduleWeek from './ScheduleWeek';
import { setBoardZone } from '../ClientBoardPage';
import type { QueueItem } from '../ClientBoardPage';

afterEach(() => { cleanup(); vi.useRealTimers(); });
const ready = { id: 'ready', kind: 'post', stage: 'review', body: 'Ready body', hook: 'Ready replacement' } as QueueItem;
const scheduled = { ...ready, id: 'scheduled', hook: 'Thursday post', publish_date: '2026-10-08', scheduled_at: '2026-10-08T16:00:00Z' };
function setup(queue: QueueItem[] = [scheduled], onAdd = vi.fn().mockResolvedValue({ ok: true })) {
  vi.setSystemTime(new Date('2026-10-07T16:00:00Z'));
  setBoardZone('risedtc-com');
  const props = { queue, ready: [ready], onAdd, onOpen: vi.fn() };
  return { ...render(<ScheduleWeek {...props} />), props };
}
describe('Schedule week', () => {
  it('keeps the same seven days after the last post is cleared and lets that day be filled', async () => {
    const r = setup();
    const dates = () => [...r.container.querySelectorAll('[data-week-day]')].map(el => el.getAttribute('data-week-day'));
    expect(dates()).toEqual(['2026-10-05','2026-10-06','2026-10-07','2026-10-08','2026-10-09','2026-10-10','2026-10-11']);
    fireEvent.click(r.container.querySelector('[data-week-day="2026-10-08"]')!);
    expect(r.props.onOpen).toHaveBeenCalledWith(scheduled);
    r.rerender(<ScheduleWeek {...r.props} queue={[]} ready={[scheduled, ready].map(q => ({ ...q, publish_date: undefined, scheduled_at: undefined }))} />);
    expect(dates()).toHaveLength(7);
    expect(r.container.querySelector('[data-week-day="2026-10-08"]')?.textContent).toContain('Add');
    fireEvent.click(r.getByRole('button', { name: 'Add Ready replacement' }));
    await waitFor(() => expect(r.props.onAdd).toHaveBeenCalledWith('ready', '2026-10-08'));
  });
  it('shows an empty week even with no scheduled posts', () => {
    const r = setup([]);
    expect(r.container.querySelectorAll('[data-week-day]')).toHaveLength(7);
    fireEvent.click(r.container.querySelector('[data-week-day="2026-10-09"]')!);
    expect(r.getByRole('button', { name: 'Add Ready replacement' })).toBeTruthy();
  });
  it('shows an add failure and keeps the picker open for retry', async () => {
    const r = setup([], vi.fn().mockResolvedValue({ ok: false, error: 'Could not schedule this post' }));
    fireEvent.click(r.container.querySelector('[data-week-day="2026-10-08"]')!);
    fireEvent.click(r.getByRole('button', { name: 'Add Ready replacement' }));
    await waitFor(() => expect(r.getByRole('alert').textContent).toContain('Could not schedule this post'));
    expect(r.getByRole('button', { name: 'Add Ready replacement' })).toBeTruthy();
  });
  it('navigates whole weeks without depending on scheduled content', () => {
    const r = setup([]);
    fireEvent.click(r.getByRole('button', { name: 'Next week' }));
    expect(r.container.querySelector('[data-week-day]')?.getAttribute('data-week-day')).toBe('2026-10-12');
    fireEvent.click(r.getByRole('button', { name: 'This week' }));
    expect(r.container.querySelector('[data-week-day]')?.getAttribute('data-week-day')).toBe('2026-10-05');
  });
  it('uses the board timezone for a late-night slot and prevents adding to past dates', () => {
    const r = setup([{ ...scheduled, scheduled_at: '2026-10-09T02:00:00Z', publish_date: '2026-10-09' }]);
    expect(r.container.querySelector('[data-week-day="2026-10-08"]')?.textContent).toContain('Thursday post');
    fireEvent.click(r.container.querySelector('[data-week-day="2026-10-05"]')!);
    expect(r.queryByRole('button', { name: 'Add Ready replacement' })).toBeNull();
  });
});
