import React from 'react';
import type { Severity } from '../types';

interface KpiTileProps {
  label: string;
  value: React.ReactNode;
  delta?: string;
  severity?: Severity;
  deltaKind?: 'up' | 'down' | 'cost-up' | 'cost-down' | 'flat';
  onClick?: () => void;
}

export function KpiTile({ label, value, delta, severity = 'neutral', deltaKind, onClick }: KpiTileProps) {
  const numClass =
    severity === 'good' ? 'dv-kpi-num--good' :
    severity === 'warn' ? 'dv-kpi-num--warn' :
    severity === 'bad' ? 'dv-kpi-num--bad' : '';
  const deltaClass = deltaKind ? `dv-kpi-delta--${deltaKind}` : '';
  return (
    <div className="dv-kpi" onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <div className="dv-kpi-lbl">{label}</div>
      <div className={`dv-kpi-num ${numClass}`}>{value}</div>
      {delta && <div className={`dv-kpi-delta ${deltaClass}`}>{delta}</div>}
    </div>
  );
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="dv-kpi-row">{children}</div>;
}
