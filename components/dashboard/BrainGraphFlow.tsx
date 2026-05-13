import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, type Node, type Edge, type NodeProps, Handle, Position } from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import { Users, FileText, ListChecks, Link2, Network } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RelationRow {
  from_kind: string;
  from_id: string;
  to_kind: string;
  to_id: string;
  relation: string;
  metadata: Record<string, unknown> | null;
}

const KIND_STYLE: Record<string, { color: string; bg: string; border: string; ring: string; icon: React.ReactNode }> = {
  client:      { color: 'text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/40', ring: 'ring-emerald-400/30', icon: <Users className="w-3 h-3" /> },
  proposal:    { color: 'text-amber-300',   bg: 'bg-amber-500/15',   border: 'border-amber-500/40',   ring: 'ring-amber-400/30',   icon: <FileText className="w-3 h-3" /> },
  clickup:     { color: 'text-orange-300',  bg: 'bg-orange-500/15',  border: 'border-orange-500/40',  ring: 'ring-orange-400/30',  icon: <ListChecks className="w-3 h-3" /> },
  workflow:    { color: 'text-cyan-300',    bg: 'bg-cyan-500/15',    border: 'border-cyan-500/40',    ring: 'ring-cyan-400/30',    icon: <Network className="w-3 h-3" /> },
  call:        { color: 'text-violet-300',  bg: 'bg-violet-500/15',  border: 'border-violet-500/40',  ring: 'ring-violet-400/30',  icon: <FileText className="w-3 h-3" /> },
  memory_file: { color: 'text-zinc-300',    bg: 'bg-zinc-700/30',    border: 'border-zinc-600/40',    ring: 'ring-zinc-500/30',    icon: <FileText className="w-3 h-3" /> },
  payment:     { color: 'text-emerald-300', bg: 'bg-emerald-600/15', border: 'border-emerald-600/40', ring: 'ring-emerald-500/30', icon: <FileText className="w-3 h-3" /> },
};

function EntityNode({ data }: NodeProps) {
  const d = data as { kind: string; label: string; sub?: string; onClick?: () => void };
  const style = KIND_STYLE[d.kind] || KIND_STYLE.memory_file;
  return (
    <button
      type="button"
      onClick={d.onClick}
      className={`group relative px-3 py-2 rounded-lg border ${style.bg} ${style.border} ${style.color} text-xs font-medium min-w-[120px] max-w-[200px] text-left shadow-sm hover:ring-2 ${style.ring} transition-all`}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-zinc-600 !border-0" />
      <div className="flex items-center gap-1.5">
        {style.icon}
        <span className="font-mono text-[10px] opacity-60 uppercase">{d.kind}</span>
      </div>
      <div className="mt-0.5 truncate">{d.label}</div>
      {d.sub && <div className="text-[10px] text-zinc-500 truncate">{d.sub}</div>}
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-zinc-600 !border-0" />
    </button>
  );
}

const nodeTypes = { entity: EntityNode };

const NODE_W = 200;
const NODE_H = 60;

