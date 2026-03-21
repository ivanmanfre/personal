import React, { useState, useMemo } from 'react';
import { Users, ExternalLink } from 'lucide-react';
import { useLeads } from '../../hooks/useLeads';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import FilterBar from './shared/FilterBar';

const statusColors: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  qualified: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  contacted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  converted: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
  unknown: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

const funnelStages = ['new', 'qualified', 'contacted', 'converted'] as const;

const funnelColors: Record<string, string> = {
  new: 'bg-blue-500',
  qualified: 'bg-emerald-500',
  contacted: 'bg-amber-500',
  converted: 'bg-purple-500',
};

const LeadsPanel: React.FC = () => {
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const { leads, statusCounts, icpDistribution, loading, refresh, updateStatus } = useLeads(filter);
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['leads'] });

  const filteredLeads = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        (l.name && l.name.toLowerCase().includes(q)) ||
        (l.headline && l.headline.toLowerCase().includes(q)) ||
        (l.company && l.company.toLowerCase().includes(q))
    );
  }, [leads, search]);

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  if (leads.length === 0 && filter === 'all') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState title="No leads yet" description="Lead pipeline workflow will populate this panel as prospects engage with your content." icon={<Users className="w-10 h-10" />} />
      </div>
    );
  }

  const totalLeads = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const funnelMax = Math.max(...funnelStages.map((s) => statusCounts[s] || 0), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Leads" value={totalLeads} icon={<Users className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Qualified" value={statusCounts['qualified'] || 0} icon={<span className="text-sm">✅</span>} color="text-emerald-400" />
        <StatCard label="Converted" value={statusCounts['converted'] || 0} icon={<span className="text-sm">🎯</span>} color="text-purple-400" />
        <StatCard label="High ICP" value={icpDistribution.high} icon={<span className="text-sm">⭐</span>} color="text-amber-400" subValue={`${icpDistribution.medium} medium`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Funnel */}
        <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 shadow-sm shadow-black/10">
          <h2 className="text-sm font-bold text-zinc-300 mb-4">Lead Funnel</h2>
          <div className="space-y-1">
            {funnelStages.map((stage, i) => {
              const count = statusCounts[stage] || 0;
              const pct = (count / funnelMax) * 100;
              const prevCount = i > 0 ? (statusCounts[funnelStages[i - 1]] || 0) : 0;
              const convRate = i > 0 && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;
              return (
                <div key={stage}>
                  {convRate != null && (
                    <div className="flex items-center gap-1.5 py-0.5 pl-2">
                      <div className="w-px h-3 bg-zinc-700" />
                      <span className="text-[10px] text-zinc-600">{convRate}% conversion</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-zinc-400 capitalize">{stage}</span>
                    <span className="text-zinc-300 font-medium">{count}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${funnelColors[stage]} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {(statusCounts['lost'] || 0) > 0 && (
            <p className="text-xs text-zinc-500 mt-3">{statusCounts['lost']} lost</p>
          )}
        </div>

        {/* ICP Distribution */}
        <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 lg:col-span-2 shadow-sm shadow-black/10">
          <h2 className="text-sm font-bold text-zinc-300 mb-4">ICP Score Distribution</h2>
          <div className="flex items-end gap-4 h-32">
            {([
              { label: 'Low (1-3)', value: icpDistribution.low, color: 'bg-zinc-600' },
              { label: 'Medium (4-6)', value: icpDistribution.medium, color: 'bg-amber-500' },
              { label: 'High (7-10)', value: icpDistribution.high, color: 'bg-emerald-500' },
            ] as const).map((bucket) => {
              const max = Math.max(icpDistribution.low, icpDistribution.medium, icpDistribution.high, 1);
              const h = (bucket.value / max) * 100;
              return (
                <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-sm font-medium text-zinc-300">{bucket.value}</span>
                  <div className="w-full flex justify-center" style={{ height: '80px' }}>
                    <div className={`w-12 ${bucket.color} rounded-t-md self-end transition-all`} style={{ height: `${Math.max(h, 4)}%` }} />
                  </div>
                  <span className="text-[10px] text-zinc-500 text-center">{bucket.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}>
          All ({totalLeads})
        </button>
        {Object.entries(statusCounts).map(([status, count]) => (
          <button key={status} onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === status ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}>
            {status} ({count})
          </button>
        ))}
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search leads..."
      />

      {/* Leads — cards on mobile, table on md+ */}
      {filteredLeads.length === 0 ? (
        <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-8 text-zinc-500 text-center text-sm">No leads match filter</div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 md:hidden">
            {filteredLeads.map((lead) => (
              <div key={lead.id} className="bg-zinc-900/90 border border-zinc-800/60 rounded-xl p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-zinc-200 text-sm">{lead.name || '—'}</p>
                    {lead.headline && <p className="text-xs text-zinc-500 truncate mt-0.5">{lead.headline}</p>}
                  </div>
                  {lead.linkedinUrl && (
                    <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-2 -mr-1 -mt-1 text-zinc-400 hover:text-emerald-400">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  <select
                    value={lead.status || 'unknown'}
                    onChange={(e) => updateStatus(lead.id, e.target.value)}
                    className={`px-2 py-1 rounded text-xs font-medium border bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-600 ${statusColors[lead.status || 'unknown'] || statusColors.unknown}`}
                  >
                    {['new', 'qualified', 'contacted', 'converted', 'lost'].map((s) => (
                      <option key={s} value={s} className="bg-zinc-900 text-zinc-300">{s}</option>
                    ))}
                  </select>
                  {lead.icpScore != null && (
                    <span className={`text-xs font-medium ${lead.icpScore >= 7 ? 'text-emerald-400' : lead.icpScore >= 4 ? 'text-amber-400' : 'text-zinc-400'}`}>
                      ICP {lead.icpScore}/10
                    </span>
                  )}
                  {lead.source && <span className="text-[11px] text-zinc-500">{lead.source}</span>}
                  <span className="text-[11px] text-zinc-600 ml-auto">{lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : ''}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-zinc-900/90 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-sm shadow-black/10">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/40 bg-zinc-800/20 text-left">
                    <th className="px-4 py-3.5 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Name</th>
                    <th className="px-4 py-3.5 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Status</th>
                    <th className="px-4 py-3.5 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">ICP</th>
                    <th className="px-4 py-3.5 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] hidden lg:table-cell">Source</th>
                    <th className="px-4 py-3.5 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em]">Date</th>
                    <th className="px-4 py-3.5 text-[10px] text-zinc-500 font-bold uppercase tracking-[0.12em] w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-200">{lead.name || '—'}</p>
                        {lead.headline && <p className="text-xs text-zinc-500 truncate max-w-xs" title={lead.headline}>{lead.headline}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.status || 'unknown'}
                          onChange={(e) => updateStatus(lead.id, e.target.value)}
                          className={`px-2 py-0.5 rounded text-xs font-medium border bg-transparent cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-600 ${statusColors[lead.status || 'unknown'] || statusColors.unknown}`}
                        >
                          {['new', 'qualified', 'contacted', 'converted', 'lost'].map((s) => (
                            <option key={s} value={s} className="bg-zinc-900 text-zinc-300">{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${lead.icpScore != null && lead.icpScore >= 7 ? 'text-emerald-400' : lead.icpScore != null && lead.icpScore >= 4 ? 'text-amber-400' : 'text-zinc-400'}`}>
                            {lead.icpScore != null ? `${lead.icpScore}/10` : '—'}
                          </span>
                          {lead.icpScore != null && (
                            <div className="w-12 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${lead.icpScore >= 7 ? 'bg-emerald-500' : lead.icpScore >= 4 ? 'bg-amber-500' : 'bg-zinc-600'}`} style={{ width: `${(lead.icpScore / 10) * 100}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-zinc-400 text-xs">{lead.source || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {lead.linkedinUrl && (
                          <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-emerald-400">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LeadsPanel;
