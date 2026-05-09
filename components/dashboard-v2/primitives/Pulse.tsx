import React from 'react';
import type { Severity } from '../types';

interface PulseCellProps {
  name: string;
  meta: string;
  severity: Severity;
  onClick?: () => void;
}

export function PulseCell({ name, meta, severity, onClick }: PulseCellProps) {
  const dotCls =
    severity === 'good' ? 'dv-pulse-cell-dot--good' :
    severity === 'warn' ? 'dv-pulse-cell-dot--warn' :
    severity === 'bad' ? 'dv-pulse-cell-dot--bad' : 'dv-pulse-cell-dot--good';
  return (
    <button className="dv-pulse-cell" onClick={onClick}>
      <span className={`dv-pulse-cell-dot ${dotCls}`} />
      <span className="dv-pulse-cell-name">{name}</span>
      <span className="dv-pulse-cell-meta">{meta}</span>
    </button>
  );
}

export function Pulse({ children }: { children: React.ReactNode }) {
  return <div className="dv-pulse">{children}</div>;
}
