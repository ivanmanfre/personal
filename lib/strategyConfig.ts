import type { OfferLadderRung, FunnelTouchpoint, PlannedLeadMagnet, ExternalLink, PositioningLockItem, Objection, ToolStackItem, LoopBreakItem } from '../types/dashboard';

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
    id: 'content-system-2k',
    name: 'Content System (done-for-you)',
    priceLabel: '$2K/mo',
    priceTier: 'high',
    status: 'live',
    description: "Managed LinkedIn content engine in the client voice: ~26 posts + ~12 lead magnets + weekly newsletter/mo, plus warm outreach to the client's own audience run end to end to a booked call (we draft, send, handle the back-and-forth, and book; off-script asks escalate). Tokens and tools included. The only public front-door offer.",
    stripeUrl: null,
    resourceUrl: 'https://inboundonsteroids.com',
    visibility: 'public',
  },
  {
    id: 'inbound-outbound-3k',
    name: 'Inbound + Outbound Engine (in-call upsell)',
    priceLabel: '$3K/mo',
    priceTier: 'high',
    status: 'internal',
    description: "Everything in the $2k engine, plus the differentiator: cold acquisition of net-new prospects (connections + DMs + InMail on the client's own Sales Nav seat), each touch carrying a personalized resource, run end to end to a call booked on their calendar. Adds shared Slack + weekly digest + monthly review. Locked 2026-07-13 (both prices reconfirmed by advisor); warm full-handling moved into the $2k base 2026-07-14, so COLD is the only $2k-to-$3k differentiator. PRIVATE in-call upsell only, never website or social, until the 2026-09-14 lock review. Cold is additive call volume, never a guaranteed quota.",
    stripeUrl: null,
    resourceUrl: null,
    visibility: 'private',
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
    description: 'Free call only after the Pre-Call Form qualifies. Outcome: the $2k retainer or a polite no.',
  },
  {
    step: 3,
    name: '$2k/mo Content System (retainer)',
    buildStatus: 'built',
    url: 'https://inboundonsteroids.com',
    metric: null,
    description: 'The paid conversion. The free fit call closes into the $2k/mo retainer, tokens and tools included.',
  },
  {
    step: 4,
    name: 'Client Kickoff',
    buildStatus: 'partial',
    url: null,
    metric: null,
    description: 'Onboarding once the retainer starts. Month one is approve-first to dial in the voice.',
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

// Pillar mix — 2026-07-17 storefront cutover (30/25/15/20/10): Case Study is the
// weekly public-case-study FLAGSHIP (one episode/wk, the storefront's proof pillar).
// Mirrors content_prompts post-generation v26. actualPct stays null here; live
// actuals are computed from carousel_drafts (published, taxonomy.pillar).
export const pillarMixTargets: PillarTarget[] = [
  { pillar: 'Translator',  targetPct: 30, actualPct: null },
  { pillar: 'Methodology', targetPct: 25, actualPct: null },
  { pillar: 'Teardown',    targetPct: 15, actualPct: null },
  { pillar: 'Case Study',  targetPct: 20, actualPct: null },
  { pillar: 'Personal',    targetPct: 10, actualPct: null },
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

// ─── Positioning & Offer — locked 2026-07-03 (positioning-lock memory) ───

// The lock: the five ratified positions, for pulling up live on a sales call.
export const positioningLock: PositioningLockItem[] = [
  { label: 'Price', value: '$2k/mo, tokens + tools included. Ratified 2026-06-29. Tripwire: 4+ calls, 0 yes before any reshape.' },
  { label: 'Headline', value: 'The owned asset you build and run for them: audience, email list, captured named leads. Anti-ghostwriter, anti-SDR.' },
  { label: 'The machine', value: 'Proof in the demo and a steering wheel they rarely touch. Internals (prompts, voice model, corpus) stay yours.' },
  { label: 'Delivery', value: 'Approve-first for month one to dial in the voice, then auto-approve so it runs itself.' },
  { label: 'Identity', value: 'Operator who runs the engine for them. Builder, never copywriter.' },
];

// Objection → the answer the position gives.
export const positioningObjections: Objection[] = [
  {
    objection: 'I could just do this myself with GPT.',
    answer: 'You run it for them, results arrive without their labor, and the compounding voice model + corpus is the part they cannot cheaply rebuild.',
  },
  {
    objection: "I'll just buy the tools and run it myself.",
    answer: 'The tools alone run $300-$600/mo (LinkedIn API, newsletter platform, scraper, design software, model tokens) and you still operate each by hand. At $2k I bill all of it and run it, so you never touch a vendor invoice or an API key.',
    isNew: true,
  },
  {
    objection: 'Ghostwriters never sounded like me.',
    answer: 'A trained voice model plus QA so nothing reads like AI. One voice note re-tunes the whole system.',
  },
  {
    objection: "I don't want a $3-6k content hire.",
    answer: 'Operated for them at $2k, no headcount to manage, no ramp, no sick days.',
  },
  {
    objection: "I don't want to rent an agency forever.",
    answer: 'They own the asset: audience, list, and leads. You run the engine that keeps filling it.',
  },
  {
    objection: 'Does content actually produce pipeline?',
    answer: 'The lead-magnet capture turns reach into named leads and booked calls. Reach on its own is applause.',
  },
  {
    objection: 'How many calls will I actually get?',
    answer: 'Inbound compounds, so I hold to calls not deals: a few in month one building to roughly 8-12/mo by month three, and I will not fix a number on it because it rides on your audience. The $3k outbound tier is the one I put hard numbers on. A Sales Nav seat is 50 InMails plus ~400 safe connection requests a month, which lands ~4-8 booked calls/mo from month one on top of the inbound ramp. Batch one calibrates the real reply rate for your niche.',
    isNew: true,
  },
];

// What $2k replaces: the DIY tool stack a client would otherwise assemble (public prices, verified 2026-07).
export const toolStackReplaced: ToolStackItem[] = [
  { tool: 'LinkedIn scheduler SaaS', job: 'drafting, scheduling, analytics', cost: '39–65' },
  { tool: 'Unipile', job: 'LinkedIn API / messaging', cost: '55–99' },
  { tool: 'Kit / newsletter platform', job: 'newsletter', cost: '39–89' },
  { tool: 'Apify', job: 'scraping / lead sourcing', cost: '49' },
  { tool: 'Claude / GPT tokens', job: 'generation at volume', cost: '50–150' },
  { tool: 'Canva Pro / design', job: 'carousels, covers', cost: '15–30' },
  { tool: 'Smartlead + verification', job: 'cold email + enrichment', cost: '39–94' },
  { tool: 'n8n hosting', job: 'orchestration', cost: '20–50' },
];
export const toolStackTotalLabel = '≈ $300–600/mo';

// The loop Ivan kept running, and the question that ends it.
export const positioningLoopBreak: LoopBreakItem[] = [
  {
    kind: 'loop',
    label: 'The loop you kept running',
    body: 'Show the machine → feels like a tool they could run → so hide it → black-box feels thin → back to the start.',
  },
  {
    kind: 'break',
    label: 'The question that cuts it',
    body: 'Does getting value require their work? If leads, content, and booked calls arrive whether or not they log in, it is a service. The dashboard is a bonus on top.',
  },
];

// ─── 2026 Reach & Format Playbook (research 2026-07-23) ───
// Decision-grade findings from the 10-lane reach/format research workflow
// (115 findings deduped + adversarially date-checked). Full ledger:
// research/linkedin-reach-format-2026-07-23.md. Anchor dataset = Metricool
// 2026 Study (673,658 posts, genuinely-fresh Jan-Feb 2026, personal-profile
// specific). Static until telemetry can score our own posts by format.

export type ReachGrade = 'CONFIRMED' | 'PLAUSIBLE' | 'VENDOR-ONLY';

export interface ReachVerdict { q: string; a: string }
export interface ReachFormatRow { format: string; impressions: string; engagement: string; best?: 'reach' | 'engagement' }
export interface ReachLever { lever: string; grade: ReachGrade; detail: string }

export const reachFormatMeta = {
  updated: '2026-07-23',
  source: 'Metricool 2026 Study (673,658 posts, Jan-Feb 2026) + van der Blom 2026 + LinkedIn official',
  docPath: '/Users/ivanmanfredi/Desktop/Ivan - Content System/research/linkedin-reach-format-2026-07-23.md',
};

// The two decisions this playbook exists to settle.
export const reachFormatVerdicts: ReachVerdict[] = [
  {
    q: 'Pay to boost a post?',
    a: 'No, not yet. Paid does not compound organic on LinkedIn (CONFIRMED, primary). A personal-post boost can’t run a conversion objective or build a retargeting pool. Boost only a post that already proved it lands organically.',
  },
  {
    q: 'Post video for the algorithm?',
    a: 'Not for impressions. On fresh 2026 personal-profile data, carousels roughly double video on reach. Video holds engagement RATE but trails on impressions. Keep 1 video/wk as a test, lead with carousels.',
  },
];

// Personal-profile format table — Metricool 2026 (impressions/post, engagement rate).
export const reachFormatTable: ReachFormatRow[] = [
  { format: 'Carousel (document)', impressions: '~1,451', engagement: '1.44%', best: 'reach' },
  { format: 'Image',               impressions: '~1,187', engagement: '1.81%' },
  { format: 'Text',                impressions: '~1,045', engagement: '1.06%' },
  { format: 'Video',              impressions: '~606',   engagement: '1.80%' },
  { format: 'Multi-image',         impressions: 'lower',  engagement: '3.71%', best: 'engagement' },
];

// Ranked reach levers, graded by evidence strength.
export const reachLevers: ReachLever[] = [
  { lever: 'Carousels/documents lead on impressions', grade: 'CONFIRMED', detail: 'Direction replicates across 5 studies; deliver lead magnets as native carousels, no link.' },
  { lever: 'Paid does not lift organic', grade: 'CONFIRMED', detail: 'Boost/TLA are amplification wrappers on an already-published post. No persistent post-flight lift on LinkedIn, Meta, or TikTok.' },
  { lever: 'Dial cadence to 2-4x/week', grade: 'CONFIRMED', detail: 'van der Blom 2026 (1.3M posts) lowered the optimum from 5-6x. Fewer, stronger posts.' },
  { lever: 'Win the golden hour', grade: 'CONFIRMED', detail: '~50% of lifetime impressions land in 48h, ~40% of interactions on day 1. Reply in the first 60-90 min.' },
  { lever: 'No external links in body (personal profile)', grade: 'PLAUSIBLE', detail: 'Metricool 2026: -27% impressions on personal profiles (+51% on company pages). Route via DM/native doc.' },
  { lever: 'Comment-for-keyword lead magnets are safe', grade: 'PLAUSIBLE', detail: 'Only literal reaction-bait ("Comment YES") is suppressed. Keyword-for-value delivery survives; don’t bulk-bot the DM.' },
  { lever: 'Video is not dead', grade: 'PLAUSIBLE', detail: 'Buffer 2026: video has the highest engagement RATE of any format. It loses reach, holds engagement.' },
  { lever: 'Format-independent boosts', grade: 'CONFIRMED', detail: 'End on a question +77% comments; explicit comment-CTA +80%; ≥1 hashtag +85% impressions (Metricool 2026).' },
  { lever: 'Copy must not read AI-templated', grade: 'CONFIRMED', detail: 'May 2026 AI-slop crackdown demotes generic/templated posts from non-connection reach. Anti-slop is now a reach lever.' },
];

// The weekly mix this playbook prescribes.
export const reachFormatWeeklyMix: string[] = [
  '2 document carousels (one = lead magnet, comment-for-keyword, no link)',
  '1 video (test against the carousels on our own numbers)',
  '1 image post (2nd-best reach; multi-image if the goal is comments)',
];

// Traps that get people caught citing stale/fake data.
export const reachFormatHygiene: string[] = [
  'SocialInsider + Buffer "2026" benchmarks are self-disclosed relabeled 2024-25 data.',
  'van der Blom has two editions; blogs cite the old 2025 one as "2026".',
  '"360Brew" is NOT the confirmed live ranker (real Mar-2026 rebuild names no formats).',
  'All specific dwell breakpoints / "video 5x reach" / "comments 15x likes" are uncited blogspam.',
];
