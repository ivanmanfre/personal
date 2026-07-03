import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Search, ExternalLink, FileText, Save, X, Eye, Edit3, Filter, ChevronRight, RefreshCw } from 'lucide-react';
import { useContentPrompts, ContentPrompt } from '../../hooks/useContentPrompts';
import { Card, Button, Input, Textarea, FieldLabel } from '../ui/primitives';
import { toastError } from '../../lib/dashboardActions';
import { renderLightMarkdown } from '../../lib/lightMarkdown';
import { supabase } from '../../lib/supabase';
import { resolveDraft } from './promptDraftResolver';

/** Coarse "how long ago" for provenance display — not a full i18n date lib, just enough to read at a glance. */
function relTime(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/**
 * Prompt Library — dashboard-native editor for every system prompt in the
 * content engine. Reads/writes content_prompts directly via Supabase. No
 * ClickUp roundtrip.
 *
 * UI shape:
 *   left column  : searchable + filterable list of prompts (slug · title · size)
 *   right column : selected prompt's body in a tall textarea with Save/Preview toggle
 *
 * Saves auto-bump version and stamp updated_at. Realtime subscription means
 * a save in one tab shows up in another tab instantly.
 *
 * Category grouping is derived from slug prefix so the list reads cleanly
 * even at 60+ rows.
 */

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

const PromptLibraryPanel: React.FC = () => {
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

  const selected = useMemo(
    () => prompts.find((p) => p.id === selectedId) || null,
    [prompts, selectedId],
  );

  // Selection changes and realtime row updates share this effect but must be handled
  // differently: a *selection* change always seeds a fresh draft (discard-confirm already
  // happened at the row-click site); a row update on the SAME selection must go through
  // resolveDraft so a dirty draft is never silently overwritten. prevSelectedIdRef is the
  // guard that tells the two cases apart — deliberately not left to effect-dep ordering.
  const prevSelectedIdRef = React.useRef<string | null>(null);
  // updated_at of OUR last successful save. When that same timestamp arrives back via
  // applyRowPatch or the realtime refresh, it's our own write echoing — not an external
  // change — so the effect must not reseed (the draft may hold newer keystrokes typed
  // while the save was in flight) and must not flag it.
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
      // Selection change — always seed fresh, clear any stale conflict flag.
      setDraftBody(selected.body);
      setDraftTitle(selected.title);
      setDirty(false);
      setExternalUpdate(null);
      prevSelectedIdRef.current = selectedId;
      return;
    }
    // Same selection, row changed underneath us. Our own save echoing back is a no-op:
    // draft already holds the saved (or newer in-flight) text.
    if (selected.updatedAt === lastOwnSaveRef.current) return;
    // Genuinely external change (realtime from another writer).
    const next = resolveDraft({ body: draftBody, title: draftTitle, externalUpdate }, selected, dirty);
    setDraftBody(next.body);
    setDraftTitle(next.title);
    setExternalUpdate(next.externalUpdate);
    if (!next.externalUpdate) setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.updatedAt]);

  // Group + filter the list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prompts.filter((p) => {
      if (category !== 'all' && (p.category ?? categorize(p.slug)) !== category) return false;
      if (!q) return true;
      return p.slug.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q);
    });
  }, [prompts, query, category]);

  const grouped = useMemo(() => {
    const m = new Map<string, ContentPrompt[]>();
    for (const p of filtered) {
      const cat = p.category ?? categorize(p.slug);
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
    for (const p of prompts) s.add(p.category ?? categorize(p.slug));
    return Array.from(s);
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
        // Someone else's write landed first (CAS on version failed). Fetch the current
        // row and surface the banner instead of alerting — draft + dirty stay intact.
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
      // Record our own save's timestamp FIRST, then clear dirty, then patch local
      // state — all synchronous, before any realtime echo can hit the effect. The
      // effect ignores updates whose updatedAt matches lastOwnSaveRef, so keystrokes
      // typed while the save was in flight survive (no reseed, no false banner).
      // No explicit refresh(): the realtime listener already refetches on our write,
      // and applyRowPatch makes version/updated_at current for the next CAS save.
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

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="dv-section-h">Prompt library</h2>
          <p className="text-[12px] text-[color:var(--d-paper-dimmer)] mt-0.5">
            {prompts.length} prompts · canonical prompt store (content_prompts) read by live n8n runs.
            Version bumps on every write; rows show who wrote last.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md bg-zinc-900 border border-zinc-800 p-0.5">
            <button
              onClick={() => setSortBy('slug')}
              className={`px-2 py-0.5 text-[11px] rounded ${sortBy === 'slug' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Sort A-Z"
            >
              A-Z
            </button>
            <button
              onClick={() => setSortBy('updated')}
              className={`px-2 py-0.5 text-[11px] rounded ${sortBy === 'updated' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
              title="Sort by recently updated"
            >
              Recent
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-[12px] text-red-300 rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2">
          Failed to load: {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4 min-h-[60vh]">
        {/* LEFT — list */}
        <div className="space-y-2 min-w-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search slug / title / body…"
              className="pl-7"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`text-[10.5px] uppercase tracking-wider px-2 py-1 rounded-md transition-colors ${
                  category === c
                    ? 'bg-emerald-700/40 text-emerald-200 ring-1 ring-emerald-600/40'
                    : 'bg-zinc-900/60 text-zinc-400 ring-1 ring-zinc-800/60 hover:text-zinc-200'
                }`}
              >
                {c === 'all' ? 'All' : c}
                {c !== 'all' && (
                  <span className="ml-1 text-zinc-600">
                    {prompts.filter((p) => (p.category ?? categorize(p.slug)) === c).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="space-y-3 overflow-y-auto max-h-[calc(80vh-160px)] pr-1">
            {loading && <div className="text-[12px] text-zinc-500 italic flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>}
            {!loading && grouped.length === 0 && <div className="text-[12px] text-zinc-500 italic">No prompts match.</div>}
            {grouped.map(([cat, list]) => (
              <div key={cat}>
                <div className="text-[10px] uppercase tracking-wider text-emerald-400/70 font-semibold mb-1 px-1">{cat}</div>
                <ul className="space-y-0.5">
                  {list.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => {
                          if (dirty && !confirm('Discard unsaved changes?')) return;
                          setSelectedId(p.id);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-md transition-colors flex items-center gap-2 ${
                          selectedId === p.id
                            ? 'bg-emerald-700/30 ring-1 ring-emerald-600/40'
                            : 'hover:bg-zinc-900/60'
                        }`}
                      >
                        <FileText className="w-3 h-3 text-zinc-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] text-zinc-200 truncate">{p.title}</div>
                          <div className="text-[10px] text-zinc-500 font-mono truncate">{p.slug}</div>
                        </div>
                        <span className="text-[10px] text-zinc-600 tabular-nums shrink-0">{relTime(p.updatedAt)}</span>
                        <div className="text-[10px] text-zinc-600 tabular-nums shrink-0">
                          {(p.body.length / 1000).toFixed(1)}k
                        </div>
                        <ChevronRight className={`w-3 h-3 shrink-0 transition ${selectedId === p.id ? 'text-emerald-400' : 'text-zinc-700'}`} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — editor */}
        <div className="min-w-0">
          {!selected ? (
            <Card padded className="h-full flex items-center justify-center text-[12px] text-zinc-500 italic">
              Select a prompt from the list to edit.
            </Card>
          ) : (
            <Card padded className="space-y-3 h-full flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Input
                    value={draftTitle}
                    onChange={(e) => { setDraftTitle(e.target.value); setDirty(true); }}
                    className="text-[14px] font-semibold !py-1.5"
                  />
                  <div className="text-[10.5px] text-zinc-500 font-mono mt-1 flex items-center gap-3">
                    <span>{selected.slug}</span>
                    <span>·</span>
                    <span>v{selected.version}</span>
                    {selected.sourcePage && (
                      <>
                        <span>·</span>
                        <span title="Legacy ClickUp origin (no longer queried at runtime)">{selected.sourcePage}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{(draftBody.length / 1000).toFixed(1)}k chars</span>
                    <span>·</span>
                    <span title={selected.updatedAt}>
                      {relTime(selected.updatedAt)} by {selected.updatedBy ?? 'unknown'}
                    </span>
                    {dirty && <span className="text-amber-400">· unsaved</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="inline-flex rounded-md bg-zinc-900 border border-zinc-800 p-0.5">
                    <button
                      onClick={() => setMode('edit')}
                      className={`px-2 py-0.5 text-[11px] rounded inline-flex items-center gap-1 ${mode === 'edit' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    <button
                      onClick={() => setMode('preview')}
                      className={`px-2 py-0.5 text-[11px] rounded inline-flex items-center gap-1 ${mode === 'preview' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Eye className="w-3 h-3" /> Preview
                    </button>
                  </div>
                </div>
              </div>

              {externalUpdate && (
                <div className="text-[12px] rounded-md border border-[var(--d-rule-strong)] bg-[var(--d-warn-bg)] text-[var(--d-warn)] px-3 py-2 flex items-center gap-3">
                  <span>
                    Changed outside this editor ({externalUpdate.updatedBy ?? 'unknown'}, {new Date(externalUpdate.updatedAt).toLocaleTimeString()}).
                    Your unsaved draft is preserved.
                  </span>
                  <button
                    className="underline font-semibold"
                    onClick={() => { setDraftBody(selected.body); setDraftTitle(selected.title); setDirty(false); setExternalUpdate(null); }}
                  >
                    Take theirs
                  </button>
                  <button className="underline" onClick={() => setExternalUpdate(null)}>Keep mine</button>
                </div>
              )}

              {mode === 'edit' ? (
                <Textarea
                  value={draftBody}
                  onChange={(e) => { setDraftBody(e.target.value); setDirty(true); }}
                  className="font-mono text-[11.5px] leading-relaxed min-h-[60vh] flex-1"
                  spellCheck={false}
                />
              ) : (
                <div className="border border-zinc-800/60 bg-zinc-950/60 rounded-md p-3 overflow-y-auto min-h-[60vh] flex-1 max-h-[70vh]">
                  {renderLightMarkdown(draftBody || '_(empty)_', { editorial: true })}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-900/60">
                <a
                  href={selected.sourcePage?.startsWith('clickup:') ? `https://app.clickup.com/9013129303/v/dc/${selected.sourcePage.replace('clickup:','')}` : '#'}
                  target="_blank" rel="noreferrer"
                  className={`text-[10.5px] inline-flex items-center gap-1 ${
                    selected.sourcePage ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-700 pointer-events-none'
                  }`}
                  title="Legacy ClickUp origin (archive — not queried at runtime)"
                >
                  <ExternalLink className="w-3 h-3" /> legacy origin
                </a>
                <div className="flex items-center gap-2">
                  {dirty && (
                    <Button variant="ghost" size="sm" onClick={onRevert} disabled={busy}>
                      <X className="w-3.5 h-3.5" /> Revert
                    </Button>
                  )}
                  <Button variant={dirty ? 'primary' : 'secondary'} size="sm" onClick={onSave} disabled={!dirty || busy}>
                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    {dirty ? 'Save' : 'Saved'}
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptLibraryPanel;
