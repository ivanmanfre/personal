import React, { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { useContentTiming, type OutreachSlot, type ContentSlot } from '../../../hooks/useContentTiming';

type Metric = 'accept' | 'reply' | 'volume' | 'content';

const METRICS: { key: Metric; label: string }[] = [
  { key: 'accept', label: 'Accept rate' },
  { key: 'reply', label: 'Reply rate' },
  { key: 'volume', label: 'Send volume' },
  { key: 'content', label: 'Post engagement' },
];

// Postgres dow: 0=Sun..6=Sat. Display Mon-first.
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DOW_LABEL: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };
const BLOCKS = [
  { block: 0, label: 'Night', sub: '12–6a' },
  { block: 1, label: 'Morning', sub: '6–12' },
  { block: 2, label: 'Midday', sub: '12–6p' },
  { block: 3, label: 'Evening', sub: '6–12p' },
];

const MIN_SENDS = 8; // denominator floor for accept/reply rate cells
const MIN_POSTS = 3; // floor for post-engagement cells

interface Cell { value: number | null; label: string; sub: string; intensity: number; }

const CAPTION: Record<Metric, string> = {
  accept: 'Share of connection invites sent in each slot that were accepted. Attributed to the send time. Cells with fewer than 8 sends are muted.',
  reply: 'Share of invites that produced a reply, attributed to the send time. Reply data is thin, so most cells stay muted until volume builds.',
  volume: 'How many connection invites were sent in each slot. Shows your current sending pattern, not what performs.',
  content: 'Average likes + comments + shares on your own LinkedIn posts published in each slot. Cells with fewer than 3 posts are muted.',
};

export const OutreachTimingHeatmap: React.FC = () => {
  const { outreach, content, loading } = useContentTiming();
  const [metric, setMetric] = useState<Metric>('accept');

  const { cells, max } = useMemo(() => {
    const oMap = new Map<string, OutreachSlot>();
    outreach.forEach((s) => oMap.set(`${s.dow}-${s.block}`, s));
    const cMap = new Map<string, ContentSlot>();
    content.forEach((s) => cMap.set(`${s.dow}-${s.block}`, s));

    let maxVal = 0;
    const out: Record<string, Cell> = {};
    DOW_ORDER.forEach((dow) => BLOCKS.forEach(({ block }) => {
      const key = `${dow}-${block}`;
      let value: number | null = null;
      let label = '—';
      let sub = '';

      if (metric === 'content') {
        const c = cMap.get(key);
        if (c && c.posts >= MIN_POSTS) {
          value = c.avgEngagement;
          label = Math.round(c.avgEngagement).toLocaleString();
          sub = `${c.posts} posts`;
        } else if (c && c.posts > 0) {
          sub = `${c.posts} post${c.posts > 1 ? 's' : ''}`;
        }
      } else if (metric === 'volume') {
        const o = oMap.get(key);
        const v = o?.sends || 0;
        if (v > 0) { value = v; label = v.toLocaleString(); sub = `${o!.accepts} acc`; }
      } else {
        const o = oMap.get(key);
        const sends = o?.sends || 0;
        if (sends >= MIN_SENDS) {
          const num = metric === 'accept' ? o!.accepts : o!.replies;
          value = (num / sends) * 100;
          label = `${value.toFixed(0)}%`;
          sub = `${num}/${sends}`;
        } else if (sends > 0) {
          sub = `${sends} sent`;
        }
      }

      if (value != null && value > maxVal) maxVal = value;
      out[key] = { value, label, sub, intensity: 0 };
    }));

    Object.values(out).forEach((c) => { c.intensity = c.value != null && maxVal > 0 ? c.value / maxVal : 0; });
    return { cells: out, max: maxVal };
  }, [outreach, content, metric]);

  return (
    <div className="panel-surface shadow-sm shadow-black/10 p-4">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Clock className="w-4 h-4 text-zinc-500" />
        <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-medium">Best time to send</span>
        <span className="text-[10px] text-zinc-600">day × time-of-day · BA time</span>
        <div className="flex items-center gap-1 ml-auto flex-wrap">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                metric === m.key
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-[var(--ds-line,#e9e9ee)] text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-48 grid place-items-center text-[11px] text-zinc-600">Loading…</div>
      ) : (
        <>
          {/* Column header */}
          <div className="grid gap-1.5 mt-3" style={{ gridTemplateColumns: 'auto repeat(4, minmax(0, 1fr))' }}>
            <div />
            {BLOCKS.map((b) => (
              <div key={b.block} className="text-center">
                <div className="text-[10px] text-zinc-400 font-medium">{b.label}</div>
                <div className="text-[9px] text-zinc-600">{b.sub}</div>
              </div>
            ))}
            {/* Rows */}
            {DOW_ORDER.map((dow) => (
              <React.Fragment key={dow}>
                <div className="flex items-center justify-end pr-1.5 text-[10px] text-zinc-500 font-medium">{DOW_LABEL[dow]}</div>
                {BLOCKS.map(({ block }) => {
                  const c = cells[`${dow}-${block}`];
                  const has = c.value != null;
                  const bg = has
                    ? `rgba(34, 197, 94, ${(0.12 + c.intensity * 0.78).toFixed(3)})`
                    : 'rgba(148, 163, 184, 0.12)';
                  return (
                    <div
                      key={block}
                      className="rounded-md h-9 flex flex-col items-center justify-center border border-black/5"
                      style={{ background: bg }}
                      title={`${DOW_LABEL[dow]} ${BLOCKS[block].label}${c.sub ? ` · ${c.sub}` : ''}`}
                    >
                      <span className={`text-[12px] font-bold tabular-nums leading-none ${has ? (c.intensity > 0.6 ? 'text-white' : 'text-emerald-900') : 'text-slate-400'}`}>
                        {c.label}
                      </span>
                      {c.sub && <span className="text-[9px] text-zinc-500 mt-0.5 leading-none">{c.sub}</span>}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 mt-3 leading-relaxed">{CAPTION[metric]}{max === 0 && ' No qualifying data for this metric yet.'}</p>
        </>
      )}
    </div>
  );
};
