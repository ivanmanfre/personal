import React from 'react';

interface Props {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  subValue?: string;
}

const StatCard: React.FC<Props> = ({ label, value, icon, color, subValue }) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
      <span className={color}>{icon}</span>
    </div>
    <p className="text-2xl font-bold">{value}</p>
    {subValue && <p className="text-xs text-zinc-500 mt-1">{subValue}</p>}
  </div>
);

export default StatCard;
