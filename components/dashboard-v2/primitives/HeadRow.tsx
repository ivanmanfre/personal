import React from 'react';
import { StatusChip } from './StatusChip';
import type { Severity } from '../types';

interface HeadRowProps {
  title: React.ReactNode;
  chip?: { label: string; severity: Severity };
  meta?: React.ReactNode;
  live?: boolean;
}

export function HeadRow({ title, chip, meta, live }: HeadRowProps) {
  return (
    <header className="dv-head">
      <h1 className="dv-h1">
        {title}
        {chip && <StatusChip label={chip.label} severity={chip.severity} />}
      </h1>
      <div className="dv-meta">
        {meta}
        {live && <><br /><span className="dv-meta-live">Live</span></>}
      </div>
    </header>
  );
}
