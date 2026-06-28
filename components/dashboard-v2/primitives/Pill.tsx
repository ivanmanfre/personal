import React from 'react';

type Tone = 'info' | 'warn' | 'ok' | 'violet';

interface PillProps {
  tone: Tone;
  children: React.ReactNode;
}

const toneStyles: Record<Tone, React.CSSProperties> = {
  info:   { color: 'var(--ds-info)',   background: '#eff6ff' },
  warn:   { color: 'var(--ds-warn)',   background: '#fffbeb' },
  ok:     { color: 'var(--ds-ok)',     background: '#ecfdf5' },
  violet: { color: 'var(--ds-violet)', background: '#f5f3ff' },
};

export function Pill({ tone, children }: PillProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: '11.5px',
        fontWeight: 600,
        padding: '3px 10px',
        borderRadius: '20px',
        fontVariantNumeric: 'tabular-nums',
        ...toneStyles[tone],
      }}
    >
      {children}
    </span>
  );
}
