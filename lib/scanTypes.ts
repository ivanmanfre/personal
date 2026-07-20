// lib/scanTypes.ts

export interface Opportunity {
  title: string;
  signal_source: string;
  evidence: string;
  estimated_weekly_hours: number;
  estimated_monthly_cost: number;
  automation_solution: string;
  roi_estimate: string;
  confidence_tier?: '1' | '2' | '3';
  complexity?: 'low' | 'medium' | 'high';
  time_to_implement?: string;
}

export interface CallIntel {
  archetype: 'intake_driven' | 'sales_demo_driven' | 'cs_retention_driven';
  thesis: string;
  volume_estimate: { value: string; basis?: string };
  observable_signals: Array<{ label: string; detail: string }>;
  leaking_signals: Array<{ title: string; detail: string }>;
  system: { summary: string; capabilities: string[] };
  sample_output: {
    kind: 'flagged_call_card' | 'weekly_digest';
    title: string;
    items: string[];
    metrics?: { label: string; value: string; delta?: string | null }[];
    reps?: { name: string; pct: number }[];
    flags?: { tag: string; text: string }[];
  };
  revenue_math: string;
}

// Emitted only when matched_offer === 'content_system' — drives the content-system
// (organic content engine + lead-magnet capture) report variant. Mirrors CallIntel:
// the audit reasons about THIS prospect's organic content gap and frames it as a leak.
export interface ContentSystem {
  // The dominant gap the audit picks for this prospect:
  //  silent_founder   — has audience/title but rarely posts (leaking attention)
  //  inconsistent     — posts in bursts then goes quiet (no momentum)
  //  no_capture       — posts but nothing converts readers to leads (leaking demand)
  //  invisible        — barely on LinkedIn / no owned attention at all
  //  uncaptured_feed  — posting happens but nothing captures the readers (n8n vocab)
  //  unworked_audience— the audience exists and nobody works it (n8n vocab)
  archetype: 'silent_founder' | 'inconsistent' | 'no_capture' | 'invisible' | 'uncaptured_feed' | 'unworked_audience';
  // The outreach lane's fabrication-gated "3 first wins" (gift note / DM1); when present the
  // page opens with these instead of the archetype pain template. `pillar` tags each win to
  // one of the three offer pillars so the report can seat it in the right chapter.
  wins?: { observation: string; build: string; pillar?: 'content' | 'inbound' | 'outbound' }[];
  // Per-pillar hero-table cells (2026-07-14 revamp). `found` is one specific observation
  // from THEIR public presence (plain sentence, real numbers only); `projected` is what
  // ships weekly. When absent the template derives cells from wins[].pillar, then a
  // keyword heuristic, then an honest plain-sentence fallback.
  pillars?: {
    content?: { found?: string; projected?: string };
    inbound?: { found?: string; projected?: string };
    outbound?: { found?: string; projected?: string };
  };
  // The content engine + lead magnets run off the FOUNDER's personal brand (this offer only
  // routes when the prospect is the owner/founder), so the page speaks to them personally.
  founder?: { name: string; first_name?: string; headline?: string; avatar_url?: string } | null;
  thesis: string;
  audience_estimate: { value: string; basis?: string };
  observable_signals: Array<{ label: string; detail: string }>;
  leaking_signals: Array<{ title: string; detail: string }>;
  system: { summary: string; capabilities: string[] };
  sample_output?: {
    title: string;
    posts?: { format: string; hook: string; body?: string; source_quote?: string; image_url?: string; image_urls?: string[]; image_kind?: 'brand' | 'carousel';
      // Text-carousel slides drafted for a Carousel-format post. `role` selects the slide
      // layout (fallback: first = cover, last = action, rest = point); `kicker` is a small
      // caps line above the heading; `figure` is a dominant numeral for proof slides.
      slides?: { heading: string; body: string; role?: 'cover' | 'point' | 'proof' | 'action'; kicker?: string; figure?: string }[];
      // Designed media card for image posts (2026-07-14 revamp) — copy DISTINCT from the
      // caption. Rendered as a branded 1200x1500-proportion card in the post media slot;
      // falls back to image_url, then plain text.
      image_card?: { kicker?: string; headline: string; figure?: string; sub?: string } }[];
    metrics?: { label: string; value: string; delta?: string | null }[];
    // Then it nurtures: a newsletter drafted from the prospect's own content.
    newsletter?: { subject: string; preview?: string; sections: { h: string; body: string }[]; cta: string };
    // Then it converts: the post-capture email sequence everyone who grabs the magnet gets.
    follow_ups?: { step: number; day: number; subject: string; body: string }[];
    // Then it books: reactions on the prospect's posts turned into personal DMs.
    engager_outreach?: { explainer: string; samples: { trigger: string; dm: string; engager?: { name?: string; headline?: string } }[] };
    lm?: { title: string; cover_url: string; pages?: number; promise?: string; whats_inside?: string[]; slug?: string; seed_answers?: Record<string, number>;
      // Brand-mirror data — the prospect's own accent/logo/fonts, so the engine-tour
      // mockups (newsletter, follow-ups, outreach) read as THEIR asset, not a template.
      accent_hex?: string;
      brand?: {
        accent_hex?: string;
        // Secondary accents from the brand profiler (either key may be emitted).
        accent2?: string;
        accent_secondary?: string;
        logo_url?: string;
        font_heading?: string;
        font_body?: string;
        // Surface/ink of the prospect's site so sample artifacts sit on THEIR canvas.
        surface_hex?: string;
        ink_hex?: string;
        is_dark?: boolean;
      };
      // An in-page, interactive SIMULATION of the lead magnet the system drafted — shown when
      // the LM is a working sample (not a live published page). Seeded with the prospect's own
      // numbers so it reads as their real tool. `kind` selects the model + formula.
      sim?: {
        kind: 'true_profit_roas';
        accent?: string;
        seed: { aov: number; cogs: number; shipping: number; feePct: number; adSpend: number; roas: number };
      };
    };
  };
  revenue_math?: string;
  // Audience audit embed (scan-build audit, 2026-07-15). Counted numbers only:
  // network_icp_count is buyers classified in the sample actually read, never extrapolated.
  // Absent -> the "Who is actually in your room" section does not render.
  audience?: {
    engagers?: number;
    posts?: number;
    engager_icp_count?: number | null;
    icp_density?: number | null;
    buyer_pct?: number | null;
    verdict?: string;
    network_total?: number | null;
    network_sample?: number | null;
    network_icp_count?: number | null;
    network_icp_density?: number | null;
    named?: { name?: string; headline?: string; source?: string }[];
    audited_at?: string;
  };
  // Profile audit embed (scan-build audit, 2026-07-18). Optional, additive. When present the
  // report renders a PROFILE row in THE BOX pillar table and a compact `cs-profile` section of
  // measured check chips. Diagnosis-only register (findings, never fix prescriptions). `found`
  // is the measured "on your feed today" diagnosis line; `projected` is the after-90-days
  // end-state line. `checks` drives the chip strip; empty checks -> table row only, no section.
  profile?: {
    found: string;
    projected: string;
    checks: { tag: string; state: 'pass' | 'flag' | 'fail' | 'unverified'; reading: string }[];
    verified_note?: string;
    audited_at?: string;
  };
  // 1200x630 share/OG card URL (hosted); set on hypertarget scans so the link unfurls.
  og_image_url?: string;
}

