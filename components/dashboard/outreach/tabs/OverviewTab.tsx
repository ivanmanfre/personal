import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, Radio, Briefcase, Flame, Snowflake, TrendingUp } from 'lucide-react';
import StatCard from '../../shared/StatCard';
import { NextUpCard } from '../NextUpCard';
import type { OutreachProspect, FeedRollupRow, OutreachFeed } from '../../../../types/dashboard';
import {
  FEED_ORDER, FEED_LABELS, FEED_DESC, FEED_BADGE, FEED_BAR, FEED_TEXT,
  feedRollup, warmVsCold,
} from '../feedHelpers';

interface Props {
  prospects: OutreachProspect[];
  hotDomains: Set<string>;
  bandsTotal: number;
  bandsHot: number;
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

const feedColor: Record<OutreachFeed, string> = {
  cold: 'text-zinc-300',
  harvest: 'text-blue-400',
  hiring: 'text-amber-400',
  hot: 'text-emerald-400',
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

export const OverviewTab: React.FC<Props> = ({ prospects, hotDomains, bandsTotal, bandsHot, onPickFeed, onOpenProspect, onArchiveProspect, onResolveReply }) => {
  const rows = useMemo(() => feedRollup(prospects, hotDomains), [prospects, hotDomains]);
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

  // warm-vs-cold: low-signal guard (rates at tiny N are noise).
  const warmAcceptSignal = wvc.warmConnSent >= 8;
  const coldAcceptSignal = wvc.coldConnSent >= 8;
  const warmReplySignal = wvc.warmDmSent >= 8;
  const coldReplySignal = wvc.coldDmSent >= 8;

  return (
    <div className="space-y-4">
      {/* Pinned "who's next and when" command queue */}
      <NextUpCard
        prospects={prospects}
        onOpen={onOpenProspect}
        onArchive={onArchiveProspect}
        onResolve={onResolveReply}
      />

      {/* Headline stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Active Pipeline" value={totalActive} icon={<Users className="w-5 h-5" />} color="text-zinc-300" subValue="across all feeds" />
        {FEED_ORDER.map((f) => {
          const r = byFeed.get(f);
          return (
            <StatCard
              key={f}
              label={FEED_LABELS[f]}
              value={r?.total ?? 0}
              icon={feedIcon[f]}
              color={feedColor[f]}
              subValue={FEED_DESC[f]}
            />
          );
        })}
      </div>

      {/* Cross-feed funnel — source-attributed */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">All-Feeds Funnel</span>
          <span className="text-[10px] text-zinc-600">{totalActive} in pipeline → {wvc.coldReplied + wvc.warmReplied} replied</span>
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

      {/* Warm vs Cold — the key comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <WarmColdCard
          title="Accept Rate"
          subtitle="invite → connection"
          warmRate={wvc.warmAcceptRate} coldRate={wvc.coldAcceptRate}
          warmFrac={`${wvc.warmConnected}/${wvc.warmConnSent}`} coldFrac={`${wvc.coldConnected}/${wvc.coldConnSent}`}
          warmSignal={warmAcceptSignal} coldSignal={coldAcceptSignal}
        />
        <WarmColdCard
          title="Reply Rate"
          subtitle="DM → reply"
          warmRate={wvc.warmReplyRate} coldRate={wvc.coldReplyRate}
          warmFrac={`${wvc.warmReplied}/${wvc.warmDmSent}`} coldFrac={`${wvc.coldReplied}/${wvc.coldDmSent}`}
          warmSignal={warmReplySignal} coldSignal={coldReplySignal}
        />
      </div>

      {/* Conversion by source — per-feed bars */}
      <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-zinc-500" />
          <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Conversion by Source</span>
          <span className="text-[10px] text-zinc-600">accept (invite→conn) · reply (DM→reply)</span>
        </div>
        <div className="space-y-3.5">
          {FEED_ORDER.map((f) => {
            const r = byFeed.get(f)!;
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

const WarmColdCard: React.FC<{
  title: string; subtitle: string;
  warmRate: number; coldRate: number;
  warmFrac: string; coldFrac: string;
  warmSignal: boolean; coldSignal: boolean;
}> = ({ title, subtitle, warmRate, coldRate, warmFrac, coldFrac, warmSignal, coldSignal }) => {
  const max = Math.max(warmRate, coldRate, 1);
  const delta = warmSignal && coldSignal ? Math.round((warmRate - coldRate) * 10) / 10 : null;
  return (
    <div className="bg-zinc-900/90 border border-zinc-800/60 rounded-2xl shadow-sm shadow-black/10 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <div>
          <span className="text-sm font-semibold text-zinc-200">{title}</span>
          <span className="text-[10px] text-zinc-500 ml-2">{subtitle}</span>
        </div>
        {delta != null && (
          <span className={`text-[11px] font-medium ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
            warm {delta > 0 ? '+' : ''}{delta} pts
          </span>
        )}
      </div>
      <div className="space-y-2.5">
        {([
          { who: 'Warm', rate: warmRate, frac: warmFrac, signal: warmSignal, bar: 'from-emerald-500 to-emerald-600', text: 'text-emerald-300' },
          { who: 'Cold', rate: coldRate, frac: coldFrac, signal: coldSignal, bar: 'from-zinc-500 to-zinc-600', text: 'text-zinc-300' },
        ]).map((row) => (
          <div key={row.who} className="flex items-center gap-3">
            <span className="text-[11px] text-zinc-400 w-10 shrink-0">{row.who}</span>
            <div className="flex-1 h-5 bg-zinc-950/70 ring-1 ring-inset ring-zinc-800/60 rounded-md overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(row.rate / max) * 100}%` }}
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                className={`h-full rounded-md bg-gradient-to-t ${row.bar}`}
                style={{ minWidth: row.rate > 0 ? 4 : 0 }}
              />
            </div>
            <span className={`text-xs font-bold w-14 text-right tabular-nums ${row.signal ? row.text : 'text-zinc-500'}`}>
              {row.signal ? `${row.rate}%` : '—'}
            </span>
            <span className="text-[9px] text-zinc-600 w-12 text-right">{row.frac}</span>
          </div>
        ))}
      </div>
      {(!warmSignal || !coldSignal) && (
        <p className="text-[9px] text-zinc-600 mt-2">Dashes = too few sends to trust the rate yet (need ≥8).</p>
      )}
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
