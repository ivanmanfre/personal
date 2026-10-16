-- Rollback-only private-note regression. No real internal notes are read or changed.
BEGIN;
SET LOCAL search_path=public,extensions;
DO $test$
DECLARE
 v_approver text:='slot-privacy-approver'; v_viewer text:='slot-privacy-viewer';
 v_ref text:='slot-privacy-fixture'; v_page jsonb; v_r jsonb; v_payload jsonb; v_token text;
BEGIN
 INSERT INTO public.client_board_sessions(slug,email,token_hash,expires_at) VALUES
 ('swishdm-live','slot-privacy-approver@example.invalid',encode(digest(v_approver,'sha256'),'hex'),now()+interval '1 hour'),
 ('swishdm-live','slot-privacy-viewer@example.invalid',encode(digest(v_viewer,'sha256'),'hex'),now()+interval '1 hour');
 UPDATE public.client_registry SET platform=jsonb_set(platform,'{board,auth,members}',
   coalesce(platform#>'{board,auth,members}','{}'::jsonb)||jsonb_build_object(
    'slot-privacy-viewer@example.invalid',jsonb_build_object('role','viewer'),
    'slot-privacy-approver@example.invalid',jsonb_build_object('role','approver')))
 WHERE client_id='swishdm';
 IF public._board_member_role('swishdm-live','slot-privacy-viewer@example.invalid')<>'viewer' THEN RAISE EXCEPTION 'viewer fixture invalid'; END IF;
 INSERT INTO public.client_board_actions(board_slug,client_id,action,ref,payload,created_at) VALUES
 ('swishdm-live','swishdm','note',v_ref,'{"event":"ops_marker","by":"operator","note":"PRIVATE_OPERATOR_SENTINEL"}',now()-interval '2 seconds');
 v_r:=public.board_slot_notes('swishdm-live',jsonb_build_array(jsonb_build_object('ref',v_ref,'payload',jsonb_build_object('event','post_removed','by','spoof'))),v_approver);
 IF v_r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'slot write failed'; END IF;
 SELECT payload INTO v_payload FROM public.client_board_actions WHERE board_slug='swishdm-live' AND ref=v_ref AND payload->>'event'='post_removed' ORDER BY created_at DESC,id DESC LIMIT 1;
 IF v_payload->'before' IS DISTINCT FROM 'null'::jsonb OR v_payload->'after' IS DISTINCT FROM '{"event":"post_removed"}'::jsonb THEN RAISE EXCEPTION 'writer copied a private prior note or unrestricted snapshot'; END IF;
 IF v_payload->>'by'<>'slot-privacy-approver@example.invalid' THEN RAISE EXCEPTION 'actor spoofing'; END IF;
 -- A later internal note cannot replace the last public slot event in the snapshot.
 INSERT INTO public.client_board_actions(board_slug,client_id,action,ref,payload,created_at)
 VALUES('swishdm-live','swishdm','note',v_ref,'{"event":"video_lane_armed","note":"PRIVATE_LATER_SENTINEL"}',clock_timestamp());
 PERFORM public.board_slot_notes('swishdm-live',jsonb_build_array(jsonb_build_object('ref',v_ref,'payload',jsonb_build_object('event','post_restored'))),v_approver);
 SELECT payload INTO v_payload FROM public.client_board_actions WHERE board_slug='swishdm-live' AND ref=v_ref AND payload->>'event'='post_restored' ORDER BY created_at DESC,id DESC LIMIT 1;
 IF v_payload->'before' IS DISTINCT FROM '{"event":"post_removed"}'::jsonb THEN RAISE EXCEPTION 'public slot history lost'; END IF;
 -- Existing unsafe snapshots must be protected at the read boundary too.
 INSERT INTO public.client_board_actions(board_slug,client_id,action,ref,payload) VALUES
 ('swishdm-live','swishdm','note',v_ref,'{"event":"slot_replaced","before":{"event":"ops_marker","note":"PRIVATE_LEGACY_SENTINEL"},"after":{"event":"slot_replaced","note":"PRIVATE_AFTER_SENTINEL"},"by":"system"}'),
 ('swishdm-live','swishdm','classification_proposed',v_ref,'{"before":{"taxonomy":{"held":"PRIVATE_TAXONOMY_SENTINEL"}},"after":{"topic_label":"AI shopping"},"by":"system"}'),
 ('swishdm-live','swishdm','request_changes',v_ref,jsonb_build_object('by','slot-privacy-viewer@example.invalid','note',repeat('Exact client feedback. ',30))),
 ('swishdm-live','swishdm','edit_copy',v_ref,'{"before":"Old public copy","after":"New public copy","by":"system"}');
 v_page:=public.board_activity('swishdm-live',v_viewer);
 IF v_page->>'ok' IS DISTINCT FROM 'true' OR v_page::text LIKE '%PRIVATE_%' THEN RAISE EXCEPTION 'viewer activity exposed private notes'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_page->'items') e WHERE e->>'ref'=v_ref AND e->>'event'='slot_replaced' AND e->'before'='null'::jsonb AND e->'after'='{"event":"slot_replaced"}'::jsonb) THEN RAISE EXCEPTION 'safe historical slot projection missing'; END IF;
 v_page:=public.client_board_draft_history_v2('swishdm-live',v_viewer,v_ref);
 IF v_page->>'ok' IS DISTINCT FROM 'true' OR v_page::text LIKE '%PRIVATE_%' OR v_page::text LIKE '%ops_marker%' OR v_page::text LIKE '%video_lane_armed%' THEN RAISE EXCEPTION 'session draft history exposed private notes'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_page->'items') e WHERE e->>'action'='request_changes' AND e->>'note'=repeat('Exact client feedback. ',30)) THEN RAISE EXCEPTION 'full client feedback lost'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_page->'items') e WHERE e->>'action'='edit_copy' AND e->>'before'='Old public copy' AND e->>'after'='New public copy') THEN RAISE EXCEPTION 'copy diff contract lost'; END IF;
 SELECT token INTO v_token FROM public.client_boards WHERE slug='swishdm-live';
 v_page:=public.client_board_draft_history('swishdm-live',v_token,v_ref);
 IF v_page->>'ok' IS DISTINCT FROM 'true' OR v_page::text LIKE '%PRIVATE_%' OR v_page::text LIKE '%ops_marker%' OR v_page::text LIKE '%video_lane_armed%' THEN RAISE EXCEPTION 'keyed draft history exposed private notes'; END IF;
 v_r:=public.board_slot_notes('swishdm-live',jsonb_build_array(jsonb_build_object('ref',v_ref,'payload',jsonb_build_object('event','post_removed'))),v_viewer,v_token);
 IF v_r->>'error' IS DISTINCT FROM 'view_only' THEN RAISE EXCEPTION 'viewer bypass with token'; END IF;
 v_page:=public.client_board_draft_history_v2('risedtc-com',v_viewer,v_ref);
 IF v_page->>'error' IS DISTINCT FROM 'not_authenticated' THEN RAISE EXCEPTION 'cross-board session bypass'; END IF;
END $test$;
ROLLBACK;
