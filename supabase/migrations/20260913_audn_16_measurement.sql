-- Audience-learning 16: canonical identity and matched-age measurement.
-- Raw observations are never changed. Every derived row carries its resolution
-- state so ambiguity remains measurable rather than being silently discarded.

create or replace view public.audn_canonical_post_identity_v
with (security_invoker = true) as
select
  i.client_id,
  i.post_social_id as canonical_post_id,
  i.post_social_id as identity_post_social_id,
  min(i.post_urn_kind) as post_urn_kind,
  min(i.post_urn_digits) as post_urn_digits,
  min(i.activity_digits) as activity_digits,
  min(i.published_at) as published_at,
  case lower(coalesce(min(i.format), ''))
    when 'document' then 'carousel'
    when 'carousel' then 'carousel'
    when 'video' then 'video'
    when 'image' then 'image'
    when 'article' then 'article'
    when 'text' then 'text'
    else 'unknown'
  end as format,
  (array_agg(i.idea_id order by i.idea_id nulls last))[1] as idea_id,
  min(i.topic) as topic,
  min(i.topic_source) as topic_source,
  min(i.topic_version) as topic_version,
  min(i.source_table) as source_table,
  count(*)::int as source_row_count,
  count(distinct coalesce(i.published_at::text, '<null>'))::int as publication_value_count,
  count(distinct i.activity_digits)::int as activity_value_count,
  count(distinct i.source_table)::int as source_table_count,
  case when count(distinct coalesce(i.published_at::text, '<null>')) > 1
          or count(distinct i.activity_digits) > 1 or count(distinct i.source_table) > 1
       then 'conflict' else 'resolved' end as identity_status
from public.audn_post_identity_v i
group by i.client_id, i.post_social_id;

comment on view public.audn_canonical_post_identity_v is
  'Canonical post scope is (client_id, canonical_post_id). Typed URNs remain distinct; aliases are resolved only in audn_identity_resolution_v.';

create or replace view public.audn_identity_resolution_v
with (security_invoker = true) as
with candidates as (
  select
    s.id as raw_snapshot_id,
    s.client_id,
    s.post_social_id as raw_post_social_id,
    s.cycle_id,
    s.captured_at,
    s.target_age_days as declared_target_age_days,
    s.actual_age_days as declared_actual_age_days,
    s.impressions, s.reactions, s.comments, s.shares, s.source, s.coverage,
    public.audn_urn_kind(s.post_social_id) as raw_urn_kind,
    public.audn_urn_digits(s.post_social_id) as raw_urn_digits,
    exact_i.canonical_post_id as exact_id,
    alias_i.candidate_count as alias_candidate_count,
    alias_i.canonical_post_id as alias_id,
    alias_i.published_at as alias_published_at,
    exact_i.published_at as exact_published_at,
    exact_i.identity_status as exact_identity_status
  from public.audn_post_metric_snapshots s
  left join public.audn_canonical_post_identity_v exact_i
    on exact_i.client_id = s.client_id
   and exact_i.identity_post_social_id = s.post_social_id
  left join lateral (
    select count(*)::int as candidate_count,
           min(i.canonical_post_id) as canonical_post_id,
           min(i.published_at) as published_at
    from public.audn_canonical_post_identity_v i
    where i.client_id = s.client_id
      and public.audn_urn_kind(s.post_social_id) is null
      and public.audn_urn_digits(s.post_social_id) is not null
      and i.activity_digits = public.audn_urn_digits(s.post_social_id)
      and i.identity_status = 'resolved'
  ) alias_i on true
)
select
  c.*,
  case
    when exact_id is not null and exact_identity_status = 'resolved' then exact_id
    when raw_urn_kind is null and alias_candidate_count = 1 then alias_id
    else null
  end as canonical_post_id,
  case
    when exact_id is not null and exact_identity_status = 'conflict' then 'ambiguous'
    when exact_id is not null then 'exact'
    when raw_urn_kind is not null then 'unresolved'
    when alias_candidate_count = 1 then 'resolved_activity'
    when alias_candidate_count > 1 then 'ambiguous'
    else 'unresolved'
  end as resolution_status,
  coalesce(case when exact_identity_status = 'resolved' then exact_published_at end,
           case when alias_candidate_count = 1 then alias_published_at end) as published_at,
  case
    when exact_id is not null and exact_identity_status = 'conflict' then 'conflicting_identity_rows'
    when exact_id is not null then null
    when raw_urn_kind is not null then 'typed_urn_requires_exact_identity'
    when alias_candidate_count > 1 then 'multiple_activity_candidates'
    when alias_candidate_count = 0 then 'no_identity_candidate'
    else null
  end as unresolved_reason
from candidates c;

comment on view public.audn_identity_resolution_v is
  'Full raw snapshot reconciliation. Exact identity wins; only an untyped digits key with one same-client activity candidate resolves as an alias. Typed URNs never merge by digits.';

