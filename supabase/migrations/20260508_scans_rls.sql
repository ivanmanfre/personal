-- supabase/migrations/20260508_scans_rls.sql

-- Enable RLS on scans (anon can only read status='complete' rows)
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read completed scans"
  ON scans FOR SELECT
  TO anon
  USING (status = 'complete');

-- Service role bypasses RLS automatically — no policy needed for n8n pipeline writes.

-- Enable RLS on scan_prospect_tokens (anon can look up valid tokens for pre-fill)
ALTER TABLE scan_prospect_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read valid tokens"
  ON scan_prospect_tokens FOR SELECT
  TO anon
  USING (expires_at > now());
