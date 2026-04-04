import React, { useState, useRef, useCallback, useEffect } from 'react';

const CLAUDE_CODE_URL = import.meta.env.VITE_CLAUDE_CODE_URL || 'https://claude-code-railway-production.up.railway.app';

interface Pane {
  id: string;
  fresh?: boolean;
}

const SplitIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <rect x="1" y="2" width="14" height="12" rx="2" />
    <line x1="8" y1="2" x2="8" y2="14" />
  </svg>
);

const CodePanel: React.FC = () => {
  const [panes, setPanes] = useState<Pane[]>([{ id: 'main' }]);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isSplit = panes.length > 1;

  const addSplit = useCallback(() => {
    if (panes.length < 3) {
      setPanes(prev => [...prev, { id: Date.now().toString(36), fresh: true }]);
      if (panes.length === 1) setSplitRatio(50);
    }
  }, [panes.length]);

  const removeSplit = useCallback((id: string) => {
    setPanes(prev => {
      const next = prev.filter(p => p.id !== id);
      return next.length === 0 ? [{ id: 'main' }] : next;
    });
    setSplitRatio(50);
  }, []);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const ratio = ((clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(80, Math.max(20, ratio)));
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging]);

  return (
    <div className="-m-3 sm:-m-6 md:-m-8 relative" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Split control — top right, overlays the iframe */}
      <div className="absolute top-2.5 right-3 z-30 flex items-center gap-1">
        {!isSplit && (
          <button
            onClick={addSplit}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium
              bg-zinc-800/90 backdrop-blur-sm text-zinc-400 border border-zinc-700/60
              hover:bg-zinc-700/90 hover:text-zinc-200 hover:border-zinc-600/60
              transition-all duration-150 shadow-sm"
            title="Split into two panes"
          >
            <SplitIcon />
            Split
          </button>
        )}
        {isSplit && panes.length < 3 && (
          <button
            onClick={addSplit}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-sm
              bg-zinc-800/90 backdrop-blur-sm text-zinc-400 border border-zinc-700/60
              hover:bg-zinc-700/90 hover:text-zinc-200 transition-all duration-150"
            title="Add another pane"
          >
            +
          </button>
        )}
      </div>

      {/* Panes */}
      <div ref={containerRef} className="flex h-full w-full" style={{ cursor: isDragging ? 'col-resize' : undefined }}>
        {panes.map((pane, i) => (
          <React.Fragment key={pane.id}>
            {/* Pane */}
            <div
              className="relative h-full overflow-hidden group/pane"
              style={{
                width: isSplit
                  ? i === 0 ? `${splitRatio}%` : `${(100 - splitRatio) / Math.max(1, panes.length - 1)}%`
                  : '100%',
                transition: isDragging ? 'none' : 'width 0.2s ease',
              }}
            >
              {/* Close pane button — shows on hover */}
              {isSplit && (
                <button
                  onClick={() => removeSplit(pane.id)}
                  className="absolute top-2.5 left-2.5 z-20 flex items-center justify-center
                    w-6 h-6 rounded-md text-[13px] leading-none
                    bg-zinc-900/80 backdrop-blur-sm text-zinc-500 border border-zinc-700/40
                    opacity-0 group-hover/pane:opacity-100
                    hover:bg-red-950/80 hover:text-red-400 hover:border-red-800/40
                    transition-all duration-200"
                  title="Close this pane"
                >
                  ×
                </button>
              )}
              <iframe
                src={`${CLAUDE_CODE_URL}?pane=${pane.id}${pane.fresh ? '&fresh=1' : ''}`}
                className="w-full h-full border-0"
                title={`Claude Code ${i + 1}`}
                allow="clipboard-read; clipboard-write"
                style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
              />
            </div>

            {/* Draggable divider */}
            {i < panes.length - 1 && (
              <div
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                className="relative flex-shrink-0 group/divider cursor-col-resize"
                style={{ width: '8px' }}
              >
                {/* Background track */}
                <div className={`absolute inset-0 transition-colors duration-150 ${
                  isDragging ? 'bg-emerald-500/20' : 'bg-zinc-800/50 group-hover/divider:bg-emerald-500/15'
                }`} />
                {/* Center handle */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                  w-1 rounded-full transition-all duration-150 ${
                  isDragging
                    ? 'h-12 bg-emerald-400/80'
                    : 'h-8 bg-zinc-600/60 group-hover/divider:h-12 group-hover/divider:bg-emerald-400/60'
                }`} />
                {/* Grip dots */}
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                  flex flex-col gap-1 transition-opacity duration-150 ${
                  isDragging ? 'opacity-100' : 'opacity-0 group-hover/divider:opacity-100'
                }`}>
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="w-1 h-1 rounded-full bg-emerald-400/40" />
                  ))}
                </div>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default CodePanel;
