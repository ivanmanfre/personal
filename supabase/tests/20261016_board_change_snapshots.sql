-- Run after 20261016_board_change_snapshots.sql. Every fixture/action rolls back.
-- Uses only the explicit swishdm-live board; verifies other boards remain untouched.
BEGIN;
SET LOCAL search_path = public, extensions;
DO $test$
declare
  v_lm text := 'audit-snapshot-fixture';
  v_session text := 'audit-snapshot-session';
  v_member text := 'audit-snapshot-member@example.invalid';
  v_actor text := 'audit-snapshot-actor@example.invalid';
  v_result jsonb;
  v_log jsonb;
  v_token text;
  v_other text;
  v_count int;
begin
  select md5(coalesce(jsonb_agg(to_jsonb(b) order by b.slug)::text, '')) into v_other
    from public.client_boards b where slug <> 'swishdm-live';
  update public.client_boards set board = jsonb_set(board, '{lead_magnets}',
    coalesce(board->'lead_magnets', '[]') || jsonb_build_array(jsonb_build_object(
      'id', v_lm, 'status', 'drafted', 'promo', jsonb_build_object('dm','Before DM'))))
    where slug = 'swishdm-live';
  if not found then raise exception 'swishdm-live fixture board missing'; end if;
  insert into public.client_board_sessions(slug,email,token_hash,expires_at)
    values('swishdm-live',v_actor,encode(digest(v_session,'sha256'),'hex'), now()+interval '1 hour');
  v_result := public.client_board_edit_lm_promo_v2('swishdm-live',v_session,v_lm,'dm','"After DM"');
  if v_result->>'ok' <> 'true' then raise exception 'signed-in edit failed: %',v_result; end if;
  select payload into v_log from public.client_board_actions where board_slug='swishdm-live' and ref=v_lm and action='edit_lm_promo';
  if v_log->>'by' is distinct from v_actor or v_log->>'before' is distinct from 'Before DM' or v_log->>'after' is distinct from 'After DM' then
    raise exception 'DM snapshot/actor missing: %',v_log;
  end if;
  v_result := public.client_board_edit_lm_promo_v2('swishdm-live',v_session,v_lm,'email','{"subject":"Subject","body":"Body"}');
  if v_result->>'ok' <> 'true' then raise exception 'email edit failed'; end if;
  if not exists(select 1 from public.client_board_actions where board_slug='swishdm-live' and ref=v_lm and payload->>'field'='email'
      and payload ? 'before' and payload->'before'='null'::jsonb and payload->'after'='{"subject":"Subject","body":"Body"}'::jsonb) then
    raise exception 'email snapshot must preserve absent predecessor and structured new value';
  end if;
  select count(*) into v_count from public.client_board_actions where board_slug='swishdm-live' and ref=v_lm;
  v_result := public.client_board_edit_lm_promo_v2('swishdm-live','bad-session',v_lm,'dm','"Rejected"');
  if v_result->>'error' is distinct from 'not_authenticated' then raise exception 'invalid session accepted'; end if;
  v_result := public.client_board_edit_lm_promo_v2('risedtc-com',v_session,v_lm,'dm','"Rejected"');
  if v_result->>'error' is distinct from 'not_authenticated' then raise exception 'cross-board session accepted'; end if;
  v_result := public.client_board_edit_lm_promo_v2('swishdm-live',v_session,v_lm,'other','"Rejected"');
  if v_result->>'error' is distinct from 'bad_field' then raise exception 'invalid field accepted'; end if;
  if v_count <> (select count(*) from public.client_board_actions where board_slug='swishdm-live' and ref=v_lm) then raise exception 'failed writes logged as successful'; end if;
  select token into v_token from public.client_boards where slug='swishdm-live';
  v_result := public.client_board_edit_lm_promo('swishdm-live',v_token,v_lm,'dm','"Keyed DM"');
  if v_result->>'ok' <> 'true' then raise exception 'legacy key fallback failed'; end if;
  if not exists(select 1 from public.client_board_actions where board_slug='swishdm-live' and ref=v_lm
      and payload->>'by'='board link' and payload->>'before'='After DM' and payload->>'after'='Keyed DM') then raise exception 'legacy snapshot/identity missing'; end if;

  -- Internal mutator is exercised directly; public team auth/signatures are unchanged.
  v_result := public._board_team_apply('swishdm-live','add',v_member,v_actor,'Audit Teammate','viewer');
  if v_result->>'ok' <> 'true' then raise exception 'team add failed: %',v_result; end if;
  if not exists(select 1 from public.client_board_actions where board_slug='swishdm-live' and ref=v_member and action='invite'
    and payload->>'by'=v_actor and payload->'before'='null'::jsonb and payload->'after'->>'role'='viewer' and payload->'after'->>'name'='Audit Teammate') then raise exception 'team add snapshot missing'; end if;
  v_result := public._board_team_apply('swishdm-live','set_role',v_member,v_actor,null,'approver');
  if v_result->>'ok' <> 'true' then raise exception 'role change failed'; end if;
  if not exists(select 1 from public.client_board_actions where board_slug='swishdm-live' and ref=v_member and action='team_role'
    and payload->>'by'=v_actor and payload->'before'->>'role'='viewer' and payload->'after'->>'role'='approver') then raise exception 'role predecessor missing'; end if;
  v_result := public._board_team_apply('swishdm-live','remove',v_member,v_actor,null,null);
  if v_result->>'ok' <> 'true' then raise exception 'remove failed'; end if;
  if not exists(select 1 from public.client_board_actions where board_slug='swishdm-live' and ref=v_member and action='team_remove'
    and payload->>'by'=v_actor and payload->'before'->>'role'='approver' and payload->'before'->>'name'='Audit Teammate' and payload->'after'='null'::jsonb) then raise exception 'removed member snapshot missing'; end if;
  if v_other is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(b) order by b.slug)::text, '')) from public.client_boards b where slug <> 'swishdm-live') then raise exception 'other board changed'; end if;
