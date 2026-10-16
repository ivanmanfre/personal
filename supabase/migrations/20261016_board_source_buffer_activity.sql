-- Preserve the current board-scoped read; expose bounded source and operator placement receipts.
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
    'before',CASE WHEN action='source_provenance_verified' THEN jsonb_strip_nulls(jsonb_build_object(
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
    'after',CASE WHEN action='source_provenance_verified' THEN jsonb_strip_nulls(jsonb_build_object(
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

REVOKE ALL ON FUNCTION public.board_activity(text,text,text,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.board_activity(text,text,text,timestamptz,uuid) TO anon,authenticated,service_role;
