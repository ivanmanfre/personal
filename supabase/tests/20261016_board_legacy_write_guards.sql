-- Rollback-only checks for legacy viewer/photo receipt guards. No real file operation.
BEGIN;
SET LOCAL search_path = public, extensions;
DO $test$
DECLARE
 v_slug text := 'swishdm-live';
 v_viewer text := 'legacy-guard-viewer@example.invalid';
 v_editor text := 'legacy-guard-editor@example.invalid';
 v_viewer_session text := 'legacy-guard-viewer-session';
 v_editor_session text := 'legacy-guard-editor-session';
 v_path text := 'swishdm-live/legacy-guard-fixture.png';
 v_before jsonb;
 v_actions bigint;
 v_ideas bigint;
 v_result jsonb;
BEGIN
 UPDATE public.client_registry SET platform = jsonb_set(
   jsonb_set(platform, '{board,auth,allowed_emails}',
     coalesce(platform#>'{board,auth,allowed_emails}','[]') || jsonb_build_array(v_viewer,v_editor)),
   '{board,auth,members}', coalesce(platform#>'{board,auth,members}','{}') ||
     jsonb_build_object(v_viewer,jsonb_build_object('role','viewer'),v_editor,jsonb_build_object('role','approver')))
 WHERE client_id='swishdm';
 INSERT INTO public.client_board_sessions(slug,email,token_hash,expires_at) VALUES
   (v_slug,v_viewer,encode(digest(v_viewer_session,'sha256'),'hex'),now()+interval '1 hour'),
   (v_slug,v_editor,encode(digest(v_editor_session,'sha256'),'hex'),now()+interval '1 hour');
 SELECT board INTO v_before FROM public.client_boards WHERE slug=v_slug;
 SELECT count(*) INTO v_actions FROM public.client_board_actions WHERE board_slug=v_slug;
 SELECT count(*) INTO v_ideas FROM public.client_ideas WHERE client_id='swishdm';
 v_result := public.client_board_edit_lm_promo_v2(v_slug,v_viewer_session,'lm-swishdm-ai-buyer-comparison','dm','"Rejected viewer edit"');
 IF v_result->>'error' IS DISTINCT FROM 'view_only' THEN RAISE EXCEPTION 'Viewer could edit LM: %',v_result; END IF;
 IF v_before IS DISTINCT FROM (SELECT board FROM public.client_boards WHERE slug=v_slug) THEN RAISE EXCEPTION 'Viewer changed LM'; END IF;
 v_result := public.board_photo_added(v_slug,v_path,'Rejected missing photo',v_editor_session,NULL);
 IF v_result->>'error' IS DISTINCT FROM 'storage_unconfirmed' THEN RAISE EXCEPTION 'Missing photo accepted: %',v_result; END IF;
 v_result := public.board_photo_added(v_slug,'swishdm-live-other/file.png','Rejected wrong prefix',v_editor_session,NULL);
 IF v_result->>'error' IS DISTINCT FROM 'bad_path' THEN RAISE EXCEPTION 'Other prefix accepted: %',v_result; END IF;
 INSERT INTO storage.objects(bucket_id,name) VALUES('client-photos',v_path);
 v_result := public.board_photo_added(v_slug,v_path,'Rejected viewer photo',v_viewer_session,NULL);
 IF v_result->>'error' IS DISTINCT FROM 'view_only' THEN RAISE EXCEPTION 'Viewer photo mutation accepted: %',v_result; END IF;
 IF v_actions <> (SELECT count(*) FROM public.client_board_actions WHERE board_slug=v_slug)
   OR v_ideas <> (SELECT count(*) FROM public.client_ideas WHERE client_id='swishdm') THEN
   RAISE EXCEPTION 'Rejected legacy writes left data';
 END IF;
 v_result := public.board_photo_added(v_slug,v_path,'Valid stored photo fixture',v_editor_session,NULL);
 IF v_result->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Stored approver photo rejected: %',v_result; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.client_board_actions WHERE board_slug=v_slug AND ref=v_path AND action='photo_upload' AND payload->>'by'=v_editor) THEN
   RAISE EXCEPTION 'Stored photo lacks named receipt';
 END IF;
END $test$;
ROLLBACK;
