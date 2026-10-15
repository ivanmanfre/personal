-- Durable storage intents, atomic slot notes, and a client-safe board activity read.
-- Requires existing board roles/comments/photo_added functions. No historical rewrites.
CREATE OR REPLACE FUNCTION public.board_photo_operation(
  p_slug text, p_path text, p_operation text, p_phase text,
  p_operation_id uuid DEFAULT NULL, p_note text DEFAULT NULL,
  p_session text DEFAULT NULL, p_token text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE
  v_by text := public._board_team_caller(p_slug,p_session,p_token);
  v_board public.client_boards%rowtype;
  v_start public.client_board_actions%rowtype;
  v_id uuid;
  v_exists boolean;
  v_after jsonb;
  v_result jsonb;
BEGIN
  IF v_by IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_authenticated'); END IF;
  IF v_by <> 'board link' AND public._board_member_role(p_slug,v_by)='viewer' THEN RETURN jsonb_build_object('ok',false,'error','view_only'); END IF;
  SELECT * INTO v_board FROM public.client_boards WHERE slug=p_slug AND (expires_at IS NULL OR expires_at>now());
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF coalesce(p_path,'')='' OR length(p_path)>300 OR left(p_path,length(p_slug)+1)<>p_slug||'/'
    OR p_path LIKE '%..%' OR p_path ~ '[[:space:]]' OR coalesce(p_operation,'') NOT IN ('upload','delete')
    OR coalesce(p_phase,'') NOT IN ('started','completed','failed') OR length(coalesce(p_note,''))>1000 THEN
    RETURN jsonb_build_object('ok',false,'error','bad_operation');
  END IF;
  SELECT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='client-photos' AND name=p_path) INTO v_exists;
  v_after := jsonb_build_object('path',p_path,'exists',v_exists);
  IF p_phase='started' THEN
    IF (p_operation='upload' AND v_exists) OR (p_operation='delete' AND NOT v_exists) THEN
      RETURN jsonb_build_object('ok',false,'error','storage_changed');
    END IF;
    INSERT INTO public.client_board_actions(board_slug,client_id,action,ref,payload)
    VALUES(p_slug,v_board.client_id,'photo_operation',p_path,jsonb_build_object(
      'by',v_by,'operation',p_operation,'phase','started','before',v_after,'after',NULL,'note',nullif(p_note,''))) RETURNING id INTO v_id;
    RETURN jsonb_build_object('ok',true,'operation_id',v_id);
  END IF;
  SELECT * INTO v_start FROM public.client_board_actions WHERE id=p_operation_id AND board_slug=p_slug
    AND action='photo_operation' AND ref=p_path AND payload->>'phase'='started'
    AND payload->>'operation'=p_operation AND payload->>'by'=v_by FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','operation_not_found'); END IF;
  IF EXISTS(SELECT 1 FROM public.client_board_actions WHERE board_slug=p_slug AND action='photo_operation'
    AND payload->>'operation_id'=p_operation_id::text) THEN RETURN jsonb_build_object('ok',false,'error','already_finished'); END IF;
  -- Only storage state can confirm completion; a client cannot assert a missing upload.
  IF p_phase='completed' AND v_exists<>(p_operation='upload') THEN RETURN jsonb_build_object('ok',false,'error','storage_unconfirmed'); END IF;
  IF p_phase='completed' AND p_operation='upload' AND p_path NOT LIKE p_slug||'/voicenotes/%' THEN
    v_result := public.board_photo_added(p_slug,p_path,v_start.payload->>'note',p_session,p_token);
    IF v_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Photo receipt failed'; END IF;
  END IF;
  INSERT INTO public.client_board_actions(board_slug,client_id,action,ref,payload)
  VALUES(p_slug,v_board.client_id,'photo_operation',p_path,jsonb_build_object(
    'by',v_by,'operation',p_operation,'phase',p_phase,'operation_id',p_operation_id,
    'before',v_start.payload->'before','after',v_after));
  RETURN jsonb_build_object('ok',true,'operation_id',p_operation_id);
