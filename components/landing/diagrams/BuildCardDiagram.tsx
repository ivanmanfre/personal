import React, { useMemo } from 'react';
import { horizontalLayout, nodeWidth } from './layout';
import { DiagramNode } from './DiagramSvg';
import { DIAGRAM } from './tokens';

// Scene 3: static micro-diagram on the build cards. The sage signal path
// lights on card hover via the .diagram-sage CSS hook (always lit on touch
// devices — see styles.css). No JS animation: this scene is CSS-only.
const BuildCardDiagram: React.FC<{ labels: string[] }> = ({ labels }) => {
  const layout = useMemo(() => {
    const packed = labels.reduce((acc, l) => acc + nodeWidth(l), 0) + 16 * (labels.length - 1);
    return horizontalLayout(labels, Math.min(380, packed));
  }, [labels]);
  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width="100%"
      role="img"
      aria-label={`Pipeline: ${labels.join(', then ')}`}
      style={{ display: 'block', maxHeight: layout.height, overflow: 'visible' }}
    >
      <path d={layout.pathD} stroke={DIAGRAM.connector} strokeWidth={DIAGRAM.nodeStroke} fill="none" />
      <path
        className="diagram-sage"
        d={layout.pathD}
        stroke={DIAGRAM.sage}
        strokeWidth={DIAGRAM.signalStroke}
        fill="none"
      />
      {layout.nodes.map((n, i) => (
        <DiagramNode key={`${n.label}-${i}`} node={n} />
      ))}
    </svg>
  );
};

export default BuildCardDiagram;
