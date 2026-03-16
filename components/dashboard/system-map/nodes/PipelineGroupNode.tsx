import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

const colors: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  blue:    { border: 'border-blue-500/30', bg: 'bg-blue-500/8', text: 'text-blue-400', dot: 'bg-blue-400' },
  purple:  { border: 'border-purple-500/30', bg: 'bg-purple-500/8', text: 'text-purple-400', dot: 'bg-purple-400' },
  emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/8', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  cyan:    { border: 'border-cyan-500/30', bg: 'bg-cyan-500/8', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  orange:  { border: 'border-orange-500/30', bg: 'bg-orange-500/8', text: 'text-orange-400', dot: 'bg-orange-400' },
  green:   { border: 'border-green-500/30', bg: 'bg-green-500/8', text: 'text-green-400', dot: 'bg-green-400' },
  amber:   { border: 'border-amber-500/30', bg: 'bg-amber-500/8', text: 'text-amber-400', dot: 'bg-amber-400' },
  zinc:    { border: 'border-zinc-600/30', bg: 'bg-zinc-500/8', text: 'text-zinc-400', dot: 'bg-zinc-400' },
};

export const PipelineGroupNode = memo(({ data }: NodeProps) => {
  const c = colors[(data.color as string) || 'zinc'] || colors.zinc;

  return (
    <div className={`w-full h-full rounded-xl border ${c.border} ${c.bg} relative`}>
      <div className="absolute top-0 inset-x-0 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${c.dot}`} />
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${c.text}`}>
            {data.label as string}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">{data.workflowCount as number} wf</span>
          {(data.errorCount as number) > 0 && (
            <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
              {data.errorCount as number} err
            </span>
          )}
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
    </div>
  );
});

PipelineGroupNode.displayName = 'PipelineGroupNode';
