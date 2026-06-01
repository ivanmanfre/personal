import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';

/**
 * Real columned list view — direct ClickUp-list equivalent.
 *
 * Single sortable table. Status is a column (colored dot + label), not a section
 * header. Pillar / Hook / Tier / Source / Date have their own dedicated columns.
 * Click a column header to sort by that field; click again to reverse. Hover
 * sort icon hints which columns are sortable.
 *
 * Used by both Posts and Lead Magnet studios. Columns can be hidden via the
 * `visibleCols` prop (e.g. LM doesn't have Hook Type).
 */

export type StudioRow = {
  id: string;
  title: string;
  excerpt?: string;
  status: string;
  thumbUrl?: string | null;
  kicker?: string;
  date?: string;
  dateSort?: number;
  pillar?: string;
  hookType?: string;
  valueTier?: string;
  source?: string;
  formatLabel?: string;
  topicStrength?: string;
};

export type StatusMeta = { dot: string; label: string };

type SortKey = 'title' | 'status' | 'pillar' | 'hookType' | 'valueTier' | 'strength' | 'date' | 'source' | 'format';
type SortDir = 'asc' | 'desc';

const ALL_COLS: { key: SortKey; label: string; width: string; visible?: 'always' | 'gte-md' | 'gte-lg' }[] = [
  { key: 'title',     label: 'Title',    width: 'minmax(0,1fr)' },
  { key: 'status',    label: 'Status',   width: '108px' },
  { key: 'pillar',    label: 'Pillar',   width: '118px', visible: 'gte-lg' },
  { key: 'hookType',  label: 'Hook',     width: '118px', visible: 'gte-lg' },
  { key: 'valueTier', label: 'Tier',     width: '108px', visible: 'gte-lg' },
  { key: 'strength',  label: 'Strength', width: '90px',  visible: 'gte-md' },
  { key: 'format',    label: 'Format',   width: '92px',  visible: 'gte-md' },
  { key: 'source',    label: 'Source',   width: '108px', visible: 'gte-md' },
  { key: 'date',      label: 'Date',     width: '116px' },
];

const STRENGTH_RANK: Record<string, number> = { High: 1, Medium: 2, Low: 3 };
const STRENGTH_TINT: Record<string, string> = {
  High:   'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  Medium: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  Low:    'text-zinc-400 bg-zinc-700/30 border-zinc-700/40',
};

const TIER_RANK: Record<string, number> = {
  'T1 (Receipt+Insight)': 1, 'T2 (Pattern+Specifics)': 2, 'T3 (Sharp Opinion)': 3, 'T4 (Light/Bonding)': 4,
  T1: 1, T2: 2, T3: 3, T4: 4,
};

