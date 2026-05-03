import type { OfferLadderRung, FunnelTouchpoint, PlannedLeadMagnet, ExternalLink } from '../types/dashboard';

// Offer ladder — 2026-04-19 strategy doc + 2026-04-25 lead magnet spec
export const offerLadder: OfferLadderRung[] = [
  {
    id: 'lm-free',
    name: 'Free Lead Magnets',
    priceLabel: 'Free',
    priceTier: 'free',
    status: 'live',
    description: 'Vertical-specific scorecards, calculators, and reports — entry to the funnel.',
    stripeUrl: null,
    resourceUrl: 'https://resources.ivanmanfredi.com',
    visibility: 'public',
  },
  {
    id: 'orientation-500',
    name: 'AI Orientation Session',
    priceLabel: '$500',
    priceTier: 'low',
    status: 'internal',
    description: '1-hour walk-through (unlisted). Internal upsell after qualified Discovery.',
    stripeUrl: null,
    resourceUrl: null,
    visibility: 'unlisted',
  },
  {
    id: 'agent-ready-2500',
    name: 'Agent-Ready Blueprint',
    priceLabel: '$2,500',
    priceTier: 'mid',
    status: 'live',
    description: 'Paid 4-precondition diagnostic + 90-day roadmap. Primary qualified-lead generator.',
    stripeUrl: 'https://buy.stripe.com/agent-ready-assessment',
    resourceUrl: 'https://ivanmanfredi.com/agent-ready-assessment',
    visibility: 'public',
  },
  {
    id: 'lms-project',
    name: 'Lead Magnet System (productized)',
    priceLabel: '$6K-$10K',
    priceTier: 'high',
    status: 'planned',
    description: "Productized entry project — build the firm's first agent-ready lead magnet.",
    stripeUrl: null,
    resourceUrl: null,
    visibility: 'public',
  },
  {
    id: 'care-plan',
    name: 'Care Plan',
    priceLabel: '$1K/mo',
    priceTier: 'high',
    status: 'planned',
    description: 'Maintenance retainer for shipped agent-ready systems.',
    stripeUrl: null,
    resourceUrl: null,
    visibility: 'public',
  },
  {
    id: 'fractional-tier-1',
    name: 'Fractional AI Partner — Tier 1',
    priceLabel: '$4K/mo',
    priceTier: 'high',
    status: 'planned',
    description: 'Part-time embedded AI ops partner — entry tier.',
    stripeUrl: null,
    resourceUrl: null,
    visibility: 'public',
  },
  {
    id: 'fractional-tier-2',
    name: 'Fractional AI Partner — Tier 2',
    priceLabel: '$7K/mo',
    priceTier: 'enterprise',
    status: 'planned',
    description: 'Embedded partner with broader implementation scope.',
    stripeUrl: null,
    resourceUrl: null,
    visibility: 'public',
  },
  {
    id: 'fractional-tier-3',
    name: 'Fractional AI Partner — Tier 3',
    priceLabel: '$10K/mo',
    priceTier: 'enterprise',
    status: 'planned',
    description: 'Full embedded partner with delivery + management.',
    stripeUrl: null,
    resourceUrl: null,
    visibility: 'public',
  },
];

// Funnel touchpoints — 2026-04-19 strategy doc, 4-touchpoint architecture
export const funnelTouchpoints: FunnelTouchpoint[] = [
  {
    step: 1,
    name: 'Pre-Call Qualification Form',
    buildStatus: 'built',
    url: 'https://ivanmanfredi.com/start',
    metric: null,
    description: "Free form gating Discovery Call. 7 questions that filter for decision-maker, timeline, and budget fit. Qualified leads route to discovery call slot; non-qualified routed to waitlist.",
  },
  {
    step: 2,
    name: 'Discovery Call (free, 30 min)',
    buildStatus: 'partial',
    url: 'https://cal.com/ivanmanfredi/discovery',
    metric: null,
    description: 'Free call only after Pre-Call Form qualifies. Outcome: Blueprint sale or polite no.',
  },
  {
    step: 3,
    name: 'Agent-Ready Blueprint (paid, $2,500)',
    buildStatus: 'built',
    url: 'https://ivanmanfredi.com/assessment',
    metric: null,
    description: '1-week paid diagnostic. Conversion target: 50-70% to Care Plan or LMS project.',
  },
  {
    step: 4,
    name: 'Client Kickoff',
    buildStatus: 'partial',
    url: null,
    metric: null,
    description: 'Onboarding flow after Blueprint converts to engagement.',
  },
];

