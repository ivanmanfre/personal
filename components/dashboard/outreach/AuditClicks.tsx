import React from 'react';
import { MousePointerClick } from 'lucide-react';
import { useOutreachClicks } from '../../../hooks/useOutreachClicks';
import { timeAgo } from '../shared/utils';

// Surfaces the previously-buried outreach_link_clicks data (audit-link clicks)
// as a compact summary above the prospect table. No per-prospect fetch — one RPC.
export function AuditClicks() {
  const { rows, loading } = useOutreachClicks();
  if (loading || rows.length === 0) return null;

  const distinctClickers = rows.length;
  const totalClicks = rows.reduce((sum, r) => sum + (r.click_count || 0), 0);
  const top = rows.slice(0, 6);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <MousePointerClick className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-medium text-zinc-200">Audit-link clicks</span>
        <span className="text-[10px] text-zinc-500">{distinctClickers} clicker{distinctClickers > 1 ? 's' : ''} · {totalClicks} click{totalClicks > 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-1.5">
        {top.map((r) => (
          <div key={r.token} className="flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0 flex items-center gap-2">
              {r.linkedin_profile_url ? (
                <a href={r.linkedin_profile_url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:text-cyan-400 hover:underline truncate transition-colors">
                  {r.connection_name || 'Unknown'}
                </a>
              ) : (
                <span className="text-zinc-300 truncate">{r.connection_name || 'Unknown'}</span>
              )}
              {r.company_name && <span className="text-zinc-600 truncate">· {r.company_name}</span>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-cyan-400">{r.click_count}×</span>
              <span className="text-zinc-600">{timeAgo(r.last_clicked_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AuditClicks;
