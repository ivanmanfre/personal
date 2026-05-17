import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUp, Check, Loader2, AlertTriangle, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
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

// ─────────────────────────────────────────────────────────────
// Schema — 5 editorial pillars across 20 keys
// ─────────────────────────────────────────────────────────────

interface Pillar {
  numeral: string;
  label: string;
  keys: string[];
}

// Paid Assessment schema — 20 keys, 5 pillars (Agent-Ready preconditions)
const PAID_PILLARS: Pillar[] = [
  { numeral: 'I',   label: 'Setup',                 keys: ['company', 'size_revenue', 'work_description'] },
  { numeral: 'II',  label: 'Reliable input',        keys: ['input_source', 'input_shape', 'input_consistency', 'input_gap'] },
  { numeral: 'III', label: 'Documentable decision', keys: ['best_person', 'documentability', 'criteria', 'gut_feel', 'frequency'] },
  { numeral: 'IV',  label: 'Narrow scope',          keys: ['v1_scope', 'excluded', 'success_metric', 'tolerance'] },
  { numeral: 'V',   label: 'Human review',          keys: ['reviewer', 'review_time', 'uncertain_default', 'downside'] },
];

const PAID_QUESTION_LABELS: Record<string, string> = {
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

// Fractional m1 schema — 30 keys, 8 dimensions (business landscape)
const FRACTIONAL_PILLARS: Pillar[] = [
  { numeral: 'I',    label: 'Context',         keys: ['company', 'size_revenue', 'founders_team', 'icp_description', 'current_revenue_mix'] },
  { numeral: 'II',   label: 'Content state',   keys: ['post_cadence', 'voice_maturity', 'ideation_source', 'distribution_channels', 'audience_size'] },
  { numeral: 'III',  label: 'Outbound',        keys: ['outbound_channels', 'outbound_volume', 'outbound_whats_working', 'outbound_automation_level'] },
  { numeral: 'IV',   label: 'Lead magnets',    keys: ['current_lms', 'lm_conversion_data', 'lm_gaps'] },
  { numeral: 'V',    label: 'Production',      keys: ['team_roles', 'animator_designer_load', 'current_bottleneck', 'delivery_pain'] },
  { numeral: 'VI',   label: 'Partnerships',    keys: ['existing_partners', 'referral_pipeline', 'partner_kickback_structure'] },
  { numeral: 'VII',  label: 'Ops baseline',    keys: ['pm_tooling', 'client_onboarding_pain', 'prompt_library_state'] },
  { numeral: 'VIII', label: 'Brand + voice',   keys: ['identity_statement', 'audience_pov', 'voice_pitfalls_to_avoid'] },
];

const FRACTIONAL_QUESTION_LABELS: Record<string, string> = {
  company: 'Company + your role',
  size_revenue: 'Team size + revenue',
  founders_team: 'Founders/partners + roles',
  icp_description: 'Who you sell to',
  current_revenue_mix: 'Where revenue comes from',
  post_cadence: 'Current posting cadence',
  voice_maturity: 'Voice consistency',
  ideation_source: 'Where topics come from',
  distribution_channels: 'Distribution channels',
  audience_size: 'Audience size per channel',
  outbound_channels: 'Outbound channels',
  outbound_volume: 'Outbound volume + reply rate',
  outbound_whats_working: "What's currently working",
  outbound_automation_level: 'Outbound automation level',
  current_lms: 'Existing lead magnets',
  lm_conversion_data: 'LM conversion data',
  lm_gaps: 'LM opportunities not built',
  team_roles: 'Team members + roles',
  animator_designer_load: 'Creative production load',
  current_bottleneck: 'Current bottleneck',
  delivery_pain: 'Delivery friction',
  existing_partners: 'Named partners',
  referral_pipeline: 'Referral pipeline',
  partner_kickback_structure: 'Kickback structure',
  pm_tooling: 'Project mgmt tooling',
  client_onboarding_pain: 'Onboarding friction',
  prompt_library_state: 'Prompt library state',
  identity_statement: 'Identity statement',
  audience_pov: 'Audience POV',
  voice_pitfalls_to_avoid: 'Voice/language to avoid',
};

// Backward-compat: keep old names pointing to paid schema (used in non-component-scoped helpers).
// The component reads mode-aware versions via useMemo (see below).
const PILLARS = PAID_PILLARS;
const QUESTION_LABELS = PAID_QUESTION_LABELS;
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

// ─────────────────────────────────────────────────────────────
// Editorial paper grid background — barely-visible 40px grid
// ─────────────────────────────────────────────────────────────
const PAPER_GRID_STYLE: React.CSSProperties = {
  backgroundImage: `linear-gradient(to right, rgba(26,26,26,0.025) 1px, transparent 1px), linear-gradient(to bottom, rgba(26,26,26,0.025) 1px, transparent 1px)`,
  backgroundSize: '48px 48px',
  backgroundPosition: '-1px -1px',
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function pillarOfKey(key: string | null | undefined, pillars: Pillar[] = PILLARS): number {
  if (!key) return -1;
  return pillars.findIndex((p) => p.keys.includes(key));
}

function activePillarIdx(answers: Record<string, unknown>, lastFocusKey: string | null, pillars: Pillar[] = PILLARS): number {
  // Prefer the pillar containing the most-recently-touched focus key,
  // otherwise the first pillar with unanswered keys.
  const focusIdx = pillarOfKey(lastFocusKey, pillars);
  if (focusIdx >= 0) {
    const focusPillar = pillars[focusIdx];
    const allDone = focusPillar.keys.every((k) => answers[k] != null && answers[k] !== '');
    if (!allDone) return focusIdx;
  }
  for (let i = 0; i < pillars.length; i++) {
    const allDone = pillars[i].keys.every((k) => answers[k] != null && answers[k] !== '');
    if (!allDone) return i;
  }
  return pillars.length - 1;
}

function pillarProgress(pillar: Pillar, answers: Record<string, unknown>): { hit: number; total: number } {
  const total = pillar.keys.length;
  const hit = pillar.keys.filter((k) => answers[k] != null && answers[k] !== '').length;
  return { hit, total };
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

const ConversationalIntake: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // Accept either ?session_id= (paid Assessment, from Stripe redirect) or ?token= (Fractional, from issued link)
  const sessionId = params.get('session_id') ?? params.get('token');

  const [state, setState] = useState<SessionState>('loading');
  const [mode, setMode] = useState<'paid_assessment' | 'fractional_m1'>('paid_assessment');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});

  // Mode-aware pillars + labels (overrides the top-level constants for component-scoped usage)
  const activePillars = mode === 'fractional_m1' ? FRACTIONAL_PILLARS : PAID_PILLARS;
  const activeLabels = mode === 'fractional_m1' ? FRACTIONAL_QUESTION_LABELS : PAID_QUESTION_LABELS;
  const activeQuestionOrder = Object.keys(activeLabels);
  const [lastFocus, setLastFocus] = useState<string | null>(null);
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

  // TTS playback (Path A v1 — voice agent response audio)
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speakerOn, setSpeakerOn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('intake_speaker_on') === 'true';
  });
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const lastSpokenIdxRef = useRef<number>(-1);
  // Track whether stopRecording was triggered by silence (auto-send) vs manual click
  const stoppedBySilenceRef = useRef<boolean>(false);

  const VOICE_SILENCE_TIMEOUT_MS = 3000;
  const VOICE_HARD_CAP_MS = 90000;
  const TTS_ENDPOINT = 'https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/intake-tts';

  useMetadata({
    title: 'Blueprint intake | Manfredi',
    description: 'Walk through your Agent-Ready Blueprint intake conversationally.',
    canonical: 'https://ivanmanfredi.com/assessment/welcome',
    noindex: true,
  });

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, state]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`;
  }, [input]);

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
        // Set mode from init response (defaults to paid_assessment if missing)
        if (data.mode === 'fractional_m1' || data.mode === 'paid_assessment') setMode(data.mode);
        const history: ChatMessage[] = data.chat_history ?? [];
        setMessages(history);
        if (data.submitted) { setState('submitted'); return; }
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
      role: 'user', content: input.trim(), ts: new Date().toISOString(),
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
          nonce, turn_count: turnCount,
        }),
      });

      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setRetryAfter(body.retry_after_seconds ?? 60);
        setState('rate_limited');
        return;
      }
      if (res.status === 413) {
        setError('Message too long. Trim it under 2,000 characters.');
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
          role: 'assistant', content: data.message ?? 'Session locked.', ts: new Date().toISOString(),
        }]);
        setState('locked');
        return;
      }

      setMessages((m) => [...m, {
        role: 'assistant', content: data.message, ts: new Date().toISOString(),
      }]);
      setAnswers((a) => ({ ...a, ...(data.answers ?? data.extracted_answers ?? {}) }));
      setLastFocus(data.current_focus ?? lastFocus);
      setTurnCount(data.turn_count);
      setNonce(data.nonce);

      if (data.complete) setState('submitted');
      else setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setState('ready');
    }
  }, [input, nonce, sessionId, state, turnCount, lastFocus]);

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
      // Mark that this stop was triggered by silence (auto-send) — onend handler will trigger send()
      stoppedBySilenceRef.current = true;
      stopRecording();
    }, VOICE_SILENCE_TIMEOUT_MS);
  }, [stopRecording]);

  const toggleRecording = useCallback(() => {
    if (!VOICE_SUPPORTED) {
      setVoiceErr('Your browser does not support voice input. Try Chrome, Edge, or Safari.');
      return;
    }
    if (recording) { stopRecording(); return; }
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
        const combined = (baseValue ? baseValue.trimEnd() + ' ' : '') + interimRef.current + interimChunk;
        setInput(combined.trim());
        resetSilenceTimer();
      };
      rec.onerror = (ev: any) => {
        const msg = ev?.error === 'not-allowed'
          ? 'Microphone access denied. Enable it in your browser settings.'
          : ev?.error === 'no-speech' ? null
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
        // If silence timeout triggered the stop (vs manual click), auto-send if there's content
        if (stoppedBySilenceRef.current) {
          stoppedBySilenceRef.current = false;
          // Read latest textarea value (input state may not have flushed yet) + schedule send
          setTimeout(() => {
            const latest = textareaRef.current?.value?.trim();
            if (latest) send();
          }, 50);
        }
      };
      recognitionRef.current = rec;
      setVoiceErr(null);
      setRecording(true);
      rec.start();
      window.setTimeout(() => {
        if (recognitionRef.current === rec) stopRecording();
      }, VOICE_HARD_CAP_MS);
      resetSilenceTimer();
    } catch (e) {
      setVoiceErr(e instanceof Error ? e.message : 'Voice input failed to start');
      setRecording(false);
    }
  }, [recording, input, stopRecording, resetSilenceTimer]);

  useEffect(() => () => { try { stopRecording(); } catch { /* ignore */ } }, [stopRecording]);

  // TTS playback for agent responses
  const playAudio = useCallback(async (text: string) => {
    if (!sessionId || !text.trim()) return;
    // Stop any in-flight playback
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* ignore */ }
      audioRef.current = null;
    }
    try {
      setTtsPlaying(true);
      const res = await fetch(TTS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, text }),
      });
      if (!res.ok) {
        console.warn('[tts-fetch-failed]', res.status);
        setTtsPlaying(false);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setTtsPlaying(false); URL.revokeObjectURL(url); };
      await audio.play();
    } catch (e) {
      console.warn('[tts-play-error]', e instanceof Error ? e.message : String(e));
      setTtsPlaying(false);
    }
  }, [sessionId]);

  // Toggle speaker on/off — persists across reloads.
  // When turning ON, mark existing messages as "already spoken" so we don't replay history.
  // Only new agent messages from this point forward will auto-play.
  const toggleSpeaker = useCallback(() => {
    setSpeakerOn((on) => {
      const next = !on;
      try { window.localStorage.setItem('intake_speaker_on', String(next)); } catch { /* ignore */ }
      if (next) {
        // Mark all current messages as already-spoken so the next useEffect run doesn't replay them
        lastSpokenIdxRef.current = messages.length - 1;
      } else {
        // Turning off — stop any in-flight playback
        if (audioRef.current) { try { audioRef.current.pause(); } catch { /* ignore */ } audioRef.current = null; }
        setTtsPlaying(false);
      }
      return next;
    });
  }, [messages.length]);

  // Auto-play TTS when a NEW assistant message arrives (only if speakerOn AND it's not historical)
  useEffect(() => {
    if (!speakerOn) return;
    if (messages.length === 0) return;
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (last.role !== 'assistant') return;
    if (lastIdx <= lastSpokenIdxRef.current) return; // already spoken or marked-as-spoken at toggle time
    lastSpokenIdxRef.current = lastIdx;
    playAudio(last.content);
  }, [messages, speakerOn, playAudio]);

  // Stop audio on unmount
  useEffect(() => () => {
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch { /* ignore */ }
      audioRef.current = null;
    }
  }, []);

  const answeredCount = useMemo(
    () => activeQuestionOrder.filter((k) => answers[k] != null && answers[k] !== '').length,
    [answers],
  );
  const activeIdx = useMemo(() => activePillarIdx(answers, lastFocus, activePillars), [answers, lastFocus]);

  const charCount = input.length;
  const charCountColor = charCount > 1500 ? 'text-amber-700' : charCount > 1800 ? 'text-red-700' : 'text-ink-mute';

  return (
    <div className="min-h-screen bg-paper flex flex-col" style={PAPER_GRID_STYLE}>
      <Masthead activeIdx={activeIdx} activePillars={activePillars} />
      <PillarBar answers={answers} activeIdx={activeIdx} onOpenList={() => setSidebarOpen(true)} />

      <main className="flex-1 flex relative">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed top-0 right-0 bottom-0 w-[380px] max-w-full bg-paper border-l border-[color:var(--color-hairline-bold)] z-30 overflow-y-auto shadow-2xl"
            >
              <ChecklistDrawer answers={answers} onClose={() => setSidebarOpen(false)} />
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-h-0">
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto">
            <div className="container mx-auto max-w-3xl px-6 md:px-10 py-10 space-y-6">
              {state === 'loading' && (
                <div className="flex items-center gap-3 text-ink-mute">
                  <Loader2 size={18} className="animate-spin" />
                  <span className="text-sm font-mono uppercase tracking-[0.14em]">Loading your intake</span>
                </div>
              )}

              {state === 'error' && (
                <div className="border border-red-300 bg-red-50/60 p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-900 mb-2 flex items-center gap-2">
                    <AlertTriangle size={12} /> Couldn't open the intake
                  </p>
                  <p className="text-sm text-red-900">{error}</p>
                  <p className="mt-3 text-sm">
                    <a href={LEGACY_FORM_URL + (sessionId ? `?session_id=${sessionId}` : '')} className="underline">
                      Switch to the form version
                    </a>
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                m.role === 'assistant'
                  ? <BotBubble key={i} content={m.content} index={i} />
                  : <UserBubble key={i} content={m.content} />
              ))}

              {state === 'sending' && <TypingIndicator />}

              {state === 'rate_limited' && (
                <div className="border-l-2 border-amber-500 bg-amber-50/60 px-5 py-4 text-sm text-amber-900">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] mb-1">Pause</p>
                  Rate limit hit, back in <span className="font-mono tabular-nums">{retryAfter}s</span>.
                </div>
              )}

              {state === 'locked' && (
                <div className="border border-red-300 bg-red-50/60 p-6">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-900 mb-2 flex items-center gap-2">
                    <AlertTriangle size={12} /> Session locked
                  </p>
                  <p className="text-sm text-red-900">
                    Something flagged in this session. Ivan has been notified, we'll reach out shortly.
                  </p>
                </div>
              )}

              {state === 'submitted' && (
                <SubmittedCard
                  answers={answers}
                  sessionId={sessionId}
                 activePillars={activePillars} activeLabels={activeLabels} activeQuestionOrder={activeQuestionOrder} />
              )}
            </div>
          </div>

          {state !== 'submitted' && state !== 'locked' && state !== 'error' && (
            <div className="border-t border-[color:var(--color-hairline-bold)] bg-paper">
              <div className="container mx-auto max-w-3xl px-6 md:px-10 py-5">
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative">
                    <span className="absolute -top-5 left-0 font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
                      Your reply
                    </span>
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        state === 'rate_limited' ? 'Hold tight, back in a minute.'
                        : state === 'sending' ? 'Thinking…'
                        : recording ? 'Listening, speak naturally.'
                        : 'Type or hit the mic. Enter sends.'
                      }
                      rows={1}
                      maxLength={2000}
                      disabled={state !== 'ready' && !recording}
                      className="w-full resize-none bg-paper-sunk border border-[color:var(--color-hairline-bold)] px-4 py-3 text-[15px] leading-relaxed focus:outline-none focus:border-accent disabled:opacity-50 font-sans placeholder:text-ink-mute"
                    />
                  </div>
                  {VOICE_SUPPORTED && (
                    <button
                      onClick={toggleRecording}
                      disabled={state !== 'ready' && !recording}
                      className={`self-stretch w-12 border transition-colors flex items-center justify-center ${
                        recording
                          ? 'bg-black text-white border-black'
                          : 'bg-paper border-[color:var(--color-hairline-bold)] text-ink hover:bg-paper-sunk'
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                      aria-label={recording ? 'Stop recording' : 'Start voice input'}
                      title={recording ? 'Click to stop recording' : 'Click to dictate'}
                    >
                      {recording
                        ? <span className="relative inline-flex items-center justify-center"><MicOff size={18} /><span className="absolute -right-1 -top-1 w-1.5 h-1.5 bg-accent animate-pulse" /></span>
                        : <Mic size={18} />}
                    </button>
                  )}
                  <button
                    onClick={toggleSpeaker}
                    className={`self-stretch w-12 border transition-colors flex items-center justify-center ${
                      speakerOn
                        ? 'bg-accent text-white border-accent'
                        : 'bg-paper border-[color:var(--color-hairline-bold)] text-ink hover:bg-paper-sunk'
                    }`}
                    aria-label={speakerOn ? 'Mute agent voice' : 'Enable agent voice'}
                    title={speakerOn ? 'Agent voice ON — click to mute' : 'Agent voice OFF — click to enable (replies will be spoken)'}
                  >
                    {speakerOn
                      ? <span className="relative inline-flex items-center justify-center"><Volume2 size={18} />{ttsPlaying && <span className="absolute -right-1 -top-1 w-1.5 h-1.5 bg-white animate-pulse" />}</span>
                      : <VolumeX size={18} />}
                  </button>
                  <button
                    onClick={send}
                    disabled={state !== 'ready' || !input.trim()}
                    className="self-stretch px-5 bg-black text-white border border-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-opacity hover:bg-ink-soft"
                    aria-label="Send"
                  >
                    {state === 'sending' ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.5} className="text-accent" />}
                  </button>
                </div>
                {voiceErr && (
                  <div className="mt-2 text-[11px] text-red-700 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> {voiceErr}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 text-[10px] font-mono uppercase tracking-[0.14em]">
                  <span className="text-ink-mute flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-accent inline-block" />
                    Saves automatically · {' '}
                    <a href={LEGACY_FORM_URL + (sessionId ? `?session_id=${sessionId}` : '')} className="underline hover:text-black">
                      Switch to form
                    </a>
                  </span>
                  <span className={`tabular-nums ${charCountColor}`}>{charCount}/2000</span>
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

const Masthead: React.FC<{ activeIdx: number; activePillars: Pillar[] }> = ({ activeIdx, activePillars }) => {
  const active = activePillars[activeIdx] ?? activePillars[0];
  return (
    <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-[color:var(--color-hairline-bold)]">
      <div className="container mx-auto max-w-5xl px-6 md:px-10 py-4 flex items-end justify-between gap-6">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute hidden sm:inline">
            00 · Intake
          </span>
          <h1 className="text-base md:text-xl font-semibold tracking-tight whitespace-nowrap">
            <span className="font-drama italic">The</span>{' '}
            <span className="font-drama italic">Agent-Ready</span>{' '}
            Blueprint
          </h1>
        </div>
        <div className="hidden md:flex flex-col items-end leading-none">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-ink-mute">Section</span>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink mt-1">
            {active.numeral} · {active.label}
          </span>
        </div>
      </div>
    </header>
  );
};

const PillarBar: React.FC<{
  answers: Record<string, unknown>;
  activeIdx: number;
  onOpenList: () => void;
  activePillars: Pillar[];
}> = ({ answers, activeIdx, onOpenList, activePillars }) => {
  return (
    <div className="sticky top-[56px] md:top-[64px] z-10 bg-paper border-b border-[color:var(--color-hairline-bold)]">
      <div className="container mx-auto max-w-5xl px-6 md:px-10">
        <div className="flex items-stretch">
          {activePillars.map((p, i) => {
            const { hit, total } = pillarProgress(p, answers);
            const complete = hit === total;
            const active = i === activeIdx;
            return (
              <div
                key={p.numeral}
                className={`flex-1 py-3 flex items-center gap-3 border-r border-[color:var(--color-hairline)] last:border-r-0 px-3 first:pl-0 ${
                  active ? 'opacity-100' : complete ? 'opacity-70' : 'opacity-50'
                } transition-opacity`}
              >
                <span className={`flex-shrink-0 inline-flex items-center justify-center w-6 h-6 font-mono text-[10px] uppercase tracking-tight font-bold ${
                  complete
                    ? 'bg-black text-accent'
                    : active
                      ? 'bg-black text-white'
                      : 'border border-[color:var(--color-hairline-bold)] text-ink-mute'
                }`}>
                  {p.numeral}
                </span>
                <div className="min-w-0 hidden md:block">
                  <div className={`text-[11px] font-mono uppercase tracking-[0.08em] truncate ${active ? 'text-ink' : 'text-ink-mute'}`}>
                    {p.label}
                  </div>
                  <div className="font-mono text-[10px] tabular-nums text-ink-mute mt-0.5">
                    {hit}/{total}
                    {complete && <span className="text-accent ml-1">●</span>}
                  </div>
                </div>
                {active && (
                  <span className="md:hidden font-mono text-[9px] tabular-nums text-ink-mute">{hit}/{total}</span>
                )}
              </div>
            );
          })}
          <button
            onClick={onOpenList}
            className="flex-shrink-0 px-3 py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute hover:text-black border-l border-[color:var(--color-hairline)] transition-colors"
            aria-label="Open all 20 questions"
            title="See all 20 questions"
          >
            All 20 →
          </button>
        </div>
      </div>
    </div>
  );
};

const ChecklistDrawer: React.FC<{ answers: Record<string, unknown>; onClose: () => void; activePillars: Pillar[]; activeLabels: Record<string, string> }> = ({ answers, onClose, activePillars, activeLabels }) => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">Intake checklist</p>
        <button
          onClick={onClose}
          className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute hover:text-black px-2 py-1"
          aria-label="Close checklist"
        >
          Close ×
        </button>
      </div>
      {activePillars.map((p) => (
        <div key={p.numeral} className="mb-6">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-drama italic text-lg leading-none text-accent">{p.numeral}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink">{p.label}</span>
          </div>
          <ul className="space-y-1.5 ml-1">
            {p.keys.map((k) => {
              const answered = answers[k] != null && answers[k] !== '';
              return (
                <li key={k} className={`flex items-start gap-2.5 text-[13px] py-0.5 ${answered ? 'text-black' : 'text-ink-mute'}`}>
                  <span className={`mt-1 w-2 h-2 flex-shrink-0 ${answered ? 'bg-accent' : 'border border-[color:var(--color-hairline-bold)]'}`} />
                  <span className={answered ? '' : ''}>
                    {activeLabels[k]}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="mt-8 text-xs text-ink-mute leading-relaxed border-t border-[color:var(--color-hairline)] pt-4">
        20 questions across 5 pillars. The agent weaves through them naturally, no need to follow this order.
      </p>
    </div>
  );
};

// Tiny inline-markdown renderer — supports **bold**, *italic*, line breaks,
// blank-line paragraph breaks, and `- ` bullet lists. No raw HTML, no links.
const InlineMd: React.FC<{ text: string }> = ({ text }) => {
  // Split into blocks (paragraphs / lists) by blank lines
  const blocks = text.split(/\n\s*\n/).filter((b) => b.length > 0);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        const isList = lines.every((l) => l.trim().startsWith('- '));
        if (isList) {
          return (
            <ul key={bi} className="space-y-1 list-none my-2 first:mt-0 last:mb-0">
              {lines.map((l, li) => (
                <li key={li} className="flex gap-2.5 leading-[1.55]">
                  <span className="mt-2 w-1.5 h-1.5 bg-accent flex-shrink-0" aria-hidden="true" />
                  <span>{renderInline(l.trim().slice(2))}</span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi} className="leading-[1.55] my-2 first:mt-0 last:mb-0 whitespace-pre-line">
            {renderInline(block)}
          </p>
        );
      })}
    </>
  );
};

// Inline parser: **bold** and *italic*. Simple non-overlapping tokens.
function renderInline(s: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < s.length) {
    if (s[i] === '*' && s[i + 1] === '*') {
      const end = s.indexOf('**', i + 2);
      if (end !== -1) {
        parts.push(<strong key={key++} className="font-semibold text-ink">{s.slice(i + 2, end)}</strong>);
        i = end + 2; continue;
      }
    }
    if (s[i] === '*') {
      const end = s.indexOf('*', i + 1);
      if (end !== -1 && s[end + 1] !== '*') {
        parts.push(<em key={key++} className="font-drama italic text-ink">{s.slice(i + 1, end)}</em>);
        i = end + 1; continue;
      }
    }
    // accumulate plain text until next marker
    let j = i;
    while (j < s.length && s[j] !== '*') j++;
    parts.push(<React.Fragment key={key++}>{s.slice(i, j)}</React.Fragment>);
    i = j;
  }
  return parts;
}

// Brand-aligned agent mark: black square with sage italic DM Serif "i."
const AgentMark: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 36 36"
    role="img"
    aria-label="Ivan's Agent"
    className="flex-shrink-0"
  >
    <rect width="36" height="36" fill="#1A1A1A" />
    <text
      x="50%"
      y="50%"
      dominantBaseline="central"
      textAnchor="middle"
      fontFamily="'DM Serif Display', serif"
      fontStyle="italic"
      fontSize="22"
      fill="var(--color-accent, #2A8F65)"
    >
      i.
    </text>
  </svg>
);

const BotBubble: React.FC<{ content: string; index: number }> = ({ content, index }) => {
  const turn = String(index + 1).padStart(2, '0');
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
      className="flex gap-3"
    >
      <div className="flex-shrink-0 mt-5">
        <AgentMark />
      </div>
      <div className="max-w-[88%] md:max-w-[80%] min-w-0">
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-mute mb-1.5 flex items-center gap-2">
          <span>Ivan's Agent</span>
          <span className="text-ink-mute/50">·</span>
          <span>Intake · {turn}</span>
        </div>
        <div className="bg-paper border border-[color:var(--color-hairline-bold)] border-l-[3px] border-l-accent px-5 py-3.5 text-[15px] text-ink">
          <InlineMd text={content} />
        </div>
      </div>
    </motion.div>
  );
};

const UserBubble: React.FC<{ content: string }> = ({ content }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="flex justify-end"
    >
      <div className="max-w-[88%] md:max-w-[80%] relative">
        <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-mute mb-1.5 mr-4 text-right">
          You
        </div>
        <div className="bg-paper-sunk border border-[color:var(--color-hairline-bold)] border-r-[3px] border-r-black px-5 py-3.5 text-[15px] leading-[1.55] text-ink whitespace-pre-wrap">
          {content}
        </div>
      </div>
    </motion.div>
  );
};

const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex gap-3"
    aria-live="polite"
  >
    <div className="flex-shrink-0 mt-5 opacity-70">
      <AgentMark />
    </div>
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-mute mb-1.5 flex items-center gap-2">
        <span>Ivan's Agent</span>
        <span className="text-ink-mute/50">·</span>
        <span>Thinking</span>
      </div>
      <div className="flex items-center gap-1.5 px-5 py-3.5 bg-paper border border-[color:var(--color-hairline-bold)] border-l-[3px] border-l-accent">
        <span className="w-1.5 h-1.5 bg-accent animate-pulse" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-accent animate-pulse" style={{ animationDelay: '180ms' }} />
        <span className="w-1.5 h-1.5 bg-accent animate-pulse" style={{ animationDelay: '360ms' }} />
      </div>
    </div>
  </motion.div>
);

const SubmittedCard: React.FC<{ answers: Record<string, unknown>; sessionId: string | null; activePillars: Pillar[]; activeLabels: Record<string, string>; activeQuestionOrder: string[] }> = ({ answers, sessionId, activePillars, activeLabels, activeQuestionOrder }) => {
  const answeredCount = activeQuestionOrder.filter((k) => answers[k] != null && answers[k] !== '').length;
  const [addendum, setAddendum] = useState('');
  const [addendumStatus, setAddendumStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [addendumErr, setAddendumErr] = useState<string | null>(null);

  const submitAddendum = async () => {
    if (!sessionId || !addendum.trim() || addendumStatus === 'sending') return;
    setAddendumStatus('sending');
    setAddendumErr(null);
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          addendum: addendum.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setAddendumStatus('sent');
      setAddendum('');
    } catch (e) {
      setAddendumErr(e instanceof Error ? e.message : 'Failed to send');
      setAddendumStatus('error');
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      className="border border-[color:var(--color-hairline-bold)] bg-paper"
    >
      {/* Hero — stacked editorial leader, big numeral dominates */}
      <div className="px-8 md:px-14 pt-6 pb-10 md:pb-14">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute">
          <span>End of intake</span>
          <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.32, 0.72, 0, 1] }}
          className="leading-none mt-8 md:mt-10 -mb-2"
          aria-hidden="true"
        >
          <span className="font-drama italic text-[7rem] sm:text-[10rem] md:text-[14rem] text-black leading-[0.85] tracking-tight">
            100
          </span>
          <span className="font-drama italic text-[7rem] sm:text-[10rem] md:text-[14rem] text-accent leading-[0.85]">.</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="border-l-2 border-accent pl-5 mt-8 max-w-2xl"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute mb-2">
            Intake submitted
          </p>
          <h2 className="text-2xl md:text-[2.25rem] font-semibold tracking-tight leading-[1.12] mb-4">
            <span className="font-drama italic">Locked in.</span>{' '}
            Ivan reviews and reaches out within 1 business day.
          </h2>
          <p className="text-sm md:text-base text-ink-soft leading-relaxed max-w-lg">
            You answered {answeredCount} of {activeQuestionOrder.length} questions. Want to add more before the working session? Reply to the welcome email, I read every one.
          </p>
        </motion.div>
      </div>

      {/* Captured manifest — proof of value */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.65 }}
        className="border-t border-[color:var(--color-hairline-bold)] bg-paper-sunk px-8 md:px-14 py-10"
      >
        <div className="flex items-baseline justify-between mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink">
            Captured · {answeredCount} fields
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
            Manifest
          </p>
        </div>
        <div className="space-y-6">
          {activePillars.map((p) => {
            const filled = p.keys.filter((k) => answers[k] != null && answers[k] !== '');
            if (filled.length === 0) return null;
            return (
              <div key={p.numeral}>
                <div className="flex items-baseline gap-2 mb-2 border-b border-[color:var(--color-hairline)] pb-1.5">
                  <span className="font-drama italic text-base leading-none text-accent">{p.numeral}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink">{p.label}</span>
                  <span className="ml-auto font-mono text-[10px] tabular-nums text-ink-mute">{filled.length}/{p.keys.length}</span>
                </div>
                <ul className="grid md:grid-cols-2 gap-x-8 gap-y-1.5">
                  {filled.map((k) => (
                    <li key={k} className="flex items-start gap-2.5 text-[13px] text-ink leading-relaxed">
                      <span className="mt-1.5 w-1.5 h-1.5 flex-shrink-0 bg-accent" />
                      <div className="min-w-0">
                        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink-mute mb-0.5">
                          {activeLabels[k]}
                        </div>
                        <div className="text-ink line-clamp-2">
                          {String(answers[k])}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Free-form addendum — buyer can append a note after submission */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.85 }}
        className="border-t border-[color:var(--color-hairline-bold)] px-8 md:px-14 py-8"
      >
        <div className="flex items-baseline justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink">
            Anything else?
          </p>
          <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
            Optional
          </p>
        </div>
        <p className="text-sm text-ink-soft leading-relaxed mb-3 max-w-xl">
          Context Iván should know before the working session. Constraints, deadlines, an idea you forgot to mention. Goes straight to him.
        </p>
        <textarea
          value={addendum}
          onChange={(e) => setAddendum(e.target.value)}
          placeholder="One more thing…"
          rows={3}
          maxLength={4000}
          disabled={addendumStatus === 'sending' || addendumStatus === 'sent'}
          className="w-full bg-paper-sunk border border-[color:var(--color-hairline-bold)] px-4 py-3 text-[15px] leading-relaxed focus:outline-none focus:border-accent disabled:opacity-60 font-sans resize-y"
        />
        <div className="flex items-center justify-between mt-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
            {addendumStatus === 'sent' ? (
              <span className="text-accent">✓ Sent · Iván has been notified</span>
            ) : addendumStatus === 'error' ? (
              <span className="text-red-700">{addendumErr}</span>
            ) : (
              <span>{addendum.length}/4000</span>
            )}
          </div>
          <button
            onClick={submitAddendum}
            disabled={!addendum.trim() || addendumStatus === 'sending' || addendumStatus === 'sent'}
            className="px-5 py-2 bg-black text-white border border-black disabled:opacity-40 disabled:cursor-not-allowed font-mono text-[11px] uppercase tracking-[0.14em] hover:bg-ink-soft transition-colors flex items-center gap-2"
          >
            {addendumStatus === 'sending' ? (
              <><Loader2 size={12} className="animate-spin" /> Sending</>
            ) : addendumStatus === 'sent' ? (
              <>Sent</>
            ) : (
              <>Send to Iván <ArrowUp size={12} className="text-accent" strokeWidth={2.5} /></>
            )}
          </button>
        </div>
      </motion.div>

      {/* Closing rule */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: '100%' }}
        transition={{ duration: 0.9, delay: 0.95, ease: [0.32, 0.72, 0, 1] }}
        className="h-[2px] bg-accent"
      />
      <div className="px-8 md:px-14 py-4 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.18em] text-ink-mute">
        <span>Iván Manfredi · Agent-Ready Ops™</span>
        <span>Blueprint begins</span>
      </div>
    </motion.div>
  );
};

export default ConversationalIntake;
