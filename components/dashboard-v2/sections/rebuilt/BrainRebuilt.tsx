/*
 * BrainRebuilt — BB v4 "Black Box" rebuild of the memory system panel (v1:
 * BrainPanel + BrainGraphSection + BrainGraphFlow + BrainToolUsage, 1,774L).
 *
 * The refutation this kills: "panel chrome entirely un-reskinned, full
 * purple-gradient v1, jarring drop from BB editorial." The violet identity is
 * gone. The surface is designed as a library card-catalog / archival register:
 * the tier grid is a printed index with counts, session logs are dated register
 * entries, hybrid search is the reference-desk instrument (rrf/vec/bm25 in
 * muted tabular figures), clients-and-proposals is a ledger, the entity graph
 * is ink (typographic labels, hairline edges, kinds by shape/outline not hue).
 *
 * Data wiring is unchanged: useBrainStats (tier roster live-derived via
 * deriveClientTiers), useBrainGraph, useBrainHybridSearch, all imported as-is.
 * Both search paths (claude-memory-query webhook + claude-memory-recall edge
 * fn) are reads. Zero mutations. All 21 v1 controls + 6 sub-views survive.
 */
import React, { useState, lazy, Suspense } from 'react';
import { useBrainStats, type SessionLog, type CompactionReview } from '../../../../hooks/useBrainStats';
import { useBrainGraph, useBrainHybridSearch, type ClientEntity, type HybridSearchHit } from '../../../../hooks/useBrainGraph';
import '../../editorial-cockpit.css';
import './brain/brain.css';

const BrainGraphInk = lazy(() => import('./brain/BrainGraphInk'));
const BrainToolUsageInk = lazy(() => import('./brain/BrainToolUsageInk'));

const OWN_TIERS = new Set(['global', 'shared-tech', 'ivan']);

// Entity kinds by typographic shape marker (never color).
const KIND_MARK: Record<string, string> = {
  client: '■', proposal: '●', call: '◆', workflow: '□',
  clickup: '○', payment: '▲', memory_file: '◇', task: '▪',
};
const kindMark = (k: string) => KIND_MARK[k] || '◇';

function timeAgo(iso?: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTotals(totals: Record<string, number | string>): string {
  return Object.entries(totals)
    .map(([cur, v]) => `${cur}${typeof v === 'number' ? v.toLocaleString() : v}`)
    .join(' · ');
}

/* ── Session-log register entry (element 8) ───────────────────────────────── */
const SessionLogRow: React.FC<{ log: SessionLog }> = ({ log }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="br-log-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="br-caret">{open ? '▾' : '▸'}</span>
        <span className="br-log-date">{log.date}</span>
        <span className="br-log-tier">{log.client_id}</span>
        <span className="br-log-topic">{log.topic}</span>
      </button>
      {open && (
        <div className="br-log-body">
          <pre className="br-log-pre">{log.content}</pre>
        </div>
      )}
    </>
  );
};

