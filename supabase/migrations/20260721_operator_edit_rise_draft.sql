-- Client Ops: let the operator EDIT a pending outreach draft before approving it
-- (Ivan 2026-07-21: "I cannot edit it"). Gated + only touches drafts that have NOT been
-- approved or sent. Mirrors operator_approve_rise_draft's guard.
create or replace function public.operator_edit_rise_draft(p_gate text, p_message_id uuid, p_text text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_ok boolean;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;
  if p_text is null or length(btrim(p_text)) < 3 then
    return jsonb_build_object('ok', false, 'error', 'empty_text');
  end if;
  select true into v_ok
  from outreach_messages m
  where m.id = p_message_id
    and m.direction = 'outbound'
    and m.sent_at is null
    and m.approved_at is null;
  if not coalesce(v_ok, false) then
    return jsonb_build_object('ok', false, 'error', 'not_a_pending_draft');
  end if;
  update outreach_messages
    set message_text = p_text
    where id = p_message_id and sent_at is null and approved_at is null;
  return jsonb_build_object('ok', true);
end;
$function$;

revoke all on function public.operator_edit_rise_draft(text, uuid, text) from public;
revoke all on function public.operator_edit_rise_draft(text, uuid, text) from anon;
grant execute on function public.operator_edit_rise_draft(text, uuid, text) to authenticated;
grant execute on function public.operator_edit_rise_draft(text, uuid, text) to service_role;

comment on function public.operator_edit_rise_draft(text, uuid, text) is
  'Client Ops: edit a pending (approved_at/sent_at null) outreach draft message_text before approve. Gated, guarded to pending-only. Added 2026-07-21.';
