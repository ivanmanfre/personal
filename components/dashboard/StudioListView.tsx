import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ListRowSkeleton } from '../ui/primitives';

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
  loading = false,
  onBulkAction,
  /** When set, rows are grouped under collapsible status headers (ClickUp-style).
   *  Per-group collapse state persists to localStorage under this key. */
  groupByStatus,
  /** Order of status groups when groupByStatus is on. Status not in this list
   *  goes into a final "Other" group. */
  statusOrder = [],
  /** Inline status editor: list of statuses the user can pick from. When provided
   *  along with onStatusChange, clicking the status cell pops a small menu. */
  statusChoices,
  onStatusChange,
  /** Inline date editor: when provided, clicking the date cell reveals a date input.
   *  Receives ISO yyyy-mm-dd (null = cleared). */
  onDateChange,
}: {
  rows: StudioRow[];
  statusMeta: Record<string, StatusMeta>;
  onOpen: (id: string) => void;
  hiddenCols?: Set<SortKey>;
  loading?: boolean;
  onBulkAction?: (action: 'disqualify' | 'delete', ids: string[]) => Promise<void> | void;
  groupByStatus?: string;
  statusOrder?: string[];
  statusChoices?: string[];
  onStatusChange?: (id: string, status: string) => Promise<void> | void;
  onDateChange?: (id: string, isoDate: string | null) => Promise<void> | void;
}) {
  // Per-status collapse state (only used when groupByStatus is on).
  // Default: published + disqualified collapsed; everything else open.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (!groupByStatus || typeof window === 'undefined') return new Set(['published', 'disqualified']);
    try {
      const raw = localStorage.getItem(`studio-collapse-${groupByStatus}`);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {}
    return new Set(['published', 'disqualified']);
  });
  React.useEffect(() => {
    if (!groupByStatus || typeof window === 'undefined') return;
    try { localStorage.setItem(`studio-collapse-${groupByStatus}`, JSON.stringify(Array.from(collapsed))); } catch {}
  }, [collapsed, groupByStatus]);
  const toggleGroup = (status: string) =>
    setCollapsed((s) => { const n = new Set(s); n.has(status) ? n.delete(status) : n.add(status); return n; });

  // Inline edit state: which row's status / date cell is currently being edited.
  // Stored as the row id, or null when not editing. Only one at a time.
  const [editingStatusId, setEditingStatusId] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());
  const selectAll = (ids: string[]) => setSelected(new Set(ids));
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const cols = useMemo(() => {
    // When grouped by status, hide the redundant status column — UNLESS inline
    // status editing is on, in which case we keep it so users still have a
    // single-click way to move a row between groups.
    const skipStatus = !!groupByStatus && !onStatusChange;
    return ALL_COLS.filter((c) => !hiddenCols.has(c.key) && !(skipStatus && c.key === 'status'));
  }, [hiddenCols, groupByStatus, onStatusChange]);
  const gridTemplate = useMemo(() => {
    const base = cols.map((c) => c.width).join(' ');
    return onBulkAction ? `32px ${base}` : base;
  }, [cols, onBulkAction]);

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
      {/* Bulk action bar — shown when any rows are selected */}
      {onBulkAction && selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-950/30 border-b border-emerald-900/40 text-[12px] text-emerald-200">
          <span className="font-medium">{selected.size} selected</span>
          <button onClick={clearSelection} className="text-zinc-400 hover:text-zinc-200">Clear</button>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => { onBulkAction('disqualify', Array.from(selected)); clearSelection(); }}
              className="px-2.5 py-1 rounded border border-zinc-700/40 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200 transition-colors"
            >Disqualify</button>
            <button
              onClick={() => { if (confirm(`Delete ${selected.size} row(s)? This can't be undone.`)) { onBulkAction('delete', Array.from(selected)); clearSelection(); } }}
              className="px-2.5 py-1 rounded border border-red-900/40 bg-red-950/40 hover:bg-red-950/60 text-red-300 transition-colors"
            >Delete</button>
          </div>
        </div>
      )}

      {/* Column header — sentence case, no uppercase. Lowercase header is the single
          biggest "polished SaaS vs internal tool" signal. */}
      <div
        className="grid items-center gap-3 px-3 py-2 bg-zinc-900/60 border-b border-zinc-800 text-[12px] text-zinc-500 font-medium"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {onBulkAction && (
          <input
            type="checkbox"
            checked={selected.size > 0 && selected.size === rows.length}
            ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length; }}
            onChange={(e) => { e.target.checked ? selectAll(rows.map((r) => r.id)) : clearSelection(); }}
            className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        )}
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

      {/* Rows — flat OR grouped by status (ClickUp-style collapsible sections) */}
      {loading ? (
        <div>{[...Array(8)].map((_, i) => <ListRowSkeleton key={i} />)}</div>
      ) : sorted.length === 0 ? (
        <div className="px-3 py-8 text-center text-sm text-zinc-600 italic">No rows match the current filter.</div>
      ) : groupByStatus ? (
        // Grouped — render a header per status, then its rows. Statuses that don't
        // appear in `sorted` are skipped entirely (no empty groups).
        <LayoutGroup>
          {(() => {
            const byStatus = new Map<string, StudioRow[]>();
            for (const r of sorted) {
              const list = byStatus.get(r.status) || [];
              list.push(r);
              byStatus.set(r.status, list);
            }
            const ordered = [
              ...statusOrder.filter((s) => byStatus.has(s)),
              ...Array.from(byStatus.keys()).filter((s) => !statusOrder.includes(s)),
            ];
            return ordered.map((status) => {
              const groupRows = byStatus.get(status)!;
              const meta = statusMeta[status] || { dot: 'bg-zinc-500', label: 'text-zinc-300' };
              const isCollapsed = collapsed.has(status);
              return (
                <div key={status} className="border-b border-zinc-800/60 last:border-b-0">
                  <button
                    onClick={() => toggleGroup(status)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 bg-zinc-900/40 hover:bg-zinc-900/70 transition-colors text-left"
                  >
                    {isCollapsed
                      ? <ChevronRight className="w-3 h-3 text-zinc-500" />
                      : <ChevronDown className="w-3 h-3 text-zinc-400" />}
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                    <span className={`text-[11px] font-medium ${meta.label} capitalize`}>{status}</span>
                    <span className="text-[11px] text-zinc-500 tabular-nums">{groupRows.length}</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {!isCollapsed && (
                      <motion.div
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        style={{ overflow: 'hidden' }}
                      >
                        {groupRows.map((r, i) => renderRow(r, i))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            });
          })()}
        </LayoutGroup>
      ) : (
        <LayoutGroup>
          <AnimatePresence initial={false}>
            {sorted.map((r, i) => renderRow(r, i))}
          </AnimatePresence>
        </LayoutGroup>
      )}
    </div>
  );

  function renderRow(r: StudioRow, i: number) {
    const meta = statusMeta[r.status] || { dot: 'bg-zinc-500', label: 'text-zinc-300' };
    return (
      <motion.div
        key={r.id}
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
        onClick={() => onOpen(r.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter') onOpen(r.id); }}
        className={`group w-full grid items-center gap-3 px-3 py-2 text-left border-b border-zinc-800/40 last:border-b-0 hover:bg-zinc-900/60 transition-colors cursor-pointer ${i % 2 === 1 ? 'bg-zinc-900/20' : ''} ${selected.has(r.id) ? 'bg-emerald-950/20' : ''}`}
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {onBulkAction && (
          <input
            type="checkbox"
            checked={selected.has(r.id)}
            onChange={(e) => { e.stopPropagation(); toggleOne(r.id); }}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
          />
        )}
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
            const canEdit = !!onStatusChange && !!statusChoices && statusChoices.length > 0;
            const isEditing = canEdit && editingStatusId === r.id;
            if (isEditing) {
              return (
                <div key={c.key} className={cls + ' gap-1.5'}>
                  <select
                    autoFocus
                    value={r.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={async (e) => {
                      const next = e.target.value;
                      setEditingStatusId(null);
                      if (next !== r.status) await onStatusChange!(r.id, next);
                    }}
                    onBlur={() => setEditingStatusId(null)}
                    className="text-[11px] rounded bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 text-zinc-100 outline-none focus:border-emerald-500"
                  >
                    {statusChoices!.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              );
            }
            return (
              <div
                key={c.key}
                className={cls + ' gap-1.5' + (canEdit ? ' hover:bg-zinc-800/40 rounded px-1 -mx-1' : '')}
                onClick={canEdit ? (e) => { e.stopPropagation(); setEditingStatusId(r.id); } : undefined}
                title={canEdit ? 'Click to change status' : undefined}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                <span className={`text-[11px] ${meta.label} truncate`}>{r.status}</span>
              </div>
            );
          }
          if (c.key === 'pillar')    return <div key={c.key} className={cls}><span className="text-[11px] text-zinc-300 truncate">{r.pillar || ''}</span></div>;
          if (c.key === 'hookType')  return <div key={c.key} className={cls}><span className="text-[11px] text-zinc-300 truncate">{r.hookType || ''}</span></div>;
          if (c.key === 'valueTier') return <div key={c.key} className={cls}><span className="text-[11px] text-zinc-300 truncate">{r.valueTier || ''}</span></div>;
          if (c.key === 'strength') {
            const t = r.topicStrength || '';
            if (!t) return <div key={c.key} className={cls} />;
            return (
              <div key={c.key} className={cls}>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${STRENGTH_TINT[t] || STRENGTH_TINT.Low}`}>{t}</span>
              </div>
            );
          }
          if (c.key === 'format')    return <div key={c.key} className={cls}><span className="text-[11px] text-zinc-400 truncate">{r.formatLabel || ''}</span></div>;
          if (c.key === 'source')    return <div key={c.key} className={cls}><span className="text-[11px] text-zinc-400 truncate">{r.source || ''}</span></div>;
          if (c.key === 'date') {
            const canEdit = !!onDateChange;
            const isEditing = canEdit && editingDateId === r.id;
            // Seed the date input from dateSort (ms epoch). Falls back to today.
            const seedISO = r.dateSort
              ? new Date(r.dateSort).toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10);
            if (isEditing) {
              return (
                <div key={c.key} className={cls}>
                  <input
                    type="date"
                    autoFocus
                    defaultValue={seedISO}
                    onClick={(e) => e.stopPropagation()}
                    onChange={async (e) => {
                      const v = e.target.value;
                      setEditingDateId(null);
                      await onDateChange!(r.id, v || null);
                    }}
                    onBlur={() => setEditingDateId(null)}
                    className="text-[11px] rounded bg-zinc-900 border border-zinc-700 px-1 py-0.5 text-zinc-100 outline-none focus:border-emerald-500"
                  />
                </div>
              );
            }
            return (
              <div
                key={c.key}
                className={cls + (canEdit ? ' hover:bg-zinc-800/40 rounded px-1 -mx-1 cursor-pointer' : '')}
                onClick={canEdit ? (e) => { e.stopPropagation(); setEditingDateId(r.id); } : undefined}
                title={canEdit ? 'Click to reschedule' : undefined}
              >
                <span className="text-[11px] text-zinc-400 tabular-nums whitespace-nowrap">{r.date || (canEdit ? <span className="text-zinc-600 italic">set date</span> : '')}</span>
              </div>
            );
          }
          return null;
        })}
      </motion.div>
    );
  }
}

export default StudioListView;
