-- Board archive (Ivan 2026-10-19): a collapsible Archive section on the client board.
-- Archive keeps the draft (status stays 'review', board_visible stays true, the queue item stays) and
-- marks it with board_archived_at; the board UI lists archived posts only in the Archive section,
-- and readers that count "awaiting approval" skip board_archived_at IS NOT NULL. Restore clears it.
-- Rollback: drop the three archive functions, re-create board_activity / client_board_draft_history(_v2)
-- from the migration that last defined them (whitelists without archive_draft/unarchive_draft), then
-- drop the two carousel_drafts columns.

alter table public.carousel_drafts add column if not exists board_archived_at timestamptz;
alter table public.carousel_drafts add column if not exists board_archived_by text;

CREATE OR REPLACE FUNCTION public._client_board_archive_apply(v_board client_boards, p_slug text, p_draft_id uuid, p_archived boolean, p_by text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare d public.carousel_drafts%rowtype; v_at timestamptz := now(); v_patch jsonb;
begin
  if p_archived is null then return jsonb_build_object('ok', false, 'error', 'bad_request'); end if;
  -- Board row first, then the draft (same lock order as the other board writes).
  perform 1 from public.client_boards where slug = p_slug for update;
  select * into d from public.carousel_drafts
   where id = p_draft_id and client_id = v_board.client_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'draft_not_found'); end if;
  if d.published_at is not null or d.status = 'published' then return jsonb_build_object('ok', false, 'error', 'already_published'); end if;
  if p_archived then
    if d.scheduled_at is not null or d.status = 'scheduled' then return jsonb_build_object('ok', false, 'error', 'unschedule_first'); end if;
    if d.status is distinct from 'review' then return jsonb_build_object('ok', false, 'error', 'draft_not_archivable'); end if;
    update public.carousel_drafts set board_archived_at = v_at, board_archived_by = p_by, updated_at = now() where id = p_draft_id;
    v_patch := jsonb_build_object('archived_at', v_at, 'archived_by', p_by);
  else
    update public.carousel_drafts set board_archived_at = null, board_archived_by = null, updated_at = now() where id = p_draft_id;
  end if;
  -- Merge the flag into the queue item; the item is never dropped.
  update public.client_boards set board = jsonb_set(board, '{queue}', coalesce((
      select jsonb_agg(case when q->>'id' = p_draft_id::text
                            then (case when p_archived then q || v_patch else (q - 'archived_at') - 'archived_by' end)
                            else q end order by ord)
        from jsonb_array_elements(board->'queue') with ordinality as t(q, ord)), '[]'::jsonb))
   where slug = p_slug and jsonb_typeof(board->'queue') = 'array';
  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, v_board.client_id, case when p_archived then 'archive_draft' else 'unarchive_draft' end, p_draft_id::text,
          jsonb_build_object('applied', true, 'archived', p_archived, 'by', coalesce(p_by, 'board link')));
  return jsonb_build_object('ok', true, 'archived', p_archived, 'archived_at', case when p_archived then v_at end);