export function StudioListView({
  rows,
  statusMeta,
  onOpen,
  /** Hide certain columns by key (e.g. LM doesn't have hookType). */
  hiddenCols = new Set<SortKey>(),
}: {
  rows: StudioRow[];
  statusMeta: Record<string, StatusMeta>;
  onOpen: (id: string) => void;
  hiddenCols?: Set<SortKey>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const cols = useMemo(() => ALL_COLS.filter((c) => !hiddenCols.has(c.key)), [hiddenCols]);
  const gridTemplate = useMemo(() => cols.map((c) => c.width).join(' '), [cols]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortKey) {
        case 'title':  av = a.title || ''; bv = b.title || ''; break;
        case 'status': av = a.status || ''; bv = b.status || ''; break;
        case 'pillar': av = a.pillar || ''; bv = b.pillar || ''; break;
        case 'hookType': av = a.hookType || ''; bv = b.hookType || ''; break;
        case 'valueTier': av = TIER_RANK[a.valueTier || ''] || 99; bv = TIER_RANK[b.valueTier || ''] || 99; break;
        case 'strength': av = STRENGTH_RANK[a.topicStrength || ''] || 99; bv = STRENGTH_RANK[b.topicStrength || ''] || 99; break;
        case 'format': av = a.formatLabel || ''; bv = b.formatLabel || ''; break;
        case 'source': av = a.source || ''; bv = b.source || ''; break;
        case 'date':   av = a.dateSort || 0; bv = b.dateSort || 0; break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'date' ? 'desc' : 'asc'); }
  }

  const colClass = (visible?: string) =>
    visible === 'gte-md' ? 'hidden md:flex' :
    visible === 'gte-lg' ? 'hidden lg:flex' : 'flex';

  return (
    <div className="rounded-lg border border-zinc-800/80 overflow-hidden bg-zinc-950/30">
      {/* Column header */}
      <div
        className="grid items-center gap-3 px-3 py-2 bg-zinc-900/80 border-b border-zinc-800 text-[10.5px] uppercase tracking-wider text-zinc-500 font-semibold"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {cols.map((c) => {
          const active = sortKey === c.key;
          return (
            <button
              key={c.key}
              onClick={() => toggleSort(c.key)}
              className={`${colClass(c.visible)} items-center gap-1 ${active ? 'text-zinc-200' : 'hover:text-zinc-300'} text-left transition-colors`}
            >
              {c.label}
              {active ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-2.5 h-2.5 opacity-30" />}
            </button>
          );
        })}
      </div>

      {/* Rows */}
      {sorted.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-zinc-600 italic">No rows match the current filter.</div>
      ) : (
        sorted.map((r, i) => {
          const meta = statusMeta[r.status] || { dot: 'bg-zinc-500', label: 'text-zinc-300' };
          return (
            <button
              key={r.id}
              onClick={() => onOpen(r.id)}
              className={`group w-full grid items-center gap-3 px-3 py-2 text-left border-b border-zinc-800/40 last:border-b-0 hover:bg-zinc-900/60 transition ${i % 2 === 1 ? 'bg-zinc-900/20' : ''}`}
              style={{ gridTemplateColumns: gridTemplate }}
            >
              {cols.map((c) => {
                const cls = `${colClass(c.visible)} items-center min-w-0`;
                if (c.key === 'title') {
                  return (
                    <div key={c.key} className={cls + ' gap-2.5'}>
                      <div className="w-7 h-7 rounded overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                        {r.thumbUrl ? (
                          <img src={r.thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <span className="text-[7.5px] uppercase tracking-wider text-emerald-500/55 font-mono leading-none">
                            {(r.kicker || 'T').slice(0, 3)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] text-zinc-100 truncate group-hover:text-white">{r.title || '(untitled)'}</div>
                        {r.excerpt && <div className="text-[11px] text-zinc-500 truncate">{r.excerpt}</div>}
                      </div>
                    </div>
                  );
                }
                if (c.key === 'status') {
                  return (
                    <div key={c.key} className={cls + ' gap-1.5'}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      <span className={`text-[11px] ${meta.label} truncate`}>{r.status}</span>
                    </div>
                  );
                }
                if (c.key === 'pillar')    return <div key={c.key} className={cls}><span className="text-[11px] text-zinc-300 truncate">{r.pillar || '—'}</span></div>;
                if (c.key === 'hookType')  return <div key={c.key} className={cls}><span className="text-[11px] text-zinc-300 truncate">{r.hookType || '—'}</span></div>;
                if (c.key === 'valueTier') return <div key={c.key} className={cls}><span className="text-[11px] text-zinc-300 truncate">{r.valueTier || '—'}</span></div>;
                if (c.key === 'strength') {
                  const t = r.topicStrength || '';
                  return (
                    <div key={c.key} className={cls}>
                      {t ? (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium uppercase tracking-wider ${STRENGTH_TINT[t] || STRENGTH_TINT.Low}`}>{t}</span>
                      ) : <span className="text-[11px] text-zinc-600">—</span>}
                    </div>
                  );
                }
                if (c.key === 'format')    return <div key={c.key} className={cls}><span className="text-[11px] text-zinc-400 truncate">{r.formatLabel || '—'}</span></div>;
                if (c.key === 'source')    return <div key={c.key} className={cls}><span className="text-[11px] text-zinc-400 truncate">{r.source || '—'}</span></div>;
                if (c.key === 'date')      return <div key={c.key} className={cls}><span className="text-[11px] text-zinc-400 tabular-nums whitespace-nowrap">{r.date || '—'}</span></div>;
                return null;
              })}
            </button>
          );
        })
      )}
    </div>
  );
}

export default StudioListView;
