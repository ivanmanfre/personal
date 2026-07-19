import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const QUERY_WEBHOOK = 'https://n8n.ivanmanfredi.com/webhook/claude-memory-query';

export interface TierCount {
  client_id: string;
  count: number;
  lastSync: string | null;
}

export interface SessionLog {
  id: number;
  client_id: string;
  file_path: string;
  content: string;
  topic: string;
  date: string;
  updated_at: string;
}

export interface CompactionReview {
  client_id: string;
  file_path: string;
  content: string;
  proposalCount: number;
  proposals: Array<{ type: string; files: string; reason: string }>;
  generatedAt: string | null;
}

export interface SearchResult {
  client_id: string;
  file_path: string;
  snippet: string;
  updated_at: string;
}

// Ivan's own memory tiers — always present, always first, in this order.
const OWN_TIERS = ['global', 'shared-tech', 'ivan'];

/**
 * Live-derive the client tier roster instead of hardcoding it.
 *
 * The old hardcoded array carried dead pre-pivot automation clients (agencyops,
 * proswppp) that still have claude_memory rows, so a naive "distinct client_id
 * in claude_memory" would keep rendering them. Truth of "which clients are
 * ALIVE" lives in client_registry, which the dashboard anon key cannot read
 * (returns 0 rows — rows hold live secrets). So we derive the live client
 * roster from the content pipeline anon CAN read: distinct non-null client_id
 * present in carousel_drafts / lm_drafts_v2. Dead automation clients have no
 * content rows and drop off; the real paying client (risedtc) appears.
 */
async function deriveClientTiers(): Promise<string[]> {
  const [drafts, lms] = await Promise.all([
    supabase.from('carousel_drafts').select('client_id').not('client_id', 'is', null),
    supabase.from('lm_drafts_v2').select('client_id').not('client_id', 'is', null),
  ]);
  const set = new Set<string>();
  for (const r of drafts.data ?? []) if (r.client_id) set.add(r.client_id);
  for (const r of lms.data ?? []) if (r.client_id) set.add(r.client_id);
  // Never double-list Ivan's own tiers as "clients".
  for (const own of OWN_TIERS) set.delete(own);
  return Array.from(set).sort();
}

function parseTopic(content: string): string {
  // Try YAML frontmatter `name: ...`
  const fmMatch = content.match(/^---[\s\S]*?\nname:\s*(.+?)\n[\s\S]*?---/);
  if (fmMatch) return fmMatch[1].replace(/^Session log\s*[—-]\s*/, '').trim();
  // Try first H1
  const h1 = content.match(/^#\s+(.+?)$/m);
  if (h1) return h1[1].trim();
  return '(untitled)';
}

function parseDateFromPath(filePath: string): string {
  // session-logs/YYYY-MM-DD-<id>.md
  const m = filePath.match(/session-logs\/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function parseProposals(content: string) {
  const re = /##\s+\d+\.\s+\[(.+?)\]\s+(.+?)\n(.+?)(?=\n##|\n*$)/gs;
  const out: Array<{ type: string; files: string; reason: string }> = [];
  let match;
  while ((match = re.exec(content)) !== null) {
    out.push({ type: match[1].trim(), files: match[2].trim(), reason: (match[3] || '').trim().slice(0, 220) });
  }
  return out;
}

export function useBrainStats() {
  const [tierCounts, setTierCounts] = useState<TierCount[]>([]);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [reviews, setReviews] = useState<CompactionReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const clientTiers = await deriveClientTiers();
      const roster = [...OWN_TIERS, ...clientTiers];

      // Per-tier exact count + newest updated_at. One query per tier avoids the
      // PostgREST 1000-row default cap (ivan alone is ~1k rows), which a single
      // combined .in() select would silently truncate and mis-count.
      const tierQueries = roster.map((cid) =>
        supabase
          .from('claude_memory')
          .select('updated_at', { count: 'exact' })
          .eq('client_id', cid)
          .order('updated_at', { ascending: false })
          .limit(1),
      );

      const [tierResults, logsRes, reviewsRes] = await Promise.all([
        Promise.all(tierQueries),
        supabase
          .from('claude_memory')
          .select('id, client_id, file_path, content, updated_at')
          .like('file_path', 'session-logs/%')
          .order('updated_at', { ascending: false })
          .limit(8),
        supabase
          .from('claude_memory')
          .select('client_id, file_path, content, updated_at')
          .like('file_path', '%_compaction-review.md'),
      ]);

      // Own tiers hide when empty (preserves prior behavior); client tiers stay
      // visible even at 0 so the real client (risedtc) surfaces honestly rather
      // than vanishing behind a count>0 filter.
      const tierArr: TierCount[] = roster
        .map((cid, i) => {
          const res = tierResults[i];
          const newest = (res.data ?? [])[0] as { updated_at?: string } | undefined;
          return { client_id: cid, count: res.count ?? 0, lastSync: newest?.updated_at ?? null };
        })
        .filter((t) => (OWN_TIERS.includes(t.client_id) ? t.count > 0 : true));
      setTierCounts(tierArr);

      // Session logs
      const logs: SessionLog[] = (logsRes.data ?? []).map((r: any) => ({
        id: r.id,
        client_id: r.client_id,
        file_path: r.file_path,
        content: r.content || '',
        topic: parseTopic(r.content || ''),
        date: parseDateFromPath(r.file_path) || (r.updated_at || '').slice(0, 10),
        updated_at: r.updated_at,
      }));
      setSessionLogs(logs);

      // Reviews — only those with actual proposals
      const allReviews: CompactionReview[] = (reviewsRes.data ?? []).map((r: any) => {
        const proposals = parseProposals(r.content || '');
        return {
          client_id: r.client_id,
          file_path: r.file_path,
          content: r.content || '',
          proposalCount: proposals.length,
          proposals,
          generatedAt: r.updated_at,
        };
      }).filter((r) => r.proposalCount > 0);
      setReviews(allReviews);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const search = useCallback(async (query: string, clientId?: string, limit: number = 8) => {
    if (!query.trim()) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(QUERY_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), client_id: clientId || undefined, limit }),
      });
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
    } catch (e: any) {
      setSearchError(e?.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults(null);
    setSearchError(null);
  }, []);

  return {
    tierCounts,
    sessionLogs,
    reviews,
    loading,
    searching,
    searchResults,
    searchError,
    search,
    clearSearch,
    refresh: fetchAll,
  };
}
