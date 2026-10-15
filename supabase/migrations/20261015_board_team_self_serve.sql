-- Board team access (2026-10-15).
--
-- A board member (email session) OR the board-link holder (?k= token) can list, add and
-- remove teammates on THEIR board's allow-list (client_registry.platform.board.auth.allowed_emails).
-- Adding an email never sends anything: the added person is told about the board by whoever
-- added them (the panel shows the plain board link to share). They then request their own
-- sign-in link from the board's sign-in screen, which is the existing request_board_login path.
--
-- Shape is unchanged: allowed_emails stays a jsonb array of lower-case strings, so
-- request_board_login, board-magic-link and platform_manifest.py read it exactly as before.
-- Boards without auth.magic_link=true get 'not_available' from every function here, so a board
-- that does not use sign-in sees no change.
--
-- Old session-only RPCs get_board_team / invite_board_member (cap 10, auto-emailed the invitee)
-- are dropped once the new panel is live: see 20261015_board_team_self_serve_drop_old.sql.

-- Core: the one place the allow-list is changed. NOT callable by anon/authenticated; the public
-- wrappers below authenticate first, and the operator script calls it through the Management API.
create or replace function public._board_team_apply(p_slug text, p_op text, p_email text, p_actor text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cap    constant int := 25;
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_client text;
  v_list   jsonb;
  v_new    jsonb;
begin
  if p_op not in ('list', 'add', 'remove') then
    return jsonb_build_object('ok', false, 'error', 'bad_op');
  end if;

  -- Resolve + lock the ONE registry row that owns this slug. Sign-in must be switched on.
  select r.client_id, coalesce(r.platform->'board'->'auth'->'allowed_emails', '[]'::jsonb)
    into v_client, v_list
    from public.client_registry r
   where r.platform->'board'->>'slug' = p_slug
     and coalesce((r.platform->'board'->'auth'->>'magic_link') = 'true', false)
   for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;
  if jsonb_typeof(v_list) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;

  if p_op = 'list' then
    return jsonb_build_object('ok', true, 'allowed_emails', v_list, 'cap', v_cap);
  end if;

  if length(v_email) > 254
     or v_email !~ '^[a-z0-9._%+''-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$'
     or v_email ~ '\.\.' then
    return jsonb_build_object('ok', false, 'error', 'bad_email');
  end if;

  if p_op = 'add' then
    if exists (select 1 from jsonb_array_elements_text(v_list) e where lower(trim(e)) = v_email) then
      return jsonb_build_object('ok', true, 'already_member', true, 'allowed_emails', v_list, 'cap', v_cap);
    end if;
    if jsonb_array_length(v_list) >= v_cap then
      return jsonb_build_object('ok', false, 'error', 'list_full', 'allowed_emails', v_list, 'cap', v_cap);
    end if;
    v_new := v_list || to_jsonb(v_email);
  else -- remove
    if not exists (select 1 from jsonb_array_elements_text(v_list) e where lower(trim(e)) = v_email) then
      return jsonb_build_object('ok', true, 'not_member', true, 'allowed_emails', v_list, 'cap', v_cap);
    end if;
    select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into v_new
      from jsonb_array_elements_text(v_list) with ordinality t(e, o)
     where lower(trim(e)) <> v_email;
    if jsonb_array_length(v_new) = 0 then
      return jsonb_build_object('ok', false, 'error', 'last_member', 'allowed_emails', v_list, 'cap', v_cap);
    end if;
    -- Removal ends access now: live sessions are revoked and unused sign-in links die.
    update public.client_board_sessions set revoked_at = now()
     where slug = p_slug and lower(email) = v_email and revoked_at is null;
    update public.client_board_logins set expires_at = now()
     where slug = p_slug and lower(email) = v_email and consumed_at is null and expires_at > now();
  end if;

  update public.client_registry
     set platform = jsonb_set(platform, '{board,auth,allowed_emails}', v_new)
   where client_id = v_client;

  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_client, case when p_op = 'add' then 'invite' else 'team_remove' end, v_email,
          jsonb_build_object(case when p_op = 'add' then 'invited' else 'removed' end, v_email,
                             'by', coalesce(p_actor, 'unknown'), 'emailed', false));

  return jsonb_build_object('ok', true, 'allowed_emails', v_new, 'cap', v_cap);
end;
$$;
revoke all on function public._board_team_apply(text, text, text, text) from public, anon, authenticated;

-- Who is calling: the session's email, 'board link' for a valid ?k= token, or null.
create or replace function public._board_team_caller(p_slug text, p_session text, p_token text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash  text;
  v_email text;
begin
  if coalesce(p_session, '') <> '' then
    v_hash := encode(digest(p_session, 'sha256'), 'hex');
    select email into v_email
      from public.client_board_sessions
     where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
    if found then
      update public.client_board_sessions set last_seen_at = now() where token_hash = v_hash;
      return lower(v_email);
    end if;
  end if;
  if coalesce(p_token, '') <> '' and exists (
    select 1 from public.client_boards cb
     where cb.slug = p_slug and cb.token = p_token
       and (cb.expires_at is null or cb.expires_at > now())
  ) then
    return 'board link';
  end if;
  return null;
end;
$$;
revoke all on function public._board_team_caller(text, text, text) from public, anon, authenticated;

create or replace function public.board_team_list(p_slug text, p_session text default null, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller text := public._board_team_caller(p_slug, p_session, p_token);
  v_res    jsonb;
begin
  if v_caller is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  v_res := public._board_team_apply(p_slug, 'list', null, v_caller);
  if coalesce((v_res->>'ok')::boolean, false) and v_caller <> 'board link' then
    v_res := v_res || jsonb_build_object('me', v_caller);
  end if;
  return v_res;
end;
$$;

create or replace function public.board_team_add(p_slug text, p_email text, p_session text default null, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller text := public._board_team_caller(p_slug, p_session, p_token);
begin
  if v_caller is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  return public._board_team_apply(p_slug, 'add', p_email, v_caller);
end;
$$;

create or replace function public.board_team_remove(p_slug text, p_email text, p_session text default null, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller text := public._board_team_caller(p_slug, p_session, p_token);
begin
  if v_caller is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  -- A signed-in member cannot remove their own email (no accidental self-lockout).
  if v_caller = lower(trim(coalesce(p_email, ''))) then
    return jsonb_build_object('ok', false, 'error', 'cannot_remove_self');
  end if;
  return public._board_team_apply(p_slug, 'remove', p_email, v_caller);
end;
$$;

grant execute on function public.board_team_list(text, text, text) to anon, authenticated;
grant execute on function public.board_team_add(text, text, text, text) to anon, authenticated;
grant execute on function public.board_team_remove(text, text, text, text) to anon, authenticated;
