-- Stores Stripe checkout sessions for the $2,500 Agent-Ready Blueprint.
-- Populated by the stripe-webhook edge function on checkout.session.completed.
-- Paired with: supabase/functions/stripe-webhook/index.ts

CREATE TABLE IF NOT EXISTS paid_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  stripe_payment_intent TEXT,
  email TEXT NOT NULL,
  name TEXT,
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'paid',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paid_assessments_email ON paid_assessments(email);
CREATE INDEX IF NOT EXISTS idx_paid_assessments_paid_at ON paid_assessments(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_paid_assessments_status ON paid_assessments(status);

COMMENT ON TABLE paid_assessments IS 'Paid Agent-Ready Blueprint checkouts. One row per Stripe session.';
COMMENT ON COLUMN paid_assessments.status IS 'paid | refunded | disputed';
COMMENT ON COLUMN paid_assessments.metadata IS 'Raw Stripe metadata + any custom fields (e.g., utm params).';
