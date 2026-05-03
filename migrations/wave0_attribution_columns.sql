-- Wave 0 / P30-1: Source-attribution columns on revenue-side tables.
-- Adds source/referrer_email/referral_token + utm_* columns to paid_assessments
-- and calendar_events. lm_events already has utm jsonb; we add explicit columns
-- to match the convention so dashboard joins work without jsonb digging.
--
-- Paired with: stripe-webhook + calendly-webhook edge functions (modified to
-- write these columns), lib/utmCapture.ts (frontend capture into sessionStorage).

-- ---------- paid_assessments ----------
ALTER TABLE paid_assessments
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS referrer_email TEXT,
  ADD COLUMN IF NOT EXISTS referral_token TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT;

CREATE INDEX IF NOT EXISTS idx_paid_assessments_utm_source ON paid_assessments(utm_source);
CREATE INDEX IF NOT EXISTS idx_paid_assessments_referral_token ON paid_assessments(referral_token);

COMMENT ON COLUMN paid_assessments.source IS 'High-level source bucket (linkedin|outreach|nurture|referral|direct|google|...). Computed from utm_source or fallback heuristic.';
COMMENT ON COLUMN paid_assessments.referral_token IS 'Optional ?ref=<token> param captured at landing; identifies referring partner/client.';
COMMENT ON COLUMN paid_assessments.referrer_email IS 'Email of referrer (looked up from referral_token at write time, or filled manually).';

-- ---------- calendar_events ----------
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS referrer_email TEXT,
  ADD COLUMN IF NOT EXISTS referral_token TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS booking_source_path TEXT;

CREATE INDEX IF NOT EXISTS idx_calendar_events_utm_source ON calendar_events(utm_source);

COMMENT ON COLUMN calendar_events.booking_source_path IS 'Site path (e.g. /assessment) the visitor was on when they opened the Calendly link, captured via prefill query param.';

-- ---------- lm_events ----------
-- lm_events already has a `utm` jsonb column. Add explicit utm_* columns so
-- the join surface is uniform. We DO NOT delete the jsonb column (legacy).
ALTER TABLE lm_events
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS referral_token TEXT;

CREATE INDEX IF NOT EXISTS idx_lm_events_utm_source ON lm_events(utm_source);

-- Backfill explicit utm_* from existing jsonb on lm_events (best-effort).
UPDATE lm_events
   SET utm_source   = COALESCE(utm_source,   utm->>'utm_source'),
       utm_medium   = COALESCE(utm_medium,   utm->>'utm_medium'),
       utm_campaign = COALESCE(utm_campaign, utm->>'utm_campaign'),
       utm_term     = COALESCE(utm_term,     utm->>'utm_term'),
       utm_content  = COALESCE(utm_content,  utm->>'utm_content')
 WHERE utm IS NOT NULL;
