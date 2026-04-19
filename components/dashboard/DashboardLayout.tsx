import React, { useMemo, useState } from 'react';
import { BarChart3, Users, Settings, LayoutDashboard, LogOut, Menu, X, Activity, Swords, Bot, Server, CheckSquare, Calendar, Briefcase, Heart, Target, Video, FlaskConical, Phone, Terminal, Film, Search } from 'lucide-react';
import { logout } from '../../lib/dashboardAuth';
import StatusDot from './shared/StatusDot';
import RefreshIndicator from './shared/RefreshIndicator';
import CommandPalette, { commandsFromTabs, useCommandPaletteHotkey } from './shared/CommandPalette';
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
      { id: 'recordings', label: 'Recordings', icon: <Video className="w-[18px] h-[18px]" /> },
      { id: 'video', label: 'Video', icon: <Film className="w-[18px] h-[18px]" /> },
    ],
  },
  {
    label: 'Systems',
    tabs: [
      { id: 'workflows', label: 'Workflows', icon: <Activity className="w-[18px] h-[18px]" /> },
      { id: 'leads', label: 'Leads', icon: <Users className="w-[18px] h-[18px]" /> },
      { id: 'outreach', label: 'Outreach', icon: <Target className="w-[18px] h-[18px]" /> },
      { id: 'agent', label: 'Agent', icon: <Bot className="w-[18px] h-[18px]" /> },
      { id: 'code', label: 'Code', icon: <Terminal className="w-[18px] h-[18px]" /> },
      { id: 'auto-research', label: 'Auto Research', icon: <FlaskConical className="w-[18px] h-[18px]" /> },
    ],
  },
  {
    label: 'Operations',
    tabs: [
      { id: 'tasks', label: 'Tasks', icon: <CheckSquare className="w-[18px] h-[18px]" /> },
      { id: 'clients', label: 'Clients', icon: <Server className="w-[18px] h-[18px]" /> },
      { id: 'upwork', label: 'Upwork', icon: <Briefcase className="w-[18px] h-[18px]" /> },
      { id: 'meetings', label: 'Meetings', icon: <Phone className="w-[18px] h-[18px]" /> },
    ],
  },
  {
    label: 'Personal',
    tabs: [
      { id: 'health', label: 'Health', icon: <Heart className="w-[18px] h-[18px]" /> },
    ],
  },
];

const DashboardLayout: React.FC<Props> = ({ activeTab, onTabChange, onLogout, children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { systemHealth, lastRefreshed } = useDashboard();

  useCommandPaletteHotkey(setPaletteOpen);
  const paletteCommands = useMemo(() => [
    ...commandsFromTabs(tabGroups, onTabChange),
    {
      id: 'open-settings',
      label: 'Open Settings',
      group: 'Actions',
      icon: <Settings className="w-[18px] h-[18px]" />,
      keywords: ['preferences', 'config'],
      run: () => onTabChange('settings'),
    },
    {
      id: 'logout',
      label: 'Log out',
      group: 'Actions',
      icon: <LogOut className="w-[18px] h-[18px]" />,
      keywords: ['signout', 'sign out'],
      run: () => { logout(); onLogout(); },
    },
  ], [onTabChange, onLogout]);

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const healthStatus = systemHealth === 'healthy' ? 'healthy' : systemHealth === 'degraded' ? 'warning' : 'error';

  return (
    <div className="min-h-screen dashboard-mesh-bg dashboard-noise text-white flex">
      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-zinc-900/95 backdrop-blur-md border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
        <button aria-label={sidebarOpen ? 'Close menu' : 'Open menu'} onClick={() => setSidebarOpen(!sidebarOpen)} className="text-zinc-400 hover:text-white transition-colors">
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-emerald-500/20">IS</div>
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
      <aside className={`fixed md:sticky top-0 left-0 z-40 h-screen w-[240px] dashboard-sidebar-glass border-r border-zinc-800/40 flex flex-col transition-all duration-300 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'md:-translate-x-full md:w-0 md:min-w-0 md:overflow-hidden md:border-0' : 'md:translate-x-0'}`}>
        {/* Collapse toggle — subtle sliver on hover */}
        <button
          onClick={() => setSidebarCollapsed(c => !c)}
          className="hidden md:flex absolute -right-[5px] top-1/2 -translate-y-1/2 z-50 w-[10px] h-16 items-center justify-center rounded-r opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity duration-200 group/collapse"
          title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          <div className="w-[3px] h-6 rounded-full bg-zinc-600 group-hover/collapse:bg-zinc-400 transition-colors" />
        </button>
        {/* Brand */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/25">
              IS
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight truncate">Ivan System</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusDot status={healthStatus} pulse />
                <p className="text-[11px] text-zinc-500 capitalize">{systemHealth || 'checking...'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

        <nav className="flex-1 px-3 py-4 overflow-y-auto dashboard-scroll" role="navigation" aria-label="Dashboard navigation">
          {tabGroups.map((group, gi) => (
            <div key={gi}>
              {gi > 0 && <div className="mx-3 my-3 h-px bg-zinc-800/60" />}
              {group.label && (
                <p className="px-3 pb-2 text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em]">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {group.tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      title={tab.label}
                      onClick={() => { onTabChange(tab.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 relative focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:outline-none ${
                        isActive
                          ? 'bg-emerald-500/10 text-white sidebar-active-glow'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
                      }`}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-emerald-400 rounded-r-full shadow-sm shadow-emerald-400/50" />
                      )}
                      <span className={isActive ? 'text-emerald-400' : 'opacity-60 group-hover:opacity-100'}>{tab.icon}</span>
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Separator */}
        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

        <div className="px-3 pb-4 pt-3 space-y-1">
          <button
            onClick={() => setPaletteOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:outline-none"
            title="Open command palette (⌘K)"
          >
            <span className="opacity-60"><Search className="w-[18px] h-[18px]" /></span>
            <span className="flex-1 text-left">Quick jump</span>
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/60">⌘K</kbd>
          </button>
          <button
            onClick={() => { onTabChange('settings'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-200 relative focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:outline-none ${
              activeTab === 'settings'
                ? 'bg-emerald-500/10 text-white'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
            }`}
          >
            {activeTab === 'settings' && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-emerald-400 rounded-r-full shadow-sm shadow-emerald-400/50" />
            )}
            <span className={activeTab === 'settings' ? 'text-emerald-400' : 'opacity-60'}>
              <Settings className="w-[18px] h-[18px]" />
            </span>
            Settings
          </button>
          <div className="px-3 py-1.5">
            <RefreshIndicator lastRefreshed={lastRefreshed} />
          </div>
          <button
            aria-label="Logout"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:outline-none"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Logout
          </button>
        </div>
      </aside>

      {/* Expand sidebar — subtle sliver on left edge when collapsed */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="hidden md:flex fixed top-1/2 left-0 -translate-y-1/2 z-50 w-[10px] h-16 items-center justify-center rounded-r opacity-40 hover:opacity-100 transition-opacity duration-200 group/expand"
          title="Show sidebar"
        >
          <div className="w-[3px] h-6 rounded-full bg-zinc-600 group-hover/expand:bg-emerald-400 transition-colors" />
        </button>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-0 mt-14 md:mt-0 dashboard-grid-bg relative z-[1]">
        <div className="p-3 sm:p-6 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={paletteCommands} />
    </div>
  );
};

export default DashboardLayout;
