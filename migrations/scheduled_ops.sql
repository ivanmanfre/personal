-- Scheduled Ops: unified catalog of every scheduled job + computed freshness/status.
-- Phase 1 covers n8n cron workflows; last-run is resolved from dashboard_workflow_stats.
-- n8n registry rows are auto-maintained by a trigger on dashboard_workflow_stats
-- (which the n8n "Dashboard Data Sync" workflow already writes hourly) — no workflow edit.
-- Phase 2 will add launchd / claude-code jobs via scheduled_run_log (view extended then).

-- ── Catalog table ──
CREATE TABLE IF NOT EXISTS scheduled_job_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text UNIQUE NOT NULL,                 -- 'n8n:<workflow_id>' | 'launchd:<label>' | 'cc:<routine>'
  source text NOT NULL DEFAULT 'n8n',           -- 'n8n' | 'launchd' | 'claude-code'
  label text NOT NULL,
  description text,                             -- human-curated; NEVER overwritten by the sync trigger
  category text NOT NULL DEFAULT 'Meta',         -- Content | Outreach | Brain-Memory | Recording | Meta
  schedule_human text,
  expected_interval_minutes int,                 -- NULL => no overdue eval (irregular / unparseable)
  grace_minutes int NOT NULL DEFAULT 15,        -- human-curated; NEVER overwritten by the sync trigger
  timezone text NOT NULL DEFAULT 'UTC',
  enabled boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sjr_source ON scheduled_job_registry(source);
CREATE INDEX IF NOT EXISTS idx_sjr_category ON scheduled_job_registry(category);

ALTER TABLE scheduled_job_registry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scheduled_job_registry_read ON scheduled_job_registry;
CREATE POLICY scheduled_job_registry_read ON scheduled_job_registry FOR SELECT USING (TRUE);
-- writes via service-role only (default deny)

COMMENT ON TABLE scheduled_job_registry IS 'Catalog of every scheduled job across sources. The declared-expectation half of missed-run detection. n8n rows auto-maintained by trigger on dashboard_workflow_stats.';

-- ── Best-effort interval derivation (cron 5/6-field OR human strings) ──
-- Returns the expected MAX gap between runs in minutes, or NULL if unparseable
-- (NULL => the status view will never flag OVERDUE — safe default, no false alarms).
CREATE OR REPLACE FUNCTION derive_interval_minutes(expr text)
RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  n int;
  unit text;
  parts text[];
  f_min text; f_hour text; f_dom text; f_month text; f_dow text;
BEGIN
  IF expr IS NULL OR btrim(expr) = '' OR expr ILIKE '%undefined%' THEN
    RETURN NULL;
  END IF;

  -- "Every N second(s)|minute(s)|hour(s)"
  IF expr ~* '^every\s+\d+\s+(second|minute|hour)' THEN
    n := (regexp_match(expr, '(\d+)'))[1]::int;
    unit := lower((regexp_match(expr, '(second|minute|hour)', 'i'))[1]);
    RETURN CASE unit
      WHEN 'second' THEN GREATEST(1, CEIL(n / 60.0))::int
      WHEN 'minute' THEN n
      WHEN 'hour'   THEN n * 60
    END;
  END IF;

  -- Human day/week/month labels
  IF expr ILIKE 'daily%'   THEN RETURN 1440;  END IF;
  IF expr ILIKE 'weekly%'  THEN RETURN 10080; END IF;
  IF expr ILIKE 'monthly%' THEN RETURN 43200; END IF;

  -- Cron (5 or 6 fields). Drop a leading seconds field if present.
  parts := regexp_split_to_array(btrim(expr), '\s+');
  IF array_length(parts, 1) = 6 THEN
    parts := parts[2:6];
  END IF;
  IF array_length(parts, 1) = 5 THEN
    f_min := parts[1]; f_hour := parts[2]; f_dom := parts[3]; f_month := parts[4]; f_dow := parts[5];
    IF f_dom <> '*' THEN RETURN 43200; END IF;          -- specific day-of-month => ~monthly
    IF f_dow <> '*' THEN RETURN 10080; END IF;          -- specific day-of-week  => ~weekly
    IF f_month <> '*' THEN RETURN NULL; END IF;         -- month-restricted: cadence not reliably derivable -> stay safe (no false OVERDUE)
    IF f_min ~ '^\*/\d+$' AND f_hour = '*' THEN          -- "*/N * * * *" => every N min
      RETURN (regexp_match(f_min, '(\d+)'))[1]::int;
    END IF;
    IF f_hour ~ '^\*/\d+$' THEN                          -- "* */N * * *" => every N hours
      RETURN (regexp_match(f_hour, '(\d+)'))[1]::int * 60;
    END IF;
    IF f_hour <> '*' THEN RETURN 1440; END IF;          -- specific hour, every day => daily
    IF f_min <> '*' THEN RETURN 60; END IF;             -- specific minute, every hour => hourly
    RETURN 1;                                            -- all wildcard => every minute
  END IF;

  RETURN NULL;  -- unparseable
