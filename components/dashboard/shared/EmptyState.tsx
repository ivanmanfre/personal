import React from 'react';
import { Inbox } from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

const EmptyState: React.FC<Props> = ({ title = 'No data yet', description, icon }) => (
  <div className="relative bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-14 text-center overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/10 to-transparent pointer-events-none" />
    <div className="relative">
      <div className="flex justify-center mb-4 text-zinc-500">
        {icon || <Inbox className="w-10 h-10" />}
      </div>
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      {description && <p className="text-xs text-zinc-500 mt-1.5 max-w-xs mx-auto leading-relaxed">{description}</p>}
    </div>
  </div>
);

export default EmptyState;
