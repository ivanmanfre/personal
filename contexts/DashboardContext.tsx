import React, { createContext, useContext, useState } from 'react';
import type { RefreshRate, SystemHealth } from '../types/dashboard';

interface DashboardContextType {
  refreshRate: RefreshRate;
  setRefreshRate: (rate: RefreshRate) => void;
  lastRefreshed: Date;
  setLastRefreshed: (d: Date) => void;
  systemHealth: SystemHealth;
  setSystemHealth: (h: SystemHealth) => void;
}

const DashboardCtx = createContext<DashboardContextType>({
  refreshRate: 60000,
  setRefreshRate: () => {},
  lastRefreshed: new Date(),
  setLastRefreshed: () => {},
  systemHealth: 'healthy',
  setSystemHealth: () => {},
});

export const useDashboard = () => useContext(DashboardCtx);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshRate, setRefreshRate] = useState<RefreshRate>(60000);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [systemHealth, setSystemHealth] = useState<SystemHealth>('healthy');

  return (
    <DashboardCtx.Provider value={{ refreshRate, setRefreshRate, lastRefreshed, setLastRefreshed, systemHealth, setSystemHealth }}>
      {children}
    </DashboardCtx.Provider>
  );
};
