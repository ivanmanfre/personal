import React, { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { useCallReports, type CallReport } from '../../hooks/useCallReports';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useDashboard } from '../../contexts/DashboardContext';
import LoadingSkeleton from './shared/LoadingSkeleton';
import EmptyState from './shared/EmptyState';
import RefreshIndicator from './shared/RefreshIndicator';
import { formatDate, timeAgo } from './shared/utils';

// Outcome → badge styling. Unknown outcomes fall back to neutral zinc.
function outcomeStyle(outcome: string | null): string {
  const o = (outcome || '').toLowerCase();
  if (o.includes('closed') && !o.includes('not')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (o.includes('not_closed') || o.includes('lost') || o.includes('no')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (o.includes('follow') || o.includes('pending')) return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
  return 'bg-zinc-700/40 text-zinc-300 border-zinc-600/40';
}

function outcomeLabel(outcome: string | null): string {
  if (!outcome) return 'unknown';
  return outcome.replace(/_/g, ' ');
}

const ReportCard: React.FC<{ report: CallReport }> = ({ report }) => {
  const [expanded, setExpanded] = useState(false);
  const dateStr = report.meetingDate || report.createdAt;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/30 transition-colors"
      >
        <FileText className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-zinc-100 truncate">{report.meetingTitle}</div>
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3 h-3" />
            {dateStr ? formatDate(dateStr, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
            <span className="text-zinc-700">·</span>
            {timeAgo(report.createdAt ?? null)}
          </div>
        </div>
        <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${outcomeStyle(report.outcome)}`}>
          {outcomeLabel(report.outcome)}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-zinc-800/50">
          {report.reportHtml ? (
            // Sandboxed iframe — report HTML is fully isolated (no scripts, no
            // same-origin access) so it can never touch the dashboard session.
            <iframe
              title={`Call report — ${report.meetingTitle}`}
              srcDoc={report.reportHtml}
              sandbox=""
              className="w-full bg-white"
              style={{ height: '70vh', border: 'none' }}
            />
          ) : (
            <div className="px-4 py-6 text-xs text-zinc-500">
              No rendered report HTML for this call yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CallReportsPanel: React.FC = () => {
  const { reports, loading, refresh } = useCallReports();
  // lastRefreshed comes from DashboardContext, same as every other panel —
  // RefreshIndicator's prop is a required Date and it calls .getTime() on it
  // unconditionally (omitting it blanked the whole section: TypeError on undefined).
  const { lastRefreshed } = useDashboard();
  useAutoRefresh(refresh, { realtimeTables: ['call_reports'] });

  if (loading && reports.length === 0) return <LoadingSkeleton cards={0} rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-200">Call Reports</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">Auto-generated post-call reports, newest first.</p>
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-10 h-10" />}
          title="No call reports yet"
          description="Reports appear here once the Call Report Generator workflow runs after a call."
        />
      ) : (
        <div className="space-y-2.5">
          {reports.map((r) => <ReportCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  );
};

export default CallReportsPanel;
