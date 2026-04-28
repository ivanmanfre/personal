-- Sales scripts (canonical source of truth for both dashboard + Meeting Coach app).
-- One active row per meeting_type. Coach app reads on session start.
-- Streamer/processor reads `phases` jsonb to compute live phase coverage.

CREATE TABLE IF NOT EXISTS sales_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  meeting_type TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  content_md TEXT NOT NULL,
  phases JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active script per meeting_type at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_scripts_active_per_type
  ON sales_scripts(meeting_type)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_sales_scripts_name ON sales_scripts(name);

CREATE OR REPLACE FUNCTION touch_sales_scripts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_scripts_updated_at ON sales_scripts;
CREATE TRIGGER trg_sales_scripts_updated_at
  BEFORE UPDATE ON sales_scripts
  FOR EACH ROW EXECUTE FUNCTION touch_sales_scripts_updated_at();

COMMENT ON TABLE sales_scripts IS 'Canonical sales/coaching scripts. Read by dashboard MeetingsPanel and Meeting Coach app.';
COMMENT ON COLUMN sales_scripts.meeting_type IS 'discovery_sales | technical_audit | client_kickoff | internal';
COMMENT ON COLUMN sales_scripts.phases IS 'Structured phase array used by streamer to compute live coverage. Each phase has id, name, order, duration_target_seconds, must_hits[].';

-- Add meeting_type to existing tables so coach can resolve mode per meeting.
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS meeting_type TEXT;
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS meeting_type TEXT;
ALTER TABLE transcripts ADD COLUMN IF NOT EXISTS phase_coverage JSONB;

CREATE INDEX IF NOT EXISTS idx_calendar_events_meeting_type ON calendar_events(meeting_type);
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_type ON transcripts(meeting_type);

COMMENT ON COLUMN calendar_events.meeting_type IS 'Resolved meeting type. Set manually in dashboard or by keyword/LLM resolver. NULL = unresolved.';
COMMENT ON COLUMN transcripts.meeting_type IS 'Final meeting type used during the call (may differ from calendar if user toggled mid-call).';
COMMENT ON COLUMN transcripts.phase_coverage IS 'Post-call report: which must-hits were covered. {phase_id: {must_hit_id: bool}}.';
