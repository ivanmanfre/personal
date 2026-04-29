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

const TRACKED_CLIENT_IDS = ['global', 'shared-tech', 'ivan', 'secondmile', 'agencyops', 'lemonade', 'proswppp', 'reeder'];

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
      const [allRes, logsRes, reviewsRes] = await Promise.all([
        supabase
          .from('claude_memory')
          .select('client_id, updated_at')
          .in('client_id', TRACKED_CLIENT_IDS),
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

      // Tier counts
      const countMap = new Map<string, { count: number; lastSync: string | null }>();
      for (const cid of TRACKED_CLIENT_IDS) countMap.set(cid, { count: 0, lastSync: null });
      for (const row of allRes.data ?? []) {
        const cur = countMap.get(row.client_id) ?? { count: 0, lastSync: null };
        cur.count += 1;
        if (!cur.lastSync || (row.updated_at && row.updated_at > cur.lastSync)) cur.lastSync = row.updated_at;
        countMap.set(row.client_id, cur);
      }
      const tierArr: TierCount[] = TRACKED_CLIENT_IDS
        .map((cid) => ({ client_id: cid, count: countMap.get(cid)?.count ?? 0, lastSync: countMap.get(cid)?.lastSync ?? null }))
        .filter((t) => t.count > 0);
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
