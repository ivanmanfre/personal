import React, { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import { Eye, Users, Link2, Smartphone, MapPin } from 'lucide-react';
import { useAudience } from '../../hooks/useAudience';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import StatCard from './shared/StatCard';
import LoadingSkeleton from './shared/LoadingSkeleton';
import RefreshIndicator from './shared/RefreshIndicator';
import EmptyState from './shared/EmptyState';

const tooltipStyle = {
  backgroundColor: '#18181b',
  border: '1px solid rgba(63, 63, 70, 0.6)',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  padding: '8px 12px',
};

const DEVICE_COLORS: Record<string, string> = {
  desktop: '#22c55e',
  mobile: '#3b82f6',
  tablet: '#f59e0b',
  unknown: '#71717a',
};

function pctChange(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function formatDay(iso: string): string {
  try {
    const d = new Date(iso + 'T00:00:00Z');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex-1 h-1.5 bg-zinc-800/70 rounded-full overflow-hidden">
      <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

const AudiencePanel: React.FC = () => {
  const { data, totals, loading, refresh } = useAudience();
  const { lastRefreshed } = useAutoRefresh(refresh);

  const chartData = useMemo(
    () => data.daily.slice(-30).map((d) => ({ ...d, label: formatDay(d.day) })),
    [data.daily]
  );

  const maxPathViews = useMemo(
    () => data.topPaths.reduce((m, p) => Math.max(m, p.views), 0),
    [data.topPaths]
  );
  const maxRefViews = useMemo(
    () => data.topReferrers.reduce((m, r) => Math.max(m, r.views), 0),
    [data.topReferrers]
  );

  const deviceData = useMemo(
    () => data.deviceSplit.map((d) => ({ name: d.deviceType, value: d.views })),
    [data.deviceSplit]
  );

  if (loading) return <LoadingSkeleton cards={4} rows={6} />;

  const hasAnyData = data.daily.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audience</h1>
          <p className="text-sm text-zinc-500 mt-1">Pageviews, visitors, and traffic sources for ivanmanfredi.com.</p>
        </div>
        <RefreshIndicator lastRefreshed={lastRefreshed} onRefresh={refresh} />
      </div>

      {!hasAnyData ? (
        <EmptyState
          title="No pageviews yet"
          description="Tracking just went live. Open the site in a new tab — data will flow in within seconds."
          icon={<Eye className="w-10 h-10" />}
        />
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Visitors · 30d"
              value={totals.visitors30}
              icon={<Users className="w-5 h-5" />}
              color="text-emerald-400"
              trend={{ value: pctChange(totals.visitors30, totals.visitorsPrev30), label: 'vs prev 30d' }}
            />
            <StatCard
              label="Pageviews · 30d"
              value={totals.views30}
              icon={<Eye className="w-5 h-5" />}
              color="text-blue-400"
              trend={{ value: pctChange(totals.views30, totals.viewsPrev30), label: 'vs prev 30d' }}
            />
            <StatCard
              label="Visitors today"
              value={totals.visitorsToday}
              icon={<Users className="w-5 h-5" />}
              color="text-zinc-300"
              subValue={`Yesterday: ${totals.visitorsYesterday}`}
            />
            <StatCard
              label="Pageviews today"
              value={totals.viewsToday}
              icon={<Eye className="w-5 h-5" />}
              color="text-zinc-300"
              subValue={`Yesterday: ${totals.viewsYesterday}`}
            />
          </div>

          {/* Time-series chart */}
          <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4 pt-5">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em]">Last 30 days</h3>
              <span className="text-[11px] text-zinc-500">Visitors (emerald) · Views (blue)</span>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="audVis" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="audViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(39, 39, 42, 0.6)" />
                <XAxis dataKey="label" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#a1a1aa', fontSize: 12 }} itemStyle={{ color: '#e4e4e7', fontSize: 12 }} />
                <Area type="monotone" dataKey="views" name="Views" stroke="#3b82f6" fill="url(#audViews)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="visitors" name="Visitors" stroke="#22c55e" fill="url(#audVis)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top paths */}
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em] mb-4 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5" /> Top pages · 30d
              </h3>
              {data.topPaths.length === 0 ? (
                <p className="text-zinc-600 text-sm">No data</p>
              ) : (
                <div className="space-y-2.5">
                  {data.topPaths.slice(0, 12).map((p) => (
                    <div key={p.path} className="flex items-center gap-3 text-xs">
                      <code className="w-40 shrink-0 truncate text-zinc-300 font-mono" title={p.path}>{p.path}</code>
                      <Bar value={p.views} max={maxPathViews} />
                      <span className="w-14 text-right tabular-nums text-zinc-400">{p.views.toLocaleString()}</span>
                      <span className="w-12 text-right tabular-nums text-zinc-600 text-[11px]">{p.visitors.toLocaleString()}u</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top referrers */}
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em] mb-4 flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" /> Top referrers · 30d
              </h3>
              {data.topReferrers.length === 0 ? (
                <p className="text-zinc-600 text-sm">No data</p>
              ) : (
                <div className="space-y-2.5">
                  {data.topReferrers.slice(0, 12).map((r) => (
                    <div key={r.referrerHost} className="flex items-center gap-3 text-xs">
                      <span className="w-40 shrink-0 truncate text-zinc-300" title={r.referrerHost}>{r.referrerHost}</span>
                      <Bar value={r.views} max={maxRefViews} />
                      <span className="w-14 text-right tabular-nums text-zinc-400">{r.views.toLocaleString()}</span>
                      <span className="w-12 text-right tabular-nums text-zinc-600 text-[11px]">{r.visitors.toLocaleString()}u</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Device split */}
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em] mb-4 flex items-center gap-2">
                <Smartphone className="w-3.5 h-3.5" /> Devices · 30d
              </h3>
              {deviceData.length === 0 ? (
                <p className="text-zinc-600 text-sm">No data</p>
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={140} height={140}>
                    <PieChart>
                      <Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} innerRadius={32} strokeWidth={0}>
                        {deviceData.map((d, i) => (
                          <Cell key={i} fill={DEVICE_COLORS[d.name] || '#71717a'} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2.5">
                    {data.deviceSplit.map((d) => (
                      <div key={d.deviceType} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: DEVICE_COLORS[d.deviceType] || '#71717a' }} />
                        <span className="text-zinc-400 capitalize w-16">{d.deviceType}</span>
                        <span className="tabular-nums text-zinc-300">{d.views.toLocaleString()}</span>
                        <span className="text-zinc-600">·</span>
                        <span className="tabular-nums text-zinc-500">{d.visitors.toLocaleString()} visitors</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* UTM campaigns */}
            <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-[0.12em] mb-4">UTM campaigns · 30d</h3>
              {data.topUtm.length === 0 ? (
                <p className="text-zinc-600 text-sm">Tag links with <code className="text-zinc-400">?utm_source=…</code> to see campaign performance here.</p>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {data.topUtm.slice(0, 15).map((u, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-xs border-b border-zinc-800/60 pb-1.5 last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-zinc-300 truncate">
                          <span className="text-emerald-400">{u.utmSource || '—'}</span>
                          {u.utmMedium && <span className="text-zinc-500"> · {u.utmMedium}</span>}
                        </div>
                        {u.utmCampaign && <div className="text-[11px] text-zinc-500 truncate">{u.utmCampaign}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="tabular-nums text-zinc-300">{u.views.toLocaleString()}</div>
                        <div className="text-[11px] text-zinc-600 tabular-nums">{u.visitors.toLocaleString()}u</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AudiencePanel;
