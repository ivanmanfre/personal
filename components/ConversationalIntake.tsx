import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUp, Check, Loader2, AlertTriangle, Mic, MicOff, MessageSquare, PhoneOff, Radio } from 'lucide-react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
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
const VOICE_SIGNED_URL_ENDPOINT = 'https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/intake-voice-signed-url';
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

// Fractional m1 schema (v3, 2026-05-17) — 25 keys, 8 dimensions (operations landscape)
const FRACTIONAL_PILLARS: Pillar[] = [
  { numeral: 'I',    label: 'Context',           keys: ['company', 'size_revenue', 'founders_team', 'icp_description'] },
  { numeral: 'II',   label: 'Trigger + outcomes', keys: ['why_now', 'desired_outcomes_12mo', 'success_metric'] },
  { numeral: 'III',  label: 'Automation state',  keys: ['existing_automations', 'ai_tools_paid_for', 'past_failures', 'automation_appetite'] },
  { numeral: 'IV',   label: 'Tech stack',        keys: ['daily_tech_stack'] },
  { numeral: 'V',    label: 'Founder time',      keys: ['weekly_hours_breakdown', 'top_time_sucks', 'repeating_judgment_tasks'] },
  { numeral: 'VI',   label: 'Content + outbound', keys: ['post_cadence_and_owner', 'lead_magnets_state', 'outbound_channels_volume', 'outbound_bottleneck'] },
  { numeral: 'VII',  label: 'Client delivery',   keys: ['recent_client_examples', 'delivery_workflow_specific', 'client_reporting_cadence'] },
  { numeral: 'VIII', label: 'Integration + scale', keys: ['tools_that_dont_talk', 'monthly_manual_data_work', 'five_more_clients_what_breaks'] },
];

