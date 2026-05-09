import React from 'react';

interface CardProps {
  label?: string;
  title?: React.ReactNode;
  children?: React.ReactNode;
  trailing?: React.ReactNode;
}

export function Card({ label, title, children, trailing }: CardProps) {
  return (
    <div className="dv-card">
      {(label || trailing) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
          {label && <div className="dv-card-lbl">{label}</div>}
          {trailing}
        </div>
      )}
      {title && <h3>{title}</h3>}
      {children && <div>{children}</div>}
    </div>
  );
}
