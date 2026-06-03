import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { dashboardAction } from '../../lib/dashboardActions';
import { renderLightMarkdown } from '../../lib/lightMarkdown';

type Draft = {
  id: string;
  kind: 'new' | 'refine_additive' | 'refine_structural' | 'prune_candidate';
  skill_name: string;
  status: 'applied' | 'pending' | 'approved' | 'rejected';
  draft_md: string | null;
  diff: string | null;
  backup_path: string | null;
  created_at: string;
  rationale: string | null;
};

const KIND_LABEL: Record<Draft['kind'], string> = {
  new: 'New skill',
  refine_additive: 'Additive refine',
  refine_structural: 'Structural edit',
  prune_candidate: 'Prune candidate',
};

const preCls =
  'whitespace-pre-wrap font-mono text-[11.5px] text-zinc-300 bg-zinc-950/70 ' +
  'border border-zinc-800/50 rounded-lg p-3 overflow-auto max-h-80';

/** Parse the `description:` line from YAML frontmatter in a SKILL.md string.
 *  Handles quoted ("…") and unquoted single-line values. Returns null if not found. */
function parseDescription(md: string): string | null {
  // Frontmatter is between the first two `---` fence lines
  const match = md.match(/^---[\r\n]([\s\S]*?)[\r\n]---/m);
  if (!match) return null;
  const frontmatter = match[1];
  // Match: description: value  OR  description: "value"  OR  description: 'value'
  const lineMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  return lineMatch ? lineMatch[1].trim() : null;
}

/** Strip YAML frontmatter (the block between the first two --- fences) from a SKILL.md. */
function stripFrontmatter(md: string): string {
  // Match opening ---, frontmatter block, closing ---
  return md.replace(/^---[\r\n][\s\S]*?[\r\n]---[\r\n]?/, '').trimStart();
}

