-- 2026-10-15: Slack mirror links use the board address on file (client_registry
-- platform.board.url), so a white-label board (swishdm-live -> madebyswishdm.com/board)
-- never posts an inboundonsteroids.com link into the client's Slack. Applied live via the
-- Management API; only the v_url line changed from 20261015_board_slack_mirror.sql.

CREATE OR REPLACE FUNCTION public.board_slack_tick_at(p_now timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r          record;
  v_cfg      jsonb;
  v_enabled  boolean;
  v_dry      boolean;
  v_tz       text;
  v_channel  text;
  v_board    jsonb;
  v_url      text;
  v_review   jsonb;
  v_state    public.board_slack_state%rowtype;
  v_new      jsonb;
  v_n        int;
  v_local    timestamp;
  v_week     text;
  v_mon      date;
  v_lines    text;
  v_wait     int;
  v_out      jsonb := '[]'::jsonb;
begin
  for r in
    select c.client_id, c.platform->'board' as pb
      from public.client_registry c
     where jsonb_typeof(c.platform->'board'->'slack_mirror') = 'object'
  loop
    v_cfg     := r.pb->'slack_mirror';
    v_enabled := coalesce((v_cfg->>'enabled')::boolean, false);
    v_dry     := coalesce((v_cfg->>'dry_run')::boolean, false);
    continue when not v_enabled and not v_dry;
    v_tz := coalesce(nullif(v_cfg->>'tz', ''), 'Europe/London');
    select ic.value into v_channel from public.integration_config ic
     where ic.key = replace(coalesce(v_cfg->>'channel_ref', 'integration_config:' || r.client_id || '_slack_channel'), 'integration_config:', '');
    select cb.board into v_board from public.client_boards cb where cb.slug = r.pb->>'slug';
    continue when v_board is null;
    -- The board address on file (white-label boards live on the client's own domain).
    v_url := coalesce(nullif(r.pb->>'url', ''), 'https://inboundonsteroids.com/client/' || (r.pb->>'slug'));

    -- Posts waiting for the client's review: stage 'review', not generating, not approved/removed.
    select coalesce(jsonb_agg(q->>'id'), '[]'::jsonb) into v_review
      from jsonb_array_elements(coalesce(v_board->'queue', '[]'::jsonb)) q
     where q->>'stage' = 'review' and coalesce((q->>'generating')::boolean, false) = false
       and not exists (
         select 1 from (
           select distinct on (a.ref) a.action, a.payload->>'event' as ev
             from public.client_board_actions a
            where a.board_slug = r.pb->>'slug' and a.ref = q->>'id'
              and (a.action = 'approve' or (a.action = 'note' and a.payload->>'event' in ('undo_approve', 'post_removed', 'post_restored')))
            order by a.ref, a.created_at desc) last
        where last.action = 'approve' or last.ev = 'post_removed');

    select * into v_state from public.board_slack_state where client_id = r.client_id;
    if not found then
      -- First run: remember what is already there, announce nothing (no flood).
      insert into public.board_slack_state (client_id, seen_review_ids, last_digest_week)
      values (r.client_id, v_review, null);
      v_out := v_out || jsonb_build_object('client', r.client_id, 'init', jsonb_array_length(v_review));
      continue;
    end if;

    -- (a) batch_ready
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_new
      from jsonb_array_elements_text(v_review) x
     where not (v_state.seen_review_ids ? x);
    v_n := jsonb_array_length(v_new);
    if v_n > 0 and v_state.pending_since is null then
      update public.board_slack_state set pending_since = now(), updated_at = now() where client_id = r.client_id;
    elsif v_n > 0 and v_state.pending_since < p_now - interval '20 minutes' then
      perform public._board_slack_emit(r.client_id, r.pb->>'slug', 'batch_ready', v_channel,
        format(E'%s new %s ready for review\n%s', v_n, case when v_n = 1 then 'post' else 'posts' end, v_url || '#review'),
        v_enabled, 'batch_ready:' || r.client_id || ':' || md5(v_new::text));
      update public.board_slack_state
         set seen_review_ids = (select coalesce(jsonb_agg(distinct e), '[]'::jsonb)
                                  from jsonb_array_elements_text(v_state.seen_review_ids || v_new) e),
             pending_since = null, updated_at = now()
       where client_id = r.client_id;
      v_out := v_out || jsonb_build_object('client', r.client_id, 'batch_ready', v_n);
    elsif v_n = 0 and v_state.pending_since is not null then
      update public.board_slack_state set pending_since = null, updated_at = now() where client_id = r.client_id;
    end if;

    -- (b) weekly_digest, Monday from 08:00 client time, once per ISO week.
    v_local := p_now at time zone v_tz;
    v_week  := to_char(v_local, 'IYYY-"W"IW');
    if extract(isodow from v_local) = 1 and extract(hour from v_local) >= 8
       and v_week is distinct from v_state.last_digest_week then
      v_mon := v_local::date;
      select string_agg(format('• %s: %s', to_char((q->>'publish_date')::date, 'Dy DD Mon'),
                               left(coalesce(nullif(q->>'hook', ''), nullif(q->>'title', ''), 'post'), 70)),
                        E'\n' order by q->>'publish_date')
        into v_lines
        from jsonb_array_elements(coalesce(v_board->'queue', '[]'::jsonb)) q
       where q->>'publish_date' ~ '^\d{4}-\d{2}-\d{2}$'
         and (q->>'publish_date')::date between v_mon and v_mon + 6
         and coalesce(q->>'stage', '') <> 'published'
         and (q->>'stage' = 'scheduled' or not (v_review ? (q->>'id')));
      v_wait := jsonb_array_length(v_review);
      perform public._board_slack_emit(r.client_id, r.pb->>'slug', 'weekly_digest', v_channel,
        format(E'This week on the board\n%s\n%s\n%s',
               coalesce(E'Going out:\n' || v_lines, 'Nothing is scheduled to go out this week.'),
               case when v_wait = 0 then 'Nothing is waiting on you.'
                    else format('Waiting on you: %s %s to review.', v_wait, case when v_wait = 1 then 'post' else 'posts' end) end,
               v_url),
        v_enabled, 'weekly_digest:' || r.client_id || ':' || v_week);
      update public.board_slack_state set last_digest_week = v_week, updated_at = now() where client_id = r.client_id;
      v_out := v_out || jsonb_build_object('client', r.client_id, 'weekly_digest', v_week);
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'events', v_out);
end;
$function$;
