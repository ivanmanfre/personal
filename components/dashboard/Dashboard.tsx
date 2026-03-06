import React, { useState } from 'react';
import { isAuthenticated } from '../../lib/dashboardAuth';
import DashboardAuth from './DashboardAuth';
import DashboardLayout, { type Tab } from './DashboardLayout';
import OverviewPanel from './OverviewPanel';
import PerformancePanel from './PerformancePanel';
import LeadsPanel from './LeadsPanel';
import SettingsPanel from './SettingsPanel';

const Dashboard: React.FC = () => {
  const [authed, setAuthed] = useState(isAuthenticated());
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  if (!authed) {
    return <DashboardAuth onSuccess={() => setAuthed(true)} />;
  }

  const panels: Record<Tab, React.ReactNode> = {
    overview: <OverviewPanel />,
    performance: <PerformancePanel />,
    leads: <LeadsPanel />,
    settings: <SettingsPanel />,
  };

  return (
    <DashboardLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={() => setAuthed(false)}
    >
      {panels[activeTab]}
    </DashboardLayout>
  );
};

export default Dashboard;