/* ── Compaction review row (element 9) ────────────────────────────────────── */
const ReviewRow: React.FC<{ review: CompactionReview }> = ({ review }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="br-review-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="br-caret">{open ? '▾' : '▸'}</span>
        <span className="br-review-tier">{review.client_id}</span>
        <span className="br-review-desc">
          {review.proposalCount} proposal{review.proposalCount === 1 ? '' : 's'} pending
        </span>
        <span className="br-review-when">{review.generatedAt ? timeAgo(review.generatedAt) : ''}</span>
      </button>
      {open && (
        <div className="br-review-body">
          {review.proposals.map((p, i) => (
            <div key={i} className="br-review-item">
              <div className="br-review-item-h">
                <span className="br-review-type">{p.type}</span>
                <span className="br-review-files">{p.files}</span>
              </div>
              <p className="br-review-reason">{p.reason}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

/* ── Client ledger row (elements 14, 15, 16) ──────────────────────────────── */
const ClientRow: React.FC<{ client: ClientEntity }> = ({ client }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="br-crow-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="br-caret">{open ? '▾' : '▸'}</span>
        <span className="br-crow-mark" />
        <span className="br-crow-name">{client.slug}</span>
        <span className="br-crow-count">{client.proposal_count} {client.proposal_count === 1 ? 'proposal' : 'proposals'}</span>
        <span className="br-crow-total">{formatTotals(client.total_amount_by_currency)}</span>
      </button>
      {open && (
        client.proposals.length === 0 ? (
          <div className="br-cprop-empty">No proposals.</div>
        ) : (
          <ul className="br-cprops">
            {client.proposals.map((p) => (
              <li key={p.slug} className="br-cprop">
                <span className="br-cprop-mark">●</span>
                <span className="br-cprop-title">{p.project_title || p.slug}</span>
                {p.amount && <span className="br-cprop-amt">{p.currency || ''}{p.amount}</span>}
                {p.date && <span className="br-cprop-date">{p.date}</span>}
                {p.proposal_url && (
                  <a href={p.proposal_url} target="_blank" rel="noreferrer" className="br-cprop-link">open</a>
                )}
                {p.clickup_task && (
                  <a href={`https://app.clickup.com/t/${p.clickup_task}`} target="_blank" rel="noreferrer" className="br-cprop-cu">{p.clickup_task}</a>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </>
  );
};

const HybridHitRow: React.FC<{ hit: HybridSearchHit }> = ({ hit }) => {
  const snippet = React.useMemo(() => {
    const lines = (hit.content || '').split('\n');
    let inFm = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (line === '---') { inFm = !inFm; continue; }
      if (inFm || !line || line.startsWith('#')) continue;
      return line.slice(0, 200);
    }
    return '';
  }, [hit.content]);
  return (
    <div className="br-hit">
      <div className="br-hit-top">
        <span className="br-hit-tier">{hit.client_id}</span>
        <span className="br-hit-path">{hit.file_path}</span>
        <span className="br-hit-scores">rrf {hit.rrf_score.toFixed(3)} · vec {hit.vec_similarity.toFixed(2)} · bm25 {hit.bm25_rank.toFixed(3)}</span>
      </div>
      {snippet && <div className="br-hit-snippet">{snippet}</div>}
    </div>
  );
};

export default function BrainRebuilt() {
  const { tierCounts, sessionLogs, reviews, loading, searching, searchResults, searchError, search, clearSearch, refresh } = useBrainStats();
  const { clients, backlinks, embeddingStatus, totalRelations, loading: graphLoading, error: graphError, refresh: refreshGraph } = useBrainGraph();
  const hybrid = useBrainHybridSearch();

  const [query, setQuery] = useState('');
  const [hybridQuery, setHybridQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('');
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [graphOpen, setGraphOpen] = useState(false);

  const totalEmbedded = embeddingStatus.reduce((s, e) => s + e.embedded, 0);
  const totalPending = embeddingStatus.reduce((s, e) => s + e.pending, 0);
  const totalDocs = totalEmbedded + totalPending;
  const totalWikilinks = backlinks.reduce((s, b) => s + b.count, 0);
  const totalRows = tierCounts.reduce((s, t) => s + t.count, 0);
  const pendingReviews = reviews.reduce((s, r) => s + r.proposalCount, 0);
  const lastSync = tierCounts.map((t) => t.lastSync).filter(Boolean).sort().reverse()[0] as string | undefined;

  const onLegacySearch = (e: React.FormEvent) => {
    e.preventDefault();
    search(query, tierFilter || undefined);
  };
  const onHybridSearch = (e: React.FormEvent) => {
    e.preventDefault();
    hybrid.search(hybridQuery, ['ivan', 'global', 'shared-tech']);
  };

  return (
    <div className="ec">
      {/* Topline: document header */}
      <div className="ec-topline">
        <span className="ec-topline-brand">Memory Index</span>
        <span className="ec-topline-meta">
          {tierCounts.length} tier{tierCounts.length === 1 ? '' : 's'} · {totalRows} rows · synced {timeAgo(lastSync)}
        </span>
      </div>

      {/* Header: functional label + controls (1 how-it-works, 2 refresh) */}
      <div className="br-head">
        <h1 className="ec-hed ec-hed--today">Brain</h1>
        <div className="br-controls">
          <button type="button" className="br-tool" aria-expanded={explainerOpen} onClick={() => setExplainerOpen((o) => !o)}>
            How it works {explainerOpen ? '▾' : '▸'}
          </button>
          <button type="button" className="br-tool" onClick={refresh} title="Reload memory stats">
            {loading ? 'Loading' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Explainer accordion (element 1 content) */}
      {explainerOpen && (
        <div className="br-explainer">
          <div className="br-explain-grid">
            <div>
              <div className="br-sec-no">1 · Three tiers</div>
              <ul className="br-explain-list">
                <li><b>global</b>: personal preferences, voice, vendor rules. Loaded for every session, every project.</li>
                <li><b>shared-tech</b>: cross-client tech (n8n quirks, Supabase patterns, Railway gotchas). Always loaded too.</li>
                <li><b>ivan / per-client</b>: workflow IDs, ClickUp lists, integration keys. Loaded only when working that client.</li>
              </ul>
            </div>
            <div>
              <div className="br-sec-no">2 · Auto-capture</div>
              <ul className="br-explain-list">
                <li><b>Session logs</b>: every Claude Code session ends with Haiku summarizing what was discussed, decided, changed, tagged by client.</li>
                <li><b>Live context</b>: at session start, recent commits plus the n8nClaw daily summary plus the active client context get injected.</li>
                <li><b>Sync</b>: local memory files mirror to Supabase via the Stop hook, rate-limited 60s.</li>
              </ul>
            </div>
            <div>
              <div className="br-sec-no">3 · Cross-system</div>
              <ul className="br-explain-list">
                <li><b>WhatsApp to Claude</b>: ask n8nClaw on WhatsApp, its daily summary appears in the next CLI session.</li>
                <li><b>Claude to WhatsApp</b>: n8nClaw has a <span className="br-code">query_engineering_memory</span> tool that pulls from this same table.</li>
                <li>The search boxes below use the exact same source n8nClaw can answer with.</li>
              </ul>
            </div>
            <div>
              <div className="br-sec-no">4 · Compactor</div>
              <ul className="br-explain-list">
                <li>Daily at 11:00 local, a Haiku audit finds duplicates, stale entries, TODO queues, file pairs to merge, or files in the wrong tier.</li>
                <li>Proposals appear below and are <b>never auto-applied</b>. Review and act.</li>
                <li>WhatsApp ping if proposals exist.</li>
              </ul>
            </div>
          </div>

          <div className="ec-kicker">Three ways to recall</div>
          <div className="br-recall">
            <div className="br-recall-card">
              <div className="br-recall-h">1. Grep, exact strings</div>
              <p className="br-recall-p">Workflow IDs, custom field IDs, API keys, file names. The <span className="br-code">/recall</span> skill.</p>
            </div>
            <div className="br-recall-card">
              <div className="br-recall-h">2. Vector, by meaning</div>
              <p className="br-recall-p">All memory files embedded with <span className="br-code">text-embedding-3-small</span>. Hybrid BM25 plus vector via the <span className="br-code">claude-memory-recall</span> edge fn.</p>
            </div>
            <div className="br-recall-card">
              <div className="br-recall-h">3. Wikilinks, by connection</div>
              <p className="br-recall-p">Write <span className="br-code">[[client:veripro]]</span> anywhere. The extractor indexes them into <span className="br-code">claude_memory_backlinks</span>.</p>
            </div>
          </div>

          <div className="ec-kicker">Entity kinds</div>
          <div className="br-kinds">
            {[
              ['client', 'a direct client'], ['proposal', 'a quote sent'],
              ['call', 'a sales call'], ['workflow', 'an n8n workflow'],
              ['clickup', 'a ClickUp task'], ['payment', 'a Stripe payment'],
              ['memory_file', 'another note'], ['task', 'a todo'],
            ].map(([k, gloss]) => (
              <div key={k} className="br-kind">
                <span className="br-kind-mark">{kindMark(k)}</span>
                <span className="br-kind-name">{k}</span>
                <span className="br-kind-gloss">{gloss}</span>
              </div>
            ))}
          </div>

          <div className="ec-kicker">Where things live</div>
          <ul className="br-where">
            <li><b>Markdown source</b>: <span className="br-code">~/.claude/memory/</span> on the Mac, the source of truth.</li>
            <li><b>Mirror plus embeddings</b>: Supabase <span className="br-code">claude_memory</span> with an <span className="br-code">embedding</span> column.</li>
            <li><b>Typed relations</b>: Supabase <span className="br-code">claude_memory_relations</span> (client to proposal to clickup).</li>
            <li><b>Wikilink index</b>: Supabase <span className="br-code">claude_memory_backlinks</span>, extracted from <span className="br-code">[[...]]</span>.</li>
          </ul>
          <div className="br-tip">
            <b>Note:</b> the reference desk below runs hybrid BM25 plus vector retrieval. The tier-scoped search under the index is legacy substring plus tier filter. Both query the same data.
          </div>
        </div>
      )}

      {/* Stats: graph lockup strip + secondary metric line (sub-view 4) */}
      <div className="br-strip">
        <StatTile num={totalDocs} label={<>Memory<br />files</>} />
        <StatTile num={`${totalEmbedded}/${totalDocs}`} label={<>Embedded</>} muted={totalPending > 0} />
        <StatTile num={totalRelations} label={<>Typed<br />relations</>} />
        <StatTile num={totalWikilinks} label={<>Wikilinks</>} />
      </div>
      <div className="br-metrics">
        <span className="br-metric"><span className="br-metric-num">{totalRows}</span><span className="br-metric-lbl">Memory rows</span></span>
        <span className="br-metric"><span className={`br-metric-num${sessionLogs.length === 0 ? ' br-metric-num--muted' : ''}`}>{sessionLogs.length}</span><span className="br-metric-lbl">Session logs</span></span>
        <span className="br-metric"><span className={`br-metric-num${pendingReviews === 0 ? ' br-metric-num--muted' : ''}`}>{pendingReviews}</span><span className="br-metric-lbl">Pending reviews</span></span>
        <span className="br-metric"><span className="br-metric-num">{totalPending}</span><span className="br-metric-lbl">Unembedded</span></span>
      </div>

      {/* Reference desk: hybrid retrieval (elements 10, 11) */}
      <div className="br-block">
        <div className="ec-kicker">Reference desk · hybrid retrieval</div>
        <p className="br-lead">BM25 plus vector plus RRF across all tiers. Finds by meaning, not just keyword.</p>
        <form className="br-search" onSubmit={onHybridSearch}>
          <input
            className="br-input"
            type="text"
            value={hybridQuery}
            onChange={(e) => setHybridQuery(e.target.value)}
            placeholder='Try: "the rule about anthropic credentials" or "video rendering platform"'
          />
          <button type="submit" className="br-submit" disabled={hybrid.loading || !hybridQuery.trim()}>
            {hybrid.loading ? 'Searching' : 'Search'}
          </button>
        </form>
        {hybrid.error && <div className="br-err">{hybrid.error}</div>}
        {hybrid.results && hybrid.results.length === 0 && !hybrid.loading && (
          <div className="br-none">No matches. Try a different phrasing.</div>
        )}
        {hybrid.results && hybrid.results.length > 0 && (
          <div className="br-hits">
            {hybrid.results.map((hit) => <HybridHitRow key={`${hit.id}-${hit.file_path}`} hit={hit} />)}
          </div>
        )}
      </div>

      {/* Memory tiers: the printed index / card-catalog (element 3 tier filter) */}
      <div className="br-block">
        <div className="ec-kicker">Memory tiers · index<span className="ec-kicker-count">{totalRows}</span></div>
        <p className="br-lead">Row counts per tier, live-derived. Click a tier to scope the search below it.</p>
        {loading ? (
          <div className="br-none">Reading claude_memory</div>
        ) : (
          <div className="br-tiers">
            {tierCounts.map((t) => {
              const isClient = !OWN_TIERS.has(t.client_id);
              const active = tierFilter === t.client_id;
              return (
                <button
                  key={t.client_id}
                  type="button"
                  className={`br-tier${isClient ? ' br-tier--client' : ''}`}
                  aria-pressed={active}
                  onClick={() => setTierFilter(active ? '' : t.client_id)}
                >
                  <span className="br-tier-id">{t.client_id}</span>
                  <span className={`br-tier-count${t.count === 0 ? ' br-tier-count--zero' : ''}`}>{t.count}</span>
                  <span className="br-tier-sync">{t.lastSync ? `synced ${timeAgo(t.lastSync)}` : 'never'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legacy tier-scoped search (elements 4, 5, 6, 7) */}
      <div className="br-block">
        <div className="ec-kicker">Ask the brain · tier-scoped</div>
        <p className="br-lead">Legacy substring plus tier filter. n8nClaw can query the same data over WhatsApp.</p>
        <form className="br-search" onSubmit={onLegacySearch}>
          <input
            className="br-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tierFilter ? `Search in ${tierFilter}` : 'workflow ID, vendor preference, ClickUp list, n8n quirk'}
          />
          <button type="submit" className="br-submit" disabled={searching || !query.trim()}>
            {searching ? 'Searching' : 'Search'}
          </button>
          {(searchResults !== null || searchError) && (
            <button type="button" className="br-clear" onClick={() => { setQuery(''); clearSearch(); }}>Clear</button>
          )}
        </form>
        {tierFilter && (
          <div className="br-filter-note">
            Filtered by tier: <span className="br-filter-tier">{tierFilter}</span>
            <button type="button" className="br-filter-clear" onClick={() => setTierFilter('')}>clear filter</button>
          </div>
        )}
        {searchError && <div className="br-err">{searchError}</div>}
        {searchResults !== null && (
          searchResults.length === 0 ? (
            <div className="br-none">No matches.</div>
          ) : (
            <div className="br-hits">
              {searchResults.map((r, i) => (
                <div key={i} className="br-hit">
                  <div className="br-hit-top">
                    <span className="br-hit-tier">{r.client_id}</span>
                    <span className="br-hit-path">{r.file_path}</span>
                  </div>
                  <div className="br-hit-snippet">{r.snippet}</div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Entity graph (element 12 toggle; 17-21 live inside BrainGraphInk) */}
      <div className="br-block">
        <div className="ec-kicker">
          Entity graph
          <button type="button" className="br-tool" style={{ marginLeft: 'auto' }} aria-pressed={graphOpen} onClick={() => setGraphOpen((o) => !o)}>
            {graphOpen ? 'Hide graph' : 'Show graph'}
          </button>
        </div>
        {graphOpen ? (
          <Suspense fallback={<div className="br-none">Loading graph engine</div>}>
            <BrainGraphInk height={520} />
          </Suspense>
        ) : (
          <p className="br-graph-hint">Force-directed view of clients, proposals, ClickUp tasks, workflows, and memory files with the typed edges between them. Click a node for details.</p>
        )}
      </div>

      {/* Clients x Proposals ledger (elements 13, 14, 15, 16) + tool usage */}
      <div className="br-block">
        <div className="ec-kicker">
          Clients × Proposals
          <button type="button" className="br-tool" style={{ marginLeft: 'auto' }} onClick={refreshGraph} title="Reload relations">
            {graphLoading ? 'Loading' : 'Refresh'}
          </button>
        </div>
        <p className="br-lead">{clients.length} clients with {clients.reduce((s, c) => s + c.proposal_count, 0)} proposals. Click to expand.</p>
        {graphError && <div className="br-err">{graphError}</div>}
        {!graphLoading && clients.length === 0 && (
          <div className="br-none">No clients with proposals yet. Run gen-proposals-index.sh to seed the relations table.</div>
        )}
        {clients.length > 0 && (
          <div className="br-ledger">
            {clients.map((c) => <ClientRow key={c.slug} client={c} />)}
          </div>
        )}
        <Suspense fallback={null}>
          <BrainToolUsageInk />
        </Suspense>
      </div>

      {/* Most-linked entities (backlink hot targets) */}
      {backlinks.length > 0 && (
        <div className="br-block">
          <div className="ec-kicker">Most-linked entities</div>
          <p className="br-lead">What the memory files reference the most via [[wikilinks]].</p>
          <div className="br-links">
            {backlinks.slice(0, 16).map((b) => (
              <div key={`${b.target_kind}-${b.target_value}`} className="br-link">
                <span className="br-link-mark">{kindMark(b.target_kind)}</span>
                <span className="br-link-kind">{b.target_kind}</span>
                <span className="br-link-val">{b.target_value}</span>
                <span className="br-link-count">×{b.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending compaction proposals — THE BOX (element 9). The count is this
          surface's single Signal red when > 0. */}
      {reviews.length > 0 && (
        <div className={`ec-box${pendingReviews > 0 ? ' ec-box--tilt' : ''}`}>
          <div className="ec-box-head">
            Warning: <span className="ec-red" style={{ margin: '0 0.3rem' }}>{pendingReviews}</span> compaction proposal{pendingReviews === 1 ? '' : 's'} pending
          </div>
          <div style={{ marginTop: '0.7rem' }}>
            {reviews.map((r, i) => <ReviewRow key={i} review={r} />)}
          </div>
          <div className="br-box-foot">Generated daily by the memory-compactor LaunchAgent. Nothing auto-applies. Review and act manually.</div>
        </div>
      )}

      {/* Session logs — dated register entries (element 8) */}
      <div className="br-block">
        <div className="ec-kicker">Session logs · register<span className="ec-kicker-count">{sessionLogs.length}</span></div>
        {sessionLogs.length === 0 ? (
          <div className="br-none">No session logs yet. Populates after Claude Code sessions trigger the Stop hook.</div>
        ) : (
          <div className="br-logs">
            {sessionLogs.map((log) => <SessionLogRow key={log.id} log={log} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ num, label, muted }: { num: React.ReactNode; label: React.ReactNode; muted?: boolean }) {
  return (
    <div className="ec-lockup" style={{ cursor: 'default' }}>
      <span className={`ec-lockup-num${muted ? ' ec-lockup-num--muted' : ''}`}>{num}</span>
      <span className="ec-lockup-label">{label}</span>
    </div>
  );
}
