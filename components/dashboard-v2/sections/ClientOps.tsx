import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../editorial-cockpit.css';
import '../review/worksurface.css';
import QAVerdictPanel from '../../dashboard/QAVerdictPanel';
import AgentLogFeed from '../../dashboard/AgentLogFeed';
import {
  useClientsOverview,
  useClientDetail,
  ClientPost,
  PUBLIC_STORAGE,
  stripPrefix,
  fmtDate,
  ageLabel,
  icpBand,
  money,
  isUrl,
  type Draft,
  type Idea,
  type Lm,
  type ActionRow,
  type BoardLm,
  type BoardIdentity,
} from './clientops2/shared';

/**
 * Client Ops — FINAL cockpit (round-2 tournament winner).
 *
 * Panel-judged synthesis: Direction B's pipeline-first chassis + three grafts.
 *   graft 1 (A) — HEALTH STRIP of ws-tally tiles (avg ICP / avg QA / capture /
 *                 buffer / spend), denominators only, NO raw pipeline counts,
 *                 NO red. The "how healthy" glance.
 *   graft 2 (A) — funnel bar SILHOUETTE as the lead-magnet line's rollup.
 *   graft 3 (C) — PIPELINE PROVENANCE inspect block in the review lane.
 *
 * The hero is B's connected STAGE STRIP (staged ideas → in review → in buffer →
 * live on board). Clicking a stage focuses its work lane below (tab-switch, no
 * caret-expands anywhere). The ideas lane is the floor's DENSE ws-idt table
 * (scan-in-bulk), not a one-at-a-time reader — the panel's mandated fix.
 *
 * Signal red is spent EXACTLY ONCE in the whole composition: the stage-strip
 * IN-REVIEW count when > 0 (the load-bearing operator bottleneck). QAVerdict /
 * AgentLogFeed carry their own internal halt-red — exempt, reused backend panels.
 *
 * Every figure derives from returned rows via `aggregates` (shared). No data →
 * an honest empty state, never a placeholder figure. All writes route through
 * the round-1 gated operator_* RPCs via ./clientops2/shared — verbatim.
 */

type StageKey = 'ideas' | 'review' | 'buffer' | 'live';

const num = (n: number | null | undefined, digits = 0) => (n == null ? '—' : n.toFixed(digits));
const fig = (n: number | null | undefined) => (n == null ? '—' : String(Math.round(n)));
const pct = (r: number | null | undefined) => (r == null ? '—' : `${Math.round(r * 100)}%`);

