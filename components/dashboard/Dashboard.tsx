import React, { useState, lazy, Suspense, useEffect } from 'react';
import { Toaster } from 'sonner';
import { isAuthenticated } from '../../lib/dashboardAuth';
import { DashboardProvider, useDashboard } from '../../contexts/DashboardContext';
import DashboardAuth from './DashboardAuth';
import DashboardLayout from './DashboardLayout';
import OverviewPanel from './OverviewPanel';
import WorkflowsPanel from './WorkflowsPanel';
import ContentPanel from './ContentPanel';
import LeadsPanel from './LeadsPanel';
import TasksPanel from './TasksPanel';
import SettingsPanel from './SettingsPanel';
import LoadingSkeleton from './shared/LoadingSkeleton';
import ErrorBoundary from './shared/ErrorBoundary';
import type { Tab } from '../../types/dashboard';

// After a deploy, browsers with stale index.html still reference old chunk
// hashes (e.g. VideoIdeasPanel-BSiLjuGl.js). The next `import()` throws
// "Failed to fetch dynamically imported module". First failure: force a hard
// reload so the browser picks up the new index.html (and bust query string to
// defeat the Pages CDN cache). The sessionStorage flag prevents infinite
// reload loops if the error is real (genuine network outage).
function retryImport<T>(factory: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await factory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const looksLikeStaleChunk =
        /dynamically imported module|Importing a module script failed|Failed to fetch|ChunkLoadError/i.test(msg);
      const alreadyReloaded = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('__chunk_reload') === '1';
      if (looksLikeStaleChunk && !alreadyReloaded && typeof window !== 'undefined') {
        sessionStorage.setItem('__chunk_reload', '1');
        const url = new URL(window.location.href);
        url.searchParams.set('_', Date.now().toString());
        window.location.replace(url.toString());
        // Return a never-resolving promise so React doesn't render the error UI
        // in the moment between setting location and the browser navigating.
        return new Promise<T>(() => {});
      }
      throw err;
    }
  };
}

// Clear the reload-guard on successful mount so the next stale-chunk error
// after a future deploy can reload again.
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => sessionStorage.removeItem('__chunk_reload'));
}

const LazyPerformancePanel = lazy(retryImport(() => import('./PerformancePanel')));
const LazyHealthPanel = lazy(retryImport(() => import('./HealthPanel')));
const LazyCompetitorIntelPanel = lazy(retryImport(() => import('./CompetitorIntelPanel')));
const LazyAgentPanel = lazy(retryImport(() => import('./AgentPanel')));
const LazyClientsPanel = lazy(retryImport(() => import('./ClientsPanel')));
const LazyUpworkPanel = lazy(retryImport(() => import('./UpworkPanel')));
const LazyOutreachPanel = lazy(retryImport(() => import('./OutreachPanel')));
const LazyRecordingsPanel = lazy(retryImport(() => import('./RecordingsPanel')));
const LazyAutoResearchPanel = lazy(retryImport(() => import('./AutoResearchPanel')));
const LazyMeetingsPanel = lazy(retryImport(() => import('./MeetingsPanel')));
const LazyCodePanel = lazy(retryImport(() => import('./CodePanel')));
const LazyUsagePanel = lazy(retryImport(() => import('./UsagePanel')));
const LazyVideoIdeasPanel = lazy(retryImport(() => import('./VideoIdeasPanel')));
const LazyAgentReadyPanel = lazy(retryImport(() => import('./AgentReadyPanel')));
const LazyAudiencePanel = lazy(retryImport(() => import('./AudiencePanel')));
const LazyLetterPanel = lazy(retryImport(() => import('./LetterPanel')));
const LazyStrategyPanel = lazy(retryImport(() => import('./StrategyPanel')));
const LazyBrainPanel = lazy(retryImport(() => import('./BrainPanel')));

