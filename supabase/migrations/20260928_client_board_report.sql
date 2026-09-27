-- client_board_report: the read behind the board's report period (Home + Results).
--
-- NOT APPLIED. Written 2026-09-28 for the stage 1 board build (branch board-stage1-home-results).
-- The board reads it as progressive enhancement: until this is applied the RPC 404s and the
-- report shows only what the existing board payload already carries (calls booked + posts).
--
-- One person set per client, every definition from the v3 DATA-MAP files
-- (/tmp/rise-mock/v3/DATA-MAP.md, /tmp/arch-mock/v3/DATA-MAP.md). The page cuts periods itself
-- (RISE: report months on the 17th, PT days; ARCH: Mon-Sun weeks and calendar months,
-- Zagreb days), so everything here is raw timestamps and never a pre-cut count.
--
-- Payload (`report`):
--   client      'risedtc' | 'arch'
--   start_date  the first day that counts (RISE 2026-07-21, ARCH 2026-08-31)
--   people[]    one row per person: n name, c company, out first outbound, conn connected_at,
--               w[] reply timestamps, y[] interested-reply timestamps, bk call_booked_at.
--               RISE carries the FIRST reply / first positive only (its rule is "first reply
--               in the period"); ARCH carries every reply (its rule is "any reply in the period").
--   came[]      people who came to the client on their own: name, company, title, via, at.
--               via = asked | viewed | engaged | hand | messaged
--   engaged[]   one row per (post, person) reaction or comment: p post key, k hashed person key
--               (distinct counts only, never an identity), at first seen,
--               fit (a classifier said this person fits the buyer), checked (a label exists),
--               new (no outreach relationship when they engaged)
--   posts[]     p post key, at published_at, title (client_post_metrics, since the start)
--   assists[]   p post key, at booked_at: a call booked after the person engaged with that post
--   updated_at  newest row time the payload read
--
-- Existing clients of the seat and their teams (the client guard's lists) are removed from
-- every part of the payload: people, engagement, came to you.
--
-- Security: SECURITY DEFINER, token (or session) checked against client_boards exactly like
-- client_board_audience; the client id comes from client_boards.client_id, never the slug.

create or replace function public._client_board_report_payload(p_client_id text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
with
cfg as (
  select p_client_id as cid,
         case p_client_id when 'risedtc' then date '2026-07-21' when 'arch' then date '2026-08-31' end as start_date
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
  select m.prospect_id, m.direction, m.reply_intent,
         coalesce(m.sent_at, case when m.direction = 'inbound' then m.created_at end) as t,
         coalesce(m.is_reaction, false) as is_reaction
    from outreach_messages m
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
            or (p_client_id = 'arch' and reply_intent in ('positive','soft_yes','info_ask','booking','price_ask')))) as yeses,
         -- a reply classified as a vendor pitch hides the person (a booked call always overrides this)
         bool_or(direction = 'inbound' and reply_intent = 'vendor_pitch') as vendor_only
    from msg group by prospect_id
),
base as (
  select pr.*, agg.first_out, agg.ins, agg.yeses,
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
arch_people as (
  select b.url_key,
         (array_agg(b.name order by b.created_at))[1] as name,
         (array_agg(nullif(b.company, '') order by b.created_at) filter (where nullif(b.company, '') is not null))[1] as company,
         min(b.first_out) as first_out,
         min(b.connected_at) as connected_at,
         min(b.call_booked_at) as call_booked_at
    from base b
   where p_client_id = 'arch' and not b.is_operator
   group by b.url_key
   having not bool_or(b.is_client)
),
people as (
  select jsonb_build_object('n', name, 'c', company, 'out', coalesce(first_out, connection_sent_at),
           'conn', connected_at, 'w', case when w1 is null then '[]'::jsonb else jsonb_build_array(w1) end,
           'y', case when yeses is null then '[]'::jsonb else jsonb_build_array(yeses[1]) end,
           'bk', call_booked_at) as j
    from rise_people
  union all
  select jsonb_build_object('n', name, 'c', company, 'out', first_out, 'conn', connected_at,
           'w', coalesce(to_jsonb(ai.ins), '[]'::jsonb), 'y', coalesce(to_jsonb(ay.yeses), '[]'::jsonb),
           'bk', call_booked_at)
    from arch_people ap
    left join arch_ins ai on ai.url_key = ap.url_key
    left join arch_yes ay on ay.url_key = ap.url_key
    cross join cfg
   where first_out is not null
     and first_out >= cfg.start_date   -- outreach first sent before the start is not the client's result
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
where p_client_id in ('risedtc', 'arch');
$$;

create or replace function public.client_board_report(p_slug text, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare v_board public.client_boards%rowtype;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if coalesce(btrim(v_board.client_id), '') not in ('risedtc', 'arch') then
    return jsonb_build_object('ok', true, 'report', null);
  end if;
  return jsonb_build_object('ok', true, 'report', public._client_board_report_payload(btrim(v_board.client_id)));
end;
$$;

create or replace function public.client_board_report_v2(p_slug text, p_session text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
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
  if coalesce(btrim(v_board.client_id), '') not in ('risedtc', 'arch') then
    return jsonb_build_object('ok', true, 'report', null);
  end if;
  return jsonb_build_object('ok', true, 'report', public._client_board_report_payload(btrim(v_board.client_id)));
end;
$$;

revoke all on function public._client_board_report_payload(text) from public, anon, authenticated;
grant execute on function public.client_board_report(text, text) to anon, authenticated;
grant execute on function public.client_board_report_v2(text, text) to anon, authenticated;
