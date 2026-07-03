-- Full-body version history for content_prompts (the existing prompt_version_log
-- stores only md5 hashes; the dashboard history/diff drawer needs the real body).
-- Additive: leaves the existing content_prompts_touch / log_prompt_version triggers
-- untouched; a separate SECURITY DEFINER trigger snapshots each new version's body.
-- Applied to project bjbvqvzbzczjbatgmccb 2026-07-03 (backfill: 76 prompts).

create table if not exists public.content_prompt_versions (
  id         bigint generated always as identity primary key,
  slug       text not null,
  version    integer not null,
  title      text,
  body       text,
  updated_by text,
  changed_at timestamptz not null default now(),
  unique (slug, version)
);

create index if not exists content_prompt_versions_slug_idx
  on public.content_prompt_versions (slug, version desc);

-- RLS off to mirror content_prompts (dashboard reads via anon grants).
grant select on public.content_prompt_versions to anon, authenticated;
grant insert on public.content_prompt_versions to anon, authenticated, service_role;

create or replace function public.snapshot_prompt_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (TG_OP = 'INSERT') or (NEW.version is distinct from OLD.version) then
    insert into public.content_prompt_versions (slug, version, title, body, updated_by, changed_at)
    values (NEW.slug, NEW.version, NEW.title, NEW.body, NEW.updated_by, coalesce(NEW.updated_at, now()))
    on conflict (slug, version) do nothing;
  end if;
  return NEW;
end;
$$;

create or replace trigger trg_snapshot_prompt_version
  after insert or update on public.content_prompts
  for each row execute function public.snapshot_prompt_version();

-- Seed the current state as each prompt's current-version snapshot.
insert into public.content_prompt_versions (slug, version, title, body, updated_by, changed_at)
select slug, coalesce(version, 1), title, body, updated_by, coalesce(updated_at, now())
from public.content_prompts
on conflict (slug, version) do nothing;
