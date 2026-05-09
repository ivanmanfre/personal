import { useEffect, useState, useCallback } from 'react';
import type { PaletteItem } from '../components/dashboard-v2/types';

/**
 * v2 command palette hook.
 * Opens on ⌘K / Ctrl+K, closes on Escape.
 * Items list is provided by caller and filtered by query.
 */
export function useCommandPaletteV2(allItems: PaletteItem[]) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);

  const filtered = query
    ? allItems.filter(i => i.label.toLowerCase().includes(query.toLowerCase()))
    : allItems;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setActiveIdx(0);
      } else if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      } else if (open && e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (open && e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(i => Math.max(i - 1, 0));
      } else if (open && e.key === 'Enter') {
        e.preventDefault();
        const it = filtered[activeIdx];
        if (it) { it.onSelect(); setOpen(false); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, activeIdx]);

  const close = useCallback(() => setOpen(false), []);
  const selectAt = useCallback((idx: number) => {
    const it = filtered[idx];
    if (it) { it.onSelect(); setOpen(false); }
  }, [filtered]);

  return { open, setOpen, query, setQuery, filtered, activeIdx, setActiveIdx, close, selectAt };
}
