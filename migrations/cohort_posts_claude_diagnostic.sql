-- 2026-05-04 — Drafter structured-output diagnostic columns
-- Stores Claude's SKIP reason + confidence so we can tune the prompt + scrape filter
-- without losing context on rejected posts.
ALTER TABLE cohort_posts ADD COLUMN IF NOT EXISTS claude_skip_reason TEXT;
ALTER TABLE cohort_posts ADD COLUMN IF NOT EXISTS claude_confidence TEXT;
CREATE INDEX IF NOT EXISTS cohort_posts_claude_decision
  ON cohort_posts(claude_confidence, drafted, skipped);
