-- 09 down (OFFLINE-ONLY like every .down.sql, restore/RESTORE-MAP.json): put audn_snapshot_eligibility_v back to its 06 definition.
-- audn_post_identity_v keeps the appended activity_digits column (a create-or-replace view cannot drop a column without
-- dropping the view, which would cascade through 04/05/06); the column is inert once the 06 join is back.

create or replace view public.audn_snapshot_eligibility_v
with (security_invoker = true) as
with s as (
  select
    sn.*,
    id.published_at,
    case
      when id.published_at is null then null
      else round(extract(epoch from (sn.captured_at - id.published_at)) / 86400.0, 6)
    end as computed_age_days
  from public.audn_post_metric_snapshots sn
  left join public.audn_post_identity_v id
    on id.client_id = sn.client_id
   and id.post_social_id = sn.post_social_id
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
  'Snapshot rows with the age bucket assigned by measurement, not by the collector. declared_* preserve what the writer claimed (CONTRACTS §3.7).';
