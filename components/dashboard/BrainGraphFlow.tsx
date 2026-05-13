import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeProps, Handle, Position,
  useReactFlow, ReactFlowProvider, MarkerType,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, FileText, ListChecks, Link2, Network, X, RotateCw, LayoutGrid } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface RelationRow {
  from_kind: string;
  from_id: string;
  to_kind: string;
  to_id: string;
  relation: string;
  metadata: Record<string, unknown> | null;
}

interface KindStyle {
  text: string; bg: string; border: string; ring: string; hex: string; icon: React.ReactNode;
}
const KIND_STYLE: Record<string, KindStyle> = {
  client:      { text: 'text-emerald-200', bg: 'bg-emerald-500/15', border: 'border-emerald-400/40', ring: 'shadow-emerald-400/40', hex: '#34d399', icon: <Users className="w-3 h-3" /> },
  proposal:    { text: 'text-amber-200',   bg: 'bg-amber-500/15',   border: 'border-amber-400/40',   ring: 'shadow-amber-400/40',   hex: '#fbbf24', icon: <FileText className="w-3 h-3" /> },
  clickup:     { text: 'text-orange-200',  bg: 'bg-orange-500/15',  border: 'border-orange-400/40',  ring: 'shadow-orange-400/40',  hex: '#fb923c', icon: <ListChecks className="w-3 h-3" /> },
  workflow:    { text: 'text-cyan-200',    bg: 'bg-cyan-500/15',    border: 'border-cyan-400/40',    ring: 'shadow-cyan-400/40',    hex: '#22d3ee', icon: <Network className="w-3 h-3" /> },
  call:        { text: 'text-violet-200',  bg: 'bg-violet-500/15',  border: 'border-violet-400/40',  ring: 'shadow-violet-400/40',  hex: '#a78bfa', icon: <FileText className="w-3 h-3" /> },
  memory_file: { text: 'text-zinc-200',    bg: 'bg-zinc-700/30',    border: 'border-zinc-500/40',    ring: 'shadow-zinc-400/30',    hex: '#a1a1aa', icon: <FileText className="w-3 h-3" /> },
  payment:     { text: 'text-emerald-100', bg: 'bg-emerald-600/15', border: 'border-emerald-500/50', ring: 'shadow-emerald-300/40', hex: '#10b981', icon: <FileText className="w-3 h-3" /> },
};

const RELATION_COLOR: Record<string, string> = {
  proposal_for:  '#34d399',  // emerald
  tracked_in:    '#fb923c',  // orange
  follows_call:  '#a78bfa',  // violet
  paid_for:      '#10b981',  // emerald deep
  call_with:     '#a78bfa',
  mentions:      '#71717a',  // zinc
  default:       '#52525b',
};

interface NodeData {
  kind: string;
  label: string;
  sub?: string;
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  [key: string]: unknown;
}

function EntityNode({ data }: NodeProps) {
  const d = data as unknown as NodeData;
  const style = KIND_STYLE[d.kind] || KIND_STYLE.memory_file;
  return (
    <motion.button
      type="button"
      onClick={d.onClick}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{
        opacity: d.dimmed ? 0.3 : 1,
        scale: d.selected ? 1.06 : 1,
        boxShadow: d.selected
          ? `0 0 0 2px ${style.hex}, 0 0 18px ${style.hex}88`
          : '0 0 0 0 transparent',
      }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      whileHover={{ scale: 1.05 }}
      className={`relative px-3 py-2 rounded-xl border ${style.bg} ${style.border} ${style.text} text-xs font-medium min-w-[140px] max-w-[210px] text-left backdrop-blur-sm cursor-pointer`}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-zinc-600 !border-0" />
      <div className="flex items-center gap-1.5 mb-0.5">
        {style.icon}
        <span className="font-mono text-[9px] tracking-wider opacity-70 uppercase">{d.kind}</span>
      </div>
      <div className="truncate text-[12px] leading-tight">{d.label}</div>
      {d.sub && <div className="text-[10px] text-zinc-400/80 truncate mt-0.5">{d.sub}</div>}
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-zinc-600 !border-0" />
    </motion.button>
  );
}

const nodeTypes = { entity: EntityNode };
const NODE_W = 200;
const NODE_H = 64;

function layoutDagre(nodes: Node[], edges: Edge[], rankdir: 'LR' | 'TB' = 'LR'): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep: 60, ranksep: 130, marginx: 30, marginy: 30, ranker: 'tight-tree' });
  g.setDefaultEdgeLabel(() => ({}));
  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

