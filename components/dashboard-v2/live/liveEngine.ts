/**
 * Live engine — honest liveness for the demo dashboard. No replayed history
 * dressed up as real-time. The pill shows TRUE, live-updating facts (a countdown
 * to the next scheduled post, real counts, last-published age); toasts fire only
 * for things that genuinely happen while the page is open (see LiveProvider's
 * poll-diff). Pure / no React.
 */

export type LiveKind = 'publish' | 'accept' | 'idle';

export interface LiveStats {
  /** Epoch ms of the next future scheduled post, if any. */
  nextAt: number | null;
  nextTitle: string | null;
  /** Count of posts scheduled from now through the next 7 days. */
  scheduledWeek: number | null;
  /** Epoch ms the most recent post was published, if known. */
  lastPubAt: number | null;
  /** Active prospects in the pipeline. */
  pipeline: number | null;
}

export function clip(s: string | null | undefined, n = 42): string {
  const t = (s || '').trim();
  if (!t) return '';
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
}

export function person(name?: string | null, company?: string | null): string {
  const nm = clip(name, 22);
  const co = clip(company, 22);
  if (nm && co) return `${nm} · ${co}`;
  return nm || co || 'a prospect';
}

/** "3d 4h" / "3h 12m" / "12m 04s" / "now" — for a future instant. */
export function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${String(sec).padStart(2, '0')}s`;
}

/** "8m ago" / "2h ago" / "3d ago" — for a past instant. */
export function fmtAgo(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Build the rotating set of honest live facts from real stats. Each entry is
 * true at render time; the countdown is recomputed every tick so it moves.
 * `now` is passed in (epoch ms) so this stays pure.
 */
export function buildFacts(stats: LiveStats, now: number): string[] {
  const out: string[] = [];
  if (stats.nextAt && stats.nextAt > now) {
    out.push(`Next post in ${fmtCountdown(stats.nextAt - now)}`);
  }
  if (stats.scheduledWeek && stats.scheduledWeek > 0) {
    out.push(`${stats.scheduledWeek} post${stats.scheduledWeek === 1 ? '' : 's'} scheduled this week`);
  }
  if (stats.lastPubAt) {
    out.push(`Last post published ${fmtAgo(now - stats.lastPubAt)}`);
  }
  if (stats.pipeline && stats.pipeline > 0) {
    out.push(`${stats.pipeline} prospects in pipeline`);
  }
  return out;
}
