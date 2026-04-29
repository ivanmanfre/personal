import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Bold, Italic, Heading2, List, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type Status = 'draft' | 'published' | 'archived';
type Kind = 'real' | 'test';

interface BlueprintRow {
  id: string;
  stripe_session_id: string;
  status: Status;
  kind: Kind;
  html: string;
  json_sections: Record<string, unknown>;
  generation_metadata: { model?: string; generated_at?: string; input_tokens?: number; output_tokens?: number };
  version: number;
  updated_at: string;
  published_at: string | null;
}

const SAVE_DEBOUNCE_MS = 2000;

const BlueprintEditor: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [row, setRow] = useState<BlueprintRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const pendingHtmlRef = useRef<string | null>(null);

  // Load latest draft for this session
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('blueprints')
        .select('*')
        .eq('stripe_session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else if (!data) {
        setError('No Blueprint generated yet for this session. Click "Generate Draft" in the pipeline.');
      } else {
        setRow(data as BlueprintRow);
        setLastSavedAt((data as BlueprintRow).updated_at);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Mount editor content once row is loaded
  useEffect(() => {
    if (row && editorRef.current && editorRef.current.innerHTML === '') {
      editorRef.current.innerHTML = row.html || '<p>(empty draft)</p>';
    }
  }, [row]);

  const flushSave = useCallback(async () => {
    if (!row || pendingHtmlRef.current === null) return;
    const htmlToSave = pendingHtmlRef.current;
    pendingHtmlRef.current = null;
    setSaveState('saving');
    const { error } = await supabase
      .from('blueprints')
      .update({ html: htmlToSave, version: row.version + 1 })
      .eq('id', row.id);
    if (error) {
      setSaveState('error');
      setError(error.message);
      return;
    }
    setSaveState('saved');
    setLastSavedAt(new Date().toISOString());
    setRow((r) => (r ? { ...r, html: htmlToSave, version: r.version + 1 } : r));
  }, [row]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setSaveState('dirty');
    saveTimerRef.current = window.setTimeout(() => { void flushSave(); }, SAVE_DEBOUNCE_MS);
  }, [flushSave]);

  const onInput = useCallback(() => {
    if (!editorRef.current) return;
    pendingHtmlRef.current = editorRef.current.innerHTML;
    scheduleSave();
  }, [scheduleSave]);

  // Save on tab close / navigation
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (saveState === 'dirty' || saveState === 'saving') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [saveState]);

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    onInput();
    editorRef.current?.focus();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center font-mono text-sm text-ink-muted">
        Loading Blueprint…
      </div>
    );
  }

  if (error && !row) {
    return (
      <div className="min-h-screen bg-paper flex flex-col items-center justify-center gap-4 font-mono text-sm">
        <AlertCircle className="w-8 h-8 text-amber-700" />
        <p className="max-w-md text-center text-ink-muted">{error}</p>
        <Link to="/dashboard?tab=agentReady" className="px-3 py-1.5 border border-ink/20 hover:border-ink/40 transition-colors">
          ← Back to pipeline
        </Link>
      </div>
    );
  }

  if (!row) return null;

  const meta = row.generation_metadata || {};

  return (
    <div className="min-h-screen bg-paper font-mono text-ink">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-10 bg-paper/95 backdrop-blur border-b border-ink/10">
        <div className="max-w-[920px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/dashboard?tab=agentReady" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ink-muted hover:text-ink transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to pipeline
          </Link>

          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-widest border ${
              row.kind === 'test' ? 'border-amber-700/40 text-amber-800 bg-amber-50' : 'border-ink/20 text-ink-muted'
            }`}>
              {row.kind === 'test' ? 'TEST · won\'t be RAG\'d' : 'Real'}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-widest border ${
              row.status === 'published' ? 'border-accent/40 text-accent bg-accent/5' : 'border-ink/20 text-ink-muted'
            }`}>
              {row.status}
            </span>
            <SaveBadge state={saveState} lastSavedAt={lastSavedAt} onClickSave={() => void flushSave()} />
          </div>
        </div>

        {/* Format toolbar */}
        <div className="max-w-[920px] mx-auto px-6 py-2 flex items-center gap-1 border-t border-ink/5">
          <ToolbarButton onClick={() => exec('bold')} icon={<Bold className="w-3.5 h-3.5" />} label="Bold" />
          <ToolbarButton onClick={() => exec('italic')} icon={<Italic className="w-3.5 h-3.5" />} label="Italic" />
          <ToolbarButton onClick={() => exec('formatBlock', '<h2>')} icon={<Heading2 className="w-3.5 h-3.5" />} label="H2" />
          <ToolbarButton onClick={() => exec('insertUnorderedList')} icon={<List className="w-3.5 h-3.5" />} label="List" />
          <div className="ml-auto text-[10px] text-ink-muted/70 uppercase tracking-widest">
            v{row.version} · {meta.model || 'unknown'} · {meta.input_tokens ?? '?'}+{meta.output_tokens ?? '?'} tok
          </div>
        </div>
      </header>

      {/* Editable surface */}
      <main className="max-w-[920px] mx-auto px-6 py-10">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={onInput}
          spellCheck
          className="blueprint-content prose prose-lg max-w-none focus:outline-none"
          style={{
            fontFamily: 'var(--font-body, "Space Grotesk"), system-ui, sans-serif',
            fontSize: '17px',
            lineHeight: 1.6,
            color: '#1A1A1A',
          }}
        />
      </main>

      <style>{`
        .blueprint-content h1 { font-family: 'DM Serif Display', serif; font-style: italic; font-size: 2.8rem; line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 0.4rem; color: #1A1A1A; }
        .blueprint-content h2 { font-family: 'DM Serif Display', serif; font-style: italic; font-size: 1.65rem; margin: 2.4rem 0 0.8rem; color: #1A1A1A; border-bottom: 1px solid rgba(26,26,26,0.1); padding-bottom: 0.5rem; }
        .blueprint-content h3 { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.16em; color: #6B6861; margin: 1.5rem 0 0.5rem; font-weight: 700; font-family: 'IBM Plex Mono', monospace; }
        .blueprint-content .eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #2A8F65; margin: 0 0 0.5rem; }
        .blueprint-content .meta { color: #6B6861; font-size: 0.85rem; margin: 0 0 2.5rem; }
        .blueprint-content p { margin: 0.7rem 0; }
        .blueprint-content ul { margin: 0.7rem 0; padding-left: 1.4rem; }
        .blueprint-content li { margin: 0.3rem 0; }
        .blueprint-content table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.92rem; }
        .blueprint-content th { text-align: left; padding: 8px 10px; border-bottom: 2px solid rgba(26,26,26,0.15); font-family: 'IBM Plex Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #6B6861; font-weight: 600; }
        .blueprint-content td { padding: 8px 10px; border-bottom: 1px solid rgba(26,26,26,0.06); vertical-align: top; }
        .blueprint-content .map-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin: 1.2rem 0; }
        .blueprint-content .phase { margin: 1.2rem 0; padding: 1rem 1.2rem; border-left: 3px solid #2A8F65; background: rgba(42,143,101,0.03); }
        .blueprint-content .phase h3 { margin-top: 0; }
        .blueprint-content .impact { font-style: italic; color: #6B6861; margin-top: 0.5rem; }
        .blueprint-content .axis-note { background: rgba(42,143,101,0.06); padding: 0.7rem 1rem; border-left: 2px solid #2A8F65; }
        .blueprint-content .recommendation { font-size: 1.1rem; margin: 0.5rem 0 0.8rem; }
        .blueprint-content .pace { background: rgba(26,26,26,0.03); padding: 1.2rem 1.5rem; margin-top: 2rem; }
        .blueprint-content footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid rgba(26,26,26,0.08); font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #6B6861; }
        .blueprint-content footer a { color: #2A8F65; text-decoration: none; }
        @media (max-width: 720px) {
          .blueprint-content .map-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

const ToolbarButton: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string }> = ({ onClick, icon, label }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    title={label}
    className="px-2 py-1 hover:bg-ink/5 rounded text-ink-muted hover:text-ink transition-colors flex items-center gap-1.5 text-xs"
  >
    {icon}
    <span className="hidden sm:inline">{label}</span>
  </button>
);

const SaveBadge: React.FC<{
  state: 'idle' | 'dirty' | 'saving' | 'saved' | 'error';
  lastSavedAt: string | null;
  onClickSave: () => void;
}> = ({ state, lastSavedAt, onClickSave }) => {
  if (state === 'saving') return <span className="text-[10px] uppercase tracking-widest text-ink-muted">saving…</span>;
  if (state === 'dirty') return (
    <button onClick={onClickSave} className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] uppercase tracking-widest border border-amber-700/40 text-amber-800 bg-amber-50 hover:bg-amber-100 transition-colors">
      <Save className="w-3 h-3" /> save now
    </button>
  );
  if (state === 'error') return <span className="text-[10px] uppercase tracking-widest text-red-700">save failed</span>;
  if (lastSavedAt) {
    const ago = Math.floor((Date.now() - new Date(lastSavedAt).getTime()) / 60000);
    return <span className="text-[10px] uppercase tracking-widest text-ink-muted">saved {ago === 0 ? 'just now' : `${ago}m ago`}</span>;
  }
  return null;
};

export default BlueprintEditor;
