import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, ArrowUpDown, Trash2 } from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'framer-motion';
import { ListRowSkeleton } from '../ui/primitives';
import { statusLabel } from '../../lib/statusLabels';

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

// Smart date format — relative for near dates, absolute for far. Returns a
// {primary, tint} pair so we can color past-due rows red, near-future amber.
function formatSmartDate(ms: number | undefined, hasRow = true): { text: string; tint: string } {
  if (!ms || !hasRow) return { text: '', tint: '' };
  const now = Date.now();
  const diffMs = ms - now;
  const absHr = Math.abs(diffMs) / 3600_000;
  const absD = Math.abs(diffMs) / 86_400_000;
  if (diffMs > 0) {
    // future
    if (absHr < 24) return { text: `in ${Math.round(absHr)}h`, tint: 'text-amber-600' };
    if (absD < 7) return { text: `in ${Math.round(absD)}d`, tint: 'text-emerald-600' };
    return { text: new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), tint: 'text-[var(--ds-dim)]' };
  } else {
    // past
    if (absHr < 1) return { text: 'just now', tint: 'text-[var(--ds-dim)]' };
    if (absHr < 24) return { text: `${Math.round(absHr)}h ago`, tint: 'text-[var(--ds-dim)]' };
    if (absD < 7) return { text: `${Math.round(absD)}d ago`, tint: 'text-[var(--ds-dim)]' };
    if (absD < 365) return { text: new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), tint: 'text-[var(--ds-faint)]' };
    return { text: new Date(ms).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), tint: 'text-[var(--ds-faint)]' };
  }
}
const STRENGTH_TINT: Record<string, string> = {
  High:   'text-emerald-700 bg-emerald-50 border-emerald-200',
  Medium: 'text-amber-700 bg-amber-50 border-amber-200',
  Low:    'text-slate-500 bg-slate-50 border-slate-200',
};

