-- ============================================================================
-- Funnel-instruments read path for the RISE client panel.
-- goal-run rise-panel-followthrough-2026-08-26, phase 1 (D-G item 1).
--
-- READ-ONLY consumers of the live views built by the funnel-instruments run
-- (rise_funnel_daily, rise_buyers_post_ledger). Nothing here writes, and the
-- views themselves are never modified by this run.
--
-- Shape + security posture are copied verbatim from the sibling board reads
-- (client_board_outreach_status / _v2): SECURITY DEFINER, token OR session
-- gated, non-RISE slugs get a null payload, anon EXECUTE is REQUIRED because
-- the client board is an anon + token surface.
-- ============================================================================
create or replace function public._risedtc_funnel_signals()
returns jsonb
language sql
stable
set search_path to 'public'
as $fn$
with d as (
  select * from public.rise_funnel_daily
),
w30 as (
  select coalesce(sum(profile_views_named),0)       as named,
         coalesce(sum(profile_views_engine),0)      as engine,
         coalesce(sum(profile_views_organic_icp),0) as organic_icp,
         coalesce(sum(engagers_new),0)              as engagers_new,
         coalesce(sum(engagers_organic_icp),0)      as engagers_organic_icp,
         coalesce(sum(engagers_engine),0)           as engagers_engine,
         coalesce(sum(triage_buyer_verdicts),0)     as buyer_dms,
         coalesce(sum(posts_buyers),0)              as posts_buyers,
         coalesce(sum(organic_thread_openers),0)    as organic_openers
  from d where day > current_date - 30
),
w7 as (
  select coalesce(sum(profile_views_named),0)       as named,
         coalesce(sum(profile_views_engine),0)      as engine,
         coalesce(sum(profile_views_organic_icp),0) as organic_icp
  from d where day > current_date - 7
),
posts as (
  select jsonb_agg(p order by p.published_at desc) as rows
  from (
    select social_id, published_at, title, impressions,
           organic_icp_views_48h, named_views_48h, buyer_dms_48h
    from public.rise_buyers_post_ledger
    order by published_at desc
    limit 5
  ) p
),
first_capture as (
  select min(captured_at) as at, min(capture_day) as day
  from public.profile_view_log where seat = 'risedtc'
)
select jsonb_build_object(
  'computed_at', to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'first_capture_at', (select at from first_capture),
  'first_capture_day', (select day from first_capture),
  'profile_views', jsonb_build_object(
    'window_days', 30,
    'named', w30.named,
    'engine', w30.engine,
    'organic_icp', w30.organic_icp,
    -- everyone the classifier put in neither bucket. Today that is entirely
    -- vendor_other (recruiters / agencies / tool sellers). Computed as the
    -- remainder so the three parts always add back to `named`.
    'other', greatest(w30.named - w30.engine - w30.organic_icp, 0),
    'named_7d', w7.named,
    'engine_7d', w7.engine,
    'organic_icp_7d', w7.organic_icp,
    'other_7d', greatest(w7.named - w7.engine - w7.organic_icp, 0)
  ),
  'engagers', jsonb_build_object(
    'window_days', 30,
    'new', w30.engagers_new,
    'organic_icp', w30.engagers_organic_icp,
    'engine', w30.engagers_engine
  ),
  'buyer_dms_30d', w30.buyer_dms,
  'organic_openers_30d', w30.organic_openers,
  'posts_buyers_30d', w30.posts_buyers,
  'posts', coalesce((select rows from posts), '[]'::jsonb)
)
from w30, w7
$fn$;

create or replace function public.client_board_funnel_signals(p_slug text, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','extensions'
as $fn$
declare v_board public.client_boards%rowtype;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_slug <> 'risedtc-com' then
    return jsonb_build_object('ok', true, 'signals', null);
  end if;
  return jsonb_build_object('ok', true, 'signals', public._risedtc_funnel_signals());
end;
$fn$;

create or replace function public.client_board_funnel_signals_v2(p_slug text, p_session text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $fn$
declare v_hash text; v_board public.client_boards%rowtype;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  perform 1 from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_slug <> 'risedtc-com' then
    return jsonb_build_object('ok', true, 'signals', null);
  end if;
  return jsonb_build_object('ok', true, 'signals', public._risedtc_funnel_signals());
end;
$fn$;

-- CREATE OR REPLACE re-grants EXECUTE to PUBLIC, and Supabase's default privileges
-- hand EXECUTE on every new function to anon + authenticated. Both wrappers NEED
-- anon (the client board is an anon + token surface). The inner helper does not,
-- and it reads RISE aggregates, so it is pulled back to the same posture
-- rise_outreach_truth_compute() already carries. Read back 2026-08-26:
--   _risedtc_funnel_signals      {postgres=X/postgres,service_role=X/postgres}
--   client_board_funnel_signals  {postgres,anon,authenticated,service_role}
revoke all on function public._risedtc_funnel_signals() from public, anon, authenticated;
revoke all on function public.client_board_funnel_signals(text,text) from public;
revoke all on function public.client_board_funnel_signals_v2(text,text) from public;
grant execute on function public._risedtc_funnel_signals() to service_role;
grant execute on function public.client_board_funnel_signals(text,text) to anon, authenticated, service_role;
grant execute on function public.client_board_funnel_signals_v2(text,text) to anon, authenticated, service_role;

-- Restore path: remove the two wrappers and the helper (see 01-winner-implementation.md
-- in the goal-run out folder for the exact statements); the panel tile then simply
-- stops rendering, because it is a progressive-enhancement read.
