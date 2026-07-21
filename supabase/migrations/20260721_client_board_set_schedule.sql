-- Client board scheduling (Phase 2, round 2, 2026-07-21):
--   1. carousel_drafts.source_detail jsonb — honest, concrete per-draft provenance
--      (call title + verbatim quote for call-grounded posts; launch/own-post labels).
--      Read server-side into the board queue so the source chip never says a vague
--      "Picked by Ivan". Survives Client Board Queue Sync (its kept-path Object.assign
--      preserves queue-item fields; the sync's mapDraft also maps source_detail now).
--   2. client_board_set_schedule(+_v2) — the client (Mattan) edits a post's date/time
--      from the board. SECURITY DEFINER, same token/session gating as
--      client_board_edit_draft. Writes carousel_drafts.scheduled_at + refreshes the
--      board.queue publish_date + logs a client_board_actions row. p_scheduled_at NULL
--      clears the schedule (back to the buffer). client_board_schedule (read path) stays
--      the schedule authority and reads scheduled_at directly, so it stays coherent.

-- ---- source_detail column -------------------------------------------------
alter table public.carousel_drafts add column if not exists source_detail jsonb;

-- ---- set_schedule (token) --------------------------------------------------
create or replace function public.client_board_set_schedule(p_slug text, p_token text, p_draft_id uuid, p_scheduled_at timestamptz)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_board public.client_boards%rowtype; v_old timestamptz; v_date text;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  -- Sane bound: no scheduling in the past-year or > 1 year out (NULL = clear, allowed).
  if p_scheduled_at is not null and (p_scheduled_at < now() - interval '1 day' or p_scheduled_at > now() + interval '365 days') then
    return jsonb_build_object('ok', false, 'error', 'bad_date'); end if;
  select scheduled_at into v_old from public.carousel_drafts
   where id = p_draft_id and client_id = v_board.client_id and status in ('review', 'scheduled');
  if not found then return jsonb_build_object('ok', false, 'error', 'draft_not_schedulable'); end if;
  update public.carousel_drafts set scheduled_at = p_scheduled_at, updated_at = now() where id = p_draft_id;
  v_date := case when p_scheduled_at is null then null else to_char(p_scheduled_at at time zone 'UTC', 'YYYY-MM-DD') end;
  update public.client_boards set board = jsonb_set(board, '{queue}', coalesce((
      select jsonb_agg(case when (q->>'id') = p_draft_id::text
        then case when v_date is null then (q - 'publish_date') else jsonb_set(q, '{publish_date}', to_jsonb(v_date)) end
        else q end)
      from jsonb_array_elements(board->'queue') q), board->'queue'))
    where slug = p_slug;
  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, 'set_schedule', p_draft_id::text,
          jsonb_build_object('applied', true, 'before', v_old, 'after', p_scheduled_at));
  return jsonb_build_object('ok', true, 'scheduled_at', p_scheduled_at);
end $function$;

-- ---- set_schedule (session) ------------------------------------------------
create or replace function public.client_board_set_schedule_v2(p_slug text, p_session text, p_draft_id uuid, p_scheduled_at timestamptz)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
declare v_hash text; v_email text; v_board public.client_boards%rowtype; v_old timestamptz; v_date text;
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
  if p_scheduled_at is not null and (p_scheduled_at < now() - interval '1 day' or p_scheduled_at > now() + interval '365 days') then
    return jsonb_build_object('ok', false, 'error', 'bad_date'); end if;
  select scheduled_at into v_old from public.carousel_drafts
   where id = p_draft_id and client_id = v_board.client_id and status in ('review', 'scheduled');
  if not found then return jsonb_build_object('ok', false, 'error', 'draft_not_schedulable'); end if;
  update public.carousel_drafts set scheduled_at = p_scheduled_at, updated_at = now() where id = p_draft_id;
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
end $function$;

grant execute on function public.client_board_set_schedule(text, text, uuid, timestamptz) to anon, authenticated;
grant execute on function public.client_board_set_schedule_v2(text, text, uuid, timestamptz) to anon, authenticated;
