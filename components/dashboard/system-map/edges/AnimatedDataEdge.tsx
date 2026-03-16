import { memo } from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps, EdgeLabelRenderer } from '@xyflow/react';

export const AnimatedDataEdge = memo((props: EdgeProps) => {
  const { sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, data, id } = props;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      {/* Base dashed line */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: 'rgba(161,161,170,0.15)',
          strokeWidth: 1.5,
          strokeDasharray: '6 4',
        }}
      />

      {/* Animated dot traveling along the path */}
      <circle r="3" fill="#10b981" opacity="0.8">
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
      </circle>
      <circle r="6" fill="#10b981" opacity="0.15">
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
      </circle>

      {/* Label */}
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="absolute text-[9px] text-zinc-600 bg-zinc-950/80 px-1.5 py-0.5 rounded pointer-events-none"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data.label as string}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

AnimatedDataEdge.displayName = 'AnimatedDataEdge';
