import React, { useState, lazy, Suspense, useEffect } from 'react';
import { isAuthenticated } from '../../lib/dashboardAuth';
import { DashboardProvider, useDashboard } from '../../contexts/DashboardContext';
import DashboardAuth from './DashboardAuth';
import DashboardLayout from './DashboardLayout';
import OverviewPanel from './OverviewPanel';
import WorkflowsPanel from './WorkflowsPanel';
import CompetitorIntelPanel from './CompetitorIntelPanel';
import LeadsPanel from './LeadsPanel';
import AgentPanel from './AgentPanel';
import ClientsPanel from './ClientsPanel';
import ContentPanel from './ContentPanel';
import TasksPanel from './TasksPanel';
import UpworkPanel from './UpworkPanel';
import SettingsPanel from './SettingsPanel';
import LoadingSkeleton from './shared/LoadingSkeleton';
import ErrorBoundary from './shared/ErrorBoundary';
import type { Tab } from '../../types/dashboard';

const LazyPerformancePanel = lazy(() => import('./PerformancePanel'));
const LazyHealthPanel = lazy(() => import('./HealthPanel'));

const panelComponents: Record<Tab, React.ComponentType> = {
  overview: OverviewPanel,
  performance: LazyPerformancePanel as unknown as React.ComponentType,
  content: ContentPanel,
  workflows: WorkflowsPanel,
  competitors: CompetitorIntelPanel,
  leads: LeadsPanel,
  agent: AgentPanel,
  clients: ClientsPanel,
  tasks: TasksPanel,
  upwork: UpworkPanel,
  health: LazyHealthPanel as unknown as React.ComponentType,
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

const Dashboard: React.FC = () => {
  const [authed, setAuthed] = useState(isAuthenticated());
  const initialTab = getInitialTab();
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set([initialTab]));

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
