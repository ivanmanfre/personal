-- kyle_steal_box: anon-readable projection of Kyle-call "steal for my system" tactics.
--
-- 2026-06-06 (Ivan's explicit decision): this view now ALSO exposes the call
-- takeaway (summary) and the source ClickUp task_id, to give each tactic context
-- plus a link back to the call. `summary` CAN name Kyle's prospects (third-party
-- PII Kyle authorized Ivan to MINE, not PUBLISH). Because the dashboard anon key
-- ships in the public JS bundle, this view is effectively WORLD-READABLE — the
-- dashboard password gates the screen, not the data. Ivan was shown the threat
-- model and accepted this exposure; the real fix (Supabase Auth + RLS on
-- auth.uid()) is a separate, deferred, dashboard-wide project. The `participants`
-- column is deliberately NOT projected.
--
-- security_invoker = off → the view runs with definer (owner) rights, so anon can
-- read the curated projection even though base-table RLS blocks anon on
-- kyle_call_insights.

DROP VIEW IF EXISTS public.kyle_steal_box;

CREATE VIEW public.kyle_steal_box
WITH (security_invoker = off) AS
SELECT
  k.id,
  k.task_id,
  k.call_type,
  k.call_date,
  k.summary,
  k.created_at,
  (k.insights->>'signal_score')::int                AS signal_score,
  k.insights->'steal_for_my_system'                 AS steal_items
FROM public.kyle_call_insights k
WHERE jsonb_typeof(k.insights->'steal_for_my_system') = 'array'
  AND jsonb_array_length(k.insights->'steal_for_my_system') > 0;

GRANT SELECT ON public.kyle_steal_box TO anon, authenticated;