END $$;
REVOKE ALL ON FUNCTION public.board_photo_operation(text,text,text,text,uuid,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.board_photo_operation(text,text,text,text,uuid,text,text,text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.board_slot_notes(
  p_slug text, p_events jsonb, p_session text DEFAULT NULL, p_token text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_by text := public._board_team_caller(p_slug,p_session,p_token); v_client text; v_e jsonb; v_before jsonb; v_after jsonb;
BEGIN
  IF v_by IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_authenticated'); END IF;
  IF v_by<>'board link' AND public._board_member_role(p_slug,v_by)='viewer' THEN RETURN jsonb_build_object('ok',false,'error','view_only'); END IF;
  SELECT client_id INTO v_client FROM public.client_boards WHERE slug=p_slug AND (expires_at IS NULL OR expires_at>now()) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF jsonb_typeof(p_events) IS DISTINCT FROM 'array' OR jsonb_array_length(p_events) NOT BETWEEN 1 AND 4 THEN RETURN jsonb_build_object('ok',false,'error','bad_events'); END IF;
  FOR v_e IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    IF coalesce(v_e->>'ref','')='' OR length(v_e->>'ref')>200 OR jsonb_typeof(v_e->'payload') IS DISTINCT FROM 'object'
      OR coalesce(v_e->'payload'->>'event','') NOT IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve') THEN
      RETURN jsonb_build_object('ok',false,'error','bad_event');
    END IF;
  END LOOP;
  FOR v_e IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    SELECT payload-'by'-'before'-'after' INTO v_before FROM public.client_board_actions
      WHERE board_slug=p_slug AND ref=v_e->>'ref' AND action='note' ORDER BY created_at DESC,id DESC LIMIT 1;
    v_after := (v_e->'payload')-'by'-'before'-'after';
    INSERT INTO public.client_board_actions(board_slug,client_id,action,ref,payload,created_at)
      VALUES(p_slug,v_client,'note',v_e->>'ref',v_after||jsonb_build_object('by',v_by,'before',v_before,'after',v_after),clock_timestamp());
  END LOOP;
  RETURN jsonb_build_object('ok',true);
END $$;
REVOKE ALL ON FUNCTION public.board_slot_notes(text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.board_slot_notes(text,jsonb,text,text) TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.board_activity(
  p_slug text, p_session text DEFAULT NULL, p_token text DEFAULT NULL,
  p_before_at timestamptz DEFAULT NULL, p_before_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_by text := public._board_team_caller(p_slug,p_session,p_token); v_rows jsonb;
BEGIN
  IF v_by IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_authenticated'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.client_boards WHERE slug=p_slug AND (expires_at IS NULL OR expires_at>now())) THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF (p_before_at IS NULL) <> (p_before_id IS NULL) THEN RETURN jsonb_build_object('ok',false,'error','bad_cursor'); END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'action',action,'ref',ref,'at',created_at,
    'by',CASE WHEN payload->>'by' ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN payload->>'by' WHEN payload->>'by'='board link' THEN 'board link' WHEN payload->>'by' IN ('system','Content team / system') THEN 'Content team / system' ELSE 'Unattributed legacy action' END,'event',payload->>'event','field',payload->>'field',
    'phase',payload->>'phase','operation',payload->>'operation','operation_id',payload->>'operation_id',
    'before',payload->'before','after',payload->'after',
    'text',CASE WHEN action='comment' THEN payload->>'text' END,
    'note',CASE WHEN action IN ('request_changes','shift_request') THEN payload->>'note' WHEN action IN ('audn_accept','audn_reject','audn_defer') THEN payload->>'reason' END
  ) ORDER BY created_at DESC,id DESC),'[]') INTO v_rows FROM (
    SELECT id,action,ref,created_at,payload FROM public.client_board_actions
    WHERE board_slug=p_slug AND (p_before_at IS NULL OR (created_at,id)<(p_before_at,p_before_id))
      AND (action IN ('approve','request_changes','edit_copy','edit_title','set_media','set_schedule','hide_draft',
        'comment','invite','team_remove','team_role','edit_lm_promo','photo_upload','delete_photo','photo_operation',
        'shift_request','audn_accept','audn_reject','audn_defer','classification_proposed','edit_tags')
        OR (action='note' AND payload->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve','voice_note','idea_note','idea_draft_next','idea_pass')))
    ORDER BY created_at DESC,id DESC LIMIT 50
  ) a;
  RETURN jsonb_build_object('ok',true,'items',v_rows);
END $$;
REVOKE ALL ON FUNCTION public.board_activity(text,text,text,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.board_activity(text,text,text,timestamptz,uuid) TO anon,authenticated,service_role;

-- Preserve the existing audience authorization, but retain the actual deciding member.
CREATE OR REPLACE FUNCTION public._audn_decide(p_slug text, p_client_id text, p_ref text, p_decision text, p_reason text, p_by text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare v_action text; v_reason text; v_before jsonb;
begin
  v_action := case lower(coalesce(p_decision, ''))
                when 'accept' then 'audn_accept'
                when 'reject' then 'audn_reject'
                when 'defer'  then 'audn_defer'
                else null end;
  if v_action is null then return jsonb_build_object('ok', false, 'error', 'bad_decision'); end if;
  v_reason := btrim(regexp_replace(coalesce(p_reason, ''), E'[\r\n]+', ' ', 'g'));
  if length(v_reason) < 3 or length(v_reason) > 600 then
    return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
  if coalesce(p_ref, '') not like 'audn-rec:%' then
    return jsonb_build_object('ok', false, 'error', 'bad_ref'); end if;
  -- the recommendation must belong to THIS board's client
  if to_regclass('public.client_ideas') is null then
    return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  perform 1 from public.client_ideas ci
    where ci.client_id = p_client_id and ci.source_ref = p_ref;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  perform 1 from public.client_boards where slug=p_slug and client_id=p_client_id for update;
  if not found then return jsonb_build_object('ok',false,'error','not_found'); end if;
  select jsonb_build_object('decision',replace(action,'audn_',''),'reason',payload->>'reason') into v_before
    from public.client_board_actions where board_slug=p_slug and ref=p_ref and action in ('audn_accept','audn_reject','audn_defer') order by created_at desc,id desc limit 1;
  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, p_client_id, v_action, p_ref,
          jsonb_build_object('reason',v_reason,'by',p_by,'before',v_before,'after',jsonb_build_object('decision',lower(p_decision),'reason',v_reason)));
  return jsonb_build_object('ok', true, 'decision', lower(p_decision));
end;
$function$
;
REVOKE ALL ON FUNCTION public._audn_decide(text,text,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public._audn_decide(text,text,text,text,text,text) TO service_role;
CREATE OR REPLACE FUNCTION public._audn_decide(p_slug text,p_client_id text,p_ref text,p_decision text,p_reason text) RETURNS jsonb LANGUAGE sql SET search_path=public AS $$ SELECT public._audn_decide(p_slug,p_client_id,p_ref,p_decision,p_reason,'board link') $$;
CREATE OR REPLACE FUNCTION public.client_board_audience_decide_v2(p_slug text, p_session text, p_ref text, p_decision text, p_reason text)
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
  return public._audn_decide(p_slug, v_board.client_id, p_ref, p_decision, p_reason, lower(v_email));
end;
$function$
;

-- Preserve generic action auth while retaining a client-safe change receipt.
CREATE OR REPLACE FUNCTION public.client_board_action(p_slug text, p_token text, p_action text, p_ref text DEFAULT NULL::text, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_board client_boards%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  -- G3: match get_client_board's expiry semantics.
  select * into v_board
  from client_boards
  where slug = p_slug
    and token = p_token
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if p_action not in ('approve','edit_copy','request_changes','shift_request','note','invite') then
    return jsonb_build_object('ok', false, 'error', 'bad_action');
  end if;
  -- Token (board-link) actions carry no personal identity; say so instead of leaving it blank.
  if p_action = 'edit_copy' then
    select to_jsonb(coalesce(q->>'body',q->>'hook')) into v_before
      from jsonb_array_elements(coalesce(v_board.board->'queue','[]') || coalesce(v_board.board->'ideas','[]')) q where q->>'id'=p_ref limit 1;
    v_after := coalesce(p_payload->'body','null'::jsonb);
  else
    select jsonb_build_object('action',action,'event',payload->>'event') into v_before
      from public.client_board_actions where board_slug=p_slug and ref is not distinct from p_ref
      order by created_at desc,id desc limit 1;
    v_after := jsonb_build_object('action',p_action) || (coalesce(p_payload,'{}'::jsonb)-'by'-'before'-'after');
  end if;
  insert into client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, p_action, p_ref,
          coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('by','board link','before',v_before,'after',v_after));
  return jsonb_build_object('ok', true);
end;
$function$
;

-- Preserve generic action auth while retaining a client-safe change receipt.
CREATE OR REPLACE FUNCTION public.client_board_action_v2(p_slug text, p_session text, p_action text, p_ref text DEFAULT NULL::text, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_hash  text;
  v_email text;
  v_board public.client_boards%rowtype;
  v_before jsonb;
  v_after jsonb;
begin
  if coalesce(p_session, '') = '' then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');

  select email into v_email
  from public.client_board_sessions
  where slug = p_slug
    and token_hash = v_hash
    and revoked_at is null
    and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  update public.client_board_sessions set last_seen_at = now()
    where slug = p_slug and token_hash = v_hash;
  -- Roles (2026-10-15): viewers read and comment; every board action here needs an approver.
  if public._board_member_role(p_slug, v_email) = 'viewer' then return jsonb_build_object('ok', false, 'error', 'view_only'); end if;

  -- G3 fix: v1 omits the expires_at guard get_client_board enforces. v2 includes it.
  select * into v_board
  from public.client_boards
  where slug = p_slug
    and (expires_at is null or expires_at > now());
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_action not in ('approve', 'edit_copy', 'request_changes', 'shift_request', 'note', 'invite') then
    return jsonb_build_object('ok', false, 'error', 'bad_action');
  end if;

  -- Every action is attributed server-side to the signed-in member (never trusted from the client).
  if p_action = 'edit_copy' then
    select to_jsonb(coalesce(q->>'body',q->>'hook')) into v_before
      from jsonb_array_elements(coalesce(v_board.board->'queue','[]') || coalesce(v_board.board->'ideas','[]')) q where q->>'id'=p_ref limit 1;
    v_after := coalesce(p_payload->'body','null'::jsonb);
  else
    select jsonb_build_object('action',action,'event',payload->>'event') into v_before
      from public.client_board_actions where board_slug=p_slug and ref is not distinct from p_ref
      order by created_at desc,id desc limit 1;
    v_after := jsonb_build_object('action',p_action) || (coalesce(p_payload,'{}'::jsonb)-'by'-'before'-'after');
  end if;
  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, p_action, p_ref,
          coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('by',lower(v_email),'before',v_before,'after',v_after));

  return jsonb_build_object('ok', true);
end;
$function$
;
