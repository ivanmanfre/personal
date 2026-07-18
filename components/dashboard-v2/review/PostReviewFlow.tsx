import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, FileText, Users } from 'lucide-react';
import { useContentLibrary, type CarouselDraft } from '../../../hooks/useContentLibrary';
import { setStatus, saveDraft } from '../../../lib/studioActions';
import { toastError } from '../../../lib/dashboardActions';
import { driveThumbUrl } from '../../../lib/driveThumb';
import { LinkedInPost, ActionKey, ageLabel, REVIEW_FADE_CSS } from './reviewShared';

// Classic board — rendered when the operator toggles out of Review mode.
const PostStudioPanel = lazy(() => import('../../dashboard/PostStudioPanel'));

/**
 * Post Review flow — the reading-first half of the round-3 revamp.
 *
 * DATA LAYER IS UNCHANGED. Reads come from useContentLibrary() (the same hook
 * PostStudioPanel uses). Writes reuse the exact functions the board already
 * calls:
 *   - approve  → setStatus(id, 'approved')          (studioActions, == the board's
 *                 inline `carousel_drafts.update({status}).eq('id')`)
 *   - reject   → setStatus(id, 'disqualified')       (same path the board's
 *                 disqualify bulk action uses)
 *   - edit     → saveDraft({ id, post_body })         (the exact CarouselEditor Save)
 *   - skip     → local only, no write
 *
 * Client-owned drafts (client_id != null) are EXCLUDED from the queue — a Studio
 * approve schedules to Ivan's own feed, so a client draft must never enter it.
 */

const typeKicker = (t: string | null): string =>
  t === 'carousel' ? 'Carousel' : t === 'single_image' ? 'Single image' : 'Text post';

