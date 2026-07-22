-- Client Ops: approve-time "conversation moved on" guard (Ivan 2026-07-21).
-- If Mattan takes a thread over by hand (or the prospect sends again) after a draft was
-- written, approving that draft must NOT double-reply into a handled conversation. On approve
-- we re-check the thread: any newer inbound, or any already-sent outbound after the draft's
-- timestamp, means the draft is stale -> discard it and refuse the send. Pairs with the RISE
-- Reply Detector, which also purges stale drafts every sync pass.
create or replace function public.operator_approve_rise_draft(p_gate text, p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_armed   boolean;
  v_pid     uuid;
  v_created timestamptz;
  v_moved   boolean;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;

  select (value = 'true') into v_armed
  from integration_config where key = 'risedtc_reply_send_armed';
  if not coalesce(v_armed, false) then
    return jsonb_build_object('ok', false, 'armed', false, 'error', 'disabled_until_armed',
      'note', 'RISE sending is not armed yet (Mattan seat routing pending). Nothing was approved or sent.');
  end if;

  select m.prospect_id, coalesce(m.created_at, now())
    into v_pid, v_created
  from outreach_messages m
  join outreach_prospects p on p.id = m.prospect_id
  join outreach_campaigns c on c.id = p.campaign_id
  where m.id = p_message_id
    and c.client_id = 'risedtc'
    and m.direction = 'outbound'
    and m.sent_at is null
    and m.approved_at is null
  limit 1;
  if v_pid is null then
    return jsonb_build_object('ok', false, 'error', 'not_a_pending_rise_draft',
      'note', 'Draft not found, already sent, or already approved.');
  end if;

  select exists (
    select 1 from outreach_messages x
    where x.prospect_id = v_pid
      and x.id <> p_message_id
      and coalesce(x.is_reaction, false) = false
      and (
        (x.direction = 'inbound'  and coalesce(x.created_at, x.sent_at) > v_created)
        or (x.direction = 'outbound' and x.sent_at is not null and coalesce(x.sent_at, x.created_at) > v_created)
      )
  ) into v_moved;
  if v_moved then
    delete from outreach_messages where id = p_message_id and sent_at is null and approved_at is null;
    return jsonb_build_object('ok', false, 'error', 'conversation_moved_on',
      'note', 'This conversation was already answered or continued, so the draft was discarded instead of sent.');
  end if;

  update outreach_messages
    set approved_at = now()
    where id = p_message_id and sent_at is null and approved_at is null;

  return jsonb_build_object('ok', true,
    'note', 'Approved. Sends from Mattan''s seat on the next dispatcher pass.');
end;
$function$;

revoke all on function public.operator_approve_rise_draft(text, uuid) from public;
revoke all on function public.operator_approve_rise_draft(text, uuid) from anon;
grant execute on function public.operator_approve_rise_draft(text, uuid) to authenticated;
grant execute on function public.operator_approve_rise_draft(text, uuid) to service_role;
