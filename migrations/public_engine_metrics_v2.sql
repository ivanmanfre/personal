-- v2: stronger metric set. Drops "avg days queue→live" and "posts in queue".
-- Adds lead_magnets, outreach_messages, recordings counts.
-- Also adds recent_own_posts(p_limit) for the LinkedIn posts gallery.

create or replace function public.public_engine_metrics()
returns json
language sql
security definer
set search_path = public
stable
as $$
  with metrics as (
    select
      (select count(*)::int from public.own_posts
        where posted_at >= date_trunc('quarter', now())) as posts_shipped_quarter,
      (select count(*)::int from public.own_posts) as posts_lifetime,
      (select count(*)::int from public.lead_magnets
        where created_at >= date_trunc('quarter', now())) as lead_magnets_quarter,
      (select count(*)::int from public.outreach_messages
        where created_at >= date_trunc('quarter', now())) as outreach_messages_quarter,
      (select count(*)::int from public.dashboard_workflow_stats
        where is_active = true) as active_workflows,
      (select max(posted_at) from public.own_posts) as last_post_at,
      (select count(*)::int from public.recordings) as recordings_lifetime
  )
  select json_build_object(
    'posts_shipped_quarter',     posts_shipped_quarter,
    'posts_lifetime',            posts_lifetime,
    'lead_magnets_quarter',      lead_magnets_quarter,
    'outreach_messages_quarter', outreach_messages_quarter,
    'active_workflows',          active_workflows,
    'recordings_lifetime',       recordings_lifetime,
    'last_post_at',              last_post_at,
    'as_of',                     now()
  ) from metrics;
$$;

grant execute on function public.public_engine_metrics() to anon, authenticated;

create or replace function public.recent_own_posts(p_limit int default 6)
returns table (
  id uuid,
  post_text text,
  linkedin_url text,
  posted_at timestamptz,
  post_type text,
  num_likes int,
  num_comments int,
  num_shares int
)
language sql
security definer
set search_path = public
stable
as $$
  select id, post_text, linkedin_url, posted_at, post_type,
         coalesce(num_likes, 0), coalesce(num_comments, 0), coalesce(num_shares, 0)
  from public.own_posts
  where posted_at is not null
    and linkedin_url ilike 'https://%'
  order by posted_at desc
  limit greatest(1, least(p_limit, 12));
$$;

grant execute on function public.recent_own_posts(int) to anon, authenticated;

comment on function public.recent_own_posts(int) is
  'Recent published LinkedIn posts for the eat-your-own-cooking case study gallery. Public read.';
