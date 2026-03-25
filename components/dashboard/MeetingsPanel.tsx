import React, { useState, useMemo } from 'react';
import { Phone, Clock, ListChecks, Users, ChevronDown, ChevronUp, FileText, ExternalLink } from 'lucide-react';
import { useMeetings } from '../../hooks/useMeetings';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import FilterBar from './shared/FilterBar';
import type { MeetingTranscript } from '../../types/dashboard';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const MeetingCard: React.FC<{ meeting: MeetingTranscript }> = ({ meeting }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg p-4 hover:border-zinc-700/60 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-zinc-100 truncate">{meeting.title}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
            <span>{timeAgo(meeting.date)}</span>
            {meeting.durationMinutes > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {meeting.durationMinutes}m
              </span>
            )}
            {meeting.participants.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {meeting.participants.join(', ')}
              </span>
            )}
            {meeting.source && (
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px] uppercase">
                {meeting.source}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-2 p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {meeting.summary && (
        <p className="mt-2 text-xs text-zinc-400 line-clamp-2">{meeting.summary}</p>
      )}

      {meeting.actionItems.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
            {meeting.actionItems.length} action item{meeting.actionItems.length > 1 ? 's' : ''}
          </span>
          {meeting.topics.slice(0, 3).map((t, i) => (
            <span key={i} className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
              {typeof t === 'string' ? t : (t as any).topic || (t as any).name || JSON.stringify(t)}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-4 space-y-3 border-t border-zinc-800 pt-3">
          {meeting.summary && (
            <div>
              <h4 className="text-xs font-medium text-zinc-300 mb-1">Summary</h4>
              <p className="text-xs text-zinc-400 whitespace-pre-wrap">{meeting.summary}</p>
            </div>
          )}

          {meeting.actionItems.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-zinc-300 mb-1 flex items-center gap-1">
                <ListChecks className="w-3 h-3" /> Action Items
              </h4>
              <ul className="space-y-1">
                {meeting.actionItems.map((item, i) => (
                  <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">-</span>
                    <span>{typeof item === 'string' ? item : (item as any).description || (item as any).task || JSON.stringify(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {meeting.followUpDraft && (
            <div>
              <h4 className="text-xs font-medium text-zinc-300 mb-1">Follow-up Draft</h4>
              <p className="text-xs text-zinc-400 whitespace-pre-wrap bg-zinc-800/50 rounded p-2">
                {meeting.followUpDraft}
              </p>
            </div>
          )}

          {meeting.transcriptText && (
            <details className="group">
              <summary className="text-xs font-medium text-zinc-300 cursor-pointer flex items-center gap-1 hover:text-zinc-100">
                <FileText className="w-3 h-3" /> Full Transcript
              </summary>
              <pre className="mt-2 text-xs text-zinc-500 whitespace-pre-wrap max-h-64 overflow-y-auto bg-zinc-950 rounded p-2 border border-zinc-800">
                {meeting.transcriptText}
              </pre>
            </details>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => {
                const text = `Meeting: ${meeting.title}\nDate: ${new Date(meeting.date).toLocaleDateString()}\nParticipants: ${meeting.participants.join(', ')}\n\nSummary:\n${meeting.summary || 'N/A'}\n\nAction Items:\n${meeting.actionItems.map((a) => `- ${typeof a === 'string' ? a : JSON.stringify(a)}`).join('\n') || 'None'}`;
                navigator.clipboard.writeText(text);
              }}
              className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              Copy Summary
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MeetingsPanel: React.FC = () => {
  const [search, setSearch] = useState('');
  const { meetings, stats, loading, refresh } = useMeetings();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['transcripts'] });

  const filtered = useMemo(() => {
    if (!search.trim()) return meetings;
    const q = search.toLowerCase();
    return meetings.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.participants.some((p) => p.toLowerCase().includes(q)) ||
        (m.summary && m.summary.toLowerCase().includes(q)) ||
        (m.transcriptText && m.transcriptText.toLowerCase().includes(q))
    );
  }, [meetings, search]);

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  if (meetings.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState
          title="No meetings yet"
          description="Meetings will appear here after Ivan Listener records and transcribes your calls."
          icon={<Phone className="w-10 h-10" />}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Calls" value={stats.total} icon={<Phone className="w-4 h-4" />} />
        <StatCard label="This Week" value={stats.thisWeek} icon={<Clock className="w-4 h-4" />} />
        <StatCard label="With Actions" value={stats.withActionItems} icon={<ListChecks className="w-4 h-4" />} />
        <StatCard label="Avg Duration" value={`${stats.avgDurationMinutes}m`} icon={<Clock className="w-4 h-4" />} />
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search meetings, participants, topics..."
      />

      <div className="space-y-3">
        {filtered.map((m) => (
          <MeetingCard key={m.id} meeting={m} />
        ))}
        {filtered.length === 0 && search && (
          <p className="text-sm text-zinc-500 text-center py-8">No meetings match "{search}"</p>
        )}
      </div>
    </div>
  );
};

export default MeetingsPanel;
