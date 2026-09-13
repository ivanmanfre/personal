import React from 'react';

export type ClientLearningAudit = {
  clientId?: string | null;
  auditedAt?: string | null;
  measurement?: any;
  guidance?: any;
  audienceCoverage?: any;
};

const date = (value: string | null | undefined) => value
  ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : 'not recorded';

const count = (value: unknown) => typeof value === 'number' ? value.toLocaleString() : 'unknown';
const classifier = (value: any) => {
  if (!value) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(classifier).filter(Boolean).join(', ');
  const version = value.classifier_version ?? value.version;
  return [value.classifier_slug || value.slug || value.classifier_ref || value.name, version != null ? (String(version).startsWith('v') || String(version).includes('@v') ? String(version) : `v${version}`) : '', value.people != null ? `n=${value.people}` : value.n != null ? `n=${value.n}` : ''].filter(Boolean).join(' ');
};

/**
 * The stored client-learning audit is deliberately a different reading from a
 * historic prospect hand-raiser. It reports observed audience labels and the
 * matched-age measurement basis; it never turns those labels into a DTC/ICP
 * bucket claim or a conversion result.
 */
export function AudienceAuditMeasurement({ audit, compact = false }: { audit: ClientLearningAudit; compact?: boolean }) {
  const coverage = audit.audienceCoverage || {};
  const guidance = audit.guidance || {};
  const measurement = audit.measurement || {};
  const rows = Array.isArray(measurement.matched_age) ? measurement.matched_age : [];
  return (
    <section className={compact ? 'mt-3 text-xs text-zinc-400' : 'mt-4 rounded-lg border border-zinc-800/60 bg-zinc-900/30 p-3 text-xs text-zinc-400'} data-audience-audit="client-learning">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong className="text-zinc-200">Client audience learning</strong>
        <span className="text-zinc-500">Recorded {date(audit.auditedAt)}</span>
      </div>
      <p className="mt-1 text-zinc-400">Observed people: {count(coverage.distinct_people)} · positive {count(coverage.positive)} · borderline {count(coverage.borderline)} · negative {count(coverage.negative)} · unknown {count(coverage.unknown)}.</p>
      <p className="mt-1 text-zinc-500">Classified {count(coverage.classified_n)}; labelled share {coverage.labelled_share_pct == null ? 'unknown' : `${Number(coverage.labelled_share_pct).toFixed(1)}%`}. Basis: {coverage.basis || 'not recorded'}{classifier(coverage.classifier_ref) ? ` · ${classifier(coverage.classifier_ref)}` : ''}{classifier(coverage.classifier_version) ? ` · ${classifier(coverage.classifier_version)}` : ''}.</p>
      {coverage.conflict_people != null && <p className="mt-1 text-amber-400">{count(coverage.conflict_people)} people have conflicting classifier generations and remain unknown pending review{Array.isArray(coverage.classifier_generations) && coverage.classifier_generations.length ? ` (${coverage.classifier_generations.map(classifier).filter(Boolean).join(', ')})` : ''}.</p>}
      {rows.length > 0 ? <details className="mt-2 border-t border-zinc-800/70 pt-2"><summary className="text-zinc-200">Matched-age measurements · {rows.length} post/metric/age groups</summary><div className="mt-2 space-y-1">{rows.map((r: any, i: number) => <p key={`${r.canonical_post_id || i}-${r.metric}-${r.target_age_days}`}><span className="text-zinc-200">Post {r.canonical_post_id ? String(r.canonical_post_id).slice(-8) : 'identity unknown'} · {r.metric === 'engagement_per_1000' ? 'Engagement per 1,000 impressions' : r.metric === 'engagement_count' ? 'Engagement count' : 'Impressions'}:</span> {r.value == null ? 'unknown' : count(r.value)} · target {r.target_age_days ?? 'unknown'}d / actual {r.actual_age_days ?? 'unknown'}d · captured {date(r.captured_at)} · n={count(r.eligible_n)} · floor {count(r.minimum_n ?? measurement.minimum_n)} · cohort {count(measurement.cohort_days)}d{r.status === 'supported' ? ` · p50 ${count(r.p50)}, p75 ${count(r.p75)}, p90 ${count(r.p90)}, standing ${r.standing_pct == null ? 'unknown' : `${Number(r.standing_pct).toFixed(0)}%`}` : ` · ${r.status === 'below_floor' ? 'percentile withheld below the sample floor' : 'metric missing'}`}</p>)}</div></details> : <p className="mt-2 border-t border-zinc-800/70 pt-2 text-zinc-500">No matched-age measurement was captured with this audit.</p>}
      <p className="mt-2"><span className="text-zinc-500">Buyer:</span> {guidance.buyer || 'Buyer brief missing; no buyer claim is made.'}</p>
      {Array.isArray(guidance.subjects) && guidance.subjects.length > 0 && <p className="mt-1"><span className="text-zinc-500">Subjects:</span> {guidance.subjects.map((s: any) => String(s).replace(/_/g, ' ')).join(' · ')}</p>}
      <p className="mt-1"><span className="text-zinc-500">Asset readiness:</span> {Array.isArray(guidance.asset_readiness) && guidance.asset_readiness.length ? guidance.asset_readiness.map((a: any) => `${a.asset_id || 'asset'}: ${a.state || 'unknown'}`).join(' · ') : 'no asset state recorded'}</p>
      <p className="mt-1"><span className="text-zinc-500">Next:</span> {guidance.next_action || 'Review the normal editorial queue.'}</p>
      {guidance.limitations && <p className="mt-1 text-zinc-500">{guidance.limitations}</p>}
    </section>
  );
}
