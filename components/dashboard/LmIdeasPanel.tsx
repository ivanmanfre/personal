import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const FEED_URL = 'https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/lm-curator-feed';
const DECIDE_URL = 'https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/lm-curator-decide';
const ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

type Candidate = {
  id: string;
  source: string;
  content_type?: string | null;
  raw_topic: string;
  evidence: any;
  composite_score: number | null;
  icp_fit_score: number | null;
  virality_score: number | null;
  gap_score: number | null;
  format_recommendation: string | null;
  offer_ladder_map: string | null;
  why_score: string | null;
  status: string;
  promoted_clickup_task_id?: string | null;
  archived_reason?: string | null;
  ingested_at: string;
};

type Metrics = {
  week_scored_count: number;
  week_avg_composite: number | null;
  week_source_distribution: Record<string, number>;
  last_refresh: string;
};

type Feed = {
  pending: Candidate[];
  recent_promoted: Candidate[];
  recent_archived: Candidate[];
  metrics: Metrics;
};

function evidenceSummary(c: Candidate): string {
  if (!Array.isArray(c.evidence)) return '';
  if (c.source === 'calls') {
    return `${c.evidence.length} call${c.evidence.length === 1 ? '' : 's'} (transcripts)`;
  }
  if (c.source === 'kyle_call') {
    return 'Kyle Hunt coaching call';
  }
  if (c.source === 'slack') {
    return 'Slack discussion';
  }
  if (c.source === 'hacker_news') {
    const top = c.evidence[0] || {};
    return `Hacker News${top.points ? ` (${top.points} pts)` : ''}`;
  }
  if (c.source === 'reddit_se') {
    const top = c.evidence[0] || {};
    return `${top.platform || 'reddit'} ${top.sub || ''} (${top.upvotes || 0} upvotes, ${top.comments || 0} comments)`;
  }
  if (c.source === 'search_demand') {
    const top = c.evidence[0] || {};
    return `${top.platform || 'search'} · seed: "${top.seed || ''}" · vol ${top.volume || 0}`;
  }
  return '';
}

const SOURCE_LABEL: Record<string, string> = {
  calls: 'Calls',
  kyle_call: 'Other Call Sources KH',
  slack: 'Slack',
  hacker_news: 'Hacker News',
  search_demand: 'Search demand',
  reddit_se: 'Reddit/SE',
};

// Decide which content_type bucket a candidate belongs to.
// Posts view = content_type 'post'. Lead-magnet view = everything else
// (explicit 'lead_magnet' OR legacy/null candidates that predate the split).
function matchesContentType(c: Candidate, ct?: 'post' | 'lead_magnet'): boolean {
  if (!ct) return true;
  if (ct === 'post') return c.content_type === 'post';
  return c.content_type !== 'post';
}

/**
 * Shared curator ideas panel. Used by both the Posts section (contentType="post")
 * and the Lead Magnets section (contentType="lead_magnet"), so both surfaces have
 * an identical Ideas review queue — split only by the candidate's content_type.
 */
