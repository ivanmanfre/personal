/**
 * Desk skin: the left menu collapses to a 56px rail (2026-09-10, Ivan).
 *
 * The aside itself still lives in ClientBoardPage (it is shared by every skin); this
 * module holds the three pieces the desk skin adds so they can be tested on their own:
 *   - useSideNavCollapsed: the choice, remembered per browser under `cb-sidenav-collapsed`
 *   - SideNavToggle: the chevron button at the top of the menu (real <button>, 44px hit)
 *   - SideNavRailNav: one icon-or-initial per nav item for the collapsed state
 *
 * Default is collapsed (2026-09-10, Ivan: the menu starts as the rail); a stored "0" keeps
 * it expanded, "1" collapsed. The toggle only renders for skin === 'desk'; mobile (< lg)
 * keeps its own header + bottom tabs and never sees the rail.
 */
import React, { useState } from 'react';

export const SIDENAV_STORAGE_KEY = 'cb-sidenav-collapsed';
export const SIDENAV_WIDTH = 216;
export const SIDENAV_RAIL_WIDTH = 56;

export function readSideNavCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(SIDENAV_STORAGE_KEY);
    return stored === null ? true : stored === '1';
  } catch { return true; }
}

export function useSideNavCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState<boolean>(readSideNavCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(SIDENAV_STORAGE_KEY, next ? '1' : '0'); } catch { /* private mode */ }
  };
  return [collapsed, toggle];
}

/** Double chevron pointing into the menu; flips when the rail is collapsed. */
export function SideNavToggle({ collapsed, onToggle, style }: { collapsed: boolean; onToggle: () => void; style?: React.CSSProperties }) {
  const label = collapsed ? 'Expand menu' : 'Collapse menu';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      className="cb-sidenav-toggle flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-[rgba(26,26,26,0.06)]"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--cb-ink-mute, #5A5752)', ...style }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}>
        <path d="m11 17-5-5 5-5M18 17l-5-5 5-5" />
      </svg>
    </button>
  );
}

export function railInitial(label: string): string {
  return (label.trim()[0] || '·').toUpperCase();
}

export type RailTab = { id: string; label: string };

/** Collapsed nav: one 44px square per item, the label as a title tooltip, active item
 *  keeps the accent bar + wash of the expanded menu. Icons come from the page (the nav
 *  icon set lives there); without one, the first letter of the label stands in. */
export function SideNavRailNav<T extends RailTab>({ tabs, activeTab, onSelect, accent, badge, renderIcon }: {
  tabs: readonly T[];
  activeTab: string;
  onSelect: (id: T['id']) => void;
  accent: string;
  badge?: Partial<Record<string, number>>;
  renderIcon?: (id: T['id']) => React.ReactNode;
}) {
  return (
    <nav className="flex flex-col py-3" aria-label="Board sections">
      {tabs.map((t) => {
        const active = activeTab === t.id;
        const n = badge?.[t.id] || 0;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            title={t.label}
            aria-label={t.label}
            aria-current={active ? 'page' : undefined}
            className="relative flex h-11 w-full items-center justify-center transition-colors duration-150 hover:bg-[rgba(26,26,26,0.04)]"
            style={{
              borderLeft: `3px solid ${active ? accent : 'transparent'}`,
              background: active ? `color-mix(in oklab, ${accent} 6%, transparent)` : 'transparent',
              color: active ? 'var(--cb-ink, #1A1A1A)' : 'var(--cb-ink-mute, #5A5752)',
              cursor: 'pointer',
            }}
          >
            {renderIcon
              ? renderIcon(t.id)
              : <span style={{ fontFamily: 'var(--cb-mono, ui-monospace, monospace)', fontSize: 12, letterSpacing: '0.08em' }}>{railInitial(t.label)}</span>}
            {n > 0 && (
              <span
                className="absolute right-1.5 top-1.5 min-w-[14px] rounded-full px-1 text-center leading-[14px] tabular-nums"
                style={{ fontFamily: 'var(--cb-mono, ui-monospace, monospace)', fontSize: 8.5, background: `color-mix(in oklab, ${accent} 75%, #1A1A1A)`, color: 'var(--cb-paper, #F7F4EF)' }}
              >
                {n}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