const FRACTIONAL_QUESTION_LABELS: Record<string, string> = {
  company: 'Company + your role',
  size_revenue: 'Team size + revenue',
  founders_team: 'Founders/partners + roles',
  icp_description: 'Who you sell to',
  why_now: 'What changed (last 30 days)',
  desired_outcomes_12mo: '12-month outcome',
  success_metric: 'How you measure success',
  existing_automations: "What's automated today",
  ai_tools_paid_for: 'AI tools you pay for',
  past_failures: "What didn't stick (and why)",
  automation_appetite: 'Build appetite (hands-on?)',
  daily_tech_stack: 'Daily tools + which to kill',
  weekly_hours_breakdown: 'Weekly hours split',
  top_time_sucks: 'Top 3 time-sucks',
  repeating_judgment_tasks: 'Repeating judgment calls',
  post_cadence_and_owner: 'Content cadence + owner',
  lead_magnets_state: 'Lead magnets state',
  outbound_channels_volume: 'Outbound channels + volume',
  outbound_bottleneck: 'Outbound bottleneck',
  recent_client_examples: 'Last 2 clients (anonymised)',
  delivery_workflow_specific: 'Project workflow walk-through',
  client_reporting_cadence: 'Client reporting cadence',
  tools_that_dont_talk: "Tools that don't talk",
  monthly_manual_data_work: 'Hours/week moving data',
  five_more_clients_what_breaks: '5 more clients — what breaks',
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

const ConversationalIntakeInner: React.FC = () => {
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

  // Track whether stopRecording was triggered by silence (auto-send) vs manual click
  const stoppedBySilenceRef = useRef<boolean>(false);

  const VOICE_SILENCE_TIMEOUT_MS = 3000;
  const VOICE_HARD_CAP_MS = 90000;

  // Two distinct modes: text (silent reading + optional STT dictation via mic icon)
  // or voice (full ElevenAgents conversation). No browser-TTS speaking of agent
  // replies in text mode — voice mode is the only place an agent voice is heard.
  const [voiceMode, setVoiceMode] = useState<'text' | 'voice'>('text');
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'connecting' | 'live' | 'ending' | 'error' | 'dropped'>('idle');
  const [voiceModeError, setVoiceModeError] = useState<string | null>(null);
  const [voiceToast, setVoiceToast] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  // Agent mode: 'speaking' when the agent's TTS is playing, 'listening' when
  // it's waiting for the buyer. Drives the waveform animation in the panel.
  const [agentMode, setAgentMode] = useState<'speaking' | 'listening'>('listening');
  // Tracks whether the most recent disconnect was user-initiated (End call) vs
  // a network drop, so onDisconnect can route accordingly.
  const intentionalEndRef = useRef(false);
  const wasLiveRef = useRef(false);
  const elevenConversation = useConversation({
    onConnect: () => {
      setVoiceStatus('live');
      setVoiceModeError(null);
      wasLiveRef.current = true;
    },
    onModeChange: (m: { mode: string }) => {
      if (m?.mode === 'speaking' || m?.mode === 'listening') {
        setAgentMode(m.mode);
      }
    },
    onDisconnect: () => {
      if (intentionalEndRef.current) {
        // User clicked End call — endVoiceMode() handles state transitions
        intentionalEndRef.current = false;
        return;
      }
      // Unintentional disconnect mid-session
      if (wasLiveRef.current) {
        setVoiceStatus('dropped');
        setVoiceToast({ kind: 'info', text: 'Voice connection dropped. Switching to text — click Voice to reconnect.' });
        wasLiveRef.current = false;
        // Re-sync server state and flip back to text mode
        (async () => {
          await reinitFromServer();
          setVoiceMode('text');
          setVoiceStatus('idle');
        })();
      } else {
        setVoiceStatus('idle');
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[eleven-conversation-error]', msg);
      setVoiceModeError(msg);
      setVoiceStatus('error');
      setVoiceToast({ kind: 'error', text: `Voice error: ${msg.slice(0, 100)}` });
    },
    onMessage: (msg: { message: string; source: 'user' | 'ai' }) => {
      // Append voice transcripts to the chat scroll so bubbles stay in sync
      if (!msg?.message) return;
      const role = msg.source === 'user' ? 'user' : 'assistant';
      setMessages((m) => [...m, { role, content: msg.message, ts: new Date().toISOString() }]);
    },
  });

  useMetadata({
    title: 'Blueprint intake | Manfredi',
    description: 'Walk through your Agent-Ready Blueprint intake conversationally.',
    canonical: 'https://ivanmanfredi.com/assessment/welcome',
    noindex: true,
  });

  useEffect(() => {
    if (chatScrollRef.current) {
      // Smooth scroll so the new bubble glides in instead of jumping. Give the
      // bubble's own animation a tiny head-start so it doesn't get cut off.
      const el = chatScrollRef.current;
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [messages, state]);

  // Cursor spotlight — sets CSS vars for the faint sage gradient that follows
  // the pointer. Skipped on touch/coarse pointers where it's noise.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--intake-cursor-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--intake-cursor-y', `${e.clientY}px`);
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Auto-dismiss voice toast after 6s
  useEffect(() => {
    if (!voiceToast) return;
    const id = setTimeout(() => setVoiceToast(null), 6000);
    return () => clearTimeout(id);
  }, [voiceToast]);

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

  // Re-init from server: pulls fresh chat_history + answers after a voice
  // session (where server-side state advanced but client didn't see updates).
  const reinitFromServer = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, init: true }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setTurnCount(data.turn_count ?? 0);
      setNonce(data.nonce ?? null);
      setAnswers(data.answers ?? {});
      if (data.mode === 'fractional_m1' || data.mode === 'paid_assessment') setMode(data.mode);
      setMessages(data.chat_history ?? []);
      if (data.submitted) setState('submitted');
    } catch (e) {
      console.warn('[reinit-failed]', e instanceof Error ? e.message : String(e));
    }
  }, [sessionId]);

  // Auto-start voice mode if URL has ?voice=1 — fires ONCE after the session
  // becomes ready. Useful for direct-voice links shared in email / SMS.
  const voiceAutoStartedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (voiceAutoStartedRef.current) return;
    if (state !== 'ready') return;
    if (voiceMode !== 'text') return;
    const params = new URLSearchParams(window.location.search);
    const wantVoice = params.get('voice') === '1' || params.get('mode') === 'voice';
    if (!wantVoice) return;
    voiceAutoStartedRef.current = true;
    // Tiny delay so the masthead + agent intro bubble render first, then
    // voice mode takes over the input area.
    const t = setTimeout(() => { startVoiceModeRef.current?.(); }, 400);
    return () => clearTimeout(t);
  }, [state, voiceMode]);
  const startVoiceModeRef = useRef<(() => void) | null>(null);

  const startVoiceMode = useCallback(async () => {
    if (!sessionId) return;
    setVoiceStatus('connecting');
    setVoiceModeError(null);
    try {
      // Stop the textarea STT recorder if it's running — voice mode owns the mic now
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }

      // Pre-request mic permission so the prompt fires before the SDK opens its
      // WebSocket. If the user denies, we surface a clear toast instead of
      // letting the agent connect with no audio (the user thinks it's broken).
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (permErr) {
        const m = permErr instanceof Error ? permErr.message : String(permErr);
        const friendly = m.toLowerCase().includes('denied') || m.toLowerCase().includes('notallowed')
          ? 'Microphone access blocked. Enable it in your browser settings and try again.'
          : `Microphone unavailable: ${m.slice(0, 80)}`;
        setVoiceModeError(friendly);
        setVoiceStatus('error');
        setVoiceToast({ kind: 'error', text: friendly });
        return;
      }
      // Release the probe stream — the SDK opens its own.
      try { micStream?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }

      const res = await fetch(VOICE_SIGNED_URL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.signed_url) throw new Error('no_signed_url_returned');

      // First message: on a FRESH session, let the agent speak its default
      // first_message (set at agent-config level — guaranteed to fire). On
      // RESUME, the server generates a paraphrased bridge sentence via Claude
      // Haiku from the recent chat history and returns it as bridge_sentence;
      // we pass that as the firstMessage override so the agent opens with a
      // natural "yeah, you were on the team-size thing — go on" — never a
      // verbatim echo of the buyer's words.
      const sessionConfig: Parameters<typeof elevenConversation.startSession>[0] = {
        signedUrl: data.signed_url,
        connectionType: 'websocket',
        customLlmExtraBody: { intake_token: data.intake_token },
      };
      if (data.bridge_sentence) {
        sessionConfig.overrides = {
          agent: { firstMessage: data.bridge_sentence },
        };
      }
      await elevenConversation.startSession(sessionConfig);
      setVoiceMode('voice');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[voice-mode-start-failed]', msg);
      setVoiceModeError(msg);
      setVoiceStatus('error');
      setVoiceToast({ kind: 'error', text: `Voice failed to start: ${msg.slice(0, 100)}` });
    }
  }, [sessionId, elevenConversation, messages]);

  // Keep the ref in sync so the auto-start effect can call the latest version
  useEffect(() => { startVoiceModeRef.current = startVoiceMode; }, [startVoiceMode]);

  const endVoiceMode = useCallback(async () => {
    intentionalEndRef.current = true;
    wasLiveRef.current = false;
    setVoiceStatus('ending');
    try { await elevenConversation.endSession(); } catch { /* ignore */ }
    setVoiceMode('text');
    setVoiceStatus('idle');
    // Pull the canonical state from server — voice turns advanced it server-side
    await reinitFromServer();
  }, [elevenConversation, reinitFromServer]);

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

  const answeredCount = useMemo(
    () => activeQuestionOrder.filter((k) => answers[k] != null && answers[k] !== '').length,
    [answers],
  );
  const activeIdx = useMemo(() => activePillarIdx(answers, lastFocus, activePillars), [answers, lastFocus]);

  return (
    <div className="min-h-screen bg-paper flex flex-col relative" style={PAPER_GRID_STYLE}>
      {/* Cursor spotlight — desktop only, behind everything */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[1] hidden md:block"
        style={{
          background:
            'radial-gradient(420px circle at var(--intake-cursor-x, 50%) var(--intake-cursor-y, 30%), rgba(76, 110, 61, 0.07), transparent 55%)',
          transition: 'background 90ms linear',
        }}
      />
      {/* Subtle grain overlay — adds warmth, sits above the paper grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[2] opacity-[0.035] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0 0.1 0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          backgroundSize: '180px 180px',
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10"
      >
        <Masthead
          activeIdx={activeIdx}
          activePillars={activePillars}
          voiceMode={voiceMode}
          voiceStatus={voiceStatus}
          onStartVoice={startVoiceMode}
          onEndVoice={endVoiceMode}
        />
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
        className="relative z-10"
      >
        <PillarBar answers={answers} activeIdx={activeIdx} onOpenList={() => setSidebarOpen(true)} activePillars={activePillars} totalQuestions={activeQuestionOrder.length} />
      </motion.div>

      {/* Voice toast — fixed top, dismissable, auto-clears after 6s */}
      <AnimatePresence>
        {voiceToast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed top-[120px] md:top-[140px] left-1/2 -translate-x-1/2 z-40 pointer-events-auto"
          >
            <div className={`flex items-center gap-3 px-5 py-3 border shadow-lg ${
              voiceToast.kind === 'error'
                ? 'bg-red-50 border-red-300 text-red-900'
                : 'bg-paper border-accent text-ink'
            }`}>
              <AlertTriangle size={14} className={voiceToast.kind === 'error' ? 'text-red-700' : 'text-accent'} />
              <span className="text-[13px] leading-snug max-w-md">{voiceToast.text}</span>
              <button
                onClick={() => setVoiceToast(null)}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute hover:text-black ml-2"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex relative z-10">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed top-0 right-0 bottom-0 w-[380px] max-w-full bg-paper border-l border-[color:var(--color-hairline-bold)] z-30 overflow-y-auto shadow-2xl"
            >
              <ChecklistDrawer answers={answers} onClose={() => setSidebarOpen(false)} activePillars={activePillars} activeLabels={activeLabels} />
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-h-0">
          <div ref={chatScrollRef} className="flex-1 overflow-y-auto">
            <div className="container mx-auto max-w-3xl px-6 md:px-10 py-10 md:py-14 space-y-7 md:space-y-9">
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

              {messages.map((m, i) => {
                if (m.role !== 'assistant') return <UserBubble key={i} content={m.content} />;
                const prev = i > 0 ? messages[i - 1] : null;
                // Drop cap fires ONLY on the very first message in the chat.
                const isFirstMessage = i === 0;
                // Agent mark renders on every NEW agent turn-block (start of
                // chat OR first assistant message after a user turn), not on
                // every consecutive agent bubble.
                const showMark = isFirstMessage || prev?.role !== 'assistant';
                return <BotBubble key={i} content={m.content} index={i} isFirstMessage={isFirstMessage} showMark={showMark} />;
              })}

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

          {state !== 'submitted' && state !== 'locked' && state !== 'error' && voiceMode === 'voice' && (
            <div className="border-t-2 border-accent bg-paper-sunk">
              <div className="container mx-auto max-w-3xl px-6 md:px-10 py-7 md:py-9">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-5 min-w-0">
                    {/* Live waveform — bars animate while the agent is speaking,
                        idle when listening. Replaces the static orb. */}
                    <VoiceWaveform
                      status={voiceStatus}
                      speaking={agentMode === 'speaking' && voiceStatus === 'live'}
                    />
                    <div className="leading-tight min-w-0">
                      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-mute mb-1.5">
                        {voiceStatus === 'connecting' && 'Connecting'}
                        {voiceStatus === 'live' && (agentMode === 'speaking' ? 'Speaking' : 'Listening')}
                        {voiceStatus === 'ending' && 'Wrapping up'}
                        {voiceStatus === 'error' && 'Voice error'}
                        {voiceStatus === 'idle' && 'Voice mode'}
                      </div>
                      <p className="text-[17px] md:text-[18px] leading-snug text-ink">
                        {voiceStatus === 'live' && (
                          <>
                            <span className="font-drama italic">Just speak.</span>{' '}
                            <span className="text-ink-soft">It picks up natural pauses.</span>
                          </>
                        )}
                        {voiceStatus === 'connecting' && (
                          <span className="text-ink-soft">Establishing the connection…</span>
                        )}
                        {voiceStatus === 'ending' && (
                          <span className="text-ink-soft">Saving your progress…</span>
                        )}
                        {voiceStatus === 'error' && (
                          <span className="text-red-800">{voiceModeError ?? 'Connection failed. Switch to text or retry.'}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={endVoiceMode}
                    disabled={voiceStatus === 'ending'}
                    className="flex-shrink-0 flex items-center gap-2 px-5 py-3 bg-black text-white border border-black font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-ink-soft transition-colors disabled:opacity-50"
                    aria-label="End voice session and return to text"
                  >
                    {voiceStatus === 'ending' ? <Loader2 size={14} className="animate-spin" /> : <PhoneOff size={14} />}
                    End call
                  </button>
                </div>
              </div>
            </div>
          )}

          {state !== 'submitted' && state !== 'locked' && state !== 'error' && voiceMode === 'text' && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.95, ease: [0.32, 0.72, 0, 1] }}
              className="border-t border-[color:var(--color-hairline)] bg-paper/90 backdrop-blur-sm"
            >
              <div className="container mx-auto max-w-3xl px-6 md:px-10 py-5">
                <div className="group relative flex items-end border border-[color:var(--color-hairline)] bg-paper-raise rounded-sm transition-all duration-200 focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgba(76,110,61,0.07)] shadow-[0_1px_2px_rgba(26,26,26,0.04)]">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      state === 'rate_limited' ? 'Hold tight, back in a minute.'
                      : state === 'sending' ? 'Thinking…'
                      : recording ? 'Listening — speak naturally.'
                      : 'Reply at your own pace. Enter sends.'
                    }
                    rows={1}
                    maxLength={2000}
                    disabled={state !== 'ready' && !recording}
                    className="flex-1 resize-none bg-transparent px-5 py-4 text-[16px] md:text-[17px] leading-[1.55] focus:outline-none disabled:opacity-50 font-sans placeholder:text-ink-mute placeholder:italic"
                  />
                  <div className="flex items-stretch self-stretch p-1">
                    {VOICE_SUPPORTED && (
                      <button
                        onClick={toggleRecording}
                        disabled={state !== 'ready' && !recording}
                        className={`w-10 rounded-sm transition-all flex items-center justify-center ${
                          recording
                            ? 'text-accent bg-accent/10'
                            : 'text-ink-mute hover:text-accent hover:bg-accent/5'
                        } disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40`}
                        aria-label={recording ? 'Stop recording' : 'Dictate reply'}
                        title={recording ? 'Stop' : 'Dictate (voice note → text)'}
                      >
                        {recording
                          ? <span className="relative inline-flex items-center justify-center"><MicOff size={18} /><span className="absolute -right-1 -top-1 w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /></span>
                          : <Mic size={18} />}
                      </button>
                    )}
                    <button
                      onClick={send}
                      disabled={state !== 'ready' || !input.trim()}
                      className="ml-1 w-10 h-10 rounded-sm bg-ink text-paper disabled:bg-transparent disabled:text-ink-mute disabled:cursor-not-allowed flex items-center justify-center transition-all duration-150 hover:bg-accent hover:shadow-[0_0_0_4px_rgba(76,110,61,0.14)] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                      aria-label="Send"
                    >
                      {state === 'sending'
                        ? <Loader2 size={16} className="animate-spin" />
                        : <ArrowUp size={16} strokeWidth={2.25} />}
                    </button>
                  </div>
                </div>
                {voiceErr && (
                  <div className="mt-2 text-[12px] text-red-700 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> {voiceErr}
                  </div>
                )}
                <div className="flex items-center justify-between mt-2.5 text-[12px] text-ink-mute">
                  <span className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-accent inline-block" aria-hidden="true" />
                    Autosaved
                  </span>
                  <a href={LEGACY_FORM_URL + (sessionId ? `?session_id=${sessionId}` : '')} className="hover:text-accent transition-colors">
                    Prefer a form? →
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

// VoiceWaveform — 5 sage bars that animate while the agent is speaking.
// CSS-only animation; no canvas, no audio analysis. Each bar uses a different
// scale-Y keyframe phase so the column reads as a live waveform.
const VoiceWaveform: React.FC<{
  status: 'idle' | 'connecting' | 'live' | 'ending' | 'error' | 'dropped';
  speaking: boolean;
}> = ({ status, speaking }) => {
  if (status === 'connecting' || status === 'ending') {
    return (
      <div className="w-14 h-14 flex items-center justify-center rounded-full bg-accent/15 flex-shrink-0">
        <Loader2 size={20} className="animate-spin text-accent" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="w-14 h-14 flex items-center justify-center rounded-full bg-red-100 text-red-700 flex-shrink-0">
        <AlertTriangle size={20} />
      </div>
    );
  }
  return (
    <div
      className="w-14 h-14 flex items-end justify-center gap-[3px] rounded-full bg-accent/10 px-3 py-2.5 flex-shrink-0"
      role="img"
      aria-label={speaking ? 'Agent speaking' : 'Agent listening'}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={speaking ? 'intake-wave-bar intake-wave-bar--active' : 'intake-wave-bar'}
          style={{ animationDelay: `${i * 110}ms` }}
        />
      ))}
    </div>
  );
};

