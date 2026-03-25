-- Auto Research System Tables
-- Run this in Supabase SQL Editor

-- Sessions: each research target (e.g., "Post Hook Quality")
CREATE TABLE IF NOT EXISTS auto_research_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  target_type text NOT NULL CHECK (target_type IN ('prompt', 'workflow_config', 'parameter')),
  target_ref text NOT NULL,
  workflow_id text,
  prompt_page_id text,
  metric_name text NOT NULL,
  metric_unit text DEFAULT '',
  metric_direction text NOT NULL DEFAULT 'higher_is_better' CHECK (metric_direction IN ('lower_is_better', 'higher_is_better')),
  baseline_value numeric,
  current_best_value numeric,
  improvement_pct numeric GENERATED ALWAYS AS (
    CASE WHEN baseline_value IS NOT NULL AND baseline_value != 0 AND current_best_value IS NOT NULL
      THEN ROUND(((current_best_value - baseline_value) / ABS(baseline_value)) * 100, 1)
      ELSE NULL
    END
  ) STORED,
  total_runs integer DEFAULT 0,
  kept_runs integer DEFAULT 0,
  status text DEFAULT 'idle' CHECK (status IN ('idle', 'running', 'paused', 'completed', 'failed')),
  category text DEFAULT 'content' CHECK (category IN ('content', 'outreach', 'operations')),
  config jsonb DEFAULT '{}',
  last_run_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Iterations: each individual run within a session
CREATE TABLE IF NOT EXISTS auto_research_iterations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES auto_research_sessions(id) ON DELETE CASCADE,
  run_number integer NOT NULL,
  change_description text NOT NULL,
  metric_before numeric,
  metric_after numeric,
  improvement_pct numeric GENERATED ALWAYS AS (
    CASE WHEN metric_before IS NOT NULL AND metric_before != 0 AND metric_after IS NOT NULL
      THEN ROUND(((metric_after - metric_before) / ABS(metric_before)) * 100, 1)
      ELSE NULL
    END
  ) STORED,
  kept boolean DEFAULT false,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ar_iterations_session ON auto_research_iterations(session_id, run_number);
CREATE INDEX IF NOT EXISTS idx_ar_sessions_status ON auto_research_sessions(status);

-- RLS
ALTER TABLE auto_research_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_research_iterations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON auto_research_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON auto_research_iterations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_select" ON auto_research_sessions FOR SELECT USING (true);
CREATE POLICY "anon_select" ON auto_research_iterations FOR SELECT USING (true);

-- Seed: Tier 1 + Tier 2 research sessions
INSERT INTO auto_research_sessions (name, description, target_type, target_ref, workflow_id, prompt_page_id, metric_name, metric_unit, metric_direction, status, category) VALUES
  -- Tier 1: Post Generation
  ('Post Hook Quality', 'Optimize hook generation prompt for engagement', 'prompt', 'Hook Generation', 'dk498RKEZME1MjDX', '2ky5ezad-1093', 'Quality Score', 'score', 'higher_is_better', 'idle', 'content'),
  ('Post Body Quality', 'Optimize post generation prompt for clarity and value', 'prompt', 'Post Generation', 'dk498RKEZME1MjDX', '2ky5ezad-1113', 'Quality Score', 'score', 'higher_is_better', 'idle', 'content'),
  ('Post QA Accuracy', 'Optimize QA/Editor prompt to catch more issues', 'prompt', 'QA/Editor', 'dk498RKEZME1MjDX', '2ky5ezad-1133', 'QA Catch Rate', '%', 'higher_is_better', 'idle', 'content'),
  -- Tier 1: Content Strategy
  ('Content Strategy Scoring', 'Optimize weekly planning prompt for better topic selection', 'prompt', 'Content Strategy Scoring', 'nfDkl0LK6GVHklYK', '2ky5ezad-1733', 'Plan Quality Score', 'score', 'higher_is_better', 'idle', 'content'),
  -- Tier 1: Carousel Styles
  ('Carousel — Educational', 'Optimize educational breakdown carousel style', 'prompt', 'Style: Educational Breakdown', '0zD6WZRBD7FnaAhw', '2ky5ezad-1293', 'Slide Quality', 'score', 'higher_is_better', 'idle', 'content'),
  ('Carousel — Step-by-Step', 'Optimize step-by-step carousel style', 'prompt', 'Style: Step-by-Step', '0zD6WZRBD7FnaAhw', '2ky5ezad-1313', 'Slide Quality', 'score', 'higher_is_better', 'idle', 'content'),
  ('Carousel — Myth-Busting', 'Optimize myth-busting carousel style', 'prompt', 'Style: Myth-Busting', '0zD6WZRBD7FnaAhw', '2ky5ezad-1333', 'Slide Quality', 'score', 'higher_is_better', 'idle', 'content'),
  ('Carousel — Framework', 'Optimize framework walkthrough carousel style', 'prompt', 'Style: Framework Walkthrough', '0zD6WZRBD7FnaAhw', '2ky5ezad-1393', 'Slide Quality', 'score', 'higher_is_better', 'idle', 'content'),
  -- Tier 2: Outreach
  ('Outreach Comment Quality', 'Optimize warmup comment prompt for naturalness', 'prompt', 'Outreach Comment', 'kr2lSH1eRGZcDWmO', '2ky5ezad-2073', 'Naturalness Score', 'score', 'higher_is_better', 'idle', 'outreach'),
  ('Outreach DM Step 1', 'Optimize first DM for reply rate', 'prompt', 'Outreach DM Step 1', 'joU7VaM5OiRAwLwP', '2ky5ezad-2093', 'Reply Likelihood', 'score', 'higher_is_better', 'idle', 'outreach'),
  ('Outreach DM Step 2', 'Optimize follow-up DM for conversation continuation', 'prompt', 'Outreach DM Step 2', 'joU7VaM5OiRAwLwP', '2ky5ezad-2113', 'Reply Likelihood', 'score', 'higher_is_better', 'idle', 'outreach')
ON CONFLICT DO NOTHING;
