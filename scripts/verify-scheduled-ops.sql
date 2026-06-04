BEGIN;

-- Registry rows covering every status branch
INSERT INTO scheduled_job_registry (job_key, source, label, category, expected_interval_minutes, grace_minutes, enabled) VALUES
  ('n8n:zztest-overdue',       'n8n', 'T Overdue',  'Meta', 60,   15, true),
  ('n8n:zztest-ok',            'n8n', 'T OK',       'Meta', 60,   15, true),
  ('n8n:zztest-interval_null', 'n8n', 'T IntNull',  'Meta', NULL, 15, true),
  ('n8n:zztest-neverrun',      'n8n', 'T NeverRun', 'Meta', 60,   15, true),
  ('n8n:zztest-disabled',      'n8n', 'T Disabled', 'Meta', 60,   15, false),
  ('n8n:zztest-erroring',      'n8n', 'T Erroring', 'Meta', 60,   15, true);

-- Matching last-run data (only workflow_id + workflow_name are required NOT NULL)
INSERT INTO dashboard_workflow_stats (workflow_id, workflow_name, is_active, last_execution_at, last_execution_status, error_count_24h, success_count_24h) VALUES
  ('zztest-overdue',       'T Overdue',  true, now() - interval '200 minutes', 'success', 0, 3),
  ('zztest-ok',            'T OK',       true, now() - interval '10 minutes',  'success', 0, 5),
  ('zztest-interval_null', 'T IntNull',  true, now() - interval '10 minutes',  'success', 0, 5),
  ('zztest-erroring',      'T Erroring', true, now() - interval '5 minutes',   'error',   2, 0);

SELECT job_key, status
FROM scheduled_ops_status
WHERE job_key LIKE 'n8n:zztest-%'
ORDER BY job_key;

ROLLBACK;
