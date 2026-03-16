import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { PipelineConfig, PipelineEdge } from './config';
import type { WorkflowStat } from '../../../types/dashboard';

const WF_W = 180;
const WF_H = 40;
const PAD_X = 16;
const PAD_TOP = 44;
const PAD_BOTTOM = 12;
const GAP_X = 10;
const GAP_Y = 6;
const COLS = 2;

function getHealth(wf: WorkflowStat): 'healthy' | 'warning' | 'error' | 'inactive' {
  if (!wf.isActive) return 'inactive';
  if (wf.errorAcknowledged) return 'healthy';
  if (wf.lastExecutionStatus === 'error' || wf.errorCount24h > 3) return 'error';
  if (wf.errorCount24h > 0) return 'warning';
  return 'healthy';
}

function matchWf(wf: WorkflowStat, patterns: string[]): boolean {
  const name = wf.workflowName.toLowerCase();
  return patterns.some((p) => name.includes(p.toLowerCase()));
}

export function buildGraphData(
  workflows: WorkflowStat[],
  pipelines: PipelineConfig[],
  edgeDefs: PipelineEdge[],
): { nodes: Node[]; edges: Edge[] } {
  // Group workflows (first-match-wins to avoid duplicate nodes)
  const assigned = new Set<string>();
  const grouped = pipelines.map((p) => {
    const matched = workflows.filter((wf) => !assigned.has(wf.workflowId) && matchWf(wf, p.workflows));
    matched.forEach((wf) => assigned.add(wf.workflowId));
    return { ...p, matched };
  });

  const ungrouped = workflows.filter((wf) => !assigned.has(wf.workflowId));
  if (ungrouped.length > 0) {
    grouped.push({ id: 'other', name: 'Other', color: 'zinc', workflows: [], matched: ungrouped });
  }

  const active = grouped.filter((g) => g.matched.length > 0);

  // Compute dimensions per group
  const dims = active.map((g) => {
    const rows = Math.ceil(g.matched.length / COLS);
    const cols = Math.min(g.matched.length, COLS);
    const w = PAD_X * 2 + cols * WF_W + Math.max(0, cols - 1) * GAP_X;
    const h = PAD_TOP + rows * WF_H + Math.max(0, rows - 1) * GAP_Y + PAD_BOTTOM;
    return { id: g.id, w, h };
  });

  // Dagre layout for groups
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 100 });
  g.setDefaultEdgeLabel(() => ({}));

  dims.forEach((d) => g.setNode(d.id, { width: d.w, height: d.h }));
  edgeDefs.forEach((e) => {
    if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  });
  dagre.layout(g);

  // Build nodes
  const nodes: Node[] = [];

  active.forEach((group) => {
    const dn = g.node(group.id);
    const dim = dims.find((d) => d.id === group.id)!;
    const gx = dn.x - dim.w / 2;
    const gy = dn.y - dim.h / 2;

    // Group node
    nodes.push({
      id: `group-${group.id}`,
      type: 'pipelineGroup',
      position: { x: gx, y: gy },
      data: {
        label: group.name,
        color: group.color,
        workflowCount: group.matched.length,
        errorCount: group.matched.reduce((s, w) => s + w.errorCount24h, 0),
        health: group.matched.some((w) => getHealth(w) === 'error')
          ? 'error'
          : group.matched.some((w) => getHealth(w) === 'warning')
            ? 'warning'
            : 'healthy',
      },
      style: { width: dim.w, height: dim.h },
    });

    // Child workflow nodes
    group.matched.forEach((wf, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      nodes.push({
        id: `wf-${wf.workflowId}`,
        type: 'workflow',
        position: {
          x: PAD_X + col * (WF_W + GAP_X),
          y: PAD_TOP + row * (WF_H + GAP_Y),
        },
        parentId: `group-${group.id}`,
        extent: 'parent' as const,
        data: {
          label: wf.workflowName.replace(/^\[.*?\]\s*/, ''),
          health: getHealth(wf),
          workflowId: wf.workflowId,
          triggerType: wf.triggerType,
          errorCount: wf.errorCount24h,
          successCount: wf.successCount24h,
        },
        style: { width: WF_W, height: WF_H },
      });
    });
  });

  // Edges
  const edges: Edge[] = edgeDefs
    .filter((e) => g.hasNode(e.source) && g.hasNode(e.target))
    .map((e, i) => ({
      id: `edge-${e.source}-${e.target}-${i}`,
      source: `group-${e.source}`,
      target: `group-${e.target}`,
      type: 'animatedData',
      data: { label: e.label },
    }));

  return { nodes, edges };
}
