-- Rollback-only behavior tests. No real blob is uploaded or deleted.
-- Run with board roles and the new activity/storage migration installed.
BEGIN;
SET LOCAL search_path=public,extensions;
DO $test$
DECLARE
 v_session text := 'activity-receipt-fixture'; v_by text := 'activity-fixture@example.invalid';
 v_path text := 'swishdm-live/activity-receipt-fixture.png'; v_id uuid; v_r jsonb; v_page jsonb; v_next jsonb; v_n int;
BEGIN
 INSERT INTO public.client_board_sessions(slug,email,token_hash,expires_at)
 VALUES('swishdm-live',v_by,encode(digest(v_session,'sha256'),'hex'),now()+interval '1 hour');
 v_r := public.board_photo_operation('swishdm-live',v_path,'upload','started',p_session=>v_session);
 IF v_r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'start failed: %',v_r; END IF;
 v_id := (v_r->>'operation_id')::uuid;
 IF NOT EXISTS(SELECT 1 FROM public.client_board_actions WHERE id=v_id AND payload->>'by'=v_by AND payload->'before'->>'exists'='false' AND payload->>'phase'='started') THEN RAISE EXCEPTION 'intent must precede storage'; END IF;
 v_r := public.board_photo_operation('swishdm-live',v_path,'upload','completed',v_id,p_session=>v_session);
 IF v_r->>'error' IS DISTINCT FROM 'storage_unconfirmed' THEN RAISE EXCEPTION 'missing upload falsely confirmed'; END IF;
 -- A temporary metadata fixture represents the Storage API's completed upload.
 INSERT INTO storage.objects(bucket_id,name) VALUES('client-photos',v_path);
 v_r := public.board_photo_operation('swishdm-live',v_path,'upload','completed',v_id,p_session=>v_session);
 IF v_r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'completion failed: %',v_r; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.client_board_actions WHERE board_slug='swishdm-live' AND payload->>'operation_id'=v_id::text
   AND payload->>'by'=v_by AND payload->'before'->>'exists'='false' AND payload->'after'->>'exists'='true') THEN RAISE EXCEPTION 'completion snapshot missing'; END IF;
 v_r := public.board_photo_operation('swishdm-live',v_path,'upload','completed',v_id,p_session=>v_session);
 IF v_r->>'error' IS DISTINCT FROM 'already_finished' THEN RAISE EXCEPTION 'duplicate completion accepted'; END IF;
 v_r := public.board_photo_operation('swishdm-live',v_path,'delete','started',p_session=>v_session); v_id := (v_r->>'operation_id')::uuid;
 v_r := public.board_photo_operation('swishdm-live',v_path,'delete','completed',v_id,p_session=>v_session);
 IF v_r->>'error' IS DISTINCT FROM 'storage_unconfirmed' THEN RAISE EXCEPTION 'existing object falsely confirmed deleted'; END IF;
 v_r := public.board_photo_operation('swishdm-live',v_path,'delete','failed',v_id,p_session=>v_session);
 IF v_r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'failure receipt missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.client_board_actions WHERE payload->>'operation_id'=v_id::text AND payload->>'phase'='failed' AND payload->'after'->>'exists'='true') THEN RAISE EXCEPTION 'storage failure misreported'; END IF;
 v_r := public.board_photo_operation('swishdm-live','risedtc-com/file.png','upload','started',p_session=>v_session);
 IF v_r->>'error' IS DISTINCT FROM 'bad_operation' THEN RAISE EXCEPTION 'cross-client path accepted'; END IF;
 v_r := public.board_photo_operation('risedtc-com','risedtc-com/file.png','upload','started',p_session=>v_session);
 IF v_r->>'error' IS DISTINCT FROM 'not_authenticated' THEN RAISE EXCEPTION 'cross-client session accepted'; END IF;
 v_r := public.board_activity('swishdm-live','invalid');
 IF v_r->>'error' IS DISTINCT FROM 'not_authenticated' THEN RAISE EXCEPTION 'activity auth bypass'; END IF;

 v_r := public.board_slot_notes('swishdm-live','[{"ref":"audit-slot","payload":{"event":"post_removed","by":"spoof"}},{"ref":"audit-slot","payload":{"event":"day_left_empty"}}]',v_session);
 IF v_r->>'ok' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'slot batch failed: %',v_r; END IF;
 IF (SELECT count(*) FROM public.client_board_actions WHERE board_slug='swishdm-live' AND ref='audit-slot' AND payload->>'by'=v_by AND payload ? 'before' AND payload ? 'after')<>2 THEN RAISE EXCEPTION 'batch missing server identity/snapshots'; END IF;
 v_r := public.board_slot_notes('swishdm-live','[{"ref":"audit-slot","payload":{"event":"post_restored"}},{"ref":"audit-slot","payload":{"event":"internal_secret"}}]',v_session);
 IF v_r->>'error' IS DISTINCT FROM 'bad_event' OR (SELECT count(*) FROM public.client_board_actions WHERE ref='audit-slot')<>2 THEN RAISE EXCEPTION 'invalid batch partially wrote'; END IF;

 -- Private operator markers and other boards never project into client activity.
 INSERT INTO public.client_board_actions(board_slug,client_id,action,ref,payload) VALUES
 ('swishdm-live','swishdm','note','private-marker','{"event":"internal_secret","secret":"must-not-project"}'),
 ('risedtc-com','risedtc','comment','other-board','{"text":"other-client-private","by":"other@example.invalid"}');
 v_page := public.board_activity('swishdm-live',v_session);
 IF v_page->>'ok' IS DISTINCT FROM 'true' OR v_page::text LIKE '%must-not-project%' OR v_page::text LIKE '%other-client-private%' THEN RAISE EXCEPTION 'unsafe activity projection'; END IF;
 INSERT INTO public.client_board_actions(board_slug,client_id,action,ref,payload,created_at)
 SELECT 'swishdm-live','swishdm','comment','pagination-fixture',jsonb_build_object('by',v_by,'text','page-'||i,'secret','not-projected'),now()+interval '1 second'+i*interval '1 microsecond' FROM generate_series(1,55) i;
 v_page := public.board_activity('swishdm-live',v_session);
 IF jsonb_array_length(v_page->'items')<>50 OR v_page::text LIKE '%not-projected%' THEN RAISE EXCEPTION 'pagination/projection failed'; END IF;
 v_r := (v_page->'items')->49;
 v_next := public.board_activity('swishdm-live',v_session,p_before_at=>(v_r->>'at')::timestamptz,p_before_id=>(v_r->>'id')::uuid);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_page->'items') a JOIN jsonb_array_elements(v_next->'items') b ON a->>'id'=b->>'id') THEN RAISE EXCEPTION 'cursor repeated entries'; END IF;
 -- Actual deciding member, not generic "board", is retained.
 INSERT INTO public.client_ideas(client_id,hook,source_ref) VALUES('swishdm','Activity audit rollback fixture','audn-rec:activity-fixture');
 v_r := public.client_board_audience_decide_v2('swishdm-live',v_session,'audn-rec:activity-fixture','accept','Fixture reason');
 IF v_r->>'ok' IS DISTINCT FROM 'true' OR NOT EXISTS(SELECT 1 FROM public.client_board_actions WHERE board_slug='swishdm-live' AND ref='audn-rec:activity-fixture' AND payload->>'by'=v_by AND payload->'after'->>'decision'='accept') THEN RAISE EXCEPTION 'audience attribution missing'; END IF;
END $test$;
CREATE FUNCTION pg_temp.reject_slot_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit unavailable' USING ERRCODE='P0001'; END $$;
CREATE TRIGGER reject_slot_receipt BEFORE INSERT ON public.client_board_actions FOR EACH ROW
 WHEN(NEW.ref='audit-failure-slot' AND NEW.payload->>'event'='day_left_empty') EXECUTE FUNCTION pg_temp.reject_slot_receipt();
DO $test$
BEGIN
 BEGIN
  PERFORM public.board_slot_notes('swishdm-live','[{"ref":"audit-failure-slot","payload":{"event":"post_removed"}},{"ref":"audit-failure-slot","payload":{"event":"day_left_empty"}}]','activity-receipt-fixture');
  RAISE EXCEPTION 'failure expected' USING ERRCODE='P0002';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
 IF EXISTS(SELECT 1 FROM public.client_board_actions WHERE ref='audit-failure-slot') THEN RAISE EXCEPTION 'batch survived audit failure'; END IF;
END $test$;
ROLLBACK;
