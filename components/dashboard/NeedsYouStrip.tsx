import React from 'react';

export interface StripItem { label: string; count: number; tone: 'bad' | 'warn'; onJump: () => void }

export function NeedsYouStrip({ items }: { items: StripItem[] }) {
  const live = items.filter((i) => i.count > 0);
  if (live.length === 0) return null;
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--d-rule-strong)] bg-[var(--d-warn-bg)] px-3 py-2 mb-3">
      <span className="text-[11px] font-bold tracking-wider text-[var(--d-warn)]">NEEDS YOU</span>
      {live.map((i) => (
        <button
          key={i.label}
          onClick={i.onJump}
          className="text-[11.5px] font-semibold rounded-md border border-[var(--d-rule-strong)] bg-[var(--d-surface)] px-2 py-0.5 hover:ring-1 hover:ring-[var(--d-rule-strong)] focus-visible:ring-2 focus-visible:ring-[var(--ds-accent)] outline-none"
        >
          <span className={i.tone === 'bad' ? 'text-[var(--d-bad-txt)]' : 'text-[var(--d-warn)]'}>{i.count}</span> {i.label}
        </button>
      ))}
    </div>
  );
}
