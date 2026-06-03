import React, { useEffect, useMemo, useState } from 'react';
import { X, ImagePlus, Loader2, Search, Calendar, Play } from 'lucide-react';
import { listPostStills, type PostStill } from '../../lib/studioActions';

/**
 * Library picker — every image ever uploaded to the post-stills bucket,
 * shown as a thumbnail grid. Click one to apply to the current draft
 * (caller handles applyImageToDraft). Replaces the re-upload-every-time
 * pattern with a true reusable image library.
 *
 * Path convention is `${draft_id}/${cacheBust}.${ext}` so we annotate each
 * thumbnail with the draft it came from (helps the operator tell "this is
 * my Q2 ops audit photo" from "this is the founder portrait").
 */

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (still: PostStill) => void;
  /** Optional: highlight currently-applied image so the user sees what's on the draft. */
  currentUrl?: string | null;
}

export default function ImageLibraryPicker({ open, onClose, onPick, currentUrl }: Props) {
  const [items, setItems] = useState<PostStill[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    listPostStills(200)
      .then((list) => { if (!cancelled) setItems(list); })
      .catch((e) => { if (!cancelled) setErr(String(e?.message || e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter((it) => it.name.toLowerCase().includes(q) || it.fromDraftId.toLowerCase().includes(q));
  }, [items, query]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="bg-[color:var(--d-ink-2)] border border-[color:var(--d-rule-strong)] rounded-lg shadow-2xl w-[min(1100px,95vw)] max-h-[88vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[color:var(--d-rule-strong)] shrink-0">
          <ImagePlus className="w-4 h-4 text-zinc-400" />
          <div className="flex-1">
            <h3 className="dv-section-h">Image library</h3>
            <div className="text-[length:var(--t-sm)] text-[color:var(--d-paper-dimmer)]">
              {loading ? 'Loading…' : `${filtered.length} of ${items.length} image${items.length === 1 ? '' : 's'}`}
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by filename / draft id"
              className="pl-7 pr-2 py-1.5 text-[12px] bg-zinc-900 border border-zinc-800 rounded text-zinc-200 placeholder-zinc-600 w-[260px] focus:outline-none focus:border-emerald-500/60"
            />
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
            title="Close (Esc)"
          ><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading && (
            <div className="flex items-center justify-center py-16 text-zinc-500 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading library…
            </div>
          )}
          {err && !loading && (
            <div className="rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-[12.5px] text-red-300">
              Couldn't load library: {err}
            </div>
          )}
          {!loading && !err && filtered.length === 0 && (
            <div className="text-center py-16 text-[13px] text-zinc-500 italic">
              {items.length === 0 ? 'No images uploaded yet. Use "Upload image" to add one.' : 'No images match the filter.'}
            </div>
          )}
          {!loading && !err && filtered.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {filtered.map((it) => {
                const isCurrent = currentUrl && it.url === currentUrl;
                return (
                  <button
                    key={it.path}
                    onClick={() => { onPick(it); onClose(); }}
                    className={`group relative aspect-square rounded-md overflow-hidden border transition-colors ${
                      isCurrent ? 'border-emerald-500/70 ring-2 ring-emerald-500/30' : 'border-zinc-800/80 hover:border-zinc-600'
                    }`}
                    title={`${it.name} · from draft ${it.fromDraftId.slice(0, 8)}…`}
                  >
                    {it.kind === 'video' ? (
                      <>
                        <video src={it.url} className="w-full h-full object-cover bg-zinc-950" preload="metadata" muted playsInline />
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="w-9 h-9 rounded-full bg-black/60 ring-1 ring-white/40 flex items-center justify-center">
                            <Play className="w-4 h-4 text-white" fill="currentColor" />
                          </span>
                        </span>
                        <span className="absolute top-1.5 right-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-900/80 text-zinc-300 font-semibold">
                          Video
                        </span>
                      </>
                    ) : (
                      <img src={it.url} alt={it.name} className="w-full h-full object-cover bg-zinc-950" loading="lazy" />
                    )}
                    {isCurrent && (
                      <span className="absolute top-1.5 left-1.5 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500 text-zinc-900 font-semibold">
                        Current
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-black/80 to-transparent">
                      <div className="text-[10px] text-zinc-200 truncate flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5 shrink-0" />
                        {it.createdAt ? new Date(it.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' }) : it.name}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
