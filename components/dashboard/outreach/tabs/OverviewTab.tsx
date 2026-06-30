import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Radio, Briefcase, Flame, Snowflake, TrendingUp, MessageSquare } from 'lucide-react';
import { NextUpCard } from '../NextUpCard';
import type { OutreachProspect, FeedRollupRow, OutreachFeed, OutreachCampaign } from '../../../../types/dashboard';
import {
  FEED_ORDER, FEED_LABELS, FEED_DESC, FEED_BAR, FEED_TEXT,
  feedRollup, warmVsCold,
} from '../feedHelpers';
import { OutreachTimingHeatmap } from '../OutreachTimingHeatmap';

// ── Overview window constant ─────────────────────────────────────────────────
// Fixed campaign-start date. All overview KPI tiles (Active Pipeline, per-feed
// counts, Accept Rate, Reply Rate) use prospects whose createdAt >= this date.
const CAMPAIGN_START = '2026-06-25';

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
    className="rounded-xl p-3 flex items-start justify-between gap-2 transition-all duration-200 hover:border-indigo-300/60"
    style={{
      background: 'var(--ds-card, #fff)',
      border: '1px solid var(--ds-line, #e9e9ee)',
      boxShadow: 'var(--ds-shadow-card, 0 1px 2px rgba(15,23,42,.04),0 10px 26px -18px rgba(15,23,42,.18))',
    }}
  >
    <div className="flex-1 min-w-0">
      <span
        className="text-[10px] tracking-normal font-medium block mb-1"
        style={{ color: 'var(--ds-dim, #475569)' }}
      >
        {label}
      </span>
      <p
        className="text-[22px] font-bold tracking-tight leading-none tabular-nums"
        style={{ color: 'var(--ds-ink, #0f172a)' }}
      >
        {value}
      </p>
      {subValue && (
        <p
          className="text-[10px] mt-1"
          style={{ color: 'var(--ds-faint, #64748b)' }}
        >
          {subValue}
        </p>
      )}
    </div>
    <div
      className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${accentClass}`}
      style={{ background: 'var(--ds-bg, #f6f7f9)', border: '1px solid var(--ds-line, #e9e9ee)' }}
    >
      {icon}
    </div>
  </div>
);

interface Props {
  prospects: OutreachProspect[];
  hotDomains: Set<string>;
  campaigns: OutreachCampaign[];
  cappedQueue: { connection_request: number; dm: number; inmail: number };
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
  campaigns: _campaigns, // kept in Props for API compat; not used by the overview window
  cappedQueue,
  onPickFeed,
  onOpenProspect,
  onArchiveProspect,
  onResolveReply,
}) => {
  // KPI window: fixed campaign start (CAMPAIGN_START constant above).
  const windowStart = CAMPAIGN_START;

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

  return (
    <div className="space-y-4">
      {/* KPI row — light tiles, since CAMPAIGN_START */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
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
          {/* Window label — reflects CAMPAIGN_START constant */}
          <span className="text-[10px]" style={{ color: 'var(--ds-faint, #64748b)' }}>
            · since Jun 25
          </span>
          <div className="flex items-center gap-2.5 ml-auto flex-wrap">
            {FEED_ORDER.map((f) => (
              <div key={f} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-sm bg-gradient-to-t ${FEED_BAR[f]}`} />
                <span className={`text-[11px] font-medium ${FEED_TEXT[f]}`}>{FEED_LABELS[f]}</span>
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
                <div className="flex-1 h-7 bg-[var(--ds-bg)] ring-1 ring-inset ring-[var(--ds-line)] rounded-lg overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ type: 'spring', stiffness: 220, damping: 28, delay: i * 0.06 }}
                    className="h-full flex rounded-lg overflow-hidden divide-x divide-white/40"
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
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[var(--ds-ink)] tabular-nums pointer-events-none">{s.total}</span>
                </div>
                <span className={`text-[10px] font-medium w-12 shrink-0 ${conv == null ? 'text-transparent' : conv >= 50 ? 'text-emerald-700' : conv >= 20 ? 'text-amber-700' : 'text-red-700'}`}>
                  {conv == null ? '—' : `${conv}%`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timing heatmap — best day/slot to send, by metric */}
      <OutreachTimingHeatmap />

      {/* Change 6: NextUpCard is THIRD (moved down from top) */}
      <NextUpCard
        prospects={prospects}
        cappedQueue={cappedQueue}
        onOpen={onOpenProspect}
        onArchive={onArchiveProspect}
        onResolve={onResolveReply}
      />

    </div>
  );
};

