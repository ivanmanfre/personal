-- Preserve live signatures/grants and close pre-existing viewer and unverified-photo write gaps.
-- Apply after snapshot and Activity migrations. No historical audit entries are rewritten.

CREATE OR REPLACE FUNCTION public.client_board_edit_lm_promo_v2(p_slug text, p_session text, p_lm_id text, p_field text, p_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_email text; v_board public.client_boards%rowtype; v_found boolean; v_before jsonb;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  select email into v_email from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;
  if public._board_member_role(p_slug, v_email) = 'viewer' then return jsonb_build_object('ok', false, 'error', 'view_only'); end if;

  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now()) for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  if p_field = 'email' then
    if p_value is null or jsonb_typeof(p_value) <> 'object'
       or p_value->>'subject' is null or p_value->>'body' is null then
      return jsonb_build_object('ok', false, 'error', 'bad_field'); end if;
  elsif p_field = 'dm' then
    if p_value is null or jsonb_typeof(p_value) <> 'string' then
      return jsonb_build_object('ok', false, 'error', 'bad_field'); end if;
  else
    return jsonb_build_object('ok', false, 'error', 'bad_field');
  end if;

  select exists (
    select 1 from jsonb_array_elements(coalesce(v_board.board->'lead_magnets', '[]'::jsonb)) e
     where e->>'id' = p_lm_id
  ) into v_found;
  if not v_found then return jsonb_build_object('ok', false, 'error', 'lm_not_found'); end if;

  select e->'promo'->p_field into v_before
    from jsonb_array_elements(v_board.board->'lead_magnets') e where e->>'id' = p_lm_id;

  update public.client_boards set board = jsonb_set(board, '{lead_magnets}', coalesce((
      select jsonb_agg(case when (m->>'id') = p_lm_id
        then jsonb_set(m, '{promo}', coalesce(m->'promo', '{}'::jsonb) || jsonb_build_object(p_field, p_value))
        else m end)
      from jsonb_array_elements(board->'lead_magnets') m), board->'lead_magnets'))
    where slug = p_slug;

  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, 'edit_lm_promo', p_lm_id,
          jsonb_build_object('field', p_field, 'applied', true, 'by', v_email, 'before', v_before, 'after', p_value));

  return jsonb_build_object('ok', true);
end $function$;

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
  if v_caller <> 'board link' and public._board_member_role(p_slug, v_caller) = 'viewer' then
    return jsonb_build_object('ok', false, 'error', 'view_only');
  end if;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if coalesce(p_path, '') = '' or length(p_path) > 300 or left(p_path, length(p_slug) + 1) <> p_slug || '/'
     or p_path like '%..%' or p_path ~ '[[:space:]]' then
    return jsonb_build_object('ok', false, 'error', 'bad_path');
  end if;
  if length(v_note) > 1000 then
    return jsonb_build_object('ok', false, 'error', 'note_too_long');
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'client-photos' and name = p_path) then
    return jsonb_build_object('ok', false, 'error', 'storage_unconfirmed');
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

