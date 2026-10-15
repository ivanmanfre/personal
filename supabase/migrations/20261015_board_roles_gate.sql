-- Board roles, enforcement (2026-10-15): viewers cannot approve, request changes, edit,
-- schedule, remove, retitle or change images. Session RPCs only; the ?k= board link (v1 RPCs)
-- is unchanged. Inserted one guard line after the session check; bodies otherwise identical.
-- Previous definitions: ~/.local/state/swishdm-review/backups/fn-roles-before-*.sql

CREATE OR REPLACE FUNCTION public.client_board_edit_draft_v2(p_slug text, p_session text, p_draft_id uuid, p_body text, p_base text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_email text; v_board public.client_boards%rowtype; v_old text;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  select email into v_email from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;
  if public._board_member_role(p_slug, v_email) = 'viewer' then return jsonb_build_object('ok', false, 'error', 'view_only'); end if;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_body is null or length(p_body) < 20 or length(p_body) > 20000 then
    return jsonb_build_object('ok', false, 'error', 'bad_body'); end if;
  select post_body into v_old from public.carousel_drafts
   where id = p_draft_id and client_id = v_board.client_id and status in ('review', 'scheduled');
  if not found then return jsonb_build_object('ok', false, 'error', 'draft_not_editable'); end if;
  -- 2026-10-08: the copy the client started editing from. If it is no longer the post's copy (Ivan
  -- edited it in the inbox meanwhile), refuse instead of silently putting the old text back.
  if p_base is not null and btrim(p_base) is distinct from btrim(coalesce(v_old, '')) then
    return jsonb_build_object('ok', false, 'error', 'changed_meanwhile', 'current', v_old);
  end if;
  update public.carousel_drafts set post_body = p_body, updated_at = now() where id = p_draft_id;
  update public.client_boards set board = jsonb_set(board, '{queue}', coalesce((
      select jsonb_agg(case when (q->>'id') = p_draft_id::text
        then jsonb_set(jsonb_set(q, '{post_body}', to_jsonb(p_body)), '{body}', to_jsonb(p_body))
        else q end)
      from jsonb_array_elements(board->'queue') q), board->'queue'))
    where slug = p_slug;
  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, 'edit_copy', p_draft_id::text,
          jsonb_build_object('applied', true, 'before', v_old, 'after', p_body, 'by', v_email));
  return jsonb_build_object('ok', true);
end
$function$;

CREATE OR REPLACE FUNCTION public.client_board_set_schedule_v2(p_slug text, p_session text, p_draft_id uuid, p_scheduled_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_email text; v_board public.client_boards%rowtype; v_old timestamptz; v_date text;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  select email into v_email from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;
  if public._board_member_role(p_slug, v_email) = 'viewer' then return jsonb_build_object('ok', false, 'error', 'view_only'); end if;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_scheduled_at is not null and (p_scheduled_at < now() - interval '5 minutes' or p_scheduled_at > now() + interval '365 days') then
    return jsonb_build_object('ok', false, 'error', 'bad_date'); end if;
  select scheduled_at into v_old from public.carousel_drafts
   where id = p_draft_id and client_id = v_board.client_id and status in ('review', 'scheduled');
  if not found then return jsonb_build_object('ok', false, 'error', 'draft_not_schedulable'); end if;
  -- 2026-10-08: the panel says a dated post "publishes". For RISE that needs status=scheduled since the
  -- 10-07 publisher hardening, so the client's own date arms a post that is on the board.
  update public.carousel_drafts set scheduled_at = p_scheduled_at, updated_at = now(),
         status = case when v_board.client_id = 'risedtc' and board_visible is true and status = 'review'
                        and p_scheduled_at is not null then 'scheduled' else status end
   where id = p_draft_id;
  v_date := case when p_scheduled_at is null then null else to_char(p_scheduled_at at time zone 'UTC', 'YYYY-MM-DD') end;
  update public.client_boards set board = jsonb_set(board, '{queue}', coalesce((
      select jsonb_agg(case when (q->>'id') = p_draft_id::text
        then case when v_date is null then (q - 'publish_date') else jsonb_set(q, '{publish_date}', to_jsonb(v_date)) end
        else q end)
      from jsonb_array_elements(board->'queue') q), board->'queue'))
    where slug = p_slug;
  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, 'set_schedule', p_draft_id::text,
          jsonb_build_object('applied', true, 'before', v_old, 'after', p_scheduled_at, 'by', v_email));
  return jsonb_build_object('ok', true, 'scheduled_at', p_scheduled_at);
