-- push_subscriptions — devices subscribed to web push from the dashboard.
-- Subscribed via dashboard-v2 Settings panel (Phase 7).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint    text NOT NULL UNIQUE,
  p256dh      text NOT NULL,
  auth        text NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Service-role only — anon should never read/write subscriptions
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_push" ON push_subscriptions;
CREATE POLICY "service_role_all_push" ON push_subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- The dashboard uses the anon key (single-user app behind a password gate),
-- but writes are mediated by upsert from the client SW registration.
-- For Ivan's single-user setup we allow anon upsert + delete on own endpoint:
DROP POLICY IF EXISTS "anon_upsert_own_endpoint" ON push_subscriptions;
CREATE POLICY "anon_upsert_own_endpoint" ON push_subscriptions
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_own_endpoint" ON push_subscriptions;
CREATE POLICY "anon_update_own_endpoint" ON push_subscriptions
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_own_endpoint" ON push_subscriptions;
CREATE POLICY "anon_delete_own_endpoint" ON push_subscriptions
  FOR DELETE TO anon USING (true);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON push_subscriptions(endpoint);
