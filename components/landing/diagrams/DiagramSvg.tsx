import React from 'react';
import { DIAGRAM } from './tokens';
import type { PlacedNode } from './layout';
import { CHAR_W, PAD_X } from './layout';

// One node of a brand diagram. Sharp corners, 1px ink stroke, paper fill
// (the fill hides the connector line that runs behind every node, so a
// single path can travel the whole pipeline). data attrs are GSAP hooks.
export const DiagramNode: React.FC<{
  node: PlacedNode;
  ticked?: boolean;  // done-state: dark stroke + sage corner square
  pink?: boolean;    // before/failure state — diagrams' only sanctioned pink
}> = ({ node, ticked, pink }) => {
  const innerW = node.w - PAD_X * 2;
  const natural = node.label.length * CHAR_W;
  const fit = natural > innerW ? { textLength: innerW, lengthAdjust: 'spacingAndGlyphs' as const } : {};
  return (
  <g data-diagram-node transform={`translate(${node.x}, ${node.y})`}>
    <rect
      data-node-rect
      width={node.w}
      height={node.h}
      fill={DIAGRAM.paper}
      stroke={ticked ? DIAGRAM.inkDone : pink ? DIAGRAM.pink : DIAGRAM.ink}
      strokeWidth={DIAGRAM.nodeStroke}
    />
    <text
      x={node.w / 2}
      y={node.h / 2}
      dominantBaseline="central"
      textAnchor="middle"
      fontFamily={DIAGRAM.font}
      fontSize={DIAGRAM.fontSize}
      letterSpacing="0.08em"
      fill={DIAGRAM.label}
      {...fit}
    >
      {node.label.toUpperCase()}
    </text>
    <rect
      data-node-tick
      x={node.w - DIAGRAM.tick / 2}
      y={-DIAGRAM.tick / 2}
      width={DIAGRAM.tick}
      height={DIAGRAM.tick}
      fill={DIAGRAM.sage}
      opacity={ticked ? 1 : 0}
    />
  </g>
  );
};
