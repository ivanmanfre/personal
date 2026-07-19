import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { useLeadMagnets, type LeadMagnetDraft } from '../../../hooks/useLeadMagnets';
import { saveLMDraft, buildLMAssets, generateLMContent } from '../../../lib/studioActions';
import { toastError } from '../../../lib/dashboardActions';
import { supabase } from '../../../lib/supabase';
import { driveThumbUrl, versionedAssetUrl } from '../../../lib/driveThumb';
import { ageLabel, REVIEW_FADE_CSS } from './reviewShared';
import Sheet from '../../ui/Sheet';
// Native backend-depth panels — REUSED verbatim in the LM review rail.
import QAVerdictPanel from '../../dashboard/QAVerdictPanel';
import AgentLogFeed from '../../dashboard/AgentLogFeed';
import './worksurface.css';

// Full editor (S-DETAIL) — REUSED unmodified. Carries AgentLogFeed, QA checks,
// cover regen, resource editor, schedule, repost, delete.
const LeadMagnetEditor = lazy(() => import('../../dashboard/LeadMagnetEditor'));
// Classic studio (S-BOARD) — kept reachable, mounted unmodified.
const LeadMagnetStudioPanel = lazy(() => import('../../dashboard/LeadMagnetStudioPanel'));

/**
 * LM Studio working surface (Direction B).
 *
 * A one-at-a-time approve view. Unlike the old reader it renders the ACTUAL
 * thing being approved without extra navigation: the resource page itself
 * (iframe srcDoc of resource_html, or iframe src of resource_url), the cover
 * image, AND the email copy, all in view. The primary action for a status
 * 'review' LM is "Approve & build assets" (buildLMAssets → lm-gen-v2 phase
 * assets) — the pipeline step that actually builds the resource/email/cover.
 * A plain status-approve is available as an explicit secondary.
 *
 * The silent board-fallback is KILLED: an empty queue renders an explicit
 * Black Box empty state and NEVER auto-switches to the classic studio. The
 * Studio toggle stays for manual access. Format matching is case-insensitive
 * (isLmFormat) everywhere.
 */

// Canonical LM formats — matched case-insensitively (trap 1 fix). Lowercase
// 'checklist'/'calculator' rows in review must not vanish.
const FORMATS = [
  'Checklist', 'Calculator', 'Interactive Assessment', 'Guide', 'AI Kit',
  'N8N Workflow', 'Stack Picker', 'Annotated Architecture', 'Live AI Walkthrough', 'Skill Pack',
];
const FORMATS_LC = new Set(FORMATS.map((f) => f.toLowerCase()));
const isLmFormat = (fmt: string | null | undefined) => FORMATS_LC.has((fmt || '').trim().toLowerCase());

const lmTitle = (d: LeadMagnetDraft): string => d.topic || d.description || (d.format ? `${d.format}` : 'Lead magnet');

