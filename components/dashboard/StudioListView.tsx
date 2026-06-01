import React from 'react';

/**
 * Shared status-grouped list view for the Posts and Lead Magnet studios.
 *
 * Readability benchmark = the ClickUp Post List (status groups + legible
 * columns), but tighter: a real thumbnail column, comfortable row height,
 * a clear scan anchor (status dot), and dim secondary text so the title
 * carries the row. Used by both studios so they share one definitive view.
 */

export type StudioRow = {
  id: string;
  title: string;
  excerpt?: string;
  status: string;
  thumbUrl?: string | null;
  /** short kicker shown over the thumbnail fallback, e.g. "CAROUSEL" / "CHECKLIST" */
  kicker?: string;
  date?: string;
  chips?: string[];
};

export type StatusMeta = { dot: string; label: string };

export function StudioListView({
  rows,
  statusOrder,
  statusMeta,
  pinned,
  onOpen,
}: {
  rows: StudioRow[];
  statusOrder: string[];
  statusMeta: Record<string, StatusMeta>;
  pinned?: Set<string>;
  onOpen: (id: string) => void;
}) {
  const byStatus = React.useMemo(() => {
    const m: Record<string, StudioRow[]> = {};
    for (const r of rows) (m[r.status] ||= []).push(r);
    return m;
  }, [rows]);

  // Statuses to show: ordered, present-or-pinned, plus any unknown trailing.
  const known = statusOrder.filter((s) => (byStatus[s]?.length || 0) > 0 || pinned?.has(s));
  const extra = Object.keys(byStatus).filter((s) => !statusOrder.includes(s));
  const groups = [...known, ...extra];

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden bg-zinc-950/30">
      {groups.map((status) => {
        const col = byStatus[status] || [];
        const meta = statusMeta[status] || { dot: 'bg-zinc-500', label: 'text-zinc-300' };
        return (
          <section key={status}>
            {/* Group header */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/70 border-y border-zinc-800/80 first:border-t-0">
              <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} />
              <span className={`text-[11px] font-semibold uppercase tracking-wide ${meta.label}`}>{status}</span>
              <span className="text-[11px] text-zinc-600">{col.length}</span>
            </div>
            {col.length === 0 ? (
              <div className="px-3 py-2.5 text-[12px] text-zinc-600 italic">none</div>
            ) : (
              col.map((r) => (
                <button
                  key={r.id}
                  onClick={() => onOpen(r.id)}
                  className="group w-full text-left grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 border-b border-zinc-800/50 last:border-b-0 hover:bg-zinc-900/60 transition"
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    {r.thumbUrl ? (
                      <img src={r.thumbUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <span className="text-[8px] uppercase tracking-wider text-emerald-500/50 font-mono px-1 text-center leading-tight">
                        {r.kicker || 'TEXT'}
                      </span>
                    )}
                  </div>
                  {/* Title + excerpt */}
                  <div className="min-w-0">
                    <div className="text-[13.5px] text-zinc-100 font-medium truncate group-hover:text-white">{r.title || '(untitled)'}</div>
                    {r.excerpt && <div className="text-[11.5px] text-zinc-500 truncate mt-0.5">{r.excerpt}</div>}
                  </div>
                  {/* Meta: chips + date */}
                  <div className="flex items-center gap-2 justify-end shrink-0">
                    {(r.chips || []).map((c, i) => (
                      <span key={i} className="hidden md:inline text-[10.5px] text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800/70 whitespace-nowrap">{c}</span>
                    ))}
                    {r.date && <span className="text-[11px] text-zinc-500 whitespace-nowrap tabular-nums">{r.date}</span>}
                  </div>
                </button>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}

export default StudioListView;
