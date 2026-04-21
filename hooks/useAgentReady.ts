import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { PaidAssessmentRow } from '../types/dashboard';

type Row = {
  stripe_session_id: string;
  email: string;
  name: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  paid_at: string;
  pipeline_stage: string;
  day2_scheduled_at: string | null;
  day2_completed_at: string | null;
  day7_completed_at: string | null;
  followon_engagement: string | null;
  notes: string | null;
  assessment_intakes: Array<{ status: string; answers: Record<string, unknown>; submitted_at: string | null }> | null;
};

const STAGES = ['paid', 'intake_submitted', 'day2_scheduled', 'day2_done', 'day7_done', 'converted', 'refunded'] as const;
type Stage = typeof STAGES[number];

export const STAGE_LABELS: Record<string, string> = {
  paid: 'Paid',
  intake_submitted: 'Intake done',
  day2_scheduled: 'Day 2 booked',
  day2_done: 'Day 2 done',
  day7_done: 'Day 7 done',
  converted: 'Converted',
  refunded: 'Refunded',
};

// Auto-advance stage based on observed facts; buyer can always override manually.
function computeStage(row: Row, intake: Row['assessment_intakes'] extends Array<infer T> ? T | undefined : never): Stage {
  if (row.status === 'refunded') return 'refunded';
  if (row.pipeline_stage && row.pipeline_stage !== 'paid') return row.pipeline_stage as Stage;
  if (row.day7_completed_at) return 'day7_done';
  if (row.day2_completed_at) return 'day2_done';
  if (row.day2_scheduled_at) return 'day2_scheduled';
  if (intake?.status === 'submitted') return 'intake_submitted';
  return 'paid';
}

export function useAgentReady() {
  const [rows, setRows] = useState<PaidAssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('paid_assessments')
      .select(`
        stripe_session_id, email, name, amount_cents, currency, status, paid_at,
        pipeline_stage, day2_scheduled_at, day2_completed_at, day7_completed_at,
        followon_engagement, notes,
        assessment_intakes ( status, answers, submitted_at )
      `)
      .order('paid_at', { ascending: false });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const mapped: PaidAssessmentRow[] = (data ?? []).map((r: any) => {
      const intake = Array.isArray(r.assessment_intakes) ? r.assessment_intakes[0] : undefined;
      return {
        stripe_session_id: r.stripe_session_id,
        email: r.email,
        name: r.name,
        amount_cents: r.amount_cents,
        currency: r.currency,
        status: r.status,
        paid_at: r.paid_at,
        pipeline_stage: computeStage(r, intake),
        day2_scheduled_at: r.day2_scheduled_at,
        day2_completed_at: r.day2_completed_at,
        day7_completed_at: r.day7_completed_at,
        followon_engagement: r.followon_engagement,
        notes: r.notes,
        intake_status: (intake?.status as any) ?? 'not_started',
        intake_answers: intake?.answers ?? {},
        intake_submitted_at: intake?.submitted_at ?? null,
      };
    });
    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const updateRow = useCallback(async (sessionId: string, patch: Partial<Pick<PaidAssessmentRow, 'pipeline_stage' | 'day2_scheduled_at' | 'day2_completed_at' | 'day7_completed_at' | 'followon_engagement' | 'notes'>>) => {
    const { error } = await supabase
      .from('paid_assessments')
      .update(patch)
      .eq('stripe_session_id', sessionId);
    if (error) throw error;
    await fetchRows();
  }, [fetchRows]);

  return { rows, loading, error, refresh: fetchRows, updateRow };
}
