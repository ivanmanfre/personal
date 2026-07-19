import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import '../../editorial-cockpit.css';
import '../../review/worksurface.css';
import './scans/scans.css';

/**
 * Scans — audience_audits rebuild (Black Box v4, ELEVATE).
 *
 * v1 (components/dashboard/AudienceAuditsPanel.tsx) was a flat 2-col card grid
 * whose only BB adaptation was recoloured ICP numbers; the same-as-before
 * skeptic refuted it as "cards/data/layout identical". This rebuild keeps every
 * v1 capability (named-examples disclosure, one-pager link, engager-bucket
 * distribution) but changes the INSTRUMENT: a single ranked audit ledger sorted
 * by verdict severity, with buyer-relevant % promoted to a primary column and
 * the engager-vs-network read carried by two labelled ink-tonal bars (no hue,
 * so the distinction survives the mono palette). Signal red is spent ONCE, on
 * the weak/noise verdict tally count, danger only.
 *
 * Data: the exact v1 query is reused verbatim (audience_audits, select('*'),
 * order audited_at desc, no limit). READ-only; no write path exists here.
 */

interface NamedExample { name?: string; headline?: string; source?: string; }

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

// Engager bucket breakdown — ink tonal ramp (darkest = most buyer-relevant to
// lightest = irrelevant). Differentiation by tone, never hue. Carried over from
// the v1 BUCKET_META (:55-60), the one register the v1 got right.
const BUCKET_META: { key: string; label: string; color: string }[] = [
  { key: 'icp_dtc_brand', label: 'ICP · DTC brand', color: '#131210' },
  { key: 'ecom_adjacent', label: 'Ecom-adjacent', color: '#4A463E' },
  { key: 'agency_peer', label: 'Agency peer', color: '#6B675E' },
  { key: 'irrelevant_other', label: 'Irrelevant / other', color: '#B4B0A8' },
];

type Tier = 'strong' | 'neutral' | 'weak';
function verdictTier(verdict: string | null): Tier {
  const v = (verdict || '').toLowerCase();
  if (/strong|great|ideal|high|healthy|worth/.test(v)) return 'strong';
  if (/weak|poor|low|thin|avoid|skip|off|noise|peer/.test(v)) return 'weak';
  return 'neutral';
}
const TIER_RANK: Record<Tier, number> = { strong: 0, neutral: 1, weak: 2 };