const LmWorkSurface: React.FC = () => {
  const { drafts, loading, refresh } = useLeadMagnets();

  const [mode, setMode] = useState<'desk' | 'studio'>('desk');
  const [cursor, setCursor] = useState(0);
  const [acted, setActed] = useState<Set<string>>(() => new Set());
  const [tally, setTally] = useState({ approved: 0, rejected: 0, skipped: 0 });
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Native inspect rail (QA verdict + agent log) — desktop.
  const [inspectOpen, setInspectOpen] = useState(true);

  // Anchors — the glance tiles scroll to the matching region.
  const readerRef = useRef<HTMLDivElement>(null);
  const errorStripRef = useRef<HTMLDivElement>(null);
  const scrollTo = useCallback((ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const queue = useMemo(
    () =>
      drafts
        .filter((d) => d.status === 'review' && !d.clientId && isLmFormat(d.format) && !acted.has(d.id))
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()),
    [drafts, acted],
  );
  // Rows in review whose format casing/name is off-roster — surfaced honestly
  // rather than silently hidden (the classic board drops them entirely).
  const offRosterCount = useMemo(
    () => drafts.filter((d) => d.status === 'review' && !d.clientId && !isLmFormat(d.format) && !acted.has(d.id)).length,
    [drafts, acted],
  );
  // Client-owned LMs in review — NEVER approvable here (their client board owns
  // the approve/build path). Shown as a muted count only.
  const clientReviewCount = useMemo(
    () => drafts.filter((d) => d.status === 'review' && !!d.clientId).length,
    [drafts],
  );
  // Errored LMs (client-excluded) — surfaced in an attention strip with retry.
  const errorRows = useMemo(
    () => drafts.filter((d) => d.status === 'error' && !d.clientId && !acted.has(d.id)),
    [drafts, acted],
  );

  const total = tally.approved + tally.rejected + tally.skipped + queue.length;
  const position = tally.approved + tally.rejected + tally.skipped + 1;
  const clamped = Math.min(cursor, Math.max(0, queue.length - 1));
  const current: LeadMagnetDraft | null = queue[clamped] || null;

  useEffect(() => { setEditing(false); setEditText(current?.postBody || ''); }, [current?.id]);

  // ── ?open=<id> deeplink (race-safe): stash the initial param, apply once the
  // row is present, and write it back on Sheet open/close. ──────────────────
  const initialOpenRef = useRef<string | null>(
    typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('open'),
  );
  const initialRestoredRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!initialRestoredRef.current && initialOpenRef.current) return;
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
    if (drafts.some((d) => d.id === target)) {
      setDetailId(target);
      initialOpenRef.current = null;
      initialRestoredRef.current = true;
    } else if (!loading) {
      initialOpenRef.current = null;
      initialRestoredRef.current = true;
    }
  }, [drafts, loading]);

  const advance = useCallback(() => setCursor((c) => Math.max(0, Math.min(c, queue.length - 1))), [queue.length]);

  // PRIMARY approve for a review LM: build the assets (the real pipeline step).
  const approveBuild = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    setBusy(true);
    setActed((s) => new Set(s).add(id));
    setTally((t) => ({ ...t, approved: t.approved + 1 }));
    advance();
    try {
      await buildLMAssets({ draft_id: id, topic: current.topic || '', format: current.format || 'Checklist' });
      toast.success('Approved, building assets (~5 min)');
      await refresh();
    } catch (err) {
      // Un-act on failure: the optimistic hide + approved tally must roll back
      // so the row returns to the queue instead of silently vanishing.
      setActed((s) => { const n = new Set(s); n.delete(id); return n; });
      setTally((t) => ({ ...t, approved: Math.max(0, t.approved - 1) }));
      toastError('approve & build assets', err);
    }
    finally { setBusy(false); }
  }, [current, advance, refresh]);

  // Retry a failed LM generation (content phase) — clears the error by re-firing.
  const retryLM = useCallback(async (d: LeadMagnetDraft) => {
    try {
      await generateLMContent({ draft_id: d.id, topic: d.topic || '', format: d.format || 'Checklist' });
      toast.success('Retrying generation');
      await refresh();
    } catch (err) { toastError('retry lead magnet', err); }
  }, [refresh]);

  // SECONDARY explicit status-only approve.
  const approveStatus = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    setActed((s) => new Set(s).add(id));
    setTally((t) => ({ ...t, approved: t.approved + 1 }));
    advance();
    try {
      const { error } = await supabase.from('lm_drafts_v2').update({ status: 'approved' }).eq('id', id);
      if (error) throw error;
      toast.success('Status set to approved');
      await refresh();
    } catch (err) { toastError('approve', err); refresh(); }
  }, [current, advance, refresh]);

  const reject = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    setActed((s) => new Set(s).add(id));
    setTally((t) => ({ ...t, rejected: t.rejected + 1 }));
    advance();
    try {
      const { error } = await supabase.from('lm_drafts_v2').update({ status: 'disqualified' }).eq('id', id);
      if (error) throw error;
      toast.success('Rejected');
      await refresh();
    } catch (err) { toastError('reject', err); refresh(); }
  }, [current, advance, refresh]);

  const skip = useCallback(() => {
    if (!current) return;
    setActed((s) => new Set(s).add(current.id));
    setTally((t) => ({ ...t, skipped: t.skipped + 1 }));
    advance();
  }, [current, advance]);

  const saveEdit = useCallback(async () => {
    if (!current) return;
    setSaving(true);
    try { await saveLMDraft({ id: current.id, post_body: editText }); toast.success('Saved'); setEditing(false); await refresh(); }
    catch (err) { toastError('save lead magnet', err); refresh(); }
    finally { setSaving(false); }
  }, [current, editText, refresh]);

  useEffect(() => {
    if (mode !== 'desk') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const inField = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (editing) { if (e.key === 'Escape') { setEditing(false); setEditText(current?.postBody || ''); } return; }
      if (detailId) return;
      if (inField) return;
      switch (e.key) {
        case 'j': e.preventDefault(); setCursor((c) => Math.min(c + 1, queue.length - 1)); break;
        case 'k': e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); break;
        case 'a': e.preventDefault(); approveBuild(); break;
        case 'r': e.preventDefault(); reject(); break;
        case 'e': e.preventDefault(); if (current) { setEditText(current.postBody || ''); setEditing(true); } break;
        case 's': e.preventDefault(); skip(); break;
        case 'o': e.preventDefault(); if (current) setDetailId(current.id); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, editing, detailId, queue.length, current, approveBuild, reject, skip]);

  const cover = current ? driveThumbUrl(versionedAssetUrl(current.coverUrl, current.updatedAt), 900) : null;
  const detailDraft = detailId ? drafts.find((d) => d.id === detailId) || null : null;
  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  return (
    <div className="ec">
      <style>{REVIEW_FADE_CSS}</style>

      <div className="ec-topline">
        <span className="ec-topline-brand">LM Studio</span>
        <span className="ec-topline-meta">{now}{offRosterCount ? ` · ${offRosterCount} OFF-ROSTER` : ''}</span>
      </div>

      <div className="ws-head">
        <h1 className="ec-hed ec-hed--today" style={{ fontSize: 'clamp(40px,4.4vw,60px)', margin: 0 }}>Lead Magnets</h1>
        <div className="ws-tools">
          <button className="ws-tool" aria-pressed={mode === 'desk'} onClick={() => setMode('desk')}>Approve</button>
          <button className="ws-tool" aria-pressed={mode === 'studio'} onClick={() => setMode('studio')}>Studio</button>
          <button className="ws-tool-icon" onClick={refresh} title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {mode === 'studio' ? (
        <Suspense fallback={<div className="ws-loading">Loading studio…</div>}>
          <LeadMagnetStudioPanel />
        </Suspense>
      ) : (
        <>
          {/* Glance tiles — big counted header grafted from dir-C's stepper
              grammar. Counts read the same memoized arrays the lanes render.
              Red is spent ONCE, on ATTENTION, when it has errors. */}
          <div className="ws-tally" style={{ ['--ws-tally-cols' as any]: 2 }}>
            <button className="ws-tally-tile" onClick={() => scrollTo(readerRef)} title="Jump to the approve queue">
              <span className="ws-tally-no">01</span>
              <span className={`ws-tally-count ${queue.length ? '' : 'ws-tally-count--zero'}`} data-tally="approve">{queue.length}</span>
              <span className="ws-tally-label">Approve</span>
              <span className="ws-tally-sub">{queue[0] ? lmTitle(queue[0]) : 'queue clear'}</span>
            </button>
            <button className="ws-tally-tile" onClick={() => errorRows.length && scrollTo(errorStripRef)} title="Jump to errored lead magnets">
              <span className="ws-tally-no">02</span>
              <span className={`ws-tally-count ${errorRows.length ? 'ws-tally-count--red' : 'ws-tally-count--zero'}`} data-tally="attention">{errorRows.length}</span>
              <span className="ws-tally-label">Attention</span>
              <span className="ws-tally-sub">{errorRows.length ? `${errorRows.length} errored — retry` : 'all clear'}</span>
            </button>
          </div>

          <div className="ws-lanebar" style={{ marginBottom: '1.4rem' }}>
            <span className="ws-lane-pill" aria-selected="true">
              Approve queue
            </span>
            {offRosterCount > 0 && (
              <span className="ws-lane-pill" style={{ cursor: 'default' }}>
                Off-roster in review <span className="ws-lane-count">{offRosterCount}</span>
              </span>
            )}
            {clientReviewCount > 0 && (
              <span className="ws-clientnote" style={{ marginLeft: '0.4rem' }}>
                {clientReviewCount} client LM{clientReviewCount === 1 ? '' : 's'} in review · client boards own these
              </span>
            )}
          </div>

          {/* Attention strip: errored LMs with one-click retry (client-excluded). */}
          {errorRows.length > 0 && (
            <div className="ws-drawer" ref={errorStripRef}>
              <div className="ws-drawer-row" style={{ cursor: 'default', borderTop: 0 }}>
                <span className="ws-drawer-title" style={{ fontWeight: 700 }}>
                  {errorRows.length} lead magnet{errorRows.length === 1 ? '' : 's'} errored — retry generation
                </span>
              </div>
              {errorRows.slice(0, 30).map((d) => (
                <div key={d.id} className="ws-drawer-row" style={{ cursor: 'default' }}>
                  <button className="ws-drawer-title" style={{ background: 'transparent', border: 0, textAlign: 'left', cursor: 'pointer', flex: 1 }} onClick={() => setDetailId(d.id)}>
                    {lmTitle(d)}
                  </button>
                  <button className="ws-mini" onClick={() => retryLM(d)}>Retry</button>
                </div>
              ))}
            </div>
          )}

          {loading && drafts.length === 0 ? (
            <div className="ws-loading">Loading lead magnets…</div>
          ) : !current ? (
            /* Explicit empty state — the silent board-fallback is killed. */
            <div className="ws-empty">
              <div className="ws-empty-h">Approve queue clear</div>
              <div className="ws-empty-note">No lead magnets are in review. Nothing auto-switched. Open the Studio to compose or browse the library.</div>
              <div className="ws-empty-tally">{tally.approved} approved · {tally.rejected} rejected · {tally.skipped} skipped this session</div>
            </div>
          ) : (
            <div ref={readerRef} className="ws-reader" style={{ gridTemplateColumns: inspectOpen ? '218px minmax(0,1fr) minmax(300px,340px)' : '218px minmax(0,1fr)' }}>
              {/* Queue rail */}
              <aside className="ws-rail">
                {queue.map((d, i) => (
                  <button key={d.id} className={`ws-rail-row ${i === clamped ? 'ws-rail-row--cur' : ''}`} onClick={() => setCursor(i)}>
                    <div className="ws-rail-title">{lmTitle(d)}</div>
                    <div className="ws-rail-meta">{d.format || 'LM'} · {ageLabel(d.updatedAt)} old</div>
                  </button>
                ))}
              </aside>

              {/* Approve view — resource + cover + email all in one look */}
              <div className="ws-read-main" style={{ maxWidth: 'none' }}>
                <div key={current.id} className="review-advance">
                  <div className="ws-read-cap">
                    <b>In review</b>
                    <span>· {current.format || 'Lead magnet'}</span>
                    <span>· {ageLabel(current.updatedAt)} old</span>
                    <span className="ws-read-pos">{position} of {total}</span>
                    <button className="ws-inspect-toggle" style={{ marginLeft: '0.6rem' }} onClick={() => setInspectOpen((o) => !o)}>
                      {inspectOpen ? 'Hide inspect' : 'Inspect'}
                    </button>
                  </div>

                  <h2 className="ec-subhead" style={{ marginBottom: '1.2rem' }}>{lmTitle(current)}</h2>

                  <div className="ws-lm">
                    {/* Left: the actual resource page */}
                    <div className="ws-lm-col">
                      <div className="ws-lm-block">
                        <div className="ws-lm-lbl">The resource <small>what the prospect receives</small></div>
                        {current.resourceHtml ? (
                          <iframe className="ws-lm-frame" title="Resource preview" sandbox="allow-same-origin" srcDoc={current.resourceHtml} />
                        ) : current.resourceUrl ? (
                          <>
                            <iframe className="ws-lm-frame" title="Resource preview" sandbox="allow-same-origin allow-scripts" src={current.resourceUrl} />
                            <div className="ws-lm-resurl">{current.resourceUrl}</div>
                          </>
                        ) : (
                          <p className="ws-lm-missing">No resource page built yet. Approve &amp; build assets generates it.</p>
                        )}
                      </div>
                    </div>

                    {/* Right: cover + email + launch copy */}
                    <div className="ws-lm-col">
                      <div className="ws-lm-block">
                        <div className="ws-lm-lbl">Cover</div>
                        {cover ? (
                          <img className="ws-lm-cover" src={cover} alt="" loading="lazy" style={{ maxHeight: 320 }} />
                        ) : (
                          <p className="ws-lm-missing">No cover generated yet.</p>
                        )}
                      </div>
                      <div className="ws-lm-block">
                        <div className="ws-lm-lbl">Email copy</div>
                        {current.emailCopy ? (
                          <div className="ws-lm-email">{current.emailCopy}</div>
                        ) : (
                          <p className="ws-lm-missing">No email copy on this draft yet.</p>
                        )}
                      </div>
                      <div className="ws-lm-block">
                        <div className="ws-lm-lbl">Launch copy</div>
                        {editing ? (
                          <>
                            <textarea autoFocus className="ws-edit" rows={10} value={editText} onChange={(e) => setEditText(e.target.value)} />
                            <div className="ws-actions">
                              <button className="ws-key ws-key--primary" disabled={saving} onClick={saveEdit}>{saving ? 'Saving…' : 'Save'}</button>
                              <button className="ws-key" onClick={() => { setEditing(false); setEditText(current.postBody || ''); }}>Cancel <kbd>esc</kbd></button>
                            </div>
                          </>
                        ) : current.postBody ? (
                          <div className="ws-lm-launch">{current.postBody}</div>
                        ) : (
                          <p className="ws-lm-missing">No launch copy on this draft yet.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action bar */}
                  {!editing && (
                    <div className="ws-actions" style={{ marginTop: '1.4rem' }}>
                      <button className="ws-key ws-key--primary" disabled={busy} onClick={approveBuild}>
                        <kbd>a</kbd> {busy ? 'Building…' : 'Approve & build assets'}
                      </button>
                      <button className="ws-key" onClick={reject}><kbd>r</kbd> Reject</button>
                      <button className="ws-key" onClick={() => { setEditText(current.postBody || ''); setEditing(true); }}><kbd>e</kbd> Edit copy</button>
                      <button className="ws-key" onClick={skip}><kbd>s</kbd> Skip</button>
                      <button className="ws-key" onClick={() => setDetailId(current.id)}><kbd>o</kbd> Full editor</button>
                      <button className="ws-key" onClick={approveStatus} title="Set status to approved without firing the asset build">Approve status only</button>
                      <span className="ws-move-hint"><kbd>j</kbd>/<kbd>k</kbd> to move</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Native inspect rail — QA verdict + agent log, reused verbatim. */}
              {inspectOpen && (
                <aside className="ws-inspect">
                  <div className="ws-inspect-head">
                    <span className="ws-inspect-h">Backend depth</span>
                    <button className="ws-inspect-toggle" onClick={() => setInspectOpen(false)}>Hide</button>
                  </div>
                  <QAVerdictPanel entries={current.agentLog} />
                  <AgentLogFeed entries={current.agentLog} table="lm_drafts_v2" rowId={current.id} onNoteAdded={refresh} />
                </aside>
              )}
            </div>
          )}
        </>
      )}

      {/* Full editor slide-over (S-DETAIL) */}
      <Sheet
        open={!!detailDraft}
        onClose={() => setDetailId(null)}
        size="full"
        title={detailDraft ? <span className="truncate">{lmTitle(detailDraft)}</span> : ''}
      >
        {detailDraft && (
          <Suspense fallback={<div className="ws-loading" style={{ padding: '2rem' }}>Loading editor…</div>}>
            <LeadMagnetEditor draft={detailDraft} onClose={() => setDetailId(null)} onChanged={refresh} />
          </Suspense>
        )}
      </Sheet>
    </div>
  );
};

export default LmWorkSurface;
