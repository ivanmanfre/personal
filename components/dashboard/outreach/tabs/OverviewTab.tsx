import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Radio, Briefcase, Flame, Snowflake, TrendingUp, MessageSquare } from 'lucide-react';
import { NextUpCard } from '../NextUpCard';
import type { OutreachProspect, FeedRollupRow, OutreachFeed, OutreachCampaign } from '../../../../types/dashboard';
import {
  FEED_ORDER, FEED_LABELS, FEED_DESC, FEED_BADGE, FEED_BAR, FEED_TEXT,
  feedRollup, warmVsCold,
} from '../feedHelpers';

// ── Overview window constant ─────────────────────────────────────────────────
// Change this to expand or contract the KPI window. All overview KPI tiles
// (Active Pipeline, per-feed counts, Accept Rate, Reply Rate) use prospects
// whose createdAt falls within the last WINDOW_DAYS calendar days.
const WINDOW_DAYS = 3;

// ── Light KPI tile ───────────────────────────────────────────────────────────
// Local light-theme variant — only used in this Overview's KPI row.
// Intentionally NOT the shared dark StatCard; that card is used on dark panels.
interface LightKpiTileProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  /** Tailwind text-color class for the icon badge, e.g. "text-indigo-600" */
  accentClass?: string;
  subValue?: string;
}

