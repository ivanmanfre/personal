// @vitest-environment jsdom
/**
 * Desk side nav collapse smoke (2026-09-10).
 *
 *  - the toggle is a real <button>, aria-expanded=true by default (menu open)
 *  - one click -> aria-expanded=false and localStorage `cb-sidenav-collapsed` === "1"
 *  - the rail still renders every nav item, each carrying its label as a title
 *  - a stored "1" comes back collapsed on first render
 *
 * Run:  npx vitest run components/client-board/desksidenav.smoke.test.tsx
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { SideNavToggle, SideNavRailNav, useSideNavCollapsed, SIDENAV_STORAGE_KEY } from './DeskSideNav';

const TABS = [
  { id: 'week', label: 'This week' },
  { id: 'review', label: 'All content' },
  { id: 'lm', label: 'Lead magnets' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'outreach', label: 'Outreach & leads' },
  { id: 'performance', label: 'Performance' },
] as const;

/** The same wiring ClientBoardPage uses: toggle + expanded list, or toggle + rail. */
function Harness() {
  const [collapsed, toggle] = useSideNavCollapsed();
  return (
    <aside data-collapsed={collapsed ? '1' : undefined}>
      <SideNavToggle collapsed={collapsed} onToggle={toggle} />
      {collapsed
        ? <SideNavRailNav tabs={TABS} activeTab="review" onSelect={() => {}} accent="#FFC71D" badge={{ week: 3 }} />
        : <nav aria-label="Board sections">{TABS.map((t) => <button key={t.id}>{t.label}</button>)}</nav>}
    </aside>
  );
}

beforeEach(() => { try { localStorage.clear(); } catch { /* jsdom */ } });
afterEach(cleanup);

describe('desk side nav collapse', () => {
  it('starts expanded, collapses on click and remembers the choice', () => {
    const r = render(<Harness />);
    const toggle = r.getByRole('button', { name: 'Collapse menu' });
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(r.container.querySelector('aside')?.getAttribute('data-collapsed')).toBeNull();

    fireEvent.click(toggle);

    const after = r.getByRole('button', { name: 'Expand menu' });
    expect(after.getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem(SIDENAV_STORAGE_KEY)).toBe('1');
    expect(r.container.querySelector('aside')?.getAttribute('data-collapsed')).toBe('1');

    // Every nav item survives in the rail, titled with its label.
    for (const t of TABS) {
      const item = r.getByTitle(t.label);
      expect(item.tagName).toBe('BUTTON');
    }
    expect(r.getByTitle('All content').getAttribute('aria-current')).toBe('page');
    expect(r.getByTitle('This week').textContent).toContain('3');

    // And back: expand clears the flag.
    fireEvent.click(after);
    expect(r.getByRole('button', { name: 'Collapse menu' }).getAttribute('aria-expanded')).toBe('true');
    expect(localStorage.getItem(SIDENAV_STORAGE_KEY)).toBe('0');
  });

  it('honours a stored "1" on first render', () => {
    localStorage.setItem(SIDENAV_STORAGE_KEY, '1');
    const r = render(<Harness />);
    expect(r.getByRole('button', { name: 'Expand menu' }).getAttribute('aria-expanded')).toBe('false');
    expect(r.getByTitle('Performance')).toBeTruthy();
  });
});
