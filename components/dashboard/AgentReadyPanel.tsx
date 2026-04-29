import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, ChevronDown, ChevronUp, CreditCard, Calendar, FileText, TrendingUp, Mail, Sparkles, Edit3 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAgentReady, STAGE_LABELS } from '../../hooks/useAgentReady';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import type { PaidAssessmentRow } from '../../types/dashboard';

const stageColors: Record<string, string> = {
  paid: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  intake_submitted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  day2_scheduled: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  day2_done: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  day7_done: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  converted: 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50',
  refunded: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STAGE_ORDER = ['paid', 'intake_submitted', 'day2_scheduled', 'day2_done', 'day7_done', 'converted'] as const;

const QUESTION_LABELS: Record<string, string> = {
  company: 'Company + website + role',
  size_revenue: 'Team size + revenue',
  work_description: 'The work to take off their plate',
  input_source: 'Where info first enters',
  input_shape: 'Input source shape',
  input_consistency: 'Team consistency (1-5)',
  input_gap: 'Most-missing / hardest-to-extract',
  best_person: 'Best person at this work',
  documentability: 'Documentability (1-5)',
  criteria: 'Decision criteria',
  gut_feel: 'Gut-feel criteria',
  frequency: 'Frequency',
  v1_scope: 'First-version scope',
  excluded: 'Explicitly excluded',
  success_metric: 'Success metric',
  tolerance: 'Error tolerance',
  reviewer: 'Reviewer',
  review_time: 'Review minutes/day',
  uncertain_default: 'Uncertainty default',
  downside: 'Downside if wrong',
};

function formatAnswer(key: string, value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) {
    const hours = Math.floor(diff / 3600000);
    if (hours === 0) return 'just now';
    return `${hours}h ago`;
  }
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const AgentReadyPanel: React.FC = () => {
  const { rows, loading, refresh, updateRow } = useAgentReady();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['paid_assessments', 'assessment_intakes'] });
  // Auto-expand the most recently submitted intake the first time we see it
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('active');

  React.useEffect(() => {
    if (expanded != null) return;
    const submitted = rows.filter((r) => r.intake_status === 'submitted')
      .sort((a, b) => (b.intake_submitted_at ?? '').localeCompare(a.intake_submitted_at ?? ''));
    if (submitted[0]) setExpanded(submitted[0].stripe_session_id);
  }, [rows, expanded]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => !['converted', 'refunded'].includes(r.pipeline_stage));
    const converted = rows.filter((r) => r.pipeline_stage === 'converted');
    const revenuePaid = rows.reduce((acc, r) => acc + (r.status === 'paid' ? r.amount_cents : 0), 0) / 100;
    const awaitingIntake = rows.filter((r) => r.intake_status !== 'submitted' && r.status === 'paid').length;
    return {
      total: rows.length,
      active: active.length,
      converted: converted.length,
      revenuePaid,
      awaitingIntake,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'converted') return rows.filter((r) => r.pipeline_stage === 'converted');
    if (filter === 'awaiting-intake') return rows.filter((r) => r.intake_status !== 'submitted' && r.status === 'paid');
    return rows.filter((r) => !['converted', 'refunded'].includes(r.pipeline_stage));
  }, [rows, filter]);

  if (loading) return <LoadingSkeleton cards={4} rows={5} />;

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Blueprint Pipeline</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState
          title="No paid Blueprints yet"
          description="When someone books the $2,500 Agent-Ready Blueprint on ivanmanfredi.com, they'll show up here with intake progress, Day 2 scheduling, and conversion state."
          icon={<Award className="w-10 h-10" />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Blueprint Pipeline</h1>
          <p className="text-sm text-zinc-500 mt-1">Paid Blueprints, intake submissions, Day 2 scheduling, conversion tracking.</p>
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total paid" value={stats.total} icon={<CreditCard className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Active" value={stats.active} icon={<TrendingUp className="w-5 h-5" />} color="text-amber-400" />
        <StatCard label="Awaiting intake" value={stats.awaitingIntake} icon={<FileText className="w-5 h-5" />} color="text-purple-400" />
        <StatCard label="Converted" value={stats.converted} icon={<Award className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Revenue" value={`$${stats.revenuePaid.toLocaleString()}`} icon={<CreditCard className="w-5 h-5" />} color="text-emerald-400" />
      </div>

      {/* Stage distribution */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Stage distribution</p>
        <div className="flex flex-wrap gap-2">
          {STAGE_ORDER.map((stage) => {
            const count = rows.filter((r) => r.pipeline_stage === stage).length;
            return (
              <div key={stage} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${stageColors[stage]}`}>
                <span className="font-medium">{STAGE_LABELS[stage]}</span>
                <span className="font-mono">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'active', label: `Active (${stats.active})` },
          { id: 'awaiting-intake', label: `Awaiting intake (${stats.awaitingIntake})` },
          { id: 'converted', label: `Converted (${stats.converted})` },
          { id: 'all', label: `All (${stats.total})` },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${filter === f.id ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:border-zinc-700'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Rows */}
      <div className="space-y-3">
        {filtered.map((row) => (
          <AssessmentRow
            key={row.stripe_session_id}
            row={row}
            expanded={expanded === row.stripe_session_id}
            onToggle={() => setExpanded(expanded === row.stripe_session_id ? null : row.stripe_session_id)}
            onUpdate={updateRow}
          />
        ))}
      </div>
    </div>
  );
};

const AssessmentRow: React.FC<{
  row: PaidAssessmentRow;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (sessionId: string, patch: any) => Promise<void>;
}> = ({ row, expanded, onToggle, onUpdate }) => {
  const [notes, setNotes] = useState(row.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);

  const answeredKeys = Object.keys(row.intake_answers ?? {}).filter((k) => row.intake_answers?.[k]);
  const intakeProgress = Math.round((answeredKeys.length / 20) * 100);

  const markStage = async (stage: string, extra: Record<string, any> = {}) => {
    await onUpdate(row.stripe_session_id, { pipeline_stage: stage, ...extra });
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await onUpdate(row.stripe_session_id, { notes });
    } finally {
      setSavingNotes(false);
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-800/40 transition-colors text-left">
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <p className="font-medium text-sm text-zinc-200 truncate">{row.name || row.email}</p>
            <p className="text-xs text-zinc-500 truncate">{row.email}</p>
          </div>
          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider font-medium ${stageColors[row.pipeline_stage] ?? stageColors.paid}`}>
            {STAGE_LABELS[row.pipeline_stage] ?? row.pipeline_stage}
          </span>
          <span className="shrink-0 text-xs text-zinc-500">
            ${(row.amount_cents / 100).toLocaleString()} · {relativeTime(row.paid_at)}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {row.intake_status === 'submitted' ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
              {answeredKeys.length}/20 answered · click to view
            </span>
          ) : row.intake_status === 'in_progress' ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider bg-amber-500/10 text-amber-300 border-amber-500/30">
              Intake {intakeProgress}% · in progress
            </span>
          ) : (
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Intake pending</span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-zinc-800 space-y-6">

          {/* Stage controls */}
          <div>
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Advance stage</p>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => markStage('day2_scheduled', { day2_scheduled_at: new Date().toISOString() })} className="px-3 py-1.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded transition-colors flex items-center gap-2">
                <Calendar className="w-3 h-3" /> Day 2 scheduled
              </button>
              <button onClick={() => markStage('day2_done', { day2_completed_at: new Date().toISOString() })} className="px-3 py-1.5 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded transition-colors">
                Day 2 done
              </button>
              <button onClick={() => markStage('day7_done', { day7_completed_at: new Date().toISOString() })} className="px-3 py-1.5 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded transition-colors">
                Day 7 done
              </button>
              <button onClick={() => markStage('converted')} className="px-3 py-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded transition-colors">
                Converted
              </button>
            </div>
            {row.day2_scheduled_at && <p className="text-[11px] text-zinc-500 mt-2">Day 2 scheduled {relativeTime(row.day2_scheduled_at)}</p>}
            {row.day7_completed_at && <p className="text-[11px] text-zinc-500 mt-1">Day 7 completed {relativeTime(row.day7_completed_at)}</p>}
          </div>

          {/* Session ref + actions */}
          <div className="flex flex-wrap gap-3 text-xs">
            <a href={`https://dashboard.stripe.com/payments/${row.stripe_session_id}`} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-200 underline">
              Stripe session
            </a>
            <a href={`mailto:${row.email}`} className="text-zinc-400 hover:text-zinc-200 underline flex items-center gap-1">
              <Mail className="w-3 h-3" /> {row.email}
            </a>
          </div>

          {/* Blueprint draft generator (only when intake is submitted) */}
          {row.intake_status === 'submitted' && (
            <BlueprintDraftBlock sessionId={row.stripe_session_id} />
          )}

          {/* Intake answers */}
          {row.intake_status !== 'not_started' && answeredKeys.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
                Intake — {answeredKeys.length}/20 answered
                {row.intake_submitted_at && ` · submitted ${relativeTime(row.intake_submitted_at)}`}
              </p>
              <div className="space-y-3 bg-zinc-950/50 border border-zinc-800 rounded-lg p-4">
                {Object.keys(QUESTION_LABELS).map((key) => {
                  const val = row.intake_answers?.[key];
                  if (val === undefined || val === null || val === '') return null;
                  return (
                    <div key={key} className="text-xs">
                      <p className="text-zinc-500 font-mono uppercase tracking-wider mb-1">{QUESTION_LABELS[key]}</p>
                      <p className="text-zinc-300 whitespace-pre-wrap">{formatAnswer(key, val)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500 block mb-2">Private notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Day 2 observations, scorecard draft, blockers…"
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 resize-y"
            />
            {notes !== (row.notes ?? '') && (
              <button onClick={saveNotes} disabled={savingNotes} className="mt-2 px-3 py-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded transition-colors disabled:opacity-60">
                {savingNotes ? 'Saving…' : 'Save notes'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Generate-or-resume Blueprint draft block. Shown when intake is submitted.
const BlueprintDraftBlock: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [latest, setLatest] = useState<{ id: string; status: string; kind: string; updated_at: string; version: number } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const refresh = async () => {
    const { data } = await supabase
      .from('blueprints')
      .select('id, status, kind, updated_at, version')
      .eq('stripe_session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setLatest((data as any) ?? null);
  };

  useEffect(() => { void refresh(); }, [sessionId]);

  const generate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('https://n8n.ivanmanfredi.com/webhook/blueprint-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
      }
      // n8n responds with the Code node output: {ok, blueprint_id, ...}
      await new Promise((r) => setTimeout(r, 1500)); // give DB write a beat
      await refresh();
    } catch (e: any) {
      setGenError(e.message ?? String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4">
      <p className="text-xs uppercase tracking-widest text-emerald-300 mb-3 font-mono">Blueprint draft</p>

      {latest ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-widest border border-emerald-500/30 text-emerald-300 bg-emerald-500/10 font-mono">
            {latest.status} · v{latest.version}
          </span>
          {latest.kind === 'test' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-widest border border-amber-500/30 text-amber-300 bg-amber-500/10 font-mono">
              test · won't be RAG'd
            </span>
          )}
          <Link
            to={`/dashboard/blueprints/${encodeURIComponent(sessionId)}`}
            className="px-3 py-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 rounded transition-colors flex items-center gap-2"
          >
            <Edit3 className="w-3 h-3" /> Open editor
          </Link>
          <button
            onClick={generate}
            disabled={generating}
            className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            <Sparkles className="w-3 h-3" /> {generating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={generate}
            disabled={generating}
            className="px-4 py-2 text-sm bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 rounded transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            {generating ? 'Generating draft…' : 'Generate Blueprint draft'}
          </button>
          <p className="text-[11px] text-zinc-500">
            Calls the AI generator on n8n. Takes ~30 seconds. You'll get WhatsApp + email when ready.
          </p>
        </div>
      )}

      {genError && (
        <p className="mt-2 text-xs text-red-400 font-mono">{genError}</p>
      )}
    </div>
  );
};

export default AgentReadyPanel;