// ── Rise DTC Growth Scan ─────────────────────────────────────────────────────
// Emitted only when matched_offer === 'dtc_growth'. Drives the DtcGrowthReport variant:
// a Rise-DTC-branded teardown of a Shopify brand's PUBLIC data, laddered to Rise's
// paid-growth / performance-creative / profit-visibility levers.
//
// CORRECTNESS SPINE: the renderer reads `status`, NEVER payload-presence. A `blocked`
// signal (WAF/private/paywall) collapses silently and emits no number; only a real
// `empty` (reachable, genuine zero) renders a negative finding. empty ≠ blocked.
export type DtcSignalStatus = 'present' | 'empty' | 'blocked' | 'error' | 'absent';

export interface DtcSignalMeta<T = Record<string, unknown>> {
  status: DtcSignalStatus;
  fetched_at?: string;
  source_url?: string;
  reason?: string | null;
  endpoint_used?: string | null;
  partial?: boolean;         // e.g. sitemap-only Shopify: catalog_size real, prices null
  data?: T | null;
}

// White-label brand chrome (Rise's real tokens from the live risedtc.com probe).
export interface DtcBrand {
  wordmark: string;          // "Rise DTC"
  logo_url?: string | null;
  accent_hex: string;        // Rise gold #ffc71d
  ink_hex?: string;
  surface_hex?: string;
  is_dark?: boolean;
  font_heading?: string;     // Sora
  font_body?: string;        // Manrope
  booking_url: string;       // meetings.hubspot.com/mattan5
}

