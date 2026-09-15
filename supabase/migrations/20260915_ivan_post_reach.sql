begin;
-- Narrow read path for Ivan's own dashboard (Health > Overview): who each of HIS posts
-- reached. client_post_metrics keeps RLS with only the service_role policy; this function
-- returns ONLY client_id='ivan' rows and ONLY post_url + meta->network + meta->demographics,
-- latest capture per post_url. No table-wide grant or policy changes.
create or replace function public.ivan_post_reach()
returns table (post_url text, captured_at timestamptz, network jsonb, demographics jsonb)
language sql stable security definer
set search_path = pg_catalog, public, pg_temp
as $function$
  select distinct on (m.post_url)
    m.post_url,
    coalesce(
      case when (m.meta->'network'->>'captured_at') ~ '^\d{4}-\d{2}-\d{2}'
           then (m.meta->'network'->>'captured_at')::timestamptz end,
      m.captured_at
    ) as captured_at,
    m.meta->'network' as network,
    m.meta->'demographics' as demographics
  from public.client_post_metrics m
  where m.client_id = 'ivan'
    and m.post_url is not null
    and (m.meta ? 'network' or m.meta ? 'demographics')
  order by m.post_url,
    coalesce(
      case when (m.meta->'network'->>'captured_at') ~ '^\d{4}-\d{2}-\d{2}'
           then (m.meta->'network'->>'captured_at')::timestamptz end,
      m.captured_at
    ) desc nulls last
$function$;

revoke all on function public.ivan_post_reach() from public, anon;
grant execute on function public.ivan_post_reach() to authenticated;
commit;
