import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { RefreshRate, SystemHealth, Tab } from '../types/dashboard';

// Auto-detect the operator's CURRENT timezone from the browser, so every view
// reads in local time and follows wherever the machine is (Buenos Aires at home,
// elsewhere when travelling). Resolves on load; reflects a location change after
// a refresh. There is intentionally no saved/manual timezone setting — posts are
// still SCHEDULED against Buenos Aires audience windows in findNextSlot; this is
// purely the display timezone for dashboard views.
const BROWSER_TZ = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Argentina/Buenos_Aires';
  } catch {
    return 'America/Argentina/Buenos_Aires';
  }
})();
const BROWSER_TZ_OFFSET = -new Date().getTimezoneOffset() / 60;

interface DashboardContextType {
  refreshRate: RefreshRate;
  setRefreshRate: (rate: RefreshRate) => void;
  lastRefreshed: Date;
  setLastRefreshed: (d: Date) => void;
  systemHealth: SystemHealth;
  setSystemHealth: (h: SystemHealth) => void;
  navigateToTab: (tab: Tab) => void;
  setTabNavigator: (fn: (tab: Tab) => void) => void;
  userTimezone: string;
  setUserTimezone: (tz: string) => void;
  userTimezoneOffset: number;
  setUserTimezoneOffset: (offset: number) => void;
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
  userTimezone: BROWSER_TZ,
  setUserTimezone: () => {},
  userTimezoneOffset: BROWSER_TZ_OFFSET,
  setUserTimezoneOffset: () => {},
});

export const useDashboard = () => useContext(DashboardCtx);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshRate, setRefreshRate] = useState<RefreshRate>(60000);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [systemHealth, setSystemHealth] = useState<SystemHealth>('healthy');
  // Timezone follows the browser automatically (see BROWSER_TZ above). The
  // setters are retained for API compatibility but no longer wired to any UI.
  const [userTimezone, setUserTimezone] = useState(BROWSER_TZ);
  const [userTimezoneOffset, setUserTimezoneOffset] = useState(BROWSER_TZ_OFFSET);
  const tabNavRef = useRef<(tab: Tab) => void>(() => {});

  const navigateToTab = useCallback((tab: Tab) => tabNavRef.current(tab), []);
  const setTabNavigator = useCallback((fn: (tab: Tab) => void) => { tabNavRef.current = fn; }, []);

  return (
    <DashboardCtx.Provider value={{ refreshRate, setRefreshRate, lastRefreshed, setLastRefreshed, systemHealth, setSystemHealth, navigateToTab, setTabNavigator, userTimezone, setUserTimezone, userTimezoneOffset, setUserTimezoneOffset }}>
      {children}
    </DashboardCtx.Provider>
  );
};
