import React, { useState } from 'react';

// Small secondary-tab strip used inside a top-level dashboard sub-section when
// multiple related panels share a parent (e.g. Performance = Post Performance + Site Audience).
// Keeps the top-level v2 sub-tab count low without merging the panels themselves.
type Tab = { key: string; label: string; render: () => React.ReactNode };

export const InternalTabs: React.FC<{ tabs: Tab[]; storageKey?: string }> = ({ tabs, storageKey }) => {
  const [active, setActive] = useState<string>(() => {
    if (storageKey && typeof window !== 'undefined') {
      const v = localStorage.getItem(storageKey);
      if (v && tabs.some((t) => t.key === v)) return v;
    }
    return tabs[0]?.key || '';
  });

  React.useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      try { localStorage.setItem(storageKey, active); } catch {}
    }
  }, [active, storageKey]);

  const current = tabs.find((t) => t.key === active) || tabs[0];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b border-zinc-800">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-3 py-1.5 text-[12.5px] transition-colors border-b-2 -mb-px ${
              t.key === active
                ? 'border-emerald-500 text-zinc-100'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{current?.render()}</div>
    </div>
  );
};

export default InternalTabs;
