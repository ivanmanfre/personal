import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Search, RefreshCw, Loader2, History, Edit3, Eye, ExternalLink, X, Save, RotateCcw } from 'lucide-react';
import { useContentPrompts, ContentPrompt } from '../../../../hooks/useContentPrompts';
import { usePromptVersions, PromptVersion } from '../../../../hooks/usePromptVersions';
import { renderLightMarkdown } from '../../../../lib/lightMarkdown';
import { lineDiff, diffStats } from '../../../../lib/lineDiff';
import { supabase } from '../../../../lib/supabase';
import { toastError } from '../../../../lib/dashboardActions';
import { resolveDraft } from '../../../dashboard/promptDraftResolver';
import '../../editorial-cockpit.css';
import './prompts/prompts.css';

/**
 * Prompts — the canon register (Black Box v4 rebuild).
 *
 * The section is dressed as a regulatory constitution: the ~105 canonical rows
 * of content_prompts (the authoritative prompt store every live n8n run reads)
 * presented as a numbered category index, a selected prompt rendered as a
 * VERSIONED DOCUMENT (slug + v{N} + updated_by attribution as a document
 * header), edit / preview as document modes, and the revision history folded
 * INTO the light page as an appendix column carrying the version list + a BB
 * line diff. No dark drawer.
 *
 * Every write path is reused verbatim from the v1 PromptLibraryPanel: the CAS
 * save (useContentPrompts.savePrompt — compare-and-swap on version), the
 * lastOwnSaveRef / prevSelectedIdRef realtime echo-suppression effect, the
 * external-update conflict flow, the dirty-discard guard, and the beforeunload
 * warning. Only the presentation changed.
 */

/** Coarse "how long ago" for provenance display. */
function relTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

function categorize(slug: string): string {
  if (slug.startsWith('style-')) return 'Carousel layouts';
  if (slug.startsWith('image-style-')) return 'Single-image styles';
  if (slug.startsWith('carousel-')) return 'Carousel pipeline';
  if (slug.startsWith('lm-') || slug === 'build-assessment') return 'Lead magnets';
  if (slug.startsWith('outreach') || slug.includes('comment-') || slug === 'connection-note-templates' || slug === 'icp-outreach-scoring' || slug === 'icp-filter-criteria' || slug === 'anti-ai-patterns-outreach-playbook' || slug === 'self-comment-templates' || slug === 'trigger-research-synthesis-prompt' || slug === 'linkedin-comment-drafter') return 'Outreach';
  if (slug.startsWith('upwork')) return 'Upwork / sales';
  if (slug.startsWith('topic-') || slug === 'topic-suggestion-generation') return 'Topic / curation';
  if (slug.includes('infographic')) return 'Infographic';
  if (slug.includes('newsletter')) return 'Newsletter';
  if (slug === 'editorial' || slug === 'editorial-lm') return 'Editorial';
  if (slug === 'hook' || slug === 'post-generation' || slug === 'content-briefing' || slug === 'qa' || slug === 'qa-banned-patterns' || slug === 'ig-caption') return 'Post pipeline';
  if (slug === 'author-voice' || slug === 'forbidden-language' || slug === 'brand-positioning' || slug === 'brand-visual') return 'Brand & voice';
  if (slug.includes('clip') || slug.includes('signal-clusters') || slug === 'kyle-call-intelligence-extractor' || slug === 'weekly-output-audit-panel-prompts' || slug.includes('stat-card-spec') || slug.includes('before-after-spec')) return 'Analytics & misc';
  if (slug === 'blueprint-generator-system-prompt') return 'Sales / proposals';
  return 'Other';
}

/** Display-level-only normalization so DB category dupes (OUTREACH vs Outreach,
 * LEAD MAGNETS vs LEAD_MAGNETS) merge into one chip/bucket. Never written back —
 * the underlying content_prompts.category value is untouched. */
