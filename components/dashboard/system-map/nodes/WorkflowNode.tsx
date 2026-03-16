import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';

const healthDot: Record<string, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  inactive: 'bg-zinc-600',
};

const healthRing: Record<string, string> = {
  warning: 'ring-1 ring-amber-500/30',
  error: 'ring-1 ring-red-500/30',
};

export const WorkflowNode = memo(({ data }: NodeProps) => {
  const health = (data.health as string) || 'inactive';
  const ring = healthRing[health] || '';

  return (
    <div
      className={`w-full h-full px-2.5 py-1.5 rounded-lg cursor-pointer bg-zinc-900/80 border border-zinc-700/40 hover:bg-zinc-800/80 hover:border-zinc-600/60 transition-colors duration-150 ${ring}`}
      title={`${data.label} — ${data.triggerType}\n${data.successCount} ok / ${data.errorCount} err (24h)\nClick to open in n8n`}
    >
      <div className="flex items-center gap-1.5 h-full">
        <span className="relative shrink-0">
          {health === 'error' && (
            <span className="absolute w-2 h-2 rounded-full bg-red-500 opacity-40 animate-ping" />
          )}
          <span className={`relative block w-2 h-2 rounded-full ${healthDot[health] || 'bg-zinc-600'}`} />
        </span>
        <span className="text-[11px] text-zinc-300 hover:text-white truncate flex-1 font-medium leading-tight">
          {data.label as string}
        </span>
        <span className="text-[9px] text-zinc-600 shrink-0">{data.triggerType as string}</span>
        {(data.errorCount as number) > 0 && (
          <span className="text-[9px] text-red-400 shrink-0">{data.errorCount as number}e</span>
        )}
      </div>
    </div>
  );
});

WorkflowNode.displayName = 'WorkflowNode';
