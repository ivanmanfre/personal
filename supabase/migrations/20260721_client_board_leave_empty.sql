-- Client board "Leave this day empty" (Phase 1 item 6, round 2, 2026-07-21).
-- A first-class action distinct from remove-with-nag: the client deliberately clears a
-- slot and it STAYS clear across reloads with NO restore prompt (unless he reopens that
-- slot). Reconstructed server-side from the insert-only client_board_actions audit
-- (day_left_empty minus a later day_refilled per ref), exactly like removed/replacements.
-- The write rides the existing 'note' action (no new write RPC). Extends client_board_slot_state
-- (+_v2) to also return a `left_empty` array. Additive to the returned jsonb — preview
-- boards never call these RPCs, so they are unaffected.

create or replace function public.client_board_slot_state(p_slug text, p_token text)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_board public.client_boards%rowtype; v_removed jsonb; v_repl jsonb; v_empty jsonb;
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
  return jsonb_build_object('ok', true, 'removed', v_removed, 'replacements', v_repl, 'left_empty', v_empty);
end $function$;

create or replace function public.client_board_slot_state_v2(p_slug text, p_session text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_hash text; v_board public.client_boards%rowtype; v_removed jsonb; v_repl jsonb; v_empty jsonb;
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
  return jsonb_build_object('ok', true, 'removed', v_removed, 'replacements', v_repl, 'left_empty', v_empty);
end $function$;
