-- Stack status for the dashboard Overview "Stack" card.
-- Populated hourly by the n8n "Stack Status Sync" workflow.
-- The frontend renders whatever rows exist — adding a new tool to the sync
-- workflow's source list auto-surfaces it on the dashboard.

CREATE TABLE IF NOT EXISTS dashboard_stack_status (
  -- e.g. 'n8n', 'n8nac', 'claude-code-railway', 'watchtower', 'docuseal', 'caddy', 'redis', 'evolution_api'
  tool TEXT PRIMARY KEY,

  -- Display label (override for tool key when needed)
  display_name TEXT,

  -- Category — for grouping on the dashboard ('runtime', 'cli', 'container', 'service')
  category TEXT NOT NULL DEFAULT 'service',

  -- Currently installed/running version
  version TEXT,

  -- Latest available (npm 'latest' for CLI, or null for container 'latest' tags)
  latest_version TEXT,

  -- 'ok' | 'minor_lag' | 'major_lag' | 'error' | 'unknown'
  status TEXT NOT NULL DEFAULT 'unknown',

  -- Tool-specific extras: workflow counts, skill list, error rate, last check log, etc.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- When the sync last touched this row
  last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- When this row was created
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- For sorting
  display_order INT NOT NULL DEFAULT 100
);

CREATE INDEX IF NOT EXISTS idx_dashboard_stack_status_category ON dashboard_stack_status(category);
CREATE INDEX IF NOT EXISTS idx_dashboard_stack_status_last_checked ON dashboard_stack_status(last_checked DESC);

-- Allow anon read (dashboard reads with anon key)
ALTER TABLE dashboard_stack_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dashboard_stack_status_read ON dashboard_stack_status;
CREATE POLICY dashboard_stack_status_read ON dashboard_stack_status FOR SELECT USING (TRUE);
-- Writes only via service-role key (default deny on other ops)

-- Helpful comment for future-me investigating
COMMENT ON TABLE dashboard_stack_status IS 'Stack version + status feed for dashboard Overview. Populated hourly by n8n workflow "Stack Status Sync". Add new tools by extending the workflow''s sources — frontend renders all rows dynamically, no code change needed for new tools.';
