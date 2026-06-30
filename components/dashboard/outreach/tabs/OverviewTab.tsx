import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { OutreachProspect, FeedRollupRow, OutreachFeed, OutreachCampaign } from '../../../../types/dashboard';
import { feedRollup, warmVsCold } from '../feedHelpers';
import { NextUpCard } from '../NextUpCard';
import { OutreachTimingHeatmap } from '../OutreachTimingHeatmap';

// ── Overview window constant ─────────────────────────────────────────────────
// Fixed campaign-start date. All overview KPI tiles use prospects whose
// createdAt >= this date.
const CAMPAIGN_START = '2026-06-25';

// ── Thin metric strip ────────────────────────────────────────────────────────
// One horizontal bordered strip of inline label:value stats — replaces the old
// row of seven chunky tiles. Light theme (CSS vars set on the dashboard shell).
interface Metric { label: string; value: string | number; sub?: string; tone?: 'ink' | 'good' | 'warn'; }

const toneColor: Record<NonNullable<Metric['tone']>, string> = {
  ink: 'var(--ds-ink, #0f172a)',
  good: '#047857',
  warn: '#b45309',
};

const MetricStrip: React.FC<{ metrics: Metric[] }> = ({ metrics }) => (
  <div
    className="flex flex-wrap items-stretch rounded-xl overflow-hidden"
    style={{
      background: 'var(--ds-card, #fff)',
      border: '1px solid var(--ds-line, #e9e9ee)',
      boxShadow: 'var(--ds-shadow-card, 0 1px 2px rgba(15,23,42,.04),0 10px 26px -18px rgba(15,23,42,.18))',
    }}
  >
    {metrics.map((m, i) => (
      <div
        key={m.label}
        className="flex-1 min-w-[120px] px-3.5 py-2.5"
        style={{ borderLeft: i === 0 ? 'none' : '1px solid var(--ds-line, #e9e9ee)' }}
      >
        <span className="text-[10px] font-medium block mb-0.5" style={{ color: 'var(--ds-dim, #475569)' }}>
          {m.label}
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[18px] font-bold tracking-tight leading-none tabular-nums" style={{ color: toneColor[m.tone ?? 'ink'] }}>
            {m.value}
          </span>
          {m.sub && <span className="text-[10px]" style={{ color: 'var(--ds-faint, #64748b)' }}>{m.sub}</span>}
        </div>
      </div>
    ))}
  </div>
);

// The outreach funnel — single series (cold). Each stage shows the count + the
// stage-over-stage conversion. (Per-feed segmentation removed: the harvest /
// hiring / intent-hot feeds were retired; cold DM + email are the live channels.)
const FUNNEL_STAGES: { key: keyof FeedRollupRow; label: string }[] = [
  { key: 'total', label: 'In pipeline' },
  { key: 'connectionSent', label: 'Conn. sent' },
  { key: 'connected', label: 'Accepted' },
  { key: 'dmSent', label: 'DM sent' },
  { key: 'replied', label: 'Replied' },
];

export interface InmailActivity {
  sent: number;
  lastSent: string | null;
  recent: { name: string; sentAt: string }[];
}

interface Props {
  prospects: OutreachProspect[];
  hotDomains: Set<string>;
  campaigns: OutreachCampaign[];
  cappedQueue: { connection_request: number; dm: number; inmail: number };
  inmailActivity: InmailActivity;
  onOpenProspect: (p: OutreachProspect) => void;
  onArchiveProspect: (id: string, reason?: string) => void;
  onResolveReply: (id: string) => void;
}

const ts = (v?: string | null) => (v ? new Date(v).getTime() : 0);

