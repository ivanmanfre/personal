import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { useCommandPaletteV2 } from '../../hooks/useCommandPaletteV2';
import type { SectionId, NavItem, PaletteItem } from './types';
import './dashboard-v2.css';

const ALL_SECTIONS: SectionId[] = [
  'briefing', 'content', 'reach', 'ops', 'clients', 'knowledge', 'agent', 'personal',
];

interface ShellProps {
  navItems: NavItem[];                                              // dynamic, with badge counts from live data
  sectionRenderers: Partial<Record<SectionId, () => React.ReactNode>>; // each section is a function returning React
  paletteItems?: PaletteItem[];
}

/**
 * Dashboard v2 Shell.
 * Owns: section state (URL-synced), keyboard shortcuts, command palette, sidebar nav.
 * Does NOT own: data fetching (handled per-section), realtime subscriptions (per-hook).
 */
export function Shell({ navItems, sectionRenderers, paletteItems = [] }: ShellProps) {
  const [active, setActive] = useState<SectionId>(() => {
    if (typeof window === 'undefined') return 'briefing';
    const params = new URLSearchParams(window.location.search);
    const s = params.get('section') as SectionId | null;
    return s && ALL_SECTIONS.includes(s) ? s : 'briefing';
  });

  // Sync to URL — so refresh-to-same-place works (preserves v1 ?tab= contract)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('section') !== active) {
      params.set('section', active);
      const url = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
      window.history.replaceState(null, '', url);
    }
  }, [active]);

  // Listen for URL changes (popstate from history pushState in Briefing's
  // onNavigate, browser back/forward, deeplink rewrite). Without this, the
  // URL updates silently and the Shell never switches sections.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('section') as SectionId | null;
      if (s && ALL_SECTIONS.includes(s) && s !== active) {
        setActive(s);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [active]);

  // Keyboard ⌘0–⌘7 jump
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key >= '0' && e.key <= '7') {
        const idx = parseInt(e.key, 10);
        const target = navItems[idx];
        if (target) {
          e.preventDefault();
          setActive(target.id);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navItems]);

  // Auto-include section jump items in palette
  const paletteAll: PaletteItem[] = useMemo(() => {
    const sectionItems: PaletteItem[] = navItems.map((it, i) => ({
      id: `nav:${it.id}`,
      label: it.emphasis ? `${it.name}` : it.name,
      hint: i <= 7 ? `⌘${i}` : undefined,
      group: 'Sections',
      onSelect: () => setActive(it.id),
    }));
    return [...sectionItems, ...paletteItems];
  }, [navItems, paletteItems]);

  const palette = useCommandPaletteV2(paletteAll);

  const handleSelect = useCallback((id: SectionId) => setActive(id), []);

  const renderer = sectionRenderers[active];

  return (
    <div className="dashboard-v2">
      <div className="dashboard-v2-shell">
        <Sidebar items={navItems} active={active} onSelect={handleSelect} />
        <main className="dv-main">
          <div className="dv-panel" key={active}>
            {renderer ? renderer() : (
              <div style={{ padding: '4rem', color: 'var(--d-paper-dim)' }}>
                Section <code>{active}</code> not yet implemented.
              </div>
            )}
          </div>
        </main>
      </div>
      <CommandPalette {...palette} />
    </div>
  );
}
