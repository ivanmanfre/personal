import React, { useState, useMemo } from 'react';
import { Phone, Clock, ListChecks, Users, ChevronDown, ChevronUp, FileText, Send, Loader2, Copy, Check, MessageSquare, Mail } from 'lucide-react';
import { useMeetings } from '../../hooks/useMeetings';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { toastSuccess, toastError } from '../../lib/dashboardActions';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import FilterBar from './shared/FilterBar';
import type { MeetingTranscript } from '../../types/dashboard';

function parseItem(item: any): Record<string, any> {
  if (typeof item === 'string') {
    try { return JSON.parse(item); } catch { return { text: item }; }
  }
  return item || {};
}

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const ownerColors: Record<string, string> = {
  ivan: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  client: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  default: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/25',
};

function getOwnerStyle(owner: string): string {
  const lower = (owner || '').toLowerCase();
  if (lower.includes('ivan')) return ownerColors.ivan;
  if (lower.includes('client')) return ownerColors.client;
  return ownerColors.default;
}

const ActionItem: React.FC<{ item: any }> = ({ item }) => {
  const p = parseItem(item);
  const action = p.action || p.description || p.task || p.text || (typeof item === 'string' ? item : JSON.stringify(item));
  const owner = p.owner || '';
  const deadline = p.deadline;

  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded-md bg-zinc-800/40 border border-zinc-800/60">
      <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-zinc-300">{action}</p>
        <div className="flex items-center gap-2 mt-1">
          {owner && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getOwnerStyle(owner)}`}>
              {owner}
            </span>
          )}
          {deadline && (
            <span className="text-[10px] text-zinc-500">Due: {deadline}</span>
          )}
        </div>
      </div>
    </div>
  );
};

const TopicPill: React.FC<{ item: any }> = ({ item }) => {
  const p = parseItem(item);
  const title = p.title || p.topic || p.name || p.text || (typeof item === 'string' ? item : '');
  const isPost = p.is_post;
  const format = p.post_format;
  const status = p.status;

  const short = title.length > 80 ? title.slice(0, 77) + '...' : title;

  const statusStyle = status === 'POST-READY'
    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    : status === 'LEAD-MAGNET-READY'
      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      : 'bg-zinc-800 text-zinc-400 border-zinc-700/40';

  return (
    <div className={`text-[11px] px-2 py-1 rounded-md border ${statusStyle} flex items-center gap-1.5`}>
      {isPost && <MessageSquare className="w-3 h-3 flex-shrink-0" />}
      {!isPost && format && <FileText className="w-3 h-3 flex-shrink-0" />}
      <span className="truncate">{short}</span>
      {format && <span className="text-[9px] opacity-60 flex-shrink-0">{format}</span>}
    </div>
  );
};

const MeetingCard: React.FC<{ meeting: MeetingTranscript }> = ({ meeting }) => {
  const [expanded, setExpanded] = useState(false);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [copied, setCopied] = useState(false);

  const title = meeting.title.replace(/\s*\/\s*$/, ''); // remove trailing /

  const handleCreateProposal = async () => {
    setCreatingProposal(true);
    try {
      const res = await fetch('https://n8n.intelligents.agency/webhook/proposal-upwork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meeting.title,
          participants: meeting.participants,
          summary: meeting.summary || '',
          transcript: meeting.transcriptText || '',
          action_items: meeting.actionItems.map((a) => {
            const p = parseItem(a);
            return p.action || p.description || p.task || p.text || JSON.stringify(a);
          }),
          date: meeting.date,
          source: 'meetings_panel',
        }),
      });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
      toastSuccess('Proposal creation started');
    } catch (err) {
      toastError('create proposal', err);
    } finally {
      setCreatingProposal(false);
    }
  };

  const handleCopy = () => {
    const actions = meeting.actionItems.map((a) => {
      const p = parseItem(a);
      const text = p.action || p.description || p.task || p.text || JSON.stringify(a);
      return p.owner ? `- ${p.owner}: ${text}` : `- ${text}`;
    }).join('\n');
    const text = `Meeting: ${title}\nDate: ${formatDate(meeting.date)}\nParticipants: ${meeting.participants.join(', ')}\n\nSummary:\n${meeting.summary || 'N/A'}\n\nAction Items:\n${actions || 'None'}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const actionCount = meeting.actionItems.length;
  const topicCount = meeting.topics.length;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl overflow-hidden hover:border-zinc-700/60 transition-colors">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-100 truncate">{title}</h3>
            {meeting.durationMinutes > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 flex-shrink-0">
                {meeting.durationMinutes}m
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-zinc-500">
            <span>{formatDate(meeting.date)}</span>
            <span className="text-zinc-700">|</span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {meeting.participants.join(', ')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-3 flex-shrink-0">
          {actionCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {actionCount} action{actionCount > 1 ? 's' : ''}
            </span>
          )}
          {topicCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              {topicCount} topic{topicCount > 1 ? 's' : ''}
            </span>
          )}
          {expanded ? <ChevronUp className="w-4 h-4 text-zinc-500" /> : <ChevronDown className="w-4 h-4 text-zinc-500" />}
        </div>
      </div>

      {/* Summary preview (always visible) */}
      {meeting.summary && !expanded && (
        <div className="px-4 pb-3 -mt-1">
          <p className="text-xs text-zinc-500 line-clamp-2">{meeting.summary}</p>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-800/60">
          {/* Summary */}
          {meeting.summary && (
            <div className="px-4 py-3">
              <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Summary</h4>
              <p className="text-[13px] text-zinc-300 leading-relaxed">{meeting.summary}</p>
            </div>
          )}

          {/* Action Items */}
          {actionCount > 0 && (
            <div className="px-4 py-3 border-t border-zinc-800/40">
              <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ListChecks className="w-3.5 h-3.5" /> Action Items
              </h4>
              <div className="space-y-1.5">
                {meeting.actionItems.map((item, i) => (
                  <ActionItem key={i} item={item} />
                ))}
              </div>
            </div>
          )}

          {/* Topics */}
          {topicCount > 0 && (
            <div className="px-4 py-3 border-t border-zinc-800/40">
              <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Content Topics Extracted
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {meeting.topics.map((t, i) => (
                  <TopicPill key={i} item={t} />
                ))}
              </div>
            </div>
          )}

          {/* Follow-up Draft */}
          {meeting.followUpDraft && (
            <div className="px-4 py-3 border-t border-zinc-800/40">
              <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Follow-up Draft
              </h4>
              <div className="bg-zinc-800/40 rounded-lg p-3 border border-zinc-700/30">
                <p className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed">{meeting.followUpDraft}</p>
              </div>
            </div>
          )}

          {/* Transcript */}
          {meeting.transcriptText && (
            <details className="border-t border-zinc-800/40">
              <summary className="px-4 py-3 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-zinc-300 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Full Transcript
              </summary>
              <div className="px-4 pb-3">
                <pre className="text-xs text-zinc-500 whitespace-pre-wrap max-h-72 overflow-y-auto bg-zinc-950/80 rounded-lg p-3 border border-zinc-800/60 leading-relaxed">
                  {meeting.transcriptText}
                </pre>
              </div>
            </details>
          )}

          {/* Actions bar */}
          <div className="px-4 py-3 border-t border-zinc-800/40 flex gap-2 bg-zinc-900/80">
            <button
              onClick={handleCopy}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy Summary'}
            </button>
            <button
              onClick={handleCreateProposal}
              disabled={creatingProposal}
              className="text-[11px] px-3 py-1.5 rounded-lg bg-emerald-900/50 text-emerald-400 hover:text-emerald-200 hover:bg-emerald-800/50 border border-emerald-700/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {creatingProposal ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Creating...</>
              ) : (
                <><Send className="w-3 h-3" /> Create Proposal</>
              )}
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
        m.title.replace(/\s*\/\s*$/, '').toLowerCase().includes(q) ||
        m.participants.some((p) => p.toLowerCase().includes(q)) ||
        (m.summary && m.summary.toLowerCase().includes(q))
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
        searchPlaceholder="Search meetings, participants..."
      />

      <div className="space-y-3">
        {filtered.map((m) => (
          <MeetingCard key={m.id} meeting={m} />
        ))}
        {filtered.length === 0 && search && (
          <p className="text-sm text-zinc-500 text-center py-8">No meetings match &ldquo;{search}&rdquo;</p>
        )}
      </div>
    </div>
  );
};

export default MeetingsPanel;
