/**
 * useChangelog — the "Since you last looked" instrument.
 *
 * Weaves the liveness registry (usePulse) together with a handful of live
 * table probes into a single "what changed since your last visit" feed, so the
 * dashboard visibly TRACKS the system between sessions (Ivan round-3 verdict:
 * "what happened with the alive feeling, sync with the changes in the future").
 *
 * Anchor: a localStorage snapshot {ts, statuses} written after each Today
 * render. On the next load we diff NOW against that anchor:
 *   (a) content_prompts rows updated since the anchor (positioning/copy edits)
 *   (b) style-% prompt rows updated since the anchor (the visual style set)
 *   (c) pulse status transitions vs the snapshot (feed froze / recovered)
 *   (d) new lm_idea_candidates since the anchor (count)
 *   (e) new inbound outreach_messages since the anchor (count)
 *
 * First visit ever (no snapshot): no diff — the strip shows "baseline set
 * today" and the anchor is written. All reads go through the anon supabase
 * client + its RLS; a blocked read simply contributes no items (never a fake).
 *
 * Also exports useNavDots — the same change signal, projected onto the nav as
 * per-entry change-dots that clear when the owning section is visited.
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { usePulse, type PulseStatus } from './usePulse';

// ── Types ───────────────────────────────────────────────────────────────────
export interface ChangelogItem {
  id: string;
  /** "what changed" — the left half of the strip entry. */
  what: string;
  /** "when" — the right half ("2h ago"). */
  when: string;
  /** sort key (ms) — most recent first. */
  ts: number;
  /** nav section this change belongs to (click target). */
  section: string;
  sub?: string;
}

interface Snapshot {
  ts: string; // ISO — the last-visit anchor
  statuses: Record<string, PulseStatus>;
}

const SNAP_KEY = 'dv-changelog-snapshot';
const SEEN_KEY = 'dv-navdot-seen';
const MAX_ITEMS = 5;

// ── Time formatting ─────────────────────────────────────────────────────────
function fmtAgo(ms: number): string {
  const s = Math.max(0, ms / 1000);
  if (s < 60) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 48) return `${Math.round(h)}h ago`;
  const d = h / 24;
  if (d < 14) return `${Math.round(d)}d ago`;
  return `${Math.round(d / 7)}w ago`;
}

// ── localStorage helpers ────────────────────────────────────────────────────
function readSnapshot(): Snapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    if (!parsed || typeof parsed.ts !== 'string') return null;
    return { ts: parsed.ts, statuses: parsed.statuses || {} };
  } catch {
    return null;
  }
}

function writeSnapshot(statuses: Record<string, PulseStatus>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      SNAP_KEY,
      JSON.stringify({ ts: new Date().toISOString(), statuses }),
    );
  } catch {
    /* localStorage unavailable — the strip degrades to "baseline" next load */
  }
}

// ── Source probes (anon client; a blocked read contributes nothing) ─────────
interface PromptChange {
  slug: string;
  title: string;
  ts: number;
  style: boolean;
}

async function fetchPromptChanges(sinceISO: string): Promise<PromptChange[]> {
  const { data, error } = await supabase
    .from('content_prompts')
    .select('slug, title, updated_at, is_active')
    .gt('updated_at', sinceISO)
    .order('updated_at', { ascending: false })
    .limit(40);
  if (error || !data) return [];
  return data
    .filter((r: any) => r.is_active !== false)
    .map((r: any) => ({
      slug: r.slug as string,
      title: (r.title as string) || (r.slug as string),
      ts: new Date(r.updated_at as string).getTime(),
      style: String(r.slug || '').startsWith('style-'),
    }));
}

async function fetchCount(
  table: string,
  sinceISO: string,
  extra?: (q: any) => any,
): Promise<{ count: number; latest: number | null }> {
  let q = supabase
    .from(table)
    .select('created_at', { count: 'exact' })
    .gt('created_at', sinceISO)
    .order('created_at', { ascending: false })
    .limit(1);
  if (extra) q = extra(q);
  const { data, count, error } = await q;
  if (error) return { count: 0, latest: null };
  const latest =
    data && data.length ? new Date((data[0] as any).created_at).getTime() : null;
  return { count: count ?? 0, latest };
}

