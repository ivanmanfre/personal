import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  lastRefreshed: Date;
  onRefresh?: () => void;
}

const WARN_MS = 5 * 60 * 1000;  // 5 minutes
const STALE_MS = 10 * 60 * 1000; // 10 minutes

const RefreshIndicator: React.FC<Props> = ({ lastRefreshed, onRefresh }) => {
  const [ago, setAgo] = useState('');
  const [isWarning, setIsWarning] = useState(false);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    const update = () => {
      const ageMs = Date.now() - lastRefreshed.getTime();
      const secs = Math.floor(ageMs / 1000);
      if (secs < 5) setAgo('just now');
      else if (secs < 60) setAgo(`${secs}s ago`);
      else setAgo(`${Math.floor(secs / 60)}m ago`);

      setIsWarning(ageMs >= WARN_MS);
      setIsStale(ageMs >= STALE_MS);
    };
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [lastRefreshed]);

  const textColor = isStale
    ? 'text-red-400'
    : isWarning
      ? 'text-amber-400'
      : 'text-zinc-500';

  return (
    <div className={`flex items-center gap-2 text-[11px] ${textColor}`}>
      {isWarning && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
        </span>
      )}
      {isStale && <AlertTriangle className="w-3 h-3 text-red-400" />}
      <span>Updated {ago}</span>
      {onRefresh && (
        <button onClick={onRefresh} className={`hover:text-zinc-300 transition-colors p-0.5 rounded ${isStale ? 'hover:text-red-300' : ''}`} title="Refresh now">
          <RefreshCw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export default RefreshIndicator;
