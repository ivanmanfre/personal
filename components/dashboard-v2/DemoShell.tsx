import React, { useEffect, lazy, Suspense } from 'react';
import { Toaster } from 'sonner';
import { DashboardProvider } from '../../contexts/DashboardContext';
import { Shell } from './Shell';
import { PwaInstall } from './PwaInstall';
import { registerServiceWorker } from './registerSW';
import { Today } from './sections/Today';
import { ClientsRoadmap } from './sections/ClientsRoadmap';
import { SystemPulse } from './sections/SystemPulse';
import { StylesLive } from './sections/StylesLive';
import { StealBox } from './sections/StealBox';
import { Personal } from './sections/Personal';
import { InternalTabs } from '../dashboard/InternalTabs';
import { LiveProvider } from './live/LiveProvider';
import type { NavItem, SectionId } from './types';

/**
 * Dashboard v2 entry point — ROUND 2 (Direction A seed).
 *
 * Ivan feedback on round 1: the 5-entry nav made his 11 live categories look
 * vanished. Round 2 gives every legacy category + its subsections a VISIBLE,
 * clickable home via a grouped nav (Content / Pipeline / Clients / System +
 * Today, Personal, Archive). Born surfaces (Today, Warm, Pulse, Clients) keep
 * the Black Box v4 white-paper register; every other subsection reuses its
 * existing v1 panel UNMODIFIED (lazy-loaded — never rebuilt).
 */

// ── Lazy v1 panels (reused as-is, never restyled) ──────────────────────────
const PostStudioPanel = lazy(() => import('../dashboard/PostStudioPanel'));
const LeadMagnetStudioPanel = lazy(() => import('../dashboard/LeadMagnetStudioPanel'));
const PromptLibraryPanel = lazy(() => import('../dashboard/PromptLibraryPanel'));
const AudienceAuditsPanel = lazy(() => import('../dashboard/AudienceAuditsPanel'));
const MeetingsPanel = lazy(() => import('../dashboard/MeetingsPanel'));
const OverviewPanel = lazy(() => import('../dashboard/OverviewPanel'));
const WorkflowsPanel = lazy(() => import('../dashboard/WorkflowsPanel'));
const ScheduledOpsPanel = lazy(() => import('../dashboard/ScheduledOpsPanel'));
const StrategyPanel = lazy(() => import('../dashboard/StrategyPanel'));
const BrainPanel = lazy(() => import('../dashboard/BrainPanel'));
const AgentPanel = lazy(() => import('../dashboard/AgentPanel'));
const UsagePanel = lazy(() => import('../dashboard/UsagePanel'));
const LetterPanel = lazy(() => import('../dashboard/LetterPanel'));
const CompetitorIntelPanel = lazy(() => import('../dashboard/CompetitorIntelPanel'));
const SignalClustersPanel = lazy(() => import('../dashboard/SignalClustersPanel'));
const VideoIdeasPanel = lazy(() => import('../dashboard/VideoIdeasPanel'));
const RecordingsPanel = lazy(() => import('../dashboard/RecordingsPanel'));
const UpworkPanel = lazy(() => import('../dashboard/UpworkPanel'));

const PanelLoading = () => (
  <div style={{ padding: '2rem 2.5rem', color: 'var(--d-paper-dim)', fontSize: 13 }}>Loading panel…</div>
);

// Wrap a lazy v1 panel in Suspense. The panel keeps its own (dark) chrome and
// every write path — this is the ContentStudio-wrapper doctrine: reuse, do not
// rebuild.
const host = (node: React.ReactNode) => () => <Suspense fallback={<PanelLoading />}>{node}</Suspense>;

// Direction B (worksurf): Split-lane Desk working surfaces. Each carries its
// own Desk/Board (or Approve/Studio) toggle and lazy-loads the classic panel
// internally, keeping every classic capability reachable.
const PostWorkSurface = lazy(() => import('./review/PostWorkSurface'));
const LmWorkSurface = lazy(() => import('./review/LmWorkSurface'));
const OutreachWorkSurface = lazy(() => import('./review/OutreachWorkSurface'));

