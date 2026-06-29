import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Sparkles, ShieldCheck, Send, UserPlus, Handshake, Target, RefreshCw,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { buildLiveEvents, rotate, type LiveEvent, type LiveKind } from './liveEngine';

/**
 * LiveProvider — drives the demo dashboard's "alive" layer: a two-beat loop that
 * shows what the engine is doing now (in-progress label) then fires a toast +
 * optional soft chime on completion. Data is real (recent posts / prospects /
 * leads); sound is OFF by default and gated behind a user toggle (browser
 * autoplay policy + no surprise audio in a demo). Pauses when the tab is hidden.
 */

interface LiveCtx {
  now: { kind: LiveKind; working: string } | null;
  soundOn: boolean;
  toggleSound: () => void;
  /** True once the engine has data and is cycling. */
  ready: boolean;
}

const Ctx = createContext<LiveCtx>({ now: null, soundOn: false, toggleSound: () => {}, ready: false });
export const useLive = () => useContext(Ctx);

const ICON: Record<LiveKind, React.ReactNode> = {
  generate: <Sparkles className="w-4 h-4" style={{ color: '#7c3aed' }} />,
  qa: <ShieldCheck className="w-4 h-4" style={{ color: '#047857' }} />,
  publish: <Send className="w-4 h-4" style={{ color: '#2563eb' }} />,
  lead: <UserPlus className="w-4 h-4" style={{ color: '#4f46e5' }} />,
  accept: <Handshake className="w-4 h-4" style={{ color: '#047857' }} />,
  score: <Target className="w-4 h-4" style={{ color: '#b45309' }} />,
  sync: <RefreshCw className="w-4 h-4" style={{ color: '#475569' }} />,
};

const LABEL: Record<LiveKind, string> = {
  generate: 'Content engine', qa: 'Quality gate', publish: 'Publisher',
  lead: 'Outreach', accept: 'Outreach', score: 'Lead scorer', sync: 'Sync',
};

// Soft, short Web-Audio chimes. Lazily created (must follow a user gesture).
const TONES: Record<LiveKind, number[]> = {
  lead: [659.25, 880.0], accept: [587.33, 783.99], publish: [523.25, 659.25],
  generate: [493.88, 659.25], qa: [659.25], score: [587.33], sync: [392.0],
};

const rnd = (min: number, max: number) => min + (max - min) * ((Date.now() % 997) / 997);

export const LiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [now, setNow] = useState<LiveCtx['now']>(null);
  const [ready, setReady] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('dv-live-sound') === '1';
  });

  const events = useRef<LiveEvent[]>([]);
  const idx = useRef(0);
  const pass = useRef(0);
  const timer = useRef<number | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;

  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Demo-only: the live layer is for prospect demos on the public /dashboard-v2
  // surface. Ivan's authed daily dashboard (/dashboard, routed to v2 via flag)
  // renders the same shell but should stay calm — no auto-toasts/pill/sound.
  // Opt back in on the authed view with localStorage dv-live-force=1.
  const isDemo = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/dashboard-v2') ||
    (() => { try { return localStorage.getItem('dv-live-force') === '1'; } catch { return false; } })()
  );

  const chime = useCallback((kind: LiveKind) => {
    if (!soundRef.current) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audio.current) audio.current = new AC();
      const c = audio.current;
      if (c.state === 'suspended') void c.resume();
      const t0 = c.currentTime;
      (TONES[kind] || [523.25]).forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const t = t0 + i * 0.085;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g);
        g.connect(c.destination);
        o.start(t);
        o.stop(t + 0.24);
      });
    } catch { /* audio unavailable — silently skip */ }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((s) => {
      const next = !s;
      try { localStorage.setItem('dv-live-sound', next ? '1' : '0'); } catch { /* ignore */ }
      // Resume/create the context inside this user gesture so the first chime plays.
      if (next) {
        try {
          const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (!audio.current) audio.current = new AC();
          void audio.current.resume();
        } catch { /* ignore */ }
      }
      return next;
    });
  }, []);

  // The loop. setTimeout recursion so cadence can jitter per step.
  const step = useCallback(() => {
    let list = events.current;
    if (!list.length) return;
    if (idx.current >= list.length) {
      idx.current = 0;
      pass.current += 1;
      list = rotate(list, 3); // reorder each pass so the stream stays varied
      events.current = list;
    }
    const ev = list[idx.current++];
    setNow({ kind: ev.kind, working: ev.working });

    const dwell = reduced ? 600 : rnd(2200, 3600);
    timer.current = window.setTimeout(() => {
      toast(ev.done, {
        icon: ICON[ev.kind],
        description: LABEL[ev.kind],
        duration: 3600,
      });
      chime(ev.kind);
      setNow(null);
      const gap = reduced ? rnd(9000, 14000) : rnd(5000, 9000);
      timer.current = window.setTimeout(step, gap);
    }, dwell);
  }, [chime, reduced]);

  // Fetch real recent rows once, build the event stream, start cycling.
  useEffect(() => {
    if (!isDemo) return;
    let alive = true;
    (async () => {
      const safe = async <T,>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> => {
        try { const { data } = await p; return data || []; } catch { return []; }
      };
      const [posts, prospects, leads] = await Promise.all([
        safe(supabase.from('carousel_drafts').select('title,topic,status,type').order('updated_at', { ascending: false }).limit(20)),
        safe(supabase.from('outreach_prospects').select('name,company,stage').order('created_at', { ascending: false }).limit(25)),
        safe(supabase.from('leads').select('name,company').order('created_at', { ascending: false }).limit(15)),
      ]);
      if (!alive) return;
      events.current = buildLiveEvents({ posts, prospects, leads });
      idx.current = 0;
      setReady(true);
      // First beat after a short settle so the dashboard paints first.
      timer.current = window.setTimeout(step, reduced ? 2500 : 1400);
    })();
    return () => { alive = false; if (timer.current) window.clearTimeout(timer.current); };
  }, [step, reduced, isDemo]);

  // Pause the loop when the tab is hidden; resume on return.
  useEffect(() => {
    if (!isDemo) return;
    const onVis = () => {
      if (document.hidden) {
        if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
        setNow(null);
      } else if (timer.current === null && events.current.length) {
        timer.current = window.setTimeout(step, 1200);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [step, isDemo]);

  return <Ctx.Provider value={{ now, soundOn, toggleSound, ready }}>{children}</Ctx.Provider>;
};
