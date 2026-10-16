-- Per-post History skips hidden actions too (2026-10-16), same rule as board_comments_list and board_activity.
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
           where board_slug = p_slug and ref = p_ref and hidden_at is null
             and (action in ('approve','request_changes','edit_copy','edit_title','set_media','set_schedule','hide_draft','comment','invite','team_remove','team_role','edit_lm_promo','photo_upload','delete_photo','photo_operation','shift_request','audn_accept','audn_reject','audn_defer','classification_proposed','edit_tags','source_provenance_verified','operator_buffer_approve','operator_buffer_remove')
               or (action='note' and payload->>'event' in ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve','voice_note','idea_note','idea_draft_next','idea_pass')))
           order by created_at desc limit 50) a;
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$

;
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
           where board_slug = p_slug and ref = p_ref and hidden_at is null
             and (action in ('approve','request_changes','edit_copy','edit_title','set_media','set_schedule','hide_draft','comment','invite','team_remove','team_role','edit_lm_promo','photo_upload','delete_photo','photo_operation','shift_request','audn_accept','audn_reject','audn_defer','classification_proposed','edit_tags','source_provenance_verified','operator_buffer_approve','operator_buffer_remove')
               or (action='note' and payload->>'event' in ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve','voice_note','idea_note','idea_draft_next','idea_pass')))
           order by created_at desc limit 50) a;
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$

;
