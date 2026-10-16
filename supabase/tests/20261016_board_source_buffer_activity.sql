-- Rollback-only safe history projection tests.
BEGIN;
SET LOCAL search_path=public,extensions;
DO $test$
DECLARE v_page jsonb; v_session text:='source-buffer-activity-fixture';
BEGIN
 INSERT INTO public.client_board_sessions(slug,email,token_hash,expires_at)
 VALUES('swishdm-live','review-fixture@example.invalid',encode(digest(v_session,'sha256'),'hex'),now()+interval '1 hour');
 INSERT INTO public.client_board_actions(board_slug,client_id,action,ref,payload) VALUES
 ('swishdm-live','swishdm','source_provenance_verified','source-safe-fixture','{"by":"system","before":{"source_label":"Old","kind":"unknown","private":"hidden-source-before"},"after":{"source_label":"Public talk","source_detail":{"kind":"public_talk","source_url":"https://example.invalid/talk","deck_dir":"hidden-source-after"}}}'),
 ('swishdm-live','swishdm','operator_buffer_approve','buffer-safe-fixture','{"by":"review-fixture@example.invalid","before":{"board_visible":false,"status":"review","private":"hidden-buffer-before"},"after":{"board_visible":true,"status":"review","private":"hidden-buffer-after"}}');
 v_page:=public.board_activity('swishdm-live',v_session);
 IF v_page->>'ok' IS DISTINCT FROM 'true' OR v_page::text LIKE '%hidden-%' THEN RAISE EXCEPTION 'unsafe source or buffer projection'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_page->'items') e WHERE e->>'ref'='source-safe-fixture' AND e->'after'='{"source_label":"Public talk","kind":"public_talk","source_url":"https://example.invalid/talk"}'::jsonb) THEN RAISE EXCEPTION 'source receipt missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v_page->'items') e WHERE e->>'ref'='buffer-safe-fixture' AND e->'after'='{"board_visible":true,"status":"review"}'::jsonb) THEN RAISE EXCEPTION 'buffer receipt missing'; END IF;
 v_page:=public.board_activity('risedtc-com',v_session);
 IF v_page->>'error' IS DISTINCT FROM 'not_authenticated' THEN RAISE EXCEPTION 'cross-board session accepted'; END IF;
END $test$;
ROLLBACK;
