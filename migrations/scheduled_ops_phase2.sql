-- Scheduled Ops Phase 2 — non-n8n sources (launchd + cron).
-- Adds scheduled_run_log (where local jobs report runs via the heartbeat wrapper),
-- extends scheduled_ops_status to resolve last-run/status from it for non-n8n sources,
-- and seeds the registry catalog for the 7 launchd + 2 cron periodic jobs on Ivan's Mac.
-- Laptop-local note: sub-hourly jobs are left interval=NULL (informational, no false
-- OVERDUE when the lid is closed); daily/weekly jobs get generous grace.

-- ── Run log (non-n8n jobs report here; n8n still uses dashboard_workflow_stats) ──
CREATE TABLE IF NOT EXISTS scheduled_run_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_key text NOT NULL,
  status text NOT NULL,                 -- 'success' | 'error'
  started_at timestamptz,
  finished_at timestamptz NOT NULL DEFAULT now(),
  exit_code int,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_srl_job_finished ON scheduled_run_log(job_key, finished_at DESC);

ALTER TABLE scheduled_run_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS scheduled_run_log_read ON scheduled_run_log;
CREATE POLICY scheduled_run_log_read ON scheduled_run_log FOR SELECT USING (TRUE);
-- inserts via service-role only (the heartbeat wrapper); default-deny for anon writes

COMMENT ON TABLE scheduled_run_log IS 'Run heartbeats for non-n8n scheduled jobs (launchd/cron), written by ~/.claude/lib/sched-heartbeat.sh. One row per completed run.';

-- ── Rebuild status view to fold in run-log data for non-n8n sources ──
CREATE OR REPLACE VIEW scheduled_ops_status AS
WITH runagg AS (
  SELECT job_key,
         max(finished_at) AS last_run_at,
         (array_agg(status ORDER BY finished_at DESC))[1] AS last_status,
         (count(*) FILTER (WHERE status = 'error'   AND finished_at > now() - interval '24 hours'))::int AS error_count_24h,
         (count(*) FILTER (WHERE status = 'success' AND finished_at > now() - interval '24 hours'))::int AS success_count_24h,
         (array_agg(detail ORDER BY finished_at DESC) FILTER (WHERE status = 'error'))[1] AS last_error_message
  FROM scheduled_run_log
  GROUP BY job_key
),
base AS (
  SELECT
    r.id, r.job_key, r.source, r.label, r.description, r.category,
    r.schedule_human, r.expected_interval_minutes, r.grace_minutes,
    r.timezone, r.enabled, r.last_synced_at,
    CASE WHEN r.source = 'n8n' THEN ws.last_execution_at        ELSE rl.last_run_at        END AS last_run_at,
    CASE WHEN r.source = 'n8n' THEN ws.last_execution_status    ELSE rl.last_status        END AS last_status,
    CASE WHEN r.source = 'n8n' THEN COALESCE(ws.error_count_24h, 0)   ELSE COALESCE(rl.error_count_24h, 0)   END AS error_count_24h,
    CASE WHEN r.source = 'n8n' THEN COALESCE(ws.success_count_24h, 0) ELSE COALESCE(rl.success_count_24h, 0) END AS success_count_24h,
    CASE WHEN r.source = 'n8n' THEN ws.last_error_message       ELSE rl.last_error_message END AS last_error_message,
    CASE WHEN r.source = 'n8n' THEN ws.last_execution_duration_ms ELSE NULL                END AS last_duration_ms
  FROM scheduled_job_registry r
  LEFT JOIN dashboard_workflow_stats ws
    ON r.source = 'n8n' AND ws.workflow_id = split_part(r.job_key, ':', 2)
  LEFT JOIN runagg rl
    ON r.source <> 'n8n' AND rl.job_key = r.job_key
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

COMMENT ON VIEW scheduled_ops_status IS 'Per-job computed status for the Scheduled Ops tab. n8n last-run from dashboard_workflow_stats; launchd/cron last-run from scheduled_run_log. Statuses: OK/OVERDUE/ERRORING/DISABLED/UNKNOWN.';

-- ── Catalog: seed the 7 launchd + 2 cron periodic jobs (declaration of record) ──
-- expected_interval_minutes = NULL => informational only (no OVERDUE) — used for sub-hourly
-- laptop-local jobs where a closed lid would otherwise spam false OVERDUE.
INSERT INTO scheduled_job_registry
  (job_key, source, label, description, category, schedule_human, expected_interval_minutes, grace_minutes, timezone, enabled)
VALUES
  ('launchd:claude-usage-sync',  'launchd', 'Claude Usage Sync',   'Syncs local Claude Code usage to Supabase',        'System', 'Every 15 min',        NULL,  15,   'local', true),
  ('launchd:session-jsonl-flush','launchd', 'Session JSONL Flush', 'Flushes session transcripts to disk',              'System', 'Every 5 min',         NULL,  15,   'local', true),
  ('launchd:oauth-sync',         'launchd', 'Railway OAuth Sync',  'Refreshes Railway Claude-proxy OAuth to Supabase', 'System', 'Every 4 hours',       240,   60,   'local', true),
  ('launchd:memory-compactor',   'launchd', 'Memory Compactor',    'Daily memory tier compaction/prune proposals',     'System', 'Daily 11:00 local',   1440,  180,  'local', true),
  ('launchd:skill-prune-pass',   'launchd', 'Skill Prune Pass',    'Weekly skill-draft prune pass',                    'System', 'Weekly Sun 11:00',    10080, 1440, 'local', true),
  ('launchd:tooling-updater',    'launchd', 'Tooling Updater',     'Weekly CLI/tooling auto-update',                   'System', 'Weekly Mon 09:00',    10080, 1440, 'local', true),
  ('launchd:upwork-cookie-refresh','launchd','Upwork Cookie Refresh','Refreshes Upwork session cookies (launchd)',     'Upwork', '4x/day (0/8/12/16/20)', 480, 120,  'local', true),
  ('cron:upwork-cookies',        'cron',    'Upwork Cookies (cron)','Cron refresh of Upwork cookies',                  'Upwork', 'Every 4 hours',       240,   120,  'local', true),
  ('cron:kill-orphan-mcp',       'cron',    'Kill Orphan MCP',     'Daily cleanup of orphaned MCP processes',          'System', 'Daily 06:00',         1440,  120,  'local', true)
ON CONFLICT (job_key) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  schedule_human = EXCLUDED.schedule_human,
  expected_interval_minutes = EXCLUDED.expected_interval_minutes,
  grace_minutes = EXCLUDED.grace_minutes,
  timezone = EXCLUDED.timezone,
  last_synced_at = now(),
  updated_at = now();
