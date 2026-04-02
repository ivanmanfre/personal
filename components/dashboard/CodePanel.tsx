import React, { useState, useRef, useCallback, useEffect } from 'react';

const CLAUDE_CODE_URL = import.meta.env.VITE_CLAUDE_CODE_URL || 'https://claude-code-railway-production.up.railway.app';

interface Pane {
  id: string;
}

const CodePanel: React.FC = () => {
  const [panes, setPanes] = useState<Pane[]>([{ id: 'main' }]);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isSplit = panes.length > 1;

  const addSplit = useCallback(() => {
    if (panes.length < 3) {
      setPanes(prev => [...prev, { id: Date.now().toString(36) }]);
      setSplitRatio(50);
    }
  }, [panes.length]);

  const removeSplit = useCallback((id: string) => {
    setPanes(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter(p => p.id !== id);
      return next.length === 0 ? [{ id: 'main' }] : next;
    });
    setSplitRatio(50);
  }, []);

  // Draggable divider
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
      {/* Split controls */}
      <div className="absolute top-2 right-2 z-30 flex items-center gap-1.5">
        {!isSplit && (
          <button
            onClick={addSplit}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50"
            title="Split view"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="2" width="14" height="12" rx="2" />
              <line x1="8" y1="2" x2="8" y2="14" />
            </svg>
            Split
          </button>
        )}
        {isSplit && panes.length < 3 && (
          <button
            onClick={addSplit}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors bg-zinc-800/80 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700/50"
            title="Add pane"
          >
            +
          </button>
        )}
      </div>

      {/* Pane container */}
      <div ref={containerRef} className="flex h-full w-full" style={{ cursor: isDragging ? 'col-resize' : undefined }}>
        {panes.map((pane, i) => (
          <React.Fragment key={pane.id}>
            <div
              className="relative h-full overflow-hidden"
              style={{
                width: isSplit
                  ? i === 0 ? `${splitRatio}%` : `${100 - splitRatio}%`
                  : '100%',
                transition: isDragging ? 'none' : 'width 0.2s ease',
              }}
            >
              {/* Close button for split pane */}
              {isSplit && (
                <button
                  onClick={() => removeSplit(pane.id)}
                  className="absolute top-2 left-2 z-20 w-6 h-6 flex items-center justify-content-center rounded-md text-xs bg-zinc-800/90 hover:bg-red-900/50 text-zinc-500 hover:text-red-400 border border-zinc-700/50 transition-colors"
                  title="Close pane"
                >
                  &times;
                </button>
              )}
              <iframe
                src={CLAUDE_CODE_URL}
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
                className="relative flex-shrink-0 group"
                style={{ width: '6px', cursor: 'col-resize' }}
              >
                <div className={`absolute inset-0 transition-colors ${isDragging ? 'bg-emerald-500/40' : 'bg-zinc-700/30 group-hover:bg-emerald-500/30'}`} />
                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8 rounded-full transition-colors ${isDragging ? 'bg-emerald-400' : 'bg-zinc-600 group-hover:bg-emerald-400/70'}`} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default CodePanel;
