import React, { useState } from 'react';
import { BarChart3, Users, Settings, LayoutDashboard, LogOut, Menu, X, Activity, Swords, Bot, Server, CheckSquare, Calendar, Briefcase } from 'lucide-react';
import { logout } from '../../lib/dashboardAuth';
import StatusDot from './shared/StatusDot';
import RefreshIndicator from './shared/RefreshIndicator';
import { useDashboard } from '../../contexts/DashboardContext';
import type { Tab } from '../../types/dashboard';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

const tabGroups: { label: string | null; tabs: { id: Tab; label: string; icon: React.ReactNode }[] }[] = [
  {
    label: null,
    tabs: [
      { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    ],
  },
  {
    label: 'Content',
    tabs: [
      { id: 'performance', label: 'Performance', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
      { id: 'content', label: 'Content', icon: <Calendar className="w-[18px] h-[18px]" /> },
      { id: 'competitors', label: 'Competitors', icon: <Swords className="w-[18px] h-[18px]" /> },
    ],
  },
  {
    label: 'Systems',
    tabs: [
      { id: 'workflows', label: 'Workflows', icon: <Activity className="w-[18px] h-[18px]" /> },
      { id: 'leads', label: 'Leads', icon: <Users className="w-[18px] h-[18px]" /> },
      { id: 'agent', label: 'Agent', icon: <Bot className="w-[18px] h-[18px]" /> },
    ],
  },
  {
    label: 'Operations',
    tabs: [
      { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-[18px] h-[18px]" /> },
      { id: 'clients', label: 'Clients', icon: <Server className="w-[18px] h-[18px]" /> },
      { id: 'upwork', label: 'Upwork', icon: <Briefcase className="w-[18px] h-[18px]" /> },
    ],
  },
];

const DashboardLayout: React.FC<Props> = ({ activeTab, onTabChange, onLogout, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { systemHealth, lastRefreshed } = useDashboard();

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const healthStatus = systemHealth === 'healthy' ? 'healthy' : systemHealth === 'degraded' ? 'warning' : 'error';

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-zinc-400 hover:text-white transition-colors">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-emerald-600/90 flex items-center justify-center text-[10px] font-bold text-white">IM</div>
          <span className="text-sm font-semibold text-zinc-200">Ivan System</span>
          <StatusDot status={healthStatus} pulse />
        </div>
        <div className="w-5" />
      </div>

      {/* Sidebar overlay (mobile) */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 z-40 h-screen w-[220px] bg-zinc-900/95 backdrop-blur-md border-r border-zinc-800/80 flex flex-col transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 pb-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-emerald-500/10">
              IM
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-white leading-tight truncate">Ivan System</p>
                <StatusDot status={healthStatus} pulse />
              </div>
              <p className="text-[11px] text-zinc-500">Ivan Manfredi</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-2 overflow-y-auto">
          {tabGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-3' : ''}>
              {group.label && (
                <p className="px-3 pt-1 pb-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-widest">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => { onTabChange(tab.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 relative ${
                        isActive
                          ? 'bg-zinc-800/80 text-white'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-emerald-500 rounded-r-full" />
                      )}
                      <span className={isActive ? 'text-emerald-400' : ''}>{tab.icon}</span>
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-2 pb-3 pt-2 border-t border-zinc-800/80 space-y-1.5">
          <button
            onClick={() => { onTabChange('settings'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 relative ${
              activeTab === 'settings'
                ? 'bg-zinc-800/80 text-white'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40'
            }`}
          >
            {activeTab === 'settings' && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-emerald-500 rounded-r-full" />
            )}
            <span className={activeTab === 'settings' ? 'text-emerald-400' : ''}>
              <Settings className="w-[18px] h-[18px]" />
            </span>
            Settings
          </button>
          <div className="px-3 py-1">
            <RefreshIndicator lastRefreshed={lastRefreshed} />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-all duration-150"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-0 mt-14 md:mt-0">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
