import React, { useEffect, useRef, useState, useCallback } from 'react';
import { computeRightOverflow } from './subTabsOverflow';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [overflowCount, setOverflowCount] = useState(0);
  const tabCount = React.Children.count(children);

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setOverflowCount(
      computeRightOverflow({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollLeft: el.scrollLeft,
        tabCount,
      })
    );
  }, [tabCount]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    recompute();

    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    el.addEventListener('scroll', recompute, { passive: true });

    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', recompute);
    };
  }, [recompute]);

  return (
    <div className="dv-subtabs-wrap">
      <div role="tablist" className="dv-subtabs" ref={scrollRef}>{children}</div>
      {overflowCount > 0 && (
        <span className="dv-subtabs-more" aria-hidden="true">+{overflowCount}</span>
      )}
    </div>
  );
}
