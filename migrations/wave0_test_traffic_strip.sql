-- Wave 0 / P30-3: Strip test traffic from analytics surfaces.
--
-- Adds is_test boolean to every revenue/funnel-touching table so dashboard
-- queries can default-filter test data. Backfills existing rows by email
-- pattern matching: anthropic.com, ivanmanfredi.com, test*, kit-test*,
-- nurture-test*, e2e*, walkthrough.example, plus src-tagged test data on
-- lm_events.
--
-- Dashboard / aggregate views are updated alongside to bake `WHERE is_test=false`
-- into every default panel. The `is_test=true` rows stay in the raw tables for
-- audit / replay; only views filter them out.

-- ---------- columns ----------
ALTER TABLE pageviews ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE lm_events ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE free_diagnostics ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE assessment_results ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE paid_assessments ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE nurture_subscribers ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_pageviews_is_test ON pageviews(is_test) WHERE is_test = FALSE;
CREATE INDEX IF NOT EXISTS idx_lm_events_is_test ON lm_events(is_test) WHERE is_test = FALSE;
CREATE INDEX IF NOT EXISTS idx_free_diagnostics_is_test ON free_diagnostics(is_test) WHERE is_test = FALSE;
CREATE INDEX IF NOT EXISTS idx_assessment_results_is_test ON assessment_results(is_test) WHERE is_test = FALSE;
CREATE INDEX IF NOT EXISTS idx_paid_assessments_is_test ON paid_assessments(is_test) WHERE is_test = FALSE;
CREATE INDEX IF NOT EXISTS idx_calendar_events_is_test ON calendar_events(is_test) WHERE is_test = FALSE;
CREATE INDEX IF NOT EXISTS idx_nurture_subscribers_is_test ON nurture_subscribers(is_test) WHERE is_test = FALSE;

-- ---------- backfill (safe, idempotent) ----------
-- Email-based heuristics. Pattern is: anthropic.com, ivanmanfredi.com domains,
-- common test prefixes, e2e, and the walkthrough sentinel.
UPDATE lm_events
   SET is_test = TRUE
 WHERE is_test = FALSE AND (
   email ILIKE '%@anthropic.com'
   OR email ILIKE '%@ivanmanfredi.com'
   OR email ILIKE 'test%'
   OR email ILIKE 'kit-test%'
   OR email ILIKE 'nurture-test%'
   OR email ILIKE 'e2e%'
   OR email ILIKE '%walkthrough.example'
   OR src IN ('e2e','self-test','pipeline-test','playwright')
 );

UPDATE free_diagnostics
   SET is_test = TRUE
 WHERE is_test = FALSE AND (
   email ILIKE '%@anthropic.com'
   OR email ILIKE '%@ivanmanfredi.com'
   OR email ILIKE 'test%'
   OR email ILIKE 'kit-test%'
   OR email ILIKE 'nurture-test%'
   OR email ILIKE 'e2e%'
   OR email ILIKE '%walkthrough.example'
 );

UPDATE assessment_results
   SET is_test = TRUE
 WHERE is_test = FALSE AND (
   email ILIKE '%@anthropic.com'
   OR email ILIKE '%@ivanmanfredi.com'
   OR email ILIKE 'test%'
   OR email ILIKE 'kit-test%'
   OR email ILIKE 'e2e%'
   OR email ILIKE '%walkthrough.example'
 );

UPDATE paid_assessments
   SET is_test = TRUE
 WHERE is_test = FALSE AND (
   email ILIKE '%@anthropic.com'
   OR email ILIKE '%@ivanmanfredi.com'
   OR email ILIKE 'test%'
   OR email ILIKE 'e2e%'
 );

UPDATE calendar_events
   SET is_test = TRUE
 WHERE is_test = FALSE AND EXISTS (
   SELECT 1 FROM unnest(attendees) AS a
    WHERE a ILIKE '%@anthropic.com' OR a ILIKE 'test%' OR a ILIKE 'e2e%'
 );

