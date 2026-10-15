-- Per-user attribution on the client board (2026-10-15).
-- client_board_action / _v2 stamp payload.by server-side (session email, or 'board link' for the
-- ?k= token). client_board_slot_state / _v2 also return approved_meta {ref: {by, at}} so the board
-- can show "Approved by Lyndsay, 14:02". Signatures unchanged (CREATE OR REPLACE).
-- Previous definitions: ~/.local/state/swishdm-review/backups/fn-*-20261015.sql

CREATE OR REPLACE FUNCTION public.client_board_slot_state(p_slug text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_board public.client_boards%rowtype; v_removed jsonb; v_repl jsonb; v_empty jsonb; v_approved jsonb;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select coalesce(jsonb_agg(s.ref), '[]'::jsonb) into v_removed
  from (
    select distinct on (a.ref) a.ref, a.payload->>'event' as ev
    from public.client_board_actions a
    where a.board_slug = p_slug and a.action = 'note' and a.ref is not null
      and a.payload->>'event' in ('post_removed','post_restored')
    order by a.ref, a.created_at desc
  ) s where s.ev = 'post_removed';
  select coalesce(jsonb_agg(jsonb_build_object(
           'ref', s.ref, 'draft_id', s.draft_id, 'title', s.title, 'hook', s.hook)), '[]'::jsonb)
    into v_repl
  from (
    select distinct on (a.ref) a.ref, a.payload->>'event' as ev,
           a.payload->>'draft_id' as draft_id, a.payload->>'title' as title, a.payload->>'hook' as hook
    from public.client_board_actions a
    where a.board_slug = p_slug and a.action = 'note' and a.ref is not null
      and a.payload->>'event' in ('slot_replaced','slot_replace_undone')
    order by a.ref, a.created_at desc
  ) s where s.ev = 'slot_replaced';
  select coalesce(jsonb_agg(s.ref), '[]'::jsonb) into v_empty
  from (
    select distinct on (a.ref) a.ref, a.payload->>'event' as ev
    from public.client_board_actions a
    where a.board_slug = p_slug and a.action = 'note' and a.ref is not null
      and a.payload->>'event' in ('day_left_empty','day_refilled')
    order by a.ref, a.created_at desc
  ) s where s.ev = 'day_left_empty';
    select coalesce(jsonb_agg(s.ref), '[]'::jsonb) into v_approved
  from (
    select distinct on (a.ref) a.ref, a.action
    from public.client_board_actions a
    where a.board_slug = p_slug and a.ref is not null
      and (a.action = 'approve'
           or (a.action = 'note' and a.payload->>'event' = 'undo_approve'))
    order by a.ref, a.created_at desc
  ) s where s.action = 'approve';
  return jsonb_build_object('ok', true, 'removed', v_removed, 'replacements', v_repl, 'left_empty', v_empty, 'approved', v_approved,
    -- Who approved each approved post, and when (latest approve row; walked-back ones drop out).
    'approved_meta', (select coalesce(jsonb_object_agg(s.ref, jsonb_build_object('by', s.by, 'at', s.created_at)), '{}'::jsonb)
      from (select distinct on (a.ref) a.ref, a.action, a.payload->>'by' as by, a.created_at
              from public.client_board_actions a
             where a.board_slug = p_slug and a.ref is not null
               and (a.action = 'approve' or (a.action = 'note' and a.payload->>'event' = 'undo_approve'))
             order by a.ref, a.created_at desc) s
     where s.action = 'approve'));
end $function$
;

CREATE OR REPLACE FUNCTION public.client_board_slot_state_v2(p_slug text, p_session text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_board public.client_boards%rowtype; v_removed jsonb; v_repl jsonb; v_empty jsonb; v_approved jsonb;
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
  select coalesce(jsonb_agg(s.ref), '[]'::jsonb) into v_removed
  from (
    select distinct on (a.ref) a.ref, a.payload->>'event' as ev
    from public.client_board_actions a
    where a.board_slug = p_slug and a.action = 'note' and a.ref is not null
      and a.payload->>'event' in ('post_removed','post_restored')
    order by a.ref, a.created_at desc
  ) s where s.ev = 'post_removed';
  select coalesce(jsonb_agg(jsonb_build_object(
           'ref', s.ref, 'draft_id', s.draft_id, 'title', s.title, 'hook', s.hook)), '[]'::jsonb)
    into v_repl
  from (
    select distinct on (a.ref) a.ref, a.payload->>'event' as ev,
           a.payload->>'draft_id' as draft_id, a.payload->>'title' as title, a.payload->>'hook' as hook
    from public.client_board_actions a
    where a.board_slug = p_slug and a.action = 'note' and a.ref is not null
      and a.payload->>'event' in ('slot_replaced','slot_replace_undone')
    order by a.ref, a.created_at desc
  ) s where s.ev = 'slot_replaced';
  select coalesce(jsonb_agg(s.ref), '[]'::jsonb) into v_empty
  from (
    select distinct on (a.ref) a.ref, a.payload->>'event' as ev
    from public.client_board_actions a
    where a.board_slug = p_slug and a.action = 'note' and a.ref is not null
      and a.payload->>'event' in ('day_left_empty','day_refilled')
    order by a.ref, a.created_at desc
  ) s where s.ev = 'day_left_empty';
    select coalesce(jsonb_agg(s.ref), '[]'::jsonb) into v_approved
  from (
    select distinct on (a.ref) a.ref, a.action
    from public.client_board_actions a
    where a.board_slug = p_slug and a.ref is not null
      and (a.action = 'approve'
           or (a.action = 'note' and a.payload->>'event' = 'undo_approve'))
    order by a.ref, a.created_at desc
  ) s where s.action = 'approve';
  return jsonb_build_object('ok', true, 'removed', v_removed, 'replacements', v_repl, 'left_empty', v_empty, 'approved', v_approved,
    -- Who approved each approved post, and when (latest approve row; walked-back ones drop out).
    'approved_meta', (select coalesce(jsonb_object_agg(s.ref, jsonb_build_object('by', s.by, 'at', s.created_at)), '{}'::jsonb)
      from (select distinct on (a.ref) a.ref, a.action, a.payload->>'by' as by, a.created_at
              from public.client_board_actions a
             where a.board_slug = p_slug and a.ref is not null
               and (a.action = 'approve' or (a.action = 'note' and a.payload->>'event' = 'undo_approve'))
             order by a.ref, a.created_at desc) s
     where s.action = 'approve'));
end$function$;

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
end;$function$;

CREATE OR REPLACE FUNCTION public.client_board_action(p_slug text, p_token text, p_action text, p_ref text DEFAULT NULL::text, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_board client_boards%rowtype;
begin
  -- G3: match get_client_board's expiry semantics.
  select * into v_board
  from client_boards
  where slug = p_slug
    and token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if p_action not in ('approve','edit_copy','request_changes','shift_request','note','invite') then
    return jsonb_build_object('ok', false, 'error', 'bad_action');
  end if;
  -- Token (board-link) actions carry no personal identity; say so instead of leaving it blank.
  insert into client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, p_action, p_ref,
          coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('by', 'board link'));
  return jsonb_build_object('ok', true);
end;
$function$
;
