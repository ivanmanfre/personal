-- Match the signed-in board edit/approve role gate for audience decisions.
-- The keyed-link function remains unchanged; owners still resolve as admins.
CREATE OR REPLACE FUNCTION public.client_board_audience_decide_v2(p_slug text, p_session text, p_ref text,
                                                                  p_decision text, p_reason text)
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
  if coalesce(btrim(v_board.client_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public._audn_decide(p_slug, v_board.client_id, p_ref, p_decision, p_reason);
end;
$function$;
