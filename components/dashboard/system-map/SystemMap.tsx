import React, { useMemo, useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PipelineGroupNode } from './nodes/PipelineGroupNode';
import { WorkflowNode } from './nodes/WorkflowNode';
import { AnimatedDataEdge } from './edges/AnimatedDataEdge';
import { buildGraphData } from './layout';
import { pipelineConfig, pipelineEdges } from './config';
import type { WorkflowStat } from '../../../types/dashboard';

const nodeTypes = {
  pipelineGroup: PipelineGroupNode,
  workflow: WorkflowNode,
};

const edgeTypes = {
  animatedData: AnimatedDataEdge,
};

interface Props {
  workflows: WorkflowStat[];
}

const nodeColor = (node: Node) => {
  if (node.type === 'pipelineGroup') return 'transparent';
  const h = node.data?.health;
  if (h === 'error') return '#ef4444';
  if (h === 'warning') return '#f59e0b';
  if (h === 'inactive') return '#52525b';
  return '#10b981';
};

export const SystemMap: React.FC<Props> = ({ workflows }) => {
  const { nodes, edges } = useMemo(
    () => buildGraphData(workflows, pipelineConfig, pipelineEdges),
    [workflows],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'workflow' && node.data.workflowId) {
      window.open(`https://n8n.intelligents.agency/workflow/${node.data.workflowId}`, '_blank');
    }
  }, []);

  return (
    <div className="h-[600px] w-full rounded-2xl border border-zinc-800/60 bg-zinc-950 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background color="rgba(255,255,255,0.03)" gap={32} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={nodeColor}
          maskColor="rgba(0,0,0,0.6)"
          style={{ background: 'rgba(9,9,11,0.9)', borderRadius: 12, border: '1px solid rgba(63,63,70,0.4)' }}
        />
      </ReactFlow>
    </div>
  );
};
