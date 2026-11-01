-- Board: the store owners and ICP people behind each published post's engager counts.
-- Read-only. The board showed "N store owners" per post with no names; this returns who they are.
-- Rows come only from the board's own client_id (client_post_engagers + client_post_metrics).
-- ICP = the engager row's own fit score >= 7, the same bar the report payload uses for a buyer fit.

create or replace function public._client_board_post_people(p_client_id text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select coalesce(jsonb_agg(j order by at desc), '[]'::jsonb) from (
    select distinct on (act, coalesce(e.profile_id, e.linkedin_url, e.name))
           substring(coalesce(m.social_id, '') || ' ' || coalesce(m.post_url, '') from 'activity[-:](\d{10,})') as act,
           e.seen_at as at,
           jsonb_build_object(
             'p', substring(coalesce(m.social_id, '') || ' ' || coalesce(m.post_url, '') from 'activity[-:](\d{10,})'),
             'name', e.name,
             'headline', e.headline,
             'url', e.linkedin_url,
             'owner', e.side = 'owner',
             'icp', coalesce(e.icp_score >= 7, false),
             'kind', e.kind
           ) as j
      from public.client_post_engagers e
      join public.client_post_metrics m on m.id = e.post_id and m.client_id = e.client_id
     where e.client_id = p_client_id
       and coalesce(btrim(e.name), '') <> ''
       and (e.side = 'owner' or e.icp_score >= 7)
     order by act, coalesce(e.profile_id, e.linkedin_url, e.name), (e.kind = 'comment') desc, e.seen_at desc
  ) x
  where act is not null;
$$;

revoke all on function public._client_board_post_people(text) from public, anon, authenticated;

create or replace function public.client_board_post_people(p_slug text, p_token text)
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
  return jsonb_build_object('ok', true, 'people', public._client_board_post_people(btrim(v_board.client_id)));
end;
$$;

create or replace function public.client_board_post_people_v2(p_slug text, p_session text)
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
  return jsonb_build_object('ok', true, 'people', public._client_board_post_people(btrim(v_board.client_id)));
end;
$$;

grant execute on function public.client_board_post_people(text, text) to anon, authenticated;
grant execute on function public.client_board_post_people_v2(text, text) to anon, authenticated;