// Post-type chip — full label + color. Replaces the cryptic TXT/IMG/CAR
// kicker in the thumbnail and the raw "single_image" string in the format cell.
const TYPE_LABEL: Record<string, string> = {
  text: 'Text',
  single_image: 'Single image',
  carousel: 'Carousel',
};
const TYPE_TINT: Record<string, string> = {
  text:         'text-slate-600 bg-slate-100 border border-slate-200',
  single_image: 'text-sky-700 bg-sky-50 border border-sky-100',
  carousel:     'text-violet-700 bg-violet-50 border border-violet-100',
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
  /** Statuses that always render their group header even when empty (0 rows).
   *  Gives the user the same pipeline-overview shape every time — "0 in review"
   *  at the same scan position as "12 in review". */
  pinnedStatuses = [],
  dense = false,
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
  pinnedStatuses?: string[];
  statusChoices?: string[];
  onStatusChange?: (id: string, status: string) => Promise<void> | void;
  onDateChange?: (id: string, isoDate: string | null) => Promise<void> | void;
  /** Dense mode for Table view: no thumbnails, no groups, tighter rows, all
   *  columns visible regardless of viewport (horizontal scroll if needed). */
  dense?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();

  // Per-status collapse state (only used when groupByStatus is on).
  // Default: non-empty groups are EXPANDED so real content fills the screen on
  // first load. Only genuinely empty (0-count) groups are collapsed. The user
  // can still collapse any group manually; that choice is persisted.
  // Persisted to localStorage so user's expansion choices survive reloads.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    if (!groupByStatus || typeof window === 'undefined') {
      // No persistence key — collapse nothing (flat view or SSR).
      return new Set<string>();
    }
    try {
      const raw = localStorage.getItem(`studio-collapse-${groupByStatus}`);
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch {}
    // First visit — start with empty set (all groups expanded).
    // Groups with 0 rows are hidden entirely (see render logic below),
    // so this effectively means "show all real content immediately."
    return new Set<string>();
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

  // Track each row's last-seen status. When it changes, mark the row for a brief
  // emerald flash so external transitions (workflow flips, auto-refresh) are
  // visible to the user — not just silent re-renders.
  const prevStatusRef = React.useRef<Map<string, string>>(new Map());
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  React.useEffect(() => {
    const newly: string[] = [];
    for (const r of rows) {
      const prev = prevStatusRef.current.get(r.id);
      if (prev && prev !== r.status) newly.push(r.id);
      prevStatusRef.current.set(r.id, r.status);
    }
    if (newly.length === 0) return;
    setFlashIds((s) => { const n = new Set(s); newly.forEach((i) => n.add(i)); return n; });
    const t = setTimeout(() => {
      setFlashIds((s) => { const n = new Set(s); newly.forEach((i) => n.delete(i)); return n; });
    }, 1500);
    return () => clearTimeout(t);
  }, [rows]);

  // Media lightbox — click a row thumbnail to view media at full size
  // without opening the editor. Stores the row currently being previewed.
  const [previewRow, setPreviewRow] = useState<StudioRow | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const clearSelection = () => setSelected(new Set());
  const selectAll = (ids: string[]) => setSelected(new Set(ids));
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Persisted column order — drag a column header to reorder. Keyed by
  // groupByStatus prop so post + LM lists keep separate orders. Falls back
  // to the default ALL_COLS order when no saved order exists or schema drifted.
  const orderKey = `studio-cols-${groupByStatus || 'flat'}`;
  const [customOrder, setCustomOrder] = useState<SortKey[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(orderKey);
      if (raw) return JSON.parse(raw) as SortKey[];
    } catch {}
    return [];
  });
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(orderKey, JSON.stringify(customOrder)); } catch {}
  }, [customOrder, orderKey]);
  const [draggingCol, setDraggingCol] = useState<SortKey | null>(null);

  const cols = useMemo(() => {
    const skipStatus = !!groupByStatus && !onStatusChange;
    const allKeys = ALL_COLS.map((c) => c.key);
    // Apply custom order first, then any keys not in custom order keep default position
    const ordered = customOrder.length
      ? [...customOrder.filter((k) => allKeys.includes(k)), ...allKeys.filter((k) => !customOrder.includes(k))]
      : allKeys;
    return ordered
      .map((k) => ALL_COLS.find((c) => c.key === k)!)
      .filter((c) => !hiddenCols.has(c.key) && !(skipStatus && c.key === 'status'));
  }, [hiddenCols, groupByStatus, onStatusChange, customOrder]);

  function reorderCols(dragged: SortKey, dropTarget: SortKey) {
    if (dragged === dropTarget) return;
    const allKeys = ALL_COLS.map((c) => c.key);
    const base = customOrder.length ? [...customOrder] : [...allKeys];
    const from = base.indexOf(dragged);
    if (from === -1) base.push(dragged);
    base.splice(base.indexOf(dragged), 1);
    const to = base.indexOf(dropTarget);
    if (to === -1) {
      base.push(dragged);
    } else {
      base.splice(to, 0, dragged);
    }
    // Make sure every key is represented so future renders are stable
    for (const k of allKeys) if (!base.includes(k)) base.push(k);
    setCustomOrder(base);
  }
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

  const colClass = (visible?: string) => {
    // In dense (Table) mode, force all columns visible regardless of width —
    // intent is a spreadsheet, even if it horizontally scrolls.
    if (dense) return 'flex';
    // Container queries (Tailwind v4 native) — column visibility tracks the
    // LIST's own width, not the viewport. Matters when the list is rendered
    // inside a narrower parent (mobile drawer, side panel, future split-pane)
    // where the previous md:/lg: viewport breakpoints overcrowded the row.
    // @3xl = 768px container width; @5xl = 1024px.
    return visible === 'gte-md' ? 'hidden @3xl:flex' :
      visible === 'gte-lg' ? 'hidden @5xl:flex' : 'flex';
  };

  return (
    <div className="@container rounded-xl border border-[var(--ds-line)] overflow-hidden bg-[var(--ds-card)] shadow-sm">
      {/* Bulk action bar — shown when any rows are selected */}
      {onBulkAction && selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-[var(--ds-accent)]/5 border-b border-[var(--ds-accent)]/20 text-[12px] text-[var(--ds-ink)]">
          <span className="font-medium">{selected.size} selected</span>
          <button onClick={clearSelection} className="text-[var(--ds-dim)] hover:text-[var(--ds-ink)]">Clear</button>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => { onBulkAction('disqualify', Array.from(selected)); clearSelection(); }}
              className="px-2.5 py-1 rounded border border-[var(--ds-line)] bg-[var(--ds-card)] hover:bg-[var(--ds-bg)] text-[var(--ds-ink)] transition-colors"
            >Disqualify</button>
            <button
              onClick={() => { if (confirm(`Delete ${selected.size} row(s)? This can't be undone.`)) { onBulkAction('delete', Array.from(selected)); clearSelection(); } }}
              className="px-2.5 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-colors"
            >Delete</button>
          </div>
        </div>
      )}

      {/* Column header — sentence case, no uppercase. Hidden under md (768px)
          because the row collapses to a stacked card layout there. */}
      <div
        className="hidden md:grid items-center gap-3 px-4 py-2.5 bg-[var(--ds-bg)] border-b border-[var(--ds-line)] text-[12px] text-[var(--ds-dim)] font-semibold tracking-[0.08em] uppercase sticky top-0 z-10"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {onBulkAction && (
          <input
            type="checkbox"
            checked={selected.size > 0 && selected.size === rows.length}
            ref={(el) => { if (el) el.indeterminate = selected.size > 0 && selected.size < rows.length; }}
            onChange={(e) => { e.target.checked ? selectAll(rows.map((r) => r.id)) : clearSelection(); }}
            className="w-3.5 h-3.5 rounded accent-[var(--ds-accent)] cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {cols.map((c) => {
          const active = sortKey === c.key;
          const isDragging = draggingCol === c.key;
          return (
            <button
              key={c.key}
              onClick={() => toggleSort(c.key)}
              draggable
              onDragStart={(e) => {
                setDraggingCol(c.key);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/x-col', c.key);
              }}
              onDragEnd={() => setDraggingCol(null)}
              onDragOver={(e) => {
                if (draggingCol && draggingCol !== c.key) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const dragged = (e.dataTransfer.getData('text/x-col') || draggingCol || '') as SortKey;
                if (dragged) reorderCols(dragged, c.key);
                setDraggingCol(null);
              }}
              className={`${colClass(c.visible)} items-center gap-1 ${active ? 'text-[var(--ds-ink)]' : 'hover:text-[var(--ds-dim)]'} text-left transition-colors cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-50' : ''} ${draggingCol && draggingCol !== c.key ? 'hover:bg-[var(--ds-accent)]/5 rounded' : ''}`}
              title="Drag to reorder · click to sort"
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
        <div className="px-6 py-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-[var(--ds-bg)] border border-[var(--ds-line)] flex items-center justify-center mb-3">
            <ChevronDown className="w-5 h-5 text-[var(--ds-faint)] rotate-[-45deg]" />
          </div>
          <div className="text-[13px] text-[var(--ds-ink)] font-medium">No matching rows</div>
          <div className="text-[12px] text-[var(--ds-dim)] mt-0.5">Try clearing the filters above.</div>
        </div>
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
            // Always render statusOrder entries (gives pipeline shape), plus
            // any pinned statuses, plus any statuses present in rows but not
            // in either list ("Other"). Empty groups still render their header.
            const seen = new Set<string>();
            const ordered: string[] = [];
            for (const s of statusOrder) { if (!seen.has(s)) { ordered.push(s); seen.add(s); } }
            for (const s of pinnedStatuses) { if (!seen.has(s)) { ordered.push(s); seen.add(s); } }
            for (const s of byStatus.keys()) { if (!seen.has(s)) { ordered.push(s); seen.add(s); } }
            return ordered.map((status) => {
              const groupRows = byStatus.get(status) || [];
              // Hide 0-count groups entirely — no phantom/empty buckets cluttering
              // the default view. Populated groups always render (even if not in
              // statusOrder or pinnedStatuses). Empty groups are always hidden so
              // the screen shows real content, not "Idea 0 / Approved 0 / Error 0".
              if (groupRows.length === 0) return null;
              const meta = statusMeta[status] || { dot: 'bg-slate-400', label: 'text-[var(--ds-dim)]' };
              const isCollapsed = collapsed.has(status);
              return (
                <div key={status} className="border-t border-[var(--ds-line)] border-b border-[var(--ds-line)] last:border-b-0">
                  <button
                    onClick={() => toggleGroup(status)}
                    className="w-full flex items-center gap-2 px-4 py-3 transition-all text-left bg-[var(--ds-bg)] hover:bg-[#f1f1f5]"
                  >
                    {isCollapsed
                      ? <ChevronRight className="w-3.5 h-3.5 text-[var(--ds-faint)] transition-transform" />
                      : <ChevronDown className="w-3.5 h-3.5 text-[var(--ds-dim)] transition-transform" />}
                    <span className={`inline-block w-2 h-2 rounded-full ring-2 ring-current/10 ${meta.dot}`} />
                    <span className="text-[13px] font-semibold text-[var(--ds-ink)]">{statusLabel(status)}</span>
                    <span className="dv-editorial-num text-[length:var(--t-sm)] ml-0.5">{groupRows.length}</span>
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
      {previewRow && previewRow.thumbUrl && (
        <MediaLightbox row={previewRow} onClose={() => setPreviewRow(null)} />
      )}
    </div>
  );

  function renderRow(r: StudioRow, i: number) {
    const meta = statusMeta[r.status] || { dot: 'bg-slate-400', label: 'text-[var(--ds-dim)]' };
    // Mobile (<md): flex column, cells wrap as chips underneath the title.
    // Desktop (>=md): grid with column-aligned cells. Style is conditional —
    // grid template only applied at md+.
    return (
      <motion.div
        key={r.id}
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.14, ease: 'easeOut', delay: Math.min(i * 0.03, 0.3) }}
        onClick={() => onOpen(r.id)}
        role="button"
        tabIndex={0}
        aria-label={`Open ${r.title || 'post'}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(r.id); } }}
        className={`group relative w-full ${dense ? 'grid' : 'flex flex-wrap md:grid'} items-center gap-x-3 gap-y-1 ${dense ? 'px-3 py-2' : 'px-4 py-3.5'} text-left border-b border-[var(--ds-line)] last:border-b-0 hover:bg-[#fafafc] transition-colors cursor-pointer has-[:checked]:bg-[var(--ds-accent)]/5 has-[:checked]:ring-1 has-[:checked]:ring-inset has-[:checked]:ring-[var(--ds-accent)]/20 ${flashIds.has(r.id) ? 'animate-status-flash' : ''}`}
        // gridTemplateColumns only takes effect when display:grid is active (md+);
        // flexbox layout below md ignores it, so cells wrap naturally as chips.
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {onBulkAction && (
          <label
            className="flex items-center justify-center w-8 h-8 cursor-pointer shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={(e) => { e.stopPropagation(); toggleOne(r.id); }}
              onClick={(e) => e.stopPropagation()}
              className="w-3.5 h-3.5 rounded accent-emerald-500 cursor-pointer"
            />
          </label>
        )}
        {cols.map((c) => {
          const cls = `${colClass(c.visible)} items-center min-w-0`;
          if (c.key === 'title') {
            // On mobile, title takes full row width; on desktop, intrinsic grid cell.
            return (
              <div key={c.key} className={cls + ' gap-2.5 basis-full md:basis-auto'}>
                {!dense && (
                  <button
                    type="button"
                    onClick={r.thumbUrl ? (e) => { e.stopPropagation(); setPreviewRow(r); } : undefined}
                    disabled={!r.thumbUrl}
                    title={r.thumbUrl ? 'Click to preview media' : undefined}
                    className={`w-9 h-9 rounded-lg overflow-hidden bg-[var(--ds-bg)] border border-[var(--ds-line)] flex items-center justify-center shrink-0 ${r.thumbUrl ? 'hover:border-[var(--ds-accent)]/40 hover:scale-105 transition-all cursor-zoom-in' : ''}`}
                  >
                    {r.thumbUrl ? (
                      <img src={r.thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : r.formatLabel === 'carousel' ? (
                      // Modern carousel glyph instead of letters
                      <div className="flex gap-[1.5px]">
                        <span className="w-[3px] h-3.5 bg-violet-400/70 rounded-sm" />
                        <span className="w-[3px] h-3.5 bg-violet-400/50 rounded-sm" />
                        <span className="w-[3px] h-3.5 bg-violet-400/30 rounded-sm" />
                      </div>
                    ) : r.formatLabel === 'single_image' ? (
                      <div className="w-3.5 h-3.5 rounded-sm bg-sky-200 border border-sky-300" />
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="w-3 h-[2px] bg-slate-300 rounded-sm" />
                        <span className="w-2.5 h-[2px] bg-slate-200 rounded-sm" />
                        <span className="w-2 h-[2px] bg-slate-100 rounded-sm" />
                      </div>
                    )}
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <div className={`${dense ? 'text-[12px]' : 'text-[14px]'} text-[var(--ds-ink)] truncate font-medium`}>{r.title || '(untitled)'}</div>
                  {r.excerpt && !dense && <div className="text-[12px] text-[var(--ds-faint)] truncate mt-0.5">{r.excerpt}</div>}
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
                    className="text-[12px] rounded bg-[var(--ds-card)] border border-[var(--ds-line)] px-1.5 py-0.5 text-[var(--ds-ink)] outline-none focus:border-[var(--ds-accent)]"
                  >
                    {statusChoices!.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </div>
              );
            }
            return (
              <div
                key={c.key}
                className={cls + ' gap-1.5' + (canEdit ? ' hover:bg-black/[.03] rounded px-1 -mx-1' : '')}
                onClick={canEdit ? (e) => { e.stopPropagation(); setEditingStatusId(r.id); } : undefined}
                title={canEdit ? 'Click to change status' : undefined}
              >
                {/* Status pill morphs when status changes — AnimatePresence keyed by status.
                    Dropped the redundant inner dot-scale (parent pill scale conveys it).
                    role='status' + aria-live='polite' announces flips to AT.
                    Motion gates on prefers-reduced-motion (no scale/opacity for that user). */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={r.status}
                    initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.85, y: -3 }}
                    animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 3 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.22, ease: 'easeOut' }}
                    className="flex items-center gap-1.5"
                    role="status"
                    aria-live="polite"
                    aria-label={`Status: ${statusLabel(r.status)}`}
                  >
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${(meta as any).pill || 'bg-slate-100 text-slate-600'} border-current/10`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                      {statusLabel(r.status)}
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>
            );
          }
          if (c.key === 'pillar')    return <div key={c.key} className={cls}><span className="text-[12px] text-[var(--ds-dim)] truncate">{r.pillar || ''}</span></div>;
          if (c.key === 'hookType')  return <div key={c.key} className={cls}><span className="text-[12px] text-[var(--ds-dim)] truncate">{r.hookType || ''}</span></div>;
          if (c.key === 'valueTier') return <div key={c.key} className={cls}><span className="text-[12px] text-[var(--ds-dim)] truncate">{r.valueTier || ''}</span></div>;
          if (c.key === 'strength') {
            const t = r.topicStrength || '';
            if (!t) return <div key={c.key} className={cls} />;
            return (
              <div key={c.key} className={cls}>
                <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[12px] font-medium ${STRENGTH_TINT[t] || STRENGTH_TINT.Low}`}>{t}</span>
              </div>
            );
          }
          if (c.key === 'format') {
            const fmt = r.formatLabel || '';
            const tint = TYPE_TINT[fmt];
            return (
              <div key={c.key} className={cls}>
                {fmt && tint ? (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-medium ${tint}`}>
                    {TYPE_LABEL[fmt] || fmt}
                  </span>
                ) : fmt ? (
                  <span className="text-[12px] text-[var(--ds-dim)] truncate">{fmt}</span>
                ) : null}
              </div>
            );
          }
          if (c.key === 'source') {
            const src = r.source || '';
            if (!src) return <div key={c.key} className={cls} />;
            const srcTint = /call|client/i.test(src) ? 'text-sky-700 bg-sky-50'
              : /web|research/i.test(src) ? 'text-violet-700 bg-violet-50'
              : /competitor/i.test(src) ? 'text-amber-700 bg-amber-50'
              : /curator|lm_/i.test(src) ? 'text-emerald-700 bg-emerald-50'
              : 'text-slate-500 bg-slate-100';
            return (
              <div key={c.key} className={cls}>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[12px] font-medium truncate ${srcTint}`}>{src}</span>
              </div>
            );
          }
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
                    className="text-[12px] rounded bg-[var(--ds-card)] border border-[var(--ds-line)] px-1 py-0.5 text-[var(--ds-ink)] outline-none focus:border-[var(--ds-accent)]"
                  />
                </div>
              );
            }
            const smart = formatSmartDate(r.dateSort, !!r.date);
            return (
              <div
                key={c.key}
                className={cls + (canEdit ? ' hover:bg-black/[.03] rounded-md px-1.5 -mx-1.5 py-0.5 -my-0.5 cursor-pointer transition-colors' : '')}
                onClick={canEdit ? (e) => { e.stopPropagation(); setEditingDateId(r.id); } : undefined}
                title={canEdit ? `Click to reschedule — ${r.date || ''}` : (r.date || undefined)}
              >
                {smart.text ? (
                  <span className={`text-[12px] tabular-nums whitespace-nowrap font-medium ${smart.tint}`}>{smart.text}</span>
                ) : canEdit ? (
                  <span className="text-[var(--ds-faint)] italic text-[12px]">set date</span>
                ) : null}
              </div>
            );
          }
          return null;
        })}
        {/* Per-row delete — hover-revealed, far-right edge (sits over the empty
            tail of the Date cell). Reuses the same bulk 'delete' path so the
            optimistic-hide + realtime reconcile behaviour is identical. */}
        {onBulkAction && (
          <button
            type="button"
            aria-label="Delete"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              if (!confirm(`Delete "${r.title || 'this item'}" permanently? This can't be undone.`)) return;
              onBulkAction('delete', [r.id]);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-md text-[var(--ds-faint)] bg-[var(--ds-card)] border border-[var(--ds-line)] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </motion.div>
    );
  }
}

/** Lightbox modal — used for quick media preview when clicking a row's thumbnail.
 *  Plays nice with Drive PDF URLs (rendered as Drive's /preview iframe) AND
 *  direct image URLs. Backdrop click or Escape closes. */
const MediaLightbox: React.FC<{ row: StudioRow; onClose: () => void }> = ({ row, onClose }) => {
  React.useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose]);
  const url = row.thumbUrl || '';
  // Detect Drive thumbnail → swap for the higher-res preview
  const driveMatch = url.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/) || url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  const isDrive = !!driveMatch;
  const driveId = driveMatch?.[1];
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl w-full max-h-[90vh] rounded-2xl overflow-hidden ring-1 ring-[var(--ds-line)] bg-[var(--ds-card)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--ds-line)] bg-[var(--ds-card)]">
          <span className="text-[13px] text-[var(--ds-ink)] truncate flex-1 font-medium">{row.title}</span>
          <button
            onClick={onClose}
            className="text-[var(--ds-dim)] hover:text-[var(--ds-ink)] text-[18px] leading-none px-2 py-0.5 rounded hover:bg-black/5 transition-colors"
            title="Close (Esc)"
          >×</button>
        </div>
        <div className="bg-[var(--ds-bg)] flex items-center justify-center" style={{ minHeight: 400 }}>
          {isDrive && driveId ? (
            <iframe
              src={`https://drive.google.com/file/d/${driveId}/preview`}
              className="w-full h-[75vh] border-0"
              title="Media preview"
            />
          ) : (
            <img src={url} alt={row.title} className="max-w-full max-h-[75vh] object-contain" />
          )}
        </div>
      </div>
    </div>
  );
};

export default StudioListView;
