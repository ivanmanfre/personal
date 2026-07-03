import React, { useEffect, useMemo, useState } from 'react';
import { X, History, RotateCcw, Loader2 } from 'lucide-react';
import { usePromptVersions, PromptVersion } from '../../hooks/usePromptVersions';
import { lineDiff, diffStats } from '../../lib/lineDiff';

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

/**
 * Right-anchored drawer showing a prompt's version history with a line diff of
 * the selected version against the one before it. "Load into editor" hands the
 * chosen body back to the editor as an unsaved draft (a save re-bumps version).
 */
const PromptHistoryDrawer: React.FC<{
  slug: string | null;
  open: boolean;
  onClose: () => void;
  onRestore: (body: string, title: string) => void;
}> = ({ slug, open, onClose, onRestore }) => {
  const { versions, loading } = usePromptVersions(open ? slug : null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);

  // Default to the newest version whenever the list (re)loads.
  useEffect(() => {
    if (versions.length) setSelectedVersion((v) => (v && versions.some((x) => x.version === v) ? v : versions[0].version));
    else setSelectedVersion(null);
  }, [versions]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const selected = versions.find((v) => v.version === selectedVersion) || null;
  const prev = useMemo<PromptVersion | null>(() => {
    if (!selected) return null;
    // The next-lower version present in the list (history may skip numbers).
    return versions.filter((v) => v.version < selected.version).sort((a, b) => b.version - a.version)[0] || null;
  }, [versions, selected]);

  const ops = useMemo(() => {
    if (!selected) return [];
    return lineDiff(prev?.body ?? '', selected.body ?? '');
  }, [selected, prev]);
  const stats = useMemo(() => diffStats(ops), [ops]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose} role="dialog" aria-modal="true" aria-label="Prompt version history">
      <div className="w-full max-w-3xl h-full bg-[var(--d-surface)] border-l border-[var(--d-rule-strong)] shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-[var(--d-rule)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <History className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[13px] font-semibold text-zinc-100 truncate">Version history</span>
            {slug && <span className="text-[11px] font-mono text-zinc-500 truncate">{slug}</span>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300" aria-label="close"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* version list */}
          <div className="w-52 shrink-0 border-r border-[var(--d-rule)] overflow-y-auto">
            {loading ? (
              <div className="p-3 text-[11.5px] text-zinc-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
            ) : versions.length === 0 ? (
              <div className="p-3 text-[11.5px] text-zinc-500 italic">No history yet. New saves are recorded from now on.</div>
            ) : (
              <ul>
                {versions.map((v) => (
                  <li key={v.version}>
                    <button
                      onClick={() => setSelectedVersion(v.version)}
                      className={`w-full text-left px-3 py-2 border-b border-[var(--d-rule)]/60 ${v.version === selectedVersion ? 'bg-emerald-500/10' : 'hover:bg-zinc-800/30'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-zinc-200">v{v.version}</span>
                        <span className="text-[10.5px] text-zinc-500">{relTime(v.changedAt)}</span>
                      </div>
                      <div className="text-[10.5px] text-zinc-500 truncate">by {v.updatedBy ?? 'unknown'}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* diff */}
          <div className="flex-1 min-w-0 flex flex-col">
            {selected ? (
              <>
                <div className="px-4 py-2 border-b border-[var(--d-rule)] flex items-center justify-between gap-3 shrink-0">
                  <div className="text-[11.5px] text-zinc-400 min-w-0 truncate">
                    {prev ? <>Changes from <b className="text-zinc-300">v{prev.version}</b> → <b className="text-zinc-300">v{selected.version}</b></> : <>Initial version <b className="text-zinc-300">v{selected.version}</b></>}
                    <span className="ml-2 text-emerald-400">+{stats.added}</span>
                    <span className="ml-1.5 text-red-400">−{stats.removed}</span>
                  </div>
                  <button
                    onClick={() => onRestore(selected.body ?? '', selected.title ?? '')}
                    className="shrink-0 inline-flex items-center gap-1.5 px-2.5 min-h-[30px] rounded-md text-[11.5px] font-medium border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
                    title="Load this version's body into the editor as an unsaved draft"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Load into editor
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-auto font-mono text-[11px] leading-relaxed">
                  {ops.map((op, i) => (
                    <div
                      key={i}
                      className={
                        op.type === 'add' ? 'bg-emerald-500/10 text-emerald-300 px-3 whitespace-pre-wrap'
                        : op.type === 'del' ? 'bg-red-500/10 text-red-300 px-3 whitespace-pre-wrap'
                        : 'text-zinc-500 px-3 whitespace-pre-wrap'
                      }
                    >
                      <span className="select-none opacity-60 mr-2">{op.type === 'add' ? '+' : op.type === 'del' ? '−' : ' '}</span>
                      {op.text || ' '}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-[12px] text-zinc-500 italic">Select a version.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptHistoryDrawer;
