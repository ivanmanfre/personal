-- Client Ops — RISE "Drafts waiting on you" surface (followups goalrun 2026-07-21).
--
-- Two gated SECURITY DEFINER RPCs behind the shared operator_gate_ok gate:
--   1. operator_client_pending_drafts(p_gate, p_client_id) — READ ONLY. Every
--      outbound draft the RISE machine has queued but NOT sent (approved_at IS NULL,
--      sent_at IS NULL) across the client's campaigns: DM1 / DM2 (scan delivery) /
--      reply drafts, with the prospect, the inbound message that triggered a reply
--      draft, the draft text, and whether it carries a scan link.
--   2. operator_approve_rise_draft(p_gate, p_message_id) — the human send. Sets
--      approved_at=now() on ONE pending RISE draft so the Poll+Send dispatcher can
--      send it from Mattan's seat. GATED TWICE: operator_gate_ok AND a dedicated
--      integration_config flag `risedtc_reply_send_armed` (default OFF) that stays
--      off until Poll+Send seat routing to Mattan's seat is confirmed live — so an
--      approval can never arm a wrong-seat dispatch out of Ivan's account. Nothing
--      here talks to a sender directly; it only flips the approval gate.
--
-- Anon revoked; authenticated + service_role only. Read RPC is client-generic;
-- approve RPC is RISE-scoped (client_id='risedtc') for this build.

create or replace function public.operator_client_pending_drafts(p_gate text, p_client_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
declare v_drafts jsonb;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;

  select jsonb_agg(x order by (x->>'created_at') desc) into v_drafts
  from (
    select jsonb_build_object(
      'message_id',    m.id,
      'prospect_id',   p.id,
      'name',          p.name,
      'company',       p.company,
      'headline',      p.headline,
      'icp_score',     p.icp_score,
      'channel',       m.channel,
      'ai_model',      m.ai_model,
      'sequence_step', m.sequence_step,
      'kind',          case
                         when m.ai_model = 'rise_reply_draft_v1' then 'reply'
                         when m.ai_model = 'rise_dm2_deliver_v2' then 'dm2'
                         when m.ai_model = 'rise_dm1_sharp_v3'   then 'dm1'
                         else 'draft'
                       end,
      'text',          m.message_text,
      'has_link',      (m.message_text ~* 'https?://' or m.message_text ~* '/scan/' or m.message_text ~* '[a-z0-9-]+\.(com|co|io|shop)/'),
      'created_at',    coalesce(m.created_at, m.sent_at),
      'inbound', (
        select jsonb_build_object('text', im.message_text,
                                  'at', coalesce(im.sent_at, im.created_at))
        from outreach_messages im
        where im.prospect_id = p.id and im.direction = 'inbound'
          and coalesce(im.is_reaction, false) = false
        order by coalesce(im.sent_at, im.created_at) desc
        limit 1
      )
    ) as x
    from outreach_messages m
    join outreach_prospects p on p.id = m.prospect_id
    join outreach_campaigns c on c.id = p.campaign_id
    where c.client_id = p_client_id and coalesce(c.archived, false) = false
      and m.direction = 'outbound'
      and m.sent_at is null
      and m.approved_at is null
  ) s;

  return jsonb_build_object('ok', true, 'drafts', coalesce(v_drafts, '[]'::jsonb));
end;
$function$;

revoke all on function public.operator_client_pending_drafts(text, text) from public;
revoke all on function public.operator_client_pending_drafts(text, text) from anon;
grant execute on function public.operator_client_pending_drafts(text, text) to authenticated;
grant execute on function public.operator_client_pending_drafts(text, text) to service_role;

comment on function public.operator_client_pending_drafts(text, text) is
  'Client Ops: pending (approved_at null, sent_at null) outbound outreach drafts for a client — DM1/DM2/reply — with prospect, triggering inbound, and scan-link flag. Gated, read-only. Followups goalrun 2026-07-21.';


create or replace function public.operator_approve_rise_draft(p_gate text, p_message_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_armed boolean;
  v_ok    boolean;
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

  select true into v_ok
  from outreach_messages m
  join outreach_prospects p on p.id = m.prospect_id
  join outreach_campaigns c on c.id = p.campaign_id
  where m.id = p_message_id
    and c.client_id = 'risedtc'
    and m.direction = 'outbound'
    and m.sent_at is null
    and m.approved_at is null
  limit 1;
  if not coalesce(v_ok, false) then
    return jsonb_build_object('ok', false, 'error', 'not_a_pending_rise_draft',
      'note', 'Draft not found, already sent, or already approved.');
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

comment on function public.operator_approve_rise_draft(text, uuid) is
  'Client Ops: approve ONE pending RISE draft (sets approved_at so Poll+Send dispatches from Mattan seat). Double-gated: operator_gate_ok + risedtc_reply_send_armed flag (off until seat routing lands). Followups goalrun 2026-07-21.';
