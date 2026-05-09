import React from 'react';

interface MarginaliaProps {
  children: React.ReactNode;
  variant?: 'default' | 'warn' | 'bad';
}

export function Marginalia({ children, variant = 'default' }: MarginaliaProps) {
  const cls = variant !== 'default' ? `dv-marginalia dv-marginalia--${variant}` : 'dv-marginalia';
  return <div className={cls}>{children}</div>;
}
