import React, { useState, lazy, Suspense } from 'react';
import { isAuthenticated } from '../../lib/dashboardAuth';
import { DashboardProvider } from '../../contexts/DashboardContext';
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
import type { Tab } from '../../types/dashboard';

const LazyPerformancePanel = lazy(() => import('./PerformancePanel'));

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
  settings: SettingsPanel,
};

const Dashboard: React.FC = () => {
  const [authed, setAuthed] = useState(isAuthenticated());
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set(['overview']));

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  };

  if (!authed) {
    return <DashboardAuth onSuccess={() => setAuthed(true)} />;
  }

  return (
    <DashboardProvider>
      <DashboardLayout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={() => setAuthed(false)}
      >
        {Array.from(visitedTabs).map((tab) => {
          const Panel = panelComponents[tab];
          return (
            <div key={tab} style={{ display: tab === activeTab ? undefined : 'none' }}>
              <Suspense fallback={<LoadingSkeleton cards={4} rows={5} />}>
                <Panel />
              </Suspense>
            </div>
          );
        })}
      </DashboardLayout>
    </DashboardProvider>
  );
};

export default Dashboard;
