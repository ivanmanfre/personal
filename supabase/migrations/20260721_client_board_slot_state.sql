-- Client board slot mechanics: server-side truth for removed slots + replacements,
-- and the replacement pool. Mirrors the token/session posture of client_board_draft_history.
-- Removed slots survive a hard refresh by reconstructing from the insert-only
-- client_board_actions audit (post_removed minus a later post_restored per ref).
-- Replacements reconstruct the same way (slot_replaced minus slot_replace_undone).
-- No new write path: slot_replaced / slot_replace_undone ride the existing 'note' action.

-- ---- slot_state (token) --------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_board_slot_state(p_slug text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_board public.client_boards%rowtype; v_removed jsonb; v_repl jsonb;
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
  return jsonb_build_object('ok', true, 'removed', v_removed, 'replacements', v_repl);
end $function$;

-- ---- slot_state (session) ------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_board_slot_state_v2(p_slug text, p_session text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_board public.client_boards%rowtype; v_removed jsonb; v_repl jsonb;
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
  return jsonb_build_object('ok', true, 'removed', v_removed, 'replacements', v_repl);
end $function$;

-- ---- replacement_pool (token) --------------------------------------------
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
     and cd.id::text not in (
       select q->>'id' from jsonb_array_elements(coalesce(v_board.board->'queue','[]'::jsonb)) q
     );
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$;

-- ---- replacement_pool (session) ------------------------------------------
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
     and cd.id::text not in (
       select q->>'id' from jsonb_array_elements(coalesce(v_board.board->'queue','[]'::jsonb)) q
     );
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$;

grant execute on function public.client_board_slot_state(text, text) to anon, authenticated;
grant execute on function public.client_board_slot_state_v2(text, text) to anon, authenticated;
grant execute on function public.client_board_replacement_pool(text, text) to anon, authenticated;
grant execute on function public.client_board_replacement_pool_v2(text, text) to anon, authenticated;