// One source-anchored finding. Every number in evidence must trace to the fact table.
export interface DtcFinding {
  signal: 'shopify' | 'ads.meta' | 'tech_stack' | 'reviews' | 'pagespeed' | 'signup' | 'profit_gap';
  kind: 'gap' | 'strength' | 'negative';
  lever: 'paid_media' | 'performance_creative' | 'profit_visibility' | 'cro';  // Rise-sold levers ONLY
  title: string;
  evidence: string;          // grounded prose; every numeral ∈ fact_table
  source_url?: string | null;
}

export interface DtcGrowth {
  brand: DtcBrand;
  completeness: {
    signals: Record<string, DtcSignalStatus>;
    present_count: number;
    scored_of: number;       // 6
    present: string[];
    tier: 'rich' | 'partial' | 'thin';
  };
  // Per-signal SignalMeta-wrapped blocks. Renderer gates each on `.status === 'present'`
  // (or 'empty' for a negative finding). Anything else collapses.
  shopify?: DtcSignalMeta<{
    catalog_size: number; price_band: { min: number; max: number; median: number } | null;
    variant_depth_avg: number | null; oos_pct: number | null; new_products_90d: number | null;
    has_subscription: boolean | null; discount_depth_pct: number | null; products_on_discount?: number;
    note?: string;
  }>;
  ads?: { meta?: DtcSignalMeta<{
    active_ad_count: number; oldest_active_run_days?: number; distinct_angles?: number;
    has_video?: boolean; has_static?: boolean;
  }> };
  tech_stack?: DtcSignalMeta<{ confirmed: string[]; missing_critical: string[]; is_shopify: boolean; pdp_checked?: boolean }>;
  reviews?: DtcSignalMeta<{ rating: number | null; review_count: number | null; has_reviews: boolean }>;
  pagespeed?: DtcSignalMeta<{ perf_score: number | null; mobile_lcp_s: number | null; cls: number | null; field_data: boolean }>;
  signup?: DtcSignalMeta<{ capture_markers: string[]; has_capture_markers: boolean }>;
  // Partial score — ONLY over `present` dimensions, denominator disclosed.
  growth_score?: number | null;
  score_breakdown?: Record<string, { value: number; max: number; rationale: string }>;
  // Grounded findings (all ladder to a Rise-sold lever). Ordered worst-first.
  findings: DtcFinding[];
  // Profit-Gap self-compute seed (True Profit X-Ray). Prospect types their own real numbers;
  // these are DEFAULTS from public facts (median price, discount depth), clearly labelled as a
  // starting point, never asserted as the prospect's actual margin.
  profit_gap?: {
    seed_aov: number | null; seed_discount_pct: number | null; source_note: string;
  } | null;
  hero_hook: string;         // real-fact hook (every numeral ∈ fact_table)
  og_image_url?: string | null;
  // The exact grounding set every rendered number is checked against (Phase 7 grep target).
  fact_table: string[];
}

