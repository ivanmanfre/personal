-- Agency DM variant stats RPC for the body × closer A/B test on the
-- agency-consultants outbound campaign. Applied to Supabase 2026-05-26.
--
-- Returns marginal reply rate per axis (body or closer), not per cell,
-- because per-cell N is too small at ~3 DMs/day. Also returns sample_text =
-- the most recent message_text per variant so the dashboard renders the
-- LIVE copy (not hardcoded labels) — if Ivan edits the template in n8n,
-- the dashboard reflects the new copy after the next send.
--
-- Body axis: a = builder-first baseline, b = benefit-first.
-- Closer axis: a/d/h/i/j (gift / minimum / binary / 3-pick / inbound question).
--
-- Tag formats handled:
--   - template/agency_dm_v3_owned_<body>_<closer>   (current, 2-axis tagged)
--   - template/agency_dm_v3_owned_<closer>          (closer-only patch period, body=a)
--   - template/agency_dm_v3_owned                   (legacy, body=a, closer=null)

DROP FUNCTION IF EXISTS public.get_agency_dm_variant_stats();

CREATE OR REPLACE FUNCTION public.get_agency_dm_variant_stats()
RETURNS TABLE (
  axis text,
  tag text,
  sent_count int,
  reply_count int,
  reply_rate numeric,
  sample_text text
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
    m.message_text,
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
),
body_samples AS (
  SELECT DISTINCT ON (body_tag)
    body_tag, message_text
  FROM with_reply
  WHERE body_tag IS NOT NULL
  ORDER BY body_tag, sent_at DESC
),
closer_samples AS (
  SELECT DISTINCT ON (closer_tag)
    closer_tag, message_text
  FROM with_reply
  WHERE closer_tag IS NOT NULL
  ORDER BY closer_tag, sent_at DESC
)
SELECT
  'body'::text AS axis,
  w.body_tag AS tag,
  COUNT(*)::int AS sent_count,
  SUM(CASE WHEN w.has_reply THEN 1 ELSE 0 END)::int AS reply_count,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(100.0 * SUM(CASE WHEN w.has_reply THEN 1 ELSE 0 END) / COUNT(*), 1)
    ELSE 0
  END AS reply_rate,
  bs.message_text AS sample_text
FROM with_reply w
LEFT JOIN body_samples bs USING (body_tag)
WHERE w.body_tag IS NOT NULL
GROUP BY w.body_tag, bs.message_text
UNION ALL
SELECT
  'closer'::text AS axis,
  w.closer_tag AS tag,
  COUNT(*)::int AS sent_count,
  SUM(CASE WHEN w.has_reply THEN 1 ELSE 0 END)::int AS reply_count,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(100.0 * SUM(CASE WHEN w.has_reply THEN 1 ELSE 0 END) / COUNT(*), 1)
    ELSE 0
  END AS reply_rate,
  cs.message_text AS sample_text
FROM with_reply w
LEFT JOIN closer_samples cs USING (closer_tag)
WHERE w.closer_tag IS NOT NULL
GROUP BY w.closer_tag, cs.message_text
ORDER BY axis, tag;
$$;

GRANT EXECUTE ON FUNCTION public.get_agency_dm_variant_stats() TO anon, authenticated;