create or replace view public.audn_snapshot_eligibility_v
with (security_invoker = true) as
with aged as (
  select r.*,
    case when r.published_at is not null
      then round(extract(epoch from (r.captured_at - r.published_at)) / 86400.0, 6)
    end as computed_age_days
  from public.audn_identity_resolution_v r
), effective as (
  select a.*, a.computed_age_days as effective_age_days
  from aged a
)
select
  raw_snapshot_id as id, client_id, raw_post_social_id as post_social_id,
  cycle_id, captured_at, published_at, effective_age_days as actual_age_days,
  declared_actual_age_days,
  case when abs(effective_age_days - 7) <= 1 then 7
       when abs(effective_age_days - 14) <= 1 then 14 end::int as target_age_days,
  declared_target_age_days, impressions, reactions, comments, shares, source, coverage,
  effective_age_days is not null and
    (abs(effective_age_days - 7) <= 1 or abs(effective_age_days - 14) <= 1) as age_ok,
  resolution_status in ('exact','resolved_activity') and effective_age_days is not null and
    (abs(effective_age_days - 7) <= 1 or abs(effective_age_days - 14) <= 1) and reactions is not null as eligible_for_rank,
  canonical_post_id, resolution_status, unresolved_reason
from effective;

create or replace view public.audn_selected_snapshot_v
with (security_invoker = true) as
select * from (
  select e.id as raw_snapshot_id, e.client_id, e.canonical_post_id,
    e.post_social_id as raw_post_social_id, e.cycle_id, e.captured_at,
    e.published_at, e.actual_age_days, e.declared_actual_age_days,
    e.target_age_days, e.declared_target_age_days,
    e.impressions, e.reactions, e.comments, e.shares, e.source, e.coverage,
    e.resolution_status,
    row_number() over (
      partition by e.client_id, e.canonical_post_id, e.target_age_days
      order by abs(e.actual_age_days - e.target_age_days), e.captured_at desc, e.id desc
    ) as selection_order
  from public.audn_snapshot_eligibility_v e
  where e.resolution_status in ('exact','resolved_activity')
    and e.canonical_post_id is not null and e.age_ok and e.captured_at<=public.audn_cutoff()
) ranked where selection_order = 1;

comment on view public.audn_selected_snapshot_v is
  'One observation per canonical post and 7/14-day target: nearest target, then captured_at DESC, then raw snapshot id DESC.';

create or replace view public.audn_metric_standing_v
with (security_invoker = true) as
with params as (
  select public.audn_cutoff() as cutoff
), cohort as (
  select s.*
  from public.audn_selected_snapshot_v s cross join params p
  where s.captured_at <= p.cutoff
    and s.published_at >= p.cutoff - interval '90 days'
    and s.published_at <= p.cutoff
), expanded as (
  select c.*, m.metric, m.value
  from cohort c
  cross join lateral (values
    ('impressions'::text,
      case when c.impressions >= 0 then c.impressions::numeric end),
    ('engagement_count'::text,
      case when c.reactions >= 0 and c.comments >= 0 then (c.reactions + c.comments)::numeric end),
    ('engagement_per_1000'::text,
      case when c.impressions > 0 and c.reactions >= 0 and c.comments >= 0
           then 1000.0 * (c.reactions + c.comments)::numeric / c.impressions end)
  ) m(metric, value)
), dist as (
  select client_id, target_age_days, metric,
    count(value)::int as eligible_n,
    (count(*) - count(value))::int as missing_n,
    percentile_cont(0.5) within group (order by value) filter (where value is not null)::numeric as p50,
    percentile_cont(0.75) within group (order by value) filter (where value is not null)::numeric as p75,
    percentile_cont(0.9) within group (order by value) filter (where value is not null)::numeric as p90
  from expanded group by 1,2,3
)
select e.client_id, e.canonical_post_id, e.raw_snapshot_id, e.target_age_days,
  e.published_at, e.captured_at, e.actual_age_days, e.metric, e.value,
  d.eligible_n, d.missing_n,
  case when d.eligible_n >= 20 then d.p50 end as p50,
  case when d.eligible_n >= 20 then d.p75 end as p75,
  case when d.eligible_n >= 20 then d.p90 end as p90,
  case when d.eligible_n >= 20 and e.value is not null then
    100.0 * ((select count(*) from expanded x where x.client_id=e.client_id and x.target_age_days=e.target_age_days and x.metric=e.metric and x.value < e.value)
      + 0.5 * (select count(*) from expanded x where x.client_id=e.client_id and x.target_age_days=e.target_age_days and x.metric=e.metric and x.value = e.value)) / d.eligible_n
  end::numeric as standing_pct,
  case when e.value is null then 'metric_missing'
       when d.eligible_n < 20 then 'below_floor'
       else 'supported' end as status,
  20::int as minimum_n, 'type7_percentile_cont'::text as quantile_method,
  'midpoint_empirical'::text as standing_method, 'self_inclusive_90d'::text as cohort_basis
