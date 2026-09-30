-- Restore the exact saved post feedback in the review field.
-- Keep display truncation for other history notes and preserve existing auth guards.
begin;

CREATE OR REPLACE FUNCTION public.client_board_draft_history(p_slug text, p_token text, p_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_board public.client_boards%rowtype; v_items jsonb;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'action', a.action,
           'at', a.created_at,
           'by', a.payload->>'by',
           'event', a.payload->>'event',
           'note', case when a.action = 'request_changes' then coalesce(a.payload->>'note','') else left(coalesce(a.payload->>'note',''), 280) end,
           'before', left(coalesce(a.payload->>'before',''), 4000),
           'after', left(coalesce(a.payload->>'after',''), 4000)
         ) order by a.created_at desc), '[]'::jsonb)
    into v_items
    from (select * from public.client_board_actions
           where board_slug = p_slug and ref = p_ref
           order by created_at desc limit 50) a;
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$
;

CREATE OR REPLACE FUNCTION public.client_board_draft_history_v2(p_slug text, p_session text, p_ref text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_board public.client_boards%rowtype; v_items jsonb;
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
  select coalesce(jsonb_agg(jsonb_build_object(
           'action', a.action,
           'at', a.created_at,
           'by', a.payload->>'by',
           'event', a.payload->>'event',
           'note', case when a.action = 'request_changes' then coalesce(a.payload->>'note','') else left(coalesce(a.payload->>'note',''), 280) end,
           'before', left(coalesce(a.payload->>'before',''), 4000),
           'after', left(coalesce(a.payload->>'after',''), 4000)
         ) order by a.created_at desc), '[]'::jsonb)
    into v_items
    from (select * from public.client_board_actions
           where board_slug = p_slug and ref = p_ref
           order by created_at desc limit 50) a;
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$
;

commit;
