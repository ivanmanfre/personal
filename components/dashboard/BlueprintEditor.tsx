import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Bold, Italic, Heading2, List, Save, AlertCircle, Sparkles, Mic, ChevronDown, Send, Check, Copy, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import BlueprintStyles from '../blueprint/BlueprintStyles';

type Status = 'draft' | 'published' | 'archived';
type Kind = 'real' | 'test';
type Stage = 'pre_call' | 'post_call';

interface BlueprintRow {
  id: string;
  stripe_session_id: string;
  status: Status;
  kind: Kind;
  stage: Stage;
  call_notes: string | null;
  parent_blueprint_id: string | null;
  html: string;
  json_sections: Record<string, unknown>;
  generation_metadata: { model?: string; mode?: string; generated_at?: string; input_tokens?: number; output_tokens?: number };
  version: number;
  updated_at: string;
  created_at: string;
  published_at: string | null;
}

const SAVE_DEBOUNCE_MS = 2000;

const BlueprintEditor: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [allRows, setAllRows] = useState<BlueprintRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const row = allRows.find((r) => r.id === activeId) ?? null;
  const v1Row = allRows.find((r) => r.stage === 'pre_call');
  const v2Row = allRows.find((r) => r.stage === 'post_call');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [callNotes, setCallNotes] = useState('');
  const [callNotesOpen, setCallNotesOpen] = useState(false);
  const [generatingV2, setGeneratingV2] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Recording auto-pull state
  const [recording, setRecording] = useState<{ id: string; title: string; date: string; duration_minutes: number; meeting_type: string | null; participants: string[]; summary: string | null; action_items: string[] | null; transcript_text: string } | null>(null);
  const [recordingDismissed, setRecordingDismissed] = useState(false);

  // Diff mode (only available when both Pre-Call Brief and Blueprint exist)
  const [viewMode, setViewMode] = useState<'edit' | 'diff'>('edit');

  // Publish flow state
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishStep, setPublishStep] = useState<'checklist' | 'publishing' | 'review-email' | 'sending' | 'sent'>('checklist');
  const [checklist, setChecklist] = useState({ names: false, prices: false, voice: false, structure: false });
  const [publishResult, setPublishResult] = useState<{ public_url: string; share_token: string; email_draft: { to: string; subject: string; text: string; html: string } } | null>(null);
  const [emailEdits, setEmailEdits] = useState<{ to: string; subject: string; text: string }>({ to: '', subject: '', text: '' });
  const [publishError, setPublishError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const pendingHtmlRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('blueprints')
      .select('*')
      .eq('stripe_session_id', sessionId)
      .order('created_at', { ascending: false });
    if (error) {
      setError(error.message);
    } else if (!data || data.length === 0) {
      setError('No Blueprint generated yet for this session. Click "Generate Draft" in the pipeline.');
    } else {
      const rows = data as BlueprintRow[];
      setAllRows(rows);
      // Default-select v2 if it exists, else v1
      const initial = rows.find((r) => r.stage === 'post_call') ?? rows[0];
      setActiveId(initial.id);
      setLastSavedAt(initial.updated_at);
      // Pre-fill call notes from v1's stored notes if present (Ivan typed them, generated v2, returns)
      const pre = rows.find((r) => r.stage === 'pre_call');
      if (pre?.call_notes) setCallNotes(pre.call_notes);
    }
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Look up a likely matching call recording (only when no v2 yet — once Blueprint is generated this is moot)
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('find_call_recording_for_session', { p_session_id: sessionId });
      if (!cancelled && Array.isArray(data) && data[0]) {
        setRecording(data[0] as any);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const pullRecordingIntoNotes = useCallback(() => {
    if (!recording) return;
    const parts = [
      `[Day 2 call recording, ${new Date(recording.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, ${recording.duration_minutes ?? '?'} min]`,
    ];
    if (recording.summary) parts.push(`\n## SUMMARY\n${recording.summary}`);
    if (Array.isArray(recording.action_items) && recording.action_items.length) {
      parts.push(`\n## ACTION ITEMS\n${recording.action_items.map((a) => `- ${a}`).join('\n')}`);
    }
    if (recording.transcript_text) {
      const tt = recording.transcript_text.length > 5000
        ? recording.transcript_text.slice(0, 5000) + '\n[…transcript truncated to fit 8K char cap]'
        : recording.transcript_text;
      parts.push(`\n## TRANSCRIPT\n${tt}`);
    }
    const merged = (callNotes.trim() ? callNotes.trim() + '\n\n' : '') + parts.join('\n');
    setCallNotes(merged.slice(0, 8000));
    setCallNotesOpen(true);
  }, [recording, callNotes]);

  // When switching active row, swap editor contents
  useEffect(() => {
    if (row && editorRef.current) {
      editorRef.current.innerHTML = row.html || '<p>(empty draft)</p>';
      setLastSavedAt(row.updated_at);
      setSaveState('idle');
    }
  }, [activeId]);

  const generateV2 = useCallback(async () => {
    if (!sessionId) return;
    if (!callNotes.trim()) {
      setGenError('Add call notes before generating v2.');
      return;
    }
    setGeneratingV2(true);
    setGenError(null);
    try {
      // Save call_notes onto the v1 row first (so they're persisted even if generation fails)
      if (v1Row?.id) {
        await supabase.from('blueprints').update({ call_notes: callNotes.trim() }).eq('id', v1Row.id);
      }
      const res = await fetch('https://n8n.ivanmanfredi.com/webhook/blueprint-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, mode: 'post_call', call_notes: callNotes.trim() }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
      }
      const result = await res.json();
      // Reload rows; new v2 will be the active row by default
      await refresh();
      if (result.blueprint_id) setActiveId(result.blueprint_id);
    } catch (e: any) {
      setGenError(e.message ?? String(e));
    } finally {
      setGeneratingV2(false);
    }
  }, [sessionId, callNotes, v1Row?.id, refresh]);

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

  const allChecked = Object.values(checklist).every(Boolean);

  const doPublish = useCallback(async () => {
    if (!row) return;
    setPublishStep('publishing');
    setPublishError(null);
    try {
      const res = await fetch('https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/blueprint-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blueprint_id: row.id, allow_test: row.kind === 'test' }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setPublishResult(j);
      setEmailEdits({ to: j.email_draft.to || '', subject: j.email_draft.subject || '', text: j.email_draft.text || '' });
      setPublishStep('review-email');
      // Refresh row state so it shows as published
      void refresh();
    } catch (e: any) {
      setPublishError(e.message ?? String(e));
      setPublishStep('checklist');
    }
  }, [row, refresh]);

  const sendEmail = useCallback(async () => {
    if (!row || !publishResult) return;
    setPublishStep('sending');
    setPublishError(null);
    try {
      const res = await fetch('https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/blueprint-send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blueprint_id: row.id,
          to: emailEdits.to,
          subject: emailEdits.subject,
          text: emailEdits.text,
          // Use the original HTML (Ivan edits text only — HTML stays branded)
          html: publishResult.email_draft.html,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setPublishStep('sent');
      void refresh();
    } catch (e: any) {
      setPublishError(e.message ?? String(e));
      setPublishStep('review-email');
    }
  }, [row, publishResult, emailEdits, refresh]);

  const closePublish = () => {
    setPublishOpen(false);
    setPublishStep('checklist');
    setChecklist({ names: false, prices: false, voice: false, structure: false });
    setPublishResult(null);
    setPublishError(null);
    setCopiedUrl(false);
  };

  const copyUrl = async () => {
    if (!publishResult) return;
    await navigator.clipboard.writeText(publishResult.public_url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
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
        <div className="max-w-[1080px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <Link to="/dashboard?tab=agentReady" className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-ink-muted hover:text-ink transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to pipeline
          </Link>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Stage toggle (Pre-Call Brief / Blueprint / Diff) */}
            {(v1Row || v2Row) && (
              <div className="inline-flex border border-ink/15 rounded-sm overflow-hidden">
                {v1Row && (
                  <button
                    onClick={() => { setViewMode('edit'); setActiveId(v1Row.id); }}
                    title="Pre-Call Brief — Ivan's prep doc, never sent to buyer."
                    className={`px-2.5 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors ${
                      viewMode === 'edit' && row.id === v1Row.id ? 'bg-ink text-paper' : 'bg-paper text-ink-muted hover:text-ink'
                    }`}
                  >
                    Pre-Call Brief
                  </button>
                )}
                {v2Row && (
                  <button
                    onClick={() => { setViewMode('edit'); setActiveId(v2Row.id); }}
                    title="Blueprint — the artifact the buyer paid for."
                    className={`px-2.5 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors border-l border-ink/15 ${
                      viewMode === 'edit' && row.id === v2Row.id ? 'bg-accent text-paper' : 'bg-paper text-ink-muted hover:text-ink'
                    }`}
                  >
                    Blueprint
                  </button>
                )}
                {v1Row && v2Row && (
                  <button
                    onClick={() => setViewMode('diff')}
                    title="Side-by-side: Pre-Call Brief next to Blueprint."
                    className={`px-2.5 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors border-l border-ink/15 ${
                      viewMode === 'diff' ? 'bg-ink text-paper' : 'bg-paper text-ink-muted hover:text-ink'
                    }`}
                  >
                    Diff
                  </button>
                )}
              </div>
            )}

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

            {/* Publish — only on Blueprint (post_call) */}
            {row.stage === 'post_call' && (
              <button
                onClick={() => setPublishOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-widest font-mono font-bold transition-colors ${
                  row.status === 'published'
                    ? 'border border-accent/40 text-accent hover:bg-accent/10'
                    : 'bg-accent text-paper hover:bg-accent/90'
                }`}
              >
                <Send className="w-3 h-3" />
                {row.status === 'published' ? 'Published · resend' : 'Publish'}
              </button>
            )}
          </div>
        </div>

        {/* Format toolbar */}
        <div className="max-w-[1080px] mx-auto px-6 py-2 flex items-center gap-1 border-t border-ink/5">
          <ToolbarButton onClick={() => exec('bold')} icon={<Bold className="w-3.5 h-3.5" />} label="Bold" />
          <ToolbarButton onClick={() => exec('italic')} icon={<Italic className="w-3.5 h-3.5" />} label="Italic" />
          <ToolbarButton onClick={() => exec('formatBlock', '<h2>')} icon={<Heading2 className="w-3.5 h-3.5" />} label="H2" />
          <ToolbarButton onClick={() => exec('insertUnorderedList')} icon={<List className="w-3.5 h-3.5" />} label="List" />
          <div className="ml-auto text-[10px] text-ink-muted/70 uppercase tracking-widest">
            v{row.version} · {meta.model || 'unknown'} · {meta.input_tokens ?? '?'}+{meta.output_tokens ?? '?'} tok
          </div>
        </div>
      </header>

      {/* Recording auto-pull suggestion (only when matched + no v2 yet + not dismissed) */}
      {row.stage === 'pre_call' && !v2Row && recording && !recordingDismissed && (
        <div className="max-w-[1080px] mx-auto px-6 pt-6">
          <div className="border border-amber-700/30 bg-amber-50 rounded-sm px-4 py-3 flex items-start gap-3">
            <Mic className="w-4 h-4 text-amber-800 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono uppercase tracking-widest text-amber-800 font-bold mb-1">Found a matching call recording</p>
              <p className="text-sm text-ink leading-snug">
                <strong>{recording.title || '(untitled)'}</strong>
                {' · '}{new Date(recording.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {recording.duration_minutes ? ` · ${recording.duration_minutes} min` : ''}
                {recording.meeting_type ? ` · ${recording.meeting_type}` : ''}
              </p>
              {recording.summary && (
                <p className="text-xs text-ink-muted mt-1 line-clamp-2">{recording.summary.slice(0, 200)}{recording.summary.length > 200 ? '…' : ''}</p>
              )}
            </div>
            <div className="flex-shrink-0 flex items-center gap-2">
              <button
                onClick={pullRecordingIntoNotes}
                className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest bg-amber-800 text-amber-50 hover:bg-amber-900 transition-colors flex items-center gap-1.5"
              >
                Pull into notes
              </button>
              <button
                onClick={() => setRecordingDismissed(true)}
                className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Call-notes panel (only meaningful when viewing v1, before v2 is generated) */}
      {row.stage === 'pre_call' && !v2Row && (
        <div className="max-w-[1080px] mx-auto px-6 pt-6">
          <div className="border border-accent/30 bg-accent/5 rounded-sm">
            <button
              onClick={() => setCallNotesOpen((o) => !o)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-accent/10 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-accent" />
                <span className="text-xs uppercase tracking-widest font-mono text-accent font-bold">Day 2 call notes</span>
                <span className="text-[10px] uppercase tracking-widest font-mono text-ink-muted">
                  {callNotes.trim().length > 0 ? `${callNotes.trim().length} chars` : 'add notes to unlock the Blueprint'}
                </span>
              </div>
              <ChevronDown className={`w-4 h-4 text-ink-muted transition-transform ${callNotesOpen ? 'rotate-180' : ''}`} />
            </button>
            {callNotesOpen && (
              <div className="px-4 pb-4 space-y-3">
                <p className="text-xs text-ink-muted leading-relaxed">
                  Paste raw call notes, ivan-listener transcript excerpts, or your scratch impressions from Day 2. The model will fuse this with the intake + Pre-Call Brief to generate the Blueprint — the deliverable the buyer actually receives.
                </p>
                <textarea
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="e.g.&#10;Sarah pushed back on the geo-restriction — they want US-wide. Partners are about to spin off the IP practice into its own firm so we can drop that scope entirely. Real concern is partner availability for review, not Sarah's bandwidth.&#10;..."
                  rows={8}
                  maxLength={8000}
                  className="w-full px-3 py-2 text-sm font-sans text-ink bg-paper border border-ink/15 rounded-sm focus:outline-none focus:border-accent resize-y"
                />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">{callNotes.trim().length} / 8000</span>
                  <button
                    onClick={() => void generateV2()}
                    disabled={generatingV2 || !callNotes.trim()}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-widest bg-accent text-paper hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {generatingV2 ? 'Generating Blueprint…' : 'Generate the Blueprint'}
                  </button>
                </div>
                {genError && <p className="text-xs text-red-700 font-mono">{genError}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stage banner — explicit so Ivan never confuses v1 with v2 */}
      <div className="max-w-[1080px] mx-auto px-6 pt-6">
        <div className={`px-4 py-3 border-l-2 text-xs ${
          row.stage === 'post_call'
            ? 'border-accent bg-accent/5 text-ink'
            : 'border-amber-700/40 bg-amber-50 text-ink'
        }`}>
          {row.stage === 'post_call' ? (
            <>
              <strong className="font-mono uppercase tracking-widest text-accent">Blueprint · the deliverable</strong>
              <span className="ml-2 text-ink-muted">This is what the buyer receives. Generated from intake + Pre-Call Brief + Day 2 call notes.</span>
            </>
          ) : (
            <>
              <strong className="font-mono uppercase tracking-widest text-amber-800">Pre-Call Brief · internal prep</strong>
              <span className="ml-2 text-ink-muted">For your eyes only. Use this to prep for the Day 2 working session, then add notes above and generate the Blueprint.</span>
            </>
          )}
        </div>
      </div>

      {/* Call Insights Captured — only on v2, shows the changelog Claude produced */}
      {row.stage === 'post_call' && Array.isArray((row.json_sections as any)?.changes_from_v1) && (row.json_sections as any).changes_from_v1.length > 0 && (
        <div className="max-w-[1080px] mx-auto px-6 pt-4">
          <details className="border border-accent/25 bg-accent/[0.04] rounded-sm" open>
            <summary className="px-4 py-3 cursor-pointer flex items-center gap-2 select-none">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-xs font-mono uppercase tracking-widest text-accent font-bold">Call insights captured</span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-ink-muted">
                {((row.json_sections as any).changes_from_v1 as any[]).length} shifts from the Pre-Call Brief
              </span>
              <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-ink-muted">click to collapse</span>
            </summary>
            <ol className="px-4 pb-4 space-y-3">
              {((row.json_sections as any).changes_from_v1 as Array<{ section: string; what_changed: string; why_call_drove_it: string }>).map((c, i) => (
                <li key={i} className="border-l-2 border-accent/40 pl-3 py-1">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-accent font-bold mb-0.5">
                    {String(i + 1).padStart(2, '0')} · {c.section.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-ink leading-snug font-sans">{c.what_changed}</p>
                  <p className="text-xs text-ink-muted leading-snug mt-1 font-sans italic">
                    From the call: {c.why_call_drove_it}
                  </p>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}

      {/* Editable surface OR side-by-side Diff */}
      {viewMode === 'edit' ? (
        <main className="max-w-[1080px] mx-auto px-6 py-10">
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
      ) : (
        <main className="max-w-[1600px] mx-auto px-6 py-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="sticky top-[110px] z-[5] bg-paper py-2 mb-4 border-b border-ink/10">
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-muted font-bold">Pre-Call Brief · before Day 2</p>
              </div>
              <div className="blueprint-content" style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif', fontSize: '15px', lineHeight: 1.55 }}
                   dangerouslySetInnerHTML={{ __html: v1Row?.html || '<p>(missing)</p>' }} />
            </div>
            <div>
              <div className="sticky top-[110px] z-[5] bg-paper py-2 mb-4 border-b border-accent">
                <p className="font-mono text-[10px] uppercase tracking-widest text-accent font-bold">Blueprint · after Day 2 (deliverable)</p>
              </div>
              <div className="blueprint-content" style={{ fontFamily: 'Space Grotesk, system-ui, sans-serif', fontSize: '15px', lineHeight: 1.55 }}
                   dangerouslySetInnerHTML={{ __html: v2Row?.html || '<p>(missing)</p>' }} />
            </div>
          </div>
          <p className="mt-8 text-xs text-ink-muted text-center font-mono">
            Tip: the "Call insights captured" panel on the Blueprint side shows what the call shifted from the brief. Edits aren't allowed in Diff mode.
          </p>
        </main>
      )}

      {/* Publish modal — checklist → publish → review email → send */}
      {publishOpen && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-center justify-center px-4 py-8 overflow-y-auto" onClick={publishStep === 'sent' ? closePublish : undefined}>
          <div className="bg-paper border border-ink/20 max-w-[640px] w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-ink/10 flex items-center justify-between sticky top-0 bg-paper z-10">
              <h2 className="font-drama italic text-2xl text-ink">
                {publishStep === 'checklist' ? 'Final check before publish' : ''}
                {publishStep === 'publishing' ? 'Publishing…' : ''}
                {publishStep === 'review-email' ? 'Review the buyer email' : ''}
                {publishStep === 'sending' ? 'Sending…' : ''}
                {publishStep === 'sent' ? 'Sent' : ''}
              </h2>
              <button onClick={closePublish} className="text-ink-muted hover:text-ink"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-5">
              {/* Checklist step */}
              {publishStep === 'checklist' && (
                <div className="space-y-4">
                  <p className="text-sm text-ink-muted">
                    Once published, the Blueprint becomes shareable at a public URL. The buyer email below is a draft — you review and send manually after publish.
                  </p>
                  <div className="space-y-2">
                    {[
                      { k: 'names' as const, label: 'Names spelled correctly (buyer + named owners)' },
                      { k: 'prices' as const, label: 'Prices match the offer ladder (Essential $3.5K · Standard $6.5K · Investor $10K · LMS $7K · Content Engine $6K)' },
                      { k: 'voice' as const, label: 'Voice feels like Ivan (no AI tells, no em-dashes, no sycophancy)' },
                      { k: 'structure' as const, label: 'All 7 sections render and the recommendation feels right' },
                    ].map((c) => (
                      <label key={c.k} className="flex items-start gap-3 text-sm cursor-pointer p-2 hover:bg-ink/5 rounded-sm">
                        <input
                          type="checkbox"
                          checked={checklist[c.k]}
                          onChange={(e) => setChecklist((s) => ({ ...s, [c.k]: e.target.checked }))}
                          className="mt-0.5 accent-accent"
                        />
                        <span className="text-ink leading-snug">{c.label}</span>
                      </label>
                    ))}
                  </div>
                  {row.kind === 'test' && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-700/30 p-3">
                      <strong>Heads up:</strong> this is a TEST session. Publishing will work but the embedding will be skipped (won't pollute RAG).
                    </p>
                  )}
                  {publishError && <p className="text-xs text-red-700">{publishError}</p>}
                  <div className="flex justify-end gap-2 pt-2">
                    <button onClick={closePublish} className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-ink-muted hover:text-ink">Cancel</button>
                    <button
                      onClick={() => void doPublish()}
                      disabled={!allChecked}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-widest bg-accent text-paper hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-3.5 h-3.5" /> Publish now
                    </button>
                  </div>
                </div>
              )}

              {/* Publishing spinner */}
              {publishStep === 'publishing' && (
                <p className="py-8 text-center text-sm text-ink-muted">Generating share token, writing embedding…</p>
              )}

              {/* Review email step */}
              {publishStep === 'review-email' && publishResult && (
                <div className="space-y-4">
                  <div className="bg-accent/5 border border-accent/30 p-3 rounded-sm">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-accent font-bold mb-1">Public URL</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-ink break-all flex-1">{publishResult.public_url}</code>
                      <button
                        onClick={copyUrl}
                        className="shrink-0 px-2 py-1 text-[10px] font-mono uppercase tracking-widest border border-ink/20 hover:border-ink/40 inline-flex items-center gap-1"
                      >
                        {copiedUrl ? <><Check className="w-3 h-3 text-accent" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-muted">To</label>
                    <input
                      type="email"
                      value={emailEdits.to}
                      onChange={(e) => setEmailEdits((s) => ({ ...s, to: e.target.value }))}
                      className="w-full px-3 py-2 text-sm font-sans text-ink bg-paper border border-ink/15 focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-muted">Subject</label>
                    <input
                      type="text"
                      value={emailEdits.subject}
                      onChange={(e) => setEmailEdits((s) => ({ ...s, subject: e.target.value }))}
                      className="w-full px-3 py-2 text-sm font-sans text-ink bg-paper border border-ink/15 focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] font-mono uppercase tracking-widest text-ink-muted">Plain text body (HTML version stays branded)</label>
                    <textarea
                      value={emailEdits.text}
                      onChange={(e) => setEmailEdits((s) => ({ ...s, text: e.target.value }))}
                      rows={12}
                      className="w-full px-3 py-2 text-sm font-sans text-ink bg-paper border border-ink/15 focus:outline-none focus:border-accent resize-y"
                    />
                  </div>

                  {publishError && <p className="text-xs text-red-700">{publishError}</p>}

                  <div className="flex justify-between gap-2 pt-2">
                    <button onClick={closePublish} className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-ink-muted hover:text-ink">
                      Skip email · I'll send manually
                    </button>
                    <button
                      onClick={() => void sendEmail()}
                      disabled={!emailEdits.to || !emailEdits.subject || !emailEdits.text}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-mono uppercase tracking-widest bg-accent text-paper hover:bg-accent/90 disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" /> Send via Resend
                    </button>
                  </div>
                </div>
              )}

              {publishStep === 'sending' && (
                <p className="py-8 text-center text-sm text-ink-muted">Sending email…</p>
              )}

              {publishStep === 'sent' && (
                <div className="py-6 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-full bg-accent/15 flex items-center justify-center">
                    <Check className="w-6 h-6 text-accent" />
                  </div>
                  <p className="font-drama italic text-2xl text-ink">Sent</p>
                  <p className="text-sm text-ink-muted">The buyer just got the Blueprint.</p>
                  <button onClick={closePublish} className="px-4 py-2 text-xs font-mono uppercase tracking-widest border border-ink/20 hover:border-ink/40">Close</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <BlueprintStyles />
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
