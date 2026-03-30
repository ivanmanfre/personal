import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

export interface TimezonePreset {
  label: string;
  iana: string;
  offsetHours: number;
}

export const TIMEZONE_PRESETS: Record<string, TimezonePreset> = {
  argentina: { label: 'Argentina', iana: 'America/Argentina/Buenos_Aires', offsetHours: -3 },
  madrid_winter: { label: 'Spain (CET Winter)', iana: 'Europe/Madrid', offsetHours: 1 },
  madrid_summer: { label: 'Spain (CEST Summer)', iana: 'Europe/Madrid', offsetHours: 2 },
  us_eastern: { label: 'US Eastern', iana: 'America/New_York', offsetHours: -5 },
  us_pacific: { label: 'US Pacific', iana: 'America/Los_Angeles', offsetHours: -8 },
  utc: { label: 'UTC', iana: 'UTC', offsetHours: 0 },
};

export interface UserTimezone {
  timezone: string; // IANA timezone string
  offsetHours: number;
  loading: boolean;
  error: string | null;
  setTimezone: (preset: TimezonePreset) => Promise<void>;
}

export function useUserTimezone(): UserTimezone {
  const [timezone, setTimezone] = useState<string>('America/Argentina/Buenos_Aires');
  const [offsetHours, setOffsetHours] = useState<number>(-3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  // Load timezone settings on mount
  useEffect(() => {
    const loadTimezone = async () => {
      try {
        setLoading(true);
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        // Fetch both timezone settings in one query
        const { data, error: fetchError } = await supabase
          .from('system_settings')
          .select('key,value')
          .in('key', ['user_timezone_iana', 'user_timezone_offset_hours']);

        if (fetchError) throw fetchError;

        const ianaRow = data?.find(r => r.key === 'user_timezone_iana');
        const offsetRow = data?.find(r => r.key === 'user_timezone_offset_hours');

        if (ianaRow) setTimezone(ianaRow.value);
        if (offsetRow) setOffsetHours(parseInt(offsetRow.value));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load timezone settings');
      } finally {
        setLoading(false);
      }
    };

    loadTimezone();
  }, [supabaseUrl, supabaseAnonKey]);

  const updateTimezone = async (preset: TimezonePreset) => {
    try {
      setLoading(true);
      setError(null);
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Update both timezone rows
      const updates = [
        supabase.from('system_settings')
          .update({ value: preset.iana })
          .eq('key', 'user_timezone_iana'),
        supabase.from('system_settings')
          .update({ value: String(preset.offsetHours) })
          .eq('key', 'user_timezone_offset_hours'),
      ];

      const [r1, r2] = await Promise.all(updates);

      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;

      // Update local state on success
      setTimezone(preset.iana);
      setOffsetHours(preset.offsetHours);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update timezone';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    timezone,
    offsetHours,
    loading,
    error,
    setTimezone: updateTimezone,
  };
}