export default function SkillDraftsPanel() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('skill_drafts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data) setDrafts(data as Draft[]);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const setStatus = async (id: string, status: 'approved' | 'rejected') => {
    setBusyId(id);
    try {
      await dashboardAction('skill_drafts', id, 'status', status);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const pending = drafts.filter((d) => d.status === 'pending' && d.kind !== 'prune_candidate');
  const prunes = drafts.filter((d) => d.status === 'pending' && d.kind === 'prune_candidate');
  const log = drafts.filter((d) => d.status === 'applied' || d.status === 'rejected' || d.status === 'approved');

  const renderDraft = (d: Draft, actions: boolean, approveLabel = 'Approve', rejectLabel = 'Reject') => {
    const description = d.kind === 'new' && d.draft_md ? parseDescription(d.draft_md) : null;
    const bodyMd = d.kind === 'new' && d.draft_md ? stripFrontmatter(d.draft_md) : null;

    return (
      <li key={d.id} className="border border-zinc-800/60 rounded-lg p-3 mb-2 bg-zinc-900/30">
        {/* Header row: kind badge + name + timestamp */}
        <div className="flex items-center gap-2 mb-1">
          <span className="px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 text-[10px] font-medium">
            {KIND_LABEL[d.kind]}
          </span>
          <span className="font-mono text-[12px] text-zinc-200">{d.skill_name}</span>
          <span className="text-[10px] text-zinc-500 ml-auto">{new Date(d.created_at).toLocaleString()}</span>
        </div>

        {/* Rationale — shown for ALL draft kinds when present */}
        {d.rationale && (
          <div className="flex items-start gap-1.5 bg-emerald-950/40 border border-emerald-800/30 rounded px-2.5 py-1.5 mb-2">
            <span className="text-emerald-400 text-[10px] font-semibold uppercase tracking-wider mt-0.5 shrink-0">Why</span>
            <p className="text-[11.5px] text-emerald-100/80 leading-snug">{d.rationale}</p>
          </div>
        )}

        {/* New skill: description sub-line */}
        {d.kind === 'new' && description && (
          <p className="text-[11.5px] text-zinc-400 italic mb-2 leading-snug">{description}</p>
        )}

        {/* New skill: inline body preview (scrollable, max ~16rem) */}
        {d.kind === 'new' && bodyMd && (
          <div className="border border-zinc-800/50 rounded-lg bg-zinc-950/40 px-3 pt-2 pb-1 mb-2 overflow-auto max-h-64">
            <div className="text-[12px] text-zinc-300 leading-relaxed">
              {renderLightMarkdown(bodyMd)}
            </div>
          </div>
        )}

        {/* Full draft_md toggle — for new skills this is additional; for others it was the only view */}
        {d.draft_md && d.kind !== 'new' && (
          <button
            className="text-[11px] text-emerald-400 hover:underline mb-1"
            onClick={() => setExpanded(expanded === d.id ? null : d.id)}
          >
            {expanded === d.id ? 'Hide' : 'Show'} proposed SKILL.md
          </button>
        )}
        {d.kind === 'new' && d.draft_md && (
          <button
            className="text-[11px] text-emerald-400 hover:underline mb-1"
            onClick={() => setExpanded(expanded === d.id ? null : d.id)}
          >
            {expanded === d.id ? 'Hide' : 'Show full'} SKILL.md
          </button>
        )}
        {expanded === d.id && d.draft_md && (
          <div className="text-[12px] text-zinc-300 leading-relaxed border-l-2 border-zinc-800 pl-3 my-2">
            {renderLightMarkdown(d.draft_md)}
          </div>
        )}

        {/* Refine / prune: diff box, shown below rationale */}
        {d.diff && <div className={preCls + ' mb-2'}>{d.diff}</div>}

        {actions && (
          <div className="flex gap-2 mt-2">
            <button
              disabled={busyId === d.id}
              onClick={() => setStatus(d.id, 'approved')}
              className="px-3 py-1 rounded-md bg-emerald-600/80 hover:bg-emerald-600 text-white text-[11px] disabled:opacity-50"
            >
              {busyId === d.id ? '…' : approveLabel}
            </button>
            <button
              disabled={busyId === d.id}
              onClick={() => setStatus(d.id, 'rejected')}
              className="px-3 py-1 rounded-md bg-zinc-700/70 hover:bg-zinc-700 text-zinc-200 text-[11px] disabled:opacity-50"
            >
              {rejectLabel}
            </button>
          </div>
        )}
      </li>
    );
  };

  if (loading) return <div className="text-zinc-500 text-[13px] py-8">Loading skill drafts…</div>;

  return (
    <div className="flex flex-col gap-6 py-3">
      <section>
        <h3 className="text-[13px] font-semibold text-zinc-200 mb-2">
          Pending approval <span className="text-zinc-500">({pending.length})</span>
        </h3>
        {pending.length === 0 ? (
          <p className="text-[12px] text-zinc-500">Nothing waiting. Auto-applied changes appear in the log below.</p>
        ) : (
          <ul>{pending.map((d) => renderDraft(d, true))}</ul>
        )}
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-zinc-200 mb-2">
          Prune candidates <span className="text-zinc-500">({prunes.length})</span>
        </h3>
        {prunes.length === 0 ? (
          <p className="text-[12px] text-zinc-500">No unused or duplicate auto-skills flagged.</p>
        ) : (
          <ul>{prunes.map((d) => renderDraft(d, true, 'Delete skill', 'Keep'))}</ul>
        )}
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-zinc-200 mb-2">
          Activity log <span className="text-zinc-500">({log.length})</span>
        </h3>
        {log.length === 0 ? (
          <p className="text-[12px] text-zinc-500">No skill changes yet.</p>
        ) : (
          <ul>{log.slice(0, 30).map((d) => (
            <li key={d.id} className="flex items-center gap-2 text-[11.5px] py-1 border-b border-zinc-900/60">
              <span className="text-zinc-500 w-28 shrink-0">{KIND_LABEL[d.kind]}</span>
              <span className="font-mono text-zinc-300">{d.skill_name}</span>
              <span className={
                'ml-auto text-[10px] px-1.5 py-0.5 rounded ' +
                (d.status === 'applied' ? 'bg-emerald-900/40 text-emerald-300'
                  : d.status === 'rejected' ? 'bg-zinc-800 text-zinc-400'
                  : 'bg-amber-900/30 text-amber-300')
              }>{d.status}</span>
            </li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}
