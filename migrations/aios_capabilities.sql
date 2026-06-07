-- aios_capabilities: roster of every AIOS capability for the System overview.
create table if not exists public.aios_capabilities (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('skill','command','panel','integration','edge_fn')),
  slug         text not null,
  name         text not null,
  description  text,
  "group"      text,
  source_path  text,
  last_used_at timestamptz,
  invoke_count integer not null default 0,
  status       text not null default 'live' check (status in ('live','draft','deprecated')),
  metadata     jsonb not null default '{}'::jsonb,
  synced_at    timestamptz not null default now(),
  unique (kind, slug)
);

create index if not exists aios_capabilities_kind_idx  on public.aios_capabilities (kind);
create index if not exists aios_capabilities_group_idx on public.aios_capabilities ("group");

alter table public.aios_capabilities enable row level security;

-- Read access for the dashboard (anon), matching sibling read-only tables.
drop policy if exists aios_capabilities_read on public.aios_capabilities;
create policy aios_capabilities_read on public.aios_capabilities
  for select using (true);
-- Writes happen only via the service-role key in the sync script (bypasses RLS).

-- Returns the full roster ordered for display, plus per-kind counts.
create or replace function public.aios_capabilities_overview()
returns table (
  kind text, slug text, name text, description text, "group" text,
  source_path text, last_used_at timestamptz, invoke_count integer,
  status text, metadata jsonb
)
language sql stable
as $$
  select kind, slug, name, description, "group", source_path,
         last_used_at, invoke_count, status, metadata
  from public.aios_capabilities
  where status <> 'deprecated'
  order by kind, "group" nulls last, name;
$$;

grant execute on function public.aios_capabilities_overview() to anon, authenticated;
