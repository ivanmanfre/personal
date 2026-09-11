-- ============================================================================
-- Audience-learning 12 / themes of the lane's OWN posts (ivan-inbox › Strategy).
-- Ivan 2026-09-12: "I want to produce for outliers ... Poland and a polemic
-- topic ... that's why it is an outlier." → a block that groups his posts by
-- theme and angle, shows the best and the median per theme, and who engaged
-- with their fit score, so an outlier can be read as a content bet (agency
-- owners) or a reach bet (Polish peers).
--
-- New table audn_post_themes: one judged (theme, angle) per own post, written
-- by the tagger (Railway proxy, never the Anthropic API). Untagged posts still
-- render under 'untagged' so nothing silently disappears.
-- ============================================================================

create table if not exists public.audn_post_themes (
  client_id text not null,
  post_social_id text not null,
  theme text not null,
  angle text,
  confidence numeric,
  model text,
  judged_at timestamptz not null default now(),
  primary key (client_id, post_social_id)
);
alter table public.audn_post_themes enable row level security;
drop policy if exists service_role_all on public.audn_post_themes;
create policy service_role_all on public.audn_post_themes for all to service_role using (true) with check (true);
revoke all on public.audn_post_themes from anon, authenticated;

create or replace function public.audn_themes_payload(p_client_id text, p_days int default 180)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_since timestamptz := now() - make_interval(days => greatest(p_days, 30));
  v_out jsonb;
begin
  if p_client_id is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  if not exists (select 1 from client_registry where client_id = p_client_id) then
    return jsonb_build_object('ok', false, 'error', 'unknown_client');
  end if;

  with own as (
    -- Ivan's lane reads his own-post table; other lanes read the client post
    -- metrics table. Both carry impressions, reactions, comments and a URL.
    select o.social_id, o.posted_at as at, coalesce(o.num_impressions, 0) as imp,
           (coalesce(o.num_likes, 0) + coalesce(o.num_comments, 0))::numeric as eng,
           left(coalesce(o.post_text, ''), 200) as text, o.linkedin_url as url
    from own_posts o
    where p_client_id = 'ivan' and o.posted_at >= v_since and coalesce(o.num_impressions, 0) > 0
    union all
    select m.social_id, m.published_at, coalesce(m.impressions, 0),
           (coalesce(m.reactions, 0) + coalesce(m.comments, 0))::numeric,
           left(coalesce(m.title, ''), 200), m.post_url
    from client_post_metrics m
    where p_client_id <> 'ivan' and m.client_id = p_client_id and m.published_at >= v_since
  ),
  tagged as (
    select own.*, coalesce(t.theme, 'untagged') as theme, t.angle
    from own left join audn_post_themes t
      on t.client_id = p_client_id and t.post_social_id = own.social_id
  ),
  eng as (
    select e.post_social_id,
           count(distinct coalesce(e.member_id, e.provider_id, e.linkedin_url, e.name)) as people,
           count(distinct coalesce(e.member_id, e.provider_id, e.linkedin_url, e.name)) filter (where e.icp_score >= 7) as fit
    from post_engagers e
    where e.post_social_id in (select social_id from own)
    group by e.post_social_id
  ),
  per_post as (
    select t.*, coalesce(g.people, 0) as people, coalesce(g.fit, 0) as fit
    from tagged t left join eng g on g.post_social_id = t.social_id
  ),
  ranked as (
    select *, row_number() over (partition by theme order by imp desc, eng desc) as rn from per_post
  ),
  themes as (
    select theme, count(*) as n,
           percentile_cont(0.5) within group (order by imp) as median_imp,
           percentile_cont(0.5) within group (order by eng) as median_eng,
           max(imp) as best_imp,
           sum(people) as people, sum(fit) as fit,
           (select jsonb_object_agg(a, c) from (
              select coalesce(angle, 'unknown') as a, count(*) as c from per_post p2 where p2.theme = r.theme group by 1) x) as angles,
           (select jsonb_agg(jsonb_build_object('at', at, 'imp', imp, 'eng', eng, 'url', url, 'text', text,
                                                'angle', angle, 'people', people, 'fit', fit) order by rn)
              from ranked r2 where r2.theme = r.theme and r2.rn <= 3) as posts
    from ranked r
    group by theme
  )
  select jsonb_build_object(
    'ok', true,
    'client_id', p_client_id,
    'days', greatest(p_days, 30),
    'read_at', now(),
    'posts_total', (select count(*) from per_post),
    'untagged', (select count(*) from per_post where theme = 'untagged'),
    'themes', (select coalesce(jsonb_agg(jsonb_build_object(
                 'theme', theme, 'n', n, 'median_imp', median_imp, 'median_eng', median_eng,
                 'best_imp', best_imp, 'people', people, 'fit', fit, 'angles', angles, 'posts', posts)
               order by best_imp desc), '[]'::jsonb) from themes)
  ) into v_out;
  return v_out;
end;
$$;

revoke all on function public.audn_themes_payload(text, int) from public, anon;
grant execute on function public.audn_themes_payload(text, int) to authenticated, service_role;
