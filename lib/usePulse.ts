/**
 * usePulse — probes every pulseRegistry entry against the app's supabase
 * client and derives a live freshness status. No stored liveness claim: the
 * STATUS is computed here on every (uncached) probe.
 *
 * Transport: runtime client fetch (the decided option — see 04-alive-
 * architecture.md §C). Reuses the existing anon supabase client and its RLS.
 * RLS-denied rows show honestly as 'no-access' — never hidden, never elevated
 * to a service key (that would put a privileged key in frontend code).
 *
 * Probe per entry: select <tsColumn>, order desc, limit 1. Batched via
 * Promise.all, cached 10 min in-memory (module scope, survives remounts).
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import {
  PULSE_REGISTRY,
  type PulseEntry,
  type PulseCadence,
} from './pulseRegistry';

export type PulseStatus =
  | 'fresh'      // within cadence window
  | 'quiet'      // 1–3× the window
  | 'frozen'     // > 3× the window
  | 'empty'      // 0 rows ever
  | 'no-access'  // RLS / error
  | 'dormant';   // cadence === 'dormant' — always shown as dormant since <ts>

export interface PulseResult {
  entry: PulseEntry;
  status: PulseStatus;
  /** Last-write timestamp (ISO) or null if empty/no-access. */
  ts: string | null;
  ageMs: number | null;
  /** Drift affordance: source updated_at is newer than last-seen AND recent. */
  drifted?: boolean;
  error?: string;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Expected-write windows per cadence (dormant is not window-checked). */
const CADENCE_WINDOW_MS: Record<Exclude<PulseCadence, 'dormant'>, number> = {
  realtime: 24 * HOUR,
  daily: 36 * HOUR,
  weekly: 10 * DAY,
  event: 30 * DAY,
};

const DRIFT_RECENT_MS = 7 * DAY;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface PulseSnapshot {
  results: PulseResult[];
  probedAt: number;
}

let cache: PulseSnapshot | null = null;
let inflight: Promise<PulseSnapshot> | null = null;

function driftKey(id: string) {
  return `pulse-lastseen-${id}`;
}

function deriveStatus(entry: PulseEntry, ts: string | null): PulseStatus {
  if (entry.cadence === 'dormant') return ts ? 'dormant' : 'empty';
  if (ts === null) return 'empty';
  const age = Date.now() - new Date(ts).getTime();
  const win = CADENCE_WINDOW_MS[entry.cadence];
  if (age <= win) return 'fresh';
  if (age <= win * 3) return 'quiet';
  return 'frozen';
}

async function probeEntry(entry: PulseEntry): Promise<PulseResult> {
  try {
    const { data, error } = await supabase
      .from(entry.table)
      .select(entry.tsColumn)
      .order(entry.tsColumn, { ascending: false })
      .limit(1);

    if (error) {
      return { entry, status: 'no-access', ts: null, ageMs: null, error: error.message };
    }

    const row = data && data.length ? (data[0] as unknown as Record<string, unknown>) : null;
    const rawTs = row ? row[entry.tsColumn] : null;
    const ts = rawTs != null ? String(rawTs) : null;
    const status = deriveStatus(entry, ts);
    const ageMs = ts ? Date.now() - new Date(ts).getTime() : null;

    let drifted = false;
    if (entry.driftTracked && ts && typeof window !== 'undefined') {
      try {
        const seen = window.localStorage.getItem(driftKey(entry.id));
        const tsMs = new Date(ts).getTime();
        const recent = Date.now() - tsMs <= DRIFT_RECENT_MS;
        drifted = recent && (!seen || new Date(ts).getTime() > new Date(seen).getTime());
        // Mark as seen so the badge clears on the next visit.
        window.localStorage.setItem(driftKey(entry.id), ts);
      } catch {
        /* localStorage unavailable — drift is a nice-to-have, ignore */
      }
    }

    return { entry, status, ts, ageMs, drifted };
  } catch (e) {
    return {
      entry,
      status: 'no-access',
      ts: null,
      ageMs: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function probeAll(): Promise<PulseSnapshot> {
  const results = await Promise.all(PULSE_REGISTRY.map(probeEntry));
  return { results, probedAt: Date.now() };
}

function getSnapshot(force = false): Promise<PulseSnapshot> {
  if (!force && cache && Date.now() - cache.probedAt < CACHE_TTL_MS) {
    return Promise.resolve(cache);
  }
  if (!force && inflight) return inflight;
  inflight = probeAll().then((snap) => {
    cache = snap;
    inflight = null;
    return snap;
  });
  return inflight;
}

export interface UsePulse {
  results: PulseResult[];
  loading: boolean;
  probedAt: number | null;
  refresh: () => void;
}

export function usePulse(): UsePulse {
  const [snap, setSnap] = useState<PulseSnapshot | null>(cache);
  const [loading, setLoading] = useState(!cache);

  const load = (force = false) => {
    setLoading(true);
    getSnapshot(force).then((s) => {
      setSnap(s);
      setLoading(false);
    });
  };

  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    results: snap?.results ?? [],
    loading,
    probedAt: snap?.probedAt ?? null,
    refresh: () => load(true),
  };
}
