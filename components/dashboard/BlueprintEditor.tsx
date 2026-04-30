import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Bold, Italic, Heading2, List, Save, AlertCircle, Sparkles, Mic, ChevronDown, Send, Check, Copy, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

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
            {/* Stage toggle (v1 / v2) */}
            {(v1Row || v2Row) && (
              <div className="inline-flex border border-ink/15 rounded-sm overflow-hidden">
                {v1Row && (
                  <button
                    onClick={() => setActiveId(v1Row.id)}
                    title="Pre-Call Brief — Ivan's prep doc, never sent to buyer."
                    className={`px-2.5 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors ${
                      row.id === v1Row.id ? 'bg-ink text-paper' : 'bg-paper text-ink-muted hover:text-ink'
                    }`}
                  >
                    Pre-Call Brief
                  </button>
                )}
                {v2Row && (
                  <button
                    onClick={() => setActiveId(v2Row.id)}
                    title="Blueprint — the artifact the buyer paid for."
                    className={`px-2.5 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors border-l border-ink/15 ${
                      row.id === v2Row.id ? 'bg-accent text-paper' : 'bg-paper text-ink-muted hover:text-ink'
                    }`}
                  >
                    Blueprint
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

      {/* Editable surface */}
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

      <style>{`
        /* === Blueprint editor — Editorial Comic-Grid system === */
        :root {
          --bp-ink: #1A1A1A;
          --bp-muted: #6B6861;
          --bp-paper: #F4EFE8;
          --bp-paper-deep: #ECE5D9;
          --bp-sage: #2A8F65;
          --bp-sage-tint: rgba(42,143,101,0.08);
          --bp-sage-mid: rgba(42,143,101,0.18);
          --bp-rule: rgba(26,26,26,0.10);
        }
        .blueprint-content { color: var(--bp-ink); }
        .blueprint-content > article { display: block; }

        /* Hero */
        .blueprint-content .bp-hero { padding: 1.4rem 0 2.4rem; border-bottom: 1px solid var(--bp-rule); margin-bottom: 2.4rem; animation: bpFadeUp 0.55s ease-out both; }
        .blueprint-content .bp-eyebrow { font-family: 'IBM Plex Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--bp-sage); margin: 0 0 0.6rem; }
        .blueprint-content h1 { font-family: 'DM Serif Display', serif; font-style: italic; font-size: 3.2rem; line-height: 1.04; letter-spacing: -0.02em; margin: 0 0 0.4rem; }
        .blueprint-content .bp-hero-sub { color: var(--bp-muted); font-size: 0.92rem; margin: 0; font-family: 'IBM Plex Mono', monospace; }

        /* Sections */
        .blueprint-content .bp-section { position: relative; padding: 2.4rem 0 0.6rem; animation: bpFadeUp 0.55s ease-out both; }
        .blueprint-content .bp-section:nth-of-type(2) { animation-delay: 0.08s; }
        .blueprint-content .bp-section:nth-of-type(3) { animation-delay: 0.16s; }
        .blueprint-content .bp-section:nth-of-type(4) { animation-delay: 0.24s; }
        .blueprint-content .bp-section:nth-of-type(5) { animation-delay: 0.32s; }
        .blueprint-content .bp-section:nth-of-type(6) { animation-delay: 0.40s; }
        .blueprint-content .bp-section:nth-of-type(7) { animation-delay: 0.48s; }
        .blueprint-content .bp-numeral { font-family: 'DM Serif Display', serif; font-style: italic; font-size: 1.15rem; color: var(--bp-sage); margin: 0 0 0.2rem; letter-spacing: -0.01em; }
        .blueprint-content h2 { font-family: 'DM Serif Display', serif; font-style: italic; font-size: 2.05rem; line-height: 1.1; margin: 0 0 1.1rem; letter-spacing: -0.015em; }
        .blueprint-content h3 { font-family: 'IBM Plex Mono', monospace; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.18em; color: var(--bp-muted); margin: 1.2rem 0 0.5rem; font-weight: 700; }

        /* Prose */
        .blueprint-content p { margin: 0.6rem 0 0.9rem; max-width: 68ch; line-height: 1.62; font-size: 1.02rem; }
        .blueprint-content strong { font-weight: 700; color: var(--bp-ink); }
        .blueprint-content em { font-family: 'DM Serif Display', serif; font-style: italic; font-weight: 400; }
        .blueprint-content code { font-family: 'IBM Plex Mono', monospace; font-size: 0.92em; background: var(--bp-paper-deep); padding: 1px 5px; border-radius: 2px; }
        .blueprint-content ul { margin: 0.7rem 0; padding-left: 1.2rem; max-width: 68ch; }
        .blueprint-content li { margin: 0.4rem 0; line-height: 1.55; }
        .blueprint-content li::marker { color: var(--bp-sage); }

        /* TL;DR pull-quote card */
        .blueprint-content .bp-tldr {
          font-family: 'DM Serif Display', serif; font-style: italic; font-size: 1.3rem; line-height: 1.35;
          color: var(--bp-ink); padding: 0.9rem 1.4rem; margin: 0.8rem 0 1.4rem;
          border-left: 3px solid var(--bp-sage); background: var(--bp-sage-tint); max-width: 64ch;
        }
        .blueprint-content .bp-lead { color: var(--bp-muted); font-size: 0.95rem; margin: 0.6rem 0 1.2rem; max-width: 64ch; }

        /* 60/25/15 stacked bar */
        .blueprint-content .bp-stacked-bar {
          display: flex; height: 56px; border-radius: 2px; overflow: hidden;
          margin: 1.4rem 0 1.6rem; border: 1px solid var(--bp-rule);
        }
        .blueprint-content .bp-band {
          display: flex; align-items: center; justify-content: center; padding: 0 1rem;
          font-family: 'IBM Plex Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em;
          width: 0%; animation: bpBandReveal 0.9s 0.3s ease-out both;
        }
        .blueprint-content .bp-band-agent { background: var(--bp-sage); color: var(--bp-paper); animation-delay: 0.3s; }
        .blueprint-content .bp-band-augmented { background: var(--bp-sage-mid); color: var(--bp-ink); animation-delay: 0.42s; }
        .blueprint-content .bp-band-human { background: var(--bp-paper-deep); color: var(--bp-ink); animation-delay: 0.54s; }

        /* Critical: columns sized to MATCH the bands above (60% / 25% / 15%) so
           AGENT / AUGMENTED / HUMAN copy sits directly under its band. */
        .blueprint-content .bp-map-grid { display: grid; grid-template-columns: 60fr 25fr 15fr; gap: 1.6rem; margin: 1.4rem 0 0.5rem; }
        .blueprint-content .bp-map-col h3 { margin-top: 0; }
        .blueprint-content .bp-map-col li { font-size: 0.94rem; }
        @media (max-width: 900px) {
          .blueprint-content .bp-map-grid { grid-template-columns: 1fr; }
        }

        /* 90-day timeline */
        .blueprint-content .bp-axis-pill {
          display: inline-block; padding: 0.5rem 0.9rem; background: var(--bp-sage-tint);
          border-left: 2px solid var(--bp-sage); font-size: 0.92rem; margin: 0.5rem 0 1.2rem;
        }
        .blueprint-content .bp-axis-pill strong { color: var(--bp-sage); letter-spacing: 0.04em; }
        .blueprint-content .bp-timeline { list-style: none; padding: 0; margin: 1rem 0 0; position: relative; }
        .blueprint-content .bp-timeline::before {
          content: ''; position: absolute; left: 19px; top: 6px; bottom: 6px; width: 1px;
          background: linear-gradient(to bottom, var(--bp-sage), var(--bp-sage-mid));
        }
        .blueprint-content .bp-phase { position: relative; padding: 0.4rem 0 1.6rem 3rem; }
        .blueprint-content .bp-phase-marker {
          position: absolute; left: 0; top: 0.35rem; width: 40px; height: 40px;
          display: flex; align-items: center; justify-content: center;
          background: var(--bp-paper); border: 1.5px solid var(--bp-sage); border-radius: 50%;
          font-family: 'DM Serif Display', serif; font-style: italic; font-size: 1.2rem; color: var(--bp-sage);
          animation: bpMarkerPop 0.5s ease-out both;
        }
        .blueprint-content .bp-phase:nth-child(1) .bp-phase-marker { animation-delay: 0.5s; }
        .blueprint-content .bp-phase:nth-child(2) .bp-phase-marker { animation-delay: 0.65s; }
        .blueprint-content .bp-phase:nth-child(3) .bp-phase-marker { animation-delay: 0.8s; }
        .blueprint-content .bp-phase-days { font-family: 'IBM Plex Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--bp-sage); margin: 0 0 0.3rem; }
        .blueprint-content .bp-phase h3 {
          font-family: 'DM Serif Display', serif; font-style: italic; font-size: 1.35rem;
          text-transform: none; letter-spacing: -0.005em; color: var(--bp-ink); margin: 0 0 0.6rem; font-weight: 400;
        }
        .blueprint-content .bp-phase-impact {
          margin: 0.6rem 0 0; padding: 0.5rem 0.8rem; background: var(--bp-paper-deep); border-radius: 2px;
          font-size: 0.92rem; max-width: 64ch;
        }
        .blueprint-content .bp-impact-label {
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em;
          color: var(--bp-sage); font-weight: 700; margin-right: 0.5rem;
        }

        /* Quick-win tiles */
        .blueprint-content .bp-wins-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.9rem; margin: 1.2rem 0; }
        .blueprint-content .bp-win {
          padding: 1rem 1.1rem; background: var(--bp-paper); border: 1px solid var(--bp-rule);
          border-left: 3px solid var(--bp-sage); transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .blueprint-content .bp-win:hover { transform: translateY(-1px); box-shadow: 0 6px 16px -8px rgba(26,26,26,0.18); }
        .blueprint-content .bp-win-meta {
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 0.14em;
          color: var(--bp-muted); margin: 0 0 0.4rem;
        }
        .blueprint-content .bp-win h3 {
          font-family: 'DM Serif Display', serif; font-style: italic; font-size: 1.15rem;
          text-transform: none; letter-spacing: -0.005em; color: var(--bp-ink); margin: 0 0 0.5rem; font-weight: 400;
        }
        .blueprint-content .bp-win-impact { font-size: 0.88rem; color: var(--bp-muted); margin: 0; }

        /* Costed gaps explainer (static — same for every Blueprint) */
        .blueprint-content .bp-precondition-explainer {
          padding: 1.1rem 1.4rem; margin: 0.8rem 0 1rem; background: var(--bp-paper-deep);
          border-left: 2px solid var(--bp-sage); border-radius: 2px;
        }
        .blueprint-content .bp-pre-eyebrow {
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.18em;
          text-transform: uppercase; color: var(--bp-sage); margin: 0 0 0.5rem;
        }
        .blueprint-content .bp-precondition-explainer p { margin: 0 0 0.6rem; max-width: 70ch; font-size: 0.95rem; }
        .blueprint-content .bp-pre-list {
          list-style: none; padding: 0; margin: 0.6rem 0 0;
          display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.55rem 1.4rem;
        }
        .blueprint-content .bp-pre-list li { font-size: 0.88rem; line-height: 1.5; padding-left: 0; margin: 0; }
        .blueprint-content .bp-pre-list strong { color: var(--bp-sage); font-family: 'IBM Plex Mono', monospace; font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 700; }
        @media (max-width: 720px) {
          .blueprint-content .bp-pre-list { grid-template-columns: 1fr; }
        }

        /* Severity legend */
        .blueprint-content .bp-sev-legend {
          display: flex; align-items: center; gap: 0.6rem; margin: 0.8rem 0 0.5rem;
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.14em; color: var(--bp-muted);
        }
        .blueprint-content .bp-sev-legend-bar {
          display: inline-block; width: 80px; height: 4px; background: var(--bp-paper-deep); border-radius: 2px; overflow: hidden; position: relative;
        }
        .blueprint-content .bp-sev-legend-fill {
          display: block; height: 100%; width: 100%; background: linear-gradient(to right, var(--bp-sage-mid), var(--bp-sage));
        }

        /* Costed gaps with severity */
        .blueprint-content .bp-gaps-list { list-style: none; padding: 0; margin: 1rem 0; }
        .blueprint-content .bp-gap {
          padding: 1rem 1.2rem; margin: 0.7rem 0; background: var(--bp-paper);
          border: 1px solid var(--bp-rule); border-left-width: 4px; border-left-color: var(--bp-sage-mid);
        }
        .blueprint-content .bp-gap.bp-sev-3 { border-left-color: var(--bp-sage); }
        .blueprint-content .bp-gap.bp-sev-2 { border-left-color: var(--bp-sage-mid); }
        .blueprint-content .bp-gap.bp-sev-1 { border-left-color: var(--bp-paper-deep); }
        .blueprint-content .bp-pre-pill {
          display: inline-block; padding: 2px 8px; background: var(--bp-paper-deep);
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.14em; color: var(--bp-muted); margin-bottom: 0.4rem;
        }
        .blueprint-content .bp-gap h3 {
          font-family: 'DM Serif Display', serif; font-style: italic; font-size: 1.18rem;
          text-transform: none; letter-spacing: -0.005em; color: var(--bp-ink); margin: 0.3rem 0 0.6rem; font-weight: 400;
        }
        .blueprint-content .bp-sev-bar { height: 4px; background: var(--bp-paper-deep); border-radius: 2px; overflow: hidden; margin: 0.5rem 0; }
        .blueprint-content .bp-sev-fill {
          height: 100%; background: var(--bp-sage); border-radius: 2px;
          width: 0%; animation: bpBandReveal 0.8s 0.4s ease-out both;
        }
        .blueprint-content .bp-gap-cost {
          font-family: 'IBM Plex Mono', monospace; font-size: 0.92rem; margin: 0.5rem 0 0.4rem;
        }
        .blueprint-content .bp-gap-cost strong { color: var(--bp-sage); font-size: 1.1rem; }
        .blueprint-content .bp-gap-cost span { color: var(--bp-muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.12em; margin-left: 0.4rem; }
        .blueprint-content .bp-gap-fix { margin: 0.4rem 0 0; font-size: 0.94rem; color: var(--bp-ink); }
        .blueprint-content .bp-fix-label {
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; text-transform: uppercase;
          letter-spacing: 0.16em; color: var(--bp-sage); font-weight: 700; margin-right: 0.5rem;
        }

        /* Engagement fit hero */
        .blueprint-content .bp-fit {
          padding: 2rem 1.6rem; margin: 2.5rem 0 1.5rem;
          background: linear-gradient(135deg, var(--bp-sage-tint), var(--bp-paper-deep));
          border: 1px solid var(--bp-sage-mid); border-radius: 2px; position: relative;
        }
        .blueprint-content .bp-fit-eyebrow { color: var(--bp-sage); margin-bottom: 0.5rem; }
        .blueprint-content .bp-fit-name {
          font-family: 'DM Serif Display', serif; font-style: italic; font-size: 2.4rem;
          margin: 0.2rem 0 0.6rem; line-height: 1.1; letter-spacing: -0.02em;
        }
        .blueprint-content .bp-fit-price {
          display: inline-block; padding: 6px 14px; background: var(--bp-ink); color: var(--bp-paper);
          font-family: 'IBM Plex Mono', monospace; font-size: 13px; letter-spacing: 0.06em;
          margin: 0 0 1rem; border-radius: 2px;
        }
        .blueprint-content .bp-fit-reason p { margin: 0.5rem 0; font-size: 1.02rem; max-width: 64ch; }

        /* Pace section */
        .blueprint-content .bp-pace { background: var(--bp-paper-deep); padding: 1.6rem 1.6rem 1.4rem; margin-top: 2.4rem; border-radius: 2px; }
        .blueprint-content .bp-pace h2 { margin-top: 0; }

        /* Footer */
        .blueprint-content .bp-footer {
          margin-top: 3rem; padding-top: 1.4rem; border-top: 1px solid var(--bp-rule);
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.16em;
          text-transform: uppercase; color: var(--bp-muted);
        }
        .blueprint-content .bp-footer a { color: var(--bp-sage); text-decoration: none; }

        /* Animations */
        @keyframes bpFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bpBandReveal {
          to { width: var(--target, 100%); }
        }
        @keyframes bpMarkerPop {
          from { opacity: 0; transform: scale(0.6); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .blueprint-content * { animation: none !important; }
          .blueprint-content .bp-band { width: var(--target, auto) !important; }
          .blueprint-content .bp-sev-fill { width: var(--target, 0%) !important; }
        }

        /* Responsive */
        @media (max-width: 720px) {
          .blueprint-content h1 { font-size: 2.2rem; }
          .blueprint-content h2 { font-size: 1.55rem; }
          .blueprint-content .bp-tldr { font-size: 1.1rem; }
          .blueprint-content .bp-map-grid { grid-template-columns: 1fr; }
          .blueprint-content .bp-wins-grid { grid-template-columns: 1fr; }
          .blueprint-content .bp-stacked-bar { flex-direction: column; height: auto; }
          .blueprint-content .bp-band { padding: 0.7rem 1rem; }
          .blueprint-content .bp-fit-name { font-size: 1.7rem; }
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