function normalizeCategoryLabel(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/** The merged category bucket a row displays under. */
function effectiveCategory(p: ContentPrompt): string {
  return normalizeCategoryLabel(p.category ?? categorize(p.slug));
}

// ── Discard-confirm dialog (BB paper card; replaces the v1 ConfirmDialog so
//    the whole surface stays radius-0 / no-shadow). ──────────────────────────
function DiscardConfirm({ open, onConfirm, onCancel }: { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="pr-confirm-scrim" onClick={onCancel} role="dialog" aria-modal="true" aria-label="Discard unsaved changes">
      <div className="pr-confirm" onClick={(e) => e.stopPropagation()}>
        <div className="pr-confirm-head">Discard unsaved changes</div>
        <div className="pr-confirm-body">This prompt has edits that have not been saved. Switching to another prompt will discard them.</div>
        <div className="pr-confirm-acts">
          <button className="ec-btn" onClick={onCancel}>Keep editing</button>
          <button className="ec-btn ec-btn--primary" autoFocus onClick={onConfirm}>Discard</button>
        </div>
      </div>
    </div>
  );
}

// ── Revision history appendix — folded into the light page (no dark drawer).
//    Reuses usePromptVersions + lineDiff + diffStats verbatim. ───────────────
function RevisionHistory({ slug, onClose, onRestore }: {
  slug: string | null;
  onClose: () => void;
  onRestore: (body: string, title: string) => void;
}) {
  const { versions, loading } = usePromptVersions(slug);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  React.useEffect(() => {
    if (versions.length) setSelectedVersion((v) => (v && versions.some((x) => x.version === v) ? v : versions[0].version));
    else setSelectedVersion(null);
  }, [versions]);

  const selected = versions.find((v) => v.version === selectedVersion) || null;
  const prev = useMemo<PromptVersion | null>(() => {
    if (!selected) return null;
    return versions.filter((v) => v.version < selected.version).sort((a, b) => b.version - a.version)[0] || null;
  }, [versions, selected]);
  const ops = useMemo(() => (selected ? lineDiff(prev?.body ?? '', selected.body ?? '') : []), [selected, prev]);
  const stats = useMemo(() => diffStats(ops), [ops]);

  return (
    <div className="pr-hist">
      <div className="pr-hist-head">
        <span className="pr-hist-h">Revision history</span>
        <button className="pr-hist-close" onClick={onClose} aria-label="Close history"><X className="w-3 h-3" /> Close</button>
      </div>

      {loading ? (
        <div className="pr-loading"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading content_prompt_versions…</div>
      ) : versions.length === 0 ? (
        <div className="pr-hist-empty">No prior versions recorded. New saves are snapshotted from now on.</div>
      ) : (
        <>
          <div className="pr-hist-list">
            {versions.map((v) => (
              <button
                key={v.version}
                className={`pr-ver ${v.version === selectedVersion ? 'pr-ver--cur' : ''}`}
                onClick={() => setSelectedVersion(v.version)}
                title={`by ${v.updatedBy ?? 'unknown'} · ${relTime(v.changedAt)}`}
              >
                <div className="pr-ver-n">v{v.version}</div>
                <div className="pr-ver-meta">{relTime(v.changedAt)}</div>
              </button>
            ))}
          </div>

          {selected && (
            <>
              <div className="pr-diff-cap">
                {prev
                  ? <span>Changes from <b>v{prev.version}</b> to <b>v{selected.version}</b></span>
                  : <span>Initial version <b>v{selected.version}</b></span>}
                <span className="pr-diff-stat-add">+{stats.added}</span>
                <span className="pr-diff-stat-del">−{stats.removed}</span>
                <button
                  className="pr-hist-restore"
                  onClick={() => onRestore(selected.body ?? '', selected.title ?? '')}
                  title="Load this version's body into the editor as an unsaved draft"
                >
                  <RotateCcw className="w-3 h-3" /> Load into editor
                </button>
              </div>
              <div className="pr-diff">
                {ops.map((op, i) => (
                  <div key={i} className={`pr-diff-line pr-diff-line--${op.type}`}>
                    <span className="pr-diff-gutter">{op.type === 'add' ? '+' : op.type === 'del' ? '−' : ' '}</span>
                    <span className="pr-diff-txt">{op.text || ' '}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

const PromptsRebuilt: React.FC = () => {
  const { prompts, loading, error, savePrompt, refresh, applyRowPatch } = useContentPrompts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'slug' | 'updated'>('slug');

  // local edit state — initialized from selected prompt, mutated by textarea
  const [draftBody, setDraftBody] = useState<string>('');
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [busy, setBusy] = useState(false);
  const [externalUpdate, setExternalUpdate] = useState<null | { updatedAt: string; updatedBy: string | null }>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<null | { nextId: string }>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const selected = useMemo(() => prompts.find((p) => p.id === selectedId) || null, [prompts, selectedId]);

  // Selection changes and realtime row updates share this effect but must be handled
  // differently: a *selection* change always seeds a fresh draft (discard-confirm already
  // happened at the row-click site); a row update on the SAME selection must go through
  // resolveDraft so a dirty draft is never silently overwritten. prevSelectedIdRef is the
  // guard that tells the two cases apart — deliberately not left to effect-dep ordering.
  const prevSelectedIdRef = React.useRef<string | null>(null);
  // updated_at of OUR last successful save. When that same timestamp arrives back via
  // applyRowPatch or the realtime refresh, it's our own write echoing — not an external
  // change — so the effect must not reseed and must not flag it.
  const lastOwnSaveRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!selected) {
      setDraftBody('');
      setDraftTitle('');
      setDirty(false);
      setExternalUpdate(null);
      prevSelectedIdRef.current = selectedId;
      return;
    }
    if (prevSelectedIdRef.current !== selectedId) {
      setDraftBody(selected.body);
      setDraftTitle(selected.title);
      setDirty(false);
      setExternalUpdate(null);
      prevSelectedIdRef.current = selectedId;
      return;
    }
    if (selected.updatedAt === lastOwnSaveRef.current) return;
    const next = resolveDraft({ body: draftBody, title: draftTitle, externalUpdate }, selected, dirty);
    setDraftBody(next.body);
    setDraftTitle(next.title);
    setExternalUpdate(next.externalUpdate);
    if (!next.externalUpdate) setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.updatedAt]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (category !== 'all' && effectiveCategory(p) !== category) return false;
      if (!q) return true;
      return p.slug.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q);
    });
  }, [prompts, query, category]);

  const grouped = useMemo(() => {
    const m = new Map<string, ContentPrompt[]>();
    for (const p of filtered) {
      const cat = effectiveCategory(p);
      if (!m.has(cat)) m.set(cat, []);
      m.get(cat)!.push(p);
    }
    const entries = Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    if (sortBy === 'updated') {
      for (const [, list] of entries) list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return entries;
  }, [filtered, sortBy]);

  const categories = useMemo(() => {
    const s = new Set<string>(['all']);
    for (const p of prompts) s.add(effectiveCategory(p));
    return Array.from(s);
  }, [prompts]);

  // Census figures (read-only, derived).
  const catCount = categories.length - 1;
  const lastEdited = useMemo(() => {
    if (!prompts.length) return null;
    return prompts.reduce((a, b) => (a.updatedAt >= b.updatedAt ? a : b));
  }, [prompts]);

  const onSave = async () => {
    if (!selected) return;
    if (!dirty) return;
    setBusy(true);
    try {
      const patch: any = {};
      if (draftBody !== selected.body) patch.body = draftBody;
      if (draftTitle !== selected.title) patch.title = draftTitle;
      const result = await savePrompt(selected.id, patch, selected.version);
      if (!result.ok) {
        // CAS on version failed — someone else's write landed first. Fetch the current
        // row and surface the conflict banner; draft + dirty stay intact.
        const { data } = await supabase
          .from('content_prompts')
          .select('updated_at, updated_by')
          .eq('id', selected.id)
          .single();
        setExternalUpdate({
          updatedAt: data?.updated_at ?? new Date().toISOString(),
          updatedBy: data?.updated_by ?? null,
        });
        return;
      }
      lastOwnSaveRef.current = result.row.updatedAt;
      setDirty(false);
      applyRowPatch(result.row.id, {
        version: result.row.version,
        updated_at: result.row.updatedAt,
        updated_by: result.row.updatedBy,
      });
      toast.success('Saved');
    } catch (e: any) {
      toastError('save prompt', e);
    } finally {
      setBusy(false);
    }
  };

  const onRevert = () => {
    if (!selected) return;
    setDraftBody(selected.body);
    setDraftTitle(selected.title);
    setDirty(false);
  };

  // Warn on tab close / navigation if dirty
  React.useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // Title is a wrapping auto-grow textarea (not a single-line input) so a long
  // title wraps to full words under a squeezed doc column instead of clipping.
  // Enter is blocked below — titles stay single logical line, they just wrap visually.
  // Re-measured on text/selection change AND on anything that can resize the doc
  // column without changing the text itself: opening/closing history (the grid
  // gains/loses a track) and plain window resize.
  const titleRef = React.useRef<HTMLTextAreaElement>(null);
  const autosizeTitle = React.useCallback(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  React.useEffect(() => { autosizeTitle(); }, [draftTitle, selectedId, historyOpen, autosizeTitle]);
  React.useEffect(() => {
    window.addEventListener('resize', autosizeTitle);
    return () => window.removeEventListener('resize', autosizeTitle);
  }, [autosizeTitle]);

  const now = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();

  const legacyHref = selected?.sourcePage?.startsWith('clickup:')
    ? `https://app.clickup.com/9013129303/v/dc/${selected.sourcePage.replace('clickup:', '')}`
    : '#';

  return (
    <div className="ec">
      <div className="ec-topline">
        <span className="ec-topline-brand">Prompts</span>
        <span className="ec-topline-meta">{now} · canonical · content_prompts · realtime</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
        <h1 className="ec-hed ec-hed--today" style={{ fontSize: 'clamp(40px,4.4vw,60px)', margin: 0 }}>Prompts</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <div className="pr-modeseg">
            <button className={`pr-modeseg-btn ${sortBy === 'slug' ? 'pr-modeseg-btn--on' : ''}`} onClick={() => setSortBy('slug')} title="Sort A to Z">A-Z</button>
            <button className={`pr-modeseg-btn ${sortBy === 'updated' ? 'pr-modeseg-btn--on' : ''}`} onClick={() => setSortBy('updated')} title="Sort by most recently updated">Recent</button>
          </div>
          <button className="pr-tool" onClick={refresh} disabled={loading} title="Refresh from content_prompts">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        </div>
      </div>

      <p className="pr-dek">
        The canonical prompt store every live n8n run reads. Compare-and-swap versioned: each save bumps the version and stamps who wrote last, and an external write while you edit surfaces a conflict instead of overwriting your draft.
      </p>

      {/* Census masthead — read-only figures. */}
      <div className="pr-census">
        <div className="pr-census-item">
          <span className={`pr-census-num ${loading && !prompts.length ? 'pr-census-num--muted' : ''}`}>{prompts.length || '·'}</span>
          <span className="pr-census-lbl">Canonical prompts</span>
        </div>
        <div className="pr-census-item">
          <span className="pr-census-num">{catCount || '·'}</span>
          <span className="pr-census-lbl">Categories</span>
        </div>
        <div className="pr-census-item">
          <span className="pr-census-num pr-census-num--muted" style={{ fontSize: 13 }}>
            {lastEdited ? `${relTime(lastEdited.updatedAt)}` : '—'}
          </span>
          <span className="pr-census-lbl">Last edit{lastEdited?.updatedBy ? ` · ${lastEdited.updatedBy}` : ''}</span>
        </div>
      </div>

      {error && (
        <div className="pr-errbox">
          <div className="pr-errbox-head">Warning: prompt store did not load</div>
          <div className="pr-errbox-note">{error}</div>
        </div>
      )}

      {/* Filter bar — search + category index pills. */}
      <div className="pr-filters">
        <div className="pr-search">
          <Search className="pr-search-ico w-3.5 h-3.5" />
          <input
            className="pr-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search slug / title / body…"
          />
        </div>
        <div className="pr-pills">
          {categories.map((c) => (
            <button key={c} className={`pr-pill ${category === c ? 'pr-pill--on' : ''}`} onClick={() => setCategory(c)}>
              {c === 'all' ? 'All' : c}
              {c !== 'all' && (
                <span className="pr-pill-count">{prompts.filter((p) => effectiveCategory(p) === c).length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={`pr-reader ${historyOpen && selected ? 'pr-reader--hist' : ''}`}>
        {/* LEFT — numbered category index (table of contents) */}
        <div className="pr-index">
          {loading && !prompts.length && <div className="pr-loading"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>}
          {!loading && grouped.length === 0 && <div className="pr-none">No prompts match.</div>}
          {grouped.map(([cat, list], gi) => (
            <div className="pr-index-group" key={cat}>
              <div className="pr-index-cap">
                <span className="pr-index-num">{String(gi + 1).padStart(2, '0')}</span>
                <span className="pr-index-name">{cat}</span>
                <span className="pr-index-count">{list.length}</span>
              </div>
              {list.map((p) => (
                <button
                  key={p.id}
                  className={`pr-row ${selectedId === p.id ? 'pr-row--cur' : ''}`}
                  onClick={() => {
                    if (dirty) { setConfirmDiscard({ nextId: p.id }); return; }
                    setSelectedId(p.id);
                  }}
                >
                  <div className="pr-row-title">{p.title}</div>
                  <div className="pr-row-sub">
                    <span className="pr-row-slug">{p.slug}</span>
                    <span className="pr-row-size">{(p.body.length / 1000).toFixed(1)}k</span>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* MIDDLE — the versioned document */}
        <div className="pr-doc">
          {!selected ? (
            <div className="pr-doc-empty">Select a prompt from the index to open its document.</div>
          ) : (
            <>
              <div className="pr-doc-head">
                <div className="pr-doc-headmain">
                  <textarea
                    ref={titleRef}
                    className="pr-doc-title"
                    value={draftTitle}
                    rows={1}
                    onChange={(e) => { setDraftTitle(e.target.value); setDirty(true); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                    aria-label="Prompt title"
                  />
                  <div className="pr-doc-meta">
                    <span className="pr-meta-tok"><span className="pr-slug">{selected.slug}</span></span>
                    <span className="pr-meta-tok"><span className="pr-sep">·</span><span className="pr-ver-badge">v{selected.version}</span></span>
                    <span className="pr-meta-tok pr-meta-optional"><span className="pr-sep">·</span><span>{(draftBody.length / 1000).toFixed(1)}k chars</span></span>
                    <span className="pr-meta-tok" title={selected.updatedAt}>
                      <span className="pr-sep">·</span>
                      <span>{relTime(selected.updatedAt)}</span>
                      <span className="pr-meta-by"> by {selected.updatedBy ?? 'unknown'}</span>
                    </span>
                    {selected.sourcePage && (
                      <span className="pr-meta-tok pr-meta-optional" title="Legacy ClickUp origin (no longer queried at runtime)">
                        <span className="pr-sep">·</span>
                        <span>{selected.sourcePage}</span>
                      </span>
                    )}
                    {dirty && <span className="pr-meta-tok pr-dirty">Unsaved</span>}
                  </div>
                </div>
                <div className="pr-doc-tools">
                  <button className={`pr-tool ${historyOpen ? 'pr-tool--on' : ''}`} onClick={() => setHistoryOpen((v) => !v)} title="Version history and diff">
                    <History className="w-3 h-3" /> History
                  </button>
                  <div className="pr-modeseg">
                    <button className={`pr-modeseg-btn ${mode === 'edit' ? 'pr-modeseg-btn--on' : ''}`} onClick={() => setMode('edit')}><Edit3 className="w-3 h-3" /> Edit</button>
                    <button className={`pr-modeseg-btn ${mode === 'preview' ? 'pr-modeseg-btn--on' : ''}`} onClick={() => setMode('preview')}><Eye className="w-3 h-3" /> Preview</button>
                  </div>
                </div>
              </div>

              {externalUpdate && (
                <div className="pr-conflict">
                  <div className="pr-conflict-head">Warning: changed outside this editor</div>
                  <div className="pr-conflict-body">
                    A newer write landed ({externalUpdate.updatedBy ?? 'unknown'}, {new Date(externalUpdate.updatedAt).toLocaleTimeString()}). Your unsaved draft is preserved. Take theirs to load the current row, or keep mine to save over it as a new version.
                  </div>
                  <div className="pr-conflict-acts">
                    <button
                      className="ec-btn ec-btn--primary"
                      onClick={() => { setDraftBody(selected.body); setDraftTitle(selected.title); setDirty(false); setExternalUpdate(null); }}
                    >
                      Take theirs
                    </button>
                    <button className="ec-btn" onClick={() => setExternalUpdate(null)}>Keep mine</button>
                  </div>
                </div>
              )}

              {mode === 'edit' ? (
                <textarea
                  className="pr-body-edit"
                  value={draftBody}
                  onChange={(e) => { setDraftBody(e.target.value); setDirty(true); }}
                  spellCheck={false}
                />
              ) : (
                <div className="pr-body-preview">
                  {renderLightMarkdown(draftBody || '_(empty)_', { editorial: true })}
                </div>
              )}

              <div className="pr-doc-foot">
                <a
                  href={legacyHref}
                  target="_blank" rel="noreferrer"
                  className={`pr-legacy ${selected.sourcePage ? 'pr-legacy--live' : 'pr-legacy--inert'}`}
                  title="Legacy ClickUp origin (archive — not queried at runtime)"
                >
                  <ExternalLink className="w-3 h-3" /> legacy origin
                </a>
                <div className="pr-foot-acts">
                  {dirty && <button className="ec-btn" onClick={onRevert} disabled={busy}><X className="w-3.5 h-3.5" /> Revert</button>}
                  <button className="ec-btn ec-btn--primary" onClick={onSave} disabled={!dirty || busy}>
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {dirty ? 'Save' : 'Saved'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* RIGHT — revision history appendix (folded in, light register) */}
        {historyOpen && selected && (
          <RevisionHistory
            slug={selected.slug}
            onClose={() => setHistoryOpen(false)}
            onRestore={(body, title) => {
              setDraftBody(body);
              setDraftTitle(title);
              setDirty(true);
              toast.success('Loaded into editor — Save to apply as a new version');
            }}
          />
        )}
      </div>

      <DiscardConfirm
        open={!!confirmDiscard}
        onConfirm={() => { if (confirmDiscard) setSelectedId(confirmDiscard.nextId); setConfirmDiscard(null); }}
        onCancel={() => setConfirmDiscard(null)}
      />
    </div>
  );
};

export default PromptsRebuilt;
