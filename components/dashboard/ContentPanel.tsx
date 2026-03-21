import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, FileText, ChevronLeft, ChevronRight, Image, Clock, ArrowRight, AlertTriangle, Send } from 'lucide-react';
import { useContentPipeline } from '../../hooks/useContentPipeline';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';
import PanelCard from './shared/PanelCard';

const statusColors: Record<string, string> = {
  pending: 'bg-amber-500 border-amber-600',
  posting: 'bg-cyan-500 border-cyan-600',
  posted: 'bg-emerald-500 border-emerald-600',
  failed: 'bg-red-500 border-red-600',
};

const statusBadgeColors: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  posting: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  posted: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const days: { date: Date; inMonth: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), inMonth: false });
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), inMonth: true });
  }

  while (days.length < 42) {
    const d = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1);
    days.push({ date: d, inMonth: false });
  }

  return days;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function useCountdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Now';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 24) { const d = Math.floor(h / 24); return `${d}d ${h % 24}h`; }
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const ContentPanel: React.FC = () => {
  const { posts, statusCounts, postsByDate, loading, refresh } = useContentPipeline();
  const { lastRefreshed } = useAutoRefresh(refresh, { realtimeTables: ['scheduled_posts'] });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<string>('all');
  const now = useCountdown();

  const upcomingQueue = useMemo(() => {
    return posts
      .filter((p) => new Date(p.scheduledAt).getTime() > now && p.status === 'pending')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
      .slice(0, 5);
  }, [posts, now]);

  if (loading) return <LoadingSkeleton cards={4} rows={8} />;

  if (posts.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Content</h1>
          <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
        </div>
        <EmptyState title="No scheduled posts" description="Posts scheduled via the content pipeline will appear here." icon={<Calendar className="w-10 h-10" />} />
      </div>
    );
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthDays = getMonthDays(year, month);
  const today = new Date().toISOString().split('T')[0];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const pendingCount = statusCounts['pending'] || 0;
  const postedCount = statusCounts['posted'] || 0;
  const failedCount = statusCounts['failed'] || 0;

  const filteredList = filter === 'all'
    ? posts
    : posts.filter((p) => p.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Content</h1>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Posts" value={posts.length} icon={<FileText className="w-5 h-5" />} color="text-blue-400" />
        <StatCard label="Pending" value={pendingCount} icon={<Clock className="w-5 h-5" />} color="text-amber-400" />
        <StatCard label="Posted" value={postedCount} icon={<Send className="w-5 h-5" />} color="text-emerald-400" />
        <StatCard label="Failed" value={failedCount} icon={<AlertTriangle className="w-5 h-5" />} color="text-red-400" />
      </div>

      {/* Publishing Queue */}
      {upcomingQueue.length > 0 && (
        <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Publishing Queue</span>
          </div>
          <div className="space-y-2">
            {upcomingQueue.map((p, i) => {
              const ms = new Date(p.scheduledAt).getTime() - now;
              const isNext = i === 0;
              return (
                <div key={p.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isNext ? 'bg-cyan-500/5 border border-cyan-500/15' : 'bg-zinc-800/30'}`}>
                  <div className={`shrink-0 text-right w-16 ${isNext ? 'text-cyan-400' : 'text-zinc-500'}`}>
                    <span className="text-sm font-bold">{formatCountdown(ms)}</span>
                  </div>
                  <ArrowRight className={`w-3 h-3 shrink-0 ${isNext ? 'text-cyan-400/60' : 'text-zinc-700'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isNext ? 'text-zinc-200 font-medium' : 'text-zinc-400'}`}>{p.postText.slice(0, 80)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-zinc-600">
                        {new Date(p.scheduledAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {formatTime(p.scheduledAt)}
                      </span>
                      {p.postFormat && <span className="text-[10px] text-zinc-600 bg-zinc-800/60 px-1 py-0.5 rounded">{p.postFormat}</span>}
                      {p.mediaUrls.length > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-zinc-600">
                          <Image className="w-3 h-3" />{p.mediaUrls.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`shrink-0 w-2 h-2 rounded-full ${statusColors[p.status]?.split(' ')[0] || 'bg-zinc-600'}`} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl overflow-hidden shadow-sm shadow-black/10">
        <div className="px-4 py-3.5 border-b border-zinc-800/40 bg-zinc-800/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-3.5 h-3.5 text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-300">
              {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={goToday} className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-colors">Today</button>
            <button onClick={prevMonth} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700/60 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={nextMonth} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-700/60 transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="p-3">
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] text-zinc-600 font-medium py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-zinc-800/30 rounded-lg overflow-hidden">
            {monthDays.map(({ date, inMonth }, i) => {
              const dateKey = date.toISOString().split('T')[0];
              const dayPosts = postsByDate[dateKey] || [];
              const isToday = dateKey === today;

              return (
                <div
                  key={i}
                  className={`min-h-[48px] sm:min-h-[80px] p-1 sm:p-1.5 transition-colors ${
                    inMonth ? 'bg-zinc-900/60' : 'bg-zinc-950/40'
                  } ${isToday ? 'ring-1 ring-emerald-500/40 ring-inset' : ''}`}
                >
                  <div className={`text-[11px] font-medium mb-1 ${
                    isToday ? 'text-emerald-400' : inMonth ? 'text-zinc-400' : 'text-zinc-700'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-0.5 hidden sm:block">
                    {dayPosts.slice(0, 3).map((p) => (
                      <div
                        key={p.id}
                        className={`px-1 py-0.5 rounded text-[10px] truncate border-l-2 bg-zinc-800/60 text-zinc-300 ${
                          statusColors[p.status] || 'border-zinc-600'
                        }`}
                        title={`${p.postText.slice(0, 80)} (${p.status}) @ ${formatTime(p.scheduledAt)}`}
                      >
                        {formatTime(p.scheduledAt)}{p.postFormat ? ` · ${p.postFormat}` : ''}
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <div className="text-[10px] text-zinc-600 px-1">+{dayPosts.length - 3} more</div>
                    )}
                  </div>
                  {/* Mobile: dot indicators */}
                  {dayPosts.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 sm:hidden">
                      {dayPosts.slice(0, 3).map((p) => (
                        <div key={p.id} className={`w-1.5 h-1.5 rounded-full ${statusColors[p.status]?.split(' ')[0] || 'bg-zinc-600'}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === 'all' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
          }`}
        >
          All ({posts.length})
        </button>
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            onClick={() => setFilter(filter === status ? 'all' : status)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === status ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <div className={`w-2 h-2 rounded-sm ${statusColors[status]?.split(' ')[0] || 'bg-zinc-600'}`} />
            {status} ({count})
          </button>
        ))}
      </div>

      {/* Posts list */}
      <PanelCard title={filter === 'all' ? 'All Posts' : filter} icon={<FileText className="w-3.5 h-3.5" />} badge={filteredList.length}>
        <div className="divide-y divide-zinc-800/40">
          {filteredList.length === 0 ? (
            <div className="px-4 py-8 text-zinc-600 text-sm text-center">No posts match filter</div>
          ) : (
            filteredList.map((post) => (
              <div key={post.id} className="px-4 py-3 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors">
                <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${statusColors[post.status]?.split(' ')[0] || 'bg-zinc-600'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-300 line-clamp-2">{post.postText}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${statusBadgeColors[post.status] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}`}>
                      {post.status}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {new Date(post.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {formatTime(post.scheduledAt)}
                    </span>
                    {post.postFormat && (
                      <span className="text-[11px] text-zinc-500 bg-zinc-800/60 px-1.5 py-0.5 rounded">{post.postFormat}</span>
                    )}
                    {post.mediaUrls.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                        <Image className="w-3 h-3" /> {post.mediaUrls.length} media
                      </span>
                    )}
                    {post.errorMessage && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-red-400">
                        <AlertTriangle className="w-3 h-3" /> {post.errorMessage.slice(0, 50)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PanelCard>
    </div>
  );
};

export default ContentPanel;