end
$function$;

CREATE OR REPLACE FUNCTION public.client_board_hide_draft_v2(p_slug text, p_session text, p_draft_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_email text; v_board public.client_boards%rowtype;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  select email into v_email from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;
  if public._board_member_role(p_slug, v_email) = 'viewer' then return jsonb_build_object('ok', false, 'error', 'view_only'); end if;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public._client_board_hide_apply(v_board, p_slug, p_draft_id, v_email);
end
$function$;

CREATE OR REPLACE FUNCTION public.client_board_set_media_v2(p_slug text, p_session text, p_draft_id uuid, p_media_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_email text; v_board public.client_boards%rowtype;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  select email into v_email from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;
  if public._board_member_role(p_slug, v_email) = 'viewer' then return jsonb_build_object('ok', false, 'error', 'view_only'); end if;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public._client_board_apply_media(v_board, p_slug, p_draft_id, p_media_url, v_email);
end
$function$;

CREATE OR REPLACE FUNCTION public.client_board_edit_title_v2(p_slug text, p_session text, p_draft_id uuid, p_title text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_email text; v_board public.client_boards%rowtype; v_old text; v_title text;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  select email into v_email from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;
  if public._board_member_role(p_slug, v_email) = 'viewer' then return jsonb_build_object('ok', false, 'error', 'view_only'); end if;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  v_title := btrim(regexp_replace(coalesce(p_title, ''), E'[\r\n]+', ' ', 'g'));
  if length(v_title) < 3 or length(v_title) > 140 then
    return jsonb_build_object('ok', false, 'error', 'bad_title'); end if;
  select title into v_old from public.carousel_drafts
   where id = p_draft_id and client_id = v_board.client_id and status in ('review', 'scheduled');
  if not found then return jsonb_build_object('ok', false, 'error', 'draft_not_editable'); end if;
  update public.carousel_drafts set title = v_title, updated_at = now() where id = p_draft_id;
  update public.client_boards set board = jsonb_set(board, '{queue}', coalesce((
      select jsonb_agg(case when (q->>'id') = p_draft_id::text
        then jsonb_set(q, '{title}', to_jsonb(v_title))
        else q end)
      from jsonb_array_elements(board->'queue') q), board->'queue'))
    where slug = p_slug;
  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, 'edit_title', p_draft_id::text,
          jsonb_build_object('applied', true, 'before', v_old, 'after', v_title, 'by', v_email));
  return jsonb_build_object('ok', true);
end
$function$;

CREATE OR REPLACE FUNCTION public.client_board_action_v2(p_slug text, p_session text, p_action text, p_ref text DEFAULT NULL::text, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_hash  text;
  v_email text;
  v_board public.client_boards%rowtype;
begin
  if coalesce(p_session, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');

  select email into v_email
  from public.client_board_sessions
  where slug = p_slug
    and token_hash = v_hash
    and revoked_at is null
    and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  update public.client_board_sessions set last_seen_at = now()
    where slug = p_slug and token_hash = v_hash;
  -- Roles (2026-10-15): viewers read and comment; every board action here needs an approver.
  if public._board_member_role(p_slug, v_email) = 'viewer' then return jsonb_build_object('ok', false, 'error', 'view_only'); end if;

  -- G3 fix: v1 omits the expires_at guard get_client_board enforces. v2 includes it.
  select * into v_board
  from public.client_boards
  where slug = p_slug
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_action not in ('approve', 'edit_copy', 'request_changes', 'shift_request', 'note', 'invite') then
    return jsonb_build_object('ok', false, 'error', 'bad_action');
  end if;

  -- Every action is attributed server-side to the signed-in member (never trusted from the client).
  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, p_action, p_ref,
          coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('by', lower(v_email)));

  return jsonb_build_object('ok', true);
end;
$function$;
