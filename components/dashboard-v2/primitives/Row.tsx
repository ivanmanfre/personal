import React from 'react';

interface RowProps {
  date: string;
  name: React.ReactNode;
  tag?: string;
  meta?: string;
  variant?: 'default' | 'failed' | 'amber';
  onClick?: () => void;
  trailing?: React.ReactNode;
}

export function Row({ date, name, tag, meta, variant = 'default', onClick, trailing }: RowProps) {
  const cls = variant !== 'default' ? `dv-row dv-row--${variant}` : 'dv-row';
  return (
    <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      <span className="dv-row-date">{date}</span>
      <span className="dv-row-bullet" />
      <span className="dv-row-name">{name}</span>
      {tag && <span className="dv-row-tag">{tag}</span>}
      {meta && <span className="dv-row-meta">{meta}</span>}
      {trailing}
    </div>
  );
}

export function RowList({ children }: { children: React.ReactNode }) {
  return <div className="dv-row-list">{children}</div>;
}