const LightKpiTile: React.FC<LightKpiTileProps> = ({ label, value, icon, accentClass = 'text-indigo-600', subValue }) => (
  <div
    className="rounded-xl p-4 flex items-start justify-between gap-3 transition-all duration-200 hover:border-indigo-300/60"
    style={{
      background: 'var(--ds-card, #fff)',
      border: '1px solid var(--ds-line, #e9e9ee)',
      boxShadow: 'var(--ds-shadow-card, 0 1px 2px rgba(15,23,42,.04),0 10px 26px -18px rgba(15,23,42,.18))',
    }}
  >
    <div className="flex-1 min-w-0">
      <span
        className="text-[11px] tracking-normal font-medium block mb-2"
        style={{ color: 'var(--ds-dim, #475569)' }}
      >
        {label}
      </span>
      <p
        className="text-[26px] font-bold tracking-tight leading-none tabular-nums"
        style={{ color: 'var(--ds-ink, #0f172a)' }}
      >
        {value}
      </p>
      {subValue && (
        <p
          className="text-[11px] mt-2"
          style={{ color: 'var(--ds-faint, #64748b)' }}
        >
          {subValue}
        </p>
      )}
    </div>
    <div
      className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${accentClass}`}
      style={{ background: 'var(--ds-bg, #f6f7f9)', border: '1px solid var(--ds-line, #e9e9ee)' }}
    >
      {icon}
    </div>
  </div>
);

interface Props {
  prospects: OutreachProspect[];
  hotDomains: Set<string>;
  bandsTotal: number;
  bandsHot: number;
  campaigns: OutreachCampaign[];
  cappedQueue: { connection_request: number; dm: number };
  onPickFeed?: (feed: OutreachFeed) => void;
  onOpenProspect: (p: OutreachProspect) => void;
  onArchiveProspect: (id: string, reason?: string) => void;
  onResolveReply: (id: string) => void;
}

const feedIcon: Record<OutreachFeed, React.ReactNode> = {
  cold: <Snowflake className="w-5 h-5" />,
  harvest: <Radio className="w-5 h-5" />,
  hiring: <Briefcase className="w-5 h-5" />,
  hot: <Flame className="w-5 h-5" />,
};

// Icon accent classes for the LightKpiTile badge — AA+ on white/light-bg
const feedAccent: Record<OutreachFeed, string> = {
  cold:    'text-slate-500',
  harvest: 'text-blue-600',
  hiring:  'text-amber-600',
  hot:     'text-emerald-600',
};

// The top-level cross-feed funnel. Source-attributed: each stacked segment shows
// the feed mix entering that stage. Built with Tailwind + Framer Motion (no chart lib).
const FUNNEL_STAGES: { key: keyof FeedRollupRow; label: string }[] = [
  { key: 'total', label: 'In pipeline' },
  { key: 'connectionSent', label: 'Conn. sent' },
  { key: 'connected', label: 'Accepted' },
  { key: 'dmSent', label: 'DM sent' },
  { key: 'replied', label: 'Replied' },
];

export const OverviewTab: React.FC<Props> = ({
  prospects,
  hotDomains,
  bandsTotal,
  bandsHot,
  campaigns: _campaigns, // kept in Props for API compat; not used by the 3-day window
  cappedQueue,
  onPickFeed,
  onOpenProspect,
  onArchiveProspect,
  onResolveReply,
}) => {
  // KPI window: last WINDOW_DAYS days (rolling, not campaign-start-based).
  // Using a stable ISO string avoids unnecessary re-renders on each render cycle.
  const windowStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - WINDOW_DAYS);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally computed once per mount

  const windowedProspects = useMemo(
    () => prospects.filter((p) => p.createdAt >= windowStart),
    [prospects, windowStart],
  );

  // Use windowedProspects for KPIs, funnel, and accept/reply rates
  const rows = useMemo(() => feedRollup(windowedProspects, hotDomains), [windowedProspects, hotDomains]);
  const byFeed = useMemo(() => {
    const m = new Map<OutreachFeed, FeedRollupRow>();
    rows.forEach((r) => m.set(r.feed, r));
    return m;
  }, [rows]);
  const wvc = useMemo(() => warmVsCold(rows), [rows]);

  const totalActive = rows.reduce((a, r) => a + r.total, 0);

  // Stage totals across all feeds (for funnel widths) + per-feed segment splits.
  const stageData = useMemo(() => FUNNEL_STAGES.map((s) => {
    const segments = FEED_ORDER.map((f) => ({ feed: f, value: (byFeed.get(f)?.[s.key] as number) || 0 }));
    const total = segments.reduce((a, x) => a + x.value, 0);
    return { ...s, total, segments };
  }), [byFeed]);
  const funnelMax = Math.max(...stageData.map((s) => s.total), 1);

  // Change 2: Accept Rate and Reply Rate derived from windowed wvc data
  const totalAccepted = wvc.warmConnected + wvc.coldConnected;
  const totalConnSent = wvc.warmConnSent + wvc.coldConnSent;
  const totalReplied = wvc.warmReplied + wvc.coldReplied;
  const totalDmSent = wvc.warmDmSent + wvc.coldDmSent;

  const acceptRateVal = totalConnSent > 0 ? (totalAccepted / totalConnSent) * 100 : null;
  const replyRateVal = totalDmSent > 0 ? (totalReplied / totalDmSent) * 100 : null;

  const acceptRateDisplay = acceptRateVal != null ? `${acceptRateVal.toFixed(1)}%` : '—';
  const replyRateDisplay = replyRateVal != null ? `${replyRateVal.toFixed(1)}%` : '—';

  // "Conversion by Source" uses all prospects (not windowed) to retain statistical signal
  const allRows = useMemo(() => feedRollup(prospects, hotDomains), [prospects, hotDomains]);
  const allByFeed = useMemo(() => {
    const m = new Map<OutreachFeed, FeedRollupRow>();
    allRows.forEach((r) => m.set(r.feed, r));
    return m;
  }, [allRows]);

  return (
    <div className="space-y-4">
      {/* KPI row — light tiles, last WINDOW_DAYS days window */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <LightKpiTile
          label="Active Pipeline"
          value={totalActive}
          icon={<Users className="w-5 h-5" />}
          accentClass="text-indigo-600"
          subValue="across all feeds"
        />
        {FEED_ORDER.map((f) => {
          const r = byFeed.get(f);
          return (
            <LightKpiTile
              key={f}
              label={FEED_LABELS[f]}
              value={r?.total ?? 0}
              icon={feedIcon[f]}
              accentClass={feedAccent[f]}
              subValue={FEED_DESC[f]}
            />
          );
        })}
        {/* Accept Rate tile */}
        <LightKpiTile
          label="Accept Rate"
          value={acceptRateDisplay}
          icon={<TrendingUp className="w-5 h-5" />}
          accentClass="text-emerald-600"
          subValue={`${totalAccepted}/${totalConnSent} accepted`}
        />
        {/* Reply Rate tile */}
        <LightKpiTile
          label="Reply Rate"
          value={replyRateDisplay}
          icon={<MessageSquare className="w-5 h-5" />}
          accentClass="text-blue-600"
          subValue={`${totalReplied}/${totalDmSent} replied`}
        />
      </div>

      {/* Change 6: Cross-feed funnel is SECOND */}
      {/* Cross-feed funnel — source-attributed */}
      <div className="panel-surface shadow-sm shadow-black/10 p-4">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">All-Feeds Funnel</span>
          <span className="text-[10px] text-zinc-600">{totalActive} in pipeline → {totalReplied} replied</span>
          {/* Window label — reflects WINDOW_DAYS constant */}
          <span className="text-[10px]" style={{ color: 'var(--ds-faint, #64748b)' }}>
            · last {WINDOW_DAYS} days
          </span>
          <div className="flex items-center gap-2.5 ml-auto flex-wrap">
            {FEED_ORDER.map((f) => (
              <div key={f} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm bg-gradient-to-t ${FEED_BAR[f]}`} />
                <span className={`text-[9px] ${FEED_TEXT[f]}`}>{FEED_LABELS[f]}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2.5">
          {stageData.map((s, i) => {
            const widthPct = Math.max((s.total / funnelMax) * 100, s.total > 0 ? 4 : 1.5);
            const prev = i > 0 ? stageData[i - 1].total : null;
            const conv = prev && prev > 0 ? Math.round((s.total / prev) * 100) : null;
            return (
              <div key={String(s.key)} className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500 w-24 shrink-0 text-right">{s.label}</span>
                <div className="flex-1 h-7 bg-zinc-950/70 ring-1 ring-inset ring-zinc-800/60 rounded-lg overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ type: 'spring', stiffness: 220, damping: 28, delay: i * 0.06 }}
                    className="h-full flex rounded-lg overflow-hidden divide-x divide-zinc-950/40"
                  >
                    {s.segments.filter((seg) => seg.value > 0).map((seg) => {
                      const segPct = s.total > 0 ? (seg.value / s.total) * 100 : 0;
                      return (
                        <div
                          key={seg.feed}
                          className={`h-full bg-gradient-to-t ${FEED_BAR[seg.feed]} ${onPickFeed ? 'cursor-pointer hover:brightness-110' : ''}`}
                          style={{ width: `${segPct}%` }}
                          title={`${FEED_LABELS[seg.feed]}: ${seg.value}`}
                          onClick={() => onPickFeed?.(seg.feed)}
                        />
                      );
                    })}
                  </motion.div>
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-zinc-100 tabular-nums pointer-events-none drop-shadow">{s.total}</span>
                </div>
                <span className={`text-[10px] w-12 shrink-0 ${conv == null ? 'text-transparent' : conv >= 50 ? 'text-emerald-400/80' : conv >= 20 ? 'text-amber-400/80' : 'text-red-400/80'}`}>
                  {conv == null ? '—' : `${conv}%`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Change 6: NextUpCard is THIRD (moved down from top) */}
      <NextUpCard
        prospects={prospects}
        cappedQueue={cappedQueue}
        onOpen={onOpenProspect}
        onArchive={onArchiveProspect}
        onResolve={onResolveReply}
      />

      {/* Change 6: Conversion by Source is LAST */}
      {/* Uses all prospects (not windowed) for statistical signal */}
      <div className="panel-surface shadow-sm shadow-black/10 p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Conversion by Source</span>
          <span className="text-[10px] text-zinc-600">accept (invite→conn) · reply (DM→reply)</span>
        </div>
        <div className="space-y-3.5">
          {FEED_ORDER.map((f) => {
            const r = allByFeed.get(f)!;
            const acceptN = r.connectionSent;
            const replyN = r.dmSent;
            return (
              <div key={f} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${FEED_BADGE[f]}`}>{FEED_LABELS[f]}</span>
                  <span className="text-[10px] text-zinc-600">{r.total} prospects</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <RateBar label="Accept" rate={r.acceptRate} denom={acceptN} num={r.connected} feed={f} signalMin={8} />
                  <RateBar label="Reply" rate={r.replyRate} denom={replyN} num={r.replied} feed={f} signalMin={8} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-zinc-600 mt-4 leading-relaxed">
          Harvest &amp; Hiring feeds just launched — most conversion numbers are near-zero until invites land and accepts roll in over the coming days.
          {bandsTotal > 0 && <> Intent screen has flagged <span className="text-emerald-400">{bandsHot}</span> hot domain{bandsHot === 1 ? '' : 's'} of {bandsTotal} screened.</>}
        </p>
      </div>
    </div>
  );
};

const RateBar: React.FC<{ label: string; rate: number; denom: number; num: number; feed: OutreachFeed; signalMin: number }> = ({ label, rate, denom, num, feed, signalMin }) => {
  const signal = denom >= signalMin;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-zinc-500 w-10 shrink-0">{label}</span>
      <div className="flex-1 h-3.5 bg-zinc-950/70 ring-1 ring-inset ring-zinc-800/60 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(rate, 100)}%` }}
          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          className={`h-full rounded-full bg-gradient-to-t ${FEED_BAR[feed]}`}
          style={{ minWidth: rate > 0 ? 3 : 0 }}
        />
      </div>
      <span className={`text-[10px] font-medium w-10 text-right tabular-nums ${signal ? FEED_TEXT[feed] : 'text-zinc-600'}`}>
        {signal ? `${rate}%` : '—'}
      </span>
      <span className="text-[9px] text-zinc-600 w-10 text-right">{num}/{denom}</span>
    </div>
  );
};