const PostReviewFlow: React.FC = () => {
  const { drafts, loading, refresh, applyOptimistic } = useContentLibrary();

  // ── Mode: reading-first Review (default when drafts are pending) or classic Board.
  const [mode, setMode] = useState<'review' | 'board'>('review');
  const modeDecidedRef = useRef(false);

  // ── Session state.
  const [cursor, setCursor] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [tally, setTally] = useState({ approved: 0, rejected: 0, skipped: 0 });
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  // Ivan's own pending drafts — status 'review', not a client row, not an idea projection.
  const queue = useMemo(
    () =>
      drafts
        .filter((d) => d.status === 'review' && !d.clientId && !d.isIdea && !skipped.has(d.id))
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()),
    [drafts, skipped],
  );

  // Client drafts sitting in review — surfaced as a muted count, never actionable here.
  const clientReviewCount = useMemo(
    () => drafts.filter((d) => d.status === 'review' && !!d.clientId && !d.isIdea).length,
    [drafts],
  );

  // Decide the default view once, after the first load settles: Review if any
  // pending, else Board. Never fights the operator after they toggle.
  useEffect(() => {
    if (modeDecidedRef.current || loading) return;
    modeDecidedRef.current = true;
    if (queue.length === 0 && drafts.length > 0) setMode('board');
  }, [loading, queue.length, drafts.length]);

  const total = tally.approved + tally.rejected + tally.skipped + queue.length;
  const position = tally.approved + tally.rejected + tally.skipped + 1;
  const clampedCursor = Math.min(cursor, Math.max(0, queue.length - 1));
  const current: CarouselDraft | null = queue[clampedCursor] || null;

  // Reset edit buffer whenever the focused draft changes.
  useEffect(() => {
    setEditing(false);
    setEditText(current?.postBody || '');
  }, [current?.id]);

  const advance = useCallback(() => {
    // After an action the acted row leaves `queue`, so the same index now points
    // at the next item. Just clamp.
    setCursor((c) => Math.max(0, Math.min(c, queue.length - 2 < 0 ? 0 : queue.length - 1)));
  }, [queue.length]);

  const approve = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    applyOptimistic(id, { status: 'approved' });
    setTally((t) => ({ ...t, approved: t.approved + 1 }));
    advance();
    try {
      await setStatus(id, 'approved');
      toast.success('Approved');
    } catch (err) {
      toastError('approve', err);
      refresh();
    }
  }, [current, applyOptimistic, advance, refresh]);

  const reject = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    applyOptimistic(id, { status: 'disqualified' });
    setTally((t) => ({ ...t, rejected: t.rejected + 1 }));
    advance();
    try {
      await setStatus(id, 'disqualified');
      toast.success('Rejected');
    } catch (err) {
      toastError('reject', err);
      refresh();
    }
  }, [current, applyOptimistic, advance, refresh]);

  const skip = useCallback(() => {
    if (!current) return;
    setSkipped((s) => new Set(s).add(current.id));
    setTally((t) => ({ ...t, skipped: t.skipped + 1 }));
    advance();
  }, [current, advance]);

  const saveEdit = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    const next = editText;
    setSaving(true);
    applyOptimistic(id, { postBody: next });
    try {
      await saveDraft({ id, post_body: next });
      toast.success('Saved');
      setEditing(false);
    } catch (err) {
      toastError('save draft', err);
      refresh();
    } finally {
      setSaving(false);
    }
  }, [current, editText, applyOptimistic, refresh]);

  // ── Keyboard flow: j/k move, a approve, r reject, e edit, s skip. Disabled
  //    while editing or when focus is in a form field.
  useEffect(() => {
    if (mode !== 'review') return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const inField = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (editing) {
        if (e.key === 'Escape') { setEditing(false); setEditText(current?.postBody || ''); }
        return;
      }
      if (inField) return;
      switch (e.key) {
        case 'j': e.preventDefault(); setCursor((c) => Math.min(c + 1, queue.length - 1)); break;
        case 'k': e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); break;
        case 'a': e.preventDefault(); approve(); break;
        case 'r': e.preventDefault(); reject(); break;
        case 'e': e.preventDefault(); if (current) { setEditText(current.postBody || ''); setEditing(true); } break;
        case 's': e.preventDefault(); skip(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, editing, queue.length, current, approve, reject, skip]);

  // Single-image preview src (drive-aware). Carousels render a slide strip instead.
  const previewImage =
    current && current.type === 'single_image' && current.imageUrls?.[0]
      ? driveThumbUrl(current.imageUrls[0], 800) || current.imageUrls[0]
      : null;

  return (
    <div className="space-y-3">
      <style>{REVIEW_FADE_CSS}</style>

      {/* Header — title + count + mode toggle + refresh */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[var(--ds-bg)] ring-1 ring-[var(--ds-line)] flex items-center justify-center shrink-0">
          <FileText className="w-3.5 h-3.5 text-[var(--ds-accent)]" />
        </div>
        <h2 className="dv-section-h flex items-center gap-2 mr-1">
          Posts
          <span className="rounded-full bg-[var(--ds-bg)] border border-[var(--ds-line)] px-2 py-0.5 text-[12px] font-medium text-[var(--ds-dim)] tabular-nums leading-none">
            {queue.length} in review
          </span>
        </h2>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="inline-flex rounded-lg bg-[var(--ds-bg)] border border-[var(--ds-line)] p-0.5">
            {(['review', 'board'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 text-[12px] font-medium rounded-md transition-colors ${
                  mode === m ? 'bg-[var(--ds-card)] text-[var(--ds-ink)] shadow-sm' : 'text-[var(--ds-dim)] hover:text-[var(--ds-ink)]'
                }`}
              >
                {m === 'review' ? 'Review' : 'Board'}
              </button>
            ))}
          </div>
          <button onClick={refresh} className="p-1.5 text-[var(--ds-dim)] hover:text-[var(--ds-ink)]" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Muted client-drafts note */}
      {clientReviewCount > 0 && (
        <div className="flex items-center gap-1.5 text-[12px] text-[var(--ds-faint)]">
          <Users className="w-3.5 h-3.5" />
          {clientReviewCount} client draft{clientReviewCount === 1 ? '' : 's'} in review — client boards own these.
        </div>
      )}

      {mode === 'board' ? (
        <Suspense fallback={<div className="py-8 text-[13px] text-[var(--ds-dim)]">Loading board…</div>}>
          <PostStudioPanel />
        </Suspense>
      ) : loading && drafts.length === 0 ? (
        <div className="rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] px-6 py-16 text-center">
          <div className="text-[13px] text-[var(--ds-dim)]">Loading posts…</div>
        </div>
      ) : !current ? (
        <div className="rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] px-6 py-16 text-center">
          <div className="mx-auto w-11 h-11 rounded-full bg-[var(--ds-ok)]/10 border border-[var(--ds-ok)]/25 flex items-center justify-center mb-3 text-[var(--ds-ok)] text-lg">✓</div>
          <div className="text-[14px] text-[var(--ds-ink)] font-medium">Queue clear</div>
          <div className="text-[12px] text-[var(--ds-dim)] mt-1">
            {tally.approved} approved · {tally.rejected} rejected{tally.skipped ? ` · ${tally.skipped} skipped` : ''} this session.
          </div>
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          {/* Queue rail */}
          <aside className="w-[240px] shrink-0 hidden md:block">
            <div className="flex items-center justify-between px-1 pb-2 text-[11px] uppercase tracking-wider text-[var(--ds-faint)]">
              <span>Queue</span>
              <span className="tabular-nums">{position} of {total}</span>
            </div>
            <div className="rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] overflow-hidden divide-y divide-[var(--ds-line)] max-h-[70vh] overflow-y-auto">
              {queue.map((d, i) => (
                <button
                  key={d.id}
                  onClick={() => setCursor(i)}
                  className={`w-full text-left px-3 py-2.5 transition-colors ${
                    i === clampedCursor ? 'bg-[var(--d-accent-bg)]' : 'hover:bg-[var(--ds-bg)]'
                  }`}
                  style={i === clampedCursor ? { boxShadow: 'inset 2px 0 0 var(--ds-accent)' } : undefined}
                >
                  <div className={`text-[12.5px] leading-snug line-clamp-2 ${i === clampedCursor ? 'text-[var(--ds-ink)] font-medium' : 'text-[var(--ds-dim)]'}`}>
                    {d.title || d.topic || '(untitled)'}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--ds-faint)]">
                    <span>{typeKicker(d.type)}</span>
                    <span>·</span>
                    <span className="tabular-nums">{ageLabel(d.updatedAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Reading pane */}
          <div className="flex-1 min-w-0">
            <div key={current.id} className="review-advance" style={{ maxWidth: 620 }}>
              {/* functional label line */}
              <div className="flex items-center gap-2 pb-2 text-[12px] text-[var(--ds-dim)]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="font-medium text-[var(--ds-ink)]">In review</span>
                <span className="text-[var(--ds-faint)]">·</span>
                <span>{typeKicker(current.type)}</span>
                <span className="text-[var(--ds-faint)]">·</span>
                <span className="tabular-nums">{ageLabel(current.updatedAt)} old</span>
                <span className="md:hidden ml-auto tabular-nums text-[var(--ds-faint)]">{position} of {total}</span>
              </div>

              {editing ? (
                <div className="rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] p-3 space-y-3">
                  <div className="dv-field-label">Post body</div>
                  <textarea
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={16}
                    className="w-full rounded-lg bg-[var(--ds-bg)] border border-[var(--ds-line)] px-3 py-2.5 text-[15px] leading-relaxed text-[var(--ds-ink)] focus:outline-none focus:border-[var(--ds-accent)] focus:ring-1 focus:ring-[var(--ds-accent)]/30"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="rounded-lg bg-[var(--ds-accent)] hover:bg-[var(--ds-accent-hover)] disabled:opacity-50 px-3.5 py-2 text-[13px] font-medium text-white"
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditing(false); setEditText(current.postBody || ''); }}
                      className="rounded-lg border border-[var(--ds-line)] bg-[var(--ds-card)] hover:bg-[var(--ds-bg)] px-3.5 py-2 text-[13px] text-[var(--ds-dim)]"
                    >
                      Cancel <span className="opacity-60">(esc)</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <LinkedInPost text={current.postBody || ''} image={previewImage} />
                  {/* Carousel slides */}
                  {current.type === 'carousel' && current.imageUrls && current.imageUrls.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                      {current.imageUrls.map((u, i) => (
                        <img
                          key={i}
                          src={driveThumbUrl(u, 400) || u}
                          alt=""
                          loading="lazy"
                          className="h-40 w-40 shrink-0 rounded-lg border border-[var(--ds-line)] object-cover bg-[var(--ds-bg)]"
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Action bar — buttons mirror the keys */}
              {!editing && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <ActionKey k="a" label="Approve" tone="approve" onClick={approve} />
                  <ActionKey k="r" label="Reject" tone="reject" onClick={reject} />
                  <ActionKey k="e" label="Edit" onClick={() => { setEditText(current.postBody || ''); setEditing(true); }} />
                  <ActionKey k="s" label="Skip" onClick={skip} />
                  <span className="ml-auto text-[11px] text-[var(--ds-faint)] hidden sm:inline">
                    <kbd className="font-mono">j</kbd>/<kbd className="font-mono">k</kbd> to move
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostReviewFlow;
