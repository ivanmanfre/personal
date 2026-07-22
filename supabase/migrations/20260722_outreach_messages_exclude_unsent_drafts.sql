-- Root fix (Ivan 2026-07-22): the Client Ops inbox rendered a PENDING draft as a sent
-- chat bubble, so a scan-delivery draft looked auto-sent to a prospect. It was never sent
-- (sent_at + unipile_message_id both null), but operator_client_outreach's messages[]
-- subquery returned EVERY outreach_messages row for the prospect, including unsent
-- outbound drafts (approved_at/sent_at null), AND coalesced sent_at to created_at — so a
-- draft was indistinguishable from a real sent message on the wire.
--
-- The conversation timeline must contain ONLY messages that actually happened: inbound
-- replies, and outbound messages that were actually sent. Unsent outbound drafts belong
-- to the pending-drafts surface (operator_client_pending_drafts) and the approve box, never
-- to the thread. This filters them out at the source, so no consumer can mistake a draft
-- for a sent message. The client also guards this, but the RPC is the durable fix.
create or replace function public.operator_client_outreach(p_gate text, p_client_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_sequences jsonb;
  v_lanes     jsonb;
  v_campaigns jsonb;
  v_prospects jsonb;
  v_armed     boolean;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;

  select cb.board->'outreach'->'sequences',
         cb.board->'outreach'->'lanes'
    into v_sequences, v_lanes
  from client_boards cb
  where cb.client_id = p_client_id
  order by cb.updated_at desc nulls last
  limit 1;

  select bool_or(coalesce(c.is_active, false))
    into v_armed
  from outreach_campaigns c
  where c.client_id = p_client_id and coalesce(c.archived, false) = false;

  select jsonb_agg(x order by x->>'name') into v_campaigns
  from (
    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'is_active', coalesce(c.is_active, false),
      'lane_key', case
        when c.name ilike '%warm%' then 'warm'
        when c.name ilike '%orbit%' or c.name ilike '%engager%' then 'client-engager'
        when c.name ilike '%cold%' then 'cold-authority'
        else null
      end,
      'counts', (
        select jsonb_build_object(
          'total',          count(*),
          'messaged',       count(*) filter (where p.last_dm_sent_at is not null),
          'awaiting_reply', count(*) filter (where p.last_dm_sent_at is not null
                              and (coalesce(p.reply_count, 0) = 0
                                   or p.last_reply_at is null
                                   or p.last_reply_at < p.last_dm_sent_at)),
          'needs_reply',    count(*) filter (where coalesce(p.needs_manual_reply, false)),
          'replied',        count(*) filter (where coalesce(p.reply_count, 0) > 0),
          'gated',          count(*) filter (where (p.enrichment_data->'name_gate'->>'gated')::boolean is true)
        )
        from outreach_prospects p where p.campaign_id = c.id
      )
    ) as x
    from outreach_campaigns c
    where c.client_id = p_client_id and coalesce(c.archived, false) = false
  ) s;

  select jsonb_agg(x order by (x->>'icp_score')::int desc nulls last, x->>'name') into v_prospects
  from (
    select jsonb_build_object(
      'id',                 p.id,
      'campaign_id',        p.campaign_id,
      'name',               p.name,
      'company',            p.company,
      'headline',           p.headline,
      'icp_score',          p.icp_score,
      'stage',              p.stage,
      'preferred_channel',  p.preferred_channel,
      'note_variant',       p.note_variant,
      'send_priority',      p.send_priority,
      'blacklisted',        coalesce(p.blacklisted, false),
      'skip_reason',        p.skip_reason,
      'connection_note',    p.connection_note,
      'offer_angle',        p.offer_angle,
      'gate',               case when p.enrichment_data ? 'name_gate'
                                 then p.enrichment_data->'name_gate' else null end,
      'anchor_client',      p.enrichment_data->>'anchor_client',
      'last_dm_sent_at',    p.last_dm_sent_at,
      'connection_sent_at', p.connection_sent_at,
      'connected_at',       p.connected_at,
      'last_reply_at',      p.last_reply_at,
      'reply_count',        coalesce(p.reply_count, 0),
      'dm_count',           coalesce(p.dm_count, 0),
      'needs_manual_reply', coalesce(p.needs_manual_reply, false),
      'next_touch_after',   p.next_touch_after,
      'messaged',           (p.last_dm_sent_at is not null),
      'awaiting_reply',     (p.last_dm_sent_at is not null
                             and (coalesce(p.reply_count, 0) = 0
                                  or p.last_reply_at is null
                                  or p.last_reply_at < p.last_dm_sent_at)),
      'messages', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'direction',   mm.direction,
                 'channel',     mm.channel,
                 'type',        mm.message_type,
                 'step',        mm.sequence_step,
                 'sent_at',     coalesce(mm.sent_at, mm.created_at),
                 'is_reaction', coalesce(mm.is_reaction, false),
                 'text',        mm.message_text
               ) order by coalesce(mm.sent_at, mm.created_at)), '[]'::jsonb)
        from outreach_messages mm
        where mm.prospect_id = p.id
          -- ONLY real conversation: inbound replies + outbound that actually sent.
          -- Unsent outbound drafts (approved_at/sent_at null) are excluded so a draft can
          -- never render as a sent message. They live in operator_client_pending_drafts.
          and (mm.direction = 'inbound' or mm.sent_at is not null)
      )
    ) as x
    from outreach_prospects p
    join outreach_campaigns c on c.id = p.campaign_id
    where c.client_id = p_client_id and coalesce(c.archived, false) = false
  ) s;

  return jsonb_build_object(
    'ok',        true,
    'armed',     coalesce(v_armed, false),
    'sequences', v_sequences,
    'lanes_meta', v_lanes,
    'campaigns', coalesce(v_campaigns, '[]'::jsonb),
    'prospects', coalesce(v_prospects, '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.operator_client_outreach(text, text) from public;
revoke all on function public.operator_client_outreach(text, text) from anon;
grant execute on function public.operator_client_outreach(text, text) to authenticated;
grant execute on function public.operator_client_outreach(text, text) to service_role;