function fmtPct(v: number | null): string {
  if (v == null) return 'n/a';
  return `${Number(v.toFixed(2))}%`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'n/a';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

// Presentational-only shortening for known long verdict strings so the ranked
// column never truncates. The FULL verdict always still rides in title= on
// the chip — this only trims the on-chip label vocabulary.
const VERDICT_SHORT: Record<string, string> = {
  'peer/noise-heavy': 'PEER-NOISE',
  'no engagement data': 'NO DATA',
};
function shortVerdictLabel(verdict: string): string {
  return VERDICT_SHORT[verdict.trim().toLowerCase()] || verdict;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function BucketBar({ buckets, emptyLabel = 'No engager breakdown captured.' }: {
  buckets: Record<string, number> | null; emptyLabel?: string;
}) {
  const segments = useMemo(() => {
    if (!buckets) return [];
    return BUCKET_META
      .map((m) => ({ ...m, value: Number(buckets[m.key] || 0) }))
      .filter((s) => s.value > 0);
  }, [buckets]);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <p className="scn-buckets-none">{emptyLabel}</p>;

  return (
    <>
      <div className="scn-buckets-bar">
        {segments.map((s) => (
          <div
            key={s.key}
            className="scn-buckets-seg"
            style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label}: ${s.value}`}
          />
        ))}
      </div>
      <div className="scn-buckets-legend">
        {segments.map((s) => (
          <span key={s.key} className="scn-legend-item">
            <span className="scn-legend-swatch" style={{ backgroundColor: s.color }} />
            <span className="scn-legend-lbl">{s.label}</span>
            <span className="scn-legend-val">{s.value}</span>
          </span>
        ))}
      </div>
    </>
  );
}

function EnBar({ label, kind, value, scaleMax }: {
  label: string; kind: 'eng' | 'net'; value: number | null; scaleMax: number;
}) {
  const pct = value != null && value > 0 ? Math.max(2, (value / scaleMax) * 100) : 0;
  return (
    <div className="scn-en-row">
      <span className={`scn-en-lbl scn-en-lbl--${kind}`}>{label}</span>
      <span className="scn-en-track">
        <span className={`scn-en-fill scn-en-fill--${kind}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={`scn-en-num scn-en-num--${kind}`}>{fmtPct(value)}</span>
    </div>
  );
}

function AuditRow({ audit, rank, scaleMax }: { audit: AudienceAudit; rank: number; scaleMax: number; }) {
  const [open, setOpen] = useState(false);
  const tier = verdictTier(audit.verdict);
  const exampleCount = audit.namedExamples.length;

  return (
    <div className={`scn-row scn-row--${tier}`}>
      <button
        type="button"
        className="scn-row-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="scn-rank">{String(rank).padStart(2, '0')}</span>
        <span className="scn-idcell">
          <span className="scn-name">{audit.prospectName || 'Unknown prospect'}</span>
          <span className="scn-sub">
            {fmtDate(audit.auditedAt)}
            {audit.source ? ` · ${audit.source}` : ''}
            {exampleCount > 0 ? ` · ${exampleCount} example${exampleCount > 1 ? 's' : ''}` : ''}
          </span>
        </span>
        {audit.verdict
          ? <span className={`scn-verdict scn-verdict--${tier}`} title={audit.verdict}>{shortVerdictLabel(audit.verdict)}</span>
          : <span className="scn-verdict scn-verdict--weak">no verdict</span>}
        <span className={`scn-brel ${audit.buyerRelevantPct == null ? 'scn-brel--na' : ''}`}>
          {fmtPct(audit.buyerRelevantPct)}
        </span>
        <span className="scn-en">
          <EnBar label="Eng" kind="eng" value={audit.icpDensity} scaleMax={scaleMax} />
          <EnBar label="Net" kind="net" value={audit.networkIcpDensity} scaleMax={scaleMax} />
        </span>
        <ChevronDown className={`scn-chev ${open ? 'scn-chev--open' : ''}`} size={16} aria-hidden />
      </button>

      {open && (
        <div className="scn-detail">
          <div>
            <div className="scn-block-lbl">
              Engager breakdown
              <small>
                {audit.uniqueEngagers != null ? `${audit.uniqueEngagers.toLocaleString()} engagers` : 'engagers n/a'}
                {audit.postsAnalyzed != null ? ` · ${audit.postsAnalyzed} posts` : ''}
              </small>
            </div>
            <BucketBar buckets={audit.buckets} />
            <div className="scn-block-lbl" style={{ marginTop: '1.1rem' }}>
              Network reach
              <small>{audit.networkTotal != null ? `${audit.networkTotal.toLocaleString()} in network` : 'network size n/a'}</small>
            </div>
            <BucketBar
              buckets={null /* network has no bucket split; honest empty */}
              emptyLabel="No network sample captured."
            />
          </div>

          <div>
            <div className="scn-block-lbl">
              Named examples
              <small>{exampleCount || 0}</small>
            </div>
            {exampleCount > 0 ? (
              <div className="scn-ex-list">
                {audit.namedExamples.map((ex, i) => (
                  <div className="scn-ex" key={i}>
                    <div className="scn-ex-name">{ex.name || 'Unknown'}</div>
                    {ex.headline && <div className="scn-ex-head">{ex.headline}</div>}
                    {ex.source && <div className="scn-ex-src">{ex.source}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="scn-ex-none">No named engagers captured for this audit.</div>
            )}

            {audit.onepagerUrl && (
              <a
                className="scn-onepager"
                href={audit.onepagerUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open one-pager <ExternalLink size={13} aria-hidden />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ScansRebuilt: React.FC = () => {
  const [audits, setAudits] = useState<AudienceAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      try {
        // Reused VERBATIM from v1 (AudienceAuditsPanel.tsx:227-230).
        const { data, error: err } = await supabase
          .from('audience_audits')
          .select('*')
          .order('audited_at', { ascending: false });
        if (err) throw err;
        if (active) { setAudits((data || []).map(mapAudit)); setError(null); }
      } catch (e: any) {
        if (active) setError(e?.message || 'Failed to load audience audits');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [nonce]);

  // Cohort scale: engager + network bars share one max so rows are comparable.
  const scaleMax = useMemo(() => {
    let m = 0;
    audits.forEach((a) => {
      if (a.icpDensity != null) m = Math.max(m, a.icpDensity);
      if (a.networkIcpDensity != null) m = Math.max(m, a.networkIcpDensity);
    });
    return m > 0 ? m : 1;
  }, [audits]);

  // Filter, then sort by verdict severity (strong first), then buyer-relevant %
  // desc (the promoted primary read), then most-recent audit.
  const ranked = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? audits.filter((a) =>
          (a.prospectName || '').toLowerCase().includes(q) ||
          (a.verdict || '').toLowerCase().includes(q) ||
          (a.source || '').toLowerCase().includes(q))
      : audits;
    return [...filtered].sort((a, b) => {
      const t = TIER_RANK[verdictTier(a.verdict)] - TIER_RANK[verdictTier(b.verdict)];
      if (t !== 0) return t;
      const br = (b.buyerRelevantPct ?? -1) - (a.buyerRelevantPct ?? -1);
      if (br !== 0) return br;
      return new Date(b.auditedAt || 0).getTime() - new Date(a.auditedAt || 0).getTime();
    });
  }, [audits, query]);

  const stats = useMemo(() => {
    let strong = 0, weak = 0;
    audits.forEach((a) => {
      const t = verdictTier(a.verdict);
      if (t === 'strong') strong += 1;
      else if (t === 'weak') weak += 1;
    });
    const brMedian = median(audits.map((a) => a.buyerRelevantPct).filter((v): v is number => v != null));
    return { total: audits.length, strong, weak, brMedian };
  }, [audits]);

  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  return (
    <div className="ec">
      <div className="ec-topline">
        <span className="ec-topline-brand">Scans</span>
        <span className="ec-topline-meta">{now} · {stats.total} on record</span>
      </div>

      <div className="ws-head">
        <h1 className="ec-hed ec-hed--today" style={{ fontSize: 'clamp(40px,4.4vw,60px)', margin: 0 }}>Scans</h1>
        <div className="ws-tools">
          <span className="scn-search">
            <Search size={13} aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter prospect / verdict"
              aria-label="Filter audits"
            />
          </span>
          <button className="ws-tool-icon" onClick={refresh} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <p className="ec-dek scn-dek">
        Who actually engages a prospect's content, and how much of that audience is buyer-relevant.
        Audits run automatically when a prospect replies. Ranked by verdict, strongest fits first.
      </p>

      {/* Glance strip — the promoted read. Signal red is spent once, on the
          weak / noise count when it is greater than zero (danger only). */}
      <div className="ws-tally" style={{ ['--ws-tally-cols' as any]: 4 }}>
        <div className="ws-tally-tile">
          <span className="ws-tally-no">01</span>
          <span className={`ws-tally-count ${stats.total ? '' : 'ws-tally-count--zero'}`}>{stats.total}</span>
          <span className="ws-tally-label">Audits on record</span>
          <span className="ws-tally-sub">audience_audits</span>
        </div>
        <div className="ws-tally-tile">
          <span className="ws-tally-no">02</span>
          <span className={`ws-tally-count ${stats.strong ? '' : 'ws-tally-count--zero'}`}>{stats.strong}</span>
          <span className="ws-tally-label">Strong fits</span>
          <span className="ws-tally-sub">buyer-heavy engager pool</span>
        </div>
        <div className="ws-tally-tile">
          <span className="ws-tally-no">03</span>
          <span className={`ws-tally-count ${stats.brMedian == null ? 'ws-tally-count--zero' : ''}`}>
            {stats.brMedian == null ? '–' : fmtPct(stats.brMedian)}
          </span>
          <span className="ws-tally-label">Buyer-rel median</span>
          <span className="ws-tally-sub">across engager pools</span>
        </div>
        <div className="ws-tally-tile">
          <span className="ws-tally-no">04</span>
          <span className={`ws-tally-count ${stats.weak ? 'ws-tally-count--red' : 'ws-tally-count--zero'}`}>{stats.weak}</span>
          <span className="ws-tally-label">Weak / noise</span>
          <span className="ws-tally-sub">{stats.weak ? 'below the fit floor' : 'none flagged'}</span>
        </div>
      </div>

      {error ? (
        <p className="scn-error">Couldn't load audience audits: {error}</p>
      ) : loading && audits.length === 0 ? (
        <div className="ws-loading">Reading audience_audits…</div>
      ) : ranked.length === 0 ? (
        <div className="ws-empty">
          <div className="ws-empty-h">{query ? 'No audits match that filter' : 'No audience audits yet'}</div>
          <div className="ws-empty-note">
            {query
              ? 'Clear the filter to see every audit on record.'
              : 'Audits fire automatically when a prospect replies (hand-raiser stage). The engager and network breakdown lands here once the first one completes.'}
          </div>
        </div>
      ) : (
        <div className="scn-ledger">
          <div className="scn-lhead">
            <span className="scn-hcell" />
            <span className="scn-hcell">Prospect</span>
            <span className="scn-hcell">Verdict</span>
            <span className="scn-hcell scn-hcell--num">Buyer-rel</span>
            <span className="scn-hcell">Engager vs network ICP</span>
            <span className="scn-hcell" />
          </div>
          {ranked.map((a, i) => (
            <AuditRow key={a.id} audit={a} rank={i + 1} scaleMax={scaleMax} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ScansRebuilt;
