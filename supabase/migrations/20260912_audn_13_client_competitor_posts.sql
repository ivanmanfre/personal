-- ============================================================================
-- Audience-learning 13 / client competitor posts get their own table.
-- 2026-09-11 loaded 930 RISE/ARCH study posts into competitor_posts with a new
-- client_id column. That table is read WITHOUT a client filter by Ivan's own
-- content pipeline (Contradiction Miner, Weekly Content Output Audit, Competitor
-- Alert Monitor, LM Curator, Competitor -> Ideas), so those rows leaked into
-- Ivan's lane. Fix: move every client-scoped row to audn_competitor_posts and
-- read the benchmark from both. competitor_posts goes back to Ivan-only rows
-- (client_id stays NULL on all of them; the column is left in place, unused).
-- ============================================================================

create table if not exists public.audn_competitor_posts (
  id uuid primary key default gen_random_uuid(),
  client_id text not null,
  competitor_name text,
  linkedin_profile_url text,
  post_date timestamptz,
  post_type text,
  likes_count int default 0,
  comments_count int default 0,
  reposts_count int default 0,
  linkedin_post_url text not null,
  post_text text,
  competitor_role text,
  why_it_worked text,
  suggested_angle text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, linkedin_post_url)
);
create index if not exists audn_competitor_posts_client_date_idx on public.audn_competitor_posts (client_id, post_date desc);
alter table public.audn_competitor_posts enable row level security;
drop policy if exists service_role_all on public.audn_competitor_posts;
create policy service_role_all on public.audn_competitor_posts for all to service_role using (true) with check (true);
revoke all on public.audn_competitor_posts from anon, authenticated;

insert into public.audn_competitor_posts
  (client_id, competitor_name, linkedin_profile_url, post_date, post_type, likes_count, comments_count, reposts_count,
   linkedin_post_url, post_text, competitor_role, why_it_worked, suggested_angle, created_at)
select client_id, competitor_name, linkedin_profile_url, post_date, post_type, likes_count, comments_count, reposts_count,
       linkedin_post_url, post_text, competitor_role, why_it_worked, suggested_angle, created_at
from public.competitor_posts
where client_id is not null
on conflict (client_id, linkedin_post_url) do nothing;

delete from public.competitor_posts where client_id is not null;

create or replace function public.audn_benchmark_payload(p_client_id text, p_days int default 90)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(p_days, 7));
  v_year  timestamptz := now() - interval '365 days';
  v_weeks numeric := greatest(p_days, 7) / 7.0;
  v_roster jsonb;
  v_out jsonb;
