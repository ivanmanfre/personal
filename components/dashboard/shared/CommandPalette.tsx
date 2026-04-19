import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { Tab } from '../../../types/dashboard';

export interface PaletteCommand {
  id: string;
  label: string;
  group?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  commands: PaletteCommand[];
}

const CommandPalette: React.FC<Props> = ({ open, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const hay = `${c.label} ${c.group || ''} ${(c.keywords || []).join(' ')}`.toLowerCase();
      // Loose substring match — matches "ovr" against "overview" etc. is too loose; use plain substring on tokens
      return q.split(/\s+/).every((token) => hay.includes(token));
    });
  }, [query, commands]);

  useEffect(() => { setActiveIdx(0); }, [query, open]);

  useEffect(() => {
    if (open) {
      // Focus the input after the modal mounts
      const id = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    } else {
      setQuery('');
    }
  }, [open]);

  // Keep active item in view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-cmd-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  if (!open) return null;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[activeIdx];
      if (cmd) { cmd.run(); onClose(); }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-lg bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Jump to a tab or action…"
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/60">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500 text-center">No matches</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                data-cmd-idx={i}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => { cmd.run(); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                  i === activeIdx ? 'bg-emerald-500/10 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-800/50'
                }`}
              >
                {cmd.icon && <span className={i === activeIdx ? 'text-emerald-400' : 'text-zinc-500'}>{cmd.icon}</span>}
                <span className="text-sm flex-1 truncate">{cmd.label}</span>
                {cmd.group && <span className="text-[11px] text-zinc-600 shrink-0">{cmd.group}</span>}
              </button>
            ))
          )}
        </div>

        <div className="px-4 py-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-600">
          <span className="flex items-center gap-3">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> open</span>
          </span>
          <span><kbd className="font-mono">⌘K</kbd> to toggle</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

/** Hook: registers ⌘K / Ctrl+K to toggle the palette */
export function useCommandPaletteHotkey(setOpen: React.Dispatch<React.SetStateAction<boolean>>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);
}

/** Build a default command list from tab groups */
export function commandsFromTabs(
  tabGroups: { label: string | null; tabs: { id: Tab; label: string; icon: React.ReactNode }[] }[],
  onNavigate: (tab: Tab) => void
): PaletteCommand[] {
  return tabGroups.flatMap((g) =>
    g.tabs.map((t) => ({
      id: `tab-${t.id}`,
      label: t.label,
      group: g.label || 'General',
      icon: t.icon,
      keywords: [t.id, g.label || ''].filter(Boolean) as string[],
      run: () => onNavigate(t.id),
    }))
  );
}
