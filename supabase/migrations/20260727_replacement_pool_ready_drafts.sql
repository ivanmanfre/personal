-- Swap-picker pool was empty by construction: it excluded queue members, but the queue
-- sync puts EVERY board_visible draft in the queue. Pool now = visible review drafts not
-- occupying a calendar slot (scheduled_at null), TEST rows excluded. Applied 2026-07-27.
CREATE OR REPLACE FUNCTION public.client_board_replacement_pool(p_slug text, p_token text)
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
           'id', cd.id,
           'title', left(coalesce(cd.title,''),120),
           'body', left(coalesce(cd.post_body,''),400)
         ) order by cd.created_at desc), '[]'::jsonb)
    into v_items
    from public.carousel_drafts cd
   where cd.client_id = v_board.client_id
     and cd.board_visible = true
     and cd.status = 'review'
     and cd.scheduled_at is null
     and coalesce(cd.title,'') not like '[TEST%';
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$;

CREATE OR REPLACE FUNCTION public.client_board_replacement_pool_v2(p_slug text, p_session text)
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
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', cd.id,
           'title', left(coalesce(cd.title,''),120),
           'body', left(coalesce(cd.post_body,''),400)
         ) order by cd.created_at desc), '[]'::jsonb)
    into v_items
    from public.carousel_drafts cd
   where cd.client_id = v_board.client_id
     and cd.board_visible = true
     and cd.status = 'review'
     and cd.scheduled_at is null
     and coalesce(cd.title,'') not like '[TEST%';
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$;
