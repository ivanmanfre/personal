-- Protect new slot snapshots and all existing client history reads from private operator notes.
BEGIN;
CREATE OR REPLACE FUNCTION public.board_slot_notes(p_slug text, p_events jsonb, p_session text DEFAULT NULL::text, p_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
    SELECT jsonb_build_object('event',payload->>'event') INTO v_before FROM public.client_board_actions
      WHERE board_slug=p_slug AND ref=v_e->>'ref' AND action='note' AND payload->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve') ORDER BY created_at DESC,id DESC LIMIT 1;
    v_after := (v_e->'payload')-'by'-'before'-'after';
    INSERT INTO public.client_board_actions(board_slug,client_id,action,ref,payload,created_at)
      VALUES(p_slug,v_client,'note',v_e->>'ref',v_after||jsonb_build_object('by',v_by,'before',v_before,'after',jsonb_build_object('event',v_after->>'event')),clock_timestamp());
  END LOOP;
  RETURN jsonb_build_object('ok',true);
END $function$;

CREATE OR REPLACE FUNCTION public.board_activity(p_slug text, p_session text DEFAULT NULL::text, p_token text DEFAULT NULL::text, p_before_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_before_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_by text := public._board_team_caller(p_slug,p_session,p_token); v_rows jsonb; v_board jsonb;
BEGIN
  IF v_by IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_authenticated'); END IF;
  SELECT board INTO v_board FROM public.client_boards WHERE slug=p_slug AND (expires_at IS NULL OR expires_at>now());
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'error','not_found'); END IF;
  IF (p_before_at IS NULL) <> (p_before_id IS NULL) THEN RETURN jsonb_build_object('ok',false,'error','bad_cursor'); END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'action',action,'ref',ref,'at',created_at,
    'title',(SELECT coalesce(nullif(q->>'title',''),nullif(q->>'hook','')) FROM jsonb_array_elements(
      (CASE WHEN jsonb_typeof(v_board->'queue')='array' THEN v_board->'queue' ELSE '[]'::jsonb END) ||
      (CASE WHEN jsonb_typeof(v_board->'ideas')='array' THEN v_board->'ideas' ELSE '[]'::jsonb END)
    ) q WHERE q->>'id'=a.ref LIMIT 1),
    'by',CASE WHEN payload->>'by' ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' THEN payload->>'by' WHEN payload->>'by'='board link' THEN 'board link' WHEN payload->>'by' IN ('system','Content team / system') THEN 'Content team / system' ELSE 'Unattributed legacy action' END,'event',payload->>'event','field',payload->>'field',
    'phase',payload->>'phase','operation',payload->>'operation','operation_id',payload->>'operation_id',
    'before',CASE WHEN action='note' AND payload->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve') THEN CASE WHEN payload->'before'->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve') THEN jsonb_build_object('event',payload->'before'->>'event') ELSE NULL END
    WHEN action='source_provenance_verified' THEN jsonb_strip_nulls(jsonb_build_object(
      'source_label',payload->'before'->'source_label',
      'kind',coalesce(payload->'before'->'kind',payload->'before'->'source_detail'->'kind'),
      'source_url',coalesce(payload->'before'->'source_url',payload->'before'->'source_detail'->'source_url')
    )) WHEN action IN ('operator_buffer_approve','operator_buffer_remove') THEN jsonb_build_object(
      'board_visible',payload->'before'->'board_visible','status',payload->'before'->'status'
    ) WHEN action='classification_proposed' THEN jsonb_strip_nulls(jsonb_build_object(
      'funnel_stage',payload->'before'->'funnel_stage',
      'funnel_source',coalesce(payload->'before'->'funnel_source',payload->'before'->'taxonomy'->'funnel_source'),
      'topic_label',coalesce(payload->'before'->'topic_label',payload->'before'->'taxonomy'->'topic_label'),
      'creative_style',coalesce(payload->'before'->'creative_style',payload->'before'->'taxonomy'->'creative_style'),
      'pillar',coalesce(payload->'before'->'pillar',payload->'before'->'taxonomy'->'pillar')
    )) ELSE payload->'before' END,
    'after',CASE WHEN action='note' AND payload->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve') THEN jsonb_build_object('event',payload->>'event')
    WHEN action='source_provenance_verified' THEN jsonb_strip_nulls(jsonb_build_object(
      'source_label',payload->'after'->'source_label',
      'kind',coalesce(payload->'after'->'kind',payload->'after'->'source_detail'->'kind'),
      'source_url',coalesce(payload->'after'->'source_url',payload->'after'->'source_detail'->'source_url')
    )) WHEN action IN ('operator_buffer_approve','operator_buffer_remove') THEN jsonb_build_object(
      'board_visible',payload->'after'->'board_visible','status',payload->'after'->'status'
    ) WHEN action='classification_proposed' THEN jsonb_strip_nulls(jsonb_build_object(
      'funnel_stage',payload->'after'->'funnel_stage',
      'funnel_source',coalesce(payload->'after'->'funnel_source',payload->'after'->'taxonomy'->'funnel_source'),
      'topic_label',coalesce(payload->'after'->'topic_label',payload->'after'->'taxonomy'->'topic_label'),
      'creative_style',coalesce(payload->'after'->'creative_style',payload->'after'->'taxonomy'->'creative_style'),
      'pillar',coalesce(payload->'after'->'pillar',payload->'after'->'taxonomy'->'pillar')
    )) ELSE payload->'after' END,
    'text',CASE WHEN action='comment' THEN payload->>'text' END,
    'note',CASE WHEN action IN ('request_changes','shift_request') THEN payload->>'note' WHEN action IN ('audn_accept','audn_reject','audn_defer') THEN payload->>'reason' END
  ) ORDER BY created_at DESC,id DESC),'[]') INTO v_rows FROM (
    SELECT id,action,ref,created_at,payload FROM public.client_board_actions
    WHERE board_slug=p_slug AND (p_before_at IS NULL OR (created_at,id)<(p_before_at,p_before_id))
      AND (action IN ('approve','request_changes','edit_copy','edit_title','set_media','set_schedule','hide_draft',
        'comment','invite','team_remove','team_role','edit_lm_promo','photo_upload','delete_photo','photo_operation',
        'shift_request','audn_accept','audn_reject','audn_defer','classification_proposed','edit_tags','source_provenance_verified','operator_buffer_approve','operator_buffer_remove')
        OR (action='note' AND payload->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve','voice_note','idea_note','idea_draft_next','idea_pass')))
    ORDER BY created_at DESC,id DESC LIMIT 50
  ) a;
  RETURN jsonb_build_object('ok',true,'items',v_rows);
END $function$;

CREATE OR REPLACE FUNCTION public.client_board_draft_history(p_slug text, p_token text, p_ref text)
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
           'action', a.action,
           'at', a.created_at,
           'by', a.payload->>'by',
           'event', a.payload->>'event',
           'note', case when a.action='request_changes' then coalesce(a.payload->>'note','') when a.action='shift_request' or (a.action='note' and a.payload->>'event' IN ('voice_note','idea_note','idea_draft_next','idea_pass')) then left(coalesce(a.payload->>'note',''),280) else '' end,
           'before', left(coalesce((CASE WHEN a.action='note' AND a.payload->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve') THEN CASE WHEN a.payload->'before'->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve') THEN jsonb_build_object('event',a.payload->'before'->>'event') ELSE NULL END
    WHEN a.action='source_provenance_verified' THEN jsonb_strip_nulls(jsonb_build_object(
      'source_label',a.payload->'before'->'source_label',
      'kind',coalesce(a.payload->'before'->'kind',a.payload->'before'->'source_detail'->'kind'),
      'source_url',coalesce(a.payload->'before'->'source_url',a.payload->'before'->'source_detail'->'source_url')
    )) WHEN a.action IN ('operator_buffer_approve','operator_buffer_remove') THEN jsonb_build_object(
      'board_visible',a.payload->'before'->'board_visible','status',a.payload->'before'->'status'
    ) WHEN a.action='classification_proposed' THEN jsonb_strip_nulls(jsonb_build_object(
      'funnel_stage',a.payload->'before'->'funnel_stage',
      'funnel_source',coalesce(a.payload->'before'->'funnel_source',a.payload->'before'->'taxonomy'->'funnel_source'),
      'topic_label',coalesce(a.payload->'before'->'topic_label',a.payload->'before'->'taxonomy'->'topic_label'),
      'creative_style',coalesce(a.payload->'before'->'creative_style',a.payload->'before'->'taxonomy'->'creative_style'),
      'pillar',coalesce(a.payload->'before'->'pillar',a.payload->'before'->'taxonomy'->'pillar')
    )) ELSE a.payload->'before' END) #>> '{}',''), 4000),
           'after', left(coalesce((CASE WHEN a.action='note' AND a.payload->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve') THEN jsonb_build_object('event',a.payload->>'event')
    WHEN a.action='source_provenance_verified' THEN jsonb_strip_nulls(jsonb_build_object(
      'source_label',a.payload->'after'->'source_label',
      'kind',coalesce(a.payload->'after'->'kind',a.payload->'after'->'source_detail'->'kind'),
      'source_url',coalesce(a.payload->'after'->'source_url',a.payload->'after'->'source_detail'->'source_url')
    )) WHEN a.action IN ('operator_buffer_approve','operator_buffer_remove') THEN jsonb_build_object(
      'board_visible',a.payload->'after'->'board_visible','status',a.payload->'after'->'status'
    ) WHEN a.action='classification_proposed' THEN jsonb_strip_nulls(jsonb_build_object(
      'funnel_stage',a.payload->'after'->'funnel_stage',
      'funnel_source',coalesce(a.payload->'after'->'funnel_source',a.payload->'after'->'taxonomy'->'funnel_source'),
      'topic_label',coalesce(a.payload->'after'->'topic_label',a.payload->'after'->'taxonomy'->'topic_label'),
      'creative_style',coalesce(a.payload->'after'->'creative_style',a.payload->'after'->'taxonomy'->'creative_style'),
      'pillar',coalesce(a.payload->'after'->'pillar',a.payload->'after'->'taxonomy'->'pillar')
    )) ELSE a.payload->'after' END) #>> '{}',''), 4000)
         ) order by a.created_at desc), '[]'::jsonb)
    into v_items
    from (select * from public.client_board_actions
           where board_slug = p_slug and ref = p_ref
             and (action in ('approve','request_changes','edit_copy','edit_title','set_media','set_schedule','hide_draft','comment','invite','team_remove','team_role','edit_lm_promo','photo_upload','delete_photo','photo_operation','shift_request','audn_accept','audn_reject','audn_defer','classification_proposed','edit_tags','source_provenance_verified','operator_buffer_approve','operator_buffer_remove')
               or (action='note' and payload->>'event' in ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve','voice_note','idea_note','idea_draft_next','idea_pass')))
           order by created_at desc limit 50) a;
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$;

CREATE OR REPLACE FUNCTION public.client_board_draft_history_v2(p_slug text, p_session text, p_ref text)
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
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'action', a.action,
           'at', a.created_at,
           'by', a.payload->>'by',
           'event', a.payload->>'event',
           'note', case when a.action='request_changes' then coalesce(a.payload->>'note','') when a.action='shift_request' or (a.action='note' and a.payload->>'event' IN ('voice_note','idea_note','idea_draft_next','idea_pass')) then left(coalesce(a.payload->>'note',''),280) else '' end,
           'before', left(coalesce((CASE WHEN a.action='note' AND a.payload->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve') THEN CASE WHEN a.payload->'before'->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve') THEN jsonb_build_object('event',a.payload->'before'->>'event') ELSE NULL END
    WHEN a.action='source_provenance_verified' THEN jsonb_strip_nulls(jsonb_build_object(
      'source_label',a.payload->'before'->'source_label',
      'kind',coalesce(a.payload->'before'->'kind',a.payload->'before'->'source_detail'->'kind'),
      'source_url',coalesce(a.payload->'before'->'source_url',a.payload->'before'->'source_detail'->'source_url')
    )) WHEN a.action IN ('operator_buffer_approve','operator_buffer_remove') THEN jsonb_build_object(
      'board_visible',a.payload->'before'->'board_visible','status',a.payload->'before'->'status'
    ) WHEN a.action='classification_proposed' THEN jsonb_strip_nulls(jsonb_build_object(
      'funnel_stage',a.payload->'before'->'funnel_stage',
      'funnel_source',coalesce(a.payload->'before'->'funnel_source',a.payload->'before'->'taxonomy'->'funnel_source'),
      'topic_label',coalesce(a.payload->'before'->'topic_label',a.payload->'before'->'taxonomy'->'topic_label'),
      'creative_style',coalesce(a.payload->'before'->'creative_style',a.payload->'before'->'taxonomy'->'creative_style'),
      'pillar',coalesce(a.payload->'before'->'pillar',a.payload->'before'->'taxonomy'->'pillar')
    )) ELSE a.payload->'before' END) #>> '{}',''), 4000),
           'after', left(coalesce((CASE WHEN a.action='note' AND a.payload->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve') THEN jsonb_build_object('event',a.payload->>'event')
    WHEN a.action='source_provenance_verified' THEN jsonb_strip_nulls(jsonb_build_object(
      'source_label',a.payload->'after'->'source_label',
      'kind',coalesce(a.payload->'after'->'kind',a.payload->'after'->'source_detail'->'kind'),
      'source_url',coalesce(a.payload->'after'->'source_url',a.payload->'after'->'source_detail'->'source_url')
    )) WHEN a.action IN ('operator_buffer_approve','operator_buffer_remove') THEN jsonb_build_object(
      'board_visible',a.payload->'after'->'board_visible','status',a.payload->'after'->'status'
    ) WHEN a.action='classification_proposed' THEN jsonb_strip_nulls(jsonb_build_object(
      'funnel_stage',a.payload->'after'->'funnel_stage',
      'funnel_source',coalesce(a.payload->'after'->'funnel_source',a.payload->'after'->'taxonomy'->'funnel_source'),
      'topic_label',coalesce(a.payload->'after'->'topic_label',a.payload->'after'->'taxonomy'->'topic_label'),
      'creative_style',coalesce(a.payload->'after'->'creative_style',a.payload->'after'->'taxonomy'->'creative_style'),
      'pillar',coalesce(a.payload->'after'->'pillar',a.payload->'after'->'taxonomy'->'pillar')
    )) ELSE a.payload->'after' END) #>> '{}',''), 4000)
         ) order by a.created_at desc), '[]'::jsonb)
    into v_items
    from (select * from public.client_board_actions
           where board_slug = p_slug and ref = p_ref
             and (action in ('approve','request_changes','edit_copy','edit_title','set_media','set_schedule','hide_draft','comment','invite','team_remove','team_role','edit_lm_promo','photo_upload','delete_photo','photo_operation','shift_request','audn_accept','audn_reject','audn_defer','classification_proposed','edit_tags','source_provenance_verified','operator_buffer_approve','operator_buffer_remove')
               or (action='note' and payload->>'event' in ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve','voice_note','idea_note','idea_draft_next','idea_pass')))
           order by created_at desc limit 50) a;
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$;

REVOKE ALL ON FUNCTION public.board_slot_notes(text,jsonb,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.board_activity(text,text,text,timestamptz,uuid) FROM PUBLIC;
-- Existing role grants survive CREATE OR REPLACE; no new execution role is added.
COMMIT;
