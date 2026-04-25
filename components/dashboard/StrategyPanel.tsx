import React from 'react';
import { Map } from 'lucide-react';

const StrategyPanel: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Map className="w-6 h-6 text-zinc-300" />
        <h1 className="text-2xl font-bold tracking-tight">Strategy Map</h1>
      </div>
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-8 text-center text-zinc-500">
        Strategy Map panel — sections coming online phase by phase.
      </div>
    </div>
  );
};

export default StrategyPanel;
