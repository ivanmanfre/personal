-- Hide a comment without deleting it (2026-10-16). Additive only: two nullable columns on
-- client_board_actions; every existing row keeps its data. A hidden comment drops out of the
-- per-post thread (board_comments_list) and the board history (board_activity); the row
-- itself stays for the audit trail. Used once to hide our own test comment "test" on
-- swishdm-live (written by im@ivanmanfredi.com on 2026-10-16 09:37 UTC).

alter table public.client_board_actions add column if not exists hidden_at timestamptz;
alter table public.client_board_actions add column if not exists hidden_reason text;

create or replace function public.board_comments_list(p_slug text, p_session text default null, p_token text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller text := public._board_team_caller(p_slug, p_session, p_token);
  v_items  jsonb;
begin
  if v_caller is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', a.id, 'ref', a.ref, 'at', a.created_at,
           'by', a.payload->>'by', 'text', a.payload->>'text', 'parent', a.payload->>'parent'
         ) order by a.created_at), '[]'::jsonb)
    into v_items
    from (select * from public.client_board_actions
           where board_slug = p_slug and action = 'comment' and hidden_at is null
           order by created_at desc limit 500) a;
  return jsonb_build_object('ok', true, 'items', v_items,
                            'me', case when v_caller = 'board link' then null else v_caller end);
end;
$$;

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
    WHERE board_slug=p_slug AND hidden_at IS NULL AND (p_before_at IS NULL OR (created_at,id)<(p_before_at,p_before_id))
      AND (action IN ('approve','request_changes','edit_copy','edit_title','set_media','set_schedule','hide_draft',
        'comment','invite','team_remove','team_role','edit_lm_promo','photo_upload','delete_photo','photo_operation',
        'shift_request','audn_accept','audn_reject','audn_defer','classification_proposed','edit_tags','source_provenance_verified','operator_buffer_approve','operator_buffer_remove')
        OR (action='note' AND payload->>'event' IN ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve','voice_note','idea_note','idea_draft_next','idea_pass')))
    ORDER BY created_at DESC,id DESC LIMIT 50
  ) a;
  RETURN jsonb_build_object('ok',true,'items',v_rows);
END $function$

;

-- Our own test comment (exact text "test", written by our operator address). Nothing else.
update public.client_board_actions
   set hidden_at = now(), hidden_reason = 'operator test comment (2026-10-16)'
 where id = 'b361d5c7-ab96-488d-baf2-4d7d1ce638c8'
   and board_slug = 'swishdm-live' and action = 'comment'
   and payload->>'text' = 'test' and payload->>'by' = 'im@ivanmanfredi.com'
   and hidden_at is null;
