-- ---------------------------------------------------------------------------
-- 09 — snapshot ↔ identity join for bare activity digits (hotfix-01, prepared
-- 2026-09-10 after the first live RISE Performance Sync cycle).
--
-- What was observed (deploy/ticks/rrprmLeoU0pjpEmq.json, 10:00Z cycle):
--   37 audn_post_metric_snapshots rows landed for risedtc, 0 of them joined
--   audn_post_identity_v, so audn_snapshot_eligibility_v reported
--   published_at NULL, age_ok false and eligible_for_rank false for every row.
--
-- Why: the RISE Performance Sync writes carousel_drafts.source_post_id as
-- post_social_id. That value is the bare ACTIVITY id (digits only — §3.9: kind
-- unknown, never guessed). RISE identity rows come from
-- client_post_metrics.social_id, which is a full URN and, for 11 of the 37
-- posts, a ugcPost URN whose number differs from the activity id. The activity
-- id IS known on the identity side: client_post_metrics.post_url carries
-- "...-activity-<digits>-..." for 36 of the 37 (measured on the live rows).
--
-- Fix, on the measurement side so it is RETROACTIVE for every row already
-- collected (the eligibility view computes age from captured_at − published_at
-- at read time; nothing collected is lost or rewritten):
--   1. audn_post_identity_v gains ONE appended column, activity_digits: the
--      URN digits when the key is an activity URN, otherwise the activity id
--      found in client_post_metrics.post_url (client rows only). NULL when
--      neither is known — unknown stays a value.
--   2. audn_snapshot_eligibility_v resolves identity by the exact key first,
--      then, only for a key with NO kind (bare digits), by activity_digits.
--      A row that matches neither keeps published_at NULL exactly as before.
-- Column lists of both views are unchanged apart from the appended column, so
-- every dependent view (04, 05, 06 rank/median) is untouched.
-- The writer (rrprmLeoU0pjpEmq) is NOT changed by this migration.
-- ---------------------------------------------------------------------------

create or replace view public.audn_post_identity_v
with (security_invoker = true) as
with spine as (
  select distinct on (s.post_social_id)
         s.post_social_id,
         s.lm_idea_candidate_id
  from public.ivan_post_outcome_spine s
  where s.post_social_id is not null
  order by s.post_social_id, s.lm_idea_candidate_id nulls last
)
select
  'ivan'::text                                        as client_id,
  op.social_id                                        as post_social_id,
  public.audn_urn_kind(op.social_id)                  as post_urn_kind,
  public.audn_urn_digits(op.social_id)                as post_urn_digits,
  op.posted_at                                        as published_at,
  op.post_type                                        as format,
  spine.lm_idea_candidate_id::uuid                    as idea_id,
  op.pillar                                           as topic,
  'own_posts.pillar'::text                            as topic_source,
  null::text                                          as topic_version,
  'own_posts'::text                                   as source_table,
  case
    when public.audn_urn_kind(op.social_id) = 'activity' then public.audn_urn_digits(op.social_id)
    else null
  end                                                 as activity_digits
from public.own_posts op
left join spine on spine.post_social_id = op.social_id
where op.social_id is not null
union all
select
  m.client_id,
  m.social_id                                         as post_social_id,
  public.audn_urn_kind(m.social_id)                   as post_urn_kind,
  public.audn_urn_digits(m.social_id)                 as post_urn_digits,
  m.published_at,
  m.meta ->> 'format'                                 as format,
  null::uuid                                          as idea_id,
  m.funnel_class                                      as topic,
  'client_post_metrics.funnel_class'::text            as topic_source,
  m.funnel_class_meta ->> 'version'                   as topic_version,
  'client_post_metrics'::text                         as source_table,
  coalesce(
    case when public.audn_urn_kind(m.social_id) = 'activity' then public.audn_urn_digits(m.social_id) end,
    substring(m.post_url from 'activity[:-]([0-9]{10,})')
  )                                                   as activity_digits
from public.client_post_metrics m
where m.social_id is not null;

comment on view public.audn_post_identity_v is
  'One row per (client_id, post_social_id). The single place post ownership is resolved; every other audn_ view scopes through this, never through a path or a name (CONTRACTS §3.1). activity_digits (09): the activity id this row knows, for snapshot keys that carry digits only.';

create or replace view public.audn_snapshot_eligibility_v
with (security_invoker = true) as
with s as (
  select
    sn.*,
    idm.published_at,
    case
      when idm.published_at is null then null
      else round(extract(epoch from (sn.captured_at - idm.published_at)) / 86400.0, 6)
    end as computed_age_days
  from public.audn_post_metric_snapshots sn
  left join lateral (
    select id.published_at
    from public.audn_post_identity_v id
    where id.client_id = sn.client_id
      and (
        id.post_social_id = sn.post_social_id
        or (
          public.audn_urn_kind(sn.post_social_id) is null
          and public.audn_urn_digits(sn.post_social_id) is not null
          and id.activity_digits = public.audn_urn_digits(sn.post_social_id)
        )
      )
    order by (id.post_social_id = sn.post_social_id) desc, id.published_at nulls last
    limit 1
  ) idm on true
),
d as (
  select
    s.*,
    coalesce(s.computed_age_days, s.actual_age_days) as effective_age_days
  from s
)
select
  d.id,
  d.client_id,
  d.post_social_id,
  d.cycle_id,
  d.captured_at,
  d.published_at,
  d.effective_age_days                                as actual_age_days,
  d.actual_age_days                                   as declared_actual_age_days,
  case
    when d.effective_age_days is null then null
    when abs(d.effective_age_days - 7)  <= 1 then 7
    when abs(d.effective_age_days - 14) <= 1 then 14
    else null
  end::int                                            as target_age_days,
  d.target_age_days                                   as declared_target_age_days,
  d.impressions,
  d.reactions,
  d.comments,
  d.shares,
  d.source,
  d.coverage,
  (
    d.effective_age_days is not null
    and (abs(d.effective_age_days - 7) <= 1 or abs(d.effective_age_days - 14) <= 1)
  )                                                   as age_ok,
  (
    d.effective_age_days is not null
    and (abs(d.effective_age_days - 7) <= 1 or abs(d.effective_age_days - 14) <= 1)
    and d.reactions is not null
  )                                                   as eligible_for_rank
from d;

comment on view public.audn_snapshot_eligibility_v is
  'Snapshot rows with the age bucket assigned by measurement, not by the collector. declared_* preserve what the writer claimed (CONTRACTS §3.7). 09: a digits-only key resolves through audn_post_identity_v.activity_digits.';
