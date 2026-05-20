// PromptsPanel — read + edit ClickUp Prompts Library pages from the dashboard.
// Data flow: usePromptPages hook → clickup-pages edge function → ClickUp v3 API.
// Editor is intentionally a monospace textarea (no markdown lib added) to keep
// the bundle slim; package.json doesn't ship one and the spec says don't add
// dependencies.

import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Search, Save, Undo2, RefreshCw, ExternalLink, Tag as TagIcon, Loader2 } from 'lucide-react';
import PanelCard from './shared/PanelCard';
import EmptyState from './shared/EmptyState';
import LoadingSkeleton from './shared/LoadingSkeleton';
import { timeAgo } from './shared/utils';
import {
  usePromptPages,
  PROMPTS_WORKSPACE_ID,
  PROMPTS_DOC_ID,
  type PromptTag,
} from '../../hooks/usePromptPages';

const TAG_ORDER: PromptTag[] = ['Hook', 'Voice', 'Forbidden', 'Topic', 'Strategy', 'QA', 'Video', 'Generation', 'Other'];

const TAG_CLASS: Record<PromptTag, string> = {
  Hook: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Voice: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Forbidden: 'bg-red-500/10 text-red-400 border-red-500/20',
  Topic: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Strategy: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  QA: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Video: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  Generation: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Other: 'bg-zinc-700/30 text-zinc-400 border-zinc-700/40',
};

type SortMode = 'recent' | 'name' | 'size';

