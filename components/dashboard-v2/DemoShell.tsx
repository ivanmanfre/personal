import React, { useEffect } from 'react';
import { Toaster } from 'sonner';
import { DashboardProvider } from '../../contexts/DashboardContext';
import { Shell } from './Shell';
import { PwaInstall } from './PwaInstall';
import { registerServiceWorker } from './registerSW';
import { Briefing } from './sections/Briefing';
import { ContentStudio } from './sections/ContentStudio';
import { ReachPipeline } from './sections/ReachPipeline';
import { Operations } from './sections/Operations';
import { Clients } from './sections/Clients';
import { Knowledge } from './sections/Knowledge';
import { Agent } from './sections/Agent';
import { Personal } from './sections/Personal';
import type { NavItem, SectionId } from './types';

/**
 * Dashboard v2 entry point.
 * All 8 sections wired. Briefing uses live data via composed hooks (Phase 1).
 * Phases 2-6 wrap existing panels in v2 sub-tabs to preserve every write
 * path documented in INVENTORY.md without rewriting them.
 */
function ShellInner() {
  const navItems: NavItem[] = [
    { id: 'briefing', name: 'Briefing', emphasis: 'Briefing', num: '⊙', group: 'briefing' },
    { id: 'content', name: 'Content Studio', num: '01', group: 'operate' },
    { id: 'reach', name: 'Reach & Pipeline', num: '02', group: 'operate' },
    { id: 'ops', name: 'Operations', num: '03', group: 'operate' },
    { id: 'clients', name: 'Clients', num: '04', group: 'knowledge' },
    { id: 'knowledge', name: 'Knowledge', num: '05', group: 'knowledge' },
    { id: 'agent', name: 'Agent', num: '06', group: 'knowledge' },
    { id: 'personal', name: 'Personal', num: '07', group: 'personal' },
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
    briefing: () => <Briefing onNavigate={handleNav} />,
    content: () => <ContentStudio />,
    reach: () => <ReachPipeline />,
    ops: () => <Operations />,
    clients: () => <Clients />,
    knowledge: () => <Knowledge />,
    agent: () => <Agent />,
    personal: () => <Personal />,
  };

  return <Shell navItems={navItems} sectionRenderers={sectionRenderers} />;
}

export default function DemoShell() {
  useEffect(() => {
    registerServiceWorker();
    // If we landed here via /dashboard?tab=foo, rewrite to v2 equivalent
    import('../../lib/dashboardUrlMigration').then(({ migrateV1Url }) => {
      if (migrateV1Url()) {
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    });
  }, []);
  return (
    <DashboardProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#18181c',
            color: '#e7e7ea',
            border: '1px solid rgba(231,231,234,0.15)',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 13,
          },
        }}
      />
      <ShellInner />
      <PwaInstall />
    </DashboardProvider>
  );
}