// Planned lead magnets from 2026-04-25 spec — items not yet in lead_magnets table
export const plannedLeadMagnets: PlannedLeadMagnet[] = [
  {
    slug: 'accounting-workflow-capacity-calculator',
    title: 'Agent-Ready Capacity Calculator for Accounting Firms',
    format: 'Google Sheet',
    status: 'planned',
    targetCampaign: 'Accounting & Tax Advisory Firms',
    industryCluster: 'accounting',
    priority: 1,
    notes: '21 enriched prospects blocked. Highest priority.',
  },
  {
    slug: 'architecture-project-margin-score',
    title: 'Agent-Ready Margin Diagnostic for Architecture Studios',
    format: 'Interactive Web + Visual Diagram',
    status: 'planned',
    targetCampaign: 'Architecture & Interior Design Firms',
    industryCluster: 'architecture',
    priority: 2,
    notes: '13 enriched prospects blocked.',
  },
  {
    slug: 'research-firm-throughput-report',
    title: 'Agent-Ready Throughput Report for Research Practices',
    format: 'PDF Report',
    status: 'planned',
    targetCampaign: 'Research Firms & Insights Practices',
    industryCluster: 'research',
    priority: 3,
    notes: '14 enriched prospects blocked.',
  },
  {
    slug: 'consultancy-hire-or-build-decision-tool',
    title: 'Agent-Ready Decision Tool for Boutique Consultancies',
    format: 'Interactive Decision Tool',
    status: 'planned',
    targetCampaign: 'Consultancies & Strategy Firms',
    industryCluster: 'consulting',
    priority: 4,
    notes: '12 enriched prospects blocked.',
  },
];

// Source-of-truth links + external resources
export const externalLinks: ExternalLink[] = [
  { label: 'Personal site', url: 'https://ivanmanfredi.com', category: 'live-site' },
  { label: 'Resources subdomain', url: 'https://resources.ivanmanfredi.com', category: 'live-site' },
  { label: 'n8n', url: 'https://n8n.ivanmanfredi.com', category: 'tool' },
  { label: 'Supabase project', url: 'https://supabase.com/dashboard/project/bjbvqvzbzczjbatgmccb', category: 'tool' },
  { label: 'ClickUp Prompts Library', url: 'https://app.clickup.com/90132938061/v/dc/2ky5ezad-853', category: 'tool' },
  { label: 'Stripe dashboard', url: 'https://dashboard.stripe.com', category: 'tool' },
];

// ─── Content Strategy (2026-05 audit synthesis) ───
// All values below are HARDCODED from agent-C10-synthesis + agent-V1-video-hooks summaries
// (.audit-2026-05/content-strategy/). Once telemetry wires up (own_posts.pillar joined to
// ClickUp Linkedin Posts list 901324306245 + applied.json gate state), these become
// derived in useStrategyMap (or a future useContentStrategyState hook).

export interface ThisWeekItem {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
  format: string;
  description: string;
  isAnchor?: boolean;
}

export interface PrecondictionEpisode {
  number: number;
  title: string;
  hook: string;
  format: string; // 'C', 'D', 'B', 'A'
  formatLabel: string;
}

export interface PillarTarget {
  pillar: string;
  targetPct: number;
  actualPct: number | null; // null = awaiting telemetry
}

