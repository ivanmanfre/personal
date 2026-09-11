-- ============================================================================
-- Audience-learning 11 / benchmark payload for ivan-inbox › Strategy.
-- Ivan 2026-09-11: "this needs to be on inbox just like that" (the prototype
-- at claude.ai/code/artifact/9acf8fc2). One RPC returns, per lane, everything
-- the block renders: tiles, engagement by format, day×hour timing, account by
-- account, their posts worth studying, and the window it was read from.
--
-- Sources (all existing): competitor_posts (now client-scoped; NULL client_id
-- = Ivan's own lane, the tenancy rule), audn_post_metric_snapshots +
-- audn_snapshot_eligibility_v for the lane's own posts, client_registry roster
-- for roles. No table added. Reads only.
-- ============================================================================

alter table public.competitor_posts add column if not exists client_id text;
create index if not exists competitor_posts_client_date_idx
  on public.competitor_posts (client_id, post_date desc);

-- "Matej 🦩 Lancaric" / "Sam Nebel (goodwipes)" / "Sam Nebel" → 'sam nebel'
create or replace function public.audn_name_key(p text)
returns text language sql immutable as $$
  select array_to_string((regexp_split_to_array(
    trim(regexp_replace(regexp_replace(lower(coalesce(p, '')), '\(.*?\)', '', 'g'), '[^a-z ]', '', 'g')),
    '\s+'))[1:2], ' ')
$$;

-- Mean with the top and bottom 5 % cut once there are 10 or more values, so
-- one viral post cannot move it. Below 10 it is the plain mean.
create or replace function public.audn_smart_avg(arr numeric[])
returns numeric language sql immutable as $$
  with v as (select unnest(arr) as x), q as (
    select count(*) as n, percentile_cont(0.05) within group (order by x) as lo,
           percentile_cont(0.95) within group (order by x) as hi from v)
  select case when (select n from q) = 0 then null
              when (select n from q) < 10 then round(avg(x), 1)
              else round((select avg(x) from v, q where x between q.lo and q.hi), 1) end
  from v
$$;

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
    from competitor_posts
    where coalesce(client_id, 'ivan') = p_client_id
      and post_date is not null
      and coalesce(competitor_role, '') <> 'killed'
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
revoke all on function public.audn_name_key(text) from public, anon;
grant execute on function public.audn_name_key(text) to authenticated, service_role;
revoke all on function public.audn_smart_avg(numeric[]) from public, anon;
grant execute on function public.audn_smart_avg(numeric[]) to authenticated, service_role;
