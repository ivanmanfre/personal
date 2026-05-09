import React from 'react';

export interface FunnelSegProps {
  label: string;
  value: number;
  flex: number;
  variant: 'win' | 'warm' | 'cold';
  onClick?: () => void;
}

export function FunnelSeg({ label, value, flex, variant, onClick }: FunnelSegProps) {
  return (
    <div
      className={`dv-funnel-seg dv-funnel-seg--${variant}`}
      style={{ flex }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="dv-funnel-seg-num">{value.toLocaleString()}</div>
      <div className="dv-funnel-seg-lbl">{label}</div>
    </div>
  );
}

export function Funnel({ children }: { children: React.ReactNode }) {
  return <div className="dv-funnel">{children}</div>;
}
