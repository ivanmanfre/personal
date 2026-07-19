import React, { useEffect, useMemo, useState } from 'react';
import { Target, Users, Network, FileText, ChevronDown, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import LoadingSkeleton from './shared/LoadingSkeleton';
import EmptyState from './shared/EmptyState';

interface NamedExample {
  name?: string;
  headline?: string;
  source?: string;
}

interface AudienceAudit {
  id: string;
  prospectName: string | null;
  prospectProviderId: string | null;
  postsAnalyzed: number | null;
  uniqueEngagers: number | null;
  icpDensity: number | null;
  buyerRelevantPct: number | null;
  buckets: Record<string, number> | null;
  networkTotal: number | null;
  networkIcpDensity: number | null;
  namedExamples: NamedExample[];
  verdict: string | null;
  onepagerUrl: string | null;
  source: string | null;
  auditedAt: string | null;
}

function mapAudit(r: any): AudienceAudit {
  return {
    id: r.id,
    prospectName: r.prospect_name ?? null,
    prospectProviderId: r.prospect_provider_id ?? null,
    postsAnalyzed: r.posts_analyzed ?? null,
    uniqueEngagers: r.unique_engagers ?? null,
    icpDensity: r.icp_density ?? null,
    buyerRelevantPct: r.buyer_relevant_pct ?? null,
    buckets: r.buckets ?? null,
    networkTotal: r.network_total ?? null,
    networkIcpDensity: r.network_icp_density ?? null,
    namedExamples: Array.isArray(r.named_examples) ? r.named_examples : [],
    verdict: r.verdict ?? null,
    onepagerUrl: r.onepager_url ?? null,
    source: r.source ?? null,
    auditedAt: r.audited_at ?? null,
  };
}

// Engager bucket breakdown — Black Box register: an INK tonal ramp (darkest =
// most buyer-relevant → lightest = irrelevant), differentiation by tone not hue.
// Replaces the off-palette green/blue/rust fills the craft judge flagged on the
// Scans bridge. These are inline fills, so the bridge CSS can't reach them.
const BUCKET_META: { key: string; label: string; color: string }[] = [
  { key: 'icp_dtc_brand', label: 'ICP · DTC brand', color: '#131210' },
  { key: 'ecom_adjacent', label: 'Ecom-adjacent', color: '#4A463E' },
  { key: 'agency_peer', label: 'Agency peer', color: '#6B675E' },
  { key: 'irrelevant_other', label: 'Irrelevant / other', color: '#B4B0A8' },
];

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  // Trim trailing zeros (0.60 -> 0.6, 3.00 -> 3) then append %.
  return `${Number(v.toFixed(2))}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function verdictSeverity(verdict: string | null): string {
  const v = (verdict || '').toLowerCase();
  if (/strong|great|ideal|high|healthy|worth/.test(v)) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (/weak|poor|low|thin|avoid|skip|off/.test(v)) return 'text-red-400 bg-red-500/10 border-red-500/20';
  return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
}

function BucketBar({ buckets }: { buckets: Record<string, number> | null }) {
  const segments = useMemo(() => {
    if (!buckets) return [];
    return BUCKET_META
      .map((m) => ({ ...m, value: Number(buckets[m.key] || 0) }))
      .filter((s) => s.value > 0);
  }, [buckets]);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <p className="text-xs text-zinc-600">No engager breakdown captured.</p>;

  return (
    <div className="space-y-2.5">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-zinc-800/70">
        {segments.map((s) => (
          <div
            key={s.key}
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-[11px]">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-zinc-400">{s.label}</span>
            <span className="tabular-nums text-zinc-300">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditCard({ audit }: { audit: AudienceAudit }) {
  const [showExamples, setShowExamples] = useState(false);
  const exampleCount = audit.namedExamples.length;

  return (
    <div className="panel-surface shadow-sm shadow-black/10 p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-100 truncate">{audit.prospectName || 'Unknown prospect'}</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Audited {fmtDate(audit.auditedAt)}
            {audit.source && <span> · {audit.source}</span>}
          </p>
        </div>
        {audit.verdict && (
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${verdictSeverity(audit.verdict)}`}>
            {audit.verdict}
          </span>
        )}
      </div>

      {/* Load-bearing numbers */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            <Target className="h-3 w-3" /> Engager ICP density
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400">{fmtPct(audit.icpDensity)}</div>
          <div className="text-[11px] text-zinc-500">
            {audit.uniqueEngagers != null ? audit.uniqueEngagers.toLocaleString() : '—'} engagers
            {audit.postsAnalyzed != null && <span> · {audit.postsAnalyzed} posts</span>}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-800/60 bg-zinc-900/40 p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
            <Network className="h-3 w-3" /> Network ICP density
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums text-blue-400">{fmtPct(audit.networkIcpDensity)}</div>
          <div className="text-[11px] text-zinc-500">
            {audit.networkTotal != null ? `of ${audit.networkTotal.toLocaleString()} in network` : 'network size —'}
          </div>
        </div>
      </div>

      {audit.buyerRelevantPct != null && (
        <p className="mt-3 text-xs text-zinc-400">
          <span className="text-zinc-500">Buyer-relevant engagers:</span>{' '}
          <span className="tabular-nums text-zinc-200">{fmtPct(audit.buyerRelevantPct)}</span>
        </p>
      )}

      {/* Bucket breakdown */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
          <Users className="h-3 w-3" /> Engager breakdown
        </div>
        <BucketBar buckets={audit.buckets} />
      </div>

      {/* Named examples */}
      {exampleCount > 0 && (
        <div className="mt-4 border-t border-zinc-800/60 pt-3">
          <button
            onClick={() => setShowExamples((v) => !v)}
            className="flex w-full items-center justify-between text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span>{exampleCount} named example{exampleCount > 1 ? 's' : ''}</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showExamples ? 'rotate-180' : ''}`} />
          </button>
          {showExamples && (
            <div className="mt-2.5 space-y-2">
              {audit.namedExamples.map((ex, i) => (
                <div key={i} className="rounded-md border border-zinc-800/50 bg-zinc-900/40 px-3 py-2">
                  <div className="text-xs font-medium text-zinc-200">{ex.name || 'Unknown'}</div>
                  {ex.headline && <div className="text-[11px] text-zinc-500 leading-snug">{ex.headline}</div>}
                  {ex.source && <div className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">{ex.source}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* One-pager link */}
      {audit.onepagerUrl && (
        <a
          href={audit.onepagerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
        >
          <FileText className="h-3.5 w-3.5" /> Open one-pager <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

const AudienceAuditsPanel: React.FC = () => {
  const [audits, setAudits] = useState<AudienceAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('audience_audits')
          .select('*')
          .order('audited_at', { ascending: false });
        if (err) throw err;
        if (active) setAudits((data || []).map(mapAudit));
      } catch (e: any) {
        if (active) setError(e?.message || 'Failed to load audience audits');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) return <LoadingSkeleton cards={0} rows={4} />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
        Couldn't load audience audits: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">
        Who actually engages with a prospect's content — and how much of that audience is buyer-relevant. Runs automatically when a prospect replies.
      </p>

      {audits.length === 0 ? (
        <EmptyState
          title="No audience audits yet"
          description="Audits fire automatically when a prospect replies (hand-raiser stage). The engager + network breakdown lands here once the first one completes."
          icon={<Target className="h-10 w-10" />}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {audits.map((a) => (
            <AuditCard key={a.id} audit={a} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AudienceAuditsPanel;
