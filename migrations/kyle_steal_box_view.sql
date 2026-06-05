-- kyle_steal_box: safe, anon-readable projection of Kyle-call "steal for my system" tactics.
--
-- WHY A VIEW (not anon-read on the base table):
--   kyle_call_insights.insights also holds outreach_angles[].icp_quote (prospects'
--   verbatim quotes) and icp_profile (prospect names / company names) — third-party PII
--   that Kyle authorized Ivan to MINE, not PUBLISH. The dashboard's anon key ships in the
--   public JS bundle, so anything anon-readable is effectively world-readable via the REST
--   API (the UI password does NOT gate the data). This view exposes ONLY the steal tactics,
--   whose evidence_quotes are Kyle-the-coach's own words (no prospect PII).
--
-- security_invoker = off → the view runs with definer (owner) rights, so anon can read the
-- curated projection even though base-table RLS blocks anon on kyle_call_insights.

CREATE OR REPLACE VIEW public.kyle_steal_box
WITH (security_invoker = off) AS
SELECT
  k.id,
  k.call_date,
  k.created_at,
  (k.insights->>'signal_score')::int                AS signal_score,
  k.insights->'steal_for_my_system'                 AS steal_items
FROM public.kyle_call_insights k
WHERE jsonb_typeof(k.insights->'steal_for_my_system') = 'array'
  AND jsonb_array_length(k.insights->'steal_for_my_system') > 0;

GRANT SELECT ON public.kyle_steal_box TO anon, authenticated;
