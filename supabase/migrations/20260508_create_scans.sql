-- supabase/migrations/20260508_create_scans.sql

CREATE TABLE IF NOT EXISTS scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_slug text UNIQUE NOT NULL,
  domain text NOT NULL,
  email text NOT NULL,
  source text NOT NULL DEFAULT 'inbound', -- 'inbound' | 'outreach'
  prospect_token text,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'complete' | 'error'
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,

  -- Company snapshot (populated by pipeline)
  company_name text,
  company_size text,
  revenue_range text,
  industry text,
  founded_year int,
  hq_location text,
  domain_age_years int,
  email_infra text, -- 'google_workspace' | 'microsoft_365' | 'other'
  logo_url text,

  -- AI adoption flags (from DNS TXT)
  anthropic_verified boolean DEFAULT false,
  openai_verified boolean DEFAULT false,

  -- Scores
  automation_score int,
  automation_grade text,

  -- Top gap (for CTA personalization)
  top_gap_title text,
  top_gap_summary text,

  -- Full report JSON (rendered by frontend)
  report_json jsonb,

  -- Raw source data (for debugging / re-analysis)
  raw_free_signals jsonb,
  raw_apollo jsonb,
  raw_tech_stack jsonb,
  raw_clutch jsonb,
  raw_linkedin jsonb,
  raw_ads jsonb,
  raw_search jsonb,

  -- Output refs
  report_url text,
  clickup_task_id text,
  email_sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS scans_domain_idx ON scans(domain);
CREATE INDEX IF NOT EXISTS scans_email_idx ON scans(email);
CREATE INDEX IF NOT EXISTS scans_status_idx ON scans(status);
CREATE INDEX IF NOT EXISTS scans_created_idx ON scans(created_at DESC);

-- Prospect tokens for outreach pre-fill (Plan 3)
CREATE TABLE IF NOT EXISTS scan_prospect_tokens (
  token text PRIMARY KEY,
  linkedin_profile_url text,
  company_name text,
  company_domain text,
  connection_name text,
  created_at timestamptz DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz DEFAULT (now() + INTERVAL '30 days')
);

-- Enable realtime on scans (frontend will subscribe)
ALTER PUBLICATION supabase_realtime ADD TABLE scans;
