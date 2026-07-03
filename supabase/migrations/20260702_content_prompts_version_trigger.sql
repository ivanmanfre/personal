-- Version bumps must happen for ANY writer (dashboard, n8n, sync workflows),
-- otherwise a revert re-uses the old version and the UI shows "unchanged".
create or replace function public.content_prompts_touch()
returns trigger language plpgsql as $$
begin
  if new.body is distinct from old.body then
    new.version := coalesce(old.version, 0) + 1;
    new.updated_at := now();
    -- Writer that did not identify itself = external system.
    if new.updated_by is not distinct from old.updated_by then
      new.updated_by := 'external';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists content_prompts_version_bump on public.content_prompts;
create trigger content_prompts_version_bump
  before update on public.content_prompts
  for each row execute function public.content_prompts_touch();
