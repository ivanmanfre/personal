import type { OutreachProspect } from '../../../types/dashboard';

// ─────────────────────────────────────────────────────────────────────────────
// Lead tags
//
// Everything the sourcing pipeline knows about WHY a lead is in the list lives
// in outreach_prospects.enrichment_data (jsonb): which lane it was tagged into,
// what sourced it, which anchor it came off, whether it is the EU-scale offer,
// and whether an audit page already exists for it. None of that is a column, so
// none of it reached the UI — a replied lead read as an untyped stranger.
//
// This module derives the tags from that jsonb ONCE so the mobile card and the
// desktop table render the same chips from the same rules.
//
// Vertical matters beyond display: ARCH's ratified rule (content_prompts
// arch-company-facts) is that the client references in a message must match the
// prospect's vertical — mobile games get Candivore / SuperPlay / Ten Square
// Games, apps get Surfshark / Revolut / BetterHelp / Almedia, and the two are
// never mixed. A vertical we cannot resolve is shown as an explicit unknown
// rather than silently defaulted, because a wrong default sends wrong copy.
// ─────────────────────────────────────────────────────────────────────────────

export type LeadVertical = 'games' | 'apps' | 'unknown';

export interface LeadTag {
  key: string;
  label: string;
  title: string;          // hover explanation, so a chip is never a mystery
  className: string;
  href?: string;          // set for the audit chip
}

const CHIP = {
  games:   'bg-violet-500/10 text-violet-300/80 border border-violet-500/20',
  apps:    'bg-sky-500/10 text-sky-300/80 border border-sky-500/20',
  unknown: 'bg-zinc-700/30 text-zinc-500 border border-zinc-600/30',
  eu:      'bg-indigo-500/10 text-indigo-300/80 border border-indigo-500/20',
  source:  'bg-zinc-700/25 text-zinc-400 border border-zinc-600/25',
  anchor:  'bg-teal-500/10 text-teal-300/70 border border-teal-500/20',
  tierA:   'bg-emerald-500/10 text-emerald-300/80 border border-emerald-500/20',
  tierB:   'bg-amber-500/10 text-amber-300/80 border border-amber-500/20',
  tierC:   'bg-zinc-700/30 text-zinc-500 border border-zinc-600/30',
  audit:   'bg-orange-500/15 text-orange-300 border border-orange-500/30',
  ai:      'bg-fuchsia-500/10 text-fuchsia-300/70 border border-fuchsia-500/20',
} as const;

// Non-game company verticals the sourcing rubric emits (arch harvest cycles).
// Any of these means the prospect sits on the apps side of ARCH's two lanes.
const APP_VERTICALS = new Set([
  'fintech', 'd2c_subscription', 'd2c_ecom', 'edtech', 'health_wellness',
  'productivity_saas', 'consumer_privacy_saas', 'consumer_app_news',
  'travel', 'consumer_saas',
]);

function enrichment(p: OutreachProspect): Record<string, any> {
  const ed = p.enrichmentData;
  if (!ed) return {};
  if (typeof ed === 'string') { try { return JSON.parse(ed) || {}; } catch { return {}; } }
  return ed;
}

/**
 * Resolve which of ARCH's two lanes a prospect belongs to, most explicit signal
 * first. Mirrors the precedence the DM Sequencer uses when it picks between the
 * dm1_b_games and dm1_b_apps templates, so the chip and the copy agree.
 */
export function verticalOf(p: OutreachProspect): LeadVertical {
  const ed = enrichment(p);
  const explicit = String(ed.vertical || '');
  if (explicit === 'apps' || explicit === 'games') return explicit;

  const cv = String(ed.company_vertical || '');
  if (cv) return APP_VERTICALS.has(cv) ? 'apps' : 'games';

  const lane = String(ed.lane || '');
  if (/apps/.test(lane)) return 'apps';
  if (/games/.test(lane)) return 'games';

  // A named game is the strongest remaining tell: only game rows carry one.
  if (ed.game) return 'games';
  return 'unknown';
}

const SOURCE_LABELS: Record<string, { label: string; title: string }> = {
  competitor_post_engager: { label: 'engager', title: 'Engaged a competitor / authority post' },
  own_post_engager:        { label: 'own-post', title: "Engaged the client's own post" },
  apollo_right_title:      { label: 'apollo', title: 'Apollo ICP search on title' },
  youtube_sponsor_mining:  { label: 'YT sourced', title: 'Found by mining YouTube sponsorships' },
  client_sourced_sponsor:  { label: 'client sponsor', title: 'Sponsor list supplied by the client' },
  profile_view_warm:       { label: 'profile view', title: 'Viewed the seat profile' },
};

/**
 * The full chip set for one lead, ordered most-decisive first: vertical (drives
 * which client names the copy may use), EU offer, tier, source, anchor, audit.
 */
export function leadTags(p: OutreachProspect): LeadTag[] {
  const ed = enrichment(p);
  const tags: LeadTag[] = [];

  const vert = verticalOf(p);
  tags.push(
    vert === 'unknown'
      ? { key: 'vertical', label: 'vertical?', title: 'No vertical resolved — copy would fall back to the games default', className: CHIP.unknown }
      : { key: 'vertical', label: vert === 'games' ? 'Games' : 'Apps',
          title: vert === 'games'
            ? 'Games lane — references must be Candivore / SuperPlay / Ten Square Games'
            : 'Apps lane — references must be Surfshark / Revolut / BetterHelp / Almedia',
          className: vert === 'games' ? CHIP.games : CHIP.apps }
  );

  if (String(ed.eu_logic || '') === 'true') {
    tags.push({ key: 'eu', label: 'EU scale', title: 'EU-scale offer lane: non-English markets, sp_eu_* sequence', className: CHIP.eu });
  }

  if (String(ed.ai_brand || '') === 'true') {
    tags.push({ key: 'ai', label: 'AI brand', title: 'Flagged an AI product/brand', className: CHIP.ai });
  }

  const tier = String(ed.triage_tier || '');
  if (tier === 'A' || tier === 'B' || tier === 'C') {
    tags.push({ key: 'tier', label: `Tier ${tier}`, title: `Harvest triage tier ${tier}`,
      className: tier === 'A' ? CHIP.tierA : tier === 'B' ? CHIP.tierB : CHIP.tierC });
  }

  const src = SOURCE_LABELS[String(ed.source_kind || '')];
  if (src) tags.push({ key: 'source', label: src.label, title: src.title, className: CHIP.source });

  if (ed.anchor) {
    tags.push({ key: 'anchor', label: `↗ ${String(ed.anchor)}`, title: `Sourced off ${String(ed.anchor)}'s post`, className: CHIP.anchor });
  }

  if (ed.audit_url) {
    tags.push({
      key: 'audit',
      label: ed.game ? `AUDIT · ${String(ed.game)}` : 'AUDIT',
      title: `A creator audit page already exists for this lead — offer it: ${String(ed.audit_url)}`,
      className: CHIP.audit,
      href: String(ed.audit_url),
    });
  }

  return tags;
}
