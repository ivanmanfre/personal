import React from 'react';

interface SectionLabelProps {
  label: string;
  count?: number | string;
  alert?: boolean;
  hint?: React.ReactNode;
}

export function SectionLabel({ label, count, alert, hint }: SectionLabelProps) {
  return (
    <div className={`dv-section-label ${alert ? 'dv-section-label--alert' : ''}`}>
      <span>{label}</span>
      <span className="dv-rule" />
      {count !== undefined && <span className="dv-section-count">{count}</span>}
      {hint && <span style={{ color: 'var(--d-paper-dimmer)', letterSpacing: '0.04em' }}>{hint}</span>}
    </div>
  );
}
