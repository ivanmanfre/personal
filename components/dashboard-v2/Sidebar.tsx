import React from 'react';
import type { NavItem, SectionId } from './types';

interface SidebarProps {
  items: NavItem[];
  active: SectionId;
  onSelect: (id: SectionId) => void;
}

export function Sidebar({ items, active, onSelect }: SidebarProps) {
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
      onClick={() => onSelect(it.id)}
    >
      {it.num && <span className="dv-nav-num">{it.num}</span>}
      <span className="dv-nav-name">
        {it.emphasis ? (
          <>
            {it.name.replace(it.emphasis, '')}
            <em>{it.emphasis}</em>
          </>
        ) : it.name}
      </span>
      {it.badge && it.badge.count > 0 && (
        <span className={`dv-nav-badge ${it.badge.severity === 'warn' ? 'dv-nav-badge--amber' : ''}`}>
          {it.badge.count}
        </span>
      )}
    </button>
  );

  return (
    <aside className="dv-sidebar">
      <div className="dv-brand">
        <div className="dv-brand-mark">Ivan <em>System</em></div>
        <div className="dv-brand-sub">Console · v2</div>
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
        <div className="dv-kbd-hint"><kbd>⌘</kbd><kbd>K</kbd> Jump</div>
        <div className="dv-kbd-hint" style={{ marginTop: '0.4rem' }}><kbd>⌘</kbd><kbd>0</kbd>–<kbd>7</kbd> Sections</div>
      </div>
    </aside>
  );
}
