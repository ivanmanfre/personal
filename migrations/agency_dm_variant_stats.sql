-- Agency DM variant stats RPC for the body × closer A/B test on the
-- agency-consultants outbound campaign. Applied to Supabase 2026-05-26.
--
-- Returns marginal reply rate per axis (body or closer), not per cell,
-- because per-cell N is too small at ~3 DMs/day (10 cells = ~9 sends each in 30d).
-- Body axis: a = V3 builder-first baseline, b = V11-B1 benefit-first.
-- Closer axis: a/d/h/i/j (gift / minimum / binary / 3-pick / inbound question).
--
-- Tag formats handled:
--   - template/agency_dm_v3_owned_<body>_<closer>   (current, 2-axis tagged)
--   - template/agency_dm_v3_owned_<closer>          (closer-only patch period, body=a)
--   - template/agency_dm_v3_owned                   (legacy, body=a, closer=null)

CREATE OR REPLACE FUNCTION public.get_agency_dm_variant_stats()
RETURNS TABLE (
  axis text,
  tag text,
  sent_count int,
  reply_count int,
  reply_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH agency_dms AS (
  SELECT
    m.id,
    m.prospect_id,
    m.ai_model,
    m.sent_at,
    CASE
      WHEN m.ai_model ~ '^template/agency_dm_v3_owned_[ab]_[adhij]$'
        THEN substring(m.ai_model from '_([ab])_[adhij]$')
      WHEN m.ai_model = 'template/agency_dm_v3_owned'
        OR m.ai_model ~ '^template/agency_dm_v3_owned_[adhij]$'
        THEN 'a'
      ELSE NULL
    END AS body_tag,
    CASE
      WHEN m.ai_model ~ '^template/agency_dm_v3_owned_[ab]_[adhij]$'
        THEN substring(m.ai_model from '_[ab]_([adhij])$')
      WHEN m.ai_model ~ '^template/agency_dm_v3_owned_[adhij]$'
        THEN substring(m.ai_model from '_([adhij])$')
      ELSE NULL
    END AS closer_tag
  FROM outreach_messages m
  JOIN outreach_prospects p ON p.id = m.prospect_id
  WHERE m.direction = 'outbound'
    AND m.message_type = 'dm'
    AND m.sequence_step = 1
    AND m.sent_at IS NOT NULL
    AND p.campaign_id = 'f341042c-fa04-4412-a8b1-a002a48a2b40'
    AND m.ai_model LIKE 'template/agency_dm_v3_owned%'
),
with_reply AS (
  SELECT
    d.*,
    EXISTS (
      SELECT 1 FROM outreach_messages r
      WHERE r.prospect_id = d.prospect_id
        AND r.direction = 'inbound'
        AND r.sent_at > d.sent_at
        AND COALESCE(r.is_reaction, false) = false
    ) AS has_reply
  FROM agency_dms d
)
SELECT
  'body'::text AS axis,
  body_tag AS tag,
  COUNT(*)::int AS sent_count,
  SUM(CASE WHEN has_reply THEN 1 ELSE 0 END)::int AS reply_count,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(100.0 * SUM(CASE WHEN has_reply THEN 1 ELSE 0 END) / COUNT(*), 1)
    ELSE 0
  END AS reply_rate
FROM with_reply
WHERE body_tag IS NOT NULL
GROUP BY body_tag
UNION ALL
SELECT
  'closer'::text AS axis,
  closer_tag AS tag,
  COUNT(*)::int AS sent_count,
  SUM(CASE WHEN has_reply THEN 1 ELSE 0 END)::int AS reply_count,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(100.0 * SUM(CASE WHEN has_reply THEN 1 ELSE 0 END) / COUNT(*), 1)
    ELSE 0
  END AS reply_rate
FROM with_reply
WHERE closer_tag IS NOT NULL
GROUP BY closer_tag
ORDER BY axis, tag;
$$;

GRANT EXECUTE ON FUNCTION public.get_agency_dm_variant_stats() TO anon, authenticated;
