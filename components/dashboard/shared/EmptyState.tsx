import React from 'react';
import { Inbox, ArrowRight } from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  /** Optional CTA button — gives the user a next step instead of a dead end. */
  action?: { label: string; onClick: () => void };
}

const EmptyState: React.FC<Props> = ({ title = 'No data yet', description, icon, action }) => (
  <div className="relative bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-14 text-center overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-zinc-800/10 to-transparent pointer-events-none" />
    <div className="relative">
      <div className="flex justify-center mb-4 text-zinc-500">
        {icon || <Inbox className="w-10 h-10" />}
      </div>
      <p className="text-sm font-medium text-zinc-400">{title}</p>
      {description && <p className="text-xs text-zinc-500 mt-1.5 max-w-md mx-auto leading-relaxed">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          {action.label} <ArrowRight className="w-3 h-3" />
        </button>
      )}
    </div>
  </div>
);

export default EmptyState;