// ── Section root ─────────────────────────────────────────────────────────────
export function ClientOps() {
  const { clients, error: overviewError, reload: reloadOverview } = useClientsOverview();

  // Single-client fast path: auto-open the one client (Rise DTC today). The
  // switcher pills only surface once a second client exists.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (clients && clients.length && !clients.some((c) => c.client_id === selectedId)) {
      setSelectedId(clients[0].client_id);
    }
  }, [clients, selectedId]);
  const client = useMemo(
    () => clients?.find((c) => c.client_id === selectedId) ?? null,
    [clients, selectedId],
  );

  const {
    drafts, actions, ideas, lms, boardLms, identity, queue, errors, aggregates,
    reload, onToggle, onSchedule, onDecideIdea, onSwapCover,
  } = useClientDetail(client);

  const [stage, setStage] = useState<StageKey>('review');
  const [reviewCursor, setReviewCursor] = useState(0);
  const [ideaSelId, setIdeaSelId] = useState<string | null>(null);

  const [schedBusy, setSchedBusy] = useState(false);
  const [schedNote, setSchedNote] = useState('');
  const [toggleBusyId, setToggleBusyId] = useState<string | null>(null);
  const [decideBusy, setDecideBusy] = useState<string | null>(null);

  // ── Derived lane arrays (guard nulls) ──────────────────────────────────────
  const reviewDrafts = useMemo(
    () => (drafts || []).filter((d) => d.status === 'review')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [drafts],
  );
  const scheduledDrafts = useMemo(() => (drafts || []).filter((d) => d.status === 'scheduled'), [drafts]);
  const liveDrafts = useMemo(() => (drafts || []).filter((d) => d.board_visible), [drafts]);
  const publishedDrafts = useMemo(
    () => (drafts || []).filter((d) => d.status === 'published' && !d.board_visible),
    [drafts],
  );
  const disqualified = useMemo(() => (drafts || []).filter((d) => d.status === 'disqualified'), [drafts]);
  // RPC already orders ideas by icp_score desc; re-sort defensively so the dense
  // table always reads strongest-first regardless of load order.
  const ideaRows = useMemo(
    () => [...(ideas || [])].sort((a, b) => (b.icp_score ?? -1) - (a.icp_score ?? -1)),
    [ideas],
  );

  const rClamped = Math.min(reviewCursor, Math.max(0, reviewDrafts.length - 1));
  const current: Draft | null = reviewDrafts[rClamped] || null;

  // Keep a valid idea selection: default to the top row; reset when it leaves.
  useEffect(() => {
    if (!ideaRows.length) { if (ideaSelId !== null) setIdeaSelId(null); return; }
    if (!ideaRows.some((r) => r.id === ideaSelId)) setIdeaSelId(ideaRows[0].id);
  }, [ideaRows, ideaSelId]);

  useEffect(() => { setSchedNote(''); setSchedBusy(false); }, [current?.id]);

  const boardLink = client?.board?.url ? `${client.board.url}?k=${client.board.token ?? ''}` : undefined;

  const handleSchedule = useCallback(async (d: Draft) => {
    if (schedBusy) return;
    setSchedBusy(true);
    setSchedNote('');
    try {
      const res = await onSchedule(d);
      if (!res.ok && res.error === 'awaiting_media') setSchedNote('waiting on image');
    } finally { setSchedBusy(false); }
  }, [onSchedule, schedBusy]);

  const handleToggle = useCallback(async (d: Draft, next: boolean) => {
    setToggleBusyId(d.id);
    try { await onToggle(d, next); } finally { setToggleBusyId(null); }
  }, [onToggle]);

  const handleDecide = useCallback(async (idea: Idea, decision: 'approved' | 'rejected') => {
    setDecideBusy(idea.id + decision);
    try { await onDecideIdea(idea, decision); } finally { setDecideBusy(null); }
  }, [onDecideIdea]);

  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const A = aggregates;

  // ── Stage strip model — every count from returned rows. Red once: review. ───
  const stages: { key: StageKey; no: string; label: string; count: number; rider: string; zero: boolean; red?: boolean }[] = [
    {
      key: 'ideas', no: '01', label: 'Staged ideas', count: A.ideasStaged, zero: A.ideasStaged === 0,
      rider: A.ideasStaged > 0 ? 'ranked by client-ICP' : 'nothing staged yet',
    },
    {
      key: 'review', no: '02', label: 'In review', count: reviewDrafts.length,
      zero: reviewDrafts.length === 0, red: reviewDrafts.length > 0,
      rider: reviewDrafts.length > 0 ? 'read + judge below' : 'queue clear',
    },
    {
      key: 'buffer', no: '03', label: 'In buffer', count: scheduledDrafts.length, zero: scheduledDrafts.length === 0,
      rider: A.nextPublish ? `next ${fmtDate(A.nextPublish)}` : 'none dated yet',
    },
    {
      key: 'live', no: '04', label: 'Live on board', count: liveDrafts.length, zero: liveDrafts.length === 0,
      rider: A.funnel.views > 0 ? `${A.funnel.views} views so far` : 'no funnel traffic yet',
    },
  ];

  // ── Health strip tiles (graft 1) — denominators only, NO red, NO raw counts ─
  const health = [
    {
      no: '01', label: 'Avg idea-ICP', value: fig(A.avgIcp), zero: A.avgIcp == null,
      sub: A.icpN > 0 ? `over ${A.icpN} staged · ${icpBand(A.avgIcp)} band` : 'none scored yet',
    },
    {
      no: '02', label: 'Avg draft-QA', value: num(A.avgQa, 1), zero: A.avgQa == null,
      sub: A.qaN > 0 ? `over ${A.qaN} scored drafts` : 'none scored yet',
    },
    {
      no: '03', label: 'LM capture', value: pct(A.captureRate), zero: A.captureRate == null,
      sub: A.funnel.views > 0
        ? `${A.funnel.captures} of ${A.funnel.views} views · ${A.funnel.completes} complete`
        : 'no views yet',
    },
    {
      no: '04', label: 'Buffer', value: A.bufferDepth == null ? '—' : String(A.bufferDepth), zero: !A.bufferDepth,
      sub: A.nextPublish ? `next ${fmtDate(A.nextPublish)}` : 'no dates yet',
    },
    {
      no: '05', label: 'Spend', value: money(client?.spend?.total_usd), zero: !(client?.spend?.total_usd),
      sub: `${money(client?.spend?.week_usd)} this week`,
    },
  ];

  // ── Overview-level states ──────────────────────────────────────────────────
  if (clients == null) {
    return <div className="ec"><style>{CSS}</style><div className="ws-loading">Loading clients…</div></div>;
  }

  return (
    <div className="ec">
      <style>{CSS}</style>

      <div className="ec-topline">
        <span className="ec-topline-brand">Client Ops</span>
        <span className="ec-topline-meta">{client ? client.company : '—'} · {now}</span>
      </div>

      <div className="ws-head">
        <h1 className="ec-hed ec-hed--today" style={{ fontSize: 'clamp(38px,4.2vw,58px)', margin: 0 }}>
          {client?.company || 'Client'}
        </h1>
        <div className="ws-tools">
          {clients.length > 1 && clients.map((c) => (
            <button
              key={c.client_id}
              className="ws-tool"
              aria-pressed={c.client_id === selectedId}
              onClick={() => { setSelectedId(c.client_id); setReviewCursor(0); setIdeaSelId(null); setStage('review'); }}
            >
              {c.company}
            </button>
          ))}
          <button className="ws-tool-icon" onClick={() => { reloadOverview(); reload(); }} title="Refresh">↻</button>
        </div>
      </div>

      {overviewError && (
        <div className="co2-err">
          {overviewError}
          <button className="ws-tool" style={{ marginLeft: '0.6rem' }} onClick={() => reloadOverview()}>Retry</button>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="ws-empty">
          <div className="ws-empty-h">No productized clients yet</div>
          <div className="ws-empty-note">Bootstrap one and it appears here automatically.</div>
        </div>
      ) : !client ? (
        <div className="ws-loading">Selecting client…</div>
      ) : (
        <>
          {/* Header meta line: status, tier, lanes, spend, board-as-client link */}
          <div className="co2-meta">
            <span className="co2-meta-status">{client.status}</span>
            <span>{client.tier}</span>
            <span>lanes {client.lanes.armed}/{client.lanes.total}</span>
            <span>spend {money(client.spend?.total_usd)} · {money(client.spend?.week_usd)} this week</span>
            {boardLink && <a className="co2-link" href={boardLink} target="_blank" rel="noreferrer">view board as client ↗</a>}
          </div>

          {/* ── HEALTH STRIP (graft 1) — how-healthy glance. No red here. ───── */}
          <div className="ws-tally co2-health" style={{ ['--ws-tally-cols' as any]: 5 }}>
            {health.map((h) => (
              <div key={h.no} className="ws-tally-tile" style={{ cursor: 'default' }}>
                <span className="ws-tally-no">{h.no} · health</span>
                <span className={`ws-tally-count ${h.zero ? 'ws-tally-count--zero' : ''}`}>{h.value}</span>
                <span className="ws-tally-label">{h.label}</span>
                <span className="ws-tally-sub">{h.sub}</span>
              </div>
            ))}
          </div>

          {/* ── HERO: the production line (B chassis). Red once: In review. ─── */}
          <div className="co2-line" role="tablist" aria-label="Production line stages">
            {stages.map((s) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={stage === s.key}
                className={`co2-stage ${stage === s.key ? 'co2-stage--on' : ''}`}
                onClick={() => setStage(s.key)}
              >
                <span className="co2-stage-no">{s.no} · Stage</span>
                <span className={`co2-stage-count ${s.red ? 'co2-stage-count--red' : s.zero ? 'co2-stage-count--zero' : ''}`}>{s.count}</span>
                <span className="co2-stage-label">{s.label}</span>
                <span className="co2-stage-rider">{s.rider}</span>
              </button>
            ))}
          </div>
          <p className="co2-flowcap">
            Ideas approve into drafts → drafts you schedule fill the buffer → live posts drive the lead-magnet funnel. Click a stage to work it.
          </p>

          {/* ── FOCUSED WORK LANE ─────────────────────────────────────────── */}
          {stage === 'ideas' && (
            <IdeasLane
              ideas={ideaRows}
              loading={ideas == null}
              err={errors.ideas}
              selId={ideaSelId}
              onSelect={setIdeaSelId}
              decideBusy={decideBusy}
              onDecide={handleDecide}
              onNote={reload}
            />
          )}

          {stage === 'review' && (
            <ReviewLane
              drafts={reviewDrafts}
              loading={drafts == null}
              err={errors.drafts}
              disqualified={disqualified.length}
              cursor={rClamped}
              current={current}
              identity={identity}
              onCursor={setReviewCursor}
              schedBusy={schedBusy}
              schedNote={schedNote}
              toggleBusyId={toggleBusyId}
              onSchedule={handleSchedule}
              onToggle={handleToggle}
              onNote={reload}
            />
          )}

          {stage === 'buffer' && (
            <BufferLane scheduled={scheduledDrafts} bufferDepth={A.bufferDepth} nextPublish={A.nextPublish} queue={queue} loading={drafts == null} />
          )}

          {stage === 'live' && (
            <LiveLane
              live={liveDrafts}
              published={publishedDrafts}
              toggleBusyId={toggleBusyId}
              onToggle={handleToggle}
              loading={drafts == null}
            />
          )}

          {/* ── PARALLEL: lead-magnet line (graft 2 rollup + per-LM cards) ──── */}
          <LmLine lms={lms} err={errors.lms} funnel={A.funnel} boardLms={boardLms} onSwapCover={onSwapCover} onNote={reload} />

          {/* ── Client activity feed ──────────────────────────────────────── */}
          <ActionsFeed actions={actions} err={errors.actions} />
        </>
      )}
    </div>
  );
}

