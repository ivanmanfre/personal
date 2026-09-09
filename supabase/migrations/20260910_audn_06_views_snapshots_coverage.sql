-- ============================================================================
-- Audience-learning measurement foundation — 06 / snapshot eligibility + ranks.
-- goal-run audience-learning-02-foundation-2026-09-09, foundation seat.
-- Worklist: W09 (matched-age eligibility), W15/W24 (rank + monthly median with
--           the eligible denominator disclosed).
--
-- Depends on: 01_functions, 02_tables (audn_post_metric_snapshots),
--             03_views_identity_events (published_at).
-- THIS IS WHY C6 MATTERS: every view below reads a table created in 02. A
-- "views first, tables second" ordering fails here at create time.
--
-- Coverage note: CONTRACTS §2 freezes audn_post_collection_coverage as a TABLE
-- and names no coverage view, so none is invented here. §3.8's rule ("a post
-- with zero events and no coverage row is not_collected") is applied by
-- consumers against that table; adding an unfrozen object would break the
-- object contract.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- audn_snapshot_eligibility_v — is this snapshot usable for a matched-age
-- comparison?
--
-- §3.7: THE AGE BUCKET IS ASSIGNED HERE, NOT BY THE COLLECTOR. A job that
-- believes it ran at day 7 but actually ran at day 11 must not be able to
-- declare itself a 7-day snapshot. actual_age_days is recomputed from
-- captured_at - published_at against audn_post_identity_v; the values the
-- writer supplied are preserved beside them as declared_* so a drift between
-- intent and reality stays visible instead of being overwritten.
--
--   target_age_days   derived: 7 or 14 when the real age is within +/- 1 day
--   age_ok            the real age landed in a bucket at all
--   eligible_for_rank age_ok AND there is a reactions value to rank
--
-- Incompatible ages are EXCLUDED from ranks rather than compared across ages,
-- and the surviving denominator is disclosed downstream as eligible_n.
-- Historical snapshots do not exist and are never reconstructed (D04): this
-- view can only describe what was actually collected.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- audn_matched_age_rank_v — rank a post only against posts measured at the
-- same age.
--
-- A 7-day-old post outranking a 2-day-old post is an artefact of the clock, not
-- of the content. Ranking is therefore partitioned by (client_id,
-- target_age_days) and eligible_n travels with every row so "#3" is always
-- read as "#3 of N eligible", never as "#3 of everything I posted".
--
-- Posts WITHOUT an eligible snapshot are simply absent from this view.
-- Consumers label those observed-age; they are never given a rank of last
-- place, which would be a manufactured zero.
--
-- One post can hold several cycles at the same target age (a re-run a day
-- later); the most recent capture is the one ranked.
-- ---------------------------------------------------------------------------
create or replace view public.audn_matched_age_rank_v
with (security_invoker = true) as
with eligible as (
  select distinct on (client_id, post_social_id, target_age_days)
    client_id, post_social_id, target_age_days, reactions, captured_at
  from public.audn_snapshot_eligibility_v
  where eligible_for_rank
  order by client_id, post_social_id, target_age_days, captured_at desc, id desc
)
select
  e.client_id,
  e.post_social_id,
  e.target_age_days,
  e.reactions,
  rank() over (
    partition by e.client_id, e.target_age_days
    order by e.reactions desc
  )::int                                              as rank,
  count(*) over (
    partition by e.client_id, e.target_age_days
  )::int                                              as eligible_n,
  'matched_age'::text                                 as rank_basis
from eligible e;

comment on view public.audn_matched_age_rank_v is
  'Rank among the author''s posts measured at the same age, with the eligible denominator disclosed. Posts with no eligible snapshot are absent, never last (worklist W15).';

-- ---------------------------------------------------------------------------
-- audn_monthly_median_v — the month''s median at a fixed age.
--
-- Median, not mean: one viral post must not move the baseline every other post
-- is judged against. n is carried so a month built on two posts is visibly a
-- month built on two posts. basis is stamped 'matched_age' because a median
-- computed across mixed ages would compare different things.
-- ---------------------------------------------------------------------------
create or replace view public.audn_monthly_median_v
with (security_invoker = true) as
with eligible as (
  select distinct on (e.client_id, e.post_social_id, e.target_age_days)
    e.client_id, e.post_social_id, e.target_age_days, e.reactions, e.published_at, e.captured_at, e.id
  from public.audn_snapshot_eligibility_v e
  where e.eligible_for_rank
    and e.published_at is not null
  order by e.client_id, e.post_social_id, e.target_age_days, e.captured_at desc, e.id desc
)
select
  client_id,
  date_trunc('month', published_at)::date                      as month,
  target_age_days,
  percentile_cont(0.5) within group (order by reactions)::numeric as median_reactions,
  count(*)::int                                                as n,
  'matched_age'::text                                          as basis
from eligible
group by 1, 2, 3;

comment on view public.audn_monthly_median_v is
  'Median reactions per publication month at a fixed measured age, with n disclosed (worklist W24).';
