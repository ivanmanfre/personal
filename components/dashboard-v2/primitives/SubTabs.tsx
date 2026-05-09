import React from 'react';

interface SubTabProps {
  id: string;
  active: string;
  onChange: (id: string) => void;
  children: React.ReactNode;
  badge?: { count: number; severity?: 'bad' | 'warn' };
}

export function SubTab({ id, active, onChange, children, badge }: SubTabProps) {
  return (
    <button
      role="tab"
      aria-selected={active === id}
      className="dv-subtab"
      onClick={() => onChange(id)}
    >
      <span>{children}</span>
      {badge && (
        <span className={`dv-nav-badge ${badge.severity === 'warn' ? 'dv-nav-badge--amber' : ''}`}>
          {badge.count}
        </span>
      )}
    </button>
  );
}

interface SubTabsProps {
  children: React.ReactNode;
}

export function SubTabs({ children }: SubTabsProps) {
  return <div role="tablist" className="dv-subtabs">{children}</div>;
}