export default function LmIdeasPanel({ contentType }: { contentType?: 'post' | 'lead_magnet' } = {}) {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [reasonInput, setReasonInput] = useState<Record<string, string>>({});
  const [editTopic, setEditTopic] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filterSource, setFilterSource] = useState<'all' | string>('all');
  const [minScore, setMinScore] = useState(0);
  const [filterFormat, setFilterFormat] = useState<'all' | string>('all');
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement | null>(null);

  const noun = contentType === 'post' ? 'post' : contentType === 'lead_magnet' ? 'lead magnet' : 'idea';

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(FEED_URL, { headers: { Authorization: 'Bearer ' + ANON_KEY } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j: Feed = await r.json();
      setFeed(j);
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    if (!feed) return [] as Candidate[];
    return feed.pending.filter(c => {
      if (!matchesContentType(c, contentType)) return false;
      if (filterSource !== 'all' && c.source !== filterSource) return false;
      if (typeof c.composite_score === 'number' && c.composite_score < minScore) return false;
      if (filterFormat !== 'all' && c.format_recommendation !== filterFormat) return false;
      return true;
    });
  }, [feed, contentType, filterSource, minScore, filterFormat]);

  // Promoted/archived carry content_type only when the feed selects it; filter
  // defensively (an undefined content_type passes, so nothing silently vanishes).
  const promotedList = useMemo(
    () => (feed?.recent_promoted || []).filter(c => c.content_type === undefined || matchesContentType(c, contentType)),
    [feed, contentType],
  );
  const archivedList = useMemo(
    () => (feed?.recent_archived || []).filter(c => c.content_type === undefined || matchesContentType(c, contentType)),
    [feed, contentType],
  );

  const decide = useCallback(async (
    c: Candidate,
    decision: 'approve' | 'reject' | 'defer' | 'revert' | 'rescue',
  ) => {
    if (busyId) return;
    setBusyId(c.id);
    try {
      const body: any = { candidate_id: c.id, decision };
      const r = reasonInput[c.id]; if (r) body.reason = r;
      const e = editTopic[c.id]; if (e && e !== c.raw_topic) body.edited_topic = e;
      const res = await fetch(DECIDE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + ANON_KEY },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'decide ' + res.status);
      }
      // Per-decision feedback: on Approve, surface a deep-link to the draft
      // that the Promoter just created (and fired gen on). Closes the
      // "where did my idea go?" gap flagged by the workflow audit.
      if (decision === 'approve') {
        const payload = await res.json().catch(() => ({} as any));
        const draftId = (payload?.draft_id || payload?.promoted_draft_id) as string | undefined;
        const draftTable = payload?.draft_table as string | undefined;
        if (draftId) {
          const isLM = draftTable === 'lm_drafts_v2';
          const subTab = isLM ? 'leadmagnets' : 'posts';
          const href = `${window.location.pathname}?section=content&sub=${subTab}&open=${draftId}`;
          // sonner toast is loaded at the app shell — use dynamic import to avoid coupling
          try {
            const { toast } = await import('sonner');
            toast.success('Approved — generating now', {
              description: 'Status will move from Idea → Generating → Review.',
              action: { label: 'View draft', onClick: () => { window.location.href = href; } },
              duration: 6000,
            });
          } catch { /* sonner not loaded; silent */ }
        }
      }
      await reload();
    } catch (e: any) {
      setError(e?.message || 'decide_failed');
    } finally {
      setBusyId(null);
    }
  }, [busyId, reasonInput, editTopic, reload]);

  // Keyboard shortcuts — scoped to the panel container (only fire when focus is
  // within the panel or no other interactive element captures the key).
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (!containerRef.current) return;
      const tag = (ev.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const target = ev.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

      if (showHelp && ev.key === '?') { setShowHelp(false); return; }
      if (ev.key === '?') { setShowHelp(s => !s); return; }
      if (!filtered.length) return;
      const c = filtered[Math.min(activeIdx, filtered.length - 1)];
      if (!c) return;
      if (ev.key === 'j') { ev.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
      else if (ev.key === 'k') { ev.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
      else if (ev.key === 'a') { ev.preventDefault(); decide(c, 'approve'); }
      else if (ev.key === 'r') { ev.preventDefault(); decide(c, 'reject'); }
      else if (ev.key === 'd') { ev.preventDefault(); decide(c, 'defer'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filtered, activeIdx, decide, showHelp]);

  useEffect(() => {
    const c = filtered[activeIdx];
    if (!c) return;
    const el = cardRefs.current[c.id];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIdx, filtered]);

  const formats = useMemo(() => {
    const s = new Set<string>();
    (feed?.pending || []).forEach(c => { if (matchesContentType(c, contentType) && c.format_recommendation) s.add(c.format_recommendation); });
    return Array.from(s).sort();
  }, [feed, contentType]);

  const sources = useMemo(() => {
    const s = new Set<string>();
    (feed?.pending || []).forEach(c => { if (matchesContentType(c, contentType) && c.source) s.add(c.source); });
    return Array.from(s).sort();
  }, [feed, contentType]);

  if (loading && !feed) return <div style={{ padding: '2rem 0', color: 'var(--d-paper-dim)' }}>Loading ideas…</div>;
  if (error && !feed) return <div style={{ padding: '2rem 0', color: '#c62828' }}>Error: {error} <button onClick={reload} style={{ marginLeft: 8 }}>Retry</button></div>;
  if (!feed) return null;

  const promotedCount = promotedList.length;
  const reviewingCount = filtered.length;
  const archivedCount = archivedList.length;

  return (
    <div ref={containerRef} style={{ padding: '8px 0 24px', color: 'var(--d-paper)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--d-paper-dim)' }}>
          This week: <strong style={{ color: '#2A8F65' }}>{promotedCount}</strong> promoted ·{' '}
          <strong>{reviewingCount}</strong> to review ·{' '}
          <strong>{archivedCount}</strong> archived
        </div>
        <button onClick={reload} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid #444', background: 'transparent', color: 'inherit', borderRadius: 6, cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 12 }}>Source
          <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={{ marginLeft: 6 }}>
            <option value="all">All sources</option>
            {sources.map(s => <option key={s} value={s}>{SOURCE_LABEL[s] || s}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Min score
          <select value={minScore} onChange={e => setMinScore(Number(e.target.value))} style={{ marginLeft: 6 }}>
            {[0, 6, 9, 12, 15, 18, 21, 24].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12 }}>Format
          <select value={filterFormat} onChange={e => setFilterFormat(e.target.value)} style={{ marginLeft: 6 }}>
            <option value="all">All formats</option>
            {formats.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <button onClick={() => setShowHelp(true)} style={{ fontSize: 11, color: 'var(--d-paper-dim)', background: 'transparent', border: 'none', cursor: 'pointer' }}>? shortcuts</button>
      </div>

      <h3 style={{ fontSize: 13, fontWeight: 700, opacity: 0.7, margin: '12px 0 8px' }}>Review queue ({filtered.length})</h3>
      {filtered.length === 0 ? (
        <div style={{ padding: 18, border: '1px dashed #333', borderRadius: 8, fontSize: 13, color: 'var(--d-paper-dim)' }}>
          No {noun} ideas to review right now. The curator scans sources daily. Last feed refresh: {new Date(feed.metrics.last_refresh).toLocaleString()}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((c, i) => {
            const active = i === activeIdx;
            return (
              <div
                key={c.id}
                ref={el => { cardRefs.current[c.id] = el; }}
                style={{
                  border: active ? '1px solid #2A8F65' : '1px solid #333',
                  borderRadius: 8, padding: 12, background: active ? 'rgba(42,143,101,0.05)' : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveIdx(i)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: '#2A8F65', fontWeight: 700 }}>
                    score {c.composite_score ?? '—'}/30
                    {typeof c.icp_fit_score === 'number' && (
                      <span style={{ color: 'var(--d-paper-dim)', fontWeight: 400, marginLeft: 6 }}>
                        (ICP {c.icp_fit_score} · Viral {c.virality_score} · Gap {c.gap_score})
                      </span>
                    )}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--d-paper-dim)' }}>{SOURCE_LABEL[c.source] || c.source} · {new Date(c.ingested_at).toLocaleDateString()}</span>
                </div>

                <input
                  value={editTopic[c.id] ?? c.raw_topic}
                  onChange={e => setEditTopic(s => ({ ...s, [c.id]: e.target.value }))}
                  onClick={e => e.stopPropagation()}
                  style={{ fontSize: 15, fontWeight: 600, width: '100%', background: 'transparent', color: 'inherit', border: '1px solid transparent', padding: 2, marginBottom: 6 }}
                />

                <div style={{ fontSize: 12, color: 'var(--d-paper-dim)', marginBottom: 4 }}>
                  Source: {evidenceSummary(c)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--d-paper-dim)', marginBottom: 6 }}>
                  Format: <strong>{c.format_recommendation || '—'}</strong> · Ladder: <strong>{c.offer_ladder_map || '—'}</strong>
                </div>
                {c.why_score && (
                  <div style={{ fontSize: 12, fontStyle: 'italic', marginBottom: 10, color: 'var(--d-paper)' }}>
                    Why: {c.why_score}
                  </div>
                )}

                <details onClick={e => e.stopPropagation()} style={{ fontSize: 11, marginBottom: 10, color: 'var(--d-paper-dim)' }}>
                  <summary style={{ cursor: 'pointer' }}>Evidence</summary>
                  <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, marginTop: 6, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                    {JSON.stringify(c.evidence, null, 2)}
                  </pre>
                </details>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button disabled={busyId === c.id} onClick={(e) => { e.stopPropagation(); decide(c, 'approve'); }}
                    style={{ padding: '6px 12px', border: '1px solid #2A8F65', background: '#2A8F65', color: '#fff', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                    {busyId === c.id ? '…' : '✓ Approve'}
                  </button>
                  <button disabled={busyId === c.id} onClick={(e) => { e.stopPropagation(); decide(c, 'reject'); }}
                    style={{ padding: '6px 12px', border: '1px solid #c62828', background: 'transparent', color: '#c62828', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                    ✕ Reject
                  </button>
                  <button disabled={busyId === c.id} onClick={(e) => { e.stopPropagation(); decide(c, 'defer'); }}
                    style={{ padding: '6px 12px', border: '1px solid #555', background: 'transparent', color: 'inherit', borderRadius: 6, fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                    ↻ Defer
                  </button>
                  <input
                    placeholder="optional reason"
                    value={reasonInput[c.id] || ''}
                    onChange={e => setReasonInput(s => ({ ...s, [c.id]: e.target.value }))}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, minWidth: 160, fontSize: 12, padding: '6px 10px', background: 'rgba(0,0,0,0.3)', color: 'inherit', border: '1px solid #444', borderRadius: 6 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3 style={{ fontSize: 13, fontWeight: 700, opacity: 0.7, margin: '24px 0 8px' }}>This week's approved ({promotedCount}) <span style={{ fontWeight: 400, opacity: 0.6 }}>— ideas you (or the curator's auto-rules) moved into the drafts queue</span></h3>
      {promotedCount === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--d-paper-dim)' }}>None this week.</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {promotedList.map(c => (
            <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 10px', border: '1px solid #2A8F65', borderRadius: 6 }}>
              <span>↳ {c.raw_topic}</span>
              <span style={{ display: 'flex', gap: 8 }}>
                {c.promoted_clickup_task_id && (
                  <span style={{ fontSize: 12, opacity: 0.7 }}>promoted</span>
                )}
                <button onClick={() => decide(c, 'revert')} disabled={busyId === c.id}
                  style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #c62828', background: 'transparent', color: '#c62828', borderRadius: 4, cursor: 'pointer' }}>
                  revert promotion
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ fontSize: 13, fontWeight: 700, opacity: 0.7, margin: '24px 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
        Recently archived ({archivedCount})
        <button onClick={() => setShowArchived(s => !s)} style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #444', background: 'transparent', color: 'inherit', borderRadius: 4, cursor: 'pointer' }}>
          {showArchived ? 'hide' : 'expand'}
        </button>
      </h3>
      {showArchived && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {archivedList.map(c => (
            <li key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 10px', borderBottom: '1px solid #222' }}>
              <span>
                <span style={{ opacity: 0.6 }}>[{SOURCE_LABEL[c.source] || c.source}]</span> {c.raw_topic}{' '}
                <span style={{ opacity: 0.5 }}>— {c.archived_reason || 'no_reason'}</span>
              </span>
              <button onClick={() => decide(c, 'rescue')} disabled={busyId === c.id}
                style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #2A8F65', background: 'transparent', color: '#2A8F65', borderRadius: 4, cursor: 'pointer' }}>
                rescue
              </button>
            </li>
          ))}
        </ul>
      )}

      {showHelp && (
        <div onClick={() => setShowHelp(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#111', color: '#fff', padding: 24, borderRadius: 10, maxWidth: 360, fontSize: 13, border: '1px solid #2A8F65' }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>Keyboard shortcuts</div>
            <ul style={{ paddingLeft: 18, lineHeight: 1.8 }}>
              <li><kbd>j</kbd> / <kbd>k</kbd> — navigate cards</li>
              <li><kbd>a</kbd> — approve focused card</li>
              <li><kbd>r</kbd> — reject focused card</li>
              <li><kbd>d</kbd> — defer focused card</li>
              <li><kbd>?</kbd> — toggle this help</li>
            </ul>
            <button onClick={() => setShowHelp(false)} style={{ marginTop: 14, padding: '6px 14px', background: '#2A8F65', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>close</button>
          </div>
        </div>
      )}

      {error && <div style={{ marginTop: 12, fontSize: 12, color: '#c62828' }}>Error: {error}</div>}
    </div>
  );
}
