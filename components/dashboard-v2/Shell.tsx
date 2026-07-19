import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';
import { NotificationBell } from './NotificationBell';
import { useCommandPaletteV2 } from '../../hooks/useCommandPaletteV2';
import { onNav } from './lib/navBus';
import { LiveStatus } from './live/LiveStatus';
import { useNavDots } from '../../lib/useChangelog';
import type { SectionId, NavItem, PaletteItem } from './types';
import './dashboard-v2.css';

// Round 2 (A-seed) legacy slug remap. Every one of the 11 legacy section ids —
// plus the retired standalone slugs — points at its new round-2 home so old
// ?section= deeplinks never dead-end (Ivan feedback #1: nothing disappears).
const LEGACY_SECTION_REMAP: Record<string, SectionId> = {
  briefing: 'today',
  content: 'posts',    // Content group opens on the Posts board
  reach: 'outreach',   // Pipeline group opens on the Outreach work surface
  ops: 'health',       // System health absorbs Overview + Workflows + Scheduled Ops
  clients: 'risedtc',  // Clients group opens on the Rise DTC desk
  knowledge: 'brain',  // Brain is the knowledge home (Prompts lives under Content)
  system: 'health',    // legacy "system" = System health
  ideas: 'posts',      // content ideas are the Idea STAGE on the Posts board
  steal: 'opsideas',
  warm: 'outreach',    // Warm nav retired → folded into Outreach work surface
  boards: 'risedtc',   // Boards nav retired → Rise DTC is the live client home
  healthp: 'personal', // personal Health nav retired → Personal keeps the sub-tab
};

function resolveSection(raw: string | null, valid: Set<string>): SectionId | null {
  if (!raw) return null;
  const mapped = LEGACY_SECTION_REMAP[raw] ?? raw;
  return valid.has(mapped) ? mapped : null;
}

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
  const validKeys = useMemo(() => new Set(Object.keys(sectionRenderers)), [sectionRenderers]);

  const [active, setActive] = useState<SectionId>(() => {
    if (typeof window === 'undefined') return 'today';
    const params = new URLSearchParams(window.location.search);
    return resolveSection(params.get('section'), new Set(Object.keys(sectionRenderers))) ?? 'today';
  });

  // Nav bus — lets any caller drive section changes
  // without needing a direct reference to setActive.
  useEffect(() => {
    return onNav(({ section }) => setActive(section));
  }, []);

  // Section nav is an instant swap (Linear/Vercel-style) — no view transition.
  // A cross-fade superimposed two lazy-loaded layouts (and snapshotted the
  // Suspense fallback), which read as an ugly double-exposure. Polish lives in
  // hover/micro-interactions instead.

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
      const s = resolveSection(params.get('section'), validKeys);
      if (s && s !== active) {
        setActive(s);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [active, validKeys]);

  // Deeplink navigation (e.g. the notification bell) remounts the active panel so
  // the target section re-reads its `sub`/`otab` from the URL — sections only read
  // those on mount, so a same-section sub-tab jump otherwise wouldn't switch.
  const [navNonce, setNavNonce] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onDeep = () => setNavNonce((n) => n + 1);
    window.addEventListener('dashboard:deeplink', onDeep);
    return () => window.removeEventListener('dashboard:deeplink', onDeep);
  }, []);

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

  // Mobile off-canvas nav drawer. The 240px rail has no room on a phone, so
  // below 768px the sidebar slides in over the content via a hamburger.
  const [navOpen, setNavOpen] = useState(false);

  // Desktop sidebar collapse — rails the 240px nav down to a 66px icon strip.
  // Persisted so the choice survives reloads. Mobile ignores it (CSS scopes the
  // rail visuals to min-width:769px; the drawer always shows full labels).
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('dv-rail') === '1';
  });
  const toggleCollapsed = useCallback(() => {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem('dv-rail', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ⌘\ / Ctrl+\ toggles the rail (standard sidebar-collapse shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleCollapsed]);

  const handleSelect = useCallback((id: SectionId) => {
    setActive(id);
    setNavOpen(false); // choosing a section dismisses the drawer
  }, []);

  // Close the drawer on Escape, and whenever we grow back to desktop width
  // (so a resize/rotate never leaves it stuck open over the desktop layout).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNavOpen(false); };
    const onResize = () => { if (window.innerWidth > 768) setNavOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); };
  }, []);

  const renderer = sectionRenderers[active];

  // Nav change-dots: mark entries whose source changed since last visited.
  // Clears when the section is opened (active === id). See useNavDots.
  const navDots = useNavDots(active);
  const dottedIds = new Set(navItems.filter((it) => navDots.has(it.id)).map((it) => it.id));

  return (
    <div className="dashboard-v2">
        <div className={`dashboard-v2-shell ${collapsed ? 'dashboard-v2-shell--rail' : ''}`}>
          {/* Top bar — hosts the mobile hamburger + brand, and the notification
              bell on the right (slim sticky bar on desktop, see dashboard-v2.css). */}
          <header className="dv-topbar">
            <button
              type="button"
              className="dv-hamburger"
              aria-label="Open navigation"
              aria-expanded={navOpen}
              onClick={() => setNavOpen(true)}
            >
              <span /><span /><span />
            </button>
            <div className="dv-topbar-brand">Ivan <em>System</em></div>
          </header>

          {/* Notification bell — fixed top-right, layout-independent so it shows on
              every section/viewport without disturbing the shell's sidebar+main grid. */}
          <NotificationBell />

          {/* Scrim behind the open drawer (mobile only) */}
          <div
            className={`dv-scrim ${navOpen ? 'dv-scrim--show' : ''}`}
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />

          <Sidebar items={navItems} active={active} onSelect={handleSelect} open={navOpen} onClose={() => setNavOpen(false)} collapsed={collapsed} onToggleCollapse={toggleCollapsed} dots={dottedIds} />
          <main className="dv-main">
            <div className="dv-panel" key={`${active}:${navNonce}`}>
              {renderer ? renderer() : (
                <div style={{ padding: '4rem', color: 'var(--ds-dim)' }}>
                  Section <code>{active}</code> not yet implemented.
                </div>
              )}
            </div>
          </main>
        </div>
        <CommandPalette {...palette} />
        <LiveStatus />
      </div>
  );
}
