import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Check } from 'lucide-react';
import { useContentLibrary, type CarouselDraft } from '../../../hooks/useContentLibrary';
import { useIdeaCandidates } from '../../../hooks/useIdeaCandidates';
import { setStatus, saveDraft } from '../../../lib/studioActions';
import { toastError } from '../../../lib/dashboardActions';
import { decideIdea, SOURCE_LABEL, strengthBand } from '../../../lib/ideaProjection';
import { driveThumbUrl } from '../../../lib/driveThumb';
import { supabase } from '../../../lib/supabase';
import Sheet from '../../ui/Sheet';
import IdeaDetail from '../../dashboard/IdeaDetail';
// Native backend-depth panels — REUSED verbatim from the classic detail view so
// the review lane carries QA verdict + agent log + source briefing without
// opening the full editor.
import QAVerdictPanel from '../../dashboard/QAVerdictPanel';
import AgentLogFeed from '../../dashboard/AgentLogFeed';
import SourceBriefing from '../../dashboard/SourceBriefing';
import { LinkedInPost, ageLabel, REVIEW_FADE_CSS } from './reviewShared';
import './worksurface.css';

// Full detail view (S-DETAIL) — REUSED unmodified. Carries QAVerdictPanel,
// AgentLogFeed, SourceBriefing, retry/regenerate, schedule, publish.
const CarouselEditor = lazy(() => import('../../dashboard/CarouselEditor'));
// Classic board (S-BOARD) — kept reachable, mounted unmodified.
const PostStudioPanel = lazy(() => import('../../dashboard/PostStudioPanel'));

/**
 * Split-lane Desk — Posts working surface (Direction B).
 *
 * Two stacked lanes tuned to two different activities:
 *  TOP LANE  — a dense ideas TABLE for scan-in-bulk triage: the live
 *              lm_idea_candidates rows (via lib/ideaProjection.ts) with
 *              composite/ICP/virality scores, why-line, source; multi-select;
 *              bulk kill (reject); per-row promote (approve-generate) / defer.
 *              Its writes route through decideIdea → lm-curator-decide ONLY
 *              (never carousel_drafts/lm_drafts_v2 for idea: ids).
 *  BOTTOM LANE— a one-at-a-time reader for review drafts: LinkedIn-faithful
 *              preview, Approve/Reject/Edit/Skip + j/k. Writes reuse
 *              setStatus / saveDraft exactly.
 *
 * A shared full-depth slide-over (CarouselEditor for drafts, IdeaDetail for
 * ideas) opens from EITHER lane. Lane focus switches with Tab or the visible
 * lane control; each lane shows its live count. client_id != null rows are
 * NEVER approvable (excluded + shown as a muted count).
 */

const typeKicker = (t: string | null): string =>
  t === 'carousel' ? 'Carousel' : t === 'single_image' ? 'Single image' : t === 'video' ? 'Video' : t === 'text' ? 'Text post' : 'Format TBD';

// First non-heading line of the assembled idea description = the why-line.
function whyLine(d: CarouselDraft): string {
  const raw = (d.ideaWhy || '').replace(/\s+/g, ' ').trim();
  if (raw) return raw;
  const t = (d.topic && d.topic !== d.title) ? d.topic : '';
  return (t || '').replace(/\s+/g, ' ').trim();
}

type Lane = 'ideas' | 'review';

