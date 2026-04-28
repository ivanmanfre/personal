import React, { useState } from 'react';
import { Plus, Archive, RefreshCw, Pencil } from 'lucide-react';
import { useTopicQueue, TopicQueueRow } from '../../hooks/useNewsletter';
import {
  upsertTopicQueueItem,
  archiveTopicQueueItem,
  requeueTopicQueueItem,
  toastError,
  toastSuccess,
} from '../../lib/dashboardActions';

const TopicQueueEditor: React.FC = () => {
  const { items, refresh } = useTopicQueue();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ thesis: '', cadence_hint: 'any', priority: 3, notes: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<TopicQueueRow>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function add() {
    if (!draft.thesis.trim()) return;
    setBusy('add');
    try {
      await upsertTopicQueueItem(draft);
      setDraft({ thesis: '', cadence_hint: 'any', priority: 3, notes: '' });
      setAdding(false);
      toastSuccess('Added');
      refresh();
    } catch (e) {
      toastError('add', e as Error);
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit(id: string) {
    setBusy(id);
    try {
      await upsertTopicQueueItem({ id, thesis: editDraft.thesis || '', cadence_hint: editDraft.cadence_hint, priority: editDraft.priority, notes: editDraft.notes || undefined });
      setEditingId(null);
      toastSuccess('Updated');
      refresh();
    } catch (e) {
      toastError('save', e as Error);
    } finally {
      setBusy(null);
    }
  }

  async function archive(id: string) {
    setBusy(id);
    try {
      await archiveTopicQueueItem(id);
      refresh();
    } catch (e) {
      toastError('archive', e as Error);
    } finally {
      setBusy(null);
    }
  }

  async function requeue(id: string) {
    setBusy(id);
    try {
      await requeueTopicQueueItem(id);
      refresh();
    } catch (e) {
      toastError('requeue', e as Error);
    } finally {
      setBusy(null);
    }
  }

  const queued = items.filter((i) => i.status === 'queued');
  const used = items.filter((i) => i.status === 'used');

  return (
    <div className="space-y-4">
      {!adding ? (
        <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-500">
          <Plus className="w-4 h-4" /> Add angle
        </button>
      ) : (
        <div className="border border-zinc-800 bg-zinc-900/40 rounded p-3 space-y-2">
          <textarea className="w-full bg-zinc-800/60 px-2 py-1.5 rounded text-sm" rows={2} placeholder="One-sentence thesis…" value={draft.thesis} onChange={(e) => setDraft({ ...draft, thesis: e.target.value })} />
          <div className="flex gap-2">
            <select className="bg-zinc-800/60 px-2 py-1 rounded text-xs" value={draft.cadence_hint} onChange={(e) => setDraft({ ...draft, cadence_hint: e.target.value })}>
              <option value="any">Any cadence</option>
              <option value="field_notes">Field Notes</option>
              <option value="hiring_wall">Hiring Wall</option>
              <option value="manifesto">Manifesto</option>
            </select>
            <select className="bg-zinc-800/60 px-2 py-1 rounded text-xs" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: parseInt(e.target.value) })}>
              {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>Priority {p}</option>)}
            </select>
          </div>
          <textarea className="w-full bg-zinc-800/60 px-2 py-1.5 rounded text-xs" rows={2} placeholder="Notes (optional)…" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
          <div className="flex gap-2">
            <button onClick={add} disabled={busy === 'add'} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-500 disabled:opacity-50">Save</button>
            <button onClick={() => { setAdding(false); setDraft({ thesis: '', cadence_hint: 'any', priority: 3, notes: '' }); }} className="px-3 py-1.5 border border-zinc-700 text-zinc-300 rounded text-sm hover:bg-zinc-800">Cancel</button>
          </div>
        </div>
      )}

      <section>
        <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-500 mb-2">Queued · {queued.length}</h3>
        <ul className="space-y-2">
          {queued.map((item) => {
            const editing = editingId === item.id;
            return (
              <li key={item.id} className="border border-zinc-800 bg-zinc-900/40 rounded p-3">
                {editing ? (
                  <div className="space-y-2">
                    <textarea className="w-full bg-zinc-800/60 px-2 py-1.5 rounded text-sm" rows={2} value={editDraft.thesis as string} onChange={(e) => setEditDraft({ ...editDraft, thesis: e.target.value })} />
                    <div className="flex gap-2 items-center">
                      <select className="bg-zinc-800/60 px-2 py-1 rounded text-xs" value={editDraft.cadence_hint} onChange={(e) => setEditDraft({ ...editDraft, cadence_hint: e.target.value as TopicQueueRow['cadence_hint'] })}>
                        <option value="any">Any</option>
                        <option value="field_notes">Field Notes</option>
                        <option value="hiring_wall">Hiring Wall</option>
                        <option value="manifesto">Manifesto</option>
                      </select>
                      <select className="bg-zinc-800/60 px-2 py-1 rounded text-xs" value={editDraft.priority} onChange={(e) => setEditDraft({ ...editDraft, priority: parseInt(e.target.value) })}>
                        {[1, 2, 3, 4, 5].map((p) => <option key={p} value={p}>P{p}</option>)}
                      </select>
                      <button onClick={() => saveEdit(item.id)} disabled={busy === item.id} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Save</button>
                      <button onClick={() => setEditingId(null)} className="px-2 py-1 border border-zinc-700 rounded text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm text-zinc-200">{item.thesis}</p>
                      <p className="text-xs text-zinc-500 mt-1 font-mono uppercase tracking-wider">{item.cadence_hint} · P{item.priority}</p>
                      {item.notes && <p className="text-xs text-zinc-400 italic mt-1">{item.notes}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingId(item.id); setEditDraft({ thesis: item.thesis, cadence_hint: item.cadence_hint, priority: item.priority, notes: item.notes || '' }); }} className="p-1 text-zinc-400 hover:text-zinc-200" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => archive(item.id)} disabled={busy === item.id} className="p-1 text-zinc-400 hover:text-red-400 disabled:opacity-50" title="Archive"><Archive className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {queued.length === 0 && <li className="text-zinc-500 text-sm italic">No queued angles.</li>}
        </ul>
      </section>

      {used.length > 0 && (
        <section>
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-500 mb-2">Used · {used.length}</h3>
          <ul className="space-y-1.5">
            {used.map((item) => (
              <li key={item.id} className="text-xs text-zinc-500 flex items-center justify-between">
                <span className="truncate flex-1">{item.thesis}</span>
                <button onClick={() => requeue(item.id)} disabled={busy === item.id} className="ml-2 p-1 text-zinc-400 hover:text-emerald-400 disabled:opacity-50" title="Re-queue"><RefreshCw className="w-3 h-3" /></button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default TopicQueueEditor;
