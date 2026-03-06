import React from 'react';

type Status = 'healthy' | 'warning' | 'error' | 'inactive';

const colors: Record<Status, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  inactive: 'bg-zinc-600',
};

interface Props {
  status: Status;
  pulse?: boolean;
  size?: 'sm' | 'md';
}

const StatusDot: React.FC<Props> = ({ status, pulse = false, size = 'sm' }) => {
  const s = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  return (
    <span className="relative inline-flex">
      {pulse && status !== 'inactive' && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${colors[status]} opacity-50 animate-ping`} />
      )}
      <span className={`relative inline-flex rounded-full ${s} ${colors[status]}`} />
    </span>
  );
};

export default StatusDot;
