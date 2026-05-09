import React from 'react';
import type { Severity } from '../types';

interface ClientRowProps {
  name: string;
  status: string;
  severity: Severity;
  action?: string;
  onClick?: () => void;
}

export function ClientRow({ name, status, severity, action, onClick }: ClientRowProps) {
  const dotCls =
    severity === 'good' ? 'dv-client-row-dot--good' :
    severity === 'warn' ? 'dv-client-row-dot--warn' :
    severity === 'bad' ? 'dv-client-row-dot--bad' : 'dv-client-row-dot--good';
  return (
    <div className="dv-client-row" onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <span className={`dv-client-row-dot ${dotCls}`} />
      <span className="dv-client-row-name">{name}</span>
      <span className="dv-client-row-status">{status}</span>
      {action && <span className="dv-client-row-action">{action}</span>}
    </div>
  );
}
