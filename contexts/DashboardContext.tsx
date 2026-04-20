import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
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
  userTimezone: 'America/Argentina/Buenos_Aires',
  setUserTimezone: () => {},
  userTimezoneOffset: -3,
  setUserTimezoneOffset: () => {},
});

export const useDashboard = () => useContext(DashboardCtx);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshRate, setRefreshRate] = useState<RefreshRate>(60000);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [systemHealth, setSystemHealth] = useState<SystemHealth>('healthy');
  const [userTimezone, setUserTimezone] = useState('America/Argentina/Buenos_Aires');
  const [userTimezoneOffset, setUserTimezoneOffset] = useState(-3);
  const tabNavRef = useRef<(tab: Tab) => void>(() => {});

  const navigateToTab = useCallback((tab: Tab) => tabNavRef.current(tab), []);
  const setTabNavigator = useCallback((fn: (tab: Tab) => void) => { tabNavRef.current = fn; }, []);

  // Load timezone settings on mount
  useEffect(() => {
    const loadTimezone = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { data, error } = await supabase
          .from('system_settings')
          .select('key,value')
          .in('key', ['user_timezone_iana', 'user_timezone_offset_hours']);

        if (!error && data) {
          const ianaRow = data.find(r => r.key === 'user_timezone_iana');
          const offsetRow = data.find(r => r.key === 'user_timezone_offset_hours');
          if (ianaRow) setUserTimezone(ianaRow.value);
          if (offsetRow) setUserTimezoneOffset(parseInt(offsetRow.value));
        }
      } catch (err) {
        // Silently fail - use defaults
        console.error('Failed to load timezone settings:', err);
      }
    };

    loadTimezone();
  }, []);

  return (
    <DashboardCtx.Provider value={{ refreshRate, setRefreshRate, lastRefreshed, setLastRefreshed, systemHealth, setSystemHealth, navigateToTab, setTabNavigator, userTimezone, setUserTimezone, userTimezoneOffset, setUserTimezoneOffset }}>
      {children}
    </DashboardCtx.Provider>
  );
};
