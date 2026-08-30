-- Deck title editing from the client board (2026-08-30).
-- Mirrors client_board_edit_draft/_v2 exactly (one SECURITY DEFINER RPC pair per field,
-- same posture as edit_lm_promo / set_media): validates token (v1) or session (v2),
-- allows edits only on review/scheduled rows owned by the board's client, writes
-- carousel_drafts.title AND the cached client_boards.board.queue item in one call,
-- and logs an edit_title action with before/after.
-- APPLIED to bjbvqvzbzczjbatgmccb via the Management API on 2026-08-30; this file is the record.

CREATE OR REPLACE FUNCTION public.client_board_edit_title(p_slug text, p_token text, p_draft_id uuid, p_title text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_board public.client_boards%rowtype; v_old text; v_title text;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
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
          jsonb_build_object('applied', true, 'before', v_old, 'after', v_title, 'by', 'board'));
  return jsonb_build_object('ok', true);
end $function$;

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
end $function$;

GRANT EXECUTE ON FUNCTION public.client_board_edit_title(text, text, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.client_board_edit_title_v2(text, text, uuid, text) TO anon, authenticated, service_role;