from expanded e join dist d using (client_id, target_age_days, metric);

create or replace view public.audn_matched_age_rank_v
with (security_invoker = true) as
select client_id, canonical_post_id as post_social_id, target_age_days,
  value::int as reactions,
  case when status='supported' then (eligible_n - floor(standing_pct * eligible_n / 100.0) + 1)::int end as rank,
  eligible_n, 'matched_age_engagement_count'::text as rank_basis,
  standing_pct, status
from public.audn_metric_standing_v where metric='engagement_count';

create or replace view public.audn_monthly_metric_trend_v
with (security_invoker = true) as
with expanded as (
  select s.client_id, s.canonical_post_id, s.target_age_days, s.published_at,
    s.captured_at, s.actual_age_days, m.metric, m.value
  from public.audn_selected_snapshot_v s
  cross join lateral (values
    ('impressions'::text, case when s.impressions >= 0 then s.impressions::numeric end),
    ('engagement_count'::text, case when s.reactions >= 0 and s.comments >= 0 then (s.reactions+s.comments)::numeric end),
    ('engagement_per_1000'::text, case when s.impressions > 0 and s.reactions >= 0 and s.comments >= 0 then 1000.0*(s.reactions+s.comments)::numeric/s.impressions end)
  ) m(metric,value)
  where s.published_at is not null
)
select client_id, date_trunc('month', published_at)::date as month,
  target_age_days, metric, percentile_cont(0.5) within group (order by value)::numeric as median,
  count(value)::int as n, min(actual_age_days) as min_actual_age_days,
  max(actual_age_days) as max_actual_age_days, max(captured_at) as captured_through,
  'matched_age_selected'::text as basis
from expanded where value is not null group by 1,2,3,4;

create or replace view public.audn_monthly_median_v
with (security_invoker = true) as
select client_id, month, target_age_days, median as median_reactions, n,
  'matched_age_engagement_count'::text as basis
from public.audn_monthly_metric_trend_v where metric='engagement_count';

create or replace view public.audn_measurement_coverage_v
with (security_invoker = true) as
with selected as (
 select client_id,canonical_post_id,count(*)::int selected_snapshot_count
 from public.audn_selected_snapshot_v group by client_id,canonical_post_id
)
select i.client_id, i.canonical_post_id, i.identity_post_social_id,
  null::bigint as raw_snapshot_id, 'canonical_post'::text as row_kind,
  coalesce(c.status, case when s.canonical_post_id is null then 'not_collected' else 'collected' end) as collection_status,
  c.last_visited_at, c.visits, c.note,
  coalesce(s.selected_snapshot_count,0)::int as selected_snapshot_count,
  null::text as resolution_status, null::text as unresolved_reason
from public.audn_canonical_post_identity_v i
left join public.audn_post_collection_coverage c
  on c.client_id=i.client_id and c.post_social_id=i.identity_post_social_id
left join selected s
  on s.client_id=i.client_id and s.canonical_post_id=i.canonical_post_id
union all
select r.client_id, null, r.raw_post_social_id, r.raw_snapshot_id,
  'unresolved_raw_snapshot', 'unresolved', null, 0, null, 0,
  r.resolution_status, r.unresolved_reason
from public.audn_identity_resolution_v r
where r.resolution_status not in ('exact','resolved_activity');

-- Versioned taxonomy/classification. Rows are deliberately not seeded here:
-- each client's approved source pack supplies its own subjects and provenance.
create table if not exists public.audn_taxonomy_versions (
  client_id text not null, taxonomy_version text not null,
  dimension text not null check (dimension in ('subject','purpose','hook','format')),
  labels jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  approved_at timestamptz, created_at timestamptz not null default now(),
  primary key (client_id, taxonomy_version, dimension)
);
create table if not exists public.audn_post_classifications (
  client_id text not null, canonical_post_id text not null,
  taxonomy_version text not null, subject text not null default 'unknown',
  purpose text not null default 'unknown', hook text not null default 'unknown',
  format text not null default 'unknown', confidence numeric,
  source_ref text, classified_at timestamptz not null default now(),
  primary key (client_id, canonical_post_id, taxonomy_version)
);
alter table public.audn_taxonomy_versions enable row level security;
alter table public.audn_post_classifications enable row level security;
drop policy if exists service_role_all on public.audn_taxonomy_versions;
create policy service_role_all on public.audn_taxonomy_versions for all to service_role using (true) with check (true);
drop policy if exists service_role_all on public.audn_post_classifications;
create policy service_role_all on public.audn_post_classifications for all to service_role using (true) with check (true);
revoke all on public.audn_taxonomy_versions, public.audn_post_classifications from anon, authenticated;

