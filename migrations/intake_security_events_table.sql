-- Security event log for the conversational Blueprint intake.
-- Captures rate-limit hits, prompt-injection attempts, canary detections,
-- IP changes, and origin mismatches. Read by a daily digest job.

CREATE TABLE IF NOT EXISTS intake_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
    -- 'rate_limit' | 'injection_regex' | 'canary' | 'ip_change' |
    -- 'origin_mismatch' | 'nonce_mismatch' | 'length_exceeded' |
    -- 'turn_cap' | 'token_cap' | 'session_locked'
  severity TEXT NOT NULL,
    -- 'info' | 'warn' | 'critical'
  payload JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intake_sec_session
  ON intake_security_events(session_id);

CREATE INDEX IF NOT EXISTS idx_intake_sec_severity_time
  ON intake_security_events(severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_intake_sec_type_time
  ON intake_security_events(event_type, created_at DESC);

COMMENT ON TABLE intake_security_events IS
  'Security event log for assessment-intake-chat edge function. Read by daily digest.';

-- Additive columns on assessment_intakes for chat session tracking
ALTER TABLE assessment_intakes
  ADD COLUMN IF NOT EXISTS token_usage JSONB DEFAULT '{}'::jsonb;
ALTER TABLE assessment_intakes
  ADD COLUMN IF NOT EXISTS turn_count INT NOT NULL DEFAULT 0;
ALTER TABLE assessment_intakes
  ADD COLUMN IF NOT EXISTS first_seen_ip TEXT;
ALTER TABLE assessment_intakes
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE assessment_intakes
  ADD COLUMN IF NOT EXISTS lock_reason TEXT;
ALTER TABLE assessment_intakes
  ADD COLUMN IF NOT EXISTS chat_history JSONB DEFAULT '[]'::jsonb;
  -- chat_history = [{role:"user"|"assistant", content:string, ts:iso}, ...]

COMMENT ON COLUMN assessment_intakes.token_usage IS
  '{input: int, output: int, cache_read: int} cumulative across turns';
COMMENT ON COLUMN assessment_intakes.turn_count IS
  'Number of user messages sent in this session (cap 30)';
COMMENT ON COLUMN assessment_intakes.first_seen_ip IS
  'IP captured on first chat request. Subsequent IPs trigger ip_change events.';
COMMENT ON COLUMN assessment_intakes.locked_at IS
  'Set when session locked due to security violation. Frontend shows "contact us".';
COMMENT ON COLUMN assessment_intakes.chat_history IS
  'Append-only chat log for resume + audit.';

-- RLS for the new security table — service-role only writes, anon read own session
ALTER TABLE intake_security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_intake_security_events" ON intake_security_events;
CREATE POLICY "service_role_full_intake_security_events" ON intake_security_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No anon access to security events — only the edge function (service role) writes them
