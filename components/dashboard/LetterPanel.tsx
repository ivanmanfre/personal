import React, { useMemo } from 'react';
import { Mail, Eye, UserMinus, Clock } from 'lucide-react';
import { useNewsletter } from '../../hooks/useNewsletter';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';

function pctChange(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  sent: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  skipped: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  cancelled: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const eventStyles: Record<string, string> = {
  delivered: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  opened: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  clicked: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  bounced: 'bg-red-500/15 text-red-400 border-red-500/30',
  complained: 'bg-red-500/15 text-red-400 border-red-500/30',
  unsubscribed: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

const LetterPanel: React.FC = () => {
  const { data, totals, loading, refresh } = useNewsletter();
  const { lastRefreshed } = useAutoRefresh(refresh);

  const hasAny = useMemo(
    () =>
      data.subscribers.length > 0 ||
      data.captures.length > 0 ||
      data.performance.some((p) => p.subscribersTotal > 0),
    [data]
  );

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">The Letter</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Newsletter subscribers, queue, sequence performance, and Resend events.
          </p>
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {!hasAny ? (
        <EmptyState
          title="No subscribers yet"
          description="Once someone signs up via the footer form, they'll appear here within seconds. Open ivanmanfredi.com#newsletter to test."
          icon={<Mail className="w-10 h-10" />}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Active subscribers"
              value={totals.activeSubs}
              icon={<Mail className="w-5 h-5" />}
              color="text-emerald-400"
              trend={{ value: pctChange(totals.subs30d, totals.subsPrev30d), label: 'vs prev 30d' }}
              subValue={`+${totals.subs7d} last 7d`}
            />
            <StatCard
              label="Queue"
              value={totals.pending}
              icon={<Clock className="w-5 h-5" />}
              color={totals.failed > 0 ? 'text-amber-400' : 'text-blue-400'}
              subValue={totals.failed > 0 ? `${totals.failed} failed` : 'pending sends'}
            />
            <StatCard
              label="Open rate · 7d"
              value={`${totals.openRate7d}%`}
              icon={<Eye className="w-5 h-5" />}
              color="text-blue-400"
              subValue={`${totals.opened7d} of ${totals.delivered7d} delivered`}
            />
            <StatCard
              label="Unsubs · 30d"
              value={totals.unsubs30d}
              icon={<UserMinus className="w-5 h-5" />}
              color="text-zinc-300"
              subValue={`${totals.captures7d} signups · 7d`}
            />
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 shadow-sm shadow-black/10">
            <h2 className="text-sm font-bold text-zinc-300 mb-4">Sequences</h2>
            {data.performance.length === 0 ? (
              <p className="text-xs text-zinc-500">No sequence data yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="px-2 py-2 font-medium">Sequence</th>
                      <th className="px-2 py-2 font-medium text-right">Subs</th>
                      <th className="px-2 py-2 font-medium text-right">Unsubs</th>
                      <th className="px-2 py-2 font-medium text-right">Sent</th>
                      <th className="px-2 py-2 font-medium text-right">Failed</th>
                      <th className="px-2 py-2 font-medium text-right">Opens</th>
                      <th className="px-2 py-2 font-medium text-right">Clicks</th>
                      <th className="px-2 py-2 font-medium text-right">Bounces</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.performance.map((p) => (
                      <tr key={p.slug} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-2 py-2.5 text-zinc-200">{p.name}</td>
                        <td className="px-2 py-2.5 text-right text-zinc-300">{p.subscribersTotal}</td>
                        <td className="px-2 py-2.5 text-right text-zinc-500">{p.unsubscribed}</td>
                        <td className="px-2 py-2.5 text-right text-zinc-300">{p.emailsSent}</td>
                        <td className="px-2 py-2.5 text-right text-red-400">{p.emailsFailed || '—'}</td>
                        <td className="px-2 py-2.5 text-right text-emerald-400">{p.opens}</td>
                        <td className="px-2 py-2.5 text-right text-purple-400">{p.clicks}</td>
                        <td className="px-2 py-2.5 text-right text-red-400">{p.bounces || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 shadow-sm shadow-black/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-300">Queue</h2>
                <span className="text-[11px] text-zinc-500">{data.queue.length} recent</span>
              </div>
              {data.queue.length === 0 ? (
                <p className="text-xs text-zinc-500">Nothing in the queue.</p>
              ) : (
                <ul className="divide-y divide-zinc-800/60 -mx-1">
                  {data.queue.slice(0, 12).map((q) => (
                    <li key={q.id} className="px-1 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-200 truncate">{q.subscriberEmail || '—'}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {q.sentAt ? `Sent ${relTime(q.sentAt)}` : `Scheduled ${fmtDate(q.scheduledFor)}`}
                        </p>
                        {q.errorMessage && (
                          <p className="text-[11px] text-red-400 mt-0.5 truncate">{q.errorMessage}</p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${
                          statusStyles[q.status] || statusStyles.skipped
                        }`}
                      >
                        {q.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 shadow-sm shadow-black/10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-zinc-300">Recent events</h2>
                <span className="text-[11px] text-zinc-500">{data.events.length}</span>
              </div>
              {data.events.length === 0 ? (
                <p className="text-xs text-zinc-500">No events yet — Resend webhook will populate this.</p>
              ) : (
                <ul className="divide-y divide-zinc-800/60 -mx-1 max-h-[320px] overflow-y-auto">
                  {data.events.slice(0, 30).map((e) => (
                    <li key={e.id} className="px-1 py-2 flex items-center justify-between gap-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${
                          eventStyles[e.eventType] || eventStyles.delivered
                        }`}
                      >
                        {e.eventType}
                      </span>
                      <span className="text-[11px] text-zinc-500">{relTime(e.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 shadow-sm shadow-black/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-300">Subscribers</h2>
              <span className="text-[11px] text-zinc-500">{data.subscribers.length} shown</span>
            </div>
            {data.subscribers.length === 0 ? (
              <p className="text-xs text-zinc-500">No subscribers yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-800">
                      <th className="px-2 py-2 font-medium">Email</th>
                      <th className="px-2 py-2 font-medium">Sequence</th>
                      <th className="px-2 py-2 font-medium text-right">Step</th>
                      <th className="px-2 py-2 font-medium">Joined</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.subscribers.map((s) => (
                      <tr key={s.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="px-2 py-2.5 text-zinc-200 truncate max-w-[240px]">{s.email}</td>
                        <td className="px-2 py-2.5 text-zinc-400">{s.lmTitle || s.lmSlug || '—'}</td>
                        <td className="px-2 py-2.5 text-right text-zinc-300">{s.currentStep}</td>
                        <td className="px-2 py-2.5 text-zinc-500">{fmtDate(s.createdAt)}</td>
                        <td className="px-2 py-2.5">
                          {s.unsubscribedAt ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-zinc-500/15 text-zinc-400 border-zinc-500/30 uppercase tracking-wide">
                              unsubscribed
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 uppercase tracking-wide">
                              active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl p-5 shadow-sm shadow-black/10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-300">Form captures</h2>
              <span className="text-[11px] text-zinc-500">{data.captures.length} recent</span>
            </div>
            {data.captures.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No form captures yet — submit the footer form on ivanmanfredi.com to confirm wiring.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-800/60 -mx-1">
                {data.captures.slice(0, 20).map((c) => (
                  <li key={c.id} className="px-1 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-zinc-200 truncate">{c.email || '—'}</p>
                      <p className="text-[11px] text-zinc-500">{c.src || 'unknown source'}</p>
                    </div>
                    <span className="text-[11px] text-zinc-500 shrink-0">{relTime(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default LetterPanel;
