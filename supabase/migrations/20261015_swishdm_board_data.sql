-- SwishDM board data sources (2026-10-15). Applied live through the management API on 2026-10-15.
-- Opens the report payload, report cache, outreach log, status and usage to SwishDM. RISE and ARCH
-- outputs were proven byte-identical old vs new in one snapshot before and after replacement.
-- Backups of every replaced function: ~/.claude/backups/swishdm-board-data-2026-10-15/

-- SwishDM board data sources (2026-10-15). New functions only; the RISE and ARCH ones are untouched.
-- His source campaigns are every non-archived swishdm campaign except Follow-up (the
-- before/after-the-call lane), matching _client_board_report_payload.

CREATE OR REPLACE FUNCTION public._swishdm_outreach_log()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  select coalesce(jsonb_agg(x order by (x->>'last_activity') desc nulls last), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'prospect_id',    p.id,
      'name',           p.name,
      'company',        p.company,
      'lane',           c.name,
      'reply_count',    coalesce(p.reply_count, 0),
      'replied',        coalesce(p.reply_count, 0) > 0,
      'last_sent_at',   p.last_dm_sent_at,
      'last_reply_at',  p.last_reply_at,
      'connection_sent_at', p.connection_sent_at,
      'connected_at',       p.connected_at,
      'last_activity',  greatest(coalesce(p.last_dm_sent_at, 'epoch'::timestamptz),
                                 coalesce(p.last_reply_at,   'epoch'::timestamptz)),
      'messages', (
        select jsonb_agg(jsonb_build_object(
                 'direction', mm.direction,
                 'channel',   mm.channel,
                 'type',      mm.message_type,
                 'sent_at',   mm.sent_at,
                 'text',      mm.message_text
               ) order by mm.sent_at)
        from outreach_messages mm
        where mm.prospect_id = p.id
          and mm.direction in ('outbound','inbound')
          and mm.sent_at is not null
      )
    ) as x
    from outreach_prospects p
    join outreach_campaigns c on c.id = p.campaign_id
    where c.client_id = 'swishdm' and coalesce(c.archived, false) = false
      and c.name not ilike '%follow-up%'
      and exists (
        select 1 from outreach_messages m2
        where m2.prospect_id = p.id and m2.direction = 'outbound' and m2.sent_at is not null
      )
  ) s;
$function$;

-- Live state only. No send cap and no queue are configured for SwishDM, so daily_cap is null and
-- up_next stays empty (his first list is approved with him, never previewed from the queue).
-- Live = his outreach switch is on AND one of his source campaigns is active.
CREATE OR REPLACE FUNCTION public._swishdm_outreach_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_enabled boolean;
  v_any_active boolean;
  v_campaigns jsonb;
  v_today_sends int;
  v_day_start timestamptz := (date_trunc('day', now() at time zone 'America/Los_Angeles')) at time zone 'America/Los_Angeles';
begin
  select coalesce(value = 'true', false) into v_enabled from integration_config where key = 'swishdm_outreach_enabled';
  select coalesce(bool_or(coalesce(c.is_active, false)), false),
         coalesce(jsonb_agg(jsonb_build_object('key', c.id::text, 'name', c.name, 'active', coalesce(c.is_active, false)) order by c.name), '[]'::jsonb)
    into v_any_active, v_campaigns
    from outreach_campaigns c
   where c.client_id = 'swishdm' and coalesce(c.archived, false) = false and c.name not ilike '%follow-up%';
  select count(*) into v_today_sends
    from outreach_engagement_log e
    join outreach_prospects p on p.id = e.prospect_id
    join outreach_campaigns c on c.id = p.campaign_id
   where c.client_id = 'swishdm' and c.name not ilike '%follow-up%'
     and e.action_type = 'connection_request' and e.success and e.created_at >= v_day_start;
  return jsonb_build_object(
    'is_live', coalesce(v_enabled, false) and coalesce(v_any_active, false),
    'any_active', coalesce(v_any_active, false),
    'dispatch_scheduled', false,
    'campaigns', v_campaigns,
    'todays_sends', coalesce(v_today_sends, 0),
    'daily_cap', null,
    'next_window_at', null,
    'up_next', '[]'::jsonb
  );
end;
$function$;

-- This month's sends. No caps are configured for SwishDM, so the caps are null.
CREATE OR REPLACE FUNCTION public._swishdm_outreach_usage()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_month timestamptz := date_trunc('month', now());
  v_inmail int; v_dm int; v_connect int;
