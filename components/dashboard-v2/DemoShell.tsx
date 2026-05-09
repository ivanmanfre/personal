import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { DashboardProvider } from '../../contexts/DashboardContext';
import { Shell } from './Shell';
import { Briefing } from './sections/Briefing';
import { HeadRow } from './primitives';
import type { NavItem, SectionId } from './types';

/**
 * Phase 1 entry point.
 * Briefing wired to live Supabase data. Other 7 sections still placeholder
 * (filled in phases 2-6).
 *
 * Mount via /dashboard-v2 route. Existing /dashboard untouched.
 */
function ShellInner() {
  const [_, setActiveSection] = useState<SectionId>('briefing');

  // Nav items — badge counts will become live in phase 5+ (currently static).
  // Briefing badge will compute from `Action Required` count once we lift it.
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

  // Helper handed to Briefing so it can deep-link to other sections.
  // Once phases 2-6 ship, Shell will own this navigation directly.
  const handleNav = (sec: SectionId, _sub?: string) => {
    setActiveSection(sec);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('section', sec);
      if (_sub) url.searchParams.set('sub', _sub);
      window.history.replaceState(null, '', url.toString());
      // Force Shell to pick up by reloading the section state — for now
      // the Shell reads from its own state, so refresh as a stopgap.
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  const sectionRenderers: Partial<Record<SectionId, () => React.ReactNode>> = {
    briefing: () => <Briefing onNavigate={handleNav} />,
    content: () => <Placeholder title="Content Studio" />,
    reach: () => <Placeholder title="Reach & Pipeline" />,
    ops: () => <Placeholder title="Operations" />,
    clients: () => <Placeholder title="Clients" />,
    knowledge: () => <Placeholder title="Knowledge" />,
    agent: () => <Placeholder title="Agent" />,
    personal: () => <Placeholder title="Personal" />,
  };

  return <Shell navItems={navItems} sectionRenderers={sectionRenderers} />;
}

function Placeholder({ title }: { title: string }) {
  return (
    <>
      <HeadRow title={title} meta="Coming in next phase" />
      <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)', fontSize: 14 }}>
        This section will be wired in subsequent phases. The shell, primitives,
        and Briefing data wiring (Phase 1) are live.
      </div>
    </>
  );
}

export default function DemoShell() {
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
    </DashboardProvider>
  );
}
