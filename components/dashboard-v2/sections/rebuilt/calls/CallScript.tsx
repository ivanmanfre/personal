import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Edit3, Save, X, Loader2, ExternalLink } from 'lucide-react';
import { useSalesScript } from '../../../../../hooks/useSalesScript';
import { meetingTypeConfig, MEETING_TYPE_OPTIONS } from '../../../../../lib/meetingTypes';
import type { MeetingType, SalesScriptPhase } from '../../../../../types/dashboard';

/*
 * Live call script — Black Box v4 restyle of the v1 SalesScriptViewer.
 * The emerald gradient chrome is gone; this is a flat bordered box. The SAVE
 * write-path is the useSalesScript(...).save function verbatim (sales_scripts
 * .update), never re-implemented. View / edit / cancel / type-picker / cold +
 * warm links preserved.
 */

const INLINE_RX = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(INLINE_RX).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    return <span key={i}>{part}</span>;
  });
}

const MarkdownView: React.FC<{ md: string }> = ({ md }) => {
  const blocks = useMemo(() => {
    const lines = md.split('\n');
    const out: React.ReactNode[] = [];
    let i = 0;
    let key = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('# ')) { out.push(<h1 key={key++}>{renderInline(line.slice(2))}</h1>); i++; continue; }
      if (line.startsWith('## ')) { out.push(<h2 key={key++}>{renderInline(line.slice(3))}</h2>); i++; continue; }
      if (line.startsWith('### ')) { out.push(<h3 key={key++}>{renderInline(line.slice(4))}</h3>); i++; continue; }
      if (line.startsWith('---')) { out.push(<hr key={key++} />); i++; continue; }
      if (line.startsWith('> ')) {
        const buf: string[] = [];
        while (i < lines.length && lines[i].startsWith('> ')) { buf.push(lines[i].slice(2)); i++; }
        out.push(<blockquote key={key++}>{buf.map((b, j) => <div key={j}>{renderInline(b)}</div>)}</blockquote>);
        continue;
      }
      if (/^\d+\.\s/.test(line) || line.startsWith('- ')) {
        const buf: string[] = [];
        const isOrdered = /^\d+\.\s/.test(line);
        while (i < lines.length && (/^\d+\.\s/.test(lines[i]) || lines[i].startsWith('- '))) { buf.push(lines[i].replace(/^(\d+\.|-)\s/, '')); i++; }
        const ListTag = isOrdered ? 'ol' : 'ul';
        out.push(<ListTag key={key++}>{buf.map((b, j) => <li key={j}>{renderInline(b)}</li>)}</ListTag>);
        continue;
      }
      if (line.trim() === '') { i++; continue; }
      out.push(<p key={key++}>{renderInline(line)}</p>);
      i++;
    }
    return out;
  }, [md]);
  return <div className="cl-md">{blocks}</div>;
};

const PhaseChips: React.FC<{ phases: SalesScriptPhase[] }> = ({ phases }) => {
  if (!phases || phases.length === 0) return null;
  const totalSec = phases.reduce((s, p) => s + (p.duration_target_seconds || 0), 0);
  const totalMin = Math.round(totalSec / 60);
  const totalMustHits = phases.reduce((s, p) => s + (p.must_hits?.length || 0), 0);
  return (
    <div className="cl-phases">
      <span className="cl-phases-lbl">{phases.length} phases · ~{totalMin}m · {totalMustHits} must-hits</span>
      {[...phases].sort((a, b) => a.order - b.order).map((p) => (
        <span key={p.id} className="cl-phase">{p.order}. {p.name}</span>
      ))}
    </div>
  );
};

interface CallScriptProps {
  defaultMeetingType?: MeetingType;
  defaultOpen?: boolean;
}

const CallScript: React.FC<CallScriptProps> = ({ defaultMeetingType = 'discovery_sales', defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [selectedType, setSelectedType] = useState<MeetingType>(defaultMeetingType);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const { script, loading, saving, save } = useSalesScript(selectedType);
  const cfg = meetingTypeConfig(selectedType);

  useEffect(() => { if (script && !editing) setDraft(script.contentMd); }, [script, editing]);

  const handleSave = async () => {
    if (!script) return;
    await save({ contentMd: draft });   // verbatim sales_scripts.update write-path
    setEditing(false);
  };
  const handleCancel = () => { setDraft(script?.contentMd ?? ''); setEditing(false); };

  return (
    <div className="cl-disc">
      <button className="cl-disc-head" onClick={() => setOpen(!open)}>
        <span className="cl-disc-title">
          Live call script
          <span className="cl-disc-badge">{cfg.label}</span>
          {script && <span className="cl-disc-ver">v{script.version}</span>}
        </span>
        <span className="cl-disc-chev">{open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
      </button>

      {open && (
        <div className="cl-disc-body">
          <div className="cl-script-bar">
            <div className="cl-script-selwrap">
              <select
                className="cl-sel"
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value as MeetingType); setEditing(false); }}
                disabled={editing}
              >
                {MEETING_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{meetingTypeConfig(t).label}</option>
                ))}
              </select>
            </div>
            <div className="cl-script-tools">
              {editing ? (
                <>
                  <button className="cl-act cl-act--ghost" onClick={handleCancel} disabled={saving}>
                    <X className="w-3 h-3" /> Cancel
                  </button>
                  <button className="cl-act cl-act--primary" onClick={handleSave} disabled={saving || !script}>
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                  </button>
                </>
              ) : (
                <>
                  {selectedType === 'discovery_sales' && (
                    <a
                      className="cl-act cl-act--ghost"
                      href="https://resources.ivanmanfredi.com/internal/discovery-script.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Cold / lukewarm path · one-phase-per-screen, keyboard nav"
                    >
                      <ExternalLink className="w-3 h-3" /> Cold view
                    </a>
                  )}
                  {(selectedType === 'discovery_sales' || (selectedType as string) === 'discovery_warm') && (
                    <a
                      className="cl-act cl-act--ghost"
                      href="https://resources.ivanmanfredi.com/internal/discovery-warm.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Warm referral path · 6 phases, Option 1 / 2 pitch, ~30 min"
                    >
                      <ExternalLink className="w-3 h-3" /> Warm view
                    </a>
                  )}
                  <button className="cl-act" onClick={() => setEditing(true)} disabled={!script}>
                    <Edit3 className="w-3 h-3" /> Edit
                  </button>
                </>
              )}
            </div>
          </div>

          {script && <PhaseChips phases={script.phases} />}

          <div className="cl-script-body">
            {loading && <div className="cl-rec-loading"><Loader2 className="w-3 h-3 animate-spin" /> Loading script</div>}
            {!loading && !script && <p className="cl-sec-body">No active script for {cfg.label}. Seed it via the sales_scripts table.</p>}
            {!loading && script && editing && (
              <textarea className="cl-edit" value={draft} onChange={(e) => setDraft(e.target.value)} spellCheck={false} />
            )}
            {!loading && script && !editing && <MarkdownView md={script.contentMd} />}
          </div>
        </div>
      )}
    </div>
  );
};

export default CallScript;
