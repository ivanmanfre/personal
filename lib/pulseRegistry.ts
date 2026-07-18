/**
 * System Pulse registry — the alive-interface freshness instrument.
 *
 * One entry per dashboard section/source. This mapping is CODE (schema
 * knowledge: which table + timestamp column a surface reads). The liveness
 * CLAIM is never stored here — status is always computed live by usePulse
 * against the app's supabase client (see lib/usePulse.ts).
 *
 * Populated from the Phase 2 instrumented staleness audit
 * (goal-runs/dashboard-revamp-2026-07-18/02-staleness-audit.md + 02-parts/*).
 * Every (table, tsColumn) pair below is evidenced in an audit part file or was
 * verified with a live GET before inclusion — a wrong column would render as a
 * fake "frozen", so none are guessed.
 *
 * Born-dead: read-only. Nothing here writes or fires. The branch is unpushed.
 */

export type PulseSection =
  | 'Today'
  | 'Content'
  | 'Pipeline'
  | 'Clients'
  | 'System'
  | 'Archive';

/**
 * Cadence = how often the source is EXPECTED to write. Windows (in usePulse):
 *   realtime = 24h · daily = 36h · weekly = 10d · event = 30d
 *   dormant  = not window-checked; always rendered "dormant since <ts>"
 */
export type PulseCadence =
  | 'realtime'
  | 'daily'
  | 'weekly'
  | 'event'
  | 'dormant';

export interface PulseEntry {
  id: string;
  label: string;
  section: PulseSection;
  table: string;
  tsColumn: string;
  cadence: PulseCadence;
  /** Human note — surfaced verbatim in the panel. Used for context + freeze dates. */
  note?: string;
  /**
   * Drift affordance: for registry-driven COPY sources (content_prompts), we
   * compare updated_at against a localStorage last-seen and flag a recent edit.
   */
  driftTracked?: boolean;
}

