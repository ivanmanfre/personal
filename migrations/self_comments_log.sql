-- Migration: self_comments_log
-- Created 2026-05-04 per audit recommendation D20 (self-comment-on-own-posts workflow)
-- Strategy doc: /Users/ivanmanfredi/Desktop/personal-site/.audit-2026-05/self-comment-strategy.md
--
-- Logs every self-comment decision for the Self-Comment Drafter & Poster n8n workflow.
-- Three action states: 'posted' | 'skipped' | 'deferred' | 'pending_approval'

CREATE TABLE IF NOT EXISTS self_comments_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id TEXT NOT NULL,                     -- ClickUp task ID
  post_urn TEXT,                              -- LinkedIn URN (urn:li:activity:...)
  pillar TEXT,                                -- Methodology / Tactical / Durable / etc.
  hook_type TEXT,                             -- Inferred from Post Format / hook regex
  template_id TEXT,                           -- e.g. M1, AR3, TR2
  comment_text TEXT,                          -- Final comment body
  action TEXT,                                -- 'posted' | 'skipped' | 'deferred' | 'pending_approval'
  reason TEXT,                                -- Skip/defer/approval-gate reason
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  comment_urn TEXT,                           -- Unipile-returned comment URN, for engagement tracking
  thread_replies_24h INT,                     -- Backfilled by daily cron
  utm_clicks INT                              -- Backfilled by Wave 0 attribution
);

CREATE INDEX IF NOT EXISTS self_comments_post_urn ON self_comments_log(post_urn);
CREATE INDEX IF NOT EXISTS self_comments_template_recent ON self_comments_log(template_id, posted_at);
CREATE INDEX IF NOT EXISTS self_comments_action_posted_at ON self_comments_log(action, posted_at);
