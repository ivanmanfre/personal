import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCw, ExternalLink } from 'lucide-react';

const LeadsPanel: React.FC = () => {
  const [leads, setLeads] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    let query = supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(100);
    if (filter !== 'all') {
      query = query.eq('status', filter);
    }
    const { data } = await query;
    setLeads(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [filter]);

  const statusCounts = leads.reduce((acc: Record<string, number>, l) => {
    const s = l.status || 'unknown';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const statusColors: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    qualified: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    contacted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    converted: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    lost: 'bg-red-500/20 text-red-400 border-red-500/30',
    unknown: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
  };

  const getStatusStyle = (status: string) => statusColors[status] || statusColors.unknown;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Leads</h1>
        <button onClick={fetchData} className="text-zinc-400 hover:text-white transition-colors">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
        >
          All ({leads.length})
        </button>
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === status ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {status} ({count})
          </button>
        ))}
      </div>

      {/* Leads table */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-zinc-900 border border-zinc-800 rounded-xl" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center text-zinc-500">
          No leads found
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden md:table-cell">Score</th>
                  <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide hidden lg:table-cell">Source</th>
                  <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-xs text-zinc-500 font-medium uppercase tracking-wide w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {leads.map((lead, i) => (
                  <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-200">{lead.name || lead.linkedin_name || '—'}</p>
                      {lead.headline && <p className="text-xs text-zinc-500 truncate max-w-xs">{lead.headline}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${getStatusStyle(lead.status || 'unknown')}`}>
                        {lead.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-zinc-300">{lead.icp_score ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-zinc-400 text-xs">{lead.source || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {lead.linkedin_url && (
                        <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-emerald-400">
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
      )}
    </div>
  );
};

export default LeadsPanel;
