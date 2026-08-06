-- 2026-08-06 — put the REAL sendable number on the outreach lane cards.
--
-- WHY. The card's headline number was `staged`, defined as
--     connection_sent_at is null and not blacklisted
-- which is "never been invited", not "can be invited". It counts rows parked at ballot_hold with
-- no ad confirmation, rows with no note written, rows with a null country the geo gate fails
-- closed on, and rows on a PAUSED campaign. Measured 2026-08-06 on risedtc: the card read
-- Competitor Engagers 87 and Cold 190 (paused), while the number the Connection Request Sender
-- could actually pick that hour was 40 and 0. A lane looks like it has a week of runway when it
-- has a day, and a dead lane looks alive.
--
-- WHAT. Adds `sendable` alongside `staged`, mirroring the sender's own picker predicate
-- (Outreach - Connection Request Sender, the Rise block) field for field:
--     campaign is_active           -- a paused lane can send nothing, so it reports 0
--     blacklisted = false
--     country is not null          -- geo gate v2 fails CLOSED on null geo
--     connection_sent_at is null
--     last_dm_sent_at is null
--     stage in (identified, enriched)
--     preferred_channel is null or 'linkedin'
--     prospecting lanes only: enrichment_data->>rise_note_final is not null
--     prospecting lanes only: ad_intel->>paid_active_any_network = 'true'   (Ivan's 08-04 rule)
--     cold lane only:         liveness_checked_at is not null
--
-- 🔴 THE ADS + NOTE GATES ARE PROSPECTING-ONLY, exactly as in the sender. Orbit / Profile View /
-- Inbound are qualified by INTENT or relationship, not by fit — demanding ad proof from someone who
-- asked to be contacted would be the wrong test, and applying it here would under-report them.
--
-- 🔴 KEEP THIS IN SYNC WITH THE SENDER. If the picker gains or drops a filter, change it in BOTH
-- places or this card starts lying again in the other direction.
--
-- Param list is unchanged, so CREATE OR REPLACE is safe (no DROP needed).

create or replace function public.operator_outreach_lane_kpis(p_gate text, p_client_id text default null)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'extensions'
as $fn$
declare
  v_lanes jsonb;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;
  select jsonb_agg(x order by (x->>'is_active') = 'true' desc, (x->>'sent')::int desc, x->>'name') into v_lanes
  from (
    select jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'is_active', coalesce(c.is_active, false),
      'lane_key', case
        when c.name ilike '%warm%' then 'warm'
        when c.name ilike '%orbit%' or c.name ilike '%engager%' then 'client-engager'
        when c.name ilike '%cold%' then 'pure-cold'
        else null
      end,
      'kpis', (
        select jsonb_build_object(
          'staged',      count(*) filter (where p.connection_sent_at is null and not coalesce(p.blacklisted, false)),
          -- the honest one: what the sender could pick right now
          'sendable',    case when coalesce(c.is_active, false) then count(*) filter (where
                              p.connection_sent_at is null
                          and p.last_dm_sent_at is null
                          and not coalesce(p.blacklisted, false)
                          and p.country is not null
                          and p.stage in ('identified', 'enriched')
                          and (p.preferred_channel is null or p.preferred_channel = 'linkedin')
                          and (
                                -- prospecting lanes carry the note + ads requirement
                                (c.name not ilike '%cold%' and c.name not ilike '%engager%')
                             or (
                                    p.enrichment_data->>'rise_note_final' is not null
                                and p.enrichment_data->'ad_intel'->>'paid_active_any_network' = 'true'
                                and (c.name not ilike '%cold%' or p.liveness_checked_at is not null)
                                )
                              )
                          ) else 0 end,
          -- why the rest are not sendable, so a starved lane is diagnosable from the card
          'held_no_ads', count(*) filter (where
                              p.connection_sent_at is null
                          and not coalesce(p.blacklisted, false)
                          and p.stage in ('identified', 'enriched', 'ballot_hold')
                          and coalesce(p.enrichment_data->'ad_intel'->>'paid_active_any_network', 'false') <> 'true'),
          'held_no_note', count(*) filter (where
                              p.connection_sent_at is null
                          and not coalesce(p.blacklisted, false)
                          and p.stage in ('identified', 'enriched', 'ballot_hold')
                          and p.enrichment_data->>'rise_note_final' is null),
          'sent',        count(*) filter (where p.connection_sent_at is not null),
          'sent_mtd',    count(*) filter (where p.connection_sent_at >= date_trunc('month', now())),
          'sent_7d',     count(*) filter (where p.connection_sent_at >= now() - interval '7 days'),
          'sent_1d',     count(*) filter (where p.connection_sent_at >= now() - interval '1 day'),
          'accepted',    count(*) filter (where p.connected_at is not null),
          'accept_rate', case when count(*) filter (where p.connection_sent_at is not null) > 0
                              then round((count(*) filter (where p.connected_at is not null))::numeric
                                   / (count(*) filter (where p.connection_sent_at is not null)), 4) end,
          'dm1',         count(*) filter (where coalesce(p.dm_count, 0) >= 1),
          'dm2',         count(*) filter (where coalesce(p.dm_count, 0) >= 2),
          'replied',     count(*) filter (where coalesce(p.reply_count, 0) > 0),
          'reply_rate',  case when count(*) filter (where coalesce(p.dm_count, 0) >= 1) > 0
                              then round((count(*) filter (where coalesce(p.reply_count, 0) > 0))::numeric
                                   / (count(*) filter (where coalesce(p.dm_count, 0) >= 1)), 4) end,
          'needs_reply', count(*) filter (where coalesce(p.needs_manual_reply, false)),
          'last_send_at', greatest(max(p.connection_sent_at), max(p.last_dm_sent_at))
        )
        from outreach_prospects p where p.campaign_id = c.id
      )
    ) as x
    from outreach_campaigns c
    where ((p_client_id is null and c.client_id is null) or c.client_id = p_client_id)
      and coalesce(c.archived, false) = false
  ) s;
  return jsonb_build_object('ok', true, 'lanes', coalesce(v_lanes, '[]'::jsonb));
end;
$fn$;
