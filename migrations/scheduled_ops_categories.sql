-- Scheduled Ops — category auto-derivation.
-- Phase 1 left every n8n job in the default 'Meta' category (category is human-curated and
-- the sync trigger never set it), so the "Group: category" view was one big bucket.
-- This adds derive_category(label) and wires it into the sync trigger + backfill so jobs
-- auto-bucket into the dashboard's existing pipeline vocabulary. Human edits are preserved:
-- the trigger only fills category when it's still 'Meta'.

-- ── Keyword → category (first-match-wins; specific before generic) ──
CREATE OR REPLACE FUNCTION derive_category(label text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN label IS NULL THEN 'Meta'
    -- test / scratch / junk
    WHEN label ILIKE 'TEMP%' OR label ILIKE 'TEST%'
      OR label IN ('jamie', 'Destino Farm Initial') THEN 'Meta'
    -- autofix system
    WHEN label ILIKE '%Auto-Fix%' OR label ILIKE 'Stuck Generation%' THEN 'Auto-Fix'
    -- lead magnets (LM Curator family, LM Walkthrough, Lead Magnet workers)
    WHEN label ILIKE 'LM %' OR label ILIKE 'Lead Magnet%' THEN 'Lead Magnets'
    -- outreach / commenting / lead pipeline
    WHEN label ILIKE 'Outreach%' OR label ILIKE '%Engagement Pull%'
      OR label ILIKE 'Comment %' OR label ILIKE 'Comment-Gate%'
      OR label ILIKE 'Lead Pipeline%' OR label ILIKE 'Scan —%'
      OR label ILIKE '%InMail%' THEN 'Outreach'
    -- competitor intel
    WHEN label ILIKE '%Competitor%' THEN 'Competitors'
    -- upwork
    WHEN label ILIKE 'Upwork%' THEN 'Upwork'
    -- clients / calls / calendar / recordings
    WHEN label ILIKE 'Client %' OR label ILIKE 'Client%'
      OR label ILIKE 'Kyle Call%' OR label ILIKE 'Pre-Call%'
      OR label ILIKE 'Google Calendar%' OR label ILIKE 'Recording Lifecycle%' THEN 'Clients'
    -- agent / n8nClaw / notifications / research orchestration
    WHEN label ILIKE 'n8nClaw%' OR label ILIKE '%Reminder Scheduler%'
      OR label ILIKE 'Daily %' OR label ILIKE 'Proactive Notifications%'
      OR label ILIKE '%Push Notification%' OR label ILIKE 'Auto Research%' THEN 'Agent'
    -- system / infra / backups / syncs
    WHEN label ILIKE '%Backup%' OR label ILIKE '%Sync%' OR label ILIKE '%Schema%'
      OR label ILIKE 'Slack Channel%' OR label ILIKE 'Railway%'
      OR label ILIKE 'Execution Log%' OR label ILIKE 'Dashboard Data%'
      OR label ILIKE 'Prompts %' OR label ILIKE 'ClickUp Prompts%'
      OR label ILIKE 'Weekly Health Summary%' THEN 'System'
    -- content (broad — kept near last so specific pipelines win first)
    WHEN label ILIKE 'Post %' OR label ILIKE '%Post Performance%' OR label ILIKE 'Carousel%'
      OR label ILIKE 'Content %' OR label ILIKE 'Weekly Topic%' OR label ILIKE 'Weekly Suggestions%'
      OR label ILIKE 'Weekly Trends%' OR label ILIKE 'Scheduled Post%' OR label ILIKE 'Editorial%'
      OR label ILIKE 'Video Ideas%' OR label ILIKE 'LinkedIn Clip%' OR label ILIKE 'Signal Clusters%'
      OR label ILIKE 'Lifestyle %' OR label ILIKE 'Instagram%' OR label ILIKE 'IG -%'
      OR label ILIKE 'Write-back%' OR label ILIKE 'Newsletter%' OR label ILIKE 'Nurture%'
      OR label ILIKE 'Topic Research%' THEN 'Content'
    ELSE 'Meta'
  END;
$$;

COMMENT ON FUNCTION derive_category(text) IS 'Best-effort pipeline category for a scheduled job from its label. Used by the sync trigger to auto-fill category; only applied when the row''s category is still the default ''Meta'' so manual overrides are preserved.';

-- ── Update the sync trigger fn to auto-fill category (preserving human edits) ──
CREATE OR REPLACE FUNCTION sync_scheduled_registry()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.trigger_type = 'schedule' THEN
    INSERT INTO scheduled_job_registry
      (job_key, source, label, category, schedule_human, expected_interval_minutes, enabled, last_synced_at, updated_at)
    VALUES
      ('n8n:' || NEW.workflow_id, 'n8n', NEW.workflow_name,
       derive_category(NEW.workflow_name), NEW.schedule_expression,
       derive_interval_minutes(NEW.schedule_expression),
       (COALESCE(NEW.is_active, false) AND NOT COALESCE(NEW.manually_paused, false)),
       now(), now())
    ON CONFLICT (job_key) DO UPDATE SET
      label = EXCLUDED.label,
      -- only adopt the derived category while the row is still uncategorised; never clobber a curated one
      category = CASE WHEN scheduled_job_registry.category = 'Meta'
                      THEN EXCLUDED.category ELSE scheduled_job_registry.category END,
      schedule_human = EXCLUDED.schedule_human,
      expected_interval_minutes = EXCLUDED.expected_interval_minutes,
      enabled = EXCLUDED.enabled,
      last_synced_at = now(),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- ── One-time backfill of existing rows still sitting at the default 'Meta' ──
UPDATE scheduled_job_registry
SET category = derive_category(label), updated_at = now()
WHERE source = 'n8n' AND category = 'Meta';
