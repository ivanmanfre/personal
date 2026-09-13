-- ============================================================================
-- Audience-learning 15 / baselines: where a post lands against its own author.
--
-- Ivan, 2026-09-13, recalling the Imagine AI method: "he will measure the content
-- on performance per baseline impressions... P90, P70". Their own paper fits a
-- log-normal PER ACCOUNT (p50 49 / p75 77 / p90 145 reactions, about two thirds of
-- an account's posts between half and double its own median). The 2026-09-09 review
-- rejected reusing THEIR numbers, because those percentiles are taken across
-- accounts, not across posts. What survives is the shape of the idea: score every
-- post against the distribution of the account that published it.
--
-- Two things are added to audn_benchmark_payload, nothing is removed:
--   own_dist / own_recent : this lane's own baseline (engagement and engagement per
--       1,000 impressions) with each recent post's percentile inside it. Impressions
--       exist ONLY for our own posts, so the per-1,000 read is available here and
--       nowhere else on the page.
--   lift / author_pct     : on every competitor post we surface, how far it beat the
--       median of ITS OWN author, and where it sits in that author's spread. A post
--       from a 40k-follower account that matched its author's median is ordinary; a
--       post that trebled its author's median is the one worth reading. Raw
--       engagement alone ranks account size.
--
-- Floors, so a small sample cannot dress itself up as a reading:
--   own percentiles need OWN_MIN posts in the window (Arch has 9 and is told so);
--   an author's lift needs AUTHOR_MIN posts.
-- ============================================================================

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
  v_own_min int := 20;   -- fewer own posts than this: percentiles are withheld
  v_author_min int := 8; -- fewer posts by an author: no lift is claimed for them
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
    select competitor_name, post_date, post_type, likes_count, comments_count, linkedin_post_url, post_text,
           suggested_angle, why_it_worked, competitor_role
    from competitor_posts
    where p_client_id = 'ivan'
    union all
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
  -- every author's own shape inside the window: the yardstick each of their posts is held to
  author_base as (
    select who,
           count(*) as n,
           percentile_cont(0.5) within group (order by eng) as med,
           percentile_cont(0.9) within group (order by eng) as p90
    from c90 group by who
  ),
  c90b as (
    select c.*, b.n as author_n, b.med as author_med, b.p90 as author_p90,
           case when b.n >= v_author_min and b.med > 0 then round((c.eng / b.med)::numeric, 2) end as lift,
           -- midpoint of the tie block, not its top edge: with many equal posts the upper
           -- bound would report a median post as if it had beaten two thirds of the others.
           case when b.n >= v_author_min then
             round(100.0 * ((select count(*) from c90 x where x.who = c.who and x.eng < c.eng)
                            + 0.5 * (select count(*) from c90 x where x.who = c.who and x.eng = c.eng)) / b.n)
           end as author_pct
    from c90 c join author_base b using (who)
  ),
  own_latest as (
    select distinct on (s.post_social_id) s.post_social_id,
           coalesce(s.reactions, 0) as reactions, coalesce(s.comments, 0) as comments, s.impressions
    from audn_post_metric_snapshots s
    where s.client_id = p_client_id
    order by s.post_social_id, s.captured_at desc
  ),
  own as (
    select o.*, (o.reactions + o.comments)::numeric as eng, e.published_at,
           case when o.impressions > 0 then round(1000.0 * (o.reactions + o.comments) / o.impressions, 1) end as per1k
    from own_latest o
    join (select distinct post_social_id, published_at from audn_snapshot_eligibility_v
          where client_id = p_client_id and published_at is not null) e using (post_social_id)
    where e.published_at >= v_since
  ),
  own_n as (select count(*) as n from own),
  own_base as (
    select (select n from own_n) as n,
           percentile_cont(0.5) within group (order by eng) as p50,
           percentile_cont(0.75) within group (order by eng) as p75,
           percentile_cont(0.9) within group (order by eng) as p90,
           max(eng) as best,
           count(per1k) as n_imp,
           percentile_cont(0.5) within group (order by per1k) filter (where per1k is not null) as k50,
           percentile_cont(0.75) within group (order by per1k) filter (where per1k is not null) as k75,
           percentile_cont(0.9) within group (order by per1k) filter (where per1k is not null) as k90
    from own
  ),
  -- the lane's own words, where a table holds them: Ivan's scored posts, clients' metric rows
  own_text as (
    select social_id as post_social_id, left(coalesce(post_text, ''), 160) as text, linkedin_url as url
    from own_posts_scored where p_client_id = 'ivan'
    union all
    select social_id, left(coalesce(title, ''), 160), null
    from client_post_metrics where p_client_id <> 'ivan' and client_id = p_client_id
  ),
  own_recent as (
    select o.published_at, o.eng, o.impressions, o.per1k,
           case when (select n from own_n) >= v_own_min then
             round(100.0 * ((select count(*) from own x where x.eng < o.eng)
                            + 0.5 * (select count(*) from own x where x.eng = o.eng)) / (select n from own_n))
           end as pct,
           (select t.text from own_text t where t.post_social_id = o.post_social_id limit 1) as text,
           (select t.url from own_text t where t.post_social_id = o.post_social_id limit 1) as url
    from own o
    order by o.published_at desc
    limit 14
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
    select c.who, min(c.role) as role, count(*) as n,
           round(count(*) / v_weeks, 1) as per_wk,
           percentile_cont(0.5) within group (order by c.eng) as median,
           audn_smart_avg(array_agg(c.eng)) as smart,
           percentile_cont(0.9) within group (order by c.eng) as p90,
           mode() within group (order by c.media) as media,
           (array_agg(jsonb_build_object('eng', c.eng, 'url', c.url, 'text', left(c.text, 90)) order by c.eng desc))[1] as best
    from c90 c group by c.who
  ),
  acc_rows as (
    select * from acc where role <> 'sweep' or n >= 3 order by smart desc nulls last limit 18
  ),
  ranked as (
    select *, row_number() over (partition by who order by eng desc) as rn from c90b
  ),
  top as (
    select * from ranked where rn <= 3 order by eng desc limit 12
  ),
  -- the same posts read the other way round: biggest jump over the author's own median
  outliers as (
    select * from c90b
    where lift is not null and author_n >= v_author_min and eng > 0
    order by lift desc limit 12
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
    'floors', jsonb_build_object('own_min', v_own_min, 'author_min', v_author_min),
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
    'own_dist', (select to_jsonb(own_base) from own_base),
    'own_recent', (select coalesce(jsonb_agg(to_jsonb(own_recent)), '[]'::jsonb) from own_recent),
    'formats', (select jsonb_object_agg(media, jsonb_build_object('theirs', theirs, 'n', n)) from fmt),
    'heat', (select coalesce(jsonb_agg(to_jsonb(heat)), '[]'::jsonb) from heat),
    'accounts', (select coalesce(jsonb_agg(to_jsonb(acc_rows)), '[]'::jsonb) from acc_rows),
    'top', (select coalesce(jsonb_agg(jsonb_build_object(
              'who', who, 'role', role, 'at', at, 'media', media, 'eng', eng, 'likes', likes,
              'comments', comments, 'url', url, 'text', text, 'angle', angle, 'why', why,
              'author_med', author_med, 'author_n', author_n, 'lift', lift, 'author_pct', author_pct)), '[]'::jsonb) from top),
    'outliers', (select coalesce(jsonb_agg(jsonb_build_object(
              'who', who, 'role', role, 'at', at, 'media', media, 'eng', eng, 'likes', likes,
              'comments', comments, 'url', url, 'text', text, 'angle', angle, 'why', why,
              'author_med', author_med, 'author_n', author_n, 'lift', lift, 'author_pct', author_pct)), '[]'::jsonb) from outliers)
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.audn_benchmark_payload(text, int) from public, anon;
grant execute on function public.audn_benchmark_payload(text, int) to authenticated, service_role;
