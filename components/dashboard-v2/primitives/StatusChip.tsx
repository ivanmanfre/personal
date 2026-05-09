import React from 'react';
import type { Severity } from '../types';

interface StatusChipProps {
  label: string;
  severity: Severity;
}

export function StatusChip({ label, severity }: StatusChipProps) {
  const cls =
    severity === 'good' ? 'dv-chip--good' :
    severity === 'warn' ? 'dv-chip--warn' :
    severity === 'bad' ? 'dv-chip--bad' : 'dv-chip--warn';
  return <span className={`dv-chip ${cls}`}>{label}</span>;
}