export interface AuditGate {
  id: string;
  day: number; // 14, 30, 60, 90
  date: string; // ISO date
  label: string;
  description: string;
}

export interface OpenDecision {
  id: string;
  date: string;
  title: string;
  detail: string;
  status: 'open' | 'in-progress' | 'resolved';
}

export interface ContentStrategyLink {
  label: string;
  url: string; // local path or http URL
  kind: 'local' | 'web';
}

// This Week's Plan — repurposing flywheel pattern from C10
export const contentStrategyThisWeek: ThisWeekItem[] = [
  { day: 'Mon', format: 'Long-text', description: 'Anchors the week — 1,400-1,800 chars, seeds Tue + Wed' },
  { day: 'Tue', format: 'Precondition Cut video', description: 'Methodology pillar, 60-90s 9:16 native upload @ 09:00 ET', isAnchor: true },
  { day: 'Wed', format: 'PDF carousel', description: 'Saves day — 7-9 slides @ 08:00 ET + self-comment within 30 min' },
  { day: 'Thu', format: 'Tactical post', description: 'Auto-pull live tooling/algo news (or banked C2 idea fallback)' },
  { day: 'Fri', format: 'Experimental slot', description: 'Alternates image-carousel (durable) and video (POV/experimental)' },
];

// Episodes 1-4 hooks — from agent-V1-video-hooks/scripts-revised.md (compressed 6-9 word hooks)
export const preconditionEpisodes: PrecondictionEpisode[] = [
  {
    number: 1,
    title: 'Structured Input',
    hook: 'Twelve minutes. To read one form. That\u2019s the bug.',
    format: 'C',
    formatLabel: 'talking-head + screen-recording cut-away',
  },
  {
    number: 2,
    title: 'Documentable Decision Logic',
    hook: '"She just knows." That\u2019s the problem.',
    format: 'D',
    formatLabel: 'talking-head + text-overlay punch',
  },
  {
    number: 3,
    title: 'Narrow Initial Scope',
    hook: 'Day three. Every time. The agent breaks.',
    format: 'B',
    formatLabel: 'held printed artifact',
  },
  {
    number: 4,
    title: 'Human-in-the-Loop',
    hook: 'Fifteen percent human review. That IS the design.',
    format: 'C',
    formatLabel: 'talking-head + screen-recording cut-away',
  },
];

// Pillar mix — target from C10 D02 ruling (35/30/25/7 + 3% experimental buffer)
// actual is null until ClickUp Linkedin Posts list .pillar field wires up
export const pillarMixTargets: PillarTarget[] = [
  { pillar: 'Durable',       targetPct: 35, actualPct: null },
  { pillar: 'Methodology',   targetPct: 30, actualPct: null },
  { pillar: 'Tactical',      targetPct: 25, actualPct: null },
  { pillar: 'Personal-POV',  targetPct: 7,  actualPct: null },
  { pillar: 'Experimental',  targetPct: 3,  actualPct: null },
];

// Audit gates — Day 14 / 30 / 60 / 90 from C10 synthesis (Day 0 = 2026-05-03 per wave-0-baseline)
export const auditGates: AuditGate[] = [
  {
    id: 'day-14',
    day: 14,
    date: '2026-05-17',
    label: 'Comment Drafter audit',
    description: '70+ drafts queued AND 70+ posted in 7 days? If <50, locked decision #42 binding — HALT all other strategy work.',
  },
  {
    id: 'day-30',
    day: 30,
    date: '2026-06-02',
    label: 'Wave 0 baseline check',
    description: 'P30-7 epoch close. Re-baseline source attribution + pageview/lm_event medians. UTM convention sticking?',
  },
  {
    id: 'day-60',
    day: 60,
    date: '2026-07-02',
    label: 'Voice spec re-baseline',
    description: 'Failure-First in video pillar: revisit C3 vs V1 contradiction with own-corpus telemetry. Buyer-language hook test (Mondays #5+#8).',
  },
  {
    id: 'day-90',
    day: 90,
    date: '2026-08-07',
    label: 'Falsifiable test',
    description: 'Synthesis pass/fail: 4-7 inbound qualified leads/month? \u226560 posts shipped? \u2265630 ICP comments? 12 episodes recorded?',
  },
];

