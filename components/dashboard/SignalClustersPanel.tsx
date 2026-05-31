import React, { useState } from 'react';
import { MessagesSquare, Lightbulb, Handshake, Phone, Send, Mail } from 'lucide-react';
import { useSignalClusters } from '../../hooks/useSignalClusters';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import PanelCard from './shared/PanelCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import EmptyState from './shared/EmptyState';
import RefreshIndicator from './shared/RefreshIndicator';
import type { SignalCluster } from '../../types/dashboard';

const SOURCE_ICON: Record<string, React.ReactNode> = {
  call: <Phone className="w-3 h-3" />,
  dm: <Send className="w-3 h-3" />,
  email: <Mail className="w-3 h-3" />,
};

const ClusterCard: React.FC<{ cluster: SignalCluster; accent: string }> = ({ cluster, accent }) => {
  const [open, setOpen] = useState(false);
  const mix = cluster.sourceMix || {};
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-zinc-100">{cluster.theme}</h4>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${accent}`}>
          {cluster.frequency}×
        </span>
      </div>
      {cluster.summary && <p className="mt-1 text-xs text-zinc-400">{cluster.summary}</p>}
      <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
        {(['call', 'dm', 'email'] as const).map((s) => {
          const key = s === 'call' ? 'calls' : s === 'dm' ? 'dms' : 'email';
          const n = mix[key as keyof typeof mix] ?? 0;
          return n > 0 ? (
            <span key={s} className="flex items-center gap-1">{SOURCE_ICON[s]}{n}</span>
          ) : null;
        })}
      </div>
      {cluster.suggestedAction && (
        <div className="mt-3 rounded-lg bg-zinc-800/40 px-3 py-2 text-xs text-zinc-300">
          <span className="font-medium text-zinc-200">Action: </span>{cluster.suggestedAction}
        </div>
      )}
      {cluster.quotes.length > 0 && (
        <button onClick={() => setOpen((v) => !v)} className="mt-2 text-[11px] text-zinc-500 hover:text-zinc-300">
          {open ? 'Hide' : `Show ${cluster.quotes.length} quote${cluster.quotes.length > 1 ? 's' : ''}`}
        </button>
      )}
      {open && (
        <ul className="mt-2 space-y-2">
          {cluster.quotes.map((q, i) => (
            <li key={`${q.source}-${q.date}-${i}`} className="border-l-2 border-zinc-700 pl-3 text-xs italic text-zinc-400">
              "{q.text}"
              <span className="ml-2 not-italic text-[10px] text-zinc-600">— {q.source}, {q.date}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const SignalClustersPanel: React.FC = () => {
  const {
    loading, refresh, runDates, selectedRunDate, setSelectedRunDate,
    contentClusters, salesClusters, totalThisRun,
  } = useSignalClusters();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['signal_clusters'] });
  const [tab, setTab] = useState<'content' | 'sales'>('content');

  if (loading) return <LoadingSkeleton cards={3} />;

  const active = tab === 'content' ? contentClusters : salesClusters;
  // PanelCard accentMap supports: emerald, blue, purple, amber, red, cyan
  // Using 'purple' for content (closest to violet), 'cyan' for sales
  const accent = tab === 'content' ? 'bg-purple-500/10 text-purple-300' : 'bg-cyan-500/10 text-cyan-300';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Content Topics" value={contentClusters.length} icon={<Lightbulb className="w-5 h-5" />} color="text-violet-400" />
        <StatCard label="Sales Signals" value={salesClusters.length} icon={<Handshake className="w-5 h-5" />} color="text-cyan-400" />
        <StatCard label="Clusters This Run" value={totalThisRun} icon={<MessagesSquare className="w-5 h-5" />} color="text-zinc-300" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-zinc-900/60 p-1">
          <button onClick={() => setTab('content')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === 'content' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400'}`}>Content Topics</button>
          <button onClick={() => setTab('sales')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tab === 'sales' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400'}`}>Sales Intelligence</button>
        </div>
        <div className="flex items-center gap-2">
          {runDates.length > 0 && (
            <select
              value={selectedRunDate || ''}
              onChange={(e) => setSelectedRunDate(e.target.value)}
              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
            >
              {runDates.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
      </div>

      {active.length === 0 ? (
        <EmptyState title="No clusters yet" description="Clusters appear after the weekly Signal Clusters workflow runs." icon={<MessagesSquare className="w-10 h-10" />} />
      ) : (
        <PanelCard
          title={tab === 'content' ? 'Content Topics' : 'Sales Intelligence'}
          icon={<MessagesSquare className="w-4 h-4" />}
          badge={active.length}
          accent={tab === 'content' ? 'purple' : 'cyan'}
        >
          <div className="p-4 grid gap-3 md:grid-cols-2">
            {active.map((c) => <ClusterCard key={c.id} cluster={c} accent={accent} />)}
          </div>
        </PanelCard>
      )}
    </div>
  );
};

export default SignalClustersPanel;
