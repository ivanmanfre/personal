-- Client Auto-Fix Engineer: Schema Changes
-- Run this in Supabase SQL Editor

-- 1. Add fix columns to client_workflow_errors
ALTER TABLE client_workflow_errors
  ADD COLUMN IF NOT EXISTS fix_status text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fix_analysis text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fix_description text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fix_applied_at timestamptz DEFAULT NULL;

-- 2. Add auto-fix toggle to integration_config
INSERT INTO integration_config (key, value)
VALUES ('client_autofix_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- 3. Update dashboard_action RPC: add fix_status to client_workflow_errors allowlist
CREATE OR REPLACE FUNCTION dashboard_action(p_table text, p_id text, p_field text, p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT (
    (p_table = 'leads' AND p_field IN ('status', 'icp_score'))
    OR (p_table = 'client_instances' AND p_field IN ('is_active'))
    OR (p_table = 'client_workflow_errors' AND p_field IN ('is_resolved', 'fix_status'))
    OR (p_table = 'n8nclaw_proactive_alerts' AND p_field IN ('sent'))
    OR (p_table = 'n8nclaw_reminders' AND p_field IN ('status'))
    OR (p_table = 'competitor_posts' AND p_field IN ('opportunity_actioned'))
    OR (p_table = 'dashboard_tasks' AND p_field IN ('status'))
    OR (p_table = 'dashboard_workflow_stats' AND p_field IN ('error_acknowledged'))
    OR (p_table = 'upwork_jobs' AND p_field IN ('status'))
    OR (p_table = 'upwork_proposals' AND p_field IN ('status', 'cover_letter', 'proposal_text'))
    OR (p_table = 'health_medications' AND p_field IN ('is_active', 'notes', 'dosage', 'frequency', 'schedule_time'))
    OR (p_table = 'health_inventory' AND p_field IN ('quantity', 'low_stock_threshold', 'is_active', 'notes'))
    OR (p_table = 'health_training_schedule' AND p_field IN ('is_active'))
    OR (p_table = 'outreach_prospects' AND p_field IN ('stage', 'icp_score', 'notes', 'skip_reason', 'needs_manual_reply', 'blacklisted', 'next_touch_after'))
    OR (p_table = 'outreach_campaigns' AND p_field IN ('is_active', 'name', 'description', 'warmup_days', 'max_prospects'))
    OR (p_table = 'auto_research_sessions' AND p_field IN ('status', 'name', 'description'))
    OR (p_table = 'client_monitored_workflows' AND p_field IN ('notifications_enabled'))
  ) THEN
    RAISE EXCEPTION 'Action not allowed: %.%', p_table, p_field;
  END IF;

  IF p_table = 'n8nclaw_reminders' THEN
    EXECUTE format('UPDATE %I SET %I = $1, updated_at = now() WHERE id = $2', p_table, p_field)
    USING p_value, p_id::integer;
  ELSE
    EXECUTE format('UPDATE %I SET %I = $1, updated_at = now() WHERE id = $2', p_table, p_field)
    USING p_value, p_id::uuid;
  END IF;
END;
$$;
