import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { toastError } from '../lib/dashboardActions';

export interface DailyPoint {
  day: string; // ISO date (YYYY-MM-DD)
  views: number;
  visitors: number;
}

export interface TopPath {
  path: string;
  views: number;
  visitors: number;
}

export interface TopReferrer {
  referrerHost: string;
  views: number;
  visitors: number;
}

export interface TopUtm {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  views: number;
  visitors: number;
}

export interface DeviceSplit {
  deviceType: string;
  views: number;
  visitors: number;
}

export interface AudienceData {
  daily: DailyPoint[];
  topPaths: TopPath[];
  topReferrers: TopReferrer[];
  topUtm: TopUtm[];
  deviceSplit: DeviceSplit[];
}

function emptyData(): AudienceData {
  return { daily: [], topPaths: [], topReferrers: [], topUtm: [], deviceSplit: [] };
}

export function useAudience() {
  const [data, setData] = useState<AudienceData>(emptyData);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [dailyRes, pathsRes, refsRes, utmRes, devRes] = await Promise.all([
        supabase.from('pageviews_daily').select('*').order('day', { ascending: true }).limit(90),
        supabase.from('pageviews_top_paths').select('*').limit(25),
        supabase.from('pageviews_top_referrers').select('*').limit(15),
        supabase.from('pageviews_top_utm').select('*').limit(25),
        supabase.from('pageviews_device_split').select('*'),
      ]);

      setData({
        daily: (dailyRes.data || []).map((r: any) => ({
          day: r.day,
          views: Number(r.views) || 0,
          visitors: Number(r.visitors) || 0,
        })),
        topPaths: (pathsRes.data || []).map((r: any) => ({
          path: r.path,
          views: Number(r.views) || 0,
          visitors: Number(r.visitors) || 0,
        })),
        topReferrers: (refsRes.data || []).map((r: any) => ({
          referrerHost: r.referrer_host,
          views: Number(r.views) || 0,
          visitors: Number(r.visitors) || 0,
        })),
        topUtm: (utmRes.data || []).map((r: any) => ({
          utmSource: r.utm_source,
          utmMedium: r.utm_medium,
          utmCampaign: r.utm_campaign,
          views: Number(r.views) || 0,
          visitors: Number(r.visitors) || 0,
        })),
        deviceSplit: (devRes.data || []).map((r: any) => ({
          deviceType: r.device_type,
          views: Number(r.views) || 0,
          visitors: Number(r.visitors) || 0,
        })),
      });
    } catch (err) {
      toastError('load audience', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const totals = useMemo(() => {
    const last30 = data.daily.slice(-30);
    const prev30 = data.daily.slice(-60, -30);
    const sum = (arr: DailyPoint[], key: 'views' | 'visitors') =>
      arr.reduce((a, p) => a + p[key], 0);
    const views30 = sum(last30, 'views');
    const visitors30 = sum(last30, 'visitors');
    const viewsPrev30 = sum(prev30, 'views');
    const visitorsPrev30 = sum(prev30, 'visitors');
    const today = data.daily[data.daily.length - 1];
    const yesterday = data.daily[data.daily.length - 2];
    return {
      views30,
      visitors30,
      viewsPrev30,
      visitorsPrev30,
      viewsToday: today?.views || 0,
      visitorsToday: today?.visitors || 0,
      viewsYesterday: yesterday?.views || 0,
      visitorsYesterday: yesterday?.visitors || 0,
    };
  }, [data.daily]);

  return { data, totals, loading, refresh: fetch };
}
