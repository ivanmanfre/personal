-- supabase/migrations/20260704_image_edit_versions.sql
create table if not exists public.image_edit_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id text not null,
  image_index int not null default 0,
  prev_url text,
  new_url text not null,
  op text,
  prompt text,
  created_at timestamptz not null default now()
);
create index if not exists image_edit_versions_draft_idx on public.image_edit_versions (draft_id, created_at desc);
