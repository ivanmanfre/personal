import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { toastError, toastSuccess } from '../lib/dashboardActions';
import type { MeetingType, SalesScript, SalesScriptPhase } from '../types/dashboard';

function mapScript(row: any): SalesScript {
  return {
    id: row.id,
    name: row.name,
    meetingType: row.meeting_type,
    version: row.version,
    isActive: row.is_active,
    contentMd: row.content_md ?? '',
    phases: Array.isArray(row.phases) ? (row.phases as SalesScriptPhase[]) : [],
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useSalesScript(meetingType: MeetingType) {
  const [script, setScript] = useState<SalesScript | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchScript = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_scripts')
        .select('*')
        .eq('meeting_type', meetingType)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      setScript(data ? mapScript(data) : null);
    } catch (err) {
      toastError('load sales script', err);
      setScript(null);
    } finally {
      setLoading(false);
    }
  }, [meetingType]);

  useEffect(() => {
    fetchScript();
  }, [fetchScript]);

  const save = useCallback(
    async (updates: { contentMd?: string; phases?: SalesScriptPhase[]; notes?: string | null }) => {
      if (!script) return;
      setSaving(true);
      try {
        const payload: Record<string, unknown> = {};
        if (updates.contentMd !== undefined) payload.content_md = updates.contentMd;
        if (updates.phases !== undefined) payload.phases = updates.phases;
        if (updates.notes !== undefined) payload.notes = updates.notes;
        payload.version = script.version + 1;

        const { error } = await supabase
          .from('sales_scripts')
          .update(payload)
          .eq('id', script.id);
        if (error) throw error;
        toastSuccess('Script saved');
        await fetchScript();
      } catch (err) {
        toastError('save sales script', err);
      } finally {
        setSaving(false);
      }
    },
    [script, fetchScript]
  );

  return { script, loading, saving, refresh: fetchScript, save };
}
