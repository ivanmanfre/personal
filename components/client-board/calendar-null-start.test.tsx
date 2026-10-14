// @vitest-environment jsdom
/**
 * A board set up before its first posting date carries calendar.start = null
 * (swishdm-live, 2026-10-14). CalendarSurface (#calendar) used to call null.split and
 * blank the whole board. It must render, anchored on the current week, and claim no
 * "Posting starts" date. A board WITH a start keeps the pill.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarSurface } from '../ClientBoardPage';
import type { Board } from '../ClientBoardPage';

const board = (start: string | null): Board => ({
  company_name: 'SwishDM', queue: [],
  calendar: { start, weeks: 0, items: [] },
} as unknown as Board);

const render = (b: Board) => renderToStaticMarkup(
  <CalendarSurface board={b} accent="#0668FC" mint="#FC5B06" onOpen={() => {}} scheduledIds={new Set()} live />,
);

describe('CalendarSurface with no calendar.start', () => {
  it('renders instead of throwing, with no posting-start claim', () => {
    let html = '';
    expect(() => { html = render(board(null)); }).not.toThrow();
    expect(html.length).toBeGreaterThan(100);
    expect(html).not.toContain('Posting starts');
  });
  it('keeps the posting-start pill when a start is set', () => {
    expect(render(board('2026-10-19'))).toContain('Posting starts');
  });
});