end $test$;

-- A failed audit insert must roll back the associated DB mutation too.
CREATE FUNCTION pg_temp.reject_snapshot_log() RETURNS trigger LANGUAGE plpgsql AS $$
begin raise exception 'snapshot log unavailable' using errcode='P0001'; end $$;
CREATE TRIGGER snapshot_log_failure BEFORE INSERT ON public.client_board_actions
  FOR EACH ROW WHEN (NEW.ref = 'audit-snapshot-fixture' OR NEW.ref = 'audit-snapshot-failure@example.invalid')
  EXECUTE FUNCTION pg_temp.reject_snapshot_log();
DO $test$
declare v_before jsonb; v_after jsonb;
begin
 select board into v_before from public.client_boards where slug='swishdm-live';
 begin
  perform public.client_board_edit_lm_promo_v2('swishdm-live','audit-snapshot-session','audit-snapshot-fixture','dm','"Must roll back"');
  raise exception 'audit failure unexpectedly succeeded' using errcode='P0002';
 exception when sqlstate 'P0001' then null;
 end;
 select board into v_after from public.client_boards where slug='swishdm-live';
 if v_before is distinct from v_after then raise exception 'LM mutation survived failed log'; end if;
 select platform into v_before from public.client_registry where client_id='swishdm';
 begin
  perform public._board_team_apply('swishdm-live','add','audit-snapshot-failure@example.invalid','audit-actor@example.invalid','Failure fixture','viewer');
  raise exception 'audit failure unexpectedly succeeded' using errcode='P0002';
 exception when sqlstate 'P0001' then null;
 end;
 select platform into v_after from public.client_registry where client_id='swishdm';
 if v_before is distinct from v_after then raise exception 'team mutation survived failed log'; end if;
end $test$;
ROLLBACK;
