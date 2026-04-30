-- Phase 3 — public-facing RPC for the eat-your-own-cooking case study.
-- Returns ONLY sanitized aggregate metrics. No PII, no client names,
-- no engagement data, no revenue. Safe for anon read.
-- Paired with: components/CaseStudyOwnEngine.tsx + lib/ownEngineMetrics.ts

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
      (select count(*)::int from public.scheduled_posts
        where status = 'pending') as posts_in_queue,
      (select count(*)::int from public.dashboard_workflow_stats
        where is_active = true) as active_workflows,
      (select round((avg(extract(epoch from posted_at - created_at) / 86400.0))::numeric, 1)
        from public.scheduled_posts
        where status = 'posted' and posted_at is not null) as avg_days_queue_to_live,
      (select max(posted_at) from public.own_posts) as last_post_at
  )
  select json_build_object(
    'posts_shipped_quarter', posts_shipped_quarter,
    'posts_in_queue',        posts_in_queue,
    'active_workflows',      active_workflows,
    'avg_days_queue_to_live',avg_days_queue_to_live,
    'last_post_at',          last_post_at,
    'as_of',                 now()
  ) from metrics;
$$;

grant execute on function public.public_engine_metrics() to anon, authenticated;

comment on function public.public_engine_metrics() is
  'Sanitized aggregate metrics for /case-studies/own-content-engine. Public read.';
