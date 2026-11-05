-- Board: named profile viewers in the window after each published post (2026-11-05).
-- Ivan: "this stats say profile views but not from who and if icp... and if person was outreach".
--
-- LinkedIn's per-post "profile views" is a count only and never says which viewer came from which post.
-- This lists the named people who viewed the seat's profile from a post's published_at until the next
-- post's published_at, capped at 48 hours, and tags each one:
--   outreach  : the person is one of this client's own prospects and we touched them (stage in plain words).
--               An invite note stamps last_dm_sent_at, so 'Messaged' needs dm_count > 0 or a dm/inmail stage.
--   fit       : judged an ideal customer by the viewer check, and not in outreach
--   other     : judged not a buyer, with a short plain reason (the raw judge text never leaves the DB)
--   unchecked : nothing judged yet
--
-- Scoping: slug + token (or session) -> client_boards row -> its client_id -> outreach_seats with that
-- client_id -> profile_view_log rows of those seats. Prospects count only when their campaign belongs to
-- the same client_id. Posts and their times come from the same board's cached performance blob, so the
-- caller can never choose a window, a seat or a client.
--
-- Time grain (profile_view_log.viewed_at):
--   ARCH / RISE rows: provenance_detail is plain text; viewed_at is LinkedIn's own view time (exact minute).
--   SwishDM rows: provenance_detail is JSON with relative_view + viewed_at_approx. Exact rows, "Nm ago" rows
--   (within the minute before viewed_at) and "Nh ago" rows (within the hour before) are placed. "Nd ago" rows are placed only when
--   the whole day before viewed_at sits inside the window. "Nw/Nmo ago" rows are never placed.
--   Every capture re-logs the whole 90-day viewer list, so people are de-duplicated per post.

create or replace function public._board_try_jsonb(p text)
returns jsonb
language plpgsql
immutable
as $$
begin
  if p is null or left(btrim(p), 1) <> '{' then return null; end if;
  return p::jsonb;
exception when others then
  return null;
end;
$$;

