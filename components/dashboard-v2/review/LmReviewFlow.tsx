import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw, Magnet } from 'lucide-react';
import { useLeadMagnets, type LeadMagnetDraft } from '../../../hooks/useLeadMagnets';
import { saveLMDraft } from '../../../lib/studioActions';
import { toastError } from '../../../lib/dashboardActions';
import { supabase } from '../../../lib/supabase';
import { driveThumbUrl, versionedAssetUrl } from '../../../lib/driveThumb';
import { ActionKey, ageLabel, REVIEW_FADE_CSS } from './reviewShared';

// Classic panel — rendered when the operator toggles out of Review mode.
const LeadMagnetStudioPanel = lazy(() => import('../../dashboard/LeadMagnetStudioPanel'));

/**
 * Lead Magnet Review flow — reading-first sibling of PostReviewFlow.
 *
 * DATA LAYER IS UNCHANGED. Reads come from useLeadMagnets() (the same hook the
 * LM Studio uses). Writes reuse the exact paths the panel already calls:
 *   - approve → lm_drafts_v2.update({ status: 'approved' }).eq('id')  (identical
 *                to LeadMagnetStudioPanel's onStatusChange inline write)
 *   - reject  → lm_drafts_v2.update({ status: 'disqualified' }).eq('id')
 *   - edit    → saveLMDraft({ id, post_body })                         (the exact
 *                LeadMagnetEditor Save)
 *   - skip    → local only
 *
 * BUG FIX carried from the audit: the LM Studio's format filter uses an
 * exact-case Set (`FORMATS_SET.has(fmt)`), which drops ~40% of rows whose stored
 * `format` differs only in casing. This review queue matches CASE-INSENSITIVELY.
 */

// Canonical LM formats — matched case-insensitively here (the fix).
const FORMATS = [
  'Checklist', 'Calculator', 'Interactive Assessment', 'Guide', 'AI Kit',
  'N8N Workflow', 'Stack Picker', 'Annotated Architecture', 'Live AI Walkthrough', 'Skill Pack',
];
const FORMATS_LC = new Set(FORMATS.map((f) => f.toLowerCase()));
const isLmFormat = (fmt: string | null | undefined) => FORMATS_LC.has((fmt || '').trim().toLowerCase());

const lmTitle = (d: LeadMagnetDraft): string =>
  d.topic || d.description || (d.format ? `${d.format}` : 'Lead magnet');

