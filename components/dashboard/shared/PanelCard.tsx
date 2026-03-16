import React from 'react';

interface Props {
  title: string;
  icon?: React.ReactNode;
  badge?: string | number;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  scrollable?: boolean;
}

const PanelCard: React.FC<Props> = ({ title, icon, badge, headerRight, children, className = '', scrollable = false }) => (
  <div className={`bg-zinc-900/90 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-sm shadow-black/10 ${className}`}>
    <div className="px-4 py-3.5 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-zinc-500">{icon}</span>}
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em]">{title}</h2>
        {badge != null && (
          <span className="px-1.5 py-0.5 rounded-md bg-zinc-800 text-[10px] font-medium text-zinc-500">{badge}</span>
        )}
      </div>
      {headerRight}
    </div>
    <div className={scrollable ? 'max-h-96 overflow-y-auto' : ''}>
      {children}
    </div>
  </div>
);

export default PanelCard;
