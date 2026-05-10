-- Add industry column to free_diagnostics so the result page can render
-- per-industry weak-spot framing and downstream tooling can segment leads by vertical.
-- Paired with: lib/industries.ts, components/ScorecardPage.tsx (industry pre-quiz step),
-- supabase/functions/scorecard-submit (persists industry), supabase/functions/scorecard-get (returns industry).

ALTER TABLE free_diagnostics
  ADD COLUMN IF NOT EXISTS industry TEXT;

CREATE INDEX IF NOT EXISTS idx_free_diagnostics_industry
  ON free_diagnostics(industry)
  WHERE industry IS NOT NULL;

COMMENT ON COLUMN free_diagnostics.industry IS
  'Self-reported industry from pre-quiz context step. One of: professional_services, agency_consulting, financial_services, property_real_estate, ecommerce_retail, solar_energy, other. NULL for legacy rows.';
