import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ClientEntity {
  slug: string;
  proposal_count: number;
  total_amount_by_currency: Record<string, number | string>;
  proposals: ProposalEntity[];
}

export interface ProposalEntity {
  slug: string;
  project_title?: string | null;
  amount?: string | null;
  currency?: string | null;
  date?: string | null;
  proposal_url?: string | null;
  clickup_task?: string | null;
}

export interface BacklinkSummary {
  target_kind: string;
  target_value: string;
  count: number;
}

export interface EmbeddingStatus {
  client_id: string;
  total: number;
  embedded: number;
  pending: number;
}

export interface BrainGraphData {
  clients: ClientEntity[];
  backlinks: BacklinkSummary[];
  embeddingStatus: EmbeddingStatus[];
  totalRelations: number;
  loading: boolean;
  error: string | null;
}

interface RelationRow {
  from_id: string;
  to_id: string;
  relation: string;
  metadata: Record<string, unknown>;
}

interface BacklinkRow {
  target_kind: string;
  target_value: string;
}

export function useBrainGraph(): BrainGraphData & { refresh: () => void } {
  const [clients, setClients] = useState<ClientEntity[]>([]);
  const [backlinks, setBacklinks] = useState<BacklinkSummary[]>([]);
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatus[]>([]);
  const [totalRelations, setTotalRelations] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [relsRes, blRes, embedRes, relCountRes] = await Promise.all([
        supabase
          .from('claude_memory_relations')
          .select('from_id, to_id, to_kind, relation, metadata')
          .eq('from_kind', 'proposal')
          .in('relation', ['proposal_for', 'tracked_in'])
          .order('created_at', { ascending: false }),
        supabase
          .from('claude_memory_backlinks')
          .select('target_kind, target_value'),
        supabase
          .from('v_claude_memory_embedding_status')
          .select('*'),
        supabase
          .from('claude_memory_relations')
          .select('*', { count: 'exact', head: true }),
      ]);

      if (relsRes.error) throw relsRes.error;

      // Build proposal map
      const propMap = new Map<string, ProposalEntity>();
      const clientByProposal = new Map<string, string>();
      for (const r of (relsRes.data || []) as Array<RelationRow & { to_kind: string }>) {
        const p = propMap.get(r.from_id) || { slug: r.from_id };
        if (r.relation === 'proposal_for' && r.to_kind === 'client') {
          clientByProposal.set(r.from_id, r.to_id);
          p.project_title = (r.metadata?.project_title as string) ?? p.project_title;
          p.amount = (r.metadata?.amount as string) ?? p.amount;
          p.currency = (r.metadata?.currency as string) ?? p.currency;
          p.date = (r.metadata?.date as string) ?? p.date;
          p.proposal_url = (r.metadata?.proposal_url as string) ?? p.proposal_url;
        } else if (r.relation === 'tracked_in' && r.to_kind === 'clickup') {
          p.clickup_task = r.to_id;
        }
        propMap.set(r.from_id, p);
      }

      // Group proposals by client
      const clientMap = new Map<string, ClientEntity>();
      for (const [proposalSlug, clientSlug] of clientByProposal.entries()) {
        const prop = propMap.get(proposalSlug);
        if (!prop) continue;
        const c = clientMap.get(clientSlug) || {
          slug: clientSlug,
          proposal_count: 0,
          total_amount_by_currency: {},
          proposals: [],
        };
        c.proposals.push(prop);
        c.proposal_count++;
        const cur = prop.currency || '?';
        const amt = parseFloat(String(prop.amount || '').replace(/[^0-9.]/g, ''));
        if (!isNaN(amt)) {
          c.total_amount_by_currency[cur] = ((c.total_amount_by_currency[cur] as number) || 0) + amt;
        } else if (prop.amount) {
          c.total_amount_by_currency[cur] = String(c.total_amount_by_currency[cur] || '') + ` +${prop.amount}`;
        }
        clientMap.set(clientSlug, c);
      }
      const clientList = Array.from(clientMap.values()).sort((a, b) => b.proposal_count - a.proposal_count);
      setClients(clientList);

      // Backlink summary
      const blCounts = new Map<string, number>();
      for (const b of (blRes.data || []) as BacklinkRow[]) {
        const k = `${b.target_kind}|${b.target_value}`;
        blCounts.set(k, (blCounts.get(k) || 0) + 1);
      }
      const blSummary: BacklinkSummary[] = Array.from(blCounts.entries())
        .map(([k, count]) => {
          const [target_kind, target_value] = k.split('|');
          return { target_kind, target_value, count };
        })
        .sort((a, b) => b.count - a.count);
      setBacklinks(blSummary);

      setEmbeddingStatus((embedRes.data || []) as EmbeddingStatus[]);
      setTotalRelations(relCountRes.count || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { clients, backlinks, embeddingStatus, totalRelations, loading, error, refresh: fetchAll };
}

// ----- Hybrid search hook (calls claude-memory-recall edge function) -----

export interface HybridSearchHit {
  id: number;
  client_id: string;
  file_path: string;
  content: string;
  bm25_rank: number;
  vec_similarity: number;
  rrf_score: number;
}

export function useBrainHybridSearch() {
  const [results, setResults] = useState<HybridSearchHit[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, clientIds?: string[]) => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke('claude-memory-recall', {
        body: { query, client_ids: clientIds || null, match_count: 12 },
      });
      if (invokeErr) throw invokeErr;
      setResults((data as { results?: HybridSearchHit[] })?.results || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return { results, loading, error, search, clear: () => setResults(null) };
}