end $function$;
revoke all on function public._client_board_archive_apply(client_boards, text, uuid, boolean, text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.client_board_archive_draft(p_slug text, p_token text, p_draft_id uuid, p_archived boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_board public.client_boards%rowtype;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public._client_board_archive_apply(v_board, p_slug, p_draft_id, p_archived, 'board link');
end $function$;

CREATE OR REPLACE FUNCTION public.client_board_archive_draft_v2(p_slug text, p_session text, p_draft_id uuid, p_archived boolean)
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
  return public._client_board_archive_apply(v_board, p_slug, p_draft_id, p_archived, v_email);
end $function$;
grant execute on function public.client_board_archive_draft(text, text, uuid, boolean) to anon, authenticated, service_role;
grant execute on function public.client_board_archive_draft_v2(text, text, uuid, boolean) to anon, authenticated, service_role;

-- Activity + per-post history whitelists learn the two new actions (bodies otherwise unchanged from live).

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
      AND (action IN ('approve','request_changes','edit_copy','edit_title','set_media','set_schedule','hide_draft','archive_draft','unarchive_draft',
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
           where board_slug = p_slug and ref = p_ref and hidden_at is null
             and (action in ('approve','request_changes','edit_copy','edit_title','set_media','set_schedule','hide_draft','archive_draft','unarchive_draft','comment','invite','team_remove','team_role','edit_lm_promo','photo_upload','delete_photo','photo_operation','shift_request','audn_accept','audn_reject','audn_defer','classification_proposed','edit_tags','source_provenance_verified','operator_buffer_approve','operator_buffer_remove')
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
           where board_slug = p_slug and ref = p_ref and hidden_at is null
             and (action in ('approve','request_changes','edit_copy','edit_title','set_media','set_schedule','hide_draft','archive_draft','unarchive_draft','comment','invite','team_remove','team_role','edit_lm_promo','photo_upload','delete_photo','photo_operation','shift_request','audn_accept','audn_reject','audn_defer','classification_proposed','edit_tags','source_provenance_verified','operator_buffer_approve','operator_buffer_remove')
               or (action='note' and payload->>'event' in ('angle_swap','angle_swap_undone','post_removed','post_restored','day_left_empty','day_refilled','slot_replaced','slot_replace_undone','undo_approve','voice_note','idea_note','idea_draft_next','idea_pass')))
           order by created_at desc limit 50) a;
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$;

-- Readers that offer or count "in review" drafts skip archived ones (bodies otherwise unchanged from live).
-- A scheduled or published draft can never stay archived: the trigger clears the mark.
CREATE OR REPLACE FUNCTION public.carousel_drafts_clear_archive_on_schedule()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.board_archived_at is not null and (new.scheduled_at is not null or new.published_at is not null or new.status in ('scheduled', 'published')) then
    new.board_archived_at := null; new.board_archived_by := null;
  end if;
  return new;
end $function$;
drop trigger if exists trg_carousel_drafts_clear_archive on public.carousel_drafts;
create trigger trg_carousel_drafts_clear_archive before update of scheduled_at, published_at, status, board_archived_at on public.carousel_drafts
  for each row execute function public.carousel_drafts_clear_archive_on_schedule();

CREATE OR REPLACE FUNCTION public.client_board_replacement_pool(p_slug text, p_token text)
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
           'id', cd.id,
           'title', left(coalesce(cd.title,''),120),
           'body', left(coalesce(cd.post_body,''),400)
         ) order by cd.created_at desc), '[]'::jsonb)
    into v_items
    from public.carousel_drafts cd
   where cd.client_id = v_board.client_id
     and cd.board_visible = true
     and cd.status = 'review'
     and cd.board_archived_at is null
     and cd.scheduled_at is null
     and coalesce(cd.title,'') not like '[TEST%';
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$;

CREATE OR REPLACE FUNCTION public.client_board_replacement_pool_v2(p_slug text, p_session text)
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
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', cd.id,
           'title', left(coalesce(cd.title,''),120),
           'body', left(coalesce(cd.post_body,''),400)
         ) order by cd.created_at desc), '[]'::jsonb)
    into v_items
    from public.carousel_drafts cd
   where cd.client_id = v_board.client_id
     and cd.board_visible = true
     and cd.status = 'review'
     and cd.board_archived_at is null
     and cd.scheduled_at is null
     and coalesce(cd.title,'') not like '[TEST%';
  return jsonb_build_object('ok', true, 'items', v_items);
end $function$;

