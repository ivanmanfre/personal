import React from 'react';

interface Props {
  rows?: number;
  cards?: number;
}

const LoadingSkeleton: React.FC<Props> = ({ rows = 0, cards = 4 }) => (
  <div className="space-y-6">
    <div className="h-8 w-40 bg-zinc-800/60 rounded shimmer" />
    {cards > 0 && (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl p-4 h-24 shimmer" style={{ animationDelay: `${i * 100}ms` }} />
        ))}
      </div>
    )}
    {rows > 0 && (
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-14 bg-zinc-900/60 border border-zinc-800/50 rounded-xl shimmer" style={{ animationDelay: `${(cards + i) * 80}ms` }} />
        ))}
      </div>
    )}
    <style>{`
      .shimmer {
        position: relative;
        overflow: hidden;
      }
      .shimmer::after {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
        animation: shimmer 1.8s ease-in-out infinite;
      }
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `}</style>
  </div>
);

export default LoadingSkeleton;
