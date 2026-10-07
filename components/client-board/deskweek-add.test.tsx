// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import DeskWeekSurface from './DeskWeekSurface';
import { setBoardZone, type Board, type QueueItem } from '../ClientBoardPage';
import { setBoardNight } from './perf-kit/night';
import { reportPeriods, REPORT_CONFIGS } from './report/reportModel';

const ready = { id: 'cleared', kind: 'post', stage: 'scheduled', hook: 'Cleared post', body: 'Ready copy' } as QueueItem;
const later = { ...ready, id: 'later', hook: 'Thursday post', publish_date: '2026-10-08', scheduled_at: '2026-10-08T16:00:00Z' };
const noop = () => {};
afterEach(() => { cleanup(); vi.useRealTimers(); setBoardNight(false); });
function setup(onScheduleToDay = vi.fn().mockResolvedValue({ ok: true }), queue = [ready, later]) {
  vi.setSystemTime(new Date('2026-10-07T16:00:00Z'));
  setBoardZone('risedtc-com'); setBoardNight(true);
  const cfg = REPORT_CONFIGS['risedtc-com'];
  const periods = reportPeriods(cfg, '2026-10-07');
  const board = { company_name: 'Test board', queue, calendar: { start: '2026-10-05', items: [] } } as Board;
  const report = { cfg, periods, period: periods[0], onPeriod: noop, payload: null, board: { queue: [] }, today: '2026-10-07' };
  const props = { board, report, accent: '#FFC71D', mint: '#2F7D4F', stageOf: (q: QueueItem) => q.stage, approvedIds: new Set<string>(), angleSwaps: {}, skips: {}, benchFor: () => [], onOpen: noop, onOpenCal: noop, onApprove: noop, onPickAngle: noop, onSkip: noop, onUnskip: noop, onGoContent: noop, flashId: null, modalOpen: false, live: true, onScheduleToDay };
  const r = render(<DeskWeekSurface {...props} />);
  fireEvent.click(r.container.querySelector('[data-glance-tile="2026-10-07"]')!);
  const plate = () => within(r.container.querySelector('[data-week-plate]') as HTMLElement);
  return { ...r, props, plate, onScheduleToDay };
}
describe('Home selected empty day', () => {
  it('offers the cleared post inside the selected-day panel and fills that day', async () => {
    const r = setup();
    fireEvent.click(r.plate().getByRole('button', { name: 'Add post here' }));
    expect(r.plate().getByText('Cleared post')).toBeTruthy();
    fireEvent.click(r.plate().getByRole('button', { name: 'Put it here' }));
    await waitFor(() => expect(r.onScheduleToDay).toHaveBeenCalledWith('cleared', '2026-10-07'));
    r.rerender(<DeskWeekSurface {...r.props} board={{ ...r.props.board, queue: [{ ...ready, publish_date: '2026-10-07', scheduled_at: '2026-10-07T16:00:00Z' }, later] }} />);
    expect(r.plate().queryByRole('button', { name: 'Add post here' })).toBeNull();
    expect(r.plate().getByRole('button', { name: 'Edit copy' })).toBeTruthy();
  });
  it('keeps the picker and shows a rejected write, then allows retry', async () => {
    const r = setup(vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true }));
    fireEvent.click(r.plate().getByRole('button', { name: 'Add post here' }));
    fireEvent.click(r.plate().getByRole('button', { name: 'Put it here' }));
    await waitFor(() => expect(r.plate().getByRole('alert').textContent).toContain('Could not save'));
    fireEvent.click(r.plate().getByRole('button', { name: 'Put it here' }));
    await waitFor(() => expect(r.onScheduleToDay).toHaveBeenCalledTimes(2));
  });
  it('prevents duplicate writes while adding', async () => {
    let resolve!: (r: { ok: boolean }) => void;
    const r = setup(vi.fn(() => new Promise(res => { resolve = res; })));
    fireEvent.click(r.plate().getByRole('button', { name: 'Add post here' }));
    const button = r.plate().getByRole('button', { name: 'Put it here' });
    fireEvent.click(button); fireEvent.click(button);
    expect(r.onScheduleToDay).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    resolve({ ok: true });
    await waitFor(() => expect(r.plate().queryByText('Put it here')).toBeNull());
  });
});
