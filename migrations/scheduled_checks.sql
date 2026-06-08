-- scheduled_checks: time-based review reminders surfaced on the dashboard (Operations ▸ Checks)
-- and pinged over WhatsApp on/after due date. Generic "review X in N weeks" parking lot.
-- Created 2026-06-07 (first tenant: Body of Work POV-anchor impact review).

create table if not exists public.scheduled_checks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  detail text,
  category text not null default 'review',     -- review | audit | decision | followup
  due_date date not null,
  status text not null default 'pending',       -- pending | reviewed | dismissed
  link text,                                     -- optional dashboard route / url to jump to
  source text,                                   -- what created it (e.g. body-of-work-pilot)
  notify_whatsapp boolean not null default true,
  notified_at timestamptz,                       -- last WhatsApp ping (dedup so we ping once/day max)
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists scheduled_checks_due_idx
  on public.scheduled_checks (due_date) where status = 'pending';

-- keep updated_at fresh
create or replace function public.touch_scheduled_checks() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  if new.status in ('reviewed','dismissed') and new.completed_at is null then
    new.completed_at = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_touch_scheduled_checks on public.scheduled_checks;
create trigger trg_touch_scheduled_checks before update on public.scheduled_checks
  for each row execute function public.touch_scheduled_checks();

-- status view: computed days_until + state bucket for the panel
create or replace view public.scheduled_checks_status as
select
  c.*,
  (c.due_date - current_date) as days_until,
  case
    when c.status in ('reviewed','dismissed') then 'done'
    when c.due_date <= current_date          then 'due'
    when c.due_date <= current_date + 7       then 'upcoming'
    else 'scheduled'
  end as state
from public.scheduled_checks c;

-- anon access — dashboard reads + writes (mark reviewed / snooze) via the public anon key,
-- matching the existing dashboard posture (contacts/posts already anon-writable).
alter table public.scheduled_checks enable row level security;
drop policy if exists scheduled_checks_anon_rw on public.scheduled_checks;
create policy scheduled_checks_anon_rw on public.scheduled_checks
  for all to anon using (true) with check (true);

grant select, insert, update on public.scheduled_checks to anon;
grant select on public.scheduled_checks_status to anon;
