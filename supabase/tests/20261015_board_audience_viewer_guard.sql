-- Run against a database with board roles installed. All fixtures and actions roll back.
-- Catches a v2 audience decision that bypasses viewer role enforcement while
-- preserving approver, admin, owner, keyed-link, RISE and ARCH decision paths.
BEGIN;

DO $test$
DECLARE
  v_ref text := 'audn-rec:viewer-guard-20261015-swishdm';
  v_session text := 'viewer-guard-20261015-swishdm-session';
  v_owner_session text := 'viewer-guard-20261015-owner-session';
  v_token text;
  v_result jsonb;
  v_count integer;
  v_cross_count integer := 0;
  v_board record;
BEGIN
  INSERT INTO public.client_ideas (client_id, hook, source_ref)
  VALUES ('swishdm', 'Viewer guard rollback fixture', v_ref);
  INSERT INTO public.client_board_sessions (slug, email, token_hash, expires_at)
  VALUES
    ('swishdm-live', 'im@ivanmanfredi.com', encode(digest(v_session, 'sha256'), 'hex'), now() + interval '1 hour'),
    ('swishdm-live', 'john@swishdm.com', encode(digest(v_owner_session, 'sha256'), 'hex'), now() + interval '1 hour');

  -- Change an existing member's role only inside this rollback transaction.
  UPDATE public.client_registry
     SET platform = jsonb_set(platform, '{board,auth,members,im@ivanmanfredi.com,role}', '"viewer"'::jsonb)
   WHERE client_id = 'swishdm' AND platform->'board'->>'slug' = 'swishdm-live';
  IF NOT FOUND OR public._board_member_role('swishdm-live', 'im@ivanmanfredi.com') <> 'viewer' THEN
    RAISE EXCEPTION 'viewer fixture did not resolve';
  END IF;
  v_result := public.client_board_audience_decide_v2('swishdm-live', v_session, v_ref, 'accept', 'Viewer test reason');
  IF v_result <> '{"ok":false,"error":"view_only"}'::jsonb THEN
    RAISE EXCEPTION 'viewer decision was not rejected: %', v_result;
  END IF;
  SELECT count(*) INTO v_count FROM public.client_board_actions WHERE board_slug = 'swishdm-live' AND ref = v_ref;
  IF v_count <> 0 THEN RAISE EXCEPTION 'viewer wrote an action'; END IF;

  UPDATE public.client_registry
     SET platform = jsonb_set(platform, '{board,auth,members,im@ivanmanfredi.com,role}', '"approver"'::jsonb)
   WHERE client_id = 'swishdm';
  v_result := public.client_board_audience_decide_v2('swishdm-live', v_session, v_ref, 'accept', 'Approver test reason');
  IF v_result->>'ok' <> 'true' THEN RAISE EXCEPTION 'approver decision failed: %', v_result; END IF;

  UPDATE public.client_registry
     SET platform = jsonb_set(platform, '{board,auth,members,im@ivanmanfredi.com,role}', '"admin"'::jsonb)
   WHERE client_id = 'swishdm';
  v_result := public.client_board_audience_decide_v2('swishdm-live', v_session, v_ref, 'defer', 'Admin test reason');
  IF v_result->>'ok' <> 'true' THEN RAISE EXCEPTION 'admin decision failed: %', v_result; END IF;

  -- An owner remains admin even if the members map says viewer.
  UPDATE public.client_registry
     SET platform = jsonb_set(platform, '{board,auth,members,john@swishdm.com,role}', '"viewer"'::jsonb)
   WHERE client_id = 'swishdm';
  IF public._board_member_role('swishdm-live', 'john@swishdm.com') <> 'admin' THEN
    RAISE EXCEPTION 'owner lost admin protection';
  END IF;
  v_result := public.client_board_audience_decide_v2('swishdm-live', v_owner_session, v_ref, 'reject', 'Owner test reason');
  IF v_result->>'ok' <> 'true' THEN RAISE EXCEPTION 'owner decision failed: %', v_result; END IF;

  v_result := public.client_board_audience_decide_v2('swishdm-live', '', v_ref, 'accept', 'No session reason');
  IF v_result <> '{"ok":false,"error":"not_authenticated"}'::jsonb THEN
    RAISE EXCEPTION 'empty session bypassed auth: %', v_result;
  END IF;
  v_result := public.client_board_audience_decide_v2('swishdm-live', 'invalid-viewer-guard-session', v_ref, 'accept', 'Bad session reason');
  IF v_result <> '{"ok":false,"error":"not_authenticated"}'::jsonb THEN
    RAISE EXCEPTION 'invalid session bypassed auth: %', v_result;
  END IF;
  SELECT count(*) INTO v_count FROM public.client_board_actions WHERE board_slug = 'swishdm-live' AND ref = v_ref;
  IF v_count <> 3 THEN RAISE EXCEPTION 'unexpected signed-in action count: %', v_count; END IF;

  SELECT token INTO v_token FROM public.client_boards WHERE slug = 'swishdm-live';
  v_result := public.client_board_audience_decide('swishdm-live', v_token, v_ref, 'accept', 'Keyed link test reason');
  IF v_result->>'ok' <> 'true' THEN RAISE EXCEPTION 'keyed link decision failed: %', v_result; END IF;
  SELECT count(*) INTO v_count FROM public.client_board_actions WHERE board_slug = 'swishdm-live' AND ref = v_ref;
  IF v_count <> 4 THEN RAISE EXCEPTION 'keyed link action missing: %', v_count; END IF;

  -- The same signed-in wrapper must keep the other clients' allowed paths.
  FOR v_board IN
    SELECT slug, client_id FROM public.client_boards
     WHERE (slug = 'risedtc-com' AND client_id = 'risedtc')
        OR (slug = 'arch-agency' AND client_id = 'arch')
  LOOP
    INSERT INTO public.client_ideas (client_id, hook, source_ref)
    VALUES (v_board.client_id, 'Viewer guard rollback fixture', 'audn-rec:viewer-guard-20261015-' || v_board.client_id);
    INSERT INTO public.client_board_sessions (slug, email, token_hash, expires_at)
    VALUES (v_board.slug, 'viewer-guard-fixture@example.invalid',
            encode(digest('viewer-guard-20261015-' || v_board.client_id, 'sha256'), 'hex'), now() + interval '1 hour');
    v_result := public.client_board_audience_decide_v2(
      v_board.slug, 'viewer-guard-20261015-' || v_board.client_id,
      'audn-rec:viewer-guard-20261015-' || v_board.client_id, 'accept', 'Cross-client test reason');
    IF v_result->>'ok' <> 'true' THEN RAISE EXCEPTION '% decision failed: %', v_board.client_id, v_result; END IF;
    v_cross_count := v_cross_count + 1;
  END LOOP;
  IF v_cross_count <> 2 THEN RAISE EXCEPTION 'expected both RISE and ARCH board paths: %', v_cross_count; END IF;
END;
$test$;

SELECT 'viewer guard regression passed; transaction will roll back' AS result;
ROLLBACK;