export const OverviewTab: React.FC<Props> = ({
  prospects,
  hotDomains,
  campaigns: _campaigns, // kept in Props for API compat; not used by the overview window
  cappedQueue,
  inmailActivity,
  onOpenProspect,
  onArchiveProspect,
  onResolveReply,
}) => {
  const windowedProspects = useMemo(
    () => prospects.filter((p) => p.createdAt >= CAMPAIGN_START),
    [prospects],
  );

  // Aggregate rollup (all feeds summed — cold dominates now that the others are retired).
  const rows = useMemo(() => feedRollup(windowedProspects, hotDomains), [windowedProspects, hotDomains]);
  const wvc = useMemo(() => warmVsCold(rows), [rows]);

  const totalActive = rows.reduce((a, r) => a + r.total, 0);

  // Stage totals across the pipeline (single series).
  const stageData = useMemo(() => FUNNEL_STAGES.map((s) => ({
    ...s,
    total: rows.reduce((a, r) => a + ((r[s.key] as number) || 0), 0),
  })), [rows]);
  const funnelMax = Math.max(...stageData.map((s) => s.total), 1);

  const totalAccepted = wvc.warmConnected + wvc.coldConnected;
  const totalConnSent = wvc.warmConnSent + wvc.coldConnSent;
  const totalReplied = wvc.warmReplied + wvc.coldReplied;
  const totalDmSent = wvc.warmDmSent + wvc.coldDmSent;

  const acceptRate = totalConnSent > 0 ? `${((totalAccepted / totalConnSent) * 100).toFixed(0)}%` : '—';
  const replyRate = totalDmSent > 0 ? `${((totalReplied / totalDmSent) * 100).toFixed(0)}%` : '—';

  // Genuine replies owed a response, last 7 days only — same rule NextUpCard uses
  // (replyCount>0 + recency window; older unanswered replies are stale, not actionable).
  const repliesWaiting = useMemo(
    () => prospects.filter((p) =>
      (p.replyCount ?? 0) > 0 &&
      Date.now() - ts(p.lastReplyAt) <= 7 * 86_400_000 &&
      (p.needsManualReply || (p.stage === 'replied' && ts(p.lastReplyAt) > ts(p.lastDmSentAt))),
    ).length,
    [prospects],
  );

  const metrics: Metric[] = [
    { label: 'Active pipeline', value: totalActive, sub: 'since Jun 25' },
    { label: 'Conn. sent', value: totalConnSent },
    { label: 'Accept rate', value: acceptRate, sub: `${totalAccepted}/${totalConnSent}`, tone: 'good' },
    { label: 'Reply rate', value: replyRate, sub: `${totalReplied}/${totalDmSent}`, tone: 'good' },
    { label: 'InMails sent', value: inmailActivity.sent },
    { label: 'Replies waiting', value: repliesWaiting, tone: repliesWaiting > 0 ? 'warn' : 'ink' },
  ];

  return (
    <div className="space-y-3">
      {/* Thin KPI strip */}
      <MetricStrip metrics={metrics} />

      {/* Funnel + timing heatmap, side by side (stack on mobile) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        {/* Outreach funnel — compact, single series */}
        <div
          className="rounded-xl p-3.5"
          style={{
            background: 'var(--ds-card, #fff)',
            border: '1px solid var(--ds-line, #e9e9ee)',
            boxShadow: 'var(--ds-shadow-card, 0 1px 2px rgba(15,23,42,.04),0 10px 26px -18px rgba(15,23,42,.18))',
          }}
        >
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--ds-dim, #475569)' }}>Outreach funnel</span>
            <span className="text-[10px]" style={{ color: 'var(--ds-faint, #64748b)' }}>{totalActive} in pipeline → {totalReplied} replied · since Jun 25</span>
          </div>
          <div className="space-y-2">
            {stageData.map((s, i) => {
              const widthPct = Math.max((s.total / funnelMax) * 100, s.total > 0 ? 4 : 1.5);
              const prev = i > 0 ? stageData[i - 1].total : null;
              const conv = prev && prev > 0 ? Math.round((s.total / prev) * 100) : null;
              return (
                <div key={String(s.key)} className="flex items-center gap-2.5">
                  <span className="text-[10px] w-[68px] shrink-0 text-right" style={{ color: 'var(--ds-faint, #64748b)' }}>{s.label}</span>
                  <div className="flex-1 h-6 rounded-md overflow-hidden relative ring-1 ring-inset" style={{ background: 'var(--ds-bg, #f6f7f9)', borderColor: 'var(--ds-line, #e9e9ee)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ type: 'spring', stiffness: 220, damping: 28, delay: i * 0.06 }}
                      className="h-full rounded-md bg-gradient-to-r from-indigo-500 to-indigo-600"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold tabular-nums pointer-events-none" style={{ color: 'var(--ds-ink, #0f172a)' }}>{s.total}</span>
                  </div>
                  <span className={`text-[10px] font-medium w-9 shrink-0 ${conv == null ? 'text-transparent' : conv >= 50 ? 'text-emerald-700' : conv >= 20 ? 'text-amber-700' : 'text-red-700'}`}>
                    {conv == null ? '—' : `${conv}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Timing heatmap — best day/slot to send */}
        <OutreachTimingHeatmap />
      </div>

      {/* Action queue — replies waiting + next sends (this is the inbox fold) */}
      <NextUpCard
        prospects={prospects}
        cappedQueue={cappedQueue}
        inmailActivity={inmailActivity}
        onOpen={onOpenProspect}
        onArchive={onArchiveProspect}
        onResolve={onResolveReply}
      />
    </div>
  );
};

export default OverviewTab;