const ModalityToggle: React.FC<{
  voiceMode: 'text' | 'voice';
  voiceStatus: 'idle' | 'connecting' | 'live' | 'ending' | 'error' | 'dropped';
  voiceBusy: boolean;
  onStartVoice: () => void;
  onEndVoice: () => void;
}> = ({ voiceMode, voiceStatus, voiceBusy, onStartVoice, onEndVoice }) => {
  const isVoice = voiceMode === 'voice';
  return (
    <div className="flex items-center border border-[color:var(--color-hairline)] bg-paper text-[12px]">
      <button
        onClick={isVoice && !voiceBusy ? onEndVoice : undefined}
        disabled={voiceBusy || !isVoice}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 transition-colors ${
          !isVoice ? 'bg-ink text-paper' : 'text-ink-mute hover:text-ink'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={isVoice ? 'Switch to text mode' : 'Currently in text mode'}
        title={isVoice ? 'Switch back to text' : 'Type your replies'}
      >
        <MessageSquare size={13} />
        <span className="hidden sm:inline">Text</span>
      </button>
      <span className="w-px h-4 bg-[color:var(--color-hairline)]" aria-hidden="true" />
      <button
        onClick={!isVoice && !voiceBusy ? onStartVoice : undefined}
        disabled={voiceBusy || isVoice}
        className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 transition-colors ${
          isVoice ? 'bg-accent text-paper' : 'text-ink-mute hover:text-ink'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        aria-label={isVoice ? 'Currently in voice mode' : 'Switch to voice mode'}
        title={isVoice ? 'Talk with the agent live' : 'Switch to a live voice conversation'}
      >
        {voiceStatus === 'connecting' || voiceStatus === 'ending'
          ? <Loader2 size={13} className="animate-spin" />
          : voiceStatus === 'live'
            ? <Radio size={13} className="animate-pulse" />
            : <Mic size={13} />}
        <span className="hidden sm:inline">Voice</span>
      </button>
    </div>
  );
};

const Masthead: React.FC<{
  activeIdx: number;
  activePillars: Pillar[];
  voiceMode: 'text' | 'voice';
  voiceStatus: 'idle' | 'connecting' | 'live' | 'ending' | 'error' | 'dropped';
  onStartVoice: () => void;
  onEndVoice: () => void;
}> = ({ activeIdx, activePillars, voiceMode, voiceStatus, onStartVoice, onEndVoice }) => {
  const voiceBusy = voiceStatus === 'connecting' || voiceStatus === 'ending';
  void activeIdx; void activePillars;
  return (
    <header className="sticky top-0 z-20 bg-paper/95 backdrop-blur border-b border-[color:var(--color-hairline)]">
      <div className="container mx-auto max-w-3xl px-6 md:px-10 py-4 flex items-center justify-between gap-6">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h1 className="text-lg md:text-xl tracking-tight whitespace-nowrap">
            The <span className="font-drama italic">Agent-Ready</span> Blueprint
          </h1>
          <span
            className="text-[11px] text-ink-mute italic hidden md:inline whitespace-nowrap"
            aria-hidden="true"
          >
            — intake
          </span>
        </div>
        <ModalityToggle
          voiceMode={voiceMode}
          voiceStatus={voiceStatus}
          voiceBusy={voiceBusy}
          onStartVoice={onStartVoice}
          onEndVoice={onEndVoice}
        />
      </div>
    </header>
  );
};

const PillarBar: React.FC<{
  answers: Record<string, unknown>;
  activeIdx: number;
  onOpenList: () => void;
  activePillars: Pillar[];
  totalQuestions: number;
}> = ({ answers, activeIdx, onOpenList, activePillars, totalQuestions }) => {
  const activePillar = activePillars[activeIdx] ?? activePillars[0];
  const { hit: activeHit, total: activeTotal } = pillarProgress(activePillar, answers);
  const answeredTotal = activePillars.reduce(
    (sum, p) => sum + p.keys.filter((k) => answers[k] != null && answers[k] !== '').length,
    0,
  );

  return (
    <div className="sticky top-[57px] md:top-[65px] z-10 bg-paper/95 backdrop-blur border-b border-[color:var(--color-hairline)]">
      <div className="container mx-auto max-w-3xl px-6 md:px-10 py-3.5">
        <div className="flex items-center justify-between gap-6 mb-2">
          <motion.div
            key={activePillar.numeral}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-[15px] leading-snug min-w-0 truncate"
          >
            <span className="text-ink-mute">Section {activeIdx + 1} of {activePillars.length}</span>
            <span className="mx-2.5 text-ink-mute/60">·</span>
            <span className="text-ink">{activePillar.label}</span>
          </motion.div>
          <button
            onClick={onOpenList}
            className="flex-shrink-0 text-[13px] text-ink-mute hover:text-accent transition-colors flex items-baseline gap-1.5"
            aria-label={`Open all ${totalQuestions} questions`}
          >
            <span className="tabular-nums text-ink">{answeredTotal}</span>
            <span className="text-ink-mute">/{totalQuestions}</span>
            <span className="ml-1 hidden sm:inline">all →</span>
          </button>
        </div>
        {/* Segmented progress strip — one segment per section, fill proportional to answers */}
        <div className="flex items-center gap-[3px]" aria-hidden="true">
          {activePillars.map((p, i) => {
            const { hit, total } = pillarProgress(p, answers);
            const pct = total > 0 ? Math.round((hit / total) * 100) : 0;
            const complete = hit === total && total > 0;
            const active = i === activeIdx;
            return (
              <div
                key={p.numeral}
                className="relative flex-1 h-1 bg-[color:var(--color-hairline)] overflow-hidden"
              >
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500 ease-out ${
                    complete ? 'bg-accent' : active ? 'bg-ink' : 'bg-ink-mute'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            );
          })}
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
        {activePillars.reduce((sum, p) => sum + p.keys.length, 0)} questions across {activePillars.length} {activePillars.length === 1 ? 'section' : 'sections'}. The agent weaves through them naturally, no need to follow this order.
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
    aria-label="Ivan's intake agent"
    className="flex-shrink-0"
  >
    {/* Soft sage paper-sunk square — quiet container */}
    <rect width="36" height="36" rx="4" fill="var(--color-paper-sunk, #EFEBE3)" />
    {/* Editorial waveform: 5 vertical bars, sage, varying heights — reads as
        "listening agent" without resorting to a generic mic or robot icon */}
    <g fill="var(--color-accent, #4C6E3D)">
      <rect x="7"  y="15" width="2.4" height="6"  rx="1.2" />
      <rect x="12" y="11" width="2.4" height="14" rx="1.2" />
      <rect x="17" y="8"  width="2.4" height="20" rx="1.2" />
      <rect x="22" y="12" width="2.4" height="12" rx="1.2" />
      <rect x="27" y="15" width="2.4" height="6"  rx="1.2" />
    </g>
  </svg>
);

const BotBubble: React.FC<{
  content: string;
  index: number;
  isFirstMessage?: boolean;
  showMark?: boolean;
}> = ({ content, index, isFirstMessage, showMark }) => {
  void index;
  // Drop-cap fires ONLY on the very first message of the conversation.
  const dropCapMatch = isFirstMessage ? /^([A-Za-z])([\s\S]+)$/.exec(content) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1], delay: isFirstMessage ? 0.7 : 0 }}
      className="flex gap-4"
    >
      <div className="flex-shrink-0 w-9 pt-0.5">
        {showMark ? (
          isFirstMessage ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, delay: 0.55, ease: [0.32, 0.72, 0, 1] }}
            >
              <AgentMark size={36} />
            </motion.div>
          ) : (
            <AgentMark size={36} />
          )
        ) : (
          <div className="w-9" aria-hidden="true" />
        )}
      </div>
      <div className="flex-1 min-w-0 max-w-[44rem] text-[17px] md:text-[18px] leading-[1.65] text-ink">
        {dropCapMatch ? (
          <>
            <motion.span
              initial={{ opacity: 0, scale: 0.85, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              transition={{ duration: 0.65, delay: 0.85, ease: [0.32, 0.72, 0, 1] }}
              className="font-drama italic float-left leading-[0.85] pr-2.5 pt-0.5 text-[2.6rem] md:text-[3rem] text-ink select-none"
              aria-hidden="true"
            >
              {dropCapMatch[1]}
            </motion.span>
            <span className="sr-only">{dropCapMatch[1]}</span>
            <InlineMd text={dropCapMatch[2]} />
          </>
        ) : (
          <InlineMd text={content} />
        )}
      </div>
    </motion.div>
  );
};

const UserBubble: React.FC<{ content: string }> = ({ content }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
      className="flex justify-end"
    >
      <div className="max-w-[44rem] bg-paper-sunk border-l-2 border-l-accent px-5 py-3.5 text-[16px] md:text-[17px] leading-[1.55] text-ink whitespace-pre-wrap">
        {content}
      </div>
    </motion.div>
  );
};

const TypingIndicator: React.FC = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex gap-4"
    aria-live="polite"
  >
    <div className="flex-shrink-0 w-9 pt-1" aria-hidden="true">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
    </div>
    <div>
      <div className="text-[14px] text-ink-mute italic">
        thinking…
      </div>
      <div className="flex items-center gap-1.5 py-2">
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

// Wrap with ConversationProvider — @elevenlabs/react's useConversation hook
// requires this context. Provider has no props for our use case.
const ConversationalIntake: React.FC = () => (
  <ConversationProvider>
    <ConversationalIntakeInner />
  </ConversationProvider>
);

export default ConversationalIntake;
