-- SwishDM scan requests remain a manual review queue. This migration does not enable intake.
create table if not exists public.swishdm_scan_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending_review' check (status in ('pending_review', 'rejected', 'qualified', 'archived')),
  brand text not null,
  brand_url text not null,
  brand_domain text not null unique,
  rival text not null,
  rival_url text,
  product text not null,
  name text not null,
  email text not null,
  linkedin_url text,
  source text not null check (source = 'form'),
  consent_at timestamptz not null default now()
);

create index if not exists swishdm_scan_requests_created_at_idx
  on public.swishdm_scan_requests (created_at desc);

alter table public.swishdm_scan_requests enable row level security;
revoke all on public.swishdm_scan_requests from public, anon, authenticated;
grant select, insert, update on public.swishdm_scan_requests to service_role;

create or replace function public.swishdm_scan_request_admit(p_request jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_domain text;
begin
  -- One lock covers duplicate and rolling-cap checks across concurrent requests.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('swishdm_scan_request_admit', 0));
  v_domain := pg_catalog.lower(pg_catalog.split_part(pg_catalog.split_part(p_request->>'brand_url', '/', 3), ':', 1));
  v_domain := pg_catalog.regexp_replace(v_domain, '^www\.', '');
  if exists (select 1 from public.swishdm_scan_requests where brand_domain = v_domain) then
    return 'duplicate';
  end if;
  if (select count(*) from public.swishdm_scan_requests where created_at > now() - interval '7 days') >= 15 then
    return 'full';
  end if;
  insert into public.swishdm_scan_requests
    (brand, brand_url, brand_domain, rival, rival_url, product, name, email, linkedin_url, source)
  values
    (p_request->>'brand', p_request->>'brand_url', v_domain, p_request->>'rival',
     p_request->>'rival_url', p_request->>'product', p_request->>'name',
     p_request->>'email', p_request->>'linkedin_url', p_request->>'source');
  return 'accepted';
end $$;

revoke all on function public.swishdm_scan_request_admit(jsonb) from public, anon, authenticated;
grant execute on function public.swishdm_scan_request_admit(jsonb) to service_role;
