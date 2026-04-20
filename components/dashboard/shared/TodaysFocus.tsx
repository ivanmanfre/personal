import React, { useMemo } from 'react';
import { AlertCircle, Clock, FileEdit, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { timeAgo } from './utils';
import type { WorkflowStat, Tab } from '../../../types/dashboard';

interface AlertLike {
  id: string;
  title: string;
  alertType: string;
  createdAt: string;
  sent: boolean;
}

interface FocusItem {
  id: string;
  severity: 'high' | 'medium' | 'low';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tab: Tab;
}

interface Props {
  workflows: WorkflowStat[];
  alerts: AlertLike[];
  pendingPostsCount: number;
  onNavigate: (tab: Tab) => void;
}

const sevStyles: Record<FocusItem['severity'], { border: string; bg: string; icon: string; chip: string }> = {
  high:   { border: 'border-l-red-500',    bg: 'hover:bg-red-500/5',    icon: 'text-red-400',    chip: 'bg-red-500/15 text-red-300 border-red-500/30' },
  medium: { border: 'border-l-amber-500',  bg: 'hover:bg-amber-500/5',  icon: 'text-amber-400',  chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  low:    { border: 'border-l-blue-500',   bg: 'hover:bg-blue-500/5',   icon: 'text-blue-400',   chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
};

const TodaysFocus: React.FC<Props> = ({ workflows, alerts, pendingPostsCount, onNavigate }) => {
  const items = useMemo<FocusItem[]>(() => {
    const out: FocusItem[] = [];

    // 1. Workflow errors (unacknowledged)
    const failingWorkflows = workflows
      .filter((w) => w.errorCount24h > 0 && !w.errorAcknowledged)
      .sort((a, b) => b.errorCount24h - a.errorCount24h)
      .slice(0, 3);

    failingWorkflows.forEach((w) => {
      out.push({
        id: `wf-${w.id}`,
        severity: w.errorCount24h > 3 ? 'high' : 'medium',
        icon: <AlertCircle className="w-4 h-4" />,
        title: w.workflowName,
        subtitle: `${w.errorCount24h} error${w.errorCount24h > 1 ? 's' : ''} in 24h${w.lastErrorMessage ? ` · ${w.lastErrorMessage.slice(0, 60)}` : ''}`,
        tab: 'workflows',
      });
    });

    // 2. Stuck pipeline (rolled up - show oldest unsent stall)
    const stalls = alerts
      .filter((a) => a.alertType === 'pipeline_stall' && !a.sent)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (stalls.length > 0) {
      const oldest = stalls[0];
      out.push({
        id: `stall-${oldest.id}`,
        severity: 'high',
        icon: <Clock className="w-4 h-4" />,
        title: stalls.length > 1 ? `${oldest.title} (${stalls.length} stall alerts)` : oldest.title,
        subtitle: `Oldest stall opened ${timeAgo(oldest.createdAt)}`,
        tab: 'content',
      });
    }

    // 3. Pending posts awaiting review
    if (pendingPostsCount > 0) {
      out.push({
        id: 'pending-posts',
        severity: pendingPostsCount > 5 ? 'medium' : 'low',
        icon: <FileEdit className="w-4 h-4" />,
        title: `${pendingPostsCount} post${pendingPostsCount > 1 ? 's' : ''} pending`,
        subtitle: 'Review and approve in the publishing queue',
        tab: 'content',
      });
    }

    return out;
  }, [workflows, alerts, pendingPostsCount]);

  if (items.length === 0) {
    return (
      <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">All clear</h2>
          <p className="text-[12px] text-zinc-500">Nothing needs your attention right now.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Needs your attention</span>
        </div>
        <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-2 py-0.5 rounded-full">{items.length}</span>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {items.map((item) => {
          const s = sevStyles[item.severity];
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.tab)}
              className={`w-full text-left px-5 py-3 flex items-center gap-3 border-l-2 ${s.border} ${s.bg} transition-colors group`}
            >
              <div className={`shrink-0 ${s.icon}`}>{item.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 font-medium truncate">{item.title}</p>
                <p className="text-[12px] text-zinc-500 truncate">{item.subtitle}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 shrink-0 transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TodaysFocus;
