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
  };
  ads_summary: {
    google_ads: 'confirmed' | 'probable' | 'not_detected' | null;
    linkedin_ads: boolean | null;
    meta_ads: boolean | null;
  };
  competitors: Array<{ title: string; url: string; description: string }>;
  github: { repos: number } | null;
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