UPDATE nurture_subscribers
   SET is_test = TRUE
 WHERE is_test = FALSE AND (
   email ILIKE '%@anthropic.com'
   OR email ILIKE '%@ivanmanfredi.com'
   OR email ILIKE 'test%'
   OR email ILIKE 'nurture-test%'
   OR email ILIKE 'e2e%'
 );

-- pageviews has no email; mark as test only if user_agent obviously synthetic
-- and we can detect known internal flag (utm_source='wave0-smoke' is the test
-- ping). Don't over-mark — better to under-filter and use is_test for known-bad.
UPDATE pageviews
   SET is_test = TRUE
 WHERE is_test = FALSE AND (
   utm_campaign IN ('wave0-smoke','e2e','self-test','pipeline-test')
   OR user_agent ILIKE '%HeadlessChrome%'
   OR user_agent ILIKE '%Playwright%'
 );

-- ---------- views (rebuilt with is_test + same-host filters) ----------
-- pageviews aggregate views: filter is_test AND collapse self-host referrer to (direct).
DROP VIEW IF EXISTS pageviews_top_referrers;
CREATE VIEW pageviews_top_referrers AS
SELECT
  CASE
    WHEN referrer_host IS NULL OR referrer_host IN ('ivanmanfredi.com','www.ivanmanfredi.com','resources.ivanmanfredi.com')
      THEN '(direct)'
    ELSE referrer_host
  END AS referrer_host,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS visitors
FROM pageviews
WHERE path NOT LIKE '/dashboard%' AND path NOT LIKE '/v/%'
  AND ts >= NOW() - INTERVAL '30 days'
  AND is_test = FALSE
GROUP BY 1
ORDER BY views DESC;

DROP VIEW IF EXISTS pageviews_daily;
CREATE VIEW pageviews_daily AS
SELECT
  date_trunc('day', ts)::date AS day,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS visitors
FROM pageviews
WHERE path NOT LIKE '/dashboard%' AND path NOT LIKE '/v/%'
  AND is_test = FALSE
GROUP BY 1
ORDER BY 1 DESC;

DROP VIEW IF EXISTS pageviews_top_paths;
CREATE VIEW pageviews_top_paths AS
SELECT
  path,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS visitors
FROM pageviews
WHERE path NOT LIKE '/dashboard%' AND path NOT LIKE '/v/%'
  AND ts >= NOW() - INTERVAL '30 days'
  AND is_test = FALSE
GROUP BY 1
ORDER BY views DESC;

DROP VIEW IF EXISTS pageviews_top_utm;
CREATE VIEW pageviews_top_utm AS
SELECT
  utm_source, utm_medium, utm_campaign,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS visitors
FROM pageviews
WHERE path NOT LIKE '/dashboard%' AND path NOT LIKE '/v/%'
  AND ts >= NOW() - INTERVAL '30 days'
  AND utm_source IS NOT NULL
  AND is_test = FALSE
GROUP BY 1, 2, 3
ORDER BY views DESC;

DROP VIEW IF EXISTS pageviews_device_split;
CREATE VIEW pageviews_device_split AS
SELECT
  COALESCE(device_type, 'unknown') AS device_type,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS visitors
FROM pageviews
WHERE path NOT LIKE '/dashboard%' AND path NOT LIKE '/v/%'
  AND ts >= NOW() - INTERVAL '30 days'
  AND is_test = FALSE
GROUP BY 1
ORDER BY views DESC;

GRANT SELECT ON pageviews_daily TO anon, authenticated;
GRANT SELECT ON pageviews_top_paths TO anon, authenticated;
GRANT SELECT ON pageviews_top_referrers TO anon, authenticated;
GRANT SELECT ON pageviews_top_utm TO anon, authenticated;
GRANT SELECT ON pageviews_device_split TO anon, authenticated;
