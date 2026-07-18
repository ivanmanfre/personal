import React from 'react';
import type { NavItem, SectionId } from './types';

// Round 2 (A-seed): the nav is grouped so every legacy category + its
// subsections has a visible home (Ivan feedback #1). Groups render in this
// order; a `label: null` group prints no divider heading (Today, Personal).
const GROUP_ORDER: { key: string; label: string | null }[] = [
  { key: 'today', label: null },
  { key: 'content', label: 'Content' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'clients', label: 'Clients' },
  { key: 'system', label: 'System' },
  { key: 'personal', label: null },
  { key: 'archive', label: 'Archive' },
];

// Collapsed rail shows an icon + a short label. Keyed by group so a 25-entry
// nav still rails cleanly; a generic dot covers anything unmapped.
const ic = (children: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const GROUP_ICON: Record<string, React.ReactNode> = {
  today: ic(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  content: ic(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  pipeline: ic(<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>),
  clients: ic(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></>),
  system: ic(<><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></>),
  personal: ic(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  archive: ic(<><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></>),
};
const dot = ic(<circle cx="12" cy="12" r="3" />);

interface SidebarProps {
  items: NavItem[];
  active: SectionId;
  onSelect: (id: SectionId) => void;
  open?: boolean;              // mobile drawer open state (no effect on desktop)
  onClose?: () => void;        // dismiss the mobile drawer
  collapsed?: boolean;         // desktop rail (icon-only) state
  onToggleCollapse?: () => void;
}

export function Sidebar({ items, active, onSelect, open, onClose, collapsed, onToggleCollapse }: SidebarProps) {
  const renderItem = (it: NavItem, groupKey: string) => (
    <button
      key={it.id}
      className="dv-nav-item"
      aria-current={it.id === active ? 'page' : undefined}
      title={collapsed ? it.name : undefined}
      onClick={() => onSelect(it.id)}
    >
      <span className="dv-nav-icon" aria-hidden="true">{GROUP_ICON[groupKey] || dot}</span>
      <span className="dv-nav-name">{it.name}</span>
      <span className="dv-nav-short" aria-hidden="true">{it.name}</span>
      {it.badge && it.badge.count > 0 && (
        <span className={`dv-nav-badge ${it.badge.severity === 'warn' ? 'dv-nav-badge--amber' : ''}`}>
          {it.badge.count}
        </span>
      )}
    </button>
  );

  return (
    <aside className={`dv-sidebar ${open ? 'dv-sidebar--open' : ''}`}>
      {onToggleCollapse && (
        <button
          type="button"
          className="dv-rail-toggle"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
          title={`${collapsed ? 'Expand' : 'Collapse'} sidebar (⌘\\)`}
          onClick={onToggleCollapse}
        >
          <span className="dv-rail-chevron" aria-hidden="true">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="14 6 8 12 14 18" />
            </svg>
          </span>
        </button>
      )}
      <div className="dv-brand">
        <span className="dv-brand-logo" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="28" height="28">
            <rect width="32" height="32" rx="7" fill="var(--d-good)" />
            <path d="M7 22 V10 H10.5 L16 18 L21.5 10 H25 V22 H22 V14.5 L17 21.5 H15 L10 14.5 V22 Z" fill="#fff" />
          </svg>
        </span>
        <div className="dv-brand-text">
          <div className="dv-brand-mark">Ivan <em>System</em></div>
        </div>
        {onClose && (
          <button type="button" className="dv-sidebar-close" aria-label="Close navigation" onClick={onClose}>×</button>
        )}
      </div>

      <nav className="dv-nav">
        {GROUP_ORDER.map(({ key, label }) => {
          const groupItems = items.filter(i => (i.group ?? 'today') === key);
          if (groupItems.length === 0) return null;
          return (
            <React.Fragment key={key}>
              {label && <div className="dv-nav-divider">{label}</div>}
              {groupItems.map(it => renderItem(it, key))}
            </React.Fragment>
          );
        })}
      </nav>

      <div className="dv-sidebar-foot">
        <div className="dv-kbd-hint"><kbd>⌘</kbd><kbd>K</kbd> Jump to anything</div>
      </div>
    </aside>
  );
}
