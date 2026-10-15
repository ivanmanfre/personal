-- Board roles + real names (2026-10-15).
-- Roles live beside the allow-list, which keeps its shape (array of emails) for every reader:
--   platform.board.auth.members      {"<email>": {"role": "viewer"|"approver"|"admin", "name": "..."}}
--   platform.board.auth.owner_emails ["<email>", ...]  (falls back to platform.client.founder_email)
-- Resolution: owner -> admin (and can never be removed); members[email].role; else 'approver'
-- (so every existing member of every board is an approver, and boards with no members map
-- keep working). The ?k= board link is unchanged: it can do everything it could before.
--   admin    : add / remove teammates, change roles, plus everything an approver does
--   approver : approve, request changes, edit, schedule, plus everything a viewer does
--   viewer   : read and comment (and upload photos)

create or replace function public._board_owner_emails(p_platform jsonb)
returns text[]
language sql immutable
as $$
  select coalesce(
    (select array_agg(lower(trim(e))) from jsonb_array_elements_text(
       case when jsonb_typeof(p_platform->'board'->'auth'->'owner_emails') = 'array'
            then p_platform->'board'->'auth'->'owner_emails' else '[]'::jsonb end) e
     where trim(e) <> ''),
    case when coalesce(p_platform->'client'->>'founder_email', '') <> ''
         then array[lower(trim(p_platform->'client'->>'founder_email'))] else array[]::text[] end);
$$;

-- Role of one email on one board ('board link' = the keyed link, treated as admin as before).
create or replace function public._board_member_role(p_slug text, p_email text)
returns text
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_pf    jsonb;
  v_role  text;
begin
  if v_email = 'board link' then return 'admin'; end if;
  select r.platform into v_pf from public.client_registry r
   where r.platform->'board'->>'slug' = p_slug limit 1;
  if v_pf is null then return 'approver'; end if;
  if v_email = any(public._board_owner_emails(v_pf)) then return 'admin'; end if;
  v_role := v_pf->'board'->'auth'->'members'->v_email->>'role';
  return case when v_role in ('viewer', 'approver', 'admin') then v_role else 'approver' end;
end;
$$;
revoke all on function public._board_member_role(text, text) from public, anon, authenticated;
revoke all on function public._board_owner_emails(jsonb) from public, anon, authenticated;

-- Core (operator script + wrappers). New ops: set_role. 'add' takes an optional name + role.
create or replace function public._board_team_apply(p_slug text, p_op text, p_email text, p_actor text,
                                                    p_name text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cap    constant int := 25;
  v_email  text := lower(trim(coalesce(p_email, '')));
  v_name   text := nullif(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]', '', 'g')), '');
  v_role   text := nullif(lower(trim(coalesce(p_role, ''))), '');
  v_client text;
  v_pf     jsonb;
  v_list   jsonb;
  v_new    jsonb;
  v_owners text[];
  v_mem    jsonb;
  v_members jsonb;
  v_action text;
begin
  if p_op not in ('list', 'add', 'remove', 'set_role') then
    return jsonb_build_object('ok', false, 'error', 'bad_op');
  end if;
  if v_role is not null and v_role not in ('viewer', 'approver', 'admin') then
    return jsonb_build_object('ok', false, 'error', 'bad_role');
  end if;
  if v_name is not null and length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;

  select r.client_id, r.platform, coalesce(r.platform->'board'->'auth'->'allowed_emails', '[]'::jsonb)
    into v_client, v_pf, v_list
    from public.client_registry r
   where r.platform->'board'->>'slug' = p_slug
     and coalesce((r.platform->'board'->'auth'->>'magic_link') = 'true', false)
   for update;
  if not found or jsonb_typeof(v_list) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;
  v_owners  := public._board_owner_emails(v_pf);
  v_members := case when jsonb_typeof(v_pf->'board'->'auth'->'members') = 'object'
                    then v_pf->'board'->'auth'->'members' else '{}'::jsonb end;

  if p_op = 'list' then
    select coalesce(jsonb_agg(jsonb_build_object(
             'email', lower(trim(e)),
             'name', v_members->lower(trim(e))->>'name',
             'role', case when lower(trim(e)) = any(v_owners) then 'admin'
                          when v_members->lower(trim(e))->>'role' in ('viewer', 'approver', 'admin')
                          then v_members->lower(trim(e))->>'role' else 'approver' end,
             'owner', lower(trim(e)) = any(v_owners)) order by o), '[]'::jsonb)
      into v_mem
      from jsonb_array_elements_text(v_list) with ordinality t(e, o);
    return jsonb_build_object('ok', true, 'allowed_emails', v_list, 'members', v_mem, 'cap', v_cap);
  end if;

  if length(v_email) > 254
     or v_email !~ '^[a-z0-9._%+''-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$'
     or v_email ~ '\.\.' then
    return jsonb_build_object('ok', false, 'error', 'bad_email');
  end if;

  v_new := v_list;
  if p_op = 'add' then
    if exists (select 1 from jsonb_array_elements_text(v_list) e where lower(trim(e)) = v_email) then
      return jsonb_build_object('ok', true, 'already_member', true, 'allowed_emails', v_list, 'cap', v_cap);
    end if;
    if jsonb_array_length(v_list) >= v_cap then
      return jsonb_build_object('ok', false, 'error', 'list_full', 'allowed_emails', v_list, 'cap', v_cap);
    end if;
    v_new := v_list || to_jsonb(v_email);
    if v_name is not null or (v_role is not null and v_role <> 'approver') then
      v_members := v_members || jsonb_build_object(v_email, jsonb_strip_nulls(jsonb_build_object(
                     'name', v_name, 'role', case when v_role <> 'approver' then v_role end)));
    end if;
    v_action := 'invite';
  elsif p_op = 'set_role' then
    if not exists (select 1 from jsonb_array_elements_text(v_list) e where lower(trim(e)) = v_email) then
      return jsonb_build_object('ok', false, 'error', 'not_member');
    end if;
    if v_role is null then return jsonb_build_object('ok', false, 'error', 'bad_role'); end if;
    if v_email = any(v_owners) and v_role <> 'admin' then
      return jsonb_build_object('ok', false, 'error', 'owner_is_admin');
    end if;
    v_members := v_members || jsonb_build_object(v_email,
                   coalesce(v_members->v_email, '{}'::jsonb) || jsonb_build_object('role', v_role));
    v_action := 'team_role';
  else -- remove
    if not exists (select 1 from jsonb_array_elements_text(v_list) e where lower(trim(e)) = v_email) then
      return jsonb_build_object('ok', true, 'not_member', true, 'allowed_emails', v_list, 'cap', v_cap);
    end if;
    if v_email = any(v_owners) then
      return jsonb_build_object('ok', false, 'error', 'owner', 'allowed_emails', v_list, 'cap', v_cap);
    end if;
    select coalesce(jsonb_agg(e order by o), '[]'::jsonb) into v_new
      from jsonb_array_elements_text(v_list) with ordinality t(e, o)
     where lower(trim(e)) <> v_email;
    if jsonb_array_length(v_new) = 0 then
      return jsonb_build_object('ok', false, 'error', 'last_member', 'allowed_emails', v_list, 'cap', v_cap);
    end if;
    v_members := v_members - v_email;
    update public.client_board_sessions set revoked_at = now()
     where slug = p_slug and lower(email) = v_email and revoked_at is null;
    update public.client_board_logins set expires_at = now()
     where slug = p_slug and lower(email) = v_email and consumed_at is null and expires_at > now();
    v_action := 'team_remove';
  end if;

  update public.client_registry
     set platform = jsonb_set(jsonb_set(platform, '{board,auth,allowed_emails}', v_new),
                              '{board,auth,members}', v_members)
   where client_id = v_client;

  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_client, v_action, v_email,
          jsonb_strip_nulls(jsonb_build_object(
            case when p_op = 'add' then 'invited' when p_op = 'remove' then 'removed' else 'member' end, v_email,
            'by', coalesce(p_actor, 'unknown'), 'emailed', false,
            'name', case when p_op = 'add' then v_name end,
            'role', case when p_op in ('add', 'set_role') then coalesce(v_role, 'approver') end)));

  return public._board_team_apply(p_slug, 'list', null, p_actor) || jsonb_build_object('ok', true);