function layoutDagre(nodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

const BrainGraphFlow: React.FC<{ height?: number }> = ({ height = 480 }) => {
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ kind: string; id: string; label: string } | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data, error: e } = await supabase
          .from('claude_memory_relations')
          .select('from_kind, from_id, to_kind, to_id, relation, metadata')
          .limit(500);
        if (cancel) return;
        if (e) throw e;
        setRelations((data || []) as RelationRow[]);
      } catch (err) {
        if (cancel) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];
    const ensure = (kind: string, id: string, label?: string, sub?: string) => {
      const key = `${kind}::${id}`;
      if (!nodeMap.has(key)) {
        nodeMap.set(key, {
          id: key,
          type: 'entity',
          position: { x: 0, y: 0 },
          data: {
            kind,
            label: label || id,
            sub,
            onClick: () => setSelected({ kind, id, label: label || id }),
          },
        });
      } else if (sub) {
        // augment sub if added later
        const existing = nodeMap.get(key)!;
        existing.data = { ...existing.data, sub };
      }
      return key;
    };
    for (const r of relations) {
      const subFrom = r.metadata && (r.metadata.amount || r.metadata.project_title)
        ? `${r.metadata.currency || ''}${r.metadata.amount || ''} ${r.metadata.project_title ? '· ' + (r.metadata.project_title as string) : ''}`.trim()
        : undefined;
      const fromKey = ensure(r.from_kind, r.from_id, undefined, subFrom);
      const toKey = ensure(r.to_kind, r.to_id);
      edgeList.push({
        id: `${fromKey}->${toKey}::${r.relation}`,
        source: fromKey,
        target: toKey,
        label: r.relation,
        labelStyle: { fill: '#a1a1aa', fontSize: 10 },
        labelBgStyle: { fill: '#18181b' },
        labelBgPadding: [3, 2],
        style: { stroke: '#52525b', strokeWidth: 1.2 },
        type: 'smoothstep',
      });
    }
    const laid = layoutDagre(Array.from(nodeMap.values()), edgeList);
    return { nodes: laid, edges: edgeList };
  }, [relations]);

  return (
    <div className="space-y-3">
      <div
        className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden"
        style={{ height }}
      >
        {loading && (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">Loading graph…</div>
        )}
        {!loading && error && (
          <div className="h-full flex items-center justify-center text-xs text-red-400">{error}</div>
        )}
        {!loading && !error && nodes.length === 0 && (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">No relations yet — run gen-proposals-index.sh</div>
        )}
        {!loading && !error && nodes.length > 0 && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            minZoom={0.2}
            maxZoom={2}
          >
            <Background color="#27272a" gap={20} />
            <Controls className="!bg-zinc-900 !border-zinc-800" showInteractive={false} />
          </ReactFlow>
        )}
      </div>
      {selected && (
        <SelectedDetail entity={selected} onClose={() => setSelected(null)} />
      )}
      <div className="flex flex-wrap gap-3 text-[11px] text-zinc-500">
        {Object.entries(KIND_STYLE).map(([kind, s]) => (
          <span key={kind} className={`inline-flex items-center gap-1 ${s.color}`}>
            <span className={`w-2.5 h-2.5 rounded-sm border ${s.bg} ${s.border}`} />
            {kind}
          </span>
        ))}
      </div>
    </div>
  );
};

const SelectedDetail: React.FC<{ entity: { kind: string; id: string; label: string }; onClose: () => void }> = ({ entity, onClose }) => {
  const [details, setDetails] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        if (entity.kind === 'memory_file') {
          // Read the markdown file's content (source-of-truth viewer)
          const { data, error: e } = await supabase
            .from('claude_memory')
            .select('client_id, file_path, content, updated_at')
            .or(`file_path.eq.${entity.id},file_path.like.%/${entity.id}`)
            .limit(1)
            .maybeSingle();
          if (!cancel) setDetails(e ? { error: e.message } : (data || { error: 'file not found' }));
        } else {
          const { data } = await supabase.functions.invoke('claude-brain-query', {
            body: entity.kind === 'client'
              ? { mode: 'client_proposals', client_slug: entity.id }
              : { mode: 'connections', target_kind: entity.kind, target_value: entity.id },
          });
          if (!cancel) setDetails(data);
        }
      } catch {
        if (!cancel) setDetails({ error: 'fetch failed' });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [entity.kind, entity.id]);
  return (
    <div className="bg-zinc-900/80 border border-zinc-800/60 rounded-xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <Link2 className="w-4 h-4 text-zinc-400" />
          <span className="font-mono text-xs text-zinc-500 uppercase">{entity.kind}</span>
          <span className="text-zinc-100 font-medium">{entity.label}</span>
        </div>
        <button type="button" onClick={onClose} className="text-xs text-zinc-500 hover:text-zinc-300">close</button>
      </div>
      {loading ? (
        <div className="text-xs text-zinc-500">Loading details…</div>
      ) : (
        (details && typeof (details as { content?: string }).content === 'string') ? (
          <div className="space-y-1.5">
            <div className="text-[11px] text-zinc-500">
              <span className="font-mono">{(details as { file_path: string }).file_path}</span>
              {(details as { client_id?: string }).client_id && (
                <span className="ml-2">· {(details as { client_id: string }).client_id}</span>
              )}
              {(details as { updated_at?: string }).updated_at && (
                <span className="ml-2">· updated {new Date((details as { updated_at: string }).updated_at).toLocaleDateString()}</span>
              )}
            </div>
            <pre className="text-[11px] text-zinc-300 bg-zinc-950/60 border border-zinc-800/50 rounded-lg p-3 overflow-auto max-h-80 leading-snug whitespace-pre-wrap font-mono">
              {(details as { content: string }).content.slice(0, 4000)}
              {(details as { content: string }).content.length > 4000 && '\n\n…(truncated, read full at source on disk)'}
            </pre>
          </div>
        ) : (
          <pre className="text-[11px] text-zinc-300 bg-zinc-950/60 border border-zinc-800/50 rounded-lg p-3 overflow-auto max-h-64 leading-snug">
            {JSON.stringify(details, null, 2)}
          </pre>
        )
      )}
    </div>
  );
};

export default BrainGraphFlow;
