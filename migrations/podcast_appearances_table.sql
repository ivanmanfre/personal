-- Track 4 — podcast distribution. Auto-grows the "Recent appearances"
-- section on /podcast as new episodes ship.

create table if not exists public.podcast_appearances (
  id uuid primary key default gen_random_uuid(),
  show_name text not null,
  host text,
  episode_title text,
  episode_url text,
  episode_summary text,
  recorded_at timestamptz,
  published_at timestamptz,
  utm_tag text,
  is_published boolean not null default false,
  display_order int not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists idx_podcast_appearances_published_at
  on public.podcast_appearances(published_at desc) where is_published;
create index if not exists idx_podcast_appearances_display_order
  on public.podcast_appearances(display_order);

comment on table public.podcast_appearances is
  'Iván''s podcast appearances. Public-read for /podcast page.';

alter table public.podcast_appearances enable row level security;

drop policy if exists "Public read published" on public.podcast_appearances;
create policy "Public read published"
  on public.podcast_appearances
  for select
  to anon, authenticated
  using (is_published = true);