const panelComponents: Record<Tab, React.ComponentType> = {
  overview: OverviewPanel,
  strategy: LazyStrategyPanel as unknown as React.ComponentType,
  performance: LazyPerformancePanel as unknown as React.ComponentType,
  content: ContentPanel,
  workflows: WorkflowsPanel,
  competitors: LazyCompetitorIntelPanel as unknown as React.ComponentType,
  leads: LeadsPanel,
  agent: LazyAgentPanel as unknown as React.ComponentType,
  clients: LazyClientsPanel as unknown as React.ComponentType,
  tasks: TasksPanel,
  upwork: LazyUpworkPanel as unknown as React.ComponentType,
  health: LazyHealthPanel as unknown as React.ComponentType,
  outreach: LazyOutreachPanel as unknown as React.ComponentType,
  recordings: LazyRecordingsPanel as unknown as React.ComponentType,
  'auto-research': LazyAutoResearchPanel as unknown as React.ComponentType,
  meetings: LazyMeetingsPanel as unknown as React.ComponentType,
  code: LazyCodePanel as unknown as React.ComponentType,
  usage: LazyUsagePanel as unknown as React.ComponentType,
  video: LazyVideoIdeasPanel as unknown as React.ComponentType,
  'agent-ready': LazyAgentReadyPanel as unknown as React.ComponentType,
  audience: LazyAudiencePanel as unknown as React.ComponentType,
  letter: LazyLetterPanel as unknown as React.ComponentType,
  brain: LazyBrainPanel as unknown as React.ComponentType,
  settings: SettingsPanel,
};

const validTabs = new Set<Tab>(Object.keys(panelComponents) as Tab[]);

function getInitialTab(): Tab {
  if (typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('tab');
    if (param && validTabs.has(param as Tab)) return param as Tab;
  }
  return 'overview';
}

// Prefetch lazy-loaded panel chunks after initial render
const lazyImports = [
  retryImport(() => import('./PerformancePanel')),
  retryImport(() => import('./HealthPanel')),
  retryImport(() => import('./CompetitorIntelPanel')),
  retryImport(() => import('./AgentPanel')),
  retryImport(() => import('./ClientsPanel')),
  retryImport(() => import('./UpworkPanel')),
  retryImport(() => import('./OutreachPanel')),
  retryImport(() => import('./RecordingsPanel')),
  retryImport(() => import('./AutoResearchPanel')),
  retryImport(() => import('./MeetingsPanel')),
  retryImport(() => import('./CodePanel')),
  retryImport(() => import('./UsagePanel')),
  retryImport(() => import('./VideoIdeasPanel')),
  retryImport(() => import('./AgentReadyPanel')),
  retryImport(() => import('./AudiencePanel')),
  retryImport(() => import('./LetterPanel')),
];

function usePrefetchPanels() {
  useEffect(() => {
    const schedule = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb: () => void) => setTimeout(cb, 2000);
    const cancel = typeof cancelIdleCallback === 'function' ? cancelIdleCallback : clearTimeout;
    const id = schedule(() => {
      lazyImports.forEach((fn) => fn());
    });
    return () => cancel(id);
  }, []);
}

const Dashboard: React.FC = () => {
  const [authed, setAuthed] = useState(isAuthenticated());
  const initialTab = getInitialTab();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set([initialTab]));
  usePrefetchPanels();

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
    // Sync tab to URL so refresh preserves position
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.replaceState({}, '', url.toString());
  };

  if (!authed) {
    return <DashboardAuth onSuccess={() => setAuthed(true)} />;
  }

  return (
    <DashboardProvider>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: { background: '#18181b', border: '1px solid rgba(63,63,70,0.6)', color: '#e4e4e7' },
        }}
        richColors
        closeButton
      />
      <TabNavBridge onTabChange={handleTabChange} />
      <DashboardLayout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={() => setAuthed(false)}
      >
        {Array.from(visitedTabs).map((tab) => {
          const Panel = panelComponents[tab];
          return (
            <div key={tab} style={{ display: tab === activeTab ? undefined : 'none' }}>
              <ErrorBoundary>
                <Suspense fallback={<LoadingSkeleton cards={4} rows={5} />}>
                  <Panel />
                </Suspense>
              </ErrorBoundary>
            </div>
          );
        })}
      </DashboardLayout>
    </DashboardProvider>
  );
};

/* Registers the tab change handler with DashboardContext */
const TabNavBridge: React.FC<{ onTabChange: (tab: import('../../types/dashboard').Tab) => void }> = ({ onTabChange }) => {
  const { setTabNavigator } = useDashboard();
  useEffect(() => { setTabNavigator(onTabChange); }, [onTabChange, setTabNavigator]);
  return null;
};

export default Dashboard;
