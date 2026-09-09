-- ============================================================================
-- Audience-learning measurement foundation — 01 / functions.
-- goal-run audience-learning-02-foundation-2026-09-09, foundation seat.
-- Worklist: W02 (person key), W01 (post identity urn normalisation), W10 (cutoff).
--
-- LOCAL BUILD ONLY. Nothing in this migration set has been applied to the live
-- Supabase project; it is exercised through OUT/harness/run.mjs (PGlite) and
-- replayed independently by OUT/tools/replay.py.
--
-- Every object is prefixed `audn_` so it can never collide with one of the 343
-- live objects inventoried in Run 01 (CONTRACTS §2).
--
-- Dependency order (CONTRACTS §2, handoff correction C6): functions -> tables ->
-- views. Views may never be created before the functions and tables they read.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- audn_urn_kind / audn_urn_digits: the two scalar helpers CONTRACTS §2 freezes.
-- A LinkedIn post is stored as `urn:li:activity:N`, `urn:li:ugcPost:N`,
-- `urn:li:share:N` or (4 own_posts rows) as bare digits. Bare digits carry no
-- kind, so kind is NULL and digits is the number — unknown is a value (§3.9),
-- it is never guessed as 'activity'.
-- Anything else returns NULL digits, which is what marks the input unparseable.
-- ---------------------------------------------------------------------------
create or replace function public.audn_urn_kind(t text)
returns text
language sql
immutable
set search_path to 'public'
as $fn$
  select case
           when t ~ '^urn:li:(activity|ugcPost|share):[0-9]+$' then split_part(t, ':', 3)
           else null
         end
$fn$;

create or replace function public.audn_urn_digits(t text)
returns text
language sql
immutable
set search_path to 'public'
as $fn$
  select case
           when t ~ '^urn:li:(activity|ugcPost|share):[0-9]+$' then split_part(t, ':', 4)
           when t ~ '^[0-9]+$'                                 then t
           else null
         end
$fn$;

-- ---------------------------------------------------------------------------
-- audn_norm_urn: the pair, as one call. Returns exactly one row.
-- Used as `(public.audn_norm_urn(x)).kind` / `.digits`.
-- ---------------------------------------------------------------------------
create or replace function public.audn_norm_urn(t text)
returns table (kind text, digits text)
language sql
immutable
set search_path to 'public'
as $fn$
  select public.audn_urn_kind(t), public.audn_urn_digits(t)
$fn$;

-- ---------------------------------------------------------------------------
-- audn_person_key: provider-first identity (CONTRACTS §2 / §3.2).
--
-- Run 01's RISE trace used coalesce(member_id, provider_id, ...) because the
-- production RPC _risedtc_funnel_signals() does. member_id on those rows is a
-- public slug, so that order can split one person across two keys; RISE people
-- moved 193 -> 191 under the provider-first rule. That is recorded in §3.2 as a
-- correction, not a drift. Never re-order these four arguments.
--
-- linkedin_url is normalised (trailing slash, case) before it is used as a key;
-- name is the last resort and is only reached when the three ids are empty.
-- ---------------------------------------------------------------------------
create or replace function public.audn_person_key(
  provider_id  text,
  member_id    text,
  linkedin_url text,
  name         text
)
returns text
language sql
immutable
set search_path to 'public'
as $fn$
  select coalesce(
           nullif(btrim(provider_id), ''),
           nullif(btrim(member_id), ''),
           nullif(lower(rtrim(btrim(linkedin_url), '/')), ''),
           nullif(btrim(name), '')
         )
$fn$;

-- ---------------------------------------------------------------------------
-- audn_cutoff: the "as of" instant every maturity/eligibility view reads.
--
-- STABLE, not IMMUTABLE: it reads a GUC and now(). Handoff correction C3 —
-- never mislabel a lookup function IMMUTABLE. Because it is only STABLE it can
-- never be used in a generated column, which is precisely why the client_id
-- generated column proposed by Run 01 was dropped in favour of the scoped
-- views in migration 03.
--
-- Default is now(); the replay harness pins it with
--   set audn.cutoff = '2026-09-09T14:30:00Z';
-- so a frozen census reproduces byte-identical cohort numbers.
-- ---------------------------------------------------------------------------
create or replace function public.audn_cutoff()
returns timestamptz
language sql
stable
set search_path to 'public'
as $fn$
  select coalesce(nullif(current_setting('audn.cutoff', true), '')::timestamptz, now())
$fn$;