END;
$$;

COMMENT ON FUNCTION derive_interval_minutes(text) IS 'Best-effort expected max-gap (minutes) between scheduled runs from a cron or human schedule string. Returns NULL for unparseable/ambiguous input so the status view never falsely flags OVERDUE.';

-- ── Trigger: keep n8n registry rows in sync with the stats table ──
-- Refreshes only DERIVED fields on conflict; preserves human-curated description/category/grace_minutes.
CREATE OR REPLACE FUNCTION sync_scheduled_registry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trigger_type = 'schedule' THEN
    INSERT INTO scheduled_job_registry
      (job_key, source, label, schedule_human, expected_interval_minutes, enabled, last_synced_at, updated_at)
    VALUES
      ('n8n:' || NEW.workflow_id, 'n8n', NEW.workflow_name, NEW.schedule_expression,
       derive_interval_minutes(NEW.schedule_expression),
       (COALESCE(NEW.is_active, false) AND NOT COALESCE(NEW.manually_paused, false)),
       now(), now())
    ON CONFLICT (job_key) DO UPDATE SET
      label = EXCLUDED.label,
      schedule_human = EXCLUDED.schedule_human,
      expected_interval_minutes = EXCLUDED.expected_interval_minutes,
      enabled = EXCLUDED.enabled,
      last_synced_at = now(),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_scheduled_registry ON dashboard_workflow_stats;
CREATE TRIGGER trg_sync_scheduled_registry
AFTER INSERT OR UPDATE ON dashboard_workflow_stats
FOR EACH ROW EXECUTE FUNCTION sync_scheduled_registry();

-- ── Computed status view (anon-readable). Phase 1: n8n source only. ──
CREATE OR REPLACE VIEW scheduled_ops_status AS
WITH base AS (
  SELECT
    r.id, r.job_key, r.source, r.label, r.description, r.category,
    r.schedule_human, r.expected_interval_minutes, r.grace_minutes,
    r.timezone, r.enabled, r.last_synced_at,
    ws.last_execution_at          AS last_run_at,
    ws.last_execution_status      AS last_status,
    COALESCE(ws.error_count_24h, 0)   AS error_count_24h,
    COALESCE(ws.success_count_24h, 0) AS success_count_24h,
    ws.last_error_message         AS last_error_message,
    ws.last_execution_duration_ms AS last_duration_ms
  FROM scheduled_job_registry r
  LEFT JOIN dashboard_workflow_stats ws
    ON r.source = 'n8n'
   AND ws.workflow_id = split_part(r.job_key, ':', 2)
)
SELECT
  base.*,
  CASE WHEN last_run_at IS NULL THEN NULL
       ELSE FLOOR(EXTRACT(EPOCH FROM (now() - last_run_at)) / 60)::int
  END AS minutes_since_last_run,
  CASE
    WHEN NOT enabled THEN 'DISABLED'
    WHEN last_status = 'error' OR error_count_24h > 0 THEN 'ERRORING'
    WHEN last_run_at IS NULL OR expected_interval_minutes IS NULL THEN 'UNKNOWN'
    WHEN EXTRACT(EPOCH FROM (now() - last_run_at)) / 60
         > (expected_interval_minutes + grace_minutes) THEN 'OVERDUE'
    ELSE 'OK'
  END AS status
FROM base;

COMMENT ON VIEW scheduled_ops_status IS 'Per-job computed status for the Scheduled Ops tab. Single source of OK/OVERDUE/ERRORING/DISABLED/UNKNOWN. Phase 1 = n8n only; extend base CTE with scheduled_run_log for non-n8n in Phase 2.';

-- ── One-time backfill from existing scheduled workflows ──
INSERT INTO scheduled_job_registry
  (job_key, source, label, schedule_human, expected_interval_minutes, enabled, last_synced_at, updated_at)
SELECT
  'n8n:' || workflow_id, 'n8n', workflow_name, schedule_expression,
  derive_interval_minutes(schedule_expression),
  (COALESCE(is_active, false) AND NOT COALESCE(manually_paused, false)),
  now(), now()
FROM dashboard_workflow_stats
WHERE trigger_type = 'schedule'
ON CONFLICT (job_key) DO UPDATE SET
  label = EXCLUDED.label,
  schedule_human = EXCLUDED.schedule_human,
  expected_interval_minutes = EXCLUDED.expected_interval_minutes,
  enabled = EXCLUDED.enabled,
  last_synced_at = now(),
  updated_at = now();
