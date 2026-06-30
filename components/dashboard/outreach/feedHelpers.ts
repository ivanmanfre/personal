import type { OutreachProspect, OutreachFeed, FeedRollupRow } from '../../../types/dashboard';

// ─────────────────────────────────────────────────────────────────────────────
// Feed model
//   Cold    — Apollo-sourced (default); trigger_type null / non-feed.
//   Harvest — engagement_harvest (trigger_type='engaged_post' + enrichment source).
//   Hiring  — hiring_signal (trigger_type='hiring').
//   Hot     — intent-screen overlay: prospect's company_domain is a HOT domain.
//             (Derived from domain_screens, passed in as a Set.)
// A prospect belongs to exactly ONE feed for rollup purposes; Hot is an overlay
// that takes precedence when a domain is intent-hot (warmest signal wins).
// ─────────────────────────────────────────────────────────────────────────────

export const FEED_ORDER: OutreachFeed[] = ['cold', 'harvest', 'hiring', 'hot'];

export const FEED_LABELS: Record<OutreachFeed, string> = {
  cold: 'Cold',
  harvest: 'Harvest',
  hiring: 'Hiring',
  hot: 'Intent-Hot',
};

export const FEED_DESC: Record<OutreachFeed, string> = {
  cold: 'Apollo-sourced ICP search',
  harvest: 'Engagers on competitor / authority posts',
  hiring: 'Companies hiring for roles you displace',
  hot: 'Domains screened hot for AI-buying intent',
};

// Tailwind classes per feed — stays inside the semantic palette.
//   cold = zinc (neutral), harvest = blue (warm-ish inbound), hiring = amber
//   (signal/opportunity), hot = emerald (hottest / success).
export const FEED_BADGE: Record<OutreachFeed, string> = {
  cold: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  harvest: 'bg-blue-50 text-blue-700 border-blue-200',
  hiring: 'bg-amber-50 text-amber-700 border-amber-200',
  hot: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// Solid bar gradients for the comparison viz (gradient-to-t, matches OutreachFunnel).
export const FEED_BAR: Record<OutreachFeed, string> = {
  cold: 'from-zinc-500 to-zinc-600',
  harvest: 'from-blue-500 to-blue-600',
  hiring: 'from-amber-500 to-amber-600',
  hot: 'from-emerald-500 to-emerald-600',
};

export const FEED_TEXT: Record<OutreachFeed, string> = {
  cold: 'text-zinc-600',
  harvest: 'text-blue-700',
  hiring: 'text-amber-700',
  hot: 'text-emerald-700',
};

/**
 * Resolve a prospect to its feed. `hotDomains` is the set of intent-hot domains
 * from domain_screens; when provided and the prospect's company_domain is in it,
 * the prospect is tagged `hot` (the warmest overlay) regardless of source.
 */
export function feedOf(
  p: Pick<OutreachProspect, 'triggerType' | 'enrichmentSource' | 'companyDomain'>,
  hotDomains?: Set<string>,
): OutreachFeed {
  const dom = (p.companyDomain || '').trim().toLowerCase();
  if (hotDomains && dom && hotDomains.has(dom)) return 'hot';
  if (p.triggerType === 'engaged_post' && p.enrichmentSource === 'engagement_harvest') return 'harvest';
  if (p.triggerType === 'hiring') return 'hiring'; // covers enrichmentSource hiring_signal + legacy
  return 'cold';
}

const SENT_STAGES = new Set(['connection_sent', 'connected', 'dm_sent', 'replied', 'converted']);
const CONNECTED_STAGES = new Set(['connected', 'dm_sent', 'replied', 'converted']);
const DM_STAGES = new Set(['dm_sent', 'replied', 'converted']);
const REPLIED_STAGES = new Set(['replied', 'converted']);

/**
 * Group prospects by feed × stage and compute accept-rate / reply-rate per feed.
 *   acceptRate = connected / connectionSent   (did the invite get accepted?)
 *   replyRate  = replied / dmSent             (did the DM get a reply?)
 * Archived prospects should be excluded by the caller (the pipeline hook already
 * filters `stage <> archived`).
 */
export function feedRollup(
  prospects: Pick<OutreachProspect, 'triggerType' | 'enrichmentSource' | 'companyDomain' | 'stage'>[],
  hotDomains?: Set<string>,
): FeedRollupRow[] {
  const blank = (): Omit<FeedRollupRow, 'feed'> => ({
    total: 0, connectionSent: 0, connected: 0, dmSent: 0, replied: 0, acceptRate: 0, replyRate: 0,
  });
  const map = new Map<OutreachFeed, Omit<FeedRollupRow, 'feed'>>(
    FEED_ORDER.map((f) => [f, blank()]),
  );
  for (const p of prospects) {
    const row = map.get(feedOf(p, hotDomains))!;
    row.total += 1;
    if (SENT_STAGES.has(p.stage)) row.connectionSent += 1;
    if (CONNECTED_STAGES.has(p.stage)) row.connected += 1;
    if (DM_STAGES.has(p.stage)) row.dmSent += 1;
    if (REPLIED_STAGES.has(p.stage)) row.replied += 1;
  }
  return FEED_ORDER.map((feed) => {
    const r = map.get(feed)!;
    const acceptRate = r.connectionSent > 0 ? Math.round((r.connected / r.connectionSent) * 1000) / 10 : 0;
    const replyRate = r.dmSent > 0 ? Math.round((r.replied / r.dmSent) * 1000) / 10 : 0;
    return { feed, ...r, acceptRate, replyRate };
  });
}

/** Warm = harvest + hiring + hot. The key comparison vs cold. */
export interface WarmVsCold {
  warmTotal: number;
  coldTotal: number;
  warmConnSent: number; warmConnected: number; warmDmSent: number; warmReplied: number;
  coldConnSent: number; coldConnected: number; coldDmSent: number; coldReplied: number;
  warmAcceptRate: number; coldAcceptRate: number;
  warmReplyRate: number; coldReplyRate: number;
}

export function warmVsCold(rows: FeedRollupRow[]): WarmVsCold {
  const cold = rows.find((r) => r.feed === 'cold');
  const warm = rows.filter((r) => r.feed !== 'cold');
  const sum = (arr: FeedRollupRow[], k: keyof FeedRollupRow) =>
    arr.reduce((a, r) => a + (r[k] as number), 0);
  const warmConnSent = sum(warm, 'connectionSent');
  const warmConnected = sum(warm, 'connected');
  const warmDmSent = sum(warm, 'dmSent');
  const warmReplied = sum(warm, 'replied');
  const coldConnSent = cold?.connectionSent ?? 0;
  const coldConnected = cold?.connected ?? 0;
  const coldDmSent = cold?.dmSent ?? 0;
  const coldReplied = cold?.replied ?? 0;
  const rate = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
  return {
    warmTotal: sum(warm, 'total'),
    coldTotal: cold?.total ?? 0,
    warmConnSent, warmConnected, warmDmSent, warmReplied,
    coldConnSent, coldConnected, coldDmSent, coldReplied,
    warmAcceptRate: rate(warmConnected, warmConnSent),
    coldAcceptRate: rate(coldConnected, coldConnSent),
    warmReplyRate: rate(warmReplied, warmDmSent),
    coldReplyRate: rate(coldReplied, coldDmSent),
  };
}