-- Short plain reason for a "not a buyer" verdict. Display only; it never decides who is a buyer.
-- No clear category -> null, and the board shows plain "Not a buyer" next to the person's own headline.
create or replace function public._board_viewer_reason(p text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(btrim(p), '') = '' then null
    when p ~* '\m(recruiter|recruiters|headhunter|recruiting firm|staffing|talent acquisition)' then 'Recruiter'
    when p ~* '\mstudents?\M' then 'Student'
    when p ~* '(influencer|creator)[^.;]{0,40}(agency|agencies|marketing|network|services?\M|campaign)'
      or p ~* 'agenc(y|ies)[^.;]{0,30}(influencer|creator)' then 'Influencer agency'
    when p ~* '(content creator|\mcreators?\M|streamer|youtuber|\minfluencer\M)' then 'Creator'
    when p ~* '\m(seo|geo|aeo)\M|link.building' then 'Sells SEO'
    when p ~* '(software|saas|\mtools?\M|vendor)' then 'Sells software'
    when p ~* 'agenc(y|ies)' then 'Agency'
    when p ~* '(service|consult|coach|freelanc|advis|bookkeep|provider|studio)' then 'Sells services'
    else null
  end
$$;

create or replace function public._board_post_viewers(p_client_id text, p_board jsonb)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  with seats as (
    select s.seat from public.outreach_seats s
     where coalesce(btrim(p_client_id), '') <> '' and s.client_id = btrim(p_client_id)
  ),
  posts as (
    select x.act, x.at,
           least(x.at + interval '48 hours', coalesce(lead(x.at) over (order by x.at), 'infinity'::timestamptz)) as w_end
      from (
        select distinct on (substring(coalesce(e->>'url', '') from 'activity[-:](\d{10,})'))
               substring(coalesce(e->>'url', '') from 'activity[-:](\d{10,})') as act,
               (e->>'published_at')::timestamptz as at
          from jsonb_array_elements(coalesce(p_board->'performance'->'posts', '[]'::jsonb)) e
         where coalesce(e->>'published_at', '') <> ''
           and substring(coalesce(e->>'url', '') from 'activity[-:](\d{10,})') is not null
         order by 1, 2
      ) x
  ),
  logs as (
    select l.*,
           -- LinkedIn's member id first: it stays the same when someone changes their public profile address.
           coalesce(nullif(btrim(l.viewer_provider_id), ''), nullif(btrim(l.viewer_public_id), ''), lower(btrim(l.viewer_name))) as pk,
           public._board_try_jsonb(l.provenance_detail) as pj
      from public.profile_view_log l
     where l.seat in (select seat from seats)
       and coalesce(btrim(l.viewer_name), '') <> ''
       and l.viewed_at is not null
  ),
  placed as (
    -- lo..hi = the span the real view time can be in.
    select pk, seat, viewed_at as hi,
           case
             when pj is null or coalesce((pj->>'viewed_at_approx')::boolean, false) = false then viewed_at
             when pj->>'relative_view' ~* '\d+\s*(m|min|mins)\M' then viewed_at - interval '1 minute'
             when pj->>'relative_view' ~* '\d+\s*(h|hr|hrs)\M' then viewed_at - interval '1 hour'
             when pj->>'relative_view' ~* '\d+\s*d\M' then viewed_at - interval '24 hours'
           end as lo,
           (pj is not null and coalesce((pj->>'viewed_at_approx')::boolean, false)) as approx
      from logs
  ),
  tracked as (
    select min(captured_at) as since from public.profile_view_log where seat in (select seat from seats)
  ),
  hits as (
    select p.act, v.pk, min(v.hi) as at, bool_and(v.approx) as about
      from posts p
      join placed v on v.lo is not null and v.lo >= p.at and v.hi < p.w_end
     group by p.act, v.pk
  ),
  -- One row per person: newest name and headline, any client-scoped prospect, the judge verdict.
  person as (
    select pk,
           (array_agg(viewer_name order by captured_at desc))[1] as name,
           (array_agg(viewer_headline order by captured_at desc) filter (where coalesce(btrim(viewer_headline), '') <> ''))[1] as headline,
           (array_agg(viewer_public_id order by captured_at desc) filter (where coalesce(btrim(viewer_public_id), '') <> ''))[1] as pub,
           (array_agg(prospect_id order by captured_at desc) filter (where prospect_id is not null)) as prospect_ids,
           bool_or(icp_pass) as any_fit,
           bool_or(icp_pass = false) as any_no,
           (array_agg(icp_reasoning order by captured_at desc) filter (where icp_pass = false))[1] as no_reason
      from logs
     where pk in (select pk from hits)
     group by pk
  ),
  stage as (
    select distinct on (pe.pk) pe.pk,
           case
             when op.call_booked_at is not null then 'Call booked'
             when op.last_reply_at is not null or coalesce(op.reply_count, 0) > 0 or op.stage in ('replied', 'positive_reply') then 'Replied'
             when coalesce(op.dm_count, 0) > 0 or op.stage ~ '(dm_sent|inmail_sent)$' then 'Messaged'
             when op.connected_at is not null or op.stage ~ 'connected$' or op.stage = 'inbound_accepted_no_dm' then 'Connected'
             when op.connection_sent_at is not null or op.stage ~ 'connection_sent$' then 'Invited'
             when op.last_engaged_at is not null or coalesce(op.posts_liked, 0) > 0 or coalesce(op.posts_commented, 0) > 0 then 'Engaged with their posts'
           end as label,
           case
             when op.call_booked_at is not null then 6
             when op.last_reply_at is not null or coalesce(op.reply_count, 0) > 0 or op.stage in ('replied', 'positive_reply') then 5
             when coalesce(op.dm_count, 0) > 0 or op.stage ~ '(dm_sent|inmail_sent)$' then 4
             when op.connected_at is not null or op.stage ~ 'connected$' or op.stage = 'inbound_accepted_no_dm' then 3
             when op.connection_sent_at is not null or op.stage ~ 'connection_sent$' then 2
             when op.last_engaged_at is not null or coalesce(op.posts_liked, 0) > 0 or coalesce(op.posts_commented, 0) > 0 then 1
             else 0
           end as rank
      from person pe
      cross join lateral unnest(pe.prospect_ids) as pid
      join public.outreach_prospects op on op.id = pid
      join public.outreach_campaigns oc on oc.id = op.campaign_id and oc.client_id = btrim(p_client_id)
     order by pe.pk, rank desc
  ),
  tagged as (
    select h.act, h.at, h.about, pe.name, pe.headline, pe.pub,
           case
             when st.rank > 0 then 'outreach'
             when pe.any_fit then 'fit'
             when pe.any_no then 'other'
             else 'unchecked'
           end as tag,
           case when st.rank > 0 then st.label end as stage,
           case when st.rank > 0 or pe.any_fit or not coalesce(pe.any_no, false) then null
                else public._board_viewer_reason(pe.no_reason) end as reason
      from hits h
      join person pe on pe.pk = h.pk
      left join stage st on st.pk = h.pk
  )
  select jsonb_build_object(
    'tracked_from', (select since from tracked),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
               'p', p.act,
               'at', p.at,
               'until', case when p.w_end = 'infinity'::timestamptz then null else p.w_end end,
               'hours', round(extract(epoch from (least(p.w_end, p.at + interval '48 hours') - p.at)) / 3600.0),
               'cut', p.w_end < p.at + interval '48 hours',
               'open', p.w_end > now(),
               'people', coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'name', t.name,
                          'headline', left(t.headline, 160),
                          'url', case when t.pub is not null then 'https://www.linkedin.com/in/' || t.pub end,
                          'at', t.at,
                          'about', t.about,
                          'tag', t.tag,
                          'stage', t.stage,
                          'reason', t.reason)
                        order by case t.tag when 'outreach' then 0 when 'fit' then 1 when 'unchecked' then 2 else 3 end, t.at)
                   from tagged t where t.act = p.act), '[]'::jsonb))
             order by p.at desc)
        from posts p, tracked tr
       where tr.since is not null and p.at >= tr.since), '[]'::jsonb)
  )
  where exists (select 1 from seats)
$$;

revoke all on function public._board_try_jsonb(text) from public, anon, authenticated;
revoke all on function public._board_viewer_reason(text) from public, anon, authenticated;
revoke all on function public._board_post_viewers(text, jsonb) from public, anon, authenticated;

create or replace function public.client_board_post_viewers(p_slug text, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare v_board public.client_boards%rowtype;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'viewers', public._board_post_viewers(btrim(v_board.client_id), v_board.board));
end;
$$;

create or replace function public.client_board_post_viewers_v2(p_slug text, p_session text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
declare v_hash text; v_board public.client_boards%rowtype;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  perform 1 from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'viewers', public._board_post_viewers(btrim(v_board.client_id), v_board.board));
end;
$$;

revoke all on function public.client_board_post_viewers(text, text) from public;
revoke all on function public.client_board_post_viewers_v2(text, text) from public;
grant execute on function public.client_board_post_viewers(text, text) to anon, authenticated;
grant execute on function public.client_board_post_viewers_v2(text, text) to anon, authenticated;