export const PULSE_REGISTRY: PulseEntry[] = [
  // ── Today (Briefing home surface) ────────────────────────────────────────
  {
    id: 'workflow-stats',
    label: 'Workflow health',
    section: 'Today',
    table: 'dashboard_workflow_stats',
    tsColumn: 'updated_at',
    cadence: 'realtime',
    note: 'n8n run stats — the Overview / Workflows feed. Synced continuously.',
  },
  {
    id: 'scheduled-ops',
    label: 'Scheduled ops',
    section: 'Today',
    table: 'scheduled_ops_status',
    tsColumn: 'last_run_at',
    cadence: 'realtime',
    note: 'Cron / launchd op heartbeats. This view is what flags the Usage-sync error.',
  },
  {
    id: 'calendar',
    label: 'Upcoming calls',
    section: 'Today',
    table: 'calendar_events',
    tsColumn: 'created_at',
    cadence: 'event',
    note: 'Calendly ingest — feeds Meetings + the daily brief.',
  },

  // ── Content engine ───────────────────────────────────────────────────────
  {
    id: 'carousel-drafts',
    label: 'Posts pipeline',
    section: 'Content',
    table: 'carousel_drafts',
    tsColumn: 'updated_at',
    cadence: 'daily',
    note: 'The live content pipeline (posts + carousels). Busiest content table.',
  },
  {
    id: 'content-prompts',
    label: 'Prompt library',
    section: 'Content',
    table: 'content_prompts',
    tsColumn: 'updated_at',
    cadence: 'event',
    driftTracked: true,
    note: 'Canonical prompt store read by live n8n runs. Source of positioning/style copy.',
  },
  {
    id: 'lm-drafts',
    label: 'LM drafts',
    section: 'Content',
    table: 'lm_drafts_v2',
    tsColumn: 'updated_at',
    cadence: 'daily',
    note: 'Lead-magnet drafts (LM Studio).',
  },
  {
    id: 'lm-ideas',
    label: 'LM idea candidates',
    section: 'Content',
    table: 'lm_idea_candidates',
    tsColumn: 'created_at',
    cadence: 'daily',
    note: 'Curator-fed LM idea supply.',
  },
  {
    id: 'own-posts',
    label: 'Published posts',
    section: 'Content',
    table: 'own_posts_scored',
    tsColumn: 'posted_at',
    cadence: 'daily',
    note: 'Published LinkedIn posts — the Performance surface.',
  },
  {
    id: 'scans',
    label: 'Free audits (/scan)',
    section: 'Content',
    table: 'scans',
    tsColumn: 'created_at',
    cadence: 'weekly',
    note: 'Prospect /scan reports — ~7–9 per week.',
  },
  {
    id: 'video-ideas',
    label: 'Video pipeline',
    section: 'Content',
    table: 'video_ideas',
    tsColumn: 'updated_at',
    cadence: 'weekly',
    note: 'Board live but stalled at ideation — video channel UNDECIDED.',
  },

  // ── Reach & Pipeline (outreach) ──────────────────────────────────────────
  {
    id: 'outreach-prospects',
    label: 'Prospects',
    section: 'Pipeline',
    table: 'outreach_prospects',
    tsColumn: 'updated_at',
    cadence: 'realtime',
    note: 'LinkedIn outreach stage machine — the most alive surface in the app.',
  },
  {
    id: 'outreach-messages',
    label: 'DMs + replies',
    section: 'Pipeline',
    table: 'outreach_messages',
    tsColumn: 'created_at',
    cadence: 'realtime',
    note: 'Outbound DM sends and inbound replies.',
  },
  {
    id: 'outreach-campaigns',
    label: 'Campaigns',
    section: 'Pipeline',
    table: 'outreach_campaigns',
    tsColumn: 'updated_at',
    cadence: 'daily',
    note: 'Campaign / lane config.',
  },
  {
    id: 'engagement-log',
    label: 'Engager touches',
    section: 'Pipeline',
    table: 'outreach_engagement_log',
    tsColumn: 'created_at',
    cadence: 'realtime',
    note: 'Warm-lane engagement-harvest touches.',
  },
  {
    id: 'comment-feed',
    label: 'Comment queue',
    section: 'Pipeline',
    table: 'comment_feed',
    tsColumn: 'created_at',
    cadence: 'daily',
    note: 'Comment draft / approve-to-post engine (repointed from dead commenting_log 07-17).',
  },
  {
    id: 'harvest-sources',
    label: 'Harvest feeds',
    section: 'Pipeline',
    table: 'harvest_sources',
    tsColumn: 'last_harvested_at',
    cadence: 'daily',
    note: 'Engagement-harvest source roster.',
  },
  {
    id: 'call-reports',
    label: 'Call reports',
    section: 'Pipeline',
    table: 'call_reports',
    tsColumn: 'created_at',
    cadence: 'event',
    note: 'Post-call intelligence — thin (real client calls only).',
  },
  {
    id: 'transcripts',
    label: 'Meeting transcripts',
    section: 'Pipeline',
    table: 'transcripts',
    tsColumn: 'created_at',
    cadence: 'event',
    note: 'Call transcripts feeding Meetings + call intelligence.',
  },

  // ── Clients ──────────────────────────────────────────────────────────────
  {
    id: 'client-boards',
    label: 'Client boards',
    section: 'Clients',
    table: 'client_boards',
    tsColumn: 'updated_at',
    cadence: 'event',
    note: 'Live white-label client boards (Rise DTC) + demo boards. The real client roster.',
  },
  {
    id: 'client-instances',
    label: 'Legacy client registry',
    section: 'Clients',
    table: 'client_instances_safe',
    tsColumn: 'updated_at',
    cadence: 'event',
    note: 'WRONG TABLE for real clients — pre-pivot automation-monitoring registry. Row content frozen since March (only last_checked_at pings). Kept visible on purpose.',
  },

  // ── System / self ────────────────────────────────────────────────────────
  {
    id: 'claude-memory',
    label: 'AIOS memory',
    section: 'System',
    table: 'claude_memory',
    tsColumn: 'updated_at',
    cadence: 'daily',
    note: 'The memory index (Brain). Written on every /remember + compaction.',
  },
  {
    id: 'agent-summaries',
    label: 'Agent channel',
    section: 'System',
    table: 'n8nclaw_daily_summaries',
    tsColumn: 'created_at',
    cadence: 'daily',
    note: 'n8nClaw WhatsApp daily summaries.',
  },
  {
    id: 'steal-box',
    label: 'Ops ideas (StealBox)',
    section: 'System',
    table: 'kyle_steal_box',
    tsColumn: 'created_at',
    cadence: 'daily',
    note: 'Steal-box tactic feed — freshest low-visibility surface in the app.',
  },
  {
    id: 'signal-clusters',
    label: 'Signal clusters',
    section: 'System',
    table: 'signal_clusters',
    tsColumn: 'run_date',
    cadence: 'weekly',
    note: 'Weekly signal-cluster runs (self-claimed weekly cadence).',
  },
  {
    id: 'dashboard-tasks',
    label: 'Task tracker',
    section: 'System',
    table: 'dashboard_tasks',
    tsColumn: 'created_at',
    cadence: 'event',
    note: 'Internal task tracker — superseded by ClickUp, now idle.',
  },
  {
    id: 'scheduled-checks',
    label: 'Self-review checks',
    section: 'System',
    table: 'scheduled_checks',
    tsColumn: 'updated_at',
    cadence: 'event',
    note: 'Self-review reminders — one-off pilot pair, never re-fed.',
  },
  {
    id: 'recordings',
    label: 'Recordings',
    section: 'System',
    table: 'recordings',
    tsColumn: 'created_at',
    cadence: 'event',
    note: 'Screen / call recordings — write+share path live, feed quiet.',
  },
  {
    id: 'pageviews',
    label: 'Site analytics',
    section: 'System',
    table: 'pageviews_daily',
    tsColumn: 'day',
    cadence: 'daily',
    note: 'Site pageview rollup — the current half of the Audience panel.',
  },

  // ── Archive (dormant / frozen by design — visible rot, on purpose) ────────
  {
    id: 'newsletter',
    label: 'Newsletter stack',
    section: 'Archive',
    table: 'newsletter_issues',
    tsColumn: 'updated_at',
    cadence: 'dormant',
    note: 'Newsletter / nurture stack froze ~2026-05-22 (whole stack shut down together).',
  },
  {
    id: 'competitors',
    label: 'Competitor intel',
    section: 'Archive',
    table: 'competitor_posts',
    tsColumn: 'post_date',
    cadence: 'dormant',
    note: 'Competitor scraper frozen since ~2026-05-14.',
  },
  {
    id: 'auto-research',
    label: 'Auto research',
    section: 'Archive',
    table: 'auto_research_sessions',
    tsColumn: 'created_at',
    cadence: 'dormant',
    note: 'Auto Research frozen ~2026-03-25 (~4 months).',
  },
  {
    id: 'upwork',
    label: 'Upwork pipeline',
    section: 'Archive',
    table: 'upwork_jobs',
    tsColumn: 'created_at',
    cadence: 'dormant',
    note: 'Upwork paused 2026-05-19 — zero new jobs since.',
  },
  {
    id: 'followers',
    label: 'LinkedIn followers',
    section: 'Archive',
    table: 'linkedin_follower_history',
    tsColumn: 'fetched_at',
    cadence: 'dormant',
    note: 'Follower-snapshot job idle since ~2026-06-30.',
  },
  {
    id: 'leads',
    label: 'Legacy leads',
    section: 'Archive',
    table: 'leads',
    tsColumn: 'created_at',
    cadence: 'dormant',
    note: 'Pre-Unipile leads table — 0 rows, superseded by outreach_prospects.',
  },
  {
    id: 'blueprints',
    label: 'Blueprint pipeline',
    section: 'Archive',
    table: 'paid_assessments',
    tsColumn: 'paid_at',
    cadence: 'dormant',
    note: '$497 Blueprint offer retired 2026-07-10 — 1 test row, generation hard-disabled.',
  },
  {
    id: 'health',
    label: 'Health logs',
    section: 'Archive',
    table: 'health_weight_logs',
    tsColumn: 'logged_at',
    cadence: 'dormant',
    note: 'Personal health logging stopped ~2026-03-19.',
  },
];
