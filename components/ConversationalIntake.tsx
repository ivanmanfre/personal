import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUp, Check, Loader2, AlertTriangle, Mic, MicOff } from 'lucide-react';
import { useMetadata } from '../hooks/useMetadata';

// Browser SpeechRecognition (Web Speech API) — Chromium/Safari
type SpeechRecognitionConstructor = typeof window extends { SpeechRecognition: infer T } ? T : any;
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}
const SpeechRecognitionImpl: any =
  typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition || null)
    : null;
const VOICE_SUPPORTED = !!SpeechRecognitionImpl;

const CHAT_ENDPOINT = 'https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/assessment-intake-chat';
const LEGACY_FORM_URL = '/assessment/intake-form';

const QUESTION_LABELS: Record<string, string> = {
  company: 'Company + your role',
  size_revenue: 'Team size + revenue',
  work_description: 'The work AI should handle',
  input_source: 'Where input first lands',
  input_shape: 'Shape of the input',
  input_consistency: 'Input consistency',
  input_gap: 'Most-missing data piece',
  best_person: 'Best person at this work',
  documentability: 'How documentable',
  criteria: 'Criteria they use',
  gut_feel: 'Gut-feel vs objective',
  frequency: 'How often',
  v1_scope: 'V1 scope',
  excluded: 'What to exclude from V1',
  success_metric: 'Success metric',
  tolerance: 'Error tolerance',
  reviewer: 'Who reviews AI output',
  review_time: 'Daily review minutes',
  uncertain_default: 'When AI is uncertain',
  downside: 'Downstream damage',
};

const QUESTION_ORDER = Object.keys(QUESTION_LABELS);

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

type SessionState =
  | 'loading'
  | 'ready'
  | 'sending'
  | 'rate_limited'
  | 'locked'
  | 'submitted'
  | 'error';

