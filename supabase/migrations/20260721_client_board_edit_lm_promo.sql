-- client_board_edit_lm_promo (v1 = token-gated, v2 = session-gated)
-- Lets a client edit an LM's delivery email {subject,body} or share/keyword DM (string).
-- Mirrors client_board_edit_draft / _v2 exactly (gating, jsonb_agg CASE over the array,
-- client_board_actions audit row). Additive; touches only client_boards.board.lead_magnets.

-- ---------- v1: token-gated ----------
CREATE OR REPLACE FUNCTION public.client_board_edit_lm_promo(
  p_slug text, p_token text, p_lm_id text, p_field text, p_value jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_board public.client_boards%rowtype; v_found boolean;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  -- Validate the field + value shape.
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

  -- Does an LM with this id exist?
  select exists (
    select 1 from jsonb_array_elements(coalesce(v_board.board->'lead_magnets', '[]'::jsonb)) e
     where e->>'id' = p_lm_id
  ) into v_found;
  if not v_found then return jsonb_build_object('ok', false, 'error', 'lm_not_found'); end if;

  update public.client_boards set board = jsonb_set(board, '{lead_magnets}', coalesce((
      select jsonb_agg(case when (m->>'id') = p_lm_id
        then jsonb_set(m, '{promo}', coalesce(m->'promo', '{}'::jsonb) || jsonb_build_object(p_field, p_value))
        else m end)
      from jsonb_array_elements(board->'lead_magnets') m), board->'lead_magnets'))
    where slug = p_slug;

  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, 'edit_lm_promo', p_lm_id,
          jsonb_build_object('field', p_field, 'applied', true));

  return jsonb_build_object('ok', true);
end $function$;

-- ---------- v2: session-gated ----------
CREATE OR REPLACE FUNCTION public.client_board_edit_lm_promo_v2(
  p_slug text, p_session text, p_lm_id text, p_field text, p_value jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_email text; v_board public.client_boards%rowtype; v_found boolean;
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

  update public.client_boards set board = jsonb_set(board, '{lead_magnets}', coalesce((
      select jsonb_agg(case when (m->>'id') = p_lm_id
        then jsonb_set(m, '{promo}', coalesce(m->'promo', '{}'::jsonb) || jsonb_build_object(p_field, p_value))
        else m end)
      from jsonb_array_elements(board->'lead_magnets') m), board->'lead_magnets'))
    where slug = p_slug;

  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, 'edit_lm_promo', p_lm_id,
          jsonb_build_object('field', p_field, 'applied', true, 'by', v_email));

  return jsonb_build_object('ok', true);
end $function$;

-- ---------- grants ----------
grant execute on function public.client_board_edit_lm_promo(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.client_board_edit_lm_promo_v2(text, text, text, text, jsonb) to anon, authenticated;