// ── Nav model: [group] → visible subsection entries. Every one of the 11
// legacy section ids resolves here (see notes.md mapping table). ────────────
const NAV: { group: string; items: { id: string; name: string; render: () => React.ReactNode }[] }[] = [
  {
    group: 'today',
    items: [
      { id: 'today', name: 'Today', render: () => <Today onNavigate={handleNavRef} /> },
    ],
  },
  {
    group: 'content',
    items: [
      { id: 'posts', name: 'Posts', render: host(<PostWorkSurface />) },
      { id: 'lmstudio', name: 'LM Studio', render: host(<LmWorkSurface />) },
      { id: 'styles', name: 'Styles', render: () => <StylesLive /> },
      { id: 'prompts', name: 'Prompts', render: host(<PromptLibraryPanel />) },
    ],
  },
  {
    group: 'pipeline',
    items: [
      { id: 'outreach', name: 'Outreach', render: host(<OutreachWorkSurface />) },
      { id: 'scans', name: 'Scans', render: host(<AudienceAuditsPanel />) },
      { id: 'calls', name: 'Calls', render: host(<MeetingsPanel />) },
    ],
  },
  {
    group: 'clients',
    items: [
      { id: 'risedtc', name: 'Rise DTC', render: () => <ClientsRoadmap /> },
    ],
  },
  {
    group: 'system',
    items: [
      { id: 'pulse', name: 'Pulse', render: () => <SystemPulse /> },
      {
        id: 'health',
        name: 'Health',
        render: host(
          <InternalTabs
            storageKey="r2-system-health-tab"
            tabs={[
              { key: 'overview', label: 'Overview', render: () => <OverviewPanel /> },
              { key: 'workflows', label: 'Workflows', render: () => <WorkflowsPanel /> },
              { key: 'ops', label: 'Scheduled Ops', render: () => <ScheduledOpsPanel /> },
            ]}
          />,
        ),
      },
      { id: 'positioning', name: 'Positioning', render: host(<StrategyPanel />) },
      { id: 'brain', name: 'Brain', render: host(<BrainPanel />) },
      { id: 'agent', name: 'Agent', render: host(<AgentPanel />) },
      { id: 'usage', name: 'Usage', render: host(<UsagePanel />) },
      { id: 'opsideas', name: 'Ops Ideas', render: () => <StealBox /> },
    ],
  },
  {
    group: 'personal',
    items: [
      { id: 'personal', name: 'Personal', render: () => <Personal /> },
    ],
  },
  {
    group: 'archive',
    items: [
      { id: 'newsletter', name: 'Newsletter', render: host(<LetterPanel />) },
      { id: 'competitors', name: 'Competitors', render: host(<CompetitorIntelPanel />) },
      { id: 'signalclusters', name: 'Signal Clusters', render: host(<SignalClustersPanel />) },
      { id: 'video', name: 'Video', render: host(<VideoIdeasPanel />) },
      { id: 'recordings', name: 'Recordings', render: host(<RecordingsPanel />) },
      { id: 'upwork', name: 'Upwork', render: host(<UpworkPanel />) },
    ],
  },
];

// Today navigates cross-section via this ref (set inside ShellInner).
let handleNavRef: (sec: SectionId, sub?: string) => void = () => {};

function ShellInner() {
  const navItems: NavItem[] = NAV.flatMap(g => g.items.map(it => ({ id: it.id, name: it.name, group: g.group })));

  const sectionRenderers: Partial<Record<SectionId, () => React.ReactNode>> = {};
  NAV.forEach(g => g.items.forEach(it => { sectionRenderers[it.id] = it.render; }));

  handleNavRef = (sec: SectionId, sub?: string) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('section', sec);
    if (sub) url.searchParams.set('sub', sub);
    else url.searchParams.delete('sub');
    window.history.pushState(null, '', url.toString());
    window.dispatchEvent(new PopStateEvent('popstate'));
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
