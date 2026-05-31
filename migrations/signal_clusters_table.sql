-- Signal Clusters: weekly cross-conversation theme clusters (content + sales)
create table if not exists public.signal_clusters (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  bucket text not null check (bucket in ('content', 'sales')),
  theme text not null,
  summary text,
  frequency int not null default 0,
  quotes jsonb not null default '[]'::jsonb,        -- [{text, source, date}]
  source_mix jsonb not null default '{}'::jsonb,    -- {calls, dms, email}
  suggested_action text,
  created_at timestamptz not null default now()
);

create index if not exists signal_clusters_run_date_idx on public.signal_clusters (run_date desc);
create index if not exists signal_clusters_bucket_idx on public.signal_clusters (bucket);

alter table public.signal_clusters enable row level security;

-- anon: read-only (dashboard reads via anon key); service_role: full (n8n writes)
drop policy if exists signal_clusters_anon_select on public.signal_clusters;
create policy signal_clusters_anon_select on public.signal_clusters
  for select to anon using (true);

drop policy if exists signal_clusters_service_all on public.signal_clusters;
create policy signal_clusters_service_all on public.signal_clusters
  for all to service_role using (true) with check (true);