end;
$$;
revoke all on function public._board_team_apply(text, text, text, text, text, text) from public, anon, authenticated;

-- The old 4-argument core stays as a thin wrapper (same signature, so no DROP needed).
create or replace function public._board_team_apply(p_slug text, p_op text, p_email text, p_actor text)
returns jsonb
language sql
security definer
set search_path = public
as $$ select public._board_team_apply(p_slug, p_op, p_email, p_actor, null::text, null::text) $$;
revoke all on function public._board_team_apply(text, text, text, text) from public, anon, authenticated;

-- Public wrappers: admins (and the board link) manage; everyone signed in can read.
create or replace function public.board_team_list(p_slug text, p_session text default null, p_token text default null)
returns jsonb
language plpgsql security definer
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
  if coalesce((v_res->>'ok')::boolean, false) then
    v_res := v_res || jsonb_build_object('my_role', public._board_member_role(p_slug, v_caller));
    if v_caller <> 'board link' then v_res := v_res || jsonb_build_object('me', v_caller); end if;
  end if;
  return v_res;
end;
$$;

create or replace function public.board_team_add_v2(p_slug text, p_email text, p_name text default null, p_role text default null,
                                                    p_session text default null, p_token text default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare v_caller text := public._board_team_caller(p_slug, p_session, p_token);
begin
  if v_caller is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if public._board_member_role(p_slug, v_caller) <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'admin_only');
  end if;
  return public._board_team_apply(p_slug, 'add', p_email, v_caller, p_name, p_role);
end;
$$;

create or replace function public.board_team_add(p_slug text, p_email text, p_session text default null, p_token text default null)
returns jsonb
language sql security definer
set search_path = public
as $$ select public.board_team_add_v2(p_slug, p_email, null, null, p_session, p_token) $$;

create or replace function public.board_team_set_role(p_slug text, p_email text, p_role text,
                                                      p_session text default null, p_token text default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare v_caller text := public._board_team_caller(p_slug, p_session, p_token);
begin
  if v_caller is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if public._board_member_role(p_slug, v_caller) <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'admin_only');
  end if;
  if v_caller = lower(trim(coalesce(p_email, ''))) then
    return jsonb_build_object('ok', false, 'error', 'cannot_change_self');
  end if;
  return public._board_team_apply(p_slug, 'set_role', p_email, v_caller, null, p_role);
end;
$$;

create or replace function public.board_team_remove(p_slug text, p_email text, p_session text default null, p_token text default null)
returns jsonb
language plpgsql security definer
set search_path = public, extensions
as $$
declare v_caller text := public._board_team_caller(p_slug, p_session, p_token);
begin
  if v_caller is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if public._board_member_role(p_slug, v_caller) <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'admin_only');
  end if;
  if v_caller = lower(trim(coalesce(p_email, ''))) then
    return jsonb_build_object('ok', false, 'error', 'cannot_remove_self');
  end if;
  return public._board_team_apply(p_slug, 'remove', p_email, v_caller);
end;
$$;

grant execute on function public.board_team_add_v2(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.board_team_set_role(text, text, text, text, text) to anon, authenticated;
