import React from 'react';
import { Inbox } from 'lucide-react';

interface Props {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

const EmptyState: React.FC<Props> = ({ title = 'No data yet', description, icon }) => (
  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
    <div className="flex justify-center mb-3 text-zinc-600">
      {icon || <Inbox className="w-10 h-10" />}
    </div>
    <p className="text-sm font-medium text-zinc-400">{title}</p>
    {description && <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">{description}</p>}
  </div>
);

export default EmptyState;