// Open decisions — 3 most recent strategic calls
export const openDecisions: OpenDecision[] = [
  {
    id: 'format-c-infra',
    date: '2026-05-02',
    title: 'Format C compositing path',
    detail: 'TalkingHeadWithScreenInsert spec\u2019d today \u2014 watch ivan-video-engine Railway deploy. 5 of 13 episodes need it.',
    status: 'in-progress',
  },
  {
    id: 'screen-recording-path',
    date: '2026-05-02',
    title: 'Path A vs Path B for screen-recording',
    detail: 'A = Remotion variant (~2hr Claude work, infra). B = iPhone+QuickTime + CapCut (no infra, ~10min/ep, ~50min/quarter Ivan-time).',
    status: 'open',
  },
  {
    id: 'series-name-lock',
    date: '2026-05-02',
    title: 'Series locked: The Precondition Cut',
    detail: 'D01 ruling \u2014 ADOPT C5 over Teardown Tuesday (8.7 angles/eng brittle vs renewable 4-precondition lens).',
    status: 'resolved',
  },
];

// Quick links — content-strategy artifacts
export const contentStrategyLinks: ContentStrategyLink[] = [
  { label: 'Strategy doc (2026-04-19, +2026-05-03 revisions)', url: '/docs/superpowers/specs/2026-04-19-positioning-and-offer-strategy-design.md', kind: 'local' },
  { label: 'C10 90-day calendar JSON',                          url: '/.audit-2026-05/content-strategy/agent-C10-synthesis/content-calendar-90d.json', kind: 'local' },
  { label: 'V1 episode scripts (revised)',                     url: '/.audit-2026-05/content-strategy/agent-V1-video-hooks/scripts-revised.md', kind: 'local' },
  { label: 'C10 synthesis summary',                            url: '/.audit-2026-05/content-strategy/agent-C10-synthesis/summary.txt', kind: 'local' },
  { label: 'Audit unified report',                             url: '/.audit-2026-05/report.html', kind: 'local' },
];

// Plan totals — from C10: 13 weeks \u00d7 5 slots = 65 planned posts
export const contentPlanTotals = {
  weeks: 13,
  slotsPerWeek: 5,
  totalSlots: 65,
  // shippedCount: TODO wire from own_posts joined to plan epoch (Day 0 = 2026-05-03)
};

// Strategy doc + recent specs — manually maintained
export const sourceOfTruthDocs: ExternalLink[] = [
  { label: 'Strategy Map Panel Design (2026-04-25)', url: '/docs/superpowers/specs/2026-04-25-strategy-map-panel-design.md', category: 'spec' },
  { label: 'Vertical Lead Magnets Design (2026-04-25)', url: '/docs/superpowers/specs/2026-04-25-vertical-lead-magnets-design.md', category: 'spec' },
  { label: 'Instagram Content Pipeline (2026-04-21)', url: '/docs/superpowers/specs/2026-04-21-instagram-content-pipeline-design.md', category: 'spec' },
  { label: 'Design System v1 (2026-04-20)', url: '/docs/superpowers/specs/2026-04-20-design-system-v1.md', category: 'spec' },
  { label: 'Positioning & Offer Strategy (2026-04-19)', url: '/docs/superpowers/specs/2026-04-19-positioning-and-offer-strategy-design.md', category: 'spec' },
  { label: 'Outreach Strategy Purge (2026-04-23)', url: 'memory/outreach-strategy-purge-2026-04-23.md', category: 'doc' },
  { label: 'MEMORY index', url: 'memory/MEMORY.md', category: 'doc' },
];