// ── The changelog hook (Today strip) ────────────────────────────────────────
export interface UseChangelog {
  items: ChangelogItem[];
  firstVisit: boolean;
  loading: boolean;
}

export function useChangelog(): UseChangelog {
  const { results: pulse, loading: pulseLoading } = usePulse();

  // Read the anchor exactly once (before we overwrite it this session).
  const [snapshot] = useState<Snapshot | null>(() => readSnapshot());
  const firstVisit = snapshot === null;

  const [dbItems, setDbItems] = useState<ChangelogItem[] | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [items, setItems] = useState<ChangelogItem[]>([]);

  // DB probes — run once, gated on the anchor. First visit skips (nothing to diff).
  useEffect(() => {
    let alive = true;
    if (firstVisit || !snapshot) {
      setDbItems([]);
      return;
    }
    const since = snapshot.ts;
    (async () => {
      const [prompts, ideas, inbound] = await Promise.all([
        fetchPromptChanges(since),
        fetchCount('lm_idea_candidates', since),
        fetchCount('outreach_messages', since, (q) => q.eq('direction', 'inbound')),
      ]);
      if (!alive) return;

      const out: ChangelogItem[] = [];
      const now = Date.now();

      // (a) prompt copy edits — cap 2 so other categories surface
      prompts
        .filter((p) => !p.style)
        .slice(0, 2)
        .forEach((p) =>
          out.push({
            id: `prompt-${p.slug}`,
            what: `${p.slug} updated`,
            when: fmtAgo(now - p.ts),
            ts: p.ts,
            section: 'prompts',
          }),
        );

      // (b) style set changes — cap 2
      prompts
        .filter((p) => p.style)
        .slice(0, 2)
        .forEach((p) =>
          out.push({
            id: `style-${p.slug}`,
            what: `${p.slug.replace(/^style-/, '')} style updated`,
            when: fmtAgo(now - p.ts),
            ts: p.ts,
            section: 'styles',
          }),
        );

      // (d) new idea candidates
      if (ideas.count > 0) {
        out.push({
          id: 'ideas',
          what: `${ideas.count} new idea candidate${ideas.count === 1 ? '' : 's'}`,
          when: fmtAgo(now - (ideas.latest ?? now)),
          ts: ideas.latest ?? now,
          section: 'posts',
        });
      }

      // (e) new inbound replies
      if (inbound.count > 0) {
        out.push({
          id: 'inbound',
          what: `${inbound.count} new inbound repl${inbound.count === 1 ? 'y' : 'ies'}`,
          when: fmtAgo(now - (inbound.latest ?? now)),
          ts: inbound.latest ?? now,
          section: 'outreach',
        });
      }

      setDbItems(out);
    })();
    return () => {
      alive = false;
    };
  }, [firstVisit, snapshot]);

  // Finalize once pulse has probed and the DB items are in: add pulse
  // transitions, sort, cap, then write the fresh anchor.
  useEffect(() => {
    if (finalized) return;
    if (dbItems === null) return;
    if (pulseLoading || pulse.length === 0) return;

    const now = Date.now();
    const transitions: ChangelogItem[] = [];
    if (snapshot) {
      for (const r of pulse) {
        const prev = snapshot.statuses[r.entry.id];
        if (!prev) continue;
        if (prev !== 'frozen' && r.status === 'frozen') {
          transitions.push({
            id: `froze-${r.entry.id}`,
            what: `${r.entry.label} froze`,
            when: r.ageMs != null ? fmtAgo(r.ageMs) : '',
            ts: now, // freshly detected — sorts to the top
            section: 'pulse',
          });
        } else if ((prev === 'frozen' || prev === 'quiet') && r.status === 'fresh') {
          transitions.push({
            id: `recovered-${r.entry.id}`,
            what: `${r.entry.label} recovered`,
            when: r.ageMs != null ? fmtAgo(r.ageMs) : '',
            ts: now,
            section: 'pulse',
          });
        }
      }
    }

    const merged = [...transitions.slice(0, 2), ...dbItems]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX_ITEMS);
    setItems(merged);

    // Write the new anchor for next time (statuses from this probe).
    const statuses: Record<string, PulseStatus> = {};
    for (const r of pulse) statuses[r.entry.id] = r.status;
    writeSnapshot(statuses);
    setFinalized(true);
  }, [dbItems, pulse, pulseLoading, snapshot, finalized]);

  return {
    items,
    firstVisit,
    loading: !finalized,
  };
}