const ConversationalIntake: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session_id');

  const [state, setState] = useState<SessionState>('loading');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [input, setInput] = useState('');
  const [turnCount, setTurnCount] = useState(0);
  const [nonce, setNonce] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const interimRef = useRef<string>('');
  const silenceTimerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceErr, setVoiceErr] = useState<string | null>(null);

  // Voice auto-stop after N seconds of silence (no new transcript fragments)
  const VOICE_SILENCE_TIMEOUT_MS = 4000;
  const VOICE_HARD_CAP_MS = 90000; // hard 90s cap regardless

  useMetadata({
    title: 'Blueprint intake | Manfredi',
    description: 'Walk through your Agent-Ready Blueprint intake conversationally.',
    canonical: 'https://ivanmanfredi.com/assessment/welcome',
    noindex: true,
  });

  // Auto-scroll on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, state]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [input]);

  // Rate-limit countdown
  useEffect(() => {
    if (retryAfter == null) return;
    if (retryAfter <= 0) {
      setRetryAfter(null);
      setState('ready');
      return;
    }
    const id = setTimeout(() => setRetryAfter(retryAfter - 1), 1000);
    return () => clearTimeout(id);
  }, [retryAfter]);

  // INIT — load existing chat history + nonce
  useEffect(() => {
    if (!sessionId) {
      setError('Missing session ID. Did you arrive from the Stripe checkout?');
      setState('error');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(CHAT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, init: true }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (!cancelled) {
            setError(body.error ?? `Init failed (${res.status})`);
            setState('error');
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setTurnCount(data.turn_count ?? 0);
        setNonce(data.nonce ?? null);
        setAnswers(data.answers ?? {});
        const history: ChatMessage[] = data.chat_history ?? [];
        setMessages(history);
        if (data.submitted) {
          setState('submitted');
          return;
        }
        if (data.greeting && history.length === 0) {
          setMessages([{ role: 'assistant', content: data.greeting, ts: new Date().toISOString() }]);
        }
        setState('ready');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Network error during init');
        setState('error');
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  const send = useCallback(async () => {
    if (!input.trim() || !nonce || !sessionId) return;
    if (state !== 'ready') return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: input.trim(),
      ts: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    setState('sending');

    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          message: userMsg.content,
          nonce,
          turn_count: turnCount,
        }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setRetryAfter(body.retry_after_seconds ?? 60);
        setState('rate_limited');
        return;
      }

      if (res.status === 413) {
        setError('Message too long. Please trim it under 2,000 characters.');
        setState('ready');
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Send failed (${res.status})`);
        setState('ready');
        return;
      }

      const data = await res.json();

      if (data.locked) {
        setMessages((m) => [...m, {
          role: 'assistant',
          content: data.message ?? 'Session locked.',
          ts: new Date().toISOString(),
        }]);
        setState('locked');
        return;
      }

      setMessages((m) => [...m, {
        role: 'assistant',
        content: data.message,
        ts: new Date().toISOString(),
      }]);
      setAnswers((a) => ({ ...a, ...(data.answers ?? data.extracted_answers ?? {}) }));
      setTurnCount(data.turn_count);
      setNonce(data.nonce);

      if (data.complete) {
        setState('submitted');
      } else {
        setState('ready');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setState('ready');
    }
  }, [input, nonce, sessionId, state, turnCount]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const stopRecording = useCallback(() => {
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    try { recognitionRef.current?.stop(); } catch { /* ignore */ }
  }, []);

  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current != null) window.clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = window.setTimeout(() => {
      stopRecording();
    }, VOICE_SILENCE_TIMEOUT_MS);
  }, [stopRecording]);

  // Voice input toggle. Web Speech API streams interim results into the textarea.
  // Auto-stops after VOICE_SILENCE_TIMEOUT_MS of no new transcript fragments
  // OR a hard cap of VOICE_HARD_CAP_MS regardless.
  const toggleRecording = useCallback(() => {
    if (!VOICE_SUPPORTED) {
      setVoiceErr('Your browser does not support voice input. Try Chrome, Edge, or Safari.');
      return;
    }
    if (recording) {
      stopRecording();
      return;
    }
    try {
      const rec = new SpeechRecognitionImpl();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      const baseValue = input;
      interimRef.current = '';
      rec.onresult = (ev: any) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          if (r.isFinal) finalChunk += r[0].transcript;
          else interimChunk += r[0].transcript;
        }
        if (finalChunk) interimRef.current += finalChunk;
        const combined = (baseValue ? baseValue.trimEnd() + ' ' : '') +
          interimRef.current + interimChunk;
        setInput(combined.trim());
        resetSilenceTimer();
      };
      rec.onerror = (ev: any) => {
        const msg = ev?.error === 'not-allowed'
          ? 'Microphone access denied. Enable it in your browser settings.'
          : ev?.error === 'no-speech'
          ? null // expected, no UI noise
          : `Voice input error: ${ev?.error ?? 'unknown'}`;
        if (msg) setVoiceErr(msg);
        stopRecording();
      };
      rec.onend = () => {
        if (silenceTimerRef.current != null) {
          window.clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        setRecording(false);
        recognitionRef.current = null;
      };
      recognitionRef.current = rec;
      setVoiceErr(null);
      setRecording(true);
      rec.start();
      // Hard cap fallback
      window.setTimeout(() => {
        if (recognitionRef.current === rec) stopRecording();
      }, VOICE_HARD_CAP_MS);
      // Initial silence timer (in case user clicks mic but never speaks)
      resetSilenceTimer();
    } catch (e) {
      setVoiceErr(e instanceof Error ? e.message : 'Voice input failed to start');
      setRecording(false);
    }
  }, [recording, input, stopRecording, resetSilenceTimer]);

  // Stop recording on unmount
  useEffect(() => () => {
    try { stopRecording(); } catch { /* ignore */ }
  }, [stopRecording]);

  const answeredCount = useMemo(
    () => QUESTION_ORDER.filter((k) => answers[k] != null && answers[k] !== '').length,
    [answers],
  );
  const progressPct = (answeredCount / QUESTION_ORDER.length) * 100;

  const charCount = input.length;
  const charCountColor =
    charCount > 1500 ? 'text-amber-700' : charCount > 1800 ? 'text-red-700' : 'text-ink-mute';

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-[color:var(--color-hairline)]">
        <div className="container mx-auto max-w-3xl px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-baseline gap-3 min-w-0">
            <h1 className="text-base md:text-lg font-semibold tracking-tight whitespace-nowrap">
              <span className="font-drama italic">The</span> Agent-Ready Blueprint
            </h1>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute hidden sm:inline">
              · Intake
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs tabular-nums text-ink-soft">
              {answeredCount}<span className="text-ink-mute">/{QUESTION_ORDER.length}</span>
            </span>
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="text-xs font-mono uppercase tracking-[0.1em] text-ink-soft hover:text-black px-2 py-1 border border-[color:var(--color-hairline)] rounded"
              aria-label="Toggle question list"
            >
              {sidebarOpen ? 'Close' : 'Questions'}
            </button>
          </div>
        </div>
        <div className="h-[2px] w-full bg-[color:var(--color-hairline)]">
          <div
            className="h-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <main className="flex-1 flex relative">
        {/* Sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: 320 }}
              animate={{ x: 0 }}
              exit={{ x: 320 }}
              transition={{ type: 'tween', duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              className="fixed top-[57px] right-0 bottom-0 w-80 bg-paper-sunk border-l border-[color:var(--color-hairline-bold)] z-30 overflow-y-auto"
            >
              <div className="p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-3">
                  Intake checklist
                </p>
                <ul className="space-y-1.5">
                  {QUESTION_ORDER.map((key, i) => {
                    const answered = answers[key] != null && answers[key] !== '';
                    return (
                      <li
                        key={key}
                        className={`flex items-start gap-2.5 text-sm py-1 ${answered ? 'text-black' : 'text-ink-mute'}`}
                      >
                        <span className={`mt-0.5 w-4 h-4 flex items-center justify-center flex-shrink-0 border ${answered ? 'bg-accent border-accent text-white' : 'border-[color:var(--color-hairline-bold)]'}`}>
                          {answered ? <Check size={10} strokeWidth={3} /> : <span className="text-[10px] font-mono">{i + 1}</span>}
                        </span>
                        <span className={answered ? 'line-through decoration-[color:var(--color-hairline-bold)]' : ''}>
                          {QUESTION_LABELS[key]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-6 text-xs text-ink-mute leading-relaxed">
                  These are the 20 things the Blueprint covers. Ivan-bot will weave through them naturally — no need to follow this order.
                </p>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Chat column */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto"
          >
            <div className="container mx-auto max-w-3xl px-6 py-8 space-y-5">
              {state === 'loading' && (
                <div className="flex items-center gap-3 text-ink-mute">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm">Loading your intake…</span>
                </div>
              )}

              {state === 'error' && (
                <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-900">
                  <p className="font-semibold mb-1 flex items-center gap-2">
                    <AlertTriangle size={14} /> Couldn't open the intake
                  </p>
                  <p className="text-red-800/80">{error}</p>
                  <p className="mt-3">
                    <a href={LEGACY_FORM_URL + (sessionId ? `?session_id=${sessionId}` : '')} className="underline">
                      Switch to the form version
                    </a>
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <ChatBubble key={i} role={m.role} content={m.content} />
              ))}

              {state === 'sending' && <TypingIndicator />}

              {state === 'rate_limited' && (
                <div className="border-l-2 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Take a quick break — we're rate-limiting to protect the session.
                  Back in <span className="font-mono tabular-nums">{retryAfter}s</span>.
                </div>
              )}

              {state === 'locked' && (
                <div className="border border-red-200 bg-red-50 p-5 text-sm text-red-900">
                  <p className="font-semibold mb-1 flex items-center gap-2">
                    <AlertTriangle size={14} /> Session locked
                  </p>
                  <p className="text-red-800/80">
                    Something flagged in this session. Ivan has been notified — we'll reach out shortly.
                  </p>
                </div>
              )}

              {state === 'submitted' && (
                <SubmittedCard answers={answers} />
              )}
            </div>
          </div>

          {/* Composer */}
          {state !== 'submitted' && state !== 'locked' && state !== 'error' && (
            <div className="border-t border-[color:var(--color-hairline)] bg-paper">
              <div className="container mx-auto max-w-3xl px-6 py-4">
                <div className="flex items-end gap-3">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      state === 'rate_limited'
                        ? 'Hold tight, back in a minute.'
                        : state === 'sending'
                        ? 'Thinking…'
                        : recording
                        ? 'Listening… speak naturally.'
                        : 'Type or hit the mic. Enter sends, Shift+Enter newlines.'
                    }
                    rows={1}
                    maxLength={2000}
                    disabled={state !== 'ready' && !recording}
                    className="flex-1 resize-none bg-paper-sunk border border-[color:var(--color-hairline-bold)] px-4 py-3 text-sm leading-relaxed focus:outline-none focus:border-accent disabled:opacity-50 font-sans"
                  />
                  {VOICE_SUPPORTED && (
                    <button
                      onClick={toggleRecording}
                      disabled={state !== 'ready' && !recording}
                      className={`self-stretch px-3 border transition-colors flex items-center justify-center ${
                        recording
                          ? 'bg-red-600 text-white border-red-700 animate-pulse'
                          : 'bg-paper border-[color:var(--color-hairline-bold)] text-ink hover:bg-paper-sunk'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                      aria-label={recording ? 'Stop recording' : 'Start voice input'}
                      title={recording ? 'Click to stop recording' : 'Click to dictate your answer'}
                    >
                      {recording ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                  )}
                  <button
                    onClick={send}
                    disabled={state !== 'ready' || !input.trim()}
                    className="self-stretch px-4 bg-accent text-white border border-accent disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-opacity"
                    aria-label="Send"
                  >
                    {state === 'sending' ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} />}
                  </button>
                </div>
                {voiceErr && (
                  <div className="mt-2 text-[11px] text-red-700 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> {voiceErr}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2 text-[10px] font-mono uppercase tracking-[0.12em]">
                  <span className="text-ink-mute">
                    Saves automatically ·{' '}
                    <a href={LEGACY_FORM_URL + (sessionId ? `?session_id=${sessionId}` : '')} className="underline hover:text-black">
                      switch to form
                    </a>
                  </span>
                  <span className={`tabular-nums ${charCountColor}`}>
                    {charCount}/2000
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

const ChatBubble: React.FC<{ role: 'user' | 'assistant'; content: string }> = ({ role, content }) => {
  const isBot = role === 'assistant';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`max-w-[85%] md:max-w-[78%] px-5 py-3.5 ${
          isBot
            ? 'bg-paper-sunk border-l-2 border-accent text-ink leading-relaxed'
            : 'bg-accent text-white leading-relaxed'
        }`}
      >
        <div className="text-sm md:text-[15px] whitespace-pre-wrap">{content}</div>
      </div>
    </motion.div>
  );
};

const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex items-center gap-2 text-ink-mute"
    aria-live="polite"
  >
    <div className="flex items-center gap-1 px-4 py-3 bg-paper-sunk border-l-2 border-accent">
      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '180ms' }} />
      <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: '360ms' }} />
    </div>
  </motion.div>
);

const SubmittedCard: React.FC<{ answers: Record<string, unknown> }> = ({ answers }) => {
  const answeredCount = QUESTION_ORDER.filter((k) => answers[k] != null && answers[k] !== '').length;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-paper-sunk border border-[color:var(--color-hairline-bold)] p-8 md:p-12 text-center"
    >
      <p className="font-drama italic text-6xl md:text-7xl text-accent leading-none mb-2">100%</p>
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute mb-4">
        intake submitted — your Blueprint starts now
      </p>
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight mb-3">
        Got it. Ivan will review and reach out within 1 business day.
      </h2>
      <p className="text-sm text-ink-soft max-w-md mx-auto leading-relaxed">
        You answered {answeredCount} of {QUESTION_ORDER.length} questions. Want to add more before our working session? Reply to the welcome email — I read every one.
      </p>
    </motion.div>
  );
};

export default ConversationalIntake;
