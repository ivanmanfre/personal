-- Pageview tracking for ivanmanfredi.com.
-- One row per page view (initial load + React Router route change).
-- Written from the browser using the anon key via RLS INSERT policy.
-- Read by the dashboard Audience panel via the aggregate views below.

CREATE TABLE IF NOT EXISTS pageviews (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer_host TEXT,
  referrer_full TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  user_agent TEXT,
  device_type TEXT,
  language TEXT,
  screen_w INT,
  screen_h INT,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Input sanity: clamp pathological strings.
  CONSTRAINT pageviews_session_id_len CHECK (char_length(session_id) BETWEEN 1 AND 64),
  CONSTRAINT pageviews_path_len CHECK (char_length(path) BETWEEN 1 AND 512),
  CONSTRAINT pageviews_referrer_host_len CHECK (referrer_host IS NULL OR char_length(referrer_host) <= 253),
  CONSTRAINT pageviews_referrer_full_len CHECK (referrer_full IS NULL OR char_length(referrer_full) <= 2048),
  CONSTRAINT pageviews_utm_source_len CHECK (utm_source IS NULL OR char_length(utm_source) <= 128),
  CONSTRAINT pageviews_utm_medium_len CHECK (utm_medium IS NULL OR char_length(utm_medium) <= 128),
  CONSTRAINT pageviews_utm_campaign_len CHECK (utm_campaign IS NULL OR char_length(utm_campaign) <= 128),
  CONSTRAINT pageviews_utm_content_len CHECK (utm_content IS NULL OR char_length(utm_content) <= 128),
  CONSTRAINT pageviews_user_agent_len CHECK (user_agent IS NULL OR char_length(user_agent) <= 512),
  CONSTRAINT pageviews_device_type_val CHECK (device_type IS NULL OR device_type IN ('desktop','mobile','tablet')),
  CONSTRAINT pageviews_language_len CHECK (language IS NULL OR char_length(language) <= 35)
);

CREATE INDEX IF NOT EXISTS idx_pageviews_ts ON pageviews(ts DESC);
CREATE INDEX IF NOT EXISTS idx_pageviews_session ON pageviews(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_pageviews_path ON pageviews(path);
CREATE INDEX IF NOT EXISTS idx_pageviews_referrer_host ON pageviews(referrer_host);
CREATE INDEX IF NOT EXISTS idx_pageviews_utm_source ON pageviews(utm_source);

ALTER TABLE pageviews ENABLE ROW LEVEL SECURITY;

-- Public can INSERT their own pageview. Check constraints above + column shape
-- stop malicious payloads; nothing here is sensitive on its own.
DROP POLICY IF EXISTS pageviews_anon_insert ON pageviews;
CREATE POLICY pageviews_anon_insert ON pageviews
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Public can SELECT. The data is not sensitive (aggregate traffic) and the
-- dashboard reads with the anon key like every other panel.
DROP POLICY IF EXISTS pageviews_anon_select ON pageviews;
CREATE POLICY pageviews_anon_select ON pageviews
  FOR SELECT TO anon, authenticated
  USING (true);

-- Aggregate view: one row per day with total views and unique sessions.
-- Excludes /dashboard/* and /v/* which are private surfaces.
CREATE OR REPLACE VIEW pageviews_daily AS
SELECT
  date_trunc('day', ts)::date AS day,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS visitors
FROM pageviews
WHERE path NOT LIKE '/dashboard%' AND path NOT LIKE '/v/%'
GROUP BY 1
ORDER BY 1 DESC;

-- Aggregate view: top pages in the last 30 days.
CREATE OR REPLACE VIEW pageviews_top_paths AS
SELECT
  path,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS visitors
FROM pageviews
WHERE path NOT LIKE '/dashboard%' AND path NOT LIKE '/v/%'
  AND ts >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY views DESC;

-- Aggregate view: top referrer hosts in the last 30 days.
CREATE OR REPLACE VIEW pageviews_top_referrers AS
SELECT
  COALESCE(referrer_host, '(direct)') AS referrer_host,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS visitors
FROM pageviews
WHERE path NOT LIKE '/dashboard%' AND path NOT LIKE '/v/%'
  AND ts >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY views DESC;

-- Aggregate view: top UTM sources in the last 30 days (null excluded).
CREATE OR REPLACE VIEW pageviews_top_utm AS
SELECT
  utm_source,
  utm_medium,
  utm_campaign,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS visitors
FROM pageviews
WHERE path NOT LIKE '/dashboard%' AND path NOT LIKE '/v/%'
  AND ts >= NOW() - INTERVAL '30 days'
  AND utm_source IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY views DESC;

-- Aggregate view: device split in the last 30 days.
CREATE OR REPLACE VIEW pageviews_device_split AS
SELECT
  COALESCE(device_type, 'unknown') AS device_type,
  COUNT(*) AS views,
  COUNT(DISTINCT session_id) AS visitors
FROM pageviews
WHERE path NOT LIKE '/dashboard%' AND path NOT LIKE '/v/%'
  AND ts >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY views DESC;

GRANT SELECT ON pageviews_daily TO anon, authenticated;
GRANT SELECT ON pageviews_top_paths TO anon, authenticated;
GRANT SELECT ON pageviews_top_referrers TO anon, authenticated;
GRANT SELECT ON pageviews_top_utm TO anon, authenticated;
GRANT SELECT ON pageviews_device_split TO anon, authenticated;

COMMENT ON TABLE pageviews IS 'Raw pageview events from ivanmanfredi.com. One row per navigation. Written from browser; read by dashboard Audience panel.';
COMMENT ON COLUMN pageviews.session_id IS 'Short random id kept in sessionStorage for this tab. No cross-session identity.';
COMMENT ON COLUMN pageviews.referrer_host IS 'Hostname of document.referrer, or null for direct/unknown.';
COMMENT ON COLUMN pageviews.device_type IS 'desktop | mobile | tablet, detected client-side from user agent.';
