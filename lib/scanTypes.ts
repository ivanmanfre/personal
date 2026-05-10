// lib/scanTypes.ts

export interface Opportunity {
  title: string;
  signal_source: string;
  evidence: string;
  estimated_weekly_hours: number;
  estimated_monthly_cost: number;
  automation_solution: string;
  roi_estimate: string;
}

export interface ReportJson {
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
  };
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
    tools: string[];
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
