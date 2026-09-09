-- ============================================================================
-- Audience-learning measurement foundation — 02 / tables.
-- goal-run audience-learning-02-foundation-2026-09-09, foundation seat.
-- Worklist: W09 (append-only metric snapshots), W06-table (collection coverage).
--
-- These are the only two new physical tables in the foundation. Everything else
-- is a view over storage that already exists (DATA-CONTRACT: "the one
-- demonstrated gap with a named consumer").
--
-- Runs AFTER 01_functions and BEFORE every view migration (C6). The blanket
-- "views first, tables second" instruction from the Run 04 template is unsafe:
-- 06_views_snapshots_coverage reads audn_post_metric_snapshots, so the table
-- has to exist first or the view creation fails outright.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- audn_post_metric_snapshots — append-only metric history (§3.7).
--
-- Today client_post_metrics holds ONE value per post and Performance Sync
-- overwrites it; own_posts.num_* is overwritten the same way. There is no
-- history, so matched-age rank and monthly median cannot be computed and
-- historical snapshots can never be reconstructed (D04) — this table starts
-- collecting forward, it never backfills a past age.
--
-- Identity is (client_id, post_social_id, cycle_id):
--   * the SAME cycle retried upserts into the SAME row — a retry is not a
--     second observation (fixture `duplicate-job-retry`);
--   * a NEW cycle inserts a NEW row;
--   * an earlier row is never updated by a later cycle.
-- The writer therefore always uses:
--   insert ... on conflict (client_id, post_social_id, cycle_id) do update set ...
--
-- target_age_days is nullable here on purpose. §3.7: the age bucket is assigned
-- by audn_snapshot_eligibility_v from the real captured_at - published_at
-- distance, NOT by the collector. The check constraint only keeps a writer that
-- does declare one honest.
-- ---------------------------------------------------------------------------
create table if not exists public.audn_post_metric_snapshots (
  id              bigserial primary key,
  client_id       text        not null,
  post_social_id  text        not null,
  cycle_id        text        not null,
  captured_at     timestamptz not null,
  target_age_days int         null,
  actual_age_days numeric     null,
  impressions     int         null,
  reactions       int         null,
  comments        int         null,
  shares          int         null,
  source          text        not null,
  coverage        jsonb       not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint audn_post_metric_snapshots_cycle_uk
    unique (client_id, post_social_id, cycle_id),
  constraint audn_post_metric_snapshots_target_age_ck
    check (target_age_days is null or target_age_days in (7, 14))
);

comment on table public.audn_post_metric_snapshots is
  'Append-only per-cycle metric observations. One row per (client_id, post_social_id, cycle_id); a retried cycle upserts, a new cycle inserts. Historical snapshots are not reconstructible (Run 01 D04).';

create index if not exists audn_post_metric_snapshots_post_idx
  on public.audn_post_metric_snapshots (client_id, post_social_id, captured_at);

-- ---------------------------------------------------------------------------
-- audn_post_collection_coverage — why a post has no events (§3.8).
--
-- A post with zero interaction rows is ambiguous: nobody engaged, or the
-- collector never looked. Ivan's logger only reads the 12 most recent own_posts
-- per run, so 225 of 251 posts have never been visited at all. Without this
-- table a zero would be manufactured from silence, which §3.9 forbids.
--
-- status:
--   'collected'     — the collector visited and reports what it found
--   'not_collected' — never visited, or the visit failed; counts are UNKNOWN
--   'not_eligible'  — deliberately out of scope (e.g. before history_start)
-- A post with zero events and NO row here is 'not_collected' by definition.
-- ---------------------------------------------------------------------------
create table if not exists public.audn_post_collection_coverage (
  client_id       text        not null,
  post_social_id  text        not null,
  last_visited_at timestamptz null,
  visits          int         not null default 0,
  status          text        null,
  note            text        null,
  updated_at      timestamptz not null default now(),
  constraint audn_post_collection_coverage_pk
    primary key (client_id, post_social_id),
  constraint audn_post_collection_coverage_status_ck
    check (status is null or status in ('collected', 'not_collected', 'not_eligible'))
);

comment on table public.audn_post_collection_coverage is
  'Per-post collection state. Absence of a row for a post with zero events means not_collected, never zero engagement (CONTRACTS §3.8).';
