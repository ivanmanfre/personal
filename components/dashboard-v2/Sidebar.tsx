import React from 'react';
import type { NavItem, SectionId } from './types';

// Collapsed rail shows an icon + a short label (numbers alone are meaningless
// when railed). Keyed by section id so it works regardless of who builds the nav.
const ic = (children: React.ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const SECTION_ICON: Record<string, React.ReactNode> = {
  briefing: ic(<><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></>),
  content:  ic(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  reach:    ic(<><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>),
  ops:      ic(<><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>),
  clients:  ic(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>),
  knowledge: ic(<><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></>),
  agent:    ic(<><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" /><line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" /><line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" /></>),
  ideas:    ic(<><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" /></>),
  opsideas: ic(<><path d="M9 18h6" /><path d="M10 22h4" /><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5.76.76 1.23 1.52 1.41 2.5" /></>),
  system:   ic(<><rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" /></>),
  personal: ic(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
};
const SECTION_SHORT: Record<string, string> = {
  briefing: 'Brief', content: 'Content', reach: 'Reach', ops: 'Ops',
  clients: 'Clients', knowledge: 'Knowledge', agent: 'Agent', personal: 'Personal',
  opsideas: 'Ops Ideas',
};

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
  // Group items for divider headings
  const briefing = items.filter(i => i.group === 'briefing');
  const operate = items.filter(i => i.group === 'operate');
  const knowledge = items.filter(i => i.group === 'knowledge');
  const personal = items.filter(i => i.group === 'personal');

  const renderItem = (it: NavItem) => (
    <button
      key={it.id}
      className={`dv-nav-item ${it.id === 'briefing' ? 'dv-briefing' : ''}`}
      aria-current={it.id === active ? 'page' : undefined}
      title={collapsed ? it.name : undefined}
      onClick={() => onSelect(it.id)}
    >
      {it.num && <span className="dv-nav-num">{it.num}</span>}
      <span className="dv-nav-icon" aria-hidden="true">{SECTION_ICON[it.id]}</span>
      <span className="dv-nav-name">
        {it.emphasis ? (
          <>
            {it.name.replace(it.emphasis, '')}
            <em>{it.emphasis}</em>
          </>
        ) : it.name}
      </span>
      <span className="dv-nav-short" aria-hidden="true">{SECTION_SHORT[it.id] || it.name}</span>
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
            <path d="M7 22 V10 H10.5 L16 18 L21.5 10 H25 V22 H22 V14.5 L17 21.5 H15 L10 14.5 V22 Z" fill="var(--d-ink)" />
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
        {briefing.map(renderItem)}

        {operate.length > 0 && <div className="dv-nav-divider">Operate</div>}
        {operate.map(renderItem)}

        {knowledge.length > 0 && <div className="dv-nav-divider">Knowledge</div>}
        {knowledge.map(renderItem)}

        {personal.length > 0 && <div className="dv-nav-divider">Personal</div>}
        {personal.map(renderItem)}
      </nav>

      <div className="dv-sidebar-foot">
        <div className="dv-kbd-hint"><kbd>⌘</kbd><kbd>K</kbd> Jump to anything</div>
      </div>
    </aside>
  );
}