const PostWorkSurface: React.FC = () => {
  const { drafts, loading, refresh, applyOptimistic } = useContentLibrary();
  const { ideas, refreshIdeas, removeIdea } = useIdeaCandidates();

  const [mode, setMode] = useState<'desk' | 'board'>('desk');
  const [lane, setLane] = useState<Lane>('ideas');

  // Ideas lane state
  const ideaRows = useMemo(
    () =>
      [...ideas].sort((a, b) => (b.ideaScores?.composite ?? -1) - (a.ideaScores?.composite ?? -1)),
    [ideas],
  );
  const [ideaCursor, setIdeaCursor] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [killing, setKilling] = useState(false);

  // Review lane state
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [reviewCursor, setReviewCursor] = useState(0);
  const [tally, setTally] = useState({ approved: 0, rejected: 0, skipped: 0 });
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  // Shared detail slide-over
  const [detailId, setDetailId] = useState<string | null>(null);
  // Native inspect rail (QA verdict + agent log + source briefing) — desktop.
  const [inspectOpen, setInspectOpen] = useState(true);
  // Triage drawer
  const [drawer, setDrawer] = useState<null | 'error' | 'stuck'>(null);
  const [confirmStuck, setConfirmStuck] = useState(false);

  // ── Review queue: Ivan's own pending drafts. Client rows EXCLUDED. ────────
  const reviewQueue = useMemo(
    () =>
      drafts
        .filter((d) => d.status === 'review' && !d.clientId && !d.isIdea && !skipped.has(d.id))
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()),
    [drafts, skipped],
  );
  const clientReviewCount = useMemo(
    () => drafts.filter((d) => d.status === 'review' && !!d.clientId && !d.isIdea).length,
    [drafts],
  );

  // ── Native triage: error + stuck-scheduled counts (RELOCATE + mission-named)
  const errorRows = useMemo(() => drafts.filter((d) => d.status === 'error' && !d.clientId), [drafts]);
  const stuckRows = useMemo(
    () =>
      drafts.filter(
        (d) => d.status === 'scheduled' && !d.clientId && d.scheduledAt && new Date(d.scheduledAt).getTime() < Date.now() && !d.sourcePostId,
      ),
    [drafts],
  );

  const reviewTotal = tally.approved + tally.rejected + tally.skipped + reviewQueue.length;
  const reviewPos = tally.approved + tally.rejected + tally.skipped + 1;
  const rClamped = Math.min(reviewCursor, Math.max(0, reviewQueue.length - 1));
  const current: CarouselDraft | null = reviewQueue[rClamped] || null;
  const iClamped = Math.min(ideaCursor, Math.max(0, ideaRows.length - 1));

  useEffect(() => {
    setEditing(false);
    setEditText(current?.postBody || '');
  }, [current?.id]);

  // ── ?open=<id> deeplink (race-safe: the param arrives before drafts load, so
  // stash it and apply once the row is present; write it back on open/close). ─
  const initialOpenRef = useRef<string | null>(
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('open'),
  );
  const initialRestoredRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!initialRestoredRef.current && initialOpenRef.current) return; // wait for restore
    const params = new URLSearchParams(window.location.search);
    if (detailId !== params.get('open')) {
      if (detailId) params.set('open', detailId); else params.delete('open');
      const q = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`);
    }
  }, [detailId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const target = initialOpenRef.current;
    if (!target) { initialRestoredRef.current = true; return; }
    if (ideaRows.some((d) => d.id === target) || drafts.some((d) => d.id === target)) {
      setDetailId(target);
      initialOpenRef.current = null;
      initialRestoredRef.current = true;
    } else if (!loading) {
      initialOpenRef.current = null;
      initialRestoredRef.current = true;
    }
  }, [drafts, ideaRows, loading]);

  // ── Idea actions (curator decide ONLY) ───────────────────────────────────
  // Write FIRST, hide only on confirmed success. The row must not vanish before
  // the curator-decide write lands — a failed decide left the queue lying.
  const promoteIdea = useCallback(async (d: CarouselDraft) => {
    const cid = d.ideaCandidateId;
    if (!cid) return;
    try {
      await decideIdea(cid, 'approve');
      removeIdea(cid);
      toast.success('Promoted, generating now');
      refresh();
    } catch (err) { toastError('promote idea', err); }
  }, [removeIdea, refresh]);

  const deferIdea = useCallback(async (d: CarouselDraft) => {
    const cid = d.ideaCandidateId;
    if (!cid) return;
    try {
      await decideIdea(cid, 'defer');
      removeIdea(cid);
      toast.success('Kept for later');
    } catch (err) { toastError('defer idea', err); }
  }, [removeIdea]);

  // Bulk reject — decide per id, hide ONLY the ids whose write succeeded, and
  // report honestly. The old path removed every row up front and used a catch
  // that allSettled can never trigger, so it always toasted success even when
  // every write failed.
  const killSelected = useCallback(async () => {
    const ids = ideaRows.filter((d) => selected.has(d.id) && d.ideaCandidateId);
    if (!ids.length) return;
    setKilling(true);
    try {
      const results = await Promise.allSettled(
        ids.map((d) => decideIdea(d.ideaCandidateId!, 'reject')),
      );
      const okIds: string[] = [];
      ids.forEach((d, i) => { if (results[i].status === 'fulfilled') okIds.push(d.ideaCandidateId!); });
      okIds.forEach((cid) => removeIdea(cid));
      setSelected((s) => { const n = new Set(s); ids.forEach((d, i) => { if (results[i].status === 'fulfilled') n.delete(d.id); }); return n; });
      const ok = okIds.length;
      const failed = ids.length - ok;
      if (failed === 0) toast.success(`${ok} rejected`);
      else if (ok === 0) toastError('bulk reject', new Error(`all ${failed} still in queue`));
      else toast.warning(`${ok} rejected, ${failed} failed — still in queue`);
    } finally { setKilling(false); }
  }, [ideaRows, selected, removeIdea]);

  const toggleSel = useCallback((id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const allSelected = ideaRows.length > 0 && ideaRows.every((d) => selected.has(d.id));

  // ── Review actions (setStatus / saveDraft EXACT reuse) ───────────────────
  const approve = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    applyOptimistic(id, { status: 'approved' });
    setTally((t) => ({ ...t, approved: t.approved + 1 }));
    try { await setStatus(id, 'approved'); toast.success('Approved'); }
    catch (err) { toastError('approve', err); refresh(); }
  }, [current, applyOptimistic, refresh]);

  const reject = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    applyOptimistic(id, { status: 'disqualified' });
    setTally((t) => ({ ...t, rejected: t.rejected + 1 }));
    try { await setStatus(id, 'disqualified'); toast.success('Rejected'); }
    catch (err) { toastError('reject', err); refresh(); }
  }, [current, applyOptimistic, refresh]);

  const skip = useCallback(() => {
    if (!current) return;
    setSkipped((s) => new Set(s).add(current.id));
    setTally((t) => ({ ...t, skipped: t.skipped + 1 }));
  }, [current]);

  const saveEdit = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    setSaving(true);
    applyOptimistic(id, { postBody: editText });
    try { await saveDraft({ id, post_body: editText }); toast.success('Saved'); setEditing(false); }
    catch (err) { toastError('save draft', err); refresh(); }
    finally { setSaving(false); }
  }, [current, editText, applyOptimistic, refresh]);

  // Disqualify all stuck-scheduled — same write path the classic board uses.
  const disqualifyStuck = useCallback(async () => {
    try {
      const { error } = await supabase.from('carousel_drafts').update({ status: 'disqualified' }).in('id', stuckRows.map((d) => d.id));
      if (error) throw error;
      toast.success(`Disqualified ${stuckRows.length} stuck posts`);
      refresh();
    } catch (err) { toastError('disqualify stuck', err); }
  }, [stuckRows, refresh]);

  // ── Lane-scoped keyboard. Tab switches lane. ─────────────────────────────
  useEffect(() => {
    if (mode !== 'desk') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const inField = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (editing) { if (e.key === 'Escape') { setEditing(false); setEditText(current?.postBody || ''); } return; }
      if (detailId) return; // sheet owns keys while open (Esc handled by Sheet)
      if (e.key === 'Tab' && !inField) { e.preventDefault(); setLane((l) => (l === 'ideas' ? 'review' : 'ideas')); return; }
      if (inField) return;
      if (lane === 'ideas') {
        const cur = ideaRows[iClamped];
        switch (e.key) {
          case 'j': e.preventDefault(); setIdeaCursor((c) => Math.min(c + 1, ideaRows.length - 1)); break;
          case 'k': e.preventDefault(); setIdeaCursor((c) => Math.max(c - 1, 0)); break;
          case 'x': case ' ': e.preventDefault(); if (cur) toggleSel(cur.id); break;
          case 'p': e.preventDefault(); if (cur) promoteIdea(cur); break;
          case 'd': e.preventDefault(); if (cur) deferIdea(cur); break;
          case 'Enter': case 'o': e.preventDefault(); if (cur) setDetailId(cur.id); break;
        }
      } else {
        switch (e.key) {
          case 'j': e.preventDefault(); setReviewCursor((c) => Math.min(c + 1, reviewQueue.length - 1)); break;
          case 'k': e.preventDefault(); setReviewCursor((c) => Math.max(c - 1, 0)); break;
          case 'a': e.preventDefault(); approve(); break;
          case 'r': e.preventDefault(); reject(); break;
          case 'e': e.preventDefault(); if (current) { setEditText(current.postBody || ''); setEditing(true); } break;
          case 's': e.preventDefault(); skip(); break;
          case 'o': e.preventDefault(); if (current) setDetailId(current.id); break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, lane, editing, detailId, ideaRows, iClamped, reviewQueue.length, current, toggleSel, promoteIdea, deferIdea, approve, reject, skip]);

  const previewImage =
    current && current.type === 'single_image' && current.imageUrls?.[0]
      ? driveThumbUrl(current.imageUrls[0], 800) || current.imageUrls[0]
      : null;

  const detailDraft = detailId ? (ideaRows.find((d) => d.id === detailId) || drafts.find((d) => d.id === detailId) || null) : null;

  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  return (
    <div className="ec">
      <style>{REVIEW_FADE_CSS}</style>

      {/* Document header */}
      <div className="ec-topline">
        <span className="ec-topline-brand">Posts</span>
        <span className="ec-topline-meta">
          {now} · {ideaRows.length} IDEAS · {reviewQueue.length} IN REVIEW
        </span>
      </div>

      <div className="ws-head">
        <h1 className="ec-hed ec-hed--today" style={{ fontSize: 'clamp(40px,4.4vw,60px)', margin: 0 }}>Posts</h1>
        <div className="ws-tools">
          <button className="ws-tool" aria-pressed={mode === 'desk'} onClick={() => setMode('desk')}>Desk</button>
          <button className="ws-tool" aria-pressed={mode === 'board'} onClick={() => setMode('board')}>Board</button>
          <button className="ws-tool-icon" onClick={() => { refresh(); refreshIdeas(); }} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {mode === 'board' ? (
        <Suspense fallback={<div className="ws-loading">Loading board…</div>}>
          <PostStudioPanel />
        </Suspense>
      ) : (
        <>
          {/* Native triage signals: error + stuck-scheduled counts */}
          <div className="ws-signals">
            <button className="ws-signal" onClick={() => setDrawer((d) => (d === 'error' ? null : 'error'))}>
              <span className={`ws-signal-num ${errorRows.length ? '' : 'ws-signal-num--zero'}`}>{errorRows.length}</span>
              <span className="ws-signal-lbl">errors</span>
            </button>
            <button className="ws-signal" onClick={() => setDrawer((d) => (d === 'stuck' ? null : 'stuck'))}>
              <span className={`ws-signal-num ${stuckRows.length ? '' : 'ws-signal-num--zero'}`}>{stuckRows.length}</span>
              <span className="ws-signal-lbl">stuck scheduled</span>
            </button>
            {clientReviewCount > 0 && (
              <span className="ws-clientnote">{clientReviewCount} client draft{clientReviewCount === 1 ? '' : 's'} in review · client boards own these</span>
            )}
            <span className="ws-signal-note">Click a count to triage. Detail opens the full agent log.</span>
          </div>

          {/* Triage drawer (error / stuck lists) */}
          {drawer && (
            <div className="ws-drawer">
              {(drawer === 'error' ? errorRows : stuckRows).slice(0, 30).map((d) => (
                <button key={d.id} className="ws-drawer-row" onClick={() => setDetailId(d.id)}>
                  <span className="ws-drawer-date">{d.scheduledAt ? new Date(d.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'error'}</span>
                  <span className="ws-drawer-title">{d.title || d.topic || '(untitled)'}</span>
                </button>
              ))}
              {(drawer === 'error' ? errorRows : stuckRows).length === 0 && (
                <div className="ws-drawer-row" style={{ cursor: 'default' }}><span className="ws-drawer-title" style={{ color: 'var(--ec-mutedc)' }}>Nothing {drawer === 'error' ? 'errored' : 'stuck'}.</span></div>
              )}
              {drawer === 'stuck' && stuckRows.length > 0 && (
                <div style={{ padding: '0.5rem 0.4rem' }}>
                  <button className="ws-mini ws-mini--ghost" onClick={() => setConfirmStuck(true)}>Disqualify all {stuckRows.length}</button>
                </div>
              )}
            </div>
          )}

          {/* Lane control — visible focus switch, each lane its live count */}
          <div className="ws-lanebar" role="tablist" aria-label="Work lanes">
            <button role="tab" className="ws-lane-pill" aria-selected={lane === 'ideas'} onClick={() => setLane('ideas')}>
              Ideas <span className="ws-lane-count">{ideaRows.length}</span>
            </button>
            <button role="tab" className="ws-lane-pill" aria-selected={lane === 'review'} onClick={() => setLane('review')}>
              Review <span className={`ws-lane-count ${reviewQueue.length ? 'ws-lane-count--live' : ''}`}>{reviewQueue.length}</span>
            </button>
          </div>

          {/* ── TOP LANE: ideas table ─────────────────────────────────────── */}
          <section className={`ws-lane ${lane === 'ideas' ? '' : 'ws-lane--idle'}`}>
            <div className="ws-lane-cap">
              <span className="ws-lane-cap-h">Ideas · scan and triage</span>
              <span className="ws-lane-cap-hint"><kbd>x</kbd> select · <kbd>p</kbd> promote · <kbd>d</kbd> defer · <kbd>Tab</kbd> switch lane</span>
            </div>

            {selected.size > 0 && (
              <div className="ws-bulk">
                <span className="ws-bulk-count">{selected.size} selected</span>
                <button className="ws-mini" disabled={killing} onClick={killSelected}>Kill selected</button>
                <button className="ws-bulk-clear" onClick={() => setSelected(new Set())}>Clear</button>
              </div>
            )}

            <div className="ws-idt">
              <div className="ws-idt-head">
                <button className={`ws-check ${allSelected ? 'ws-check--on' : ''}`} title="Select all"
                  onClick={() => setSelected(allSelected ? new Set() : new Set(ideaRows.map((d) => d.id)))}>
                  {allSelected && <Check className="w-3 h-3" />}
                </button>
                <span className="ws-idt-hcell">Strength</span>
                <span className="ws-idt-hcell">Angle</span>
                <span className="ws-idt-hcell ws-idt-scores-cell">ICP · Vir · Gap</span>
                <span className="ws-idt-hcell ws-idt-src-cell">Source</span>
                <span className="ws-idt-hcell" style={{ textAlign: 'right' }}>Action</span>
              </div>

              {loading && ideaRows.length === 0 ? (
                <div className="ws-loading">Loading ideas…</div>
              ) : ideaRows.length === 0 ? (
                <div className="ws-loading">No scored ideas in the queue right now.</div>
              ) : (
                ideaRows.map((d, i) => {
                  const sc = d.ideaScores;
                  const band = strengthBand(sc?.composite);
                  const sel = selected.has(d.id);
                  return (
                    <div
                      key={d.id}
                      className={`ws-idt-row ${i === iClamped && lane === 'ideas' ? 'ws-idt-row--cur' : ''} ${sel ? 'ws-idt-row--sel' : ''}`}
                      onClick={() => { setLane('ideas'); setIdeaCursor(i); setDetailId(d.id); }}
                    >
                      <button className={`ws-check ${sel ? 'ws-check--on' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleSel(d.id); }} title="Select">
                        {sel && <Check className="w-3 h-3" />}
                      </button>
                      <span className={`ws-strength ${band === 'Low' ? 'ws-strength--low' : ''}`}>
                        {band || 'n/a'}{sc?.composite != null && <small>{sc.composite}</small>}
                      </span>
                      <div className="ws-idt-topic">
                        <div className="ws-idt-title">{d.title || d.topic || '(untitled)'}</div>
                        {whyLine(d) && <div className="ws-idt-why">{whyLine(d)}</div>}
                      </div>
                      <span className="ws-scores ws-idt-scores-cell">
                        {sc?.icp ?? '-'} · {sc?.virality ?? '-'} · {sc?.gap ?? '-'}
                      </span>
                      <span className="ws-src ws-idt-src-cell">{d.ideaSource ? (SOURCE_LABEL[d.ideaSource] || d.ideaSource) : 'source n/a'}</span>
                      <span className="ws-idt-acts" onClick={(e) => e.stopPropagation()}>
                        <button className="ws-mini" onClick={() => promoteIdea(d)}>Promote</button>
                        <button className="ws-mini ws-mini--ghost" onClick={() => deferIdea(d)}>Defer</button>
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* ── BOTTOM LANE: review reader ────────────────────────────────── */}
          <section className={`ws-lane ${lane === 'review' ? '' : 'ws-lane--idle'}`} style={{ marginTop: '1.8rem' }}>
            <div className="ws-lane-cap">
              <span className="ws-lane-cap-h">In review · read and judge</span>
              <span className="ws-lane-cap-hint"><kbd>a</kbd> approve · <kbd>r</kbd> reject · <kbd>e</kbd> edit · <kbd>s</kbd> skip · <kbd>o</kbd> detail</span>
            </div>

            {loading && drafts.length === 0 ? (
              <div className="ws-loading">Loading posts…</div>
            ) : !current ? (
              <div className="ws-empty">
                <div className="ws-empty-h">Review queue clear</div>
                <div className="ws-empty-note">No posts are waiting on your judgment. Promote an idea above to feed the queue, or open the Board.</div>
                <div className="ws-empty-tally">{tally.approved} approved · {tally.rejected} rejected · {tally.skipped} skipped this session</div>
              </div>
            ) : (
              <div className={`ws-reader ${inspectOpen ? 'ws-reader--insp' : ''}`}>
                <aside className="ws-rail">
                  {reviewQueue.map((d, i) => (
                    <button key={d.id} className={`ws-rail-row ${i === rClamped ? 'ws-rail-row--cur' : ''}`}
                      onClick={() => { setLane('review'); setReviewCursor(i); }}>
                      <div className="ws-rail-title">{d.title || d.topic || '(untitled)'}</div>
                      <div className="ws-rail-meta">{typeKicker(d.type)} · {ageLabel(d.updatedAt)} old</div>
                    </button>
                  ))}
                </aside>

                <div className="ws-read-main">
                  <div key={current.id} className="review-advance">
                    <div className="ws-read-cap">
                      <b>In review</b>
                      <span>· {typeKicker(current.type)}</span>
                      <span>· {ageLabel(current.updatedAt)} old</span>
                      <span className="ws-read-pos">{reviewPos} of {reviewTotal}</span>
                      <button className="ws-inspect-toggle" style={{ marginLeft: '0.6rem' }} onClick={() => setInspectOpen((o) => !o)}>
                        {inspectOpen ? 'Hide inspect' : 'Inspect'}
                      </button>
                    </div>

                    {editing ? (
                      <div>
                        <div className="ws-lm-lbl" style={{ marginBottom: '0.5rem' }}>Post body</div>
                        <textarea autoFocus className="ws-edit" rows={16} value={editText} onChange={(e) => setEditText(e.target.value)} />
                        <div className="ws-actions">
                          <button className="ws-key ws-key--primary" disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
                          <button className="ws-key" onClick={() => { setEditing(false); setEditText(current.postBody || ''); }}>Cancel <kbd>esc</kbd></button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <LinkedInPost text={current.postBody || ''} image={previewImage} />
                        {current.type === 'carousel' && current.imageUrls && current.imageUrls.length > 0 && (
                          <div className="ws-slides">
                            {current.imageUrls.map((u, i) => (
                              <img key={i} src={driveThumbUrl(u, 400) || u} alt="" loading="lazy" />
                            ))}
                          </div>
                        )}
                        <div className="ws-actions">
                          <button className="ws-key ws-key--primary" onClick={approve}><kbd>a</kbd> Approve</button>
                          <button className="ws-key" onClick={reject}><kbd>r</kbd> Reject</button>
                          <button className="ws-key" onClick={() => { setEditText(current.postBody || ''); setEditing(true); }}><kbd>e</kbd> Edit</button>
                          <button className="ws-key" onClick={skip}><kbd>s</kbd> Skip</button>
                          <button className="ws-key" onClick={() => setDetailId(current.id)}><kbd>o</kbd> Detail</button>
                          <span className="ws-move-hint"><kbd>j</kbd>/<kbd>k</kbd> to move</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Native inspect rail — QA verdict + agent log + source
                    briefing, reused verbatim. No full-editor detour needed. */}
                {inspectOpen && (
                  <aside className="ws-inspect">
                    <div className="ws-inspect-head">
                      <span className="ws-inspect-h">Backend depth</span>
                      <button className="ws-inspect-toggle" onClick={() => setInspectOpen(false)}>Hide</button>
                    </div>
                    <SourceBriefing description={current.description} defaultOpen={false} />
                    <QAVerdictPanel entries={current.agentLog} />
                    <AgentLogFeed entries={current.agentLog} table="carousel_drafts" rowId={current.id} onNoteAdded={refresh} />
                  </aside>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* Shared full-depth slide-over — opens from either lane. */}
      <Sheet
        open={!!detailDraft}
        onClose={() => setDetailId(null)}
        size="full"
        title={detailDraft ? <span className="truncate">{detailDraft.isIdea ? 'Idea' : (detailDraft.title || 'Post')}</span> : ''}
      >
        {detailDraft && (detailDraft.isIdea ? (
          <IdeaDetail draft={detailDraft} onClose={() => setDetailId(null)} onDecided={(cid) => { removeIdea(cid); refresh(); }} />
        ) : (
          <Suspense fallback={<div className="ws-loading" style={{ padding: '2rem' }}>Loading detail…</div>}>
            <CarouselEditor draft={detailDraft} onClose={() => setDetailId(null)} onChanged={refresh} />
          </Suspense>
        ))}
      </Sheet>

      {/* Confirm: disqualify all stuck */}
      {confirmStuck && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(19,18,16,0.4)' }} onClick={() => setConfirmStuck(false)}>
          <div className="ws-empty" style={{ background: '#fff', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="ws-empty-h">Disqualify {stuckRows.length} stuck posts?</div>
            <div className="ws-empty-note">They passed their scheduled time with no LinkedIn URN, so the publisher did not ship them.</div>
            <div className="ws-actions">
              <button className="ws-key ws-key--primary" onClick={() => { setConfirmStuck(false); disqualifyStuck(); }}>Disqualify</button>
              <button className="ws-key" onClick={() => setConfirmStuck(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostWorkSurface;
