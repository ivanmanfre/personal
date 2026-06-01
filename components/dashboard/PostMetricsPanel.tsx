import React from 'react';
import { BarChart3, Eye, ThumbsUp, MessageSquare, Repeat2, Bookmark, MousePointerClick, UserPlus } from 'lucide-react';
import { CarouselDraft } from '../../hooks/useContentLibrary';

// Performance metrics panel — shown only on published posts. Currently reads
// from draft.qa.perf (a jsonb extension point) if populated. When the
// LinkedIn analytics sync workflow is built, it writes there and this comes
// alive without further dashboard changes. Empty-state explicitly says
// "metrics not tracked yet" instead of hiding silently.
//
// Mirrors the 7 performance fields ClickUp exposes: Impressions, Reactions,
// Comments, Shares, Saves, Profile Clicks, Follower Delta.

type Perf = Partial<{
  impressions: number;
  reactions: number;
  comments: number;
  shares: number;
  saves: number;
  profile_clicks: number;
  follower_delta: number;
  fetched_at: string;
}>;

function getPerf(draft: CarouselDraft): Perf | null {
  const fromQa = (draft.qa as Record<string, any> | null)?.perf;
  if (fromQa && typeof fromQa === 'object') return fromQa as Perf;
  return null;
}

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: number | null | undefined }> = ({ icon, label, value }) => (
  <div className="flex flex-col items-start gap-0.5 px-2 py-1.5 rounded bg-zinc-900/40 border border-zinc-800/60">
    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
      {icon}
      <span>{label}</span>
    </div>
    <div className="text-[14px] tabular-nums text-zinc-100 font-medium">
      {typeof value === 'number' ? value.toLocaleString() : '—'}
    </div>
  </div>
);

interface Props {
  draft: CarouselDraft;
}

const PostMetricsPanel: React.FC<Props> = ({ draft }) => {
  // Only show on published posts — drafts have no perf data.
  if (draft.status !== 'published') return null;

  const perf = getPerf(draft);
  const hasAnyMetric = perf && Object.values(perf).some((v) => typeof v === 'number');

  return (
    <div className="rounded-md border border-zinc-800/60 bg-zinc-900/30">
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-medium border-b border-zinc-800/60 flex items-center gap-1.5">
        <BarChart3 className="w-3 h-3 text-emerald-400/70" />
        Performance
        {perf?.fetched_at && (
          <span className="ml-auto text-zinc-600 normal-case font-normal">
            updated {new Date(perf.fetched_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
      {!hasAnyMetric ? (
        <div className="px-3 py-3 text-[11.5px] text-zinc-500 italic">
          No metrics tracked yet. Hook the LinkedIn analytics sync to write to <code className="text-zinc-400 font-mono text-[10.5px]">qa.perf</code> on this row.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1.5 p-2">
          <Metric icon={<Eye className="w-3 h-3" />} label="Impressions" value={perf?.impressions} />
          <Metric icon={<ThumbsUp className="w-3 h-3" />} label="Reactions" value={perf?.reactions} />
          <Metric icon={<MessageSquare className="w-3 h-3" />} label="Comments" value={perf?.comments} />
          <Metric icon={<Repeat2 className="w-3 h-3" />} label="Shares" value={perf?.shares} />
          <Metric icon={<Bookmark className="w-3 h-3" />} label="Saves" value={perf?.saves} />
          <Metric icon={<MousePointerClick className="w-3 h-3" />} label="Profile clicks" value={perf?.profile_clicks} />
          <Metric icon={<UserPlus className="w-3 h-3" />} label="Follower Δ" value={perf?.follower_delta} />
        </div>
      )}
    </div>
  );
};

export default PostMetricsPanel;
