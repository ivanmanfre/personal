import React from 'react';

interface Props {
  rows?: number;
  cards?: number;
}

const LoadingSkeleton: React.FC<Props> = ({ rows = 0, cards = 4 }) => (
  <div className="space-y-6 animate-pulse">
    <div className="h-8 w-40 bg-zinc-800 rounded" />
    {cards > 0 && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-24" />
        ))}
      </div>
    )}
    {rows > 0 && (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 bg-zinc-900 border border-zinc-800 rounded-xl" />
        ))}
      </div>
    )}
  </div>
);

export default LoadingSkeleton;
