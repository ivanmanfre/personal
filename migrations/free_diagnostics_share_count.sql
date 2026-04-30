-- Phase 2 — track LinkedIn/social shares of scorecard verdict cards.
-- Incremented by supabase/functions/scorecard-share when a user clicks Share.

ALTER TABLE free_diagnostics ADD COLUMN IF NOT EXISTS share_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN free_diagnostics.share_count IS 'Incremented when user clicks Share on result page. Phase 2.';
