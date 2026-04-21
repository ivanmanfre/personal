-- Stores intake questionnaire responses for the Agent-Ready Assessment.
-- One row per paid Stripe session. Starts in 'in_progress' and flips to
-- 'submitted' when the buyer clicks submit.
-- Paired with: supabase/functions/assessment-intake/index.ts

CREATE TABLE IF NOT EXISTS assessment_intakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT UNIQUE NOT NULL REFERENCES paid_assessments(stripe_session_id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_intakes_status ON assessment_intakes(status);
CREATE INDEX IF NOT EXISTS idx_assessment_intakes_submitted ON assessment_intakes(submitted_at DESC);

CREATE OR REPLACE FUNCTION touch_assessment_intakes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assessment_intakes_updated_at ON assessment_intakes;
CREATE TRIGGER trg_assessment_intakes_updated_at
  BEFORE UPDATE ON assessment_intakes
  FOR EACH ROW
  EXECUTE FUNCTION touch_assessment_intakes_updated_at();

COMMENT ON TABLE assessment_intakes IS 'Agent-Ready Assessment intake questionnaire responses. Keyed by Stripe session.';
COMMENT ON COLUMN assessment_intakes.status IS 'in_progress | submitted';
COMMENT ON COLUMN assessment_intakes.answers IS 'Jsonb map of question_id -> value. Auto-saved as buyer fills the form.';
