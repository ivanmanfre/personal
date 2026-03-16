import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { RefreshRate, SystemHealth, Tab } from '../types/dashboard';

interface DashboardContextType {
  refreshRate: RefreshRate;
  setRefreshRate: (rate: RefreshRate) => void;
  lastRefreshed: Date;
  setLastRefreshed: (d: Date) => void;
  systemHealth: SystemHealth;
  setSystemHealth: (h: SystemHealth) => void;
  navigateToTab: (tab: Tab) => void;
  setTabNavigator: (fn: (tab: Tab) => void) => void;
}

const DashboardCtx = createContext<DashboardContextType>({
  refreshRate: 60000,
  setRefreshRate: () => {},
  lastRefreshed: new Date(),
  setLastRefreshed: () => {},
  systemHealth: 'healthy',
  setSystemHealth: () => {},
  navigateToTab: () => {},
  setTabNavigator: () => {},
});

export const useDashboard = () => useContext(DashboardCtx);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshRate, setRefreshRate] = useState<RefreshRate>(60000);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [systemHealth, setSystemHealth] = useState<SystemHealth>('healthy');
  const tabNavRef = useRef<(tab: Tab) => void>(() => {});

  const navigateToTab = useCallback((tab: Tab) => tabNavRef.current(tab), []);
  const setTabNavigator = useCallback((fn: (tab: Tab) => void) => { tabNavRef.current = fn; }, []);

  return (
    <DashboardCtx.Provider value={{ refreshRate, setRefreshRate, lastRefreshed, setLastRefreshed, systemHealth, setSystemHealth, navigateToTab, setTabNavigator }}>
      {children}
    </DashboardCtx.Provider>
  );
};