// ── Nav change-dots ─────────────────────────────────────────────────────────
// The same change signal, projected onto the nav. A dot marks a nav entry whose
// source changed since it was last VISITED (independent of the Today anchor, so
// a Styles dot persists until Styles is opened). Signatures:
//   styles  → newest style-% updated_at
//   prompts → newest non-style content_prompts updated_at
//   pulse   → the set of currently-frozen feed ids
// Dot shows while signature !== the last-seen signature for that nav id.

type DotId = 'styles' | 'prompts' | 'pulse';

function readSeen(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : null;
  } catch {
    return null;
  }
}

function writeSeen(map: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

async function fetchPromptSigs(): Promise<{ styles?: string; prompts?: string }> {
  const { data, error } = await supabase
    .from('content_prompts')
    .select('slug, updated_at')
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(60);
  if (error || !data) return {};
  let styles: string | undefined;
  let prompts: string | undefined;
  for (const r of data as any[]) {
    const isStyle = String(r.slug || '').startsWith('style-');
    if (isStyle) {
      if (!styles) styles = r.updated_at as string;
    } else if (!prompts) {
      prompts = r.updated_at as string;
    }
    if (styles && prompts) break;
  }
  return { styles, prompts };
}

export interface UseNavDots {
  has: (navId: string) => boolean;
}

export function useNavDots(activeSection: string): UseNavDots {
  const { results: pulse } = usePulse();
  const [promptSigs, setPromptSigs] = useState<{ styles?: string; prompts?: string }>({});
  const [seen, setSeenState] = useState<Record<string, string>>(() => readSeen() ?? {});

  useEffect(() => {
    let alive = true;
    fetchPromptSigs().then((s) => {
      if (alive) setPromptSigs(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pulseSig = useMemo(
    () =>
      pulse
        .filter((r) => r.status === 'frozen')
        .map((r) => r.entry.id)
        .sort()
        .join(','),
    [pulse],
  );

  const sigs: Record<DotId, string | undefined> = useMemo(
    () => ({
      styles: promptSigs.styles,
      prompts: promptSigs.prompts,
      pulse: pulseSig || undefined,
    }),
    [promptSigs, pulseSig],
  );

  // Baseline on first ever load: no prior "seen" map means no prior visit, so
  // nothing has "changed" — capture the current signatures and show no dots
  // (mirrors the changelog's "baseline set today").
  useEffect(() => {
    if (readSeen() !== null) return;
    if (sigs.styles === undefined && sigs.prompts === undefined && pulse.length === 0) return;
    const base: Record<string, string> = {};
    (['styles', 'prompts', 'pulse'] as DotId[]).forEach((k) => {
      if (sigs[k] !== undefined) base[k] = sigs[k] as string;
    });
    writeSeen(base);
    setSeenState(base);
  }, [sigs, pulse.length]);

  // Mark the active section seen (clears its dot) once we know its signature.
  useEffect(() => {
    const id = activeSection as DotId;
    if (!(id === 'styles' || id === 'prompts' || id === 'pulse')) return;
    const sig = sigs[id];
    if (sig === undefined) return;
    setSeenState((prev) => {
      if (prev[id] === sig) return prev;
      const next = { ...prev, [id]: sig };
      writeSeen(next);
      return next;
    });
  }, [activeSection, sigs]);

  const has = (navId: string): boolean => {
    if (navId !== 'styles' && navId !== 'prompts' && navId !== 'pulse') return false;
    const sig = sigs[navId as DotId];
    if (sig === undefined) return false;
    return seen[navId] !== sig;
  };

  return { has };
}
