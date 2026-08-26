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
with pv as (
  -- one row per named viewer per day, exactly the grain rise_funnel_daily's
  -- `views` CTE groups on
  select viewer_public_id, provenance,
         coalesce(viewed_at::date, capture_day) as day
  from public.profile_view_log
  where seat = 'risedtc' and viewer_public_id is not null
),
v30 as (
  select
    count(distinct viewer_public_id) as named,
    count(distinct viewer_public_id) filter (where provenance = 'engine_touched') as engine,
    count(distinct viewer_public_id) filter (where provenance = 'organic_icp') as organic_icp,
    count(distinct viewer_public_id) filter (where provenance is distinct from 'engine_touched'
                                               and provenance is distinct from 'organic_icp') as other
  from pv where day > current_date - 30
),
v7 as (
  select
    count(distinct viewer_public_id) as named,
    count(distinct viewer_public_id) filter (where provenance = 'engine_touched') as engine,
    count(distinct viewer_public_id) filter (where provenance = 'organic_icp') as organic_icp,
    count(distinct viewer_public_id) filter (where provenance is distinct from 'engine_touched'
                                               and provenance is distinct from 'organic_icp') as other
  from pv where day > current_date - 7
),
eng as (
  -- a person, not a reaction: one engager may react to several posts and may be
  -- seen on several days
  select coalesce(nullif(pe.member_id,''), nullif(pe.provider_id,''), nullif(pe.linkedin_url,''), pe.name) as person,
         min(pe.provenance) as provenance
  from public.post_engagers pe
  join public.client_post_metrics m on m.social_id = pe.post_social_id and m.client_id = 'risedtc'
  where pe.first_seen_at > current_date - 30
  group by 1
),
e30 as (
  select count(*) filter (where person is not null) as new_people,
         count(*) filter (where provenance = 'organic_icp') as organic_icp,
         count(*) filter (where provenance = 'engine_touched') as engine
  from eng
),
other30 as (
  select
    (select count(*) from public.inbound_triage_log
      where client_id = 'risedtc' and verdict = 'buyer' and decided_at > current_date - 30) as buyer_dms,
    (select count(*) from public.client_post_metrics
      where client_id = 'risedtc' and funnel_class = 'buyers'
        and published_at is not null and published_at > current_date - 30) as posts_buyers,
    (select count(distinct p.id)
       from public.outreach_messages m
       join public.outreach_prospects p on p.id = m.prospect_id
       join public.outreach_campaigns c on c.id = p.campaign_id and c.client_id = 'risedtc'
      where m.direction = 'inbound' and m.sent_at is not null
        and (m.is_reaction is null or m.is_reaction = false)
        and (m.channel is null or m.channel <> 'email')
        and m.sent_at > current_date - 30
        and not exists (select 1 from public.outreach_messages o
                         where o.prospect_id = m.prospect_id and o.direction = 'outbound'
                           and o.sent_at is not null and o.sent_at < m.sent_at)) as organic_openers
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
started as (
  select min(coalesce(capture_day, captured_at::date)) as day
  from public.profile_view_log where seat = 'risedtc'
)
select jsonb_build_object(
  'computed_at', to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'grain', 'distinct people, computed off the source tables; the daily view is per-day distincts and does not sum',
  'tracking_started_on', (select day from started),
  'profile_views', jsonb_build_object(
    'window_days', 30,
    'named', v30.named, 'engine', v30.engine, 'organic_icp', v30.organic_icp, 'other', v30.other,
    'named_7d', v7.named, 'engine_7d', v7.engine, 'organic_icp_7d', v7.organic_icp, 'other_7d', v7.other
  ),
  'engagers', jsonb_build_object(
    'window_days', 30, 'new', e30.new_people, 'organic_icp', e30.organic_icp, 'engine', e30.engine
  ),
  'buyer_dms_30d', other30.buyer_dms,
  'organic_openers_30d', other30.organic_openers,
  'posts_buyers_30d', other30.posts_buyers,
  'posts', coalesce((select rows from posts), '[]'::jsonb)
)
from v30, v7, e30, other30
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
