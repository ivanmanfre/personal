-- Board photo uploads: attribution + optional "client moment" note (2026-10-15).
-- The board uploads straight to storage (client-photos/<slug>/...), as before. It then calls
-- board_photo_added, which records WHO uploaded it (client_board_actions 'photo_upload', by =
-- session email or 'board link'). On boards with board.photo_notes = true, a non-empty note
-- also stages a held client_ideas row ("Client moment") for the client's lane: status 'staged',
-- meta.held = true. Nothing generates from it: staged ideas only reach a writer after Ivan
-- approves them, and the swishdm generator lane is off (client_generator_config is_active=false).

create or replace function public.board_photo_added(p_slug text, p_path text, p_note text default null,
                                                    p_session text default null, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller text := public._board_team_caller(p_slug, p_session, p_token);
  v_board  public.client_boards%rowtype;
  v_note   text := btrim(coalesce(p_note, ''));
  v_url    text;
  v_idea   uuid;
begin
  if v_caller is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if coalesce(p_path, '') = '' or length(p_path) > 300 or p_path not like p_slug || '/%'
     or p_path like '%..%' or p_path ~ '[[:space:]]' then
    return jsonb_build_object('ok', false, 'error', 'bad_path');
  end if;
  if length(v_note) > 1000 then
    return jsonb_build_object('ok', false, 'error', 'note_too_long');
  end if;
  v_url := 'https://bjbvqvzbzczjbatgmccb.supabase.co/storage/v1/object/public/client-photos/' || p_path;

  if v_note <> '' and coalesce(v_board.board->>'photo_notes', '') = 'true' then
    insert into public.client_ideas (client_id, hook, title, source_label, source_ref, status, lane, taxonomy, meta)
    values (v_board.client_id,
            left(split_part(v_note, E'\n', 1), 140),
            left('Client moment: ' || split_part(v_note, E'\n', 1), 120),
            'Client moment', p_path, 'staged', v_board.client_id,
            jsonb_build_object('register', 'personal', 'story_ref', 'client_moment'),
            jsonb_build_object('held', true, 'lane', v_board.client_id, 'kind', 'client_moment',
                               'photo_url', v_url, 'photo_path', p_path,
                               'editorial_brief', v_note, 'consent_tier', 'client_supplied',
                               'by', v_caller, 'board_slug', p_slug))
    returning id into v_idea;
  end if;

  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, 'photo_upload', p_path,
          jsonb_build_object('by', v_caller, 'path', p_path, 'note', nullif(v_note, ''), 'idea_id', v_idea));

  return jsonb_build_object('ok', true, 'idea_id', v_idea);
end;
$$;

grant execute on function public.board_photo_added(text, text, text, text, text) to anon, authenticated;
