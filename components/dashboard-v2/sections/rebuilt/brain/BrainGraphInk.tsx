/*
 * BrainGraphInk — BB v4 restyle of the v1 BrainGraphFlow (react-flow + dagre).
 * The react-flow / dagre / adjacency-dimming / node-detail wiring is reused
 * verbatim from components/dashboard/BrainGraphFlow.tsx (worth keeping — 500
 * lines of graph plumbing). What changed: the entire chromatic identity is
 * killed. Nodes render as typographic ink labels on paper; entity kinds are
 * distinguished by a shape marker + border weight/style (NOT emerald/amber/
 * cyan/orange). Edges are hairline ink with ink arrowheads; relation is read
 * off the edge label, not a color. No glow, no shadow, no gradient, radius 0.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  type Node, type Edge, type NodeProps, Handle, Position,
  useReactFlow, ReactFlowProvider, MarkerType,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';
import { supabase } from '../../../../../lib/supabase';

interface RelationRow {
  from_kind: string;
  from_id: string;
  to_kind: string;
  to_id: string;
  relation: string;
  metadata: Record<string, unknown> | null;
}

// Entity kind → typographic marker + border treatment. All ink; distinction is
// carried by SHAPE + OUTLINE, never hue (BB v4 law: no green/amber/cyan/orange).
interface KindInk { mark: string; border: string; }
const KIND_INK: Record<string, KindInk> = {
  client:      { mark: '■', border: '2px solid #131210' },
  proposal:    { mark: '●', border: '1px solid #131210' },
  clickup:     { mark: '○', border: '1px dotted #131210' },
  workflow:    { mark: '□', border: '1px dashed #131210' },
  call:        { mark: '◆', border: '3px double #131210' },
  memory_file: { mark: '◇', border: '1px solid rgba(19,18,16,0.28)' },
  payment:     { mark: '▲', border: '2px solid #131210' },
};
const kindInk = (k: string): KindInk => KIND_INK[k] || KIND_INK.memory_file;

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
  const ink = kindInk(d.kind);
  return (
    <button
      type="button"
      onClick={d.onClick}
      className={`br-node${d.selected ? ' br-node--sel' : ''}`}
      style={{
        border: d.selected ? '2px solid #131210' : ink.border,
        opacity: d.dimmed ? 0.28 : 1,
        transition: 'opacity 0.18s ease',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ width: 5, height: 5, background: '#6B675E', border: 0, borderRadius: 0 }} />
      <span className="br-node-kind">
        <span className="br-node-mark">{ink.mark}</span>
        {d.kind}
      </span>
      <div className="br-node-label">{d.label}</div>
      {d.sub && <div className="br-node-sub">{d.sub}</div>}
      <Handle type="source" position={Position.Right} style={{ width: 5, height: 5, background: '#6B675E', border: 0, borderRadius: 0 }} />
    </button>
  );
}

const nodeTypes = { entity: EntityNode };
const NODE_W = 200;
const NODE_H = 60;
const INK = '#131210';
const HAIRLINE = 'rgba(19,18,16,0.28)';

// Size the node box to its label instead of stamping every entity into the
// same generic 200px chip — short ids get a compact box, long ones grow up
// to a cap. Also gives ReactFlow/MiniMap a known width up front (set on the
// Node object below) so they don't wait on ResizeObserver measurement before
// fitView/minimap can compute correct bounds.
function estimateNodeWidth(label: string, kind: string): number {
  const charW = 6.6; // ~footprint per mono character at 11px
  const len = Math.max(label.length, kind.length + 2);
  const px = Math.ceil(len * charW) + 26;
  return Math.min(224, Math.max(104, px));
}

const WRAP_THRESHOLD = 6; // ranks with more nodes than this get reflowed into a grid
const WRAP_GAP = 22;

function layoutDagre(nodes: Node[], edges: Edge[], rankdir: 'LR' | 'TB' = 'TB'): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, nodesep: 28, ranksep: 70, marginx: 20, marginy: 20, ranker: 'tight-tree' });
  g.setDefaultEdgeLabel(() => ({}));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const widthOf = (n: Node) => (typeof n.width === 'number' ? n.width : NODE_W);
  nodes.forEach((n) => g.setNode(n.id, { width: widthOf(n), height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const isTB = rankdir !== 'LR';

  // Group node ids by their dagre rank (preserving within-rank order so
  // adjacency-adjacent nodes stay near each other when wrapped).
  const byRank = new Map<number, string[]>();
  nodes.forEach((n) => {
    const gn = g.node(n.id) as { rank?: number; order?: number };
    const rank = gn?.rank ?? 0;
    if (!byRank.has(rank)) byRank.set(rank, []);
    byRank.get(rank)!.push(n.id);
  });
  byRank.forEach((ids) => {
    ids.sort((a, b) => ((g.node(a) as { order?: number }).order ?? 0) - ((g.node(b) as { order?: number }).order ?? 0));
  });

  const positions = new Map<string, { x: number; y: number }>();

  byRank.forEach((ids) => {
    if (ids.length <= WRAP_THRESHOLD) {
      ids.forEach((id) => {
        const p = g.node(id);
        positions.set(id, { x: p.x, y: p.y });
      });
      return;
    }
    // Overcrowded rank — the "one flat band" failure mode on hub/spoke data
    // (a client hub with a dozen+ direct relations). Reflow into a compact
    // grid centered on the rank's original position instead of one long,
    // illegible line of micro-chips.
    const cols = Math.max(2, Math.ceil(Math.sqrt(ids.length)));
    const crossCenter = isTB
      ? ids.reduce((s, id) => s + g.node(id).x, 0) / ids.length
      : ids.reduce((s, id) => s + g.node(id).y, 0) / ids.length;
    const depthCenter = isTB
      ? ids.reduce((s, id) => s + g.node(id).y, 0) / ids.length
      : ids.reduce((s, id) => s + g.node(id).x, 0) / ids.length;
    const depthStep = isTB ? NODE_H + WRAP_GAP : Math.max(...ids.map((id) => widthOf(byId.get(id)!))) + WRAP_GAP;

    for (let row = 0; row * cols < ids.length; row++) {
      const rowIds = ids.slice(row * cols, row * cols + cols);
      const crossSizes = rowIds.map((id) => (isTB ? widthOf(byId.get(id)!) : NODE_H));
      const rowSpan = crossSizes.reduce((s, sz, i) => s + sz + (i > 0 ? WRAP_GAP : 0), 0);
      let cursor = crossCenter - rowSpan / 2;
      const depthPos = depthCenter + row * depthStep;
      rowIds.forEach((id, i) => {
        const sz = crossSizes[i];
        const crossPos = cursor + sz / 2;
        positions.set(id, isTB ? { x: crossPos, y: depthPos } : { x: depthPos, y: crossPos });
        cursor += sz + WRAP_GAP;
      });
    }
  });

  return nodes.map((n) => {
    const pos = positions.get(n.id) || { x: 0, y: 0 };
    const w = widthOf(n);
    return { ...n, position: { x: pos.x - w / 2, y: pos.y - NODE_H / 2 } };
  });
}

const BrainGraphInkInner: React.FC<{ height: number }> = ({ height }) => {
  const [relations, setRelations] = useState<RelationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ kind: string; id: string; label: string } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [rankdir, setRankdir] = useState<'LR' | 'TB'>('TB');
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

  // Base layout — relations + dagre only. Kept separate from hover/selection
  // styling below so that hovering a node never re-triggers a relayout/refit.
  const baseGraph = useMemo(() => {
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];
    const ensure = (kind: string, id: string, sub?: string) => {
      const key = `${kind}::${id}`;
      if (!nodeMap.has(key)) {
        const w = estimateNodeWidth(id, kind);
        nodeMap.set(key, {
          id: key,
          type: 'entity',
          position: { x: 0, y: 0 },
          width: w,
          height: NODE_H,
          style: { width: w, height: NODE_H },
          data: { kind, label: id, sub, onClick: () => setSelected({ kind, id, label: id }) },
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
      edgeList.push({
        id: `${fromKey}->${toKey}::${r.relation}`,
        source: fromKey,
        target: toKey,
        label: r.relation,
        labelStyle: { fill: INK, fontSize: 9, fontWeight: 700, fontFamily: 'Berkeley Mono, ui-monospace, Menlo, monospace' },
        labelBgStyle: { fill: '#FFFFFF', stroke: HAIRLINE, strokeWidth: 0.5 },
        labelBgPadding: [4, 3],
        labelBgBorderRadius: 0,
        style: { stroke: HAIRLINE, strokeWidth: 1 },
        animated: false,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: INK, width: 13, height: 13 },
      });
    }
    const laid = layoutDagre(Array.from(nodeMap.values()), edgeList, rankdir);
    return { nodes: laid, edges: edgeList };
  }, [relations, rankdir]);

  const { nodes, edges } = useMemo(() => {
    const { nodes: laid, edges: edgeList } = baseGraph;
    const selKey = selected ? `${selected.kind}::${selected.id}` : null;
    const focusKey = hovered || selKey;
    const focusNeighbors: Set<string> | null = focusKey ? (adjacency.get(focusKey) || new Set([focusKey])) : null;
    if (focusNeighbors && focusKey) focusNeighbors.add(focusKey);
    const styledNodes = laid.map((n) => {
      if (!focusNeighbors) return n;
      const isInFocus = focusNeighbors.has(n.id);
      const isSelected = n.id === selKey;
      return { ...n, data: { ...n.data, selected: isSelected, dimmed: !isInFocus } };
    });
    const styledEdges = edgeList.map((e) => {
      if (!focusNeighbors) return e;
      const isInFocus = focusNeighbors.has(e.source) && focusNeighbors.has(e.target);
      const oldStyle = (e.style || {}) as React.CSSProperties;
      return {
        ...e,
        style: { ...oldStyle, stroke: isInFocus ? INK : HAIRLINE, strokeOpacity: isInFocus ? 1 : 0.35, strokeWidth: isInFocus ? 1.6 : 1 },
      };
    });
    return { nodes: styledNodes, edges: styledEdges };
  }, [baseGraph, selected, hovered, adjacency]);

  const onNodeMouseEnter = useCallback((_: unknown, node: Node) => setHovered(node.id), []);
  const onNodeMouseLeave = useCallback(() => setHovered(null), []);

  // Fit the view whenever the BASE layout changes — on open (data first
  // loads), on refresh, and on LR/TB toggle — never on hover/selection so an
  // interaction never yanks the user's zoom/pan. Double rAF so it runs after
  // dagre's positions AND the initial paint/measurement pass, not just on
  // React mount (the earlier single setTimeout(150) could fire before the
  // ReactFlow node existed at all, since it's only rendered once loading
  // finishes — leaving the canvas at its default, mostly-empty zoom).
  useEffect(() => {
    if (baseGraph.nodes.length === 0) return;
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        fitView({ padding: 0.15, duration: 300, maxZoom: 1.4, minZoom: 0.2 });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [baseGraph, fitView]);

  return (
    <div>
      <div className="br-graph-toolbar">
        <div className="br-graph-seg">
          <button type="button" className="br-tool" aria-pressed={rankdir === 'LR'} onClick={() => setRankdir('LR')} title="Left-to-right layout">LR</button>
          <button type="button" className="br-tool" aria-pressed={rankdir === 'TB'} onClick={() => setRankdir('TB')} title="Top-to-bottom layout">TB</button>
        </div>
        <button type="button" className="br-tool" onClick={() => setRefreshKey((k) => k + 1)} title="Reload from Supabase">
          {loading ? 'Loading' : 'Refresh'}
        </button>
        <div className="br-graph-meta">{nodes.length} nodes · {edges.length} edges</div>
      </div>

      <div className="br-graph-canvas" style={{ height }}>
        {loading && <div className="br-graph-state">Loading graph</div>}
        {!loading && error && <div className="br-graph-state" style={{ color: '#C8361B' }}>{error}</div>}
        {!loading && !error && nodes.length === 0 && (
          <div className="br-graph-state">No relations yet. Run gen-proposals-index.sh</div>
        )}
        {!loading && !error && nodes.length > 0 && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
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
            <Background color="#d8d8df" gap={24} size={1} />
            <Controls className="br-graph-controls" showInteractive={false} />
            <MiniMap
              className="br-graph-minimap"
              style={{ width: 130, height: 90 }}
              nodeColor={() => '#131210'}
              nodeStrokeWidth={0}
              nodeBorderRadius={0}
              maskColor="rgba(255,255,255,0.72)"
              pannable
              zoomable
            />
          </ReactFlow>
        )}
      </div>

      {selected && (
        <SelectedDetail key={`${selected.kind}-${selected.id}`} entity={selected} onClose={() => setSelected(null)} />
      )}

      {/* Legend — entity kinds by ink shape marker (no color key) */}
      <div className="br-graph-legend">
        <span className="br-glegend-lbl">Entity kinds</span>
        {Object.entries(KIND_INK).map(([kind, ink]) => (
          <span key={kind} className="br-kind" style={{ gap: '0.35rem' }}>
            <span className="br-kind-mark" style={{ width: '0.9rem' }}>{ink.mark}</span>
            <span className="br-kind-name" style={{ fontWeight: 500, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ec-mutedc)' }}>{kind}</span>
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
    <div className="br-detail">
      <div className="br-detail-head">
        <span className="br-node-mark" style={{ fontSize: 12 }}>{kindInk(entity.kind).mark}</span>
        <span className="br-detail-kind">{entity.kind}</span>
        <span className="br-detail-label">{entity.label}</span>
        <button type="button" className="br-detail-close" onClick={onClose} aria-label="close">Close</button>
      </div>
      {loading ? (
        <div className="br-detail-note">Loading details</div>
      ) : !details || (typeof details === 'object' && Object.keys(details as object).length === 0) ? (
        <div className="br-detail-note">No details for this entity yet.</div>
      ) : content ? (
        <div>
          <div className="br-detail-meta">
            <span>{(details as { file_path: string }).file_path}</span>
            {(details as { client_id?: string }).client_id && <span>{(details as { client_id: string }).client_id}</span>}
            {(details as { updated_at?: string }).updated_at && (
              <span>updated {new Date((details as { updated_at: string }).updated_at).toLocaleDateString()}</span>
            )}
          </div>
          <pre className="br-detail-pre">
            {content.slice(0, 4000)}
            {content.length > 4000 && '\n\n…(truncated)'}
          </pre>
        </div>
      ) : (
        <DetailJsonOrList details={details} />
      )}
    </div>
  );
};

function DetailJsonOrList({ details }: { details: unknown }) {
  const d = details as Record<string, unknown>;
  if (d && Array.isArray(d.proposals)) {
    const props = d.proposals as Array<Record<string, unknown>>;
    const totals = d.totals as Record<string, number> | undefined;
    return (
      <div>
        {totals && Object.keys(totals).length > 0 && (
          <div className="br-detail-meta">
            {Object.entries(totals).map(([cur, amt]) => (
              <span key={cur}>{cur}{(amt as number).toLocaleString()}</span>
            ))}
          </div>
        )}
        <ul className="br-detail-list">
          {props.map((p, i) => (
            <li key={i}>
              <span className="br-node-mark" style={{ fontSize: 9 }}>●</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.project_title as string) || (p.slug as string)}</span>
              {p.amount != null && <span className="br-detail-amt">{(p.currency as string) || ''}{p.amount as string}</span>}
              {p.clickup_task != null && (
                <a href={`https://app.clickup.com/t/${p.clickup_task}`} target="_blank" rel="noreferrer" className="br-cprop-cu">{p.clickup_task as string}</a>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (d && Array.isArray(d.backlinks)) {
    const bl = d.backlinks as Array<Record<string, unknown>>;
    if (bl.length === 0) return <div className="br-detail-note">No connections found.</div>;
    return (
      <ul className="br-detail-list">
        {bl.map((b, i) => (
          <li key={i}>
            <span className="br-node-mark" style={{ fontSize: 9 }}>◇</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Berkeley Mono, ui-monospace, Menlo, monospace', fontSize: 11 }}>{b.from_path as string}</span>
            {b.line_no != null && <span className="br-detail-amt">L{b.line_no as number}</span>}
          </li>
        ))}
      </ul>
    );
  }
  return <pre className="br-detail-pre">{JSON.stringify(details, null, 2)}</pre>;
}

const BrainGraphInk: React.FC<{ height?: number }> = ({ height = 520 }) => (
  <ReactFlowProvider>
    <BrainGraphInkInner height={height} />
  </ReactFlowProvider>
);

export default BrainGraphInk;