begin
  if p_client_id is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  select coalesce(platform->'measurement'->'roster', '[]'::jsonb) into v_roster
  from client_registry where client_id = p_client_id;
  if v_roster is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_client');
  end if;

  with roster as (
    select r->>'account' as account, r->>'role' as role, audn_name_key(r->>'account') as nk
    from jsonb_array_elements(v_roster) r
  ),
  src as (
    -- Ivan's lane: the legacy competitor_posts table (his scraper keeps it fresh).
    select competitor_name, post_date, post_type, likes_count, comments_count, linkedin_post_url, post_text,
           suggested_angle, why_it_worked, competitor_role
    from competitor_posts
    where p_client_id = 'ivan'
    union all
    -- Client lanes: the client-scoped table.
    select competitor_name, post_date, post_type, likes_count, comments_count, linkedin_post_url, post_text,
           suggested_angle, why_it_worked, competitor_role
    from audn_competitor_posts
    where p_client_id <> 'ivan' and client_id = p_client_id
  ),
  cp as (
    select competitor_name as who, post_date as at,
           case lower(coalesce(post_type, ''))
             when 'video' then 'video' when 'carousel' then 'carousel' when 'document' then 'carousel'
             when 'image' then 'image' when 'article' then 'article' else 'text' end as media,
           (coalesce(likes_count, 0) + coalesce(comments_count, 0))::numeric as eng,
           coalesce(likes_count, 0) as likes, coalesce(comments_count, 0) as comments,
           linkedin_post_url as url, left(coalesce(post_text, ''), 220) as text,
           suggested_angle as angle, why_it_worked as why,
           audn_name_key(competitor_name) as nk
    from src
    where post_date is not null and coalesce(competitor_role, '') <> 'killed'
  ),
  cpr as (
    select cp.*, coalesce((select r.role from roster r where r.nk = cp.nk limit 1), 'sweep') as role from cp
  ),
  c90 as (select * from cpr where at >= v_since),
  own_latest as (
    select distinct on (s.post_social_id) s.post_social_id,
           coalesce(s.reactions, 0) as reactions, coalesce(s.comments, 0) as comments, s.impressions
    from audn_post_metric_snapshots s
    where s.client_id = p_client_id
    order by s.post_social_id, s.captured_at desc
  ),
  own as (
    select o.*, (o.reactions + o.comments)::numeric as eng, e.published_at
    from own_latest o
    join (select distinct post_social_id, published_at from audn_snapshot_eligibility_v
          where client_id = p_client_id and published_at is not null) e using (post_social_id)
    where e.published_at >= v_since
  ),
  fmt as (
    select m.media,
           audn_smart_avg(array_agg(c.eng) filter (where c.eng is not null)) as theirs,
           count(c.eng) as n
    from (values ('text'), ('image'), ('video'), ('carousel'), ('article')) m(media)
    left join c90 c on c.media = m.media
    group by m.media
  ),
  heat as (
    select (extract(isodow from at at time zone 'UTC')::int - 1) as dow,
           extract(hour from at at time zone 'UTC')::int as h,
           count(*) as n, round(avg(eng)) as avg
    from cpr where at >= v_year
    group by 1, 2
  ),
  acc as (
    select who, min(role) as role, count(*) as n,
           round(count(*) / v_weeks, 1) as per_wk,
           percentile_cont(0.5) within group (order by eng) as median,
           audn_smart_avg(array_agg(eng)) as smart,
           mode() within group (order by media) as media,
           (array_agg(jsonb_build_object('eng', eng, 'url', url, 'text', left(text, 90)) order by eng desc))[1] as best
    from c90 group by who
  ),
  acc_rows as (
    select * from acc where role <> 'sweep' or n >= 3 order by smart desc nulls last limit 18
  ),
  ranked as (
    select *, row_number() over (partition by who order by eng desc) as rn from c90
  ),
  top as (
    select * from ranked where rn <= 3 order by eng desc limit 12
  ),
  you as (
    select count(*) as n, round(count(*) / v_weeks, 1) as per_wk,
           percentile_cont(0.5) within group (order by eng) as median,
           audn_smart_avg(array_agg(eng)) as smart,
           percentile_cont(0.5) within group (order by impressions) filter (where impressions is not null) as imp_median
    from own
  )
  select jsonb_build_object(
    'ok', true,
    'client_id', p_client_id,
    'days', greatest(p_days, 7),
    'read_at', now(),
    'roster', (select coalesce(jsonb_agg(jsonb_build_object('account', account, 'role', role)), '[]'::jsonb) from roster),
    'window', jsonb_build_object(
      'first', (select min(at)::date from cpr), 'last', (select max(at)::date from cpr),
      'posts', (select count(*) from cpr), 'posts90', (select count(*) from c90),
      'accounts90', (select count(distinct who) from c90)),
    'tiles', jsonb_build_object(
      'their_median', (select percentile_cont(0.5) within group (order by eng) from c90),
      'their_smart', (select audn_smart_avg(array_agg(eng)) from c90),
      'top_format', (select media from fmt where n >= 5 and theirs is not null order by theirs desc limit 1),
      'roster_pace', (select round(avg(per_wk), 1) from acc where role <> 'sweep'),
      'you', (select to_jsonb(you) from you)),
    'formats', (select jsonb_object_agg(media, jsonb_build_object('theirs', theirs, 'n', n)) from fmt),
    'heat', (select coalesce(jsonb_agg(to_jsonb(heat)), '[]'::jsonb) from heat),
    'accounts', (select coalesce(jsonb_agg(to_jsonb(acc_rows)), '[]'::jsonb) from acc_rows),
    'top', (select coalesce(jsonb_agg(jsonb_build_object(
              'who', who, 'role', role, 'at', at, 'media', media, 'eng', eng, 'likes', likes,
              'comments', comments, 'url', url, 'text', text, 'angle', angle, 'why', why)), '[]'::jsonb) from top)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.audn_benchmark_payload(text, int) from public, anon;
grant execute on function public.audn_benchmark_payload(text, int) to authenticated, service_role;
