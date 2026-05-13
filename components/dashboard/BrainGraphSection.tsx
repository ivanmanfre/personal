import React, { useState, useMemo } from 'react';
import {
  Users, FileText, Link2, Search, Sparkles, ChevronDown, ChevronRight,
  ExternalLink, Database, RefreshCw,
} from 'lucide-react';
import { useBrainGraph, useBrainHybridSearch, type ClientEntity, type HybridSearchHit } from '../../hooks/useBrainGraph';
import PanelCard from './shared/PanelCard';
import StatCard from './shared/StatCard';
import EmptyState from './shared/EmptyState';

const kindColor: Record<string, string> = {
  client: 'text-emerald-300',
  proposal: 'text-amber-300',
  clickup: 'text-orange-300',
  workflow: 'text-cyan-300',
  call: 'text-violet-300',
  memory_file: 'text-zinc-300',
  payment: 'text-emerald-300',
};

function formatTotals(totals: Record<string, number | string>): string {
  return Object.entries(totals)
    .map(([cur, v]) => `${cur}${typeof v === 'number' ? v.toLocaleString() : v}`)
    .join(' · ');
}

const ClientRow: React.FC<{ client: ClientEntity }> = ({ client }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-zinc-800/60 rounded-lg overflow-hidden hover:border-zinc-700/60 transition-colors">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-zinc-800/30 transition-colors"
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
        )}
        <Users className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-sm text-zinc-100 font-medium truncate flex-1">{client.slug}</span>
        <span className="text-xs text-zinc-500 shrink-0">
          {client.proposal_count} {client.proposal_count === 1 ? 'proposal' : 'proposals'}
        </span>
        <span className="text-xs font-mono text-emerald-300 shrink-0 hidden sm:inline">
          {formatTotals(client.total_amount_by_currency)}
        </span>
      </button>
      {open && (
        <div className="border-t border-zinc-800/60 bg-zinc-900/40">
          {client.proposals.length === 0 ? (
            <div className="px-4 py-3 text-xs text-zinc-500">No proposals.</div>
          ) : (
            <ul className="divide-y divide-zinc-800/40">
              {client.proposals.map((p) => (
                <li key={p.slug} className="px-4 py-2.5 text-xs flex items-center gap-3">
                  <FileText className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span className="text-zinc-200 truncate flex-1">{p.project_title || p.slug}</span>
                  {p.amount && (
                    <span className="font-mono text-emerald-300 shrink-0">
                      {p.currency || ''}{p.amount}
                    </span>
                  )}
                  {p.date && <span className="text-zinc-500 shrink-0 hidden md:inline">{p.date}</span>}
                  {p.proposal_url && (
                    <a
                      href={p.proposal_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-400 hover:text-zinc-200 shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {p.clickup_task && (
                    <a
                      href={`https://app.clickup.com/t/${p.clickup_task}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-orange-300 hover:text-orange-200 shrink-0 font-mono"
                    >
                      {p.clickup_task}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

const HybridSearchHitRow: React.FC<{ hit: HybridSearchHit }> = ({ hit }) => {
  const snippet = useMemo(() => {
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
    <div className="px-4 py-3 border-b border-zinc-800/40 last:border-b-0 hover:bg-zinc-800/20">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono px-1.5 py-0.5 rounded bg-zinc-800/60 text-violet-300">{hit.client_id}</span>
        <span className="text-zinc-200 truncate flex-1">{hit.file_path}</span>
        <span className="text-zinc-500 font-mono shrink-0">
          rrf {hit.rrf_score.toFixed(3)} · vec {hit.vec_similarity.toFixed(2)} · bm25 {hit.bm25_rank.toFixed(3)}
        </span>
      </div>
      {snippet && <div className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{snippet}</div>}
    </div>
  );
};

const BrainGraphSection: React.FC = () => {
  const { clients, backlinks, embeddingStatus, totalRelations, loading, error, refresh } = useBrainGraph();
  const search = useBrainHybridSearch();
  const [query, setQuery] = useState('');

  const totalEmbedded = embeddingStatus.reduce((sum, e) => sum + e.embedded, 0);
  const totalPending = embeddingStatus.reduce((sum, e) => sum + e.pending, 0);
  const totalDocs = totalEmbedded + totalPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search.search(query, ['ivan', 'global', 'shared-tech']);
  };

  return (
    <div className="space-y-6">
      {/* Hybrid retrieval search */}
      <PanelCard
        title="Brain v2 — hybrid retrieval"
        icon={<Sparkles className="w-4 h-4 text-violet-400" />}
        accent="purple"
      >
        <p className="text-xs text-zinc-500 mb-3">
          BM25 + vector + RRF across all tiers. Finds things by meaning, not just keyword.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try: "the rule about anthropic credentials" or "video rendering platform"'
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <button
            type="submit"
            disabled={search.loading || !query.trim()}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm text-white font-medium transition-colors"
          >
            {search.loading ? 'Searching…' : 'Search'}
          </button>
        </form>
        {search.error && (
          <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2 mb-3">
            {search.error}
          </div>
        )}
        {search.results && search.results.length === 0 && !search.loading && (
          <EmptyState title="No matches." description="Try a different phrasing." />
        )}
        {search.results && search.results.length > 0 && (
          <div className="border border-zinc-800/60 rounded-lg overflow-hidden bg-zinc-900/30">
            {search.results.map((hit) => (
              <HybridSearchHitRow key={`${hit.id}-${hit.file_path}`} hit={hit} />
            ))}
          </div>
        )}
      </PanelCard>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Memory files"
          value={totalDocs}
          icon={<Database className="w-4 h-4" />}
          color="text-violet-400"
        />
        <StatCard
          label="Embedded"
          value={`${totalEmbedded}/${totalDocs}`}
          icon={<Sparkles className="w-4 h-4" />}
          color={totalPending === 0 ? 'text-emerald-400' : 'text-amber-400'}
        />
        <StatCard
          label="Typed relations"
          value={totalRelations}
          icon={<Link2 className="w-4 h-4" />}
          color="text-cyan-400"
        />
        <StatCard
          label="Wikilinks"
          value={backlinks.reduce((s, b) => s + b.count, 0)}
          icon={<FileText className="w-4 h-4" />}
          color="text-blue-400"
        />
      </div>

      {/* Clients with proposals */}
      <PanelCard
        title="Clients × Proposals"
        icon={<Users className="w-4 h-4 text-emerald-400" />}
        accent="emerald"
        headerRight={
          <button
            type="button"
            onClick={refresh}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      >
        <p className="text-xs text-zinc-500 mb-3">
          {clients.length} clients with {clients.reduce((s, c) => s + c.proposal_count, 0)} proposals. Click to expand.
        </p>
        {error && (
          <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}
        {!loading && clients.length === 0 && (
          <EmptyState
            title="No clients with proposals yet."
            description="Run gen-proposals-index.sh to seed the relations table."
          />
        )}
        <div className="space-y-2">
          {clients.map((c) => (
            <ClientRow key={c.slug} client={c} />
          ))}
        </div>
      </PanelCard>

      {/* Backlink hot targets */}
      {backlinks.length > 0 && (
        <PanelCard
          title="Most-linked entities"
          icon={<Link2 className="w-4 h-4 text-blue-400" />}
          accent="blue"
        >
          <p className="text-xs text-zinc-500 mb-3">
            What your memory files reference the most via [[wikilinks]].
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {backlinks.slice(0, 16).map((b) => (
              <div
                key={`${b.target_kind}-${b.target_value}`}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-900/40 border border-zinc-800/60 rounded-lg text-xs"
              >
                <span className={`font-mono shrink-0 ${kindColor[b.target_kind] || 'text-zinc-400'}`}>
                  {b.target_kind}
                </span>
                <span className="text-zinc-300 truncate flex-1">{b.target_value}</span>
                <span className="text-zinc-500 font-mono shrink-0">×{b.count}</span>
              </div>
            ))}
          </div>
        </PanelCard>
      )}
    </div>
  );
};

export default BrainGraphSection;
