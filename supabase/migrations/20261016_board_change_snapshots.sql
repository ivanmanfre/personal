-- Add complete LM promo / team-change snapshots to the existing audit store.
-- Exact live signatures, auth checks and function grants are preserved by CREATE OR REPLACE.
-- No historical entries are rewritten. New values are captured server-side under row locks.

CREATE OR REPLACE FUNCTION public.client_board_edit_lm_promo(p_slug text, p_token text, p_lm_id text, p_field text, p_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_board public.client_boards%rowtype; v_found boolean; v_before jsonb;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now()) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  -- Validate the field + value shape.
  if p_field = 'email' then
    if p_value is null or jsonb_typeof(p_value) <> 'object'
       or p_value->>'subject' is null or p_value->>'body' is null then
      return jsonb_build_object('ok', false, 'error', 'bad_field'); end if;
  elsif p_field = 'dm' then
    if p_value is null or jsonb_typeof(p_value) <> 'string' then
      return jsonb_build_object('ok', false, 'error', 'bad_field'); end if;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_field');
  end if;

  -- Does an LM with this id exist?
  select exists (
    select 1 from jsonb_array_elements(coalesce(v_board.board->'lead_magnets', '[]'::jsonb)) e
     where e->>'id' = p_lm_id
  ) into v_found;
  if not v_found then return jsonb_build_object('ok', false, 'error', 'lm_not_found'); end if;

  select e->'promo'->p_field into v_before
    from jsonb_array_elements(v_board.board->'lead_magnets') e where e->>'id' = p_lm_id;

  update public.client_boards set board = jsonb_set(board, '{lead_magnets}', coalesce((
      select jsonb_agg(case when (m->>'id') = p_lm_id
        then jsonb_set(m, '{promo}', coalesce(m->'promo', '{}'::jsonb) || jsonb_build_object(p_field, p_value))
        else m end)
      from jsonb_array_elements(board->'lead_magnets') m), board->'lead_magnets'))
    where slug = p_slug;

  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, 'edit_lm_promo', p_lm_id,
          jsonb_build_object('field', p_field, 'applied', true, 'by', 'board link', 'before', v_before, 'after', p_value));

  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public.client_board_edit_lm_promo_v2(p_slug text, p_session text, p_lm_id text, p_field text, p_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_email text; v_board public.client_boards%rowtype; v_found boolean; v_before jsonb;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  select email into v_email from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;

  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now()) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  if p_field = 'email' then
    if p_value is null or jsonb_typeof(p_value) <> 'object'
       or p_value->>'subject' is null or p_value->>'body' is null then
      return jsonb_build_object('ok', false, 'error', 'bad_field'); end if;
  elsif p_field = 'dm' then
    if p_value is null or jsonb_typeof(p_value) <> 'string' then
      return jsonb_build_object('ok', false, 'error', 'bad_field'); end if;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_field');
  end if;

  select exists (
    select 1 from jsonb_array_elements(coalesce(v_board.board->'lead_magnets', '[]'::jsonb)) e
     where e->>'id' = p_lm_id
  ) into v_found;
  if not v_found then return jsonb_build_object('ok', false, 'error', 'lm_not_found'); end if;

  select e->'promo'->p_field into v_before
    from jsonb_array_elements(v_board.board->'lead_magnets') e where e->>'id' = p_lm_id;

  update public.client_boards set board = jsonb_set(board, '{lead_magnets}', coalesce((
      select jsonb_agg(case when (m->>'id') = p_lm_id
        then jsonb_set(m, '{promo}', coalesce(m->'promo', '{}'::jsonb) || jsonb_build_object(p_field, p_value))
        else m end)
      from jsonb_array_elements(board->'lead_magnets') m), board->'lead_magnets'))
    where slug = p_slug;

  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, 'edit_lm_promo', p_lm_id,
          jsonb_build_object('field', p_field, 'applied', true, 'by', v_email, 'before', v_before, 'after', p_value));

  return jsonb_build_object('ok', true);
end $function$;

CREATE OR REPLACE FUNCTION public._board_team_apply(p_slug text, p_op text, p_email text, p_actor text, p_name text, p_role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
  v_before jsonb;
  v_after jsonb;
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

  select case when exists (select 1 from jsonb_array_elements_text(v_list) e where lower(trim(e)) = v_email)
    then coalesce(v_members->v_email, '{}'::jsonb) || jsonb_build_object(
      'email', v_email, 'role', case when v_email = any(v_owners) then 'admin'
        else coalesce(v_members->v_email->>'role', 'approver') end)
    else null end into v_before;

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

  select case when exists (select 1 from jsonb_array_elements_text(v_new) e where lower(trim(e)) = v_email)
    then coalesce(v_members->v_email, '{}'::jsonb) || jsonb_build_object(
      'email', v_email, 'role', case when v_email = any(v_owners) then 'admin'
        else coalesce(v_members->v_email->>'role', 'approver') end)
    else null end into v_after;

  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_client, v_action, v_email,
          jsonb_strip_nulls(jsonb_build_object(
            case when p_op = 'add' then 'invited' when p_op = 'remove' then 'removed' else 'member' end, v_email,
            'by', coalesce(p_actor, 'unknown'), 'emailed', false,
            'name', case when p_op = 'add' then v_name end,
            'role', case when p_op in ('add', 'set_role') then coalesce(v_role, 'approver') end))
          || jsonb_build_object('before', v_before, 'after', v_after));

  return public._board_team_apply(p_slug, 'list', null, p_actor) || jsonb_build_object('ok', true);
end;
$function$;
