import React, { useState } from 'react';
import { ThumbsUp, X, Pencil, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { useNewsletterIdeas, IdeaRow } from '../../hooks/useNewsletter';
import {
  approveAndDraftIdea,
  rejectNewsletterIdea,
  updateNewsletterIdea,
  toastError,
  toastSuccess,
} from '../../lib/dashboardActions';

const CADENCE_LABEL: Record<string, string> = {
  field_notes: 'Field Notes',
  hiring_wall: 'Hiring Wall',
  manifesto: 'Manifesto',
};

const CADENCE_PILL_CLASS: Record<string, string> = {
  field_notes: 'bg-emerald-700/15 text-emerald-400 border-emerald-700/30',
  hiring_wall: 'bg-zinc-300/15 text-zinc-300 border-zinc-300/30',
  manifesto: 'bg-zinc-800/30 text-zinc-400 border-zinc-700/30',
};

const IdeaInboxPanel: React.FC = () => {
  const { ideas, refresh } = useNewsletterIdeas();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPatch, setEditPatch] = useState<Partial<IdeaRow>>({});

  const proposed = ideas.filter((i) => i.status === 'proposed');
  const approved = ideas.filter((i) => i.status === 'approved');
  const drafted = ideas.filter((i) => i.status === 'drafted').slice(0, 5);

  async function onApprove(idea: IdeaRow) {
    setBusyId(idea.id);
    try {
      const res = await approveAndDraftIdea(idea.id);
      if (!res.ok) throw new Error(res.error || 'Draft failed');
      toastSuccess('Approved · drafting in background');
      refresh();
    } catch (e) {
      toastError('approve', e as Error);
    } finally {
      setBusyId(null);
    }
  }

  async function onReject(idea: IdeaRow) {
    if (!confirm('Reject this idea? It will be hidden from the inbox.')) return;
    setBusyId(idea.id);
    try {
      await rejectNewsletterIdea(idea.id);
      toastSuccess('Rejected');
      refresh();
    } catch (e) {
      toastError('reject', e as Error);
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(idea: IdeaRow) {
    setEditingId(idea.id);
    setEditPatch({
      subject: idea.subject,
      preview: idea.preview,
      hook_one_liner: idea.hook_one_liner,
      recommended_cadence: idea.recommended_cadence,
    });
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    try {
      await updateNewsletterIdea(id, editPatch as { subject?: string; preview?: string; hook_one_liner?: string; recommended_cadence?: string });
      setEditingId(null);
      toastSuccess('Updated');
      refresh();
    } catch (e) {
      toastError('save', e as Error);
    } finally {
      setBusyId(null);
    }
  }

  function renderIdea(idea: IdeaRow) {
    const editing = editingId === idea.id;
    return (
      <li key={idea.id} className="border border-zinc-800 bg-zinc-900/40 rounded p-4 mb-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center px-2 py-0.5 text-[10px] uppercase tracking-wider border rounded ${CADENCE_PILL_CLASS[idea.recommended_cadence] || ''}`}>
              {CADENCE_LABEL[idea.recommended_cadence] || idea.recommended_cadence}
            </span>
            <span className="font-serif italic text-emerald-500 text-2xl leading-none">{idea.score}</span>
          </div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">From: {idea.source_signal_type.replace(/_/g, ' ')}</span>
        </div>

        {editing ? (
          <div className="space-y-2 mb-3">
            <input className="w-full bg-zinc-800/60 px-2 py-1 rounded text-sm" value={editPatch.subject || ''} onChange={(e) => setEditPatch((p) => ({ ...p, subject: e.target.value }))} placeholder="Subject" />
            <input className="w-full bg-zinc-800/60 px-2 py-1 rounded text-sm italic text-zinc-300" value={editPatch.hook_one_liner || ''} onChange={(e) => setEditPatch((p) => ({ ...p, hook_one_liner: e.target.value }))} placeholder="Hook one-liner" />
            <input className="w-full bg-zinc-800/60 px-2 py-1 rounded text-xs text-zinc-400" placeholder="Preview text" value={editPatch.preview || ''} onChange={(e) => setEditPatch((p) => ({ ...p, preview: e.target.value }))} />
            <select className="bg-zinc-800/60 px-2 py-1 rounded text-xs" value={editPatch.recommended_cadence} onChange={(e) => setEditPatch((p) => ({ ...p, recommended_cadence: e.target.value as IdeaRow['recommended_cadence'] }))}>
              <option value="field_notes">Field Notes</option>
              <option value="hiring_wall">Hiring Wall</option>
              <option value="manifesto">Manifesto</option>
            </select>
          </div>
        ) : (
          <>
            <h4 className="text-base font-semibold text-zinc-100 mb-1">{idea.subject}</h4>
            <p className="text-sm italic text-zinc-400 mb-2">{idea.hook_one_liner}</p>
            {idea.reasoning && (
              <p className="text-xs text-zinc-500 mb-2">
                <span className="font-mono uppercase tracking-wider text-zinc-600">Why: </span>
                {idea.reasoning}
              </p>
            )}
            {idea.source_excerpt && (
              <p className="text-xs text-zinc-500 italic line-clamp-2">"{idea.source_excerpt}"</p>
            )}
          </>
        )}

        {idea.status === 'proposed' && (
          <div className="flex items-center gap-2 mt-3">
            {!editing ? (
              <>
                <button onClick={() => onApprove(idea)} disabled={busyId === idea.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">
                  {busyId === idea.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                  Approve
                </button>
                <button onClick={() => startEdit(idea)} disabled={busyId === idea.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 text-zinc-300 rounded text-sm hover:bg-zinc-800 disabled:opacity-50">
                  <Pencil className="w-4 h-4" /> Edit
                </button>
                <button onClick={() => onReject(idea)} disabled={busyId === idea.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-400 rounded text-sm hover:bg-red-950/30 disabled:opacity-50 ml-auto">
                  <X className="w-4 h-4" /> Reject
                </button>
              </>
            ) : (
              <>
                <button onClick={() => saveEdit(idea.id)} disabled={busyId === idea.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-500 disabled:opacity-50">
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 text-zinc-300 rounded text-sm hover:bg-zinc-800">
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
        {idea.status === 'approved' && (
          <div className="text-xs text-emerald-400 mt-3 inline-flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" /> Drafting…
          </div>
        )}
        {idea.status === 'drafted' && idea.linked_issue_id && (
          <div className="text-xs text-emerald-500 mt-3 inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" /> Drafted + scheduled
            <a href={`#issue-${idea.linked_issue_id}`} className="ml-2 underline inline-flex items-center gap-0.5">
              View <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-6">
      {proposed.length === 0 && approved.length === 0 && drafted.length === 0 && (
        <div className="text-zinc-500 text-sm italic py-8 text-center">
          No ideas yet. Sunday cron will populate the inbox.
        </div>
      )}

      {proposed.length > 0 && (
        <section>
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-500 mb-2">Proposed · {proposed.length}</h3>
          <ul>{proposed.map(renderIdea)}</ul>
        </section>
      )}

      {approved.length > 0 && (
        <section>
          <h3 className="font-mono text-xs uppercase tracking-wider text-emerald-500 mb-2">Approved · drafting</h3>
          <ul>{approved.map(renderIdea)}</ul>
        </section>
      )}

      {drafted.length > 0 && (
        <section>
          <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-500 mb-2">Recently drafted</h3>
          <ul>{drafted.map(renderIdea)}</ul>
        </section>
      )}
    </div>
  );
};

export default IdeaInboxPanel;