create or replace view public.audn_classification_coverage_v
with (security_invoker = true) as
select i.client_id, i.canonical_post_id,
  coalesce(c.taxonomy_version, 'unversioned') as taxonomy_version,
  coalesce(c.subject, 'unknown') as subject,
  coalesce(c.purpose, 'unknown') as purpose,
  coalesce(c.hook, 'unknown') as hook,
  coalesce(nullif(c.format,'unknown'), i.format, 'unknown') as format,
  c.confidence, c.source_ref, c.classified_at,
  (c.canonical_post_id is not null) as classified
from public.audn_canonical_post_identity_v i
left join lateral (
  select x.* from public.audn_post_classifications x
  where x.client_id=i.client_id and x.canonical_post_id=i.canonical_post_id
  order by x.classified_at desc, x.taxonomy_version desc limit 1
) c on true;

create or replace function public.audn_measurement_payload(p_client_id text)
returns jsonb language sql security definer set search_path='public' as $$
select jsonb_build_object(
  'contract_version','2026-09-13.v1','client_id',p_client_id,
  'targets',jsonb_build_array(7,14),'tolerance_days',1,'cohort_days',90,
  'self_inclusive',true,'minimum_n',20,
  'snapshot_selection','nearest_target,captured_at_desc,id_desc',
  'quantile_method','type7_percentile_cont','standing_method','midpoint_empirical',
  'matched_age',coalesce((select jsonb_agg(to_jsonb(x) order by target_age_days,metric,canonical_post_id)
    from public.audn_metric_standing_v x where x.client_id=p_client_id),'[]'::jsonb),
  'monthly_trend',coalesce((select jsonb_agg(to_jsonb(x) order by month,target_age_days,metric)
    from public.audn_monthly_metric_trend_v x where x.client_id=p_client_id),'[]'::jsonb),
  'coverage',coalesce((select jsonb_agg(to_jsonb(x)) from public.audn_measurement_coverage_v x
    where x.client_id=p_client_id),'[]'::jsonb),
  'classifications',coalesce((select jsonb_agg(to_jsonb(x)) from public.audn_classification_coverage_v x
    where x.client_id=p_client_id),'[]'::jsonb)
);
$$;
revoke all on function public.audn_measurement_payload(text) from public, anon, authenticated;
grant execute on function public.audn_measurement_payload(text) to service_role;

create or replace function public.operator_audn_measurement(p_gate text, p_client_id text)
returns jsonb language plpgsql stable security definer set search_path='public' as $$
begin
  if not public.operator_gate_ok(p_gate) then
    raise exception 'unauthorized';
  end if;
  return public.audn_measurement_payload(p_client_id);
end;
$$;
comment on function public.operator_audn_measurement(text,text) is
  'Authenticated operator read surface for matched-age measurement. Uses the same operator_gate_ok boundary as existing operator RPCs.';
revoke all on function public.operator_audn_measurement(text,text) from public, anon;
grant execute on function public.operator_audn_measurement(text,text) to authenticated, service_role;

-- Preserve the established token/session authorization chain. The direct
-- measurement RPC remains service-role only; client boards receive the same
-- safe aggregate inside their already-authorized audience payload.
alter function public.audn_board_payload(text) rename to audn_board_payload_v15;
create or replace function public.audn_board_payload(p_client_id text)
returns jsonb language sql stable set search_path='public' as $$
with b as (select public.audn_board_payload_v15(p_client_id) payload),
standing as (
 select distinct on(canonical_post_id) canonical_post_id,target_age_days,standing_pct,eligible_n,status
 from public.audn_metric_standing_v where client_id=p_client_id and metric='engagement_count'
 order by canonical_post_id,eligible_n desc,target_age_days
)
select case when b.payload is null then null else b.payload || jsonb_build_object(
 'measurement',public.audn_measurement_payload(p_client_id),
 'posts',coalesce((select jsonb_agg(p || jsonb_build_object('rank',coalesce(p->'rank','{}') || jsonb_build_object(
   'standing_pct',s.standing_pct,'standing_status',s.status,'standing_basis','midpoint_empirical')) order by ord)
   from jsonb_array_elements(coalesce(b.payload->'posts','[]')) with ordinality x(p,ord)
   left join standing s on s.canonical_post_id=p->>'post_social_id'),'[]')) end from b;
$$;
comment on function public.audn_board_payload(text) is
  'Authorized board audience payload with additive safe measurement aggregate. Direct client-id measurement RPC is service-role only; token/session wrappers remain the public boundary.';
revoke all on function public.audn_board_payload(text) from public, anon, authenticated;
grant execute on function public.audn_board_payload(text) to service_role;

drop view if exists public.audn_board_payload_fixture_v;
