import React from 'react';

interface Props {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subValue?: string;
}

const StatCard: React.FC<Props> = ({ label, value, icon, color, subValue }) => (
  <div className={`group relative bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-all duration-200 overflow-hidden`}>
    <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${color}`} />
    <div className="flex items-center justify-between mb-2">
      <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">{label}</span>
      <span className={`${color} opacity-60 group-hover:opacity-100 transition-opacity`}>{icon}</span>
    </div>
    <p className="text-2xl font-bold tracking-tight">{value}</p>
    {subValue && <p className="text-[11px] text-zinc-500 mt-1.5">{subValue}</p>}
  </div>
);

export default StatCard;
