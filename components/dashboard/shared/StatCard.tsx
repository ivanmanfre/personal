import React from 'react';

interface Props {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subValue?: string;
}

// Map text color classes to background tint classes
const colorToBg: Record<string, string> = {
  'text-emerald-400': 'bg-emerald-500/15 border-emerald-500/20',
  'text-blue-400': 'bg-blue-500/15 border-blue-500/20',
  'text-pink-400': 'bg-pink-500/15 border-pink-500/20',
  'text-amber-400': 'bg-amber-500/15 border-amber-500/20',
  'text-violet-400': 'bg-violet-500/15 border-violet-500/20',
  'text-red-400': 'bg-red-500/15 border-red-500/20',
  'text-orange-400': 'bg-orange-500/15 border-orange-500/20',
  'text-cyan-400': 'bg-cyan-500/15 border-cyan-500/20',
  'text-purple-400': 'bg-purple-500/15 border-purple-500/20',
};

const colorToAccent: Record<string, string> = {
  'text-emerald-400': 'from-emerald-500',
  'text-blue-400': 'from-blue-500',
  'text-pink-400': 'from-pink-500',
  'text-amber-400': 'from-amber-500',
  'text-violet-400': 'from-violet-500',
  'text-red-400': 'from-red-500',
  'text-orange-400': 'from-orange-500',
  'text-cyan-400': 'from-cyan-500',
  'text-purple-400': 'from-purple-500',
};

const StatCard: React.FC<Props> = ({ label, value, icon, color, subValue }) => {
  const bgClass = colorToBg[color] || 'bg-zinc-500/15 border-zinc-500/20';
  const accentClass = colorToAccent[color] || 'from-zinc-500';

  return (
    <div className="group relative bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-4 hover:border-zinc-700/80 transition-all duration-300 overflow-hidden hover:shadow-lg hover:shadow-black/20">
      {/* Top accent line */}
      <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${accentClass} to-transparent opacity-40 group-hover:opacity-80 transition-opacity duration-300`} />

      {/* Subtle background glow */}
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full ${bgClass.split(' ')[0]} blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium block mb-2">{label}</span>
          <p className="text-[28px] font-bold tracking-tight leading-none">{value}</p>
          {subValue && <p className="text-[11px] text-zinc-500 mt-2">{subValue}</p>}
        </div>
        <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center ${bgClass} ${color} transition-all duration-300 group-hover:scale-110`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