CREATE OR REPLACE FUNCTION public.get_pending_actions()
 RETURNS TABLE(category text, item_key text, title text, subtitle text, severity text, deeplink text, created_at timestamp with time zone, unread boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with feed as (
    select 'skill_draft' as category, 'skill_draft:'||sd.id::text as item_key,
           sd.skill_name as title, left(coalesce(sd.rationale,''),100) as subtitle,
           'tier3' as severity, '?section=ops&sub=skills' as deeplink, sd.created_at as created_at
    from skill_drafts sd
    where sd.status='pending' and sd.kind <> 'prune_candidate'
    union all
    select 'memory_proposal','memory_proposal:'||cm.id::text,
           'Memory cleanup — '||coalesce(cm.client_id,'tier'),'Pending prune proposals',
           'tier3','?section=knowledge&sub=brain', cm.updated_at
    from claude_memory cm where cm.file_path like '%\_compaction-review.md'
    union all
    select 'scheduled_check','scheduled_check:'||scs.id::text, scs.title, coalesce(scs.detail,''),
           'tier1','?section=ops&sub=checks',(scs.due_date)::timestamptz
    from scheduled_checks_status scs where scs.state='due'
    union all
    select 'stuck_automation','stuck_automation:'||dws.id::text, dws.workflow_name,
           left(coalesce(dws.last_error_message,'error'),100),
           'tier1','?section=ops&sub=scheduled-ops', dws.last_execution_at
    from dashboard_workflow_stats dws
    where dws.last_execution_status='error' and dws.error_acknowledged = false and dws.is_active = true
    union all
    select 'stuck_automation','overdue:'||sjr.job_key, sjr.label,
           'Overdue — no run within expected interval','tier1','?section=ops&sub=scheduled-ops', sjr.last_synced_at
    from scheduled_job_registry sjr
    where sjr.enabled = true and sjr.last_synced_at is not null
      and sjr.last_synced_at < now() - ((coalesce(sjr.expected_interval_minutes,60)+coalesce(sjr.grace_minutes,0)) * interval '1 minute')
    union all
    select 'carousel_review','carousel_review:'||cd.id::text, coalesce(cd.title, cd.topic, 'Untitled post'),
           'Post awaiting review','tier2','?section=content&sub=posts', cd.created_at
    from carousel_drafts cd where cd.status='review' and cd.board_archived_at is null
    union all
    select 'lm_review','lm_review:'||lm.id::text, coalesce(lm.topic, lm.slug, 'Untitled LM'),
           'Lead magnet awaiting review','tier2','?section=content&sub=lead-magnets', lm.created_at
    from lm_drafts_v2 lm where lm.status='lm_review'
    union all
    select 'prospect_reply','prospect_reply:'||op.id::text, coalesce(op.name,'Unknown prospect'),
           coalesce(op.company,''),'tier1','?section=reach&sub=outreach&otab=overview', coalesce(op.last_reply_at, op.updated_at)
    from outreach_prospects op
    where op.stage='replied' and op.needs_manual_reply = true and op.blacklisted is not true
      and op.last_reply_at >= now() - interval '7 days'
    union all
    select 'paid_intake','paid_intake:'||pa.id::text, coalesce(pa.name, pa.email, 'Paid assessment'),
           'Day-2 deliverable pending','tier1','?section=clients', pa.paid_at
    from paid_assessments pa
    where pa.status='paid' and pa.day2_completed_at is null and pa.is_test is not true
    union all
    select 'upwork_proposal','upwork_proposal:'||up.id::text,
           'Upwork proposal'||coalesce(' ('||up.rate_amount::text||' '||up.rate_type||')',''),
           'Awaiting your approval','tier3','?section=reach&otab=upwork', up.created_at
    from upwork_proposals up where up.status='pending_approval'
    union all
    select 'call_clip','call_clip:'||vs.id::text, coalesce(vs.title, vs.hook_line, 'Call clip'),
           'Clip awaiting review','tier2','?section=content&sub=clips', vs.created_at
    from video_shorts vs where vs.source_type='call_recording' and vs.status='pending'
    union all
    select 'crm_action_due','crm_action_due:'||c.id::text, coalesce(c.name,'Contact'),
           coalesce(c.next_action,'Action due'),'tier2','?section=clients',(c.next_action_due)::timestamptz
    from contacts c
    where c.next_action_due is not null and c.next_action_due <= current_date and c.merged_into is null
    union all
    select 'dashboard_task','dashboard_task:'||dt.id::text, coalesce(dt.title,'Task'),
           coalesce(dt.status,''),'tier3','?section=ops&sub=tasks', dt.created_at
    from dashboard_tasks dt where dt.status in ('pending','open')
    union all
    select 'hypertarget_review','hypertarget_review:'||hc.prospect_id::text,
           coalesce(op.name,'Hypertarget prospect'),
           'Scan asset ready — review & send','tier1','?section=reach&sub=outreach&otab=hypertarget',
           coalesce(hc.built_at, hc.detected_at)
    from hypertarget_corpus hc
    join outreach_prospects op on op.id = hc.prospect_id
    where hc.stage='asset_ready'
  )
  select f.category, f.item_key, f.title, f.subtitle, f.severity, f.deeplink, f.created_at,
         (f.created_at > coalesce(ns.seen_at, '1970-01-01'::timestamptz)) as unread
  from feed f
  left join notification_seen ns on ns.item_key = f.item_key
  where f.category not in (select category from notification_muted_categories);
$function$;

CREATE OR REPLACE FUNCTION public.operator_clients_overview(p_gate text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare out jsonb;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;
  select jsonb_agg(c order by c->>'client_id') into out
  from (
    select jsonb_build_object(
      'client_id', r.client_id,
      'display_name', r.display_name,
      'status', r.platform->>'status',
      'tier', r.platform->'client'->>'tier',
      'company', r.platform->'client'->>'company',
      'board', jsonb_build_object(
        'slug',  r.platform->'board'->>'slug',
        'url',   r.platform->'board'->>'url',
        'token', r.platform->'board'->>'token'
      ),
      'lanes', (
        select jsonb_build_object(
          'armed', count(*) filter (where (w.value->>'armed')::boolean),
          'total', count(*)
        )
        from jsonb_each(coalesce(r.platform->'workflows', '{}'::jsonb)) w
      ),
      'drafts', (
        select jsonb_build_object(
          'review',  count(*) filter (where d.status = 'review' and d.board_archived_at is null),
          'visible', count(*) filter (where d.board_visible),
          'total',   count(*)
        )
        from carousel_drafts d where d.client_id = r.client_id
      ),
      'spend', (
        select jsonb_build_object(
          'total_usd', round(coalesce(sum(u.est_cost_usd), 0)::numeric, 2),
          'week_usd',  round(coalesce(sum(u.est_cost_usd) filter (
                         where u.occurred_at >= now() - interval '7 days'), 0)::numeric, 2)
        )
        from client_api_usage u where u.client_id = r.client_id
      )
    ) as c
    from client_registry r
    -- An inactive registry row is not a client the operator has. It was reachable here because
    -- the only gate was `platform is not null`, so a deactivated or never-launched tenant showed
    -- up in Ivan's Client Ops list beside the real ones. coalesce(..., true) keeps the historical
    -- behaviour for any row whose is_active was never set.
    where r.platform is not null
      and coalesce(r.is_active, true)
  ) s;
  return jsonb_build_object('ok', true, 'clients', coalesce(out, '[]'::jsonb));
end;
$function$;
