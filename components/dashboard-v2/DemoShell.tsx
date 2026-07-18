import React, { useEffect } from 'react';
import { Toaster } from 'sonner';
import { DashboardProvider } from '../../contexts/DashboardContext';
import { Shell } from './Shell';
import { PwaInstall } from './PwaInstall';
import { registerServiceWorker } from './registerSW';
import { Today } from './sections/Today';
import { WarmPipeline } from './sections/WarmPipeline';
import { ClientsRoadmap } from './sections/ClientsRoadmap';
import { ContentStudio } from './sections/ContentStudio';
import { SystemPulse } from './sections/SystemPulse';
import { LiveProvider } from './live/LiveProvider';
import type { NavItem, SectionId } from './types';

/**
 * Dashboard v2 entry point.
 * All 8 sections wired. Briefing uses live data via composed hooks (Phase 1).
 * Phases 2-6 wrap existing panels in v2 sub-tabs to preserve every write
 * path documented in INVENTORY.md without rewriting them.
 */
function ShellInner() {
  // Editorial Cockpit (Direction A) — new 5-section nav, born-dead on this
  // branch. LiveProvider + existing section components stay wired underneath.
  const navItems: NavItem[] = [
    { id: 'today', name: 'Today', emphasis: 'Today', group: 'briefing' },
    { id: 'content', name: 'Content', num: '01', group: 'operate' },
    { id: 'pipeline', name: 'Pipeline', num: '02', group: 'operate' },
    { id: 'clients', name: 'Clients', num: '03', group: 'knowledge' },
    { id: 'system', name: 'System', num: '⊙', group: 'knowledge' },
  ];

  // Briefing's onNavigate signature includes optional sub-tab.
  // We sync section + sub via URL params so each section reads its own
  // ?sub= on mount.
  const handleNav = (sec: SectionId, sub?: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('section', sec);
    if (sub) url.searchParams.set('sub', sub);
    else url.searchParams.delete('sub');
    window.history.pushState(null, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const sectionRenderers: Partial<Record<SectionId, () => React.ReactNode>> = {
    today: () => <Today onNavigate={handleNav} />,
    content: () => <ContentStudio />,          // embeds PostStudioPanel UNMODIFIED
    pipeline: () => <WarmPipeline />,
    clients: () => <ClientsRoadmap />,
    system: () => <SystemPulse />,
  };

  return <Shell navItems={navItems} sectionRenderers={sectionRenderers} />;
}

export default function DemoShell() {
  useEffect(() => {
    registerServiceWorker();
    // Force body to use v2 light theme + Inter (overrides public-site cream/serif)
    document.body.classList.add('dashboard-v2-light');
    // If we landed here via /dashboard?tab=foo, rewrite to v2 equivalent
    import('../../lib/dashboardUrlMigration').then(({ migrateV1Url }) => {
      if (migrateV1Url()) {
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
    return () => { document.body.classList.remove('dashboard-v2-light'); };
  }, []);
  return (
    <DashboardProvider>
      <Toaster
        theme="light"
        position="top-right"
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#0f172a',
            border: '1px solid #e9e9ee',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 13,
          },
        }}
      />
      <LiveProvider>
        <ShellInner />
      </LiveProvider>
      <PwaInstall />
    </DashboardProvider>
  );
}