const LmReviewFlow: React.FC = () => {
  const { drafts, loading, refresh } = useLeadMagnets();

  const [mode, setMode] = useState<'review' | 'board'>('review');
  const modeDecidedRef = useRef(false);

  const [cursor, setCursor] = useState(0);
  const [acted, setActed] = useState<Set<string>>(() => new Set()); // UI-only hide after action/skip
  const [tally, setTally] = useState({ approved: 0, rejected: 0, skipped: 0 });
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);

  const queue = useMemo(
    () =>
      drafts
        .filter((d) => d.status === 'review' && isLmFormat(d.format) && !acted.has(d.id))
        .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()),
    [drafts, acted],
  );

  useEffect(() => {
    if (modeDecidedRef.current || loading) return;
    modeDecidedRef.current = true;
    if (queue.length === 0 && drafts.length > 0) setMode('board');
  }, [loading, queue.length, drafts.length]);

  const total = tally.approved + tally.rejected + tally.skipped + queue.length;
  const position = tally.approved + tally.rejected + tally.skipped + 1;
  const clampedCursor = Math.min(cursor, Math.max(0, queue.length - 1));
  const current: LeadMagnetDraft | null = queue[clampedCursor] || null;

  useEffect(() => {
    setEditing(false);
    setEditText(current?.postBody || '');
  }, [current?.id]);

  const advance = useCallback(() => {
    setCursor((c) => Math.max(0, Math.min(c, queue.length - 1)));
  }, [queue.length]);

  const approve = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    setActed((s) => new Set(s).add(id));
    setTally((t) => ({ ...t, approved: t.approved + 1 }));
    advance();
    try {
      const { error } = await supabase.from('lm_drafts_v2').update({ status: 'approved' }).eq('id', id);
      if (error) throw error;
      toast.success('Approved');
      await refresh();
    } catch (err) {
      toastError('approve', err);
      refresh();
    }
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
    } catch (err) {
      toastError('reject', err);
      refresh();
    }
  }, [current, advance, refresh]);

  const skip = useCallback(() => {
    if (!current) return;
    setActed((s) => new Set(s).add(current.id));
    setTally((t) => ({ ...t, skipped: t.skipped + 1 }));
    advance();
  }, [current, advance]);

  const saveEdit = useCallback(async () => {
    if (!current) return;
    const id = current.id;
    setSaving(true);
    try {
      await saveLMDraft({ id, post_body: editText });
      toast.success('Saved');
      setEditing(false);
      await refresh();
    } catch (err) {
      toastError('save lead magnet', err);
      refresh();
    } finally {
      setSaving(false);
    }
  }, [current, editText, refresh]);

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

  const cover = current ? driveThumbUrl(versionedAssetUrl(current.coverUrl, current.updatedAt), 800) : null;

  return (
    <div className="space-y-3">
      <style>{REVIEW_FADE_CSS}</style>

      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[var(--ds-bg)] ring-1 ring-[var(--ds-line)] flex items-center justify-center shrink-0">
          <Magnet className="w-3.5 h-3.5 text-[var(--ds-ok)]" />
        </div>
        <h2 className="dv-section-h flex items-center gap-2 mr-1">
          Lead Magnets
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
                {m === 'review' ? 'Review' : 'Studio'}
              </button>
            ))}
          </div>
          <button onClick={refresh} className="p-1.5 text-[var(--ds-dim)] hover:text-[var(--ds-ink)]" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {mode === 'board' ? (
        <Suspense fallback={<div className="py-8 text-[13px] text-[var(--ds-dim)]">Loading studio…</div>}>
          <LeadMagnetStudioPanel />
        </Suspense>
      ) : loading && drafts.length === 0 ? (
        <div className="rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] px-6 py-16 text-center">
          <div className="text-[13px] text-[var(--ds-dim)]">Loading lead magnets…</div>
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
                    {lmTitle(d)}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--ds-faint)]">
                    <span>{d.format || 'LM'}</span>
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
              <div className="flex items-center gap-2 pb-2 text-[12px] text-[var(--ds-dim)]">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="font-medium text-[var(--ds-ink)]">In review</span>
                <span className="text-[var(--ds-faint)]">·</span>
                <span>{current.format || 'Lead magnet'}</span>
                <span className="text-[var(--ds-faint)]">·</span>
                <span className="tabular-nums">{ageLabel(current.updatedAt)} old</span>
                <span className="md:hidden ml-auto tabular-nums text-[var(--ds-faint)]">{position} of {total}</span>
              </div>

              <div className="rounded-xl border border-[var(--ds-line)] bg-[var(--ds-card)] overflow-hidden">
                {cover && (
                  <img src={cover} alt="" loading="lazy" className="w-full object-cover bg-[var(--ds-bg)]" style={{ maxHeight: 320 }} />
                )}
                <div className="p-5 space-y-3">
                  <div className="text-[11px] uppercase tracking-wider text-[var(--ds-faint)]">{current.format || 'Lead magnet'}</div>
                  <h3 className="text-[19px] font-semibold leading-snug text-[var(--ds-ink)]">{lmTitle(current)}</h3>

                  {editing ? (
                    <div className="space-y-3 pt-1">
                      <div className="dv-field-label">Launch copy / body</div>
                      <textarea
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={14}
                        className="w-full rounded-lg bg-[var(--ds-bg)] border border-[var(--ds-line)] px-3 py-2.5 text-[15px] leading-relaxed text-[var(--ds-ink)] focus:outline-none focus:border-[var(--ds-accent)] focus:ring-1 focus:ring-[var(--ds-accent)]/30"
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
                  ) : current.postBody ? (
                    <p className="text-[15px] leading-[1.65] text-[var(--ds-ink)] whitespace-pre-wrap">{current.postBody}</p>
                  ) : (
                    <p className="text-[14px] text-[var(--ds-faint)] italic">No launch copy on this draft yet.</p>
                  )}
                </div>
              </div>

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

export default LmReviewFlow;
