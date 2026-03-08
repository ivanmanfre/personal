import React, { useState } from 'react';
import { isAuthenticated } from '../../lib/dashboardAuth';
import { DashboardProvider } from '../../contexts/DashboardContext';
import DashboardAuth from './DashboardAuth';
import DashboardLayout from './DashboardLayout';
import OverviewPanel from './OverviewPanel';
import PerformancePanel from './PerformancePanel';
import WorkflowsPanel from './WorkflowsPanel';
import CompetitorIntelPanel from './CompetitorIntelPanel';
import LeadsPanel from './LeadsPanel';
import AgentPanel from './AgentPanel';
import ClientsPanel from './ClientsPanel';
import ContentPanel from './ContentPanel';
import TasksPanel from './TasksPanel';
import UpworkPanel from './UpworkPanel';
import SettingsPanel from './SettingsPanel';
import type { Tab } from '../../types/dashboard';

const Dashboard: React.FC = () => {
  const [authed, setAuthed] = useState(isAuthenticated());
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  if (!authed) {
    return <DashboardAuth onSuccess={() => setAuthed(true)} />;
  }

  const panels: Record<Tab, React.ReactNode> = {
    overview: <OverviewPanel />,
    performance: <PerformancePanel />,
    content: <ContentPanel />,
    workflows: <WorkflowsPanel />,
    competitors: <CompetitorIntelPanel />,
    leads: <LeadsPanel />,
    agent: <AgentPanel />,
    clients: <ClientsPanel />,
    tasks: <TasksPanel />,
    upwork: <UpworkPanel />,
    settings: <SettingsPanel />,
  };

  return (
    <DashboardProvider>
      <DashboardLayout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={() => setAuthed(false)}
      >
        {panels[activeTab]}
      </DashboardLayout>
    </DashboardProvider>
  );
};

export default Dashboard;
