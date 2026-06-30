import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { Send, Handshake } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { buildFacts, clip, person, type LiveStats, type LiveKind } from './liveEngine';

/**
 * LiveProvider — HONEST liveness for the demo dashboard.
 *
 * The pill shows real, live-updating facts (countdown to the next scheduled
 * post, real counts, last-published age). Toasts fire ONLY for events that
 * genuinely happen while the page is open: we baseline the latest published
 * post / latest reply at mount (no toast), then poll and announce only rows
 * whose updated_at is newer than that baseline. Nothing historical is ever
 * replayed as if it were live.
 *
 * Demo-only (public /dashboard-v2); Ivan's authed /dashboard stays calm.
 * Sound OFF by default, gated behind a user toggle.
 */

interface LiveCtx {
  text: string;
  soundOn: boolean;
  toggleSound: () => void;
  ready: boolean;
}

const Ctx = createContext<LiveCtx>({ text: '', soundOn: false, toggleSound: () => {}, ready: false });
export const useLive = () => useContext(Ctx);

const ICON: Record<Exclude<LiveKind, 'idle'>, React.ReactNode> = {
  publish: <Send className="w-4 h-4" style={{ color: '#2563eb' }} />,
  accept: <Handshake className="w-4 h-4" style={{ color: '#047857' }} />,
};
const TONE: Record<Exclude<LiveKind, 'idle'>, number[]> = {
  publish: [523.25, 659.25],
  accept: [587.33, 783.99],
};
const POLL_MS = 45000;

const EMPTY: LiveStats = { nextAt: null, nextTitle: null, scheduledWeek: null, lastPubAt: null, pipeline: null };
const ms = (v: string | null | undefined): number | null => {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

export const LiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isDemo = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/dashboard-v2') ||
    (() => { try { return localStorage.getItem('dv-live-force') === '1'; } catch { return false; } })()
  );

  const [stats, setStats] = useState<LiveStats>(EMPTY);
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('dv-live-sound') === '1';
  });

  const audio = useRef<AudioContext | null>(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  // Baselines: the newest event we already knew about at mount. Only strictly
  // newer events toast, so we never announce pre-existing history.
  const basePub = useRef<number>(0);
  const baseRep = useRef<number>(0);
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const chime = useCallback((kind: Exclude<LiveKind, 'idle'>) => {
    if (!soundRef.current) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audio.current) audio.current = new AC();
      const c = audio.current;
      if (c.state === 'suspended') void c.resume();
      const t0 = c.currentTime;
      (TONE[kind] || [523.25]).forEach((f, i) => {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const t = t0 + i * 0.085;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.24);
      });
    } catch { /* audio unavailable */ }
  }, []);

  const toggleSound = useCallback(() => {
    setSoundOn((s) => {
      const next = !s;
      try { localStorage.setItem('dv-live-sound', next ? '1' : '0'); } catch { /* ignore */ }
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

  // Fetch real stats. On the first call we only baseline (no toast); subsequent
  // calls announce genuinely-new published posts / replies.
  const refresh = useCallback(async (first: boolean) => {
    const nowIso = new Date().toISOString();
    const weekIso = new Date(Date.now() + 7 * 864e5).toISOString();
    const q = <T,>(p: PromiseLike<{ data: T | null; count?: number | null }>) =>
      Promise.resolve(p).then((r) => r).catch(() => ({ data: null, count: null }));

    const [next, week, pub, pubList, pipe, rep] = await Promise.all([
      q(supabase.from('carousel_drafts').select('title,scheduled_at').eq('status', 'scheduled').gt('scheduled_at', nowIso).order('scheduled_at', { ascending: true }).limit(1)),
      q(supabase.from('carousel_drafts').select('id', { count: 'exact', head: true }).eq('status', 'scheduled').gt('scheduled_at', nowIso).lte('scheduled_at', weekIso)),
      q(supabase.from('carousel_drafts').select('title,updated_at').eq('status', 'published').order('updated_at', { ascending: false }).limit(1)),
      q(supabase.from('carousel_drafts').select('title,updated_at').eq('status', 'published').order('updated_at', { ascending: false }).limit(4)),
      q(supabase.from('outreach_prospects').select('id', { count: 'exact', head: true }).neq('stage', 'archived')),
      q(supabase.from('outreach_prospects').select('name,company,updated_at').eq('stage', 'replied').order('updated_at', { ascending: false }).limit(4)),
    ]);

    const nextRow = (next.data as Array<{ title: string | null; scheduled_at: string | null }> | null)?.[0];
    const pubRow = (pub.data as Array<{ title: string | null; updated_at: string | null }> | null)?.[0];

    setStats({
      nextAt: ms(nextRow?.scheduled_at),
      nextTitle: nextRow?.title ?? null,
      scheduledWeek: typeof week.count === 'number' ? week.count : null,
      lastPubAt: ms(pubRow?.updated_at),
      pipeline: typeof pipe.count === 'number' ? pipe.count : null,
    });

    const pubRows = (pubList.data as Array<{ title: string | null; updated_at: string | null }> | null) || [];
    const repRows = (rep.data as Array<{ name: string | null; company: string | null; updated_at: string | null }> | null) || [];
    const newestPub = pubRows.reduce((mx, r) => Math.max(mx, ms(r.updated_at) || 0), 0);
    const newestRep = repRows.reduce((mx, r) => Math.max(mx, ms(r.updated_at) || 0), 0);

    if (first) {
      basePub.current = newestPub;
      baseRep.current = newestRep;
      setReady(true);
      return;
    }
    // Announce only events strictly newer than our session baseline.
    pubRows
      .filter((r) => (ms(r.updated_at) || 0) > basePub.current)
      .sort((a, b) => (ms(a.updated_at) || 0) - (ms(b.updated_at) || 0))
      .forEach((r) => {
        toast(`Published: ${clip(r.title, 46)}`, { icon: ICON.publish, description: 'Publisher', duration: 4000 });
        chime('publish');
      });
    repRows
      .filter((r) => (ms(r.updated_at) || 0) > baseRep.current)
      .sort((a, b) => (ms(a.updated_at) || 0) - (ms(b.updated_at) || 0))
      .forEach((r) => {
        toast(`${person(r.name, r.company)} replied`, { icon: ICON.accept, description: 'Outreach', duration: 4000 });
        chime('accept');
      });
    if (newestPub > basePub.current) basePub.current = newestPub;
    if (newestRep > baseRep.current) baseRep.current = newestRep;
  }, [chime]);

  useEffect(() => {
    if (!isDemo) return;
    let alive = true;
    void refresh(true);
    const poll = window.setInterval(() => { if (!document.hidden && alive) void refresh(false); }, POLL_MS);
    return () => { alive = false; window.clearInterval(poll); };
  }, [isDemo, refresh]);

  // 1s heartbeat tick so the countdown moves and facts rotate.
  useEffect(() => {
    if (!isDemo) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [isDemo]);

  const facts = useMemo(() => buildFacts(stats, Date.now()), [stats, tick]);
  // Rotate every 5s; the countdown fact still recomputes every tick.
  const text = facts.length ? facts[Math.floor(tick / 5) % facts.length] : 'Live · monitoring';

  return <Ctx.Provider value={{ text, soundOn, toggleSound, ready }}>{children}</Ctx.Provider>;
};