const BrainGraphFlowInner: React.FC<{ height: number }> = ({ height }) => {
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ kind: string; id: string; label: string } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [rankdir, setRankdir] = useState<'LR' | 'TB'>('LR');
  const [refreshKey, setRefreshKey] = useState(0);
  const { fitView } = useReactFlow();

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
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
  }, [refreshKey]);

  // Build adjacency for hover dimming
  const adjacency = useMemo(() => {
    const adj = new Map<string, Set<string>>();
    for (const r of relations) {
      const a = `${r.from_kind}::${r.from_id}`;
      const b = `${r.to_kind}::${r.to_id}`;
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a)!.add(b);
      adj.get(b)!.add(a);
    }
    return adj;
  }, [relations]);

  const { nodes, edges } = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];
    const ensure = (kind: string, id: string, sub?: string) => {
      const key = `${kind}::${id}`;
      if (!nodeMap.has(key)) {
        nodeMap.set(key, {
          id: key,
          type: 'entity',
          position: { x: 0, y: 0 },
          data: {
            kind, label: id, sub,
            onClick: () => setSelected({ kind, id, label: id }),
          },
        });
      } else if (sub) {
        const existing = nodeMap.get(key)!;
        existing.data = { ...existing.data, sub };
      }
      return key;
    };
    for (const r of relations) {
      const subFrom = r.metadata && (r.metadata.amount || r.metadata.project_title)
        ? `${r.metadata.currency || ''}${r.metadata.amount || ''}${r.metadata.project_title ? ' · ' + (r.metadata.project_title as string) : ''}`.trim()
        : undefined;
      const fromKey = ensure(r.from_kind, r.from_id, subFrom);
      const toKey = ensure(r.to_kind, r.to_id);
      const color = RELATION_COLOR[r.relation] || RELATION_COLOR.default;
      edgeList.push({
        id: `${fromKey}->${toKey}::${r.relation}`,
        source: fromKey,
        target: toKey,
        label: r.relation,
        labelStyle: { fill: '#d4d4d8', fontSize: 9, fontWeight: 500 },
        labelBgStyle: { fill: '#18181b', stroke: color, strokeWidth: 0.5 },
        labelBgPadding: [4, 3],
        labelBgBorderRadius: 4,
        style: { stroke: color, strokeWidth: 1.4, strokeOpacity: 0.6, filter: `drop-shadow(0 0 3px ${color}44)` },
        animated: true,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      });
    }
    const laid = layoutDagre(Array.from(nodeMap.values()), edgeList, rankdir);

    // Apply selected/hover state per node
    const selKey = selected ? `${selected.kind}::${selected.id}` : null;
    const focusKey = hovered || selKey;
    const focusNeighbors: Set<string> | null = focusKey ? (adjacency.get(focusKey) || new Set([focusKey])) : null;
    if (focusNeighbors && focusKey) focusNeighbors.add(focusKey);
    const styledNodes = laid.map((n) => {
      if (!focusNeighbors) return n;
      const isInFocus = focusNeighbors.has(n.id);
      const isSelected = n.id === selKey;
      return {
        ...n,
        data: { ...n.data, selected: isSelected, dimmed: !isInFocus },
      };
    });

    const styledEdges = edgeList.map((e) => {
      if (!focusNeighbors) return e;
      const isInFocus = focusNeighbors.has(e.source) && focusNeighbors.has(e.target);
      const oldStyle = (e.style || {}) as React.CSSProperties;
      return {
        ...e,
        style: {
          ...oldStyle,
          strokeOpacity: isInFocus ? 1 : 0.12,
          strokeWidth: isInFocus ? 2 : 1.2,
        },
        animated: isInFocus,
      };
    });

    return { nodes: styledNodes, edges: styledEdges };
  }, [relations, rankdir, selected, hovered, adjacency]);

  const onNodeMouseEnter = useCallback((_: unknown, node: Node) => setHovered(node.id), []);
  const onNodeMouseLeave = useCallback(() => setHovered(null), []);

  useEffect(() => {
    // Fit view after layout settles
    const t = setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 100);
    return () => clearTimeout(t);
  }, [rankdir, refreshKey, fitView]);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex items-center gap-1 bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setRankdir('LR')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${rankdir === 'LR' ? 'bg-zinc-700/60 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
            title="Left-to-right layout"
          >
            <LayoutGrid className="w-3 h-3 inline mr-1 rotate-90" /> LR
          </button>
          <button
            type="button"
            onClick={() => setRankdir('TB')}
            className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${rankdir === 'TB' ? 'bg-zinc-700/60 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
            title="Top-to-bottom layout"
          >
            <LayoutGrid className="w-3 h-3 inline mr-1" /> TB
          </button>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60 text-[11px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700/60 transition-colors"
          title="Reload from Supabase"
        >
          <RotateCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <div className="flex-1" />
        <div className="text-[11px] text-zinc-500 font-mono">{nodes.length} nodes · {edges.length} edges</div>
      </div>

      {/* Graph canvas */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-b from-zinc-950 to-zinc-900 border border-zinc-800/60 rounded-2xl overflow-hidden relative"
        style={{ height }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500 z-10 bg-zinc-950/60 backdrop-blur-sm">
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
              Loading graph…
            </motion.div>
          </div>
        )}
        {!loading && error && (
          <div className="h-full flex items-center justify-center text-xs text-red-400">{error}</div>
        )}
        {!loading && !error && nodes.length === 0 && (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            No relations yet — run gen-proposals-index.sh
          </div>
        )}
        {!loading && !error && nodes.length > 0 && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15, duration: 400 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.15}
            maxZoom={2}
            onNodeMouseEnter={onNodeMouseEnter}
            onNodeMouseLeave={onNodeMouseLeave}
            defaultEdgeOptions={{ type: 'smoothstep' }}
            nodesDraggable
            nodesConnectable={false}
            elementsSelectable
            panOnScroll
            zoomOnScroll={false}
            zoomOnPinch
          >
            <Background color="#27272a" gap={24} size={1.2} />
            <Controls className="!bg-zinc-900/80 !border-zinc-800/80 !backdrop-blur-sm !rounded-lg overflow-hidden" showInteractive={false} />
            <MiniMap
              className="!bg-zinc-950/80 !border-zinc-800/60"
              nodeColor={(n) => KIND_STYLE[(n.data as NodeData)?.kind || 'memory_file']?.hex || '#71717a'}
              nodeStrokeWidth={0}
              maskColor="rgba(9,9,11,0.75)"
              pannable
              zoomable
            />
          </ReactFlow>
        )}
      </motion.div>

      <AnimatePresence>
        {selected && (
          <SelectedDetail key={`${selected.kind}-${selected.id}`} entity={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px]">
        <span className="text-zinc-600 uppercase tracking-wider font-medium">Entity kinds</span>
        {Object.entries(KIND_STYLE).map(([kind, s]) => (
          <span key={kind} className={`inline-flex items-center gap-1 ${s.text}`}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.hex, boxShadow: `0 0 6px ${s.hex}88` }} />
            {kind}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px]">
        <span className="text-zinc-600 uppercase tracking-wider font-medium">Relations</span>
        {Object.entries(RELATION_COLOR).filter(([k]) => k !== 'default').map(([rel, color]) => (
          <span key={rel} className="inline-flex items-center gap-1 text-zinc-400">
            <span className="w-3 h-0.5" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
            {rel}
          </span>
        ))}
      </div>
    </div>
  );
};

const SelectedDetail: React.FC<{ entity: { kind: string; id: string; label: string }; onClose: () => void }> = ({ entity, onClose }) => {
  const [details, setDetails] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const style = KIND_STYLE[entity.kind] || KIND_STYLE.memory_file;
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        if (entity.kind === 'memory_file') {
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

  const content = (details as { content?: string })?.content;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18 }}
      className={`bg-zinc-900/80 border ${style.border} rounded-xl px-4 py-3 backdrop-blur-sm`}
      style={{ boxShadow: `0 0 24px ${style.hex}1a` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm">
          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md ${style.bg}`}>
            {style.icon}
          </span>
          <span className={`font-mono text-[10px] uppercase tracking-wider ${style.text} opacity-80`}>{entity.kind}</span>
          <span className="text-zinc-100 font-medium">{entity.label}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded hover:bg-zinc-800/60"
          aria-label="close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {loading ? (
        <div className="text-xs text-zinc-500 py-2">Loading details…</div>
      ) : content ? (
        <div className="space-y-1.5">
          <div className="text-[11px] text-zinc-500 flex items-center gap-2 flex-wrap">
            <span className="font-mono">{(details as { file_path: string }).file_path}</span>
            {(details as { client_id?: string }).client_id && (
              <span>· {(details as { client_id: string }).client_id}</span>
            )}
            {(details as { updated_at?: string }).updated_at && (
              <span>· updated {new Date((details as { updated_at: string }).updated_at).toLocaleDateString()}</span>
            )}
          </div>
          <pre className="text-[11px] text-zinc-300 bg-zinc-950/70 border border-zinc-800/50 rounded-lg p-3 overflow-auto max-h-80 leading-snug whitespace-pre-wrap font-mono">
            {content.slice(0, 4000)}
            {content.length > 4000 && '\n\n…(truncated)'}
          </pre>
        </div>
      ) : (
        <pre className="text-[11px] text-zinc-300 bg-zinc-950/70 border border-zinc-800/50 rounded-lg p-3 overflow-auto max-h-64 leading-snug">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </motion.div>
  );
};

const BrainGraphFlow: React.FC<{ height?: number }> = ({ height = 540 }) => (
  <ReactFlowProvider>
    <BrainGraphFlowInner height={height} />
  </ReactFlowProvider>
);

export default BrainGraphFlow;
