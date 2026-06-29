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
import { SystemOverview } from './sections/SystemOverview';
import { Personal } from './sections/Personal';
import { StealBox } from './sections/StealBox';
import { useScheduledChecks } from '../../hooks/useScheduledChecks';
import type { NavItem, SectionId } from './types';

/**
 * Dashboard v2 entry point.
 * All 8 sections wired. Briefing uses live data via composed hooks (Phase 1).
 * Phases 2-6 wrap existing panels in v2 sub-tabs to preserve every write
 * path documented in INVENTORY.md without rewriting them.
 */
function ShellInner() {
  const { stats: checkStats } = useScheduledChecks();
  const navItems: NavItem[] = [
    { id: 'briefing', name: 'Briefing', emphasis: 'Briefing', group: 'briefing' },
    { id: 'content', name: 'Content Studio', num: '01', group: 'operate' },
    { id: 'reach', name: 'Reach & Pipeline', num: '02', group: 'operate' },
    { id: 'ops', name: 'Operations', num: '03', group: 'operate', ...(checkStats.due > 0 ? { badge: { count: checkStats.due, severity: 'bad' as const } } : {}) },
    { id: 'clients', name: 'Clients', num: '04', group: 'knowledge' },
    { id: 'knowledge', name: 'Knowledge', num: '05', group: 'knowledge' },
    { id: 'agent', name: 'Agent', num: '06', group: 'knowledge' },
    { id: 'opsideas', name: 'Ops Ideas', num: '07', group: 'knowledge' },
    { id: 'system', name: 'System', num: '08', group: 'knowledge' },
    { id: 'personal', name: 'Personal', num: '09', group: 'personal' },
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
    opsideas: () => <StealBox />,
    system: () => <SystemOverview />,
    personal: () => <Personal />,
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
      <ShellInner />
      <PwaInstall />
    </DashboardProvider>
  );
}
