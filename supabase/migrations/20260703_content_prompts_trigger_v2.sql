-- v2: (1) title changes also bump version so CAS covers title-only edits;
-- (2) attribution: flip to 'external' only when the writer set NEITHER
-- updated_by NOR updated_at — consecutive dashboard saves (which always set
-- updated_at) keep their 'dashboard' attribution.
create or replace function public.content_prompts_touch()
returns trigger language plpgsql as $$
begin
  if (new.body is distinct from old.body) or (new.title is distinct from old.title) then
    new.version := coalesce(old.version, 0) + 1;
    if (new.updated_by is not distinct from old.updated_by)
       and (new.updated_at is not distinct from old.updated_at) then
      new.updated_by := 'external';
    end if;
    new.updated_at := now();
  end if;
  return new;
end $$;