// ── Ideas lane: DENSE ws-idt table (floor grammar) + right inspect column ─────
function IdeasLane({ ideas, loading, err, selId, onSelect, decideBusy, onDecide, onNote }: {
  ideas: Idea[]; loading: boolean; err?: string; selId: string | null;
  onSelect: (id: string) => void; decideBusy: string | null;
  onDecide: (idea: Idea, d: 'approved' | 'rejected') => void; onNote: () => void;
}) {
  const current = ideas.find((i) => i.id === selId) ?? ideas[0] ?? null;
  return (
    <section className="co2-laneblock">
      <div className="ec-kicker">Staged ideas — ranked by client-ICP fit · approve to generate a draft in Review</div>
      {err && <div className="co2-err">{err}</div>}
      {loading ? (
        <div className="ws-loading">Loading ideas…</div>
      ) : ideas.length === 0 ? (
        <div className="co2-emptyline">No staged ideas right now. Nothing to score.</div>
      ) : (
        <div className="co2-idt-wrap">
          <div className="co2-idt-main">
            <div className="ws-idt co2-idt">
              <div className="ws-idt-head">
                <span className="ws-idt-hcell">Band</span>
                <span className="ws-idt-hcell">Angle</span>
                <span className="ws-idt-hcell co2-idt-scores">ICP · Buy · Auth</span>
                <span className="ws-idt-hcell co2-idt-src">Source</span>
                <span className="ws-idt-hcell" style={{ textAlign: 'right' }}>Action</span>
              </div>
              {ideas.map((idea) => {
                const b = idea.score_breakdown;
                const band = icpBand(idea.icp_score);
                const cur = idea.id === (current?.id ?? null);
                const busy = decideBusy === idea.id + 'approved' || decideBusy === idea.id + 'rejected';
                return (
                  <div
                    key={idea.id}
                    className={`ws-idt-row co2-idt-row ${cur ? 'ws-idt-row--cur' : ''}`}
                    onClick={() => onSelect(idea.id)}
                  >
                    <span className={`ws-strength ${band === 'Low' ? 'ws-strength--low' : ''}`}>
                      {band || 'n/a'}{idea.icp_score != null && <small>{Math.round(idea.icp_score)}</small>}
                    </span>
                    <div className="ws-idt-topic">
                      <div className="ws-idt-title">{stripPrefix(idea.hook || idea.title || '(untitled idea)')}</div>
                      {b?.why && <div className="ws-idt-why">{b.why}</div>}
                    </div>
                    <span className="ws-scores co2-idt-scores">
                      {b?.icp_fit ?? '–'} · {b?.buyer_signal ?? '–'} · {b?.authority_fit ?? '–'}
                    </span>
                    <span className="ws-src co2-idt-src">
                      {isUrl(idea.source_ref) ? (
                        <a href={idea.source_ref!} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: 'var(--ec-ink)' }}>
                          {idea.source_label || 'source'} ↗
                        </a>
                      ) : (idea.source_label || 'source n/a')}
                    </span>
                    <span className="ws-idt-acts" onClick={(e) => e.stopPropagation()}>
                      <button className="ws-mini" disabled={busy} onClick={() => onDecide(idea, 'approved')}>
                        {decideBusy === idea.id + 'approved' ? '…' : 'Approve'}
                      </button>
                      <button className="ws-mini ws-mini--ghost" disabled={busy} onClick={() => onDecide(idea, 'rejected')}>
                        {decideBusy === idea.id + 'rejected' ? '…' : 'Pass'}
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {current && (
            <aside className="ws-inspect co2-idt-inspect" key={current.id}>
              <div className="ws-inspect-head"><span className="ws-inspect-h">Idea detail</span></div>
              <h2 className="ec-subhead" style={{ fontSize: 17 }}>{stripPrefix(current.hook || current.title || '(untitled idea)')}</h2>
              {current.title && current.title !== current.hook && (
                <p className="co2-body">{current.title}</p>
              )}
              {current.score_breakdown ? (
                <div className="co2-breakdown">
                  <div className="co2-bd-figs">
                    <span><b>{current.score_breakdown.icp_fit ?? '—'}</b>/40 ICP fit</span>
                    <span><b>{current.score_breakdown.buyer_signal ?? '—'}</b>/30 buyer signal</span>
                    <span><b>{current.score_breakdown.authority_fit ?? '—'}</b>/30 authority</span>
                  </div>
                  {current.score_breakdown.why && <p className="co2-body" style={{ marginTop: '0.7rem', marginBottom: 0 }}>{current.score_breakdown.why}</p>}
                  <div className="co2-rubric">
                    rubric: {current.score_breakdown.rubric_version || 'unversioned'} (provisional — pending client criteria)
                  </div>
                </div>
              ) : (
                <div className="co2-miss" style={{ margin: '0.6rem 0' }}>Not scored yet.</div>
              )}
              <AgentLogFeed entries={current.agent_log || []} table="client_ideas" rowId={current.id} onNoteAdded={onNote} />
            </aside>
          )}
        </div>
      )}
    </section>
  );
}

// ── Review lane: rail + client-faithful reader + schedule/toggle + inspect ────
function ReviewLane({ drafts, loading, err, disqualified, cursor, current, identity, onCursor, schedBusy, schedNote, toggleBusyId, onSchedule, onToggle, onNote }: {
  drafts: Draft[]; loading: boolean; err?: string; disqualified: number; cursor: number; current: Draft | null;
  identity: BoardIdentity | null;
  onCursor: (i: number) => void; schedBusy: boolean; schedNote: string; toggleBusyId: string | null;
  onSchedule: (d: Draft) => void; onToggle: (d: Draft, next: boolean) => void; onNote: () => void;
}) {
  const image = current && current.type === 'single_image' && isUrl(current.image_urls?.[0]) ? current.image_urls![0] : null;
  const canSchedule = current?.status === 'review' && current.has_media !== false;
  return (
    <section className="co2-laneblock">
      <div className="ec-kicker">In review — read each draft as the client's post · schedule to buffer, or flip it live on the board</div>
      {err && <div className="co2-err">{err}</div>}
      {disqualified > 0 && <div className="co2-note">{disqualified} disqualified · hidden from the line</div>}
      {loading ? (
        <div className="ws-loading">Loading drafts…</div>
      ) : drafts.length === 0 ? (
        <div className="co2-emptyline">Nothing in review. Approve an idea to feed the line.</div>
      ) : (
        <div className="ws-reader ws-reader--insp">
          <aside className="ws-rail">
            {drafts.map((d, i) => (
              <button key={d.id} className={`ws-rail-row ${i === cursor ? 'ws-rail-row--cur' : ''}`} onClick={() => onCursor(i)}>
                <div className="co2-rail-top">
                  {d.type === 'single_image' && isUrl(d.image_urls?.[0]) && (
                    <img className="co2-thumb" src={d.image_urls![0]} alt="" loading="lazy" />
                  )}
                  <div className="ws-rail-title">{stripPrefix(d.title) || '(untitled)'}</div>
                </div>
                <div className="ws-rail-meta">
                  {d.type === 'text' ? 'Text' : d.type === 'single_image' ? 'Image' : 'Carousel'}
                  {d.qa_score != null ? ` · QA ${d.qa_score}` : ''}
                  {d.board_visible ? ' · on board' : ''}
                  {` · ${ageLabel(d.created_at)} old`}
                </div>
              </button>
            ))}
          </aside>

          <div className="ws-read-main">
            {current && (
              <div key={current.id}>
                <div className="ws-read-cap">
                  <b>In review</b>
                  <span>· {current.type.replace('_', ' ')}</span>
                  {current.qa_score != null && <span>· QA {current.qa_score}</span>}
                  <span className="ws-read-pos">{cursor + 1} of {drafts.length}</span>
                </div>

                <ClientPost text={current.post_body || ''} identity={identity} image={image} />

                {current.type === 'carousel' && current.image_urls && current.image_urls.length > 0 && (
                  <div className="ws-slides">
                    {current.image_urls.map((u, i) => <img key={i} src={u} alt="" loading="lazy" />)}
                  </div>
                )}

                <div className="ws-actions">
                  {canSchedule ? (
                    <button className="ws-key ws-key--primary" disabled={schedBusy} onClick={() => onSchedule(current)}>
                      {schedBusy ? 'Scheduling…' : 'Schedule to buffer'}
                    </button>
                  ) : current.status === 'review' ? (
                    <span className="co2-await">◷ waiting on image</span>
                  ) : (
                    <span className="co2-note">{current.status}</span>
                  )}
                  <label className="co2-toggle" title={current.status === 'review' ? 'Show on the client board' : 'Only review drafts can be shown'}>
                    <span>On board</span>
                    <button
                      role="switch"
                      aria-checked={current.board_visible}
                      aria-label="On board"
                      disabled={current.status !== 'review' || toggleBusyId === current.id}
                      className={`co2-switch ${current.board_visible ? 'co2-switch--on' : ''}`}
                      onClick={() => onToggle(current, !current.board_visible)}
                    />
                  </label>
                </div>
                {schedNote && <div className="co2-await" style={{ marginTop: '0.5rem' }}>{schedNote}</div>}
              </div>
            )}
          </div>

          {current && (
            <aside className="ws-inspect">
              {/* graft 3 (C): PIPELINE PROVENANCE — where this draft came from */}
              <div className="co2-prov">
                <div className="co2-block-lbl">Pipeline provenance</div>
                <div className="co2-prov-line"><span>From idea</span><b>{current.idea_source_label || 'not linked'}</b></div>
                {current.idea_source_ref && (
                  <div className="co2-prov-line">
                    <span>Ref</span>
                    {isUrl(current.idea_source_ref)
                      ? <b><a className="co2-provlink" href={current.idea_source_ref} target="_blank" rel="noreferrer">source ↗</a></b>
                      : <b className="co2-mono">{current.idea_source_ref}</b>}
                  </div>
                )}
                <div className="co2-prov-line">
                  <span>Idea ICP</span>
                  <b>{current.idea_icp_score != null ? `${Math.round(current.idea_icp_score)} · ${icpBand(current.idea_icp_score)}` : 'not scored'}</b>
                </div>
                {current.source_post_id && <div className="co2-prov-line"><span>Origin</span><b>spun from a source post</b></div>}
              </div>
              <QAVerdictPanel entries={current.agent_log || []} />
              <AgentLogFeed entries={current.agent_log || []} table="carousel_drafts" rowId={current.id} onNoteAdded={onNote} />
            </aside>
          )}
        </div>
      )}
    </section>
  );
}

// ── Buffer lane: scheduled drafts ledger + honest board-queue depth ──────────
function BufferLane({ scheduled, bufferDepth, nextPublish, queue, loading }: {
  scheduled: Draft[]; bufferDepth: number | null; nextPublish: string | null;
  queue: ReturnType<typeof useClientDetail>['queue']; loading: boolean;
}) {
  return (
    <section className="co2-laneblock">
      <div className="ec-kicker">In buffer — scheduled to publish on the client's cadence</div>
      {loading ? (
        <div className="ws-loading">Loading…</div>
      ) : scheduled.length === 0 ? (
        <div className="co2-emptyline">Nothing scheduled yet — schedule a reviewed draft into the buffer.</div>
      ) : (
        <div className="co2-ledger">
          {scheduled.map((d) => (
            <div key={d.id} className="co2-lrow">
              <span className="co2-ltitle">{stripPrefix(d.title) || '(untitled)'}</span>
              <span className="co2-lmeta">{d.board_visible ? 'on board · ' : ''}{d.scheduled_at ? `publishes ${fmtDate(d.scheduled_at)}` : 'awaiting slot'}</span>
            </div>
          ))}
        </div>
      )}
      <div className="co2-note" style={{ marginTop: '0.9rem' }}>
        {bufferDepth != null
          ? `Board queue holds ${bufferDepth} entr${bufferDepth === 1 ? 'y' : 'ies'}${nextPublish ? ` · next publish ${fmtDate(nextPublish)}` : ' · no publish dates set yet'}.`
          : 'Board queue not loaded.'}
        {queue && queue.length > 0 ? ` (${queue.length} in board JSON)` : ''}
      </div>
    </section>
  );
}

// ── Live lane: what's on the board (toggle review rows) + published rows ──────
function LiveLane({ live, published, toggleBusyId, onToggle, loading }: {
  live: Draft[]; published: Draft[]; toggleBusyId: string | null;
  onToggle: (d: Draft, next: boolean) => void; loading: boolean;
}) {
  return (
    <section className="co2-laneblock">
      <div className="ec-kicker">Live on board — visible to the client · pull a review draft off to hide it</div>
      {loading ? (
        <div className="ws-loading">Loading…</div>
      ) : live.length === 0 && published.length === 0 ? (
        <div className="co2-emptyline">Nothing shown on the client board yet.</div>
      ) : (
        <div className="co2-ledger">
          {live.map((d) => {
            const canToggle = d.status === 'review';
            return (
              <div key={d.id} className="co2-lrow">
                <span className="co2-ltitle">{stripPrefix(d.title) || '(untitled)'}</span>
                <span className="co2-lmeta">
                  {d.type === 'text' ? 'Text' : d.type === 'single_image' ? 'Image' : 'Carousel'}
                  {d.qa_score != null ? ` · QA ${d.qa_score}` : ''}
                  {!canToggle ? ` · ${d.status}` : ''}
                </span>
                <button
                  role="switch"
                  aria-checked
                  aria-label="On board"
                  disabled={!canToggle || toggleBusyId === d.id}
                  className="co2-switch co2-switch--on"
                  onClick={() => { if (canToggle) onToggle(d, false); }}
                  title={canToggle ? 'Hide from the client board' : 'Published rows stay on the board'}
                />
              </div>
            );
          })}
          {published.map((d) => (
            <div key={d.id} className="co2-lrow">
              <span className="co2-ltitle">{stripPrefix(d.title) || '(untitled)'}</span>
              <span className="co2-lmeta">
                {d.type === 'text' ? 'Text' : d.type === 'single_image' ? 'Image' : 'Carousel'} · published{d.published_at ? ` ${fmtDate(d.published_at)}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Lead-magnet line: funnel silhouette rollup (graft 2) + per-LM cards ───────
function LmLine({ lms, err, funnel, boardLms, onSwapCover, onNote }: {
  lms: Lm[] | null; err?: string; funnel: { views: number; captures: number; completes: number; cta_clicks: number };
  boardLms: BoardLm[] | null; onSwapCover: (lmId: string, url: string) => void; onNote: () => void;
}) {
  const funMax = Math.max(1, funnel.views, funnel.captures, funnel.completes, funnel.cta_clicks);
  const bars: [string, number][] = [
    ['Views', funnel.views], ['Captures', funnel.captures], ['Completes', funnel.completes], ['CTA', funnel.cta_clicks],
  ];
  return (
    <section className="co2-laneblock co2-lm-section">
      <div className="ec-kicker">Lead-magnet line — the parallel pipeline: draft → live → capturing</div>
      {err && <div className="co2-err">{err}</div>}

      {/* graft 2 (A): funnel bar silhouette as the line's rollup */}
      {lms != null && (
        funnel.views > 0 ? (
          <div className="co2-funbar">
            {bars.map(([label, n]) => (
              <div className="co2-funbar-row" key={label}>
                <span className="co2-funbar-lbl">{label}</span>
                <span className="co2-funbar-track"><span className="co2-funbar-fill" style={{ width: `${Math.max(2, (n / funMax) * 100)}%` }} /></span>
                <span className="co2-funbar-num">{n}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="co2-note" style={{ margin: '0.6rem 0 1.2rem' }}>No lead-magnet traffic yet.</div>
        )
      )}

      {lms == null ? (
        <div className="ws-loading">Loading lead magnets…</div>
      ) : lms.length === 0 ? (
        <div className="co2-emptyline">No lead magnets in the client funnel yet.</div>
      ) : (
        <div className="co2-lms">
          {lms.map((lm) => {
            const f = lm.funnel || { views: 0, captures: 0, completes: 0, cta_clicks: 0 };
            const hasLog = (lm.agent_log?.length ?? 0) > 0;
            return (
              <div key={lm.id} className="co2-lm">
                <div className="co2-lm-head">
                  <span className="co2-lm-topic">{stripPrefix(lm.topic)}</span>
                  <span className={`co2-pill ${lm.status === 'live' ? 'co2-pill--live' : ''}`}>{lm.status}</span>
                </div>
                {lm.format && <div className="co2-note">{lm.format}</div>}
                {lm.cover_url ? (
                  <img className="co2-cover" src={lm.cover_url} alt="" loading="lazy" />
                ) : (
                  <div className="co2-miss" style={{ margin: '0.6rem 0' }}>No cover generated yet.</div>
                )}
                <div className="co2-funnel">
                  <span className="co2-fig"><span className="co2-fig-n">{f.views}</span><span className="co2-fig-l">Views</span></span>
                  <span className="co2-fig"><span className="co2-fig-n">{f.captures}</span><span className="co2-fig-l">Captures</span></span>
                  <span className="co2-fig"><span className="co2-fig-n">{f.completes}</span><span className="co2-fig-l">Completes</span></span>
                  <span className="co2-fig"><span className="co2-fig-n">{f.cta_clicks}</span><span className="co2-fig-l">CTA</span></span>
                </div>
                <div className="co2-lm-links">
                  {isUrl(lm.resource_url) ? <a className="co2-link" href={lm.resource_url!} target="_blank" rel="noreferrer">resource ↗</a> : <span className="co2-miss">no resource</span>}
                  {isUrl(lm.landing_url) ? <a className="co2-link" href={lm.landing_url!} target="_blank" rel="noreferrer">landing ↗</a> : <span className="co2-miss">no landing</span>}
                </div>
                {hasLog && (
                  <div style={{ marginTop: '0.7rem' }}>
                    <QAVerdictPanel entries={lm.agent_log} />
                    <div style={{ height: '0.6rem' }} />
                    <AgentLogFeed entries={lm.agent_log} table="lm_drafts_v2" rowId={lm.id} onNoteAdded={onNote} />
                  </div>
                )}
                {!hasLog && (
                  <div style={{ marginTop: '0.7rem' }}>
                    <AgentLogFeed entries={[]} table="lm_drafts_v2" rowId={lm.id} onNoteAdded={onNote} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* LM covers pick-strip — rendered ONCE, only when a variation pair exists */}
      {boardLms != null && boardLms.length > 0 && (
        <div style={{ marginTop: '1.4rem' }}>
          <div className="ec-kicker">LM covers — pick the one the board runs</div>
          {boardLms.map((lm) => (
            <div key={lm.id} className="co2-lrow" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.5rem' }}>
              <span className="co2-ltitle">{lm.title}</span>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                {(lm.covers || []).map((url) => {
                  const active = url === lm.cover_url;
                  return (
                    <button
                      key={url}
                      onClick={() => { if (!active) onSwapCover(lm.id, url); }}
                      title={active ? 'Live on the board' : 'Set as the board cover'}
                      className={`co2-coverpick ${active ? 'co2-coverpick--on' : ''}`}
                    >
                      <img src={url} alt="" loading="lazy" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Client actions feed ──────────────────────────────────────────────────────
function ActionsFeed({ actions, err }: { actions: ActionRow[] | null; err?: string }) {
  return (
    <section className="co2-laneblock">
      <div className="ec-kicker">Client activity — last 20 taps, edits, voice notes</div>
      {err && <div className="co2-err">{err}</div>}
      {actions == null ? (
        <div className="ws-loading">Loading activity…</div>
      ) : actions.length === 0 ? (
        <div className="co2-emptyline">No client activity yet.</div>
      ) : (
        <div className="co2-feed">
          {actions.map((a) => {
            const p = a.payload || {};
            const isVoice = p.event === 'voice_note' || a.action === 'voice_note';
            const audioUrl = isVoice && p.path ? `${PUBLIC_STORAGE}/${p.path}` : null;
            const summary = isVoice
              ? `voice note${p.duration_s ? ` · ${Math.round(p.duration_s)}s` : ''}`
              : (p.event || p.text || a.ref || (Object.keys(p).length ? JSON.stringify(p).slice(0, 80) : '—'));
            return (
              <div key={a.id} className="co2-feed-row">
                <span className="co2-feed-act">{a.action}</span>
                <span className="co2-feed-meta">{summary}</span>
                {audioUrl && <a className="co2-play" href={audioUrl} target="_blank" rel="noreferrer">play ▸</a>}
                <span className="co2-feed-date">{fmtDate(a.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── Scoped styles (co2- prefix; Black Box v4 register under .ec) ─────────────
const CSS = `
.ec .co2-meta { display:flex; flex-wrap:wrap; align-items:baseline; gap:1.1rem; font-family:var(--ec-sans); font-size:11.5px; color:var(--ec-mutedc); border-bottom:1px solid var(--ec-rule); padding-bottom:0.7rem; margin-bottom:1.4rem; letter-spacing:0.01em; }
.ec .co2-meta-status { font-weight:700; font-size:10px; letter-spacing:0.06em; text-transform:uppercase; color:var(--ec-ink); }
.ec .co2-link { color:var(--ec-ink); text-decoration:underline; text-underline-offset:2px; }
.ec .co2-link:hover { text-decoration-thickness:2px; }

/* HEALTH STRIP (graft 1) — ws-tally grammar, 5 tiles, no built-in stacking */
.ec .co2-health { margin-bottom:1.6rem; }
@media (max-width:1080px){ .ec .co2-health{ grid-template-columns:repeat(3,1fr)!important; } .ec .co2-health .ws-tally-tile:nth-child(4){ border-left:0; } .ec .co2-health .ws-tally-tile:nth-child(n+4){ border-top:1px solid var(--ec-rule); } }
@media (max-width:560px){ .ec .co2-health{ grid-template-columns:repeat(2,1fr)!important; } .ec .co2-health .ws-tally-tile:nth-child(odd){ border-left:0; } .ec .co2-health .ws-tally-tile:nth-child(n+3){ border-top:1px solid var(--ec-rule); } }

/* HERO stage strip (B chassis) */
.ec .co2-line { display:flex; align-items:stretch; border-top:3px solid var(--ec-ink); border-bottom:1px solid var(--ec-rule-strong); margin-bottom:0.5rem; }
.ec .co2-stage { flex:1 1 0; min-width:0; display:flex; flex-direction:column; gap:0.26rem; padding:1rem 1.05rem 1.05rem; border-left:1px solid var(--ec-rule); background:transparent; text-align:left; cursor:pointer; font:inherit; color:inherit; position:relative; transition:background 0.15s ease; }
.ec .co2-stage:first-child { border-left:0; }
.ec .co2-stage:not(:first-child)::before { content:'▸'; position:absolute; left:-7px; top:50%; transform:translateY(-50%); color:var(--ec-dim); font-size:11px; line-height:1; background:var(--ec-paper); padding:2px 0; }
.ec .co2-stage:hover { background:rgba(19,18,16,0.03); }
.ec .co2-stage--on { background:rgba(19,18,16,0.05); box-shadow:inset 0 3px 0 var(--ec-ink); }
.ec .co2-stage:focus-visible { outline:2px solid var(--ec-ink); outline-offset:-2px; }
.ec .co2-stage-no { font-family:var(--ec-sans); font-weight:700; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co2-stage-count { font-family:var(--ec-sans); font-weight:800; letter-spacing:-0.035em; font-size:clamp(38px,3.6vw,52px); line-height:0.9; color:var(--ec-ink); font-variant-numeric:lining-nums tabular-nums; }
.ec .co2-stage-count--zero { color:var(--ec-dim); }
.ec .co2-stage-count--red { color:var(--ec-red); }
.ec .co2-stage-label { font-family:var(--ec-sans); font-weight:700; font-size:11px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-ink); }
.ec .co2-stage-rider { font-family:var(--ec-sans); font-size:11px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ec .co2-flowcap { font-family:var(--ec-sans); font-size:11.5px; color:var(--ec-mutedc); letter-spacing:0.01em; margin:0 0 1.8rem; }

/* Lane blocks */
.ec .co2-laneblock { margin-bottom:2.4rem; }
.ec .co2-lm-section { border-top:1px solid var(--ec-rule); padding-top:1.6rem; }
.ec .co2-emptyline { font-family:var(--ec-sans); font-size:13px; color:var(--ec-mutedc); padding:1.4rem 0; }
.ec .co2-note { font-family:var(--ec-sans); font-size:11.5px; color:var(--ec-mutedc); letter-spacing:0.01em; }
.ec .co2-err { font-family:var(--ec-sans); font-size:12px; color:var(--ec-red); margin:0.4rem 0 0.9rem; }
.ec .co2-body { font-family:var(--ec-sans); font-size:14px; line-height:1.6; color:var(--ec-body); margin:0 0 1rem; }

/* IDEAS lane: dense table (floor ws-idt grammar, no checkbox col) + inspect */
.ec .co2-idt-wrap { display:grid; grid-template-columns:minmax(0,1fr) minmax(300px,340px); gap:clamp(1.2rem,2.4vw,2.2rem); align-items:start; }
.ec .co2-idt-main { min-width:0; }
.ec .co2-idt-inspect { border-left:1px solid var(--ec-rule); padding-left:1.1rem; }
.ec .co2-idt .ws-idt-head,
.ec .co2-idt .co2-idt-row { grid-template-columns:88px minmax(0,1fr) 120px 104px 128px; gap:0.7rem; }
@media (max-width:1080px){ .ec .co2-idt-wrap{ grid-template-columns:1fr; } .ec .co2-idt-inspect{ border-left:0; border-top:1px solid var(--ec-rule); padding-left:0; padding-top:1rem; } }
@media (max-width:640px){ .ec .co2-idt .ws-idt-head{ display:none; } .ec .co2-idt .co2-idt-row{ grid-template-columns:58px minmax(0,1fr) auto; } .ec .co2-idt-scores, .ec .co2-idt-src{ display:none; } }

/* Review rail thumbnail */
.ec .co2-rail-top { display:flex; align-items:flex-start; gap:0.5rem; }
.ec .co2-thumb { width:34px; height:34px; object-fit:cover; border:1px solid var(--ec-rule); flex:0 0 auto; background:rgba(19,18,16,0.04); }

/* Idea breakdown (inspect) */
.ec .co2-breakdown { border-top:1px solid var(--ec-rule); padding-top:0.8rem; margin-bottom:1rem; }
.ec .co2-bd-figs { display:flex; flex-wrap:wrap; gap:1.2rem; font-family:var(--ec-sans); font-size:12px; color:var(--ec-body); }
.ec .co2-bd-figs b { font-family:'Berkeley Mono', ui-monospace, Menlo, monospace; font-weight:600; font-size:15px; color:var(--ec-ink); font-variant-numeric:tabular-nums; }
.ec .co2-rubric { font-family:var(--ec-clinical); font-style:italic; font-size:12px; color:var(--ec-mutedc); margin-top:0.5rem; }
.ec .co2-miss { font-family:var(--ec-clinical); font-style:italic; font-size:12.5px; color:var(--ec-mutedc); }

/* Provenance block (graft 3, C grammar) */
.ec .co2-prov { border-top:1px solid var(--ec-rule-strong); padding:0.1rem 0 0.4rem; margin-bottom:0.4rem; }
.ec .co2-block-lbl { font-family:var(--ec-sans); font-weight:700; font-size:10.5px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-ink); display:flex; align-items:center; gap:0.5rem; margin-bottom:0.55rem; }
.ec .co2-block-lbl::before { content:''; width:8px; height:8px; background:var(--ec-ink); flex:0 0 auto; }
.ec .co2-prov-line { display:flex; align-items:baseline; justify-content:space-between; gap:0.8rem; padding:0.28rem 0; border-bottom:1px solid var(--ec-rule); }
.ec .co2-prov-line span { font-family:var(--ec-sans); font-weight:700; font-size:10px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); flex:0 0 auto; }
.ec .co2-prov-line b { font-family:var(--ec-sans); font-size:12.5px; font-weight:600; color:var(--ec-ink); text-align:right; min-width:0; word-break:break-word; }
.ec .co2-mono { font-family:'Berkeley Mono', ui-monospace, Menlo, monospace; font-variant-numeric:tabular-nums; }
.ec .co2-provlink { color:var(--ec-ink); text-decoration:underline; text-underline-offset:2px; }

/* On-board toggle + await state */
.ec .co2-toggle { display:inline-flex; align-items:center; gap:0.5rem; margin-left:auto; font-family:var(--ec-sans); font-size:11px; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co2-switch { position:relative; width:34px; height:18px; border:1px solid var(--ec-rule-strong); background:var(--ec-paper); cursor:pointer; padding:0; flex:0 0 auto; transition:background 0.15s ease, border-color 0.15s ease; }
.ec .co2-switch::after { content:''; position:absolute; top:1px; left:1px; width:14px; height:14px; background:var(--ec-mutedc); transition:transform 0.15s ease, background 0.15s ease; }
.ec .co2-switch--on { background:var(--ec-ink); border-color:var(--ec-ink); }
.ec .co2-switch--on::after { transform:translateX(16px); background:var(--ec-paper); }
.ec .co2-switch:disabled { opacity:0.4; cursor:default; }
.ec .co2-await { font-family:var(--ec-sans); font-size:11.5px; font-weight:700; letter-spacing:0.03em; text-transform:uppercase; color:var(--ec-mutedc); display:inline-flex; align-items:center; }

/* Ledgers (buffer / live) */
.ec .co2-ledger { border-top:1px solid var(--ec-rule); }
.ec .co2-lrow { display:flex; align-items:center; gap:0.8rem; padding:0.6rem 0.2rem; border-bottom:1px solid var(--ec-rule); }
.ec .co2-ltitle { flex:1; min-width:0; font-family:var(--ec-sans); font-size:14px; color:var(--ec-ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ec .co2-lmeta { font-family:var(--ec-sans); font-size:11px; color:var(--ec-mutedc); font-variant-numeric:tabular-nums; flex:0 0 auto; }

/* Funnel silhouette rollup (graft 2, A grammar; Berkeley Mono numerals) */
.ec .co2-funbar { display:flex; flex-direction:column; gap:0.4rem; margin:0.7rem 0 1.6rem; max-width:520px; }
.ec .co2-funbar-row { display:grid; grid-template-columns:92px 1fr auto; align-items:center; gap:0.9rem; transition:transform 0.15s ease; }
.ec .co2-funbar-row:hover { transform:translateX(2px); }
.ec .co2-funbar-lbl { font-family:var(--ec-sans); font-weight:700; font-size:10px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); }
.ec .co2-funbar-track { height:22px; background:rgba(19,18,16,0.06); position:relative; }
.ec .co2-funbar-fill { display:block; height:100%; background:var(--ec-ink); }
.ec .co2-funbar-num { font-family:'Berkeley Mono', ui-monospace, Menlo, monospace; font-size:15px; color:var(--ec-ink); font-variant-numeric:tabular-nums; min-width:2.6rem; text-align:right; }
@media (max-width:640px){ .ec .co2-funbar-row{ grid-template-columns:78px 1fr auto; } }

/* Per-LM figure row */
.ec .co2-funnel { display:flex; flex-wrap:wrap; gap:1.4rem; padding:0.4rem 0; }
.ec .co2-fig { display:flex; flex-direction:column; }
.ec .co2-fig-n { font-family:var(--ec-sans); font-weight:800; font-size:21px; letter-spacing:-0.02em; color:var(--ec-ink); line-height:1; font-variant-numeric:tabular-nums; }
.ec .co2-fig-l { font-family:var(--ec-sans); font-weight:700; font-size:10px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); margin-top:0.25rem; }

/* LM cards */
.ec .co2-lms { display:grid; grid-template-columns:repeat(auto-fit, minmax(320px, 1fr)); gap:1.8rem; }
.ec .co2-lm { border-top:3px solid var(--ec-ink); padding-top:0.8rem; min-width:0; }
.ec .co2-lm-head { display:flex; align-items:baseline; gap:0.6rem; margin-bottom:0.3rem; }
.ec .co2-lm-topic { flex:1; min-width:0; font-family:var(--ec-sans); font-weight:700; font-size:16px; letter-spacing:-0.01em; color:var(--ec-ink); line-height:1.2; }
.ec .co2-pill { font-family:var(--ec-sans); font-weight:700; font-size:9.5px; letter-spacing:0.05em; text-transform:uppercase; color:var(--ec-mutedc); border:1px solid var(--ec-rule-strong); padding:0.14rem 0.42rem; flex:0 0 auto; }
.ec .co2-pill--live { color:var(--ec-paper); background:var(--ec-ink); border-color:var(--ec-ink); }
.ec .co2-cover { width:100%; max-width:220px; border:1px solid var(--ec-rule); background:rgba(19,18,16,0.04); display:block; margin:0.6rem 0; }
.ec .co2-lm-links { display:flex; gap:1.1rem; margin:0.4rem 0 0.2rem; font-family:var(--ec-sans); font-size:11.5px; }

/* Cover pick */
.ec .co2-coverpick { padding:0; background:none; cursor:pointer; border:1px solid var(--ec-rule); line-height:0; opacity:0.72; }
.ec .co2-coverpick--on { border:2px solid var(--ec-ink); opacity:1; cursor:default; }
.ec .co2-coverpick img { height:96px; display:block; }

/* Actions feed */
.ec .co2-feed { border-top:1px solid var(--ec-rule); }
.ec .co2-feed-row { display:flex; align-items:baseline; gap:0.8rem; padding:0.5rem 0.2rem; border-bottom:1px solid var(--ec-rule); }
.ec .co2-feed-act { font-family:var(--ec-sans); font-weight:700; font-size:10px; letter-spacing:0.04em; text-transform:uppercase; color:var(--ec-ink); flex:0 0 auto; min-width:130px; }
.ec .co2-feed-meta { flex:1; min-width:0; font-family:var(--ec-sans); font-size:12px; color:var(--ec-mutedc); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ec .co2-play { font-family:var(--ec-sans); font-size:11px; color:var(--ec-ink); text-decoration:underline; text-underline-offset:2px; flex:0 0 auto; }
.ec .co2-feed-date { font-family:'Berkeley Mono', ui-monospace, Menlo, monospace; font-size:11px; color:var(--ec-mutedc); flex:0 0 auto; }

/* Responsive: stage strip wraps, never overflows */
@media (max-width: 820px) {
  .ec .co2-line { flex-wrap:wrap; }
  .ec .co2-stage { flex:1 1 45%; }
  .ec .co2-stage:nth-child(3) { border-left:0; }
}
@media (max-width: 480px) {
  .ec .co2-stage { flex:1 1 100%; border-left:0; border-top:1px solid var(--ec-rule); }
  .ec .co2-stage:first-child { border-top:0; }
  .ec .co2-stage:not(:first-child)::before { content:'▾'; left:50%; top:-8px; transform:translateX(-50%); }
  .ec .co2-feed-act { min-width:100px; }
}
`;
