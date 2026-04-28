import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Edit3, Save, X, Loader2, Target } from 'lucide-react';
import { useSalesScript } from '../../hooks/useSalesScript';
import { meetingTypeConfig, MEETING_TYPE_OPTIONS } from '../../lib/meetingTypes';
import type { MeetingType, SalesScriptPhase } from '../../types/dashboard';

const INLINE_RX = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(INLINE_RX).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-zinc-100 font-semibold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} className="text-zinc-400 italic">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={i} className="text-amber-300 bg-zinc-800/60 px-1 py-0.5 rounded text-[11px]">{part.slice(1, -1)}</code>;
    }
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
      if (line.startsWith('# ')) {
        out.push(<h1 key={key++} className="text-xl font-bold text-zinc-100 mt-4 mb-2">{renderInline(line.slice(2))}</h1>);
        i++; continue;
      }
      if (line.startsWith('## ')) {
        out.push(<h2 key={key++} className="text-base font-bold text-emerald-300 mt-5 mb-2 border-b border-zinc-800 pb-1">{renderInline(line.slice(3))}</h2>);
        i++; continue;
      }
      if (line.startsWith('### ')) {
        out.push(<h3 key={key++} className="text-sm font-semibold text-zinc-200 mt-3 mb-1.5">{renderInline(line.slice(4))}</h3>);
        i++; continue;
      }
      if (line.startsWith('---')) {
        out.push(<hr key={key++} className="my-3 border-zinc-800" />);
        i++; continue;
      }
      if (line.startsWith('> ')) {
        const buf: string[] = [];
        while (i < lines.length && lines[i].startsWith('> ')) {
          buf.push(lines[i].slice(2));
          i++;
        }
        out.push(
          <blockquote key={key++} className="border-l-2 border-emerald-500/50 pl-3 my-2 text-[13px] text-zinc-300 leading-relaxed bg-emerald-950/10 py-1.5 rounded-r">
            {buf.map((b, j) => <div key={j}>{renderInline(b)}</div>)}
          </blockquote>
        );
        continue;
      }
      if (/^\d+\.\s/.test(line) || line.startsWith('- ')) {
        const buf: string[] = [];
        const isOrdered = /^\d+\.\s/.test(line);
        while (i < lines.length && (/^\d+\.\s/.test(lines[i]) || lines[i].startsWith('- '))) {
          buf.push(lines[i].replace(/^(\d+\.|-)\s/, ''));
          i++;
        }
        const ListTag = isOrdered ? 'ol' : 'ul';
        out.push(
          <ListTag key={key++} className={`${isOrdered ? 'list-decimal' : 'list-disc'} list-outside ml-5 my-1.5 space-y-1 text-[13px] text-zinc-300`}>
            {buf.map((b, j) => <li key={j}>{renderInline(b)}</li>)}
          </ListTag>
        );
        continue;
      }
      if (line.trim() === '') {
        i++; continue;
      }
      out.push(<p key={key++} className="text-[13px] text-zinc-300 leading-relaxed my-1.5">{renderInline(line)}</p>);
      i++;
    }
    return out;
  }, [md]);
  return <div className="space-y-0.5">{blocks}</div>;
};

const PhaseChips: React.FC<{ phases: SalesScriptPhase[] }> = ({ phases }) => {
  if (!phases || phases.length === 0) return null;
  const totalSec = phases.reduce((s, p) => s + (p.duration_target_seconds || 0), 0);
  const totalMin = Math.round(totalSec / 60);
  const totalMustHits = phases.reduce((s, p) => s + (p.must_hits?.length || 0), 0);
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-2.5 border-b border-zinc-800/40 bg-zinc-950/40">
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider mr-1">{phases.length} phases · ~{totalMin}m · {totalMustHits} must-hits</span>
      {phases.sort((a, b) => a.order - b.order).map((p) => (
        <span key={p.id} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-400 border border-zinc-700/40">
          {p.order}. {p.name}
        </span>
      ))}
    </div>
  );
};

interface SalesScriptViewerProps {
  defaultMeetingType?: MeetingType;
}

const SalesScriptViewer: React.FC<SalesScriptViewerProps> = ({ defaultMeetingType = 'discovery_sales' }) => {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<MeetingType>(defaultMeetingType);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const { script, loading, saving, save } = useSalesScript(selectedType);
  const cfg = meetingTypeConfig(selectedType);

  useEffect(() => {
    if (script && !editing) setDraft(script.contentMd);
  }, [script, editing]);

  const handleSave = async () => {
    if (!script) return;
    await save({ contentMd: draft });
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(script?.contentMd ?? '');
    setEditing(false);
  };

  return (
    <div className="bg-gradient-to-r from-emerald-950/20 to-zinc-900/60 border border-emerald-800/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-emerald-900/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-100">Live Call Script</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cfg.badgeStyle}`}>{cfg.label}</span>
          {script && (
            <span className="text-[10px] text-zinc-500">v{script.version}</span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-emerald-400/60" /> : <ChevronDown className="w-4 h-4 text-emerald-400/60" />}
      </button>

      {open && (
        <div className="border-t border-emerald-800/20">
          {/* Type selector + edit toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/40 border-b border-zinc-800/40">
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5 text-zinc-500" />
              <select
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value as MeetingType); setEditing(false); }}
                className="text-[11px] bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-200 focus:outline-none focus:border-emerald-500/40"
                disabled={editing}
              >
                {MEETING_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{meetingTypeConfig(t).label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              {editing ? (
                <>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="text-[11px] px-2.5 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !script}
                    className="text-[11px] px-2.5 py-1 rounded bg-emerald-700/40 text-emerald-100 hover:bg-emerald-700/60 border border-emerald-600/40 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  disabled={!script}
                  className="text-[11px] px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 hover:text-zinc-100 hover:bg-zinc-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              )}
            </div>
          </div>

          {script && <PhaseChips phases={script.phases} />}

          {/* Body */}
          <div className="px-4 py-3 max-h-[600px] overflow-y-auto">
            {loading && (
              <div className="text-xs text-zinc-500 flex items-center gap-2 py-4">
                <Loader2 className="w-3 h-3 animate-spin" /> Loading script...
              </div>
            )}
            {!loading && !script && (
              <p className="text-xs text-zinc-500 py-4">No active script for {cfg.label}. (Seed it via the sales_scripts table.)</p>
            )}
            {!loading && script && editing && (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full min-h-[500px] bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-[12px] text-zinc-300 font-mono leading-relaxed focus:outline-none focus:border-emerald-500/40"
                spellCheck={false}
              />
            )}
            {!loading && script && !editing && (
              <MarkdownView md={script.contentMd} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesScriptViewer;