const PromptsPanel: React.FC = () => {
  const {
    pages,
    loading,
    error,
    selectedId,
    detail,
    detailLoading,
    saving,
    refresh,
    selectPage,
    savePage,
  } = usePromptPages();

  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<Set<PromptTag>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [draftContent, setDraftContent] = useState('');
  const [draftName, setDraftName] = useState('');

  // Reset the editor whenever a new page detail loads.
  useEffect(() => {
    if (detail) {
      setDraftContent(detail.content);
      setDraftName(detail.name);
    } else {
      setDraftContent('');
      setDraftName('');
    }
  }, [detail?.id, detail?.content, detail?.name]);

  const tagCounts = useMemo(() => {
    const counts = new Map<PromptTag, number>();
    for (const p of pages) counts.set(p.tag, (counts.get(p.tag) || 0) + 1);
    return counts;
  }, [pages]);

  const filteredPages = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = pages.filter((p) => {
      if (term && !p.name.toLowerCase().includes(term)) return false;
      if (activeTags.size > 0 && !activeTags.has(p.tag)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name);
      if (sortMode === 'size') return (b.charCount || 0) - (a.charCount || 0);
      return (b.dateUpdated || 0) - (a.dateUpdated || 0);
    });
    return list;
  }, [pages, search, activeTags, sortMode]);

  function toggleTag(tag: PromptTag) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }

  const dirty = !!detail && (draftContent !== detail.content || draftName !== detail.name);

  async function onSave() {
    if (!detail || !dirty) return;
    await savePage(detail.id, draftContent, draftName !== detail.name ? draftName : undefined);
  }

  function onDiscard() {
    if (!detail) return;
    setDraftContent(detail.content);
    setDraftName(detail.name);
  }

  const clickupPageUrl = detail
    ? `https://app.clickup.com/${PROMPTS_WORKSPACE_ID}/v/dc/${PROMPTS_DOC_ID.split('-')[0]}/${PROMPTS_DOC_ID}/${detail.id}`
    : `https://app.clickup.com/${PROMPTS_WORKSPACE_ID}/v/dc/${PROMPTS_DOC_ID}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Prompts Library</h1>
          <p className="text-xs text-zinc-500 mt-1">
            Read + edit ClickUp Doc <span className="font-mono text-zinc-400">{PROMPTS_DOC_ID}</span> in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={clickupPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-800/60 hover:border-zinc-700/60 transition-colors"
          >
            Open in ClickUp <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-zinc-200 border border-zinc-800/60 hover:border-zinc-700/60 transition-colors"
            title="Refresh page list"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-4">
        {/* List column */}
        <PanelCard title="Pages" icon={<FileText className="w-4 h-4" />} badge={pages.length || undefined} accent="emerald">
          <div className="p-3 space-y-3 border-b border-zinc-800/40">
            <label className="relative block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search pages…"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-zinc-950/60 border border-zinc-800/60 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
              />
            </label>
            <div className="flex flex-wrap gap-1">
              {TAG_ORDER.map((tag) => {
                const count = tagCounts.get(tag) || 0;
                if (!count) return null;
                const active = activeTags.has(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                      active
                        ? TAG_CLASS[tag]
                        : 'bg-zinc-900/40 text-zinc-500 border-zinc-800/60 hover:text-zinc-300 hover:border-zinc-700/60'
                    }`}
                  >
                    {tag} <span className="opacity-60">{count}</span>
                  </button>
                );
              })}
              {activeTags.size > 0 && (
                <button
                  onClick={() => setActiveTags(new Set())}
                  className="px-2 py-0.5 rounded-md text-[10px] font-medium border border-zinc-800/60 text-zinc-500 hover:text-zinc-300"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <span>Sort:</span>
              {(['recent', 'name', 'size'] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  className={`px-1.5 py-0.5 rounded ${
                    sortMode === mode
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'hover:text-zinc-300'
                  }`}
                >
                  {mode === 'recent' ? 'Recent' : mode === 'name' ? 'A-Z' : 'Size'}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto dashboard-scroll">
            {loading ? (
              <div className="p-4"><LoadingSkeleton cards={1} rows={6} /></div>
            ) : error ? (
              <div className="p-4">
                <EmptyState
                  title="Couldn't load pages"
                  description={error}
                  icon={<FileText className="w-10 h-10" />}
                  action={{ label: 'Retry', onClick: refresh }}
                />
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No pages match"
                  description={search || activeTags.size > 0 ? 'Try clearing filters.' : 'Doc has no pages yet.'}
                  icon={<FileText className="w-10 h-10" />}
                />
              </div>
            ) : (
              <ul className="divide-y divide-zinc-800/40">
                {filteredPages.map((p) => {
                  const active = p.id === selectedId;
                  return (
                    <li key={p.id}>
                      <button
                        onClick={() => selectPage(p.id)}
                        className={`w-full text-left px-3 py-2.5 transition-colors ${
                          active
                            ? 'bg-emerald-500/10'
                            : 'hover:bg-zinc-800/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-medium truncate ${active ? 'text-white' : 'text-zinc-200'}`}>
                              {p.name}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                              <span>{p.dateUpdated ? timeAgo(new Date(p.dateUpdated).toISOString()) : '—'}</span>
                              {p.charCount > 0 && <span>· {p.charCount.toLocaleString()} chars</span>}
                            </div>
                          </div>
                          <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-medium border ${TAG_CLASS[p.tag]}`}>
                            {p.tag}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </PanelCard>

        {/* Editor column */}
        <PanelCard
          title="Editor"
          icon={<TagIcon className="w-4 h-4" />}
          accent="blue"
          headerRight={
            detail && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500">
                  {draftContent.length.toLocaleString()} chars
                </span>
                <button
                  onClick={onDiscard}
                  disabled={!dirty || saving}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border border-zinc-800/60 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Undo2 className="w-3 h-3" /> Discard
                </button>
                <button
                  onClick={onSave}
                  disabled={!dirty || saving}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Save to ClickUp
                </button>
              </div>
            )
          }
        >
          {!selectedId ? (
            <div className="p-6">
              <EmptyState
                title="Select a page"
                description="Pick a prompt page from the list to view + edit its markdown."
                icon={<FileText className="w-10 h-10" />}
              />
            </div>
          ) : detailLoading || !detail ? (
            <div className="p-4"><LoadingSkeleton cards={1} rows={10} /></div>
          ) : (
            <div className="p-3 space-y-3">
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-zinc-950/60 border border-zinc-800/60 text-sm font-semibold text-white focus:outline-none focus:border-emerald-500/40"
              />
              <div className="flex items-center justify-between text-[10px] text-zinc-500">
                <span>
                  Last updated{' '}
                  {detail.dateUpdated ? timeAgo(new Date(detail.dateUpdated).toISOString()) : '—'}
                  {dirty && <span className="text-amber-400 ml-2">· unsaved changes</span>}
                </span>
                <span className={`px-1.5 py-0.5 rounded-md border ${TAG_CLASS[detail.tag]}`}>{detail.tag}</span>
              </div>
              <textarea
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
                spellCheck={false}
                className="w-full min-h-[55vh] px-3 py-3 rounded-lg bg-zinc-950/80 border border-zinc-800/60 text-[12.5px] leading-relaxed font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 resize-y"
                placeholder="(empty page)"
              />
            </div>
          )}
        </PanelCard>
      </div>
    </div>
  );
};

export default PromptsPanel;
