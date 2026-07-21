-- Client Ops Outreach: pending-response drafts now carry the FULL conversation thread
-- (Ivan 2026-07-21: "pending responses with the chat history and the draft in there, rendered
-- as html, pending responses from me are priority"). Also fixes the kind mapping, which was
-- pinned to old model versions (rise_dm1_sharp_v3 / rise_dm2_deliver_v2) and mislabeled the
-- current v9 / v5 drafts as generic 'draft'. Prefix-match keeps it version-proof.
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
                         when m.ai_model like 'rise_reply%' then 'reply'
                         when m.ai_model like 'rise_dm2%'   then 'dm2'
                         when m.ai_model like 'rise_dm1%'   then 'dm1'
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
      ),
      -- Full conversation so far: everything actually exchanged (sent outbound + inbound),
      -- oldest first, so the surface can render the chat history above the pending draft.
      -- The pending draft itself (sent_at null) is excluded — it renders separately below.
      'thread', (
        select jsonb_agg(jsonb_build_object(
                 'direction', tm.direction,
                 'text',      tm.message_text,
                 'at',        coalesce(tm.sent_at, tm.created_at))
               order by coalesce(tm.sent_at, tm.created_at) asc)
        from outreach_messages tm
        where tm.prospect_id = p.id
          and coalesce(tm.is_reaction, false) = false
          and (tm.direction = 'inbound' or tm.sent_at is not null)
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
  'Client Ops: pending outbound drafts (approved_at/sent_at null) per client — DM1/DM2/reply — with prospect, latest inbound, FULL conversation thread, and scan-link flag. Gated, read-only. Thread + version-proof kind mapping added 2026-07-21.';