begin
  select count(*) filter (where m.message_type = 'inmail'), count(*) filter (where m.message_type = 'dm')
    into v_inmail, v_dm
    from outreach_messages m
    join outreach_prospects p on p.id = m.prospect_id
    join outreach_campaigns c on c.id = p.campaign_id
   where c.client_id = 'swishdm' and c.name not ilike '%follow-up%'
     and m.direction = 'outbound' and m.sent_at >= v_month;
  select count(*) into v_connect
    from outreach_engagement_log e
    join outreach_prospects p on p.id = e.prospect_id
    join outreach_campaigns c on c.id = p.campaign_id
   where c.client_id = 'swishdm' and c.name not ilike '%follow-up%'
     and e.action_type = 'connection_request' and e.success and e.created_at >= v_month;
  return jsonb_build_object(
    'inmail_used', coalesce(v_inmail, 0), 'inmail_cap', null, 'inmail_remaining', null,
    'dm_sent', coalesce(v_dm, 0),
    'connect_sent', coalesce(v_connect, 0), 'connect_cap', null
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public._client_board_report_payload(p_client_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
with
cfg as (
  select p_client_id as cid,
         case p_client_id when 'risedtc' then date '2026-07-21' when 'arch' then date '2026-08-31'
           -- SwishDM (2026-10-15): no agreed start date on file, so the program starts on the first
           -- thing that actually happened for him: his first outreach send or his first post.
           when 'swishdm' then least(
             (select min(m.sent_at)::date from outreach_messages m
                join outreach_prospects p on p.id = m.prospect_id
                join outreach_campaigns c on c.id = p.campaign_id
               where c.client_id = 'swishdm' and c.name not ilike '%follow-up%'
                 and m.direction = 'outbound' and m.sent_at is not null),
             (select min(published_at)::date from client_post_metrics where client_id = 'swishdm')) end as start_date
),
-- The seat's existing clients and their teams: never a prospect, never "came to you", never
-- counted anywhere on a client surface. Same lists the client guard reads
-- (_client_guard_core: rise_do_not_target; arch_company_exclusions client + own-company
-- entries with their aliases; arch_person_exclusions own employees), matched on domain,
-- company, headline text and LinkedIn slug.
roster as (
  select 'd'::text as kind, lower(btrim(x)) as key
    from jsonb_array_elements_text(coalesce((select value::jsonb from integration_config where key = 'rise_do_not_target'), '[]'::jsonb)) x
   where p_client_id = 'risedtc' and position('.' in x) > 0
  union
  select 'n', regexp_replace(lower(x), '[^a-z0-9]', '', 'g')
    from jsonb_array_elements_text(coalesce((select value::jsonb from integration_config where key = 'rise_do_not_target'), '[]'::jsonb)) x
   where p_client_id = 'risedtc' and position('.' in x) = 0 and length(regexp_replace(lower(x), '[^a-z0-9]', '', 'g')) >= 4
  union
  select 'n', regexp_replace(lower(nm), '[^a-z0-9]', '', 'g')
    from jsonb_array_elements(coalesce((select value::jsonb->'companies' from integration_config where key = 'arch_company_exclusions'), '[]'::jsonb)) e
   cross join lateral (select e->>'name' union all select e->>'slug' union all select jsonb_array_elements_text(coalesce(e->'aliases', '[]'::jsonb))) a(nm)
   where p_client_id = 'arch' and (coalesce(e->>'reason', '') ilike 'arch_client%' or e->>'reason' = 'arch_own_company')
     and length(regexp_replace(lower(nm), '[^a-z0-9]', '', 'g')) >= 4
  union
  select 'd', lower(btrim(nm))
    from jsonb_array_elements(coalesce((select value::jsonb->'companies' from integration_config where key = 'arch_company_exclusions'), '[]'::jsonb)) e
   cross join lateral jsonb_array_elements_text(coalesce(e->'aliases', '[]'::jsonb)) a(nm)
   where p_client_id = 'arch' and (coalesce(e->>'reason', '') ilike 'arch_client%' or e->>'reason' = 'arch_own_company') and position('.' in nm) > 0
  union
  select 'p', lower(e->>'slug')
    from jsonb_array_elements(coalesce((select value::jsonb->'people' from integration_config where key = 'arch_person_exclusions'), '[]'::jsonb)) e
   where p_client_id = 'arch' and e->>'reason' = 'arch_own_employee'
),
camps as (
  select c.id, c.name from outreach_campaigns c, cfg
   where c.client_id = cfg.cid
     -- ARCH: the Inbound Request campaign is vendors pitching Davorin, left out of every count.
     and not (cfg.cid = 'arch' and c.name ilike '%inbound request%')
),
pr as (
  select p.*, cm.name as camp,
         -- one ARCH person = one normalised LinkedIn URL
         regexp_replace(regexp_replace(lower(coalesce(p.linkedin_url, p.id::text)), '\?.*$', ''), '/+$', '') as url_key
    from outreach_prospects p join camps cm on cm.id = p.campaign_id
),
msg as (
  -- 2026-10-12: an inbound EMAIL reply has no reply_intent (both live classifiers skip email on
  -- purpose, because reply_intent feeds drafting and bumps). Its verdict comes from the panel-only
  -- table outreach_email_reply_intent (n8n NJNZoLL41rnH0rSU), which nothing else reads.
  select m.prospect_id, m.direction,
         coalesce(m.reply_intent, case when m.direction = 'inbound' and m.channel = 'email' then ei.intent end) as reply_intent,
         coalesce(m.sent_at, case when m.direction = 'inbound' then m.created_at end) as t,
         coalesce(m.is_reaction, false) as is_reaction
    from outreach_messages m
    left join outreach_email_reply_intent ei on ei.message_id = m.id
   where m.prospect_id in (select id from pr)
),
agg as (
  select prospect_id,
         min(t) filter (where direction = 'outbound' and t is not null) as first_out,
         -- RISE drops emoji reactions; ARCH counts them (its DATA-MAP rule)
         array_agg(t order by t) filter (where direction = 'inbound' and t is not null
                                          and (p_client_id = 'arch' or not is_reaction)) as ins,
         array_agg(t order by t) filter (where direction = 'inbound' and t is not null and (
            (p_client_id = 'risedtc' and reply_intent = 'positive' and not is_reaction)
            or (p_client_id = 'arch' and reply_intent in ('positive','soft_yes','info_ask','booking','price_ask'))
            -- SwishDM: yes = agreed to the comparison walk-through or a call (his "Interested reply"
            -- step); a question about details or price is a reply, not yet a yes.
            or (p_client_id = 'swishdm' and reply_intent in ('positive','soft_yes','booking') and not is_reaction))) as yeses,
         -- a reply classified as a vendor pitch hides the person (a booked call always overrides this)
         bool_or(direction = 'inbound' and reply_intent = 'vendor_pitch') as vendor_only,
         -- latest classified reply: the Pipeline's "interested now" reads this
         (array_agg(reply_intent order by t desc) filter (where direction = 'inbound' and reply_intent is not null and not is_reaction))[1] as last_intent,
         -- 2026-10-12: the intent of the person's LATEST written reply on any channel (email
         -- included), NULL when that reply is unclassified. "Interested" reads this, so an older
         -- yes never outlives a later reply nobody has classified (Emma Farrow, 8 Oct email).
         (array_agg(reply_intent order by t desc) filter (where direction = 'inbound' and t is not null and not is_reaction))[1] as last_written_intent
    from msg group by prospect_id
),
base as (
  select pr.*, agg.first_out, agg.ins, agg.yeses, agg.last_intent, agg.last_written_intent,
         (coalesce(agg.vendor_only, false) and pr.call_booked_at is null) as vendor_pitch,
         -- the operator's own profile (flagged in the audience labels) is never a prospect result
         exists (select 1 from audn_person_label_v o where o.is_operator and o.person_key = pr.linkedin_profile_id) as is_operator,
         exists (select 1 from roster r where
            (r.kind = 'd' and (r.key = _bk_host(pr.company_domain) or r.key = _bk_email_domain(pr.email)
                               or position(r.key in lower(coalesce(coalesce(pr.headline, '') || ' ' || coalesce(pr.title, ''), ''))) > 0))
         or (r.kind = 'n' and (position(r.key in regexp_replace(lower(coalesce(pr.company, '')), '[^a-z0-9]', '', 'g')) > 0
                               or position(r.key in regexp_replace(lower(coalesce(coalesce(pr.headline, '') || ' ' || coalesce(pr.title, ''), '')), '[^a-z0-9]', '', 'g')) > 0))
         or (r.kind = 'p' and r.key = li_slug(pr.linkedin_url))) as is_client
    from pr left join agg on agg.prospect_id = pr.id
),
-- RISE: de-duplicate by name|company keeping the most advanced row; closed non-buyers out.
rise_people as (
  select * from (
    select b.*,
           coalesce(b.ins[1], case when coalesce(b.reply_count, 0) > 0 then b.last_reply_at end) as w1,
           row_number() over (
             partition by lower(btrim(coalesce(b.name, ''))) || '|' || lower(btrim(coalesce(b.company, '')))
             order by (b.call_booked_at is not null) desc,
                      (b.ins is not null or coalesce(b.reply_count, 0) > 0) desc,
                      (b.connected_at is not null) desc,
                      (b.connection_sent_at is not null) desc,
                      b.created_at) as rn
      from base b
     where p_client_id = 'risedtc'
  ) x
  where rn = 1
    and (connection_sent_at is not null or connected_at is not null or w1 is not null or call_booked_at is not null)
    and coalesce(stage, '') <> 'disqualified'
    and not (coalesce(stage, '') = 'archived'
             and (coalesce(skip_reason, '') || ' ' || coalesce(skip_state_reason, '')) ~* 'phishing|duplicate|vendor|employee_title_regate|thread_deleted')
    and not vendor_pitch
    and not is_operator
    and not is_client
    and (nullif(btrim(coalesce(title, '')), '') is not null or nullif(btrim(coalesce(headline, '')), '') is not null)
),
-- ARCH: one person per LinkedIn URL, merged across campaigns; reached = an outbound message.
arch_ins as (
  select b.url_key, array_agg(distinct t order by t) as ins
    from base b, unnest(b.ins) t where p_client_id = 'arch' group by b.url_key
),
arch_yes as (
  select b.url_key, array_agg(distinct t order by t) as yeses
    from base b, unnest(b.yeses) t where p_client_id = 'arch' group by b.url_key
),
arch_last as (
  select distinct on (b.url_key) b.url_key, m.reply_intent
    from base b join msg m on m.prospect_id = b.id
   where p_client_id = 'arch' and m.direction = 'inbound' and m.t is not null and not m.is_reaction
   order by b.url_key, m.t desc
),
arch_people as (
  select b.url_key,
         (array_agg(b.name order by b.created_at))[1] as name,
         (array_agg(nullif(b.company, '') order by b.created_at) filter (where nullif(b.company, '') is not null))[1] as company,
         min(b.first_out) as first_out,
         min(b.connected_at) as connected_at,
         min(b.call_booked_at) as call_booked_at,
         (array_agg(b.enrichment_data order by b.created_at))[1] as ed,
         (array_agg(b.last_intent order by b.created_at desc) filter (where b.last_intent is not null))[1] as last_intent,
         (array_agg(coalesce(nullif(btrim(b.title), ''), nullif(btrim(b.headline), '')) order by b.created_at)
            filter (where coalesce(nullif(btrim(b.title), ''), nullif(btrim(b.headline), '')) is not null))[1] as role
    from base b
   where p_client_id = 'arch' and not b.is_operator
   group by b.url_key
   having not bool_or(b.is_client)
),
-- SwishDM (2026-10-15): one person per name + company across his three source campaigns (the
-- same LinkedIn person arrives under two URL formats, so the URL alone splits them; RISE's key).
-- Follow-up is the before/after-the-call lane, not a source. Out: disqualified, vendor pitches,
-- spam/duplicate closes, operators, and anyone matching the client roster (empty until his
-- exclusion baseline is loaded). Blacklisted stays in: a booking blacklists the person.
swish_base as (
  select b.*, coalesce(nullif(lower(btrim(coalesce(b.name, ''))) || '|' || lower(btrim(coalesce(b.company, ''))), '|'), b.url_key) as pkey
    from base b
   where p_client_id = 'swishdm'
     and b.camp not ilike '%follow-up%'
     and coalesce(b.stage, '') <> 'disqualified'
     and not (coalesce(b.stage, '') = 'archived'
              and (coalesce(b.skip_reason, '') || ' ' || coalesce(b.skip_state_reason, '')) ~* 'phishing|duplicate|vendor|thread_deleted')
     and not b.vendor_pitch and not b.is_operator and not b.is_client
),
swish_people as (
  select b.pkey,
         (array_agg(b.name order by b.created_at))[1] as name,
         (array_agg(nullif(b.company, '') order by b.created_at) filter (where nullif(b.company, '') is not null))[1] as company,
         (array_agg(b.camp order by b.created_at))[1] as camp,
         (array_agg(coalesce(b.headline, '') || ' ' || coalesce(b.title, '') order by b.created_at))[1] as hl,
         (array_agg(coalesce(nullif(btrim(b.title), ''), nullif(btrim(b.headline), '')) order by b.created_at)
            filter (where coalesce(nullif(btrim(b.title), ''), nullif(btrim(b.headline), '')) is not null))[1] as role,
         min(b.first_out) as first_out, min(b.connection_sent_at) as conn_sent,
         min(b.connected_at) as connected_at, min(b.call_booked_at) as call_booked_at,
         max(b.last_reply_at) filter (where coalesce(b.reply_count, 0) > 0) as last_reply_at
    from swish_base b group by b.pkey
),
swish_ins as (
  select b.pkey, array_agg(distinct t order by t) as ins from swish_base b, unnest(b.ins) t group by b.pkey
),
swish_yes as (
  select b.pkey, array_agg(distinct t order by t) as yeses from swish_base b, unnest(b.yeses) t group by b.pkey
),
swish_last as (
  select distinct on (b.pkey) b.pkey, m.reply_intent
    from swish_base b join msg m on m.prospect_id = b.id
   where m.direction = 'inbound' and m.t is not null and not m.is_reaction
   order by b.pkey, m.t desc
),
people as (
  select jsonb_build_object('n', name, 'c', company, 'out', coalesce(first_out, connection_sent_at),
           'conn', connected_at, 'w', case when w1 is null then '[]'::jsonb else jsonb_build_array(w1) end,
           'y', case when yeses is null then '[]'::jsonb else jsonb_build_array(yeses[1]) end,
           'bk', call_booked_at,
           -- Pipeline lines (v3 DATA-MAP s1). The headline is read first: title is a lane label.
           'l', case
             when coalesce(headline, '') || ' ' || coalesce(title, '') ~* '\m(co-?founder|founder|ceo|chief executive|owner|president|managing director)\M' then 'owner'
             when coalesce(headline, '') || ' ' || coalesce(title, '') ~* '(\mcmo\M|chief marketing|head of (growth|marketing|e-?commerce|digital|brand|performance)|\mvp,? (of )?(marketing|growth)|marketing (director|manager)|director of marketing|growth lead|fractional cmo)' then 'marketing'
             when camp ilike '%fractional cmo%' then 'marketing'
             else 'owner' end,
           'v', case
             when camp ilike '%competitor engager%' then 'engaged'
             when camp ilike '%cold%' then 'search'
             when camp ilike '%inbound request%' then 'asked'
             when camp ilike '%profile view%' then 'viewed'
             when camp ilike '%client orbit%' then 'orbit'
             when camp ilike '%company expansion%' then 'expansion'
             when camp ilike '%fractional cmo%' then 'fcmo'
             when camp ilike '%network activation%' then 'network'
             else 'other' end,
           'cat', coalesce(
             case when enrichment_data->'store_bucket'->>'bucket' is not null
                   and coalesce(enrichment_data->'store_bucket'->>'judge', '') <> 'regex-fallback'
                  then enrichment_data->'store_bucket'->>'bucket' end,
             (select v from unnest(array[enrichment_data->'store_recon_v2'->>'category', enrichment_data->'revenue_signal'->>'category',
                                         enrichment_data->'icp_category'->>'category', enrichment_data->>'vertical']) v
               where nullif(lower(btrim(v)), '') is not null and lower(btrim(v)) not in ('other', 'unclassified', 'unknown') limit 1)),
           'li', last_written_intent,
           'lr', coalesce(ins[array_length(ins, 1)], last_reply_at))
         -- 2026-10-12 period views: every reply and every yes (w and y keep the first only),
         -- and the role of anyone who wrote back. Only added when there is something to add.
         || case when array_length(ins, 1) > 1 then jsonb_build_object('wa', to_jsonb(ins)) else '{}'::jsonb end
         || case when array_length(yeses, 1) > 1 then jsonb_build_object('ya', to_jsonb(yeses)) else '{}'::jsonb end
         || case when w1 is not null and coalesce(nullif(btrim(title), ''), nullif(btrim(headline), '')) is not null
                 then jsonb_build_object('t', left(coalesce(nullif(btrim(title), ''), btrim(headline)), 90)) else '{}'::jsonb end as j
    from rise_people
  union all
  select jsonb_build_object('n', name, 'c', company, 'out', first_out, 'conn', connected_at,
           'w', coalesce(to_jsonb(ai.ins), '[]'::jsonb), 'y', coalesce(to_jsonb(ay.yeses), '[]'::jsonb),
           'bk', call_booked_at,
           -- company group and how we found them, raw keys the page maps to plain words (ARCH DATA-MAP)
           'gv', (select v from unnest(array[ed->>'copy_vertical', ed->>'company_vertical', ed->'gate'->>'vertical', ed->>'vertical']) v
                   where nullif(lower(btrim(v)), '') is not null and lower(btrim(v)) not in ('unknown', 'none') limit 1),
           'sk', ed->>'source_kind', 'ln', ed->>'lane', 'src', ed->>'source',
           'li', al.reply_intent,
           'lr', ai.ins[array_length(ai.ins, 1)])
         || case when ai.ins is not null and ap.role is not null then jsonb_build_object('t', left(ap.role, 90)) else '{}'::jsonb end
    from arch_people ap
    left join arch_ins ai on ai.url_key = ap.url_key
    left join arch_last al on al.url_key = ap.url_key
    left join arch_yes ay on ay.url_key = ap.url_key
    cross join cfg
   where first_out is not null
     and first_out >= cfg.start_date   -- outreach first sent before the start is not the client's result
  union all
  -- SwishDM: the RISE shape (l = buyer role, v = how we found them), his own groups. His buyer is
  -- "a founder, CEO or CMO who can buy"; anyone else reads as another role, never as an owner.
  -- Someone counts once we sent them something, wrote back, or booked (RISE's rule).
  select jsonb_build_object('n', sp.name, 'c', sp.company, 'out', coalesce(sp.first_out, sp.conn_sent),
           'conn', sp.connected_at,
           'w', case when coalesce(si.ins[1], sp.last_reply_at) is null then '[]'::jsonb else jsonb_build_array(coalesce(si.ins[1], sp.last_reply_at)) end,
           'y', case when sy.yeses is null then '[]'::jsonb else jsonb_build_array(sy.yeses[1]) end,
           'bk', sp.call_booked_at,
           'l', case
             when sp.hl ~* '\m(co-?founder|founder|ceo|chief executive|owner|president|managing director)\M' then 'owner'
             when sp.hl ~* '(\mcmo\M|chief marketing|head of (growth|marketing|e-?commerce|digital|brand|performance)|\mvp,? (of )?(marketing|growth)|marketing (director|manager)|director of marketing|growth lead)' then 'marketing'
             else 'other' end,
           'v', case
             when sp.camp ilike '%own engagers%' then 'own'
             when sp.camp ilike '%anchor engagers%' then 'engaged'
             when sp.camp ilike '%store signals%' then 'signals'
             else 'other' end,
           'li', sl.reply_intent,
           'lr', coalesce(si.ins[array_length(si.ins, 1)], sp.last_reply_at))
         || case when array_length(si.ins, 1) > 1 then jsonb_build_object('wa', to_jsonb(si.ins)) else '{}'::jsonb end
         || case when array_length(sy.yeses, 1) > 1 then jsonb_build_object('ya', to_jsonb(sy.yeses)) else '{}'::jsonb end
         || case when coalesce(si.ins[1], sp.last_reply_at) is not null and sp.role is not null
                 then jsonb_build_object('t', left(sp.role, 90)) else '{}'::jsonb end
    from swish_people sp
    left join swish_ins si on si.pkey = sp.pkey
    left join swish_yes sy on sy.pkey = sp.pkey
    left join swish_last sl on sl.pkey = sp.pkey
   where coalesce(sp.first_out, sp.conn_sent) is not null
      or coalesce(si.ins[1], sp.last_reply_at) is not null
      or sp.call_booked_at is not null
),
-- Post engagement, one row per (post, person). Operators (the client's own team) are out.
labels as (
  select l.person_key, l.label, coalesce(l.is_operator, false) as op, coalesce(l.is_excluded, false) as ex
    from audn_person_label_v l where l.client_id = p_client_id
),
rel as (
  select r.person_key, r.state, coalesce(r.is_operator, false) as op
    from audn_relationship_v r where r.client_id = p_client_id
),
asof as (
  select a.person_key, bool_or(a.state_asof_touch like 'existing_prospect_stage:%'
                               and a.state_asof_touch not like '%ballot_hold%') as known_at_touch
    from audn_relationship_asof_touch_v a where a.client_id = p_client_id group by a.person_key
),
ev as (
  select e.post_social_id as p, e.person_key as k, min(e.first_observed_at) as at,
         (array_agg(e.sources[1] order by e.first_observed_at))[1] as src
    from audn_interaction_events_v e where e.client_id = p_client_id
   group by e.post_social_id, e.person_key
),
ev_named as (
  select ev.*, coalesce(pe.name, ce.name) as pe_name, coalesce(pe.headline, ce.headline) as pe_headline, pe.prospect_id as pe_prospect,
         coalesce(pe.icp_score, ce.icp_score) as pe_score
    from ev
    left join post_engagers pe
      on pe.id = case when ev.src like 'post_engagers:%' then nullif(substring(ev.src from '^post_engagers:(.*)$'), '')::uuid end
    left join client_post_engagers ce
      on ce.id = case when ev.src like 'client_post_engagers:%' then nullif(substring(ev.src from '^client_post_engagers:(.*)$'), '')::uuid end
),
ev_full as (
  select en.*, l.label, coalesce(l.op, r.op, false) as op, coalesce(l.ex, false) as ex,
         case when p_client_id = 'arch' then not coalesce(a.known_at_touch, false)
              else coalesce(r.state, 'unknown') = 'unknown' end as is_new,
         p.company as pr_company, p.enrichment_data->>'icp_tier' as tier, p.enrichment_data->>'person_role' as prole,
         exists (select 1 from roster r where
            (r.kind = 'd' and (r.key = _bk_host(p.company_domain) or r.key = _bk_email_domain(p.email)
                               or position(r.key in lower(coalesce(en.pe_headline, ''))) > 0))
         or (r.kind = 'n' and (position(r.key in regexp_replace(lower(coalesce(p.company, '')), '[^a-z0-9]', '', 'g')) > 0
                               or position(r.key in regexp_replace(lower(coalesce(en.pe_headline, '')), '[^a-z0-9]', '', 'g')) > 0))
         or (r.kind = 'p' and r.key = li_slug(coalesce(p.linkedin_url, '')))) as is_client
    from ev_named en
    left join labels l on l.person_key = en.k
    left join rel r on r.person_key = en.k
    left join asof a on a.person_key = en.k
    left join outreach_prospects p on p.id = en.pe_prospect
),
ev_fit as (
  select ev_full.*,
         (label = 'positive' and not ex
          -- the engager row's own fit score must agree when there is one (7 is the same bar the
          -- inbound-request judge uses); a positive label over a score of 1-5 is not a buyer
          and (pe_score is null or pe_score >= 7)
          -- ARCH hand-reviewed rule (27 Sep): a vendor/supplier tier, or no current company on
          -- record (prospect company, else "@ Company" / " at Company" in the headline), is out.
          and (p_client_id <> 'arch' or (
                coalesce(tier, '') not in ('supply_or_vendor', 'supplier_or_vendor')
            and coalesce(prole, '') not in ('supplier', 'non_buyer', 'external_operator')
            and coalesce(nullif(btrim(pr_company), ''), substring(coalesce(pe_headline, '') from '(?:@| at )\s*([^|,·]+)')) is not null))) as fit
    from ev_full
   where not op and not is_client
),
engaged as (
  select jsonb_build_object('p', p, 'k', md5(k), 'at', at, 'fit', fit, 'checked', coalesce(label, 'unknown') <> 'unknown', 'new', is_new) as j
    from ev_fit, cfg where at >= cfg.start_date
),
-- Who came to the client on their own.
came_rows as (
  -- RISE (a) asked to connect, (b) viewed the profile: rows the lane kept (non-fits are skipped)
  select b.name, b.company, coalesce(nullif(b.title, ''), b.headline) as title,
         case when b.camp ilike '%inbound request%' then 'asked' else 'viewed' end as via,
         b.created_at as at, 'p:' || b.id::text as dedupe
    from base b
   where p_client_id = 'risedtc'
     and (b.camp ilike '%inbound request%' or b.camp ilike '%profile view%')
     and coalesce(b.stage, '') not in ('skipped', 'disqualified', 'archived', 'inbound_personal')
     and (coalesce(b.skip_reason, '') || ' ' || coalesce(b.skip_state_reason, '')) !~* 'not_icp|vendor|phishing|duplicate|thread_deleted|regate'
     and not b.vendor_pitch
     and not b.is_operator
     and not b.is_client
     -- a positive brand-owner verdict is required: the request/profile-view judge's score
     -- (enrichment_data.judge_score, else icp_score) at the lane's bar of 7. No verdict = not counted.
     and coalesce(nullif(b.enrichment_data->>'judge_score', '')::numeric, b.icp_score) >= 7
  union all
  -- both: a buyer-fit person who engaged with a post while new to us
  select pe_name, coalesce(nullif(pr_company, ''), substring(coalesce(pe_headline, '') from '(?:@| at )\s*([^|,·]+)')),
         pe_headline, 'engaged', min(at), 'k:' || k
    from ev_fit where fit and is_new
   group by k, pe_name, pr_company, pe_headline
  union all
  -- ARCH: viewed the profile, organic (not touched by outreach first) and judged a fit
  select v.viewer_name, p.company, v.viewer_headline, 'viewed', v.viewed_at, 'k:' || coalesce(v.viewer_provider_id, v.viewer_public_id)
    from profile_view_log v left join outreach_prospects p on p.id = v.prospect_id
   where p_client_id = 'arch' and v.seat = 'arch' and v.provenance = 'organic_icp' and v.icp_pass is true
     and not exists (select 1 from roster r where
            (r.kind = 'd' and (r.key = _bk_host(p.company_domain) or r.key = _bk_email_domain(p.email)
                               or position(r.key in lower(coalesce(v.viewer_headline, ''))) > 0))
         or (r.kind = 'n' and (position(r.key in regexp_replace(lower(coalesce(p.company, '')), '[^a-z0-9]', '', 'g')) > 0
                               or position(r.key in regexp_replace(lower(coalesce(v.viewer_headline, '')), '[^a-z0-9]', '', 'g')) > 0))
         or (r.kind = 'p' and r.key = li_slug(coalesce(p.linkedin_url, ''))))
     and coalesce(p.stage, '') <> 'disqualified'
     and coalesce(p.enrichment_data->>'icp_tier', '') not in ('supply_or_vendor', 'supplier_or_vendor')
     and coalesce(p.enrichment_data->>'person_role', '') not in ('supplier', 'non_buyer', 'external_operator')
     and nullif(btrim(coalesce(p.company, '')), '') is not null
  union all
  -- ARCH: raised a hand on a post, a buyer by tier
  select b.name, b.company, coalesce(nullif(b.title, ''), b.headline), 'hand',
         coalesce((b.enrichment_data->>'sourced_at')::timestamptz, b.created_at), 'u:' || b.url_key
    from base b
   where p_client_id = 'arch' and b.enrichment_data->>'source_kind' = 'hand_raise' and not b.is_client
     and b.enrichment_data->>'icp_tier' in ('buyer', 'budget_adjacent')
     and coalesce(b.enrichment_data->>'person_role', '') not in ('supplier', 'non_buyer', 'external_operator')
     and coalesce(b.stage, '') <> 'disqualified'
     and nullif(btrim(coalesce(b.company, '')), '') is not null
  union all
  -- ARCH: messaged first, triaged a buyer, and the surfaced prospect is not disqualified
  select t.who, p.company, coalesce(nullif(p.title, ''), p.headline), 'messaged', t.decided_at, 'p:' || p.id::text
    from inbound_triage_log t join outreach_prospects p on p.id = t.surfaced_prospect_id
   where p_client_id = 'arch' and t.client_id = 'arch' and t.verdict = 'buyer'
     and not exists (select 1 from roster r where
            (r.kind = 'd' and (r.key = _bk_host(p.company_domain) or r.key = _bk_email_domain(p.email)
                               or position(r.key in lower(coalesce(coalesce(p.headline, '') || ' ' || coalesce(t.who, ''), ''))) > 0))
         or (r.kind = 'n' and (position(r.key in regexp_replace(lower(coalesce(p.company, '')), '[^a-z0-9]', '', 'g')) > 0
                               or position(r.key in regexp_replace(lower(coalesce(coalesce(p.headline, '') || ' ' || coalesce(t.who, ''), '')), '[^a-z0-9]', '', 'g')) > 0))
         or (r.kind = 'p' and r.key = li_slug(p.linkedin_url)))
     and coalesce(p.stage, '') <> 'disqualified'
     and coalesce(p.enrichment_data->>'icp_tier', '') not in ('supply_or_vendor', 'supplier_or_vendor')
     and nullif(btrim(coalesce(p.company, '')), '') is not null
),
came as (
  select jsonb_build_object('name', name, 'company', company, 'title', title, 'via', via, 'at', at) as j
    from (
      select distinct on (lower(btrim(coalesce(name, dedupe)))) *
        from came_rows, cfg
       where at >= cfg.start_date
       order by lower(btrim(coalesce(name, dedupe))), at
    ) d
),
posts as (
  select jsonb_build_object('p', audn_canonical_post_key(m.client_id, m.social_id), 'at', m.published_at, 'title', m.title) as j
    from client_post_metrics m, cfg
   where m.client_id = cfg.cid and m.published_at >= cfg.start_date
),
assists as (
  select jsonb_build_object('p', a.post_social_id, 'at', o.booked_at) as j
    from audn_outcome_assists_v a join audn_outcomes_v o on o.client_id = a.client_id and o.outcome_id = a.outcome_id
   where a.client_id = p_client_id
)
select jsonb_build_object(
  'client', p_client_id,
  'start_date', (select start_date from cfg),
  'people',  coalesce((select jsonb_agg(j) from people), '[]'::jsonb),
  'came',    coalesce((select jsonb_agg(j order by j->>'at') from came), '[]'::jsonb),
  'engaged', coalesce((select jsonb_agg(j) from engaged), '[]'::jsonb),
  'posts',   coalesce((select jsonb_agg(j order by j->>'at') from posts), '[]'::jsonb),
  'assists', coalesce((select jsonb_agg(j) from assists), '[]'::jsonb),
  'updated_at', now()
)
where p_client_id in ('risedtc', 'arch', 'swishdm');
$function$
;

CREATE OR REPLACE FUNCTION public.client_board_report(p_slug text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_board public.client_boards%rowtype;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if coalesce(btrim(v_board.client_id), '') not in ('risedtc', 'arch', 'swishdm') then
    return jsonb_build_object('ok', true, 'report', null);
  end if;
  return jsonb_build_object('ok', true, 'report', (select c.payload from public.client_board_report_cache c where c.client_id = btrim(v_board.client_id)));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.client_board_report_v2(p_slug text, p_session text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_board public.client_boards%rowtype;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  perform 1 from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if coalesce(btrim(v_board.client_id), '') not in ('risedtc', 'arch', 'swishdm') then
    return jsonb_build_object('ok', true, 'report', null);
  end if;
  return jsonb_build_object('ok', true, 'report', (select c.payload from public.client_board_report_cache c where c.client_id = btrim(v_board.client_id)));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.refresh_client_board_report_cache()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare c text;
begin
  foreach c in array array['risedtc', 'arch', 'swishdm'] loop
    insert into public.client_board_report_cache (client_id, payload, built_at)
    values (c, public._client_board_report_payload(c), now())
    on conflict (client_id) do update set payload = excluded.payload, built_at = excluded.built_at;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.client_board_outreach_log(p_slug text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_board public.client_boards%rowtype;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_slug = 'risedtc-com' then
    return jsonb_build_object('ok', true, 'log', public._risedtc_outreach_log());
  elsif p_slug = 'arch-agency' then
    return jsonb_build_object('ok', true, 'log', public._arch_outreach_log());
  elsif p_slug = 'swishdm-live' then
    return jsonb_build_object('ok', true, 'log', public._swishdm_outreach_log());
  end if;
  return jsonb_build_object('ok', true, 'log', '[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.client_board_outreach_log_v2(p_slug text, p_session text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_board public.client_boards%rowtype;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  perform 1 from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_slug = 'risedtc-com' then
    return jsonb_build_object('ok', true, 'log', public._risedtc_outreach_log());
  elsif p_slug = 'arch-agency' then
    return jsonb_build_object('ok', true, 'log', public._arch_outreach_log());
  elsif p_slug = 'swishdm-live' then
    return jsonb_build_object('ok', true, 'log', public._swishdm_outreach_log());
  end if;
  return jsonb_build_object('ok', true, 'log', '[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.client_board_outreach_status(p_slug text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_board public.client_boards%rowtype;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_slug = 'swishdm-live' then
    return jsonb_build_object('ok', true, 'status', public._swishdm_outreach_status());
  end if;
  if p_slug <> 'risedtc-com' then
    return jsonb_build_object('ok', true, 'status', null);
  end if;
  return jsonb_build_object('ok', true, 'status', public._risedtc_outreach_status());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.client_board_outreach_status_v2(p_slug text, p_session text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_board public.client_boards%rowtype;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  perform 1 from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_slug = 'swishdm-live' then
    return jsonb_build_object('ok', true, 'status', public._swishdm_outreach_status());
  end if;
  if p_slug <> 'risedtc-com' then
    return jsonb_build_object('ok', true, 'status', null);
  end if;
  return jsonb_build_object('ok', true, 'status', public._risedtc_outreach_status());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.client_board_outreach_usage(p_slug text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_board public.client_boards%rowtype;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_slug = 'swishdm-live' then
    return jsonb_build_object('ok', true, 'usage', public._swishdm_outreach_usage());
  end if;
  if p_slug <> 'risedtc-com' then
    return jsonb_build_object('ok', true, 'usage', null);
  end if;
  return jsonb_build_object('ok', true, 'usage', public._risedtc_outreach_usage());
end;
$function$
;

CREATE OR REPLACE FUNCTION public.client_board_outreach_usage_v2(p_slug text, p_session text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_hash text; v_board public.client_boards%rowtype;
begin
  if coalesce(p_session, '') = '' then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  v_hash := encode(digest(p_session, 'sha256'), 'hex');
  perform 1 from public.client_board_sessions
   where slug = p_slug and token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  update public.client_board_sessions set last_seen_at = now() where slug = p_slug and token_hash = v_hash;
  select * into v_board from public.client_boards
   where slug = p_slug and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_slug = 'swishdm-live' then
    return jsonb_build_object('ok', true, 'usage', public._swishdm_outreach_usage());
  end if;
  if p_slug <> 'risedtc-com' then
    return jsonb_build_object('ok', true, 'usage', null);
  end if;
  return jsonb_build_object('ok', true, 'usage', public._risedtc_outreach_usage());
end;
$function$
;
