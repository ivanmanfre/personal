-- Claude Code usage tracking
-- Source: local Mac + Railway-hosted Claude Code instance

create table if not exists public.claude_usage_sessions (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('local', 'railway')),
  session_id text not null,
  project_path text not null,
  primary_model text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0,
  cache_write_tokens bigint not null default 0,
  total_tokens bigint not null default 0,
  estimated_cost numeric(10, 4) not null default 0,
  message_count int not null default 0,
  sidechain_messages int not null default 0,
  last_synced_at timestamptz not null default now(),
  unique (source, session_id)
);

create index if not exists claude_usage_started_at_idx on public.claude_usage_sessions (started_at desc);
create index if not exists claude_usage_project_idx on public.claude_usage_sessions (project_path);
create index if not exists claude_usage_source_idx on public.claude_usage_sessions (source);

create or replace view public.claude_usage_daily as
select
  source,
  project_path,
  date_trunc('day', started_at) as day,
  sum(total_tokens)::bigint as total_tokens,
  sum(estimated_cost)::numeric(10,4) as estimated_cost,
  count(*) as session_count
from public.claude_usage_sessions
group by source, project_path, date_trunc('day', started_at);

create or replace function public.claude_usage_recent_sessions(p_days int, p_limit int)
returns setof public.claude_usage_sessions
language sql stable as $$
  select *
  from public.claude_usage_sessions
  where started_at >= now() - (p_days || ' days')::interval
  order by started_at desc
  limit p_limit;
$$;

create or replace function public.claude_usage_daily_totals(p_days int)
returns table (
  day date,
  source text,
  total_tokens bigint,
  estimated_cost numeric,
  session_count bigint
)
language sql stable as $$
  select day::date, source, sum(total_tokens)::bigint, sum(estimated_cost)::numeric,
         sum(session_count)::bigint
  from public.claude_usage_daily
  where day >= (current_date - p_days)
  group by day, source
  order by day desc;
$$;

create or replace function public.claude_usage_by_project(p_days int)
returns table (
  project_path text,
  source text,
  total_tokens bigint,
  estimated_cost numeric,
  session_count bigint,
  last_session timestamptz
)
language sql stable as $$
  select project_path, source,
         sum(total_tokens)::bigint,
         sum(estimated_cost)::numeric,
         count(*)::bigint,
         max(started_at)
  from public.claude_usage_sessions
  where started_at >= now() - (p_days || ' days')::interval
  group by project_path, source
  order by sum(estimated_cost) desc;
$$;

grant execute on function public.claude_usage_recent_sessions(int, int) to anon, authenticated;
grant execute on function public.claude_usage_daily_totals(int) to anon, authenticated;
grant execute on function public.claude_usage_by_project(int) to anon, authenticated;
