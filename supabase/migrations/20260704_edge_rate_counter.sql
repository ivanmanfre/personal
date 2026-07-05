-- Per-IP fixed-window rate limiter for the paid image edge functions
-- (img-edit, img-segment). One row per (minute-bucket, ip, fn); bump_edge_rate
-- atomically increments and returns whether the caller is still under the limit.
create table if not exists public.edge_rate_counter (
  bucket bigint not null,
  ip text not null,
  fn text not null,
  count int not null default 0,
  primary key (bucket, ip, fn)
);

create or replace function public.bump_edge_rate(p_bucket bigint, p_ip text, p_fn text, p_limit int)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count int;
begin
  insert into public.edge_rate_counter (bucket, ip, fn, count)
  values (p_bucket, p_ip, p_fn, 1)
  on conflict (bucket, ip, fn) do update set count = public.edge_rate_counter.count + 1
  returning count into v_count;
  return v_count <= p_limit;
end;
$$;
