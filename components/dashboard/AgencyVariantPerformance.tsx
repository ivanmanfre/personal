import { Beaker } from 'lucide-react';
import { useAgencyVariantStats, type AgencyVariantStatRow } from '../../hooks/useAgencyVariantStats';

const BODY_LABELS: Record<string, string> = {
  a: 'Builder-first (V3 baseline)',
  b: 'Benefit-first (V11-B1)',
};

const BODY_COPY: Record<string, string> = {
  a: "Wrote up how I'd run LinkedIn content + lead magnets with AI for a boutique agency…",
  b: 'For agency owners who want LinkedIn posts to actually generate leads…',
};

const CLOSER_LABELS: Record<string, string> = {
  a: 'Gift, no ask',
  d: 'Minimum',
  h: 'Binary question',
  i: '3-pick question',
  j: 'Inbound question',
};

const CLOSER_COPY: Record<string, string> = {
  a: "Just figured you'd want to see it, have a good one.",
  d: "Hope it's useful.",
  h: 'Posting much lately, or mostly relying on referrals?',
  i: 'Outbound, content, or referrals right now?',
  j: 'Have you been trying to grow inbound with LinkedIn content lately?',
};

const LOW_SIGNAL_THRESHOLD = 10;

function rateColor(rate: number, sent: number): string {
  if (sent < LOW_SIGNAL_THRESHOLD) return 'text-zinc-400';
  if (rate >= 15) return 'text-emerald-400';
  if (rate >= 7) return 'text-amber-400';
  return 'text-zinc-300';
}

function VariantRow({
  tag,
  label,
  copy,
  row,
  isLeader,
}: {
  tag: string;
  label: string;
  copy: string;
  row: AgencyVariantStatRow | undefined;
  isLeader: boolean;
}) {
  const sent = row?.sent_count ?? 0;
  const replies = row?.reply_count ?? 0;
  const rate = row?.reply_rate ?? 0;
  const lowSignal = sent < LOW_SIGNAL_THRESHOLD;
  return (
    <div
      className={`bg-zinc-800/40 border ${isLeader ? 'border-emerald-500/40' : 'border-zinc-700/30'} rounded-lg p-3`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-mono uppercase text-zinc-500">{tag}</span>
          <span className="text-[11px] text-zinc-300 truncate">{label}</span>
        </div>
        <span className={`text-sm font-mono font-semibold ${rateColor(rate, sent)}`}>
          {sent === 0 ? '–' : `${rate}%`}
          {!lowSignal && isLeader ? <span className="text-emerald-400/70 ml-1">★</span> : null}
        </span>
      </div>
      <p className="text-[10px] text-zinc-500 italic truncate mb-1">&ldquo;{copy}&rdquo;</p>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-zinc-500">
          {replies}/{sent} replies
          {lowSignal && sent > 0 ? <span className="text-zinc-600"> · low signal</span> : null}
        </span>
        {sent === 0 ? <span className="text-zinc-600">no sends yet</span> : null}
      </div>
    </div>
  );
}

export function AgencyVariantPerformance() {
  const { rows, loading, error } = useAgencyVariantStats();

  if (loading) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
        <p className="text-xs text-zinc-500">Loading variant performance…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
        <p className="text-xs text-red-400">Variant stats error: {error}</p>
      </div>
    );
  }

  const byTag = new Map<string, AgencyVariantStatRow>();
  for (const r of rows) byTag.set(`${r.axis}:${r.tag}`, r);

  const bodyTags = ['a', 'b'];
  const closerTags = ['a', 'd', 'h', 'i', 'j'];

  const eligibleBodyRows = rows.filter((r) => r.axis === 'body' && r.sent_count >= LOW_SIGNAL_THRESHOLD);
  const eligibleCloserRows = rows.filter((r) => r.axis === 'closer' && r.sent_count >= LOW_SIGNAL_THRESHOLD);
  const bodyLeader = eligibleBodyRows.length > 0
    ? eligibleBodyRows.reduce((best, cur) => (cur.reply_rate > best.reply_rate ? cur : best))
    : null;
  const closerLeader = eligibleCloserRows.length > 0
    ? eligibleCloserRows.reduce((best, cur) => (cur.reply_rate > best.reply_rate ? cur : best))
    : null;

  const totalSentBody = rows.filter((r) => r.axis === 'body').reduce((sum, r) => sum + r.sent_count, 0);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Beaker className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-zinc-200">Agency DM Variant Performance</span>
        </div>
        <span className="text-[10px] text-zinc-500">
          {totalSentBody} touch-1 sends · marginal analysis (per axis, not per cell)
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Body frame</p>
          <div className="space-y-2">
            {bodyTags.map((tag) => (
              <VariantRow
                key={`body-${tag}`}
                tag={tag}
                label={BODY_LABELS[tag]}
                copy={BODY_COPY[tag]}
                row={byTag.get(`body:${tag}`)}
                isLeader={bodyLeader?.tag === tag}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Closer</p>
          <div className="space-y-2">
            {closerTags.map((tag) => (
              <VariantRow
                key={`closer-${tag}`}
                tag={tag}
                label={CLOSER_LABELS[tag]}
                copy={CLOSER_COPY[tag]}
                row={byTag.get(`closer:${tag}`)}
                isLeader={closerLeader?.tag === tag}
              />
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-zinc-500 mt-3 leading-relaxed">
        Reply = non-reaction inbound message after touch-1 DM. ★ marks the leading arm once it crosses{' '}
        {LOW_SIGNAL_THRESHOLD} sends. Body and closer counters are independent — same prospect&apos;s tag is{' '}
        <code className="text-zinc-400">body_closer</code> (e.g. <code className="text-zinc-400">a_h</code>).
      </p>
    </div>
  );
}
