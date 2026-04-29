-- Captures free Agent-Ready Scorecard submissions from /scorecard.
-- Score is recorded immediately on submit; email is optional (post-score gate).
-- Paired with: supabase/functions/scorecard-submit/index.ts

CREATE TABLE IF NOT EXISTS free_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  scores JSONB NOT NULL,
  total INT NOT NULL,
  verdict TEXT NOT NULL,
  referrer TEXT,
  utm JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_free_diagnostics_email ON free_diagnostics(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_free_diagnostics_created_at ON free_diagnostics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_free_diagnostics_verdict ON free_diagnostics(verdict);

COMMENT ON TABLE free_diagnostics IS 'Free Agent-Ready Scorecard submissions. Email optional (post-score gate).';
COMMENT ON COLUMN free_diagnostics.scores IS 'Per-precondition scores: {structured_input, decision_logic, narrow_scope, human_loop} each 1-5.';
COMMENT ON COLUMN free_diagnostics.verdict IS 'agent_ready | close | foundation';
COMMENT ON COLUMN free_diagnostics.utm IS 'utm_source/medium/campaign/term/content extracted from URL params.';
