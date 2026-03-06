import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  lastRefreshed: Date;
  onRefresh?: () => void;
}

const RefreshIndicator: React.FC<Props> = ({ lastRefreshed, onRefresh }) => {
  const [ago, setAgo] = useState('');

  useEffect(() => {
    const update = () => {
      const secs = Math.floor((Date.now() - lastRefreshed.getTime()) / 1000);
      if (secs < 5) setAgo('just now');
      else if (secs < 60) setAgo(`${secs}s ago`);
      else setAgo(`${Math.floor(secs / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [lastRefreshed]);

  return (
    <div className="flex items-center gap-2 text-[11px] text-zinc-600">
      <span>Updated {ago}</span>
      {onRefresh && (
        <button onClick={onRefresh} className="hover:text-zinc-300 transition-colors p-0.5 rounded" title="Refresh now">
          <RefreshCw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default RefreshIndicator;