export interface ReportJson {
  // Offer routing (synced from the audit's matched_offer). call_intel / content_system / dtc are
  // present only for their matching offer and drive the corresponding report variant.
  matched_offer?: 'content_system' | 'lead_magnets' | 'call_intelligence' | 'dtc_growth' | null;
  offer_angle?: string | null;
  call_intel?: CallIntel | null;
  content_system?: ContentSystem | null;
  dtc?: DtcGrowth | null;
  company_snapshot: {
    name: string;
    one_liner: string;
    size_tier: 'micro' | 'small' | 'mid' | 'large';
    sophistication_tier: 'low' | 'medium' | 'high';
    ai_adoption_signal: 'early_adopter' | 'on_par' | 'behind' | 'unknown';
  };
  automation_score: number;
  automation_grade: string;
  score_rationale: string;
  tech_stack_assessment: {
    confirmed_tools: string[];
    missing_critical_tools: string[];
    sophistication_notes: string;
    apollo_listed_unverified?: string[];
  };
  data_quality_notes?: string;
  homepage_screenshot_url?: string | null;
  reframe?: {
    pre: string;
    emphasis: string;
    post: string;
    surprise_score?: number;
  } | null;
  opportunities: Opportunity[];
  competitive_context: string;
  top_gap_title: string;
  top_gap_summary: string;
  teaser_signals: [string, string, string];
  // Phase 1 additions
  score_breakdown?: {
    tech_stack: { value: number; max: number; rationale: string };
    ad_activity: { value: number; max: number; rationale: string };
    content_engine: { value: number; max: number; rationale: string };
    ai_signals: { value: number; max: number; rationale: string };
    traffic_quality: { value: number; max: number; rationale: string };
  };
  week_one_action?: {
    title: string;
    why: string;
    tools?: string[];
    approach?: string;
    expected_outcome: string;
  };
  peer_median?: {
    score: number;
    size_tier_compared: string;
    interpretation: string;
  };
  hiring?: {
    open_count: number;
    sample_titles: string[];
  } | null;
  recent_news?: Array<{
    title: string;
    source: string | null;
    date: string | null;
    link: string;
    snippet: string;
  }>;
  // Display data fields
  company_name: string;
  logo_url: string | null;
  company_size: string | null;
  revenue_range: string | null;
  domain_age_years: number | null;
  email_infra: 'google_workspace' | 'microsoft_365' | 'other' | null;
  anthropic_verified: boolean;
  openai_verified: boolean;
  clutch_data: {
    hourly_rate: string | null;
    rating: number | null;
    services: Array<{ name: string; percentage: number }>;
    reviews: Array<{ rating: number; headline: string; summary: string }>;
  } | null;
  linkedin_summary: {
    followers: number | null;
    posts_30d: number | null;
    last_post_days: number | null;
    ai_mentions: number | null;
    posts?: Array<{ text: string; date?: string; reactions?: number }>;
  };
  ads_summary: {
    google_ads: 'confirmed' | 'probable' | 'not_detected' | null;
    linkedin_ads: boolean | null;
    meta_ads: boolean | null;
  };
  competitors: Array<{ title: string; url: string; description: string }>;
  github: { repos: number } | null;
  // Live ad creatives (captured from public ad libraries)
  ads?: {
    google_ads?: AdPlatformData;
    linkedin_ads?: AdPlatformData;
    meta_ads?: AdPlatformData;
    any_paid?: boolean;
  } | null;
  funding?: {
    total_funding_usd: number | null;
    last_round_type: string | null;
    last_round_date: string | null;
    investors: Array<{ name: string }> | string[];
    employees_range: string | null;
    founded_year: number | null;
    crunchbase_url: string | null;
  } | null;
  traffic?: {
    monthly_visits: number | null;
    global_rank: number | null;
    bounce_rate: number | null;
    avg_visit_duration: number | null;
    top_country: string | null;
    top_keywords?: string[];
    top_countries?: Array<{ countryName: string; visitsShare: number }>;
    traffic_sources?: { search?: number; direct?: number; social?: number; referrals?: number; mail?: number; paidReferrals?: number };
    pages_per_visit?: number | null;
  } | null;
}

export interface AdPlatformData {
  detected: boolean;
  count: number;
  creatives: AdCreative[];
}

export interface AdCreative {
  // Common
  link_url?: string;
  preview_url?: string;
  // Google Ads
  ad_url?: string;
  ad_format?: string;
  creative_id?: string;
  advertiser_name?: string;
  first_shown?: string;
  last_shown?: string;
  // Meta Ads
  body?: string;
  title?: string;
  images?: string[];
  cta_text?: string;
  has_video?: boolean;
  is_active?: boolean;
  page_name?: string;
  video_url?: string | null;
  start_date?: number | string;
  // LinkedIn Ads (when populated)
  headline?: string;
  advertiser_url?: string;
  adLibraryUrl?: string;
  ad_library_url?: string;
}

export interface Scan {
  id: string;
  company_slug: string;
  domain: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  created_at: string;
  completed_at: string | null;
  company_name: string | null;
  company_size: string | null;
  revenue_range: string | null;
  domain_age_years: number | null;
  email_infra: string | null;
  logo_url: string | null;
  anthropic_verified: boolean;
  openai_verified: boolean;
  automation_score: number | null;
  automation_grade: string | null;
  top_gap_title: string | null;
  top_gap_summary: string | null;
  report_url: string | null;
  report_json: ReportJson | null;
  matched_offer?: 'content_system' | 'lead_magnets' | 'call_intelligence' | 'dtc_growth' | null;
}

export interface ProspectToken {
  token: string;
  company_name: string | null;
  company_domain: string | null;
  connection_name: string | null;
}

export interface WebhookResponse {
  success: boolean;
  company_slug: string;
  scan_id: string;
  is_cached: boolean;
  status: string;
}
