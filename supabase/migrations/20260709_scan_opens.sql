-- scan_opens: per-prospect open tracking for /scan/<slug> hypertarget pages.
-- Written ONLY by the `scan-open` edge function (service role). The edge fn
-- stamps the request IP server-side and decides is_owner two ways:
--   1. owner_flag from the client (dashboard-authed browser, or ?me=1 opt-out)
--   2. the request IP matches a known-owner IP in owner_ips
-- Any open with owner_flag=true auto-teaches its IP into owner_ips, so Ivan's
-- home / office / phone IPs self-seed and later opens from them (even incognito
-- or a raw click of a sent link) are excluded. The dashboard reads the
-- scan_open_stats view, which only ever surfaces real (non-owner) opens.

create table if not exists public.scan_opens (
  id            bigint generated always as identity primary key,
  company_slug  text not null,
  opened_at     timestamptz not null default now(),
  is_owner      boolean not null default false,
  device_type   text,
  referrer_host text,
  ip_hash       text,
  user_agent    text
);

create index if not exists idx_scan_opens_slug_time
  on public.scan_opens (company_slug, opened_at desc);

-- Known-owner IPs, hashed. Self-seeded whenever Ivan opens a scan while
-- dashboard-authed (owner_flag=true). last_seen lets us age stale IPs later.
create table if not exists public.owner_ips (
  ip_hash    text primary key,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  note       text
);

-- Aggregate view the dashboard reads. Runs with definer (owner) rights so it
-- can read scan_opens under RLS; exposes only per-slug aggregates, no IPs/UAs.
create or replace view public.scan_open_stats as
  select
    company_slug,
    count(*) filter (where not is_owner)                    as real_opens,
    count(*)                                                as total_opens,
    max(opened_at) filter (where not is_owner)             as last_real_open,
    count(distinct date_trunc('day', opened_at))
      filter (where not is_owner)                          as real_open_days
  from public.scan_opens
  group by company_slug;

-- Lock the raw tables down: service role only (edge fn). No anon/auth access.
alter table public.scan_opens enable row level security;
alter table public.owner_ips  enable row level security;

-- The aggregate view is safe to expose to the dashboard's anon client.
grant select on public.scan_open_stats to anon, authenticated;
