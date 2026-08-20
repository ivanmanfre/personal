-- 2026-08-20 — Mattan's hand-typed replies state facts that rise-company-facts does not carry
-- ("No minimums on spend. We partner with brands starting with 5-10k a month.", 2026-08-20).
-- The exemplar corpus takes them as STYLE and forbids using them as fact, so the brain never
-- learned them. This table is the fact store: machine-extracted, human-approved, never written
-- to content_prompts by a machine.
--
-- RECENCY PRIORITY (Ivan, 2026-08-20): "most recent manual replies from Mattan should take
-- knowledge priority". Enforced by `topic`: active_learned_facts returns distinct on (topic)
-- ordered by source_sent_at desc, and approving supersedes older approved facts on that topic.

create table if not exists public.learned_facts (
  id                   uuid primary key default gen_random_uuid(),
  client_id            text not null,
  topic                text not null,
  fact_text            text not null,
  status               text not null default 'pending',
  source_message_id    uuid unique references public.outreach_messages(id) on delete set null,
  source_prospect_id   uuid references public.outreach_prospects(id) on delete set null,
  source_prospect_name text,
  source_question      text,
  source_quote         text not null,
  source_sent_at       timestamptz not null,
  superseded_by        uuid references public.learned_facts(id) on delete set null,
  resolved_at          timestamptz,
  resolved_by          text,
  created_at           timestamptz not null default now(),
  constraint learned_facts_status_ck
    check (status in ('pending','approved','rejected','superseded'))
);

create index if not exists learned_facts_active_idx
  on public.learned_facts (client_id, status, source_sent_at desc);

alter table public.learned_facts enable row level security;

drop policy if exists learned_facts_service_all on public.learned_facts;
create policy learned_facts_service_all on public.learned_facts
  for all to service_role using (true) with check (true);

drop policy if exists learned_facts_authenticated_all on public.learned_facts;
create policy learned_facts_authenticated_all on public.learned_facts
  for all to authenticated using (true) with check (true);

-- What the drafter injects. distinct on (topic) IS the recency rule: for any topic only Mattan's
-- newest approved statement reaches the model.
create or replace function public.active_learned_facts(p_client_id text)
returns table (
  id                   uuid,
  topic                text,
  fact_text            text,
  source_prospect_name text,
  source_message_id    uuid,
  source_sent_at       timestamptz
)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select distinct on (f.topic)
    f.id, f.topic, f.fact_text, f.source_prospect_name, f.source_message_id, f.source_sent_at
  from public.learned_facts f
  where f.client_id = p_client_id and f.status = 'approved'
  order by f.topic, f.source_sent_at desc;
$$;

grant execute on function public.active_learned_facts(text) to service_role, authenticated;

-- Operator read: pending candidates first, then the approved shelf so Ivan can see what the
-- brain currently believes and retire a line that has gone stale.
create or replace function public.operator_learned_facts(p_gate text, p_client_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
declare v jsonb;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;

  select jsonb_agg(x order by (x->>'status') = 'pending' desc, (x->>'source_sent_at') desc)
    into v
  from (
    select jsonb_build_object(
      'id',             f.id,
      'topic',          f.topic,
      'fact_text',      f.fact_text,
      'status',         f.status,
      'prospect_name',  f.source_prospect_name,
      'question',       f.source_question,
      'quote',          f.source_quote,
      'source_sent_at', f.source_sent_at,
      'chat_url',       p.linkedin_url
    ) as x
    from public.learned_facts f
    left join public.outreach_prospects p on p.id = f.source_prospect_id
    where f.client_id = p_client_id
      and f.status in ('pending','approved')
    order by f.source_sent_at desc
    limit 30
  ) s;

  return jsonb_build_object('ok', true, 'facts', coalesce(v, '[]'::jsonb));
end;
$function$;

grant execute on function public.operator_learned_facts(text, text) to authenticated;

-- Operator write. p_decision: 'approve' | 'reject' | 'retire'. p_text optionally replaces the
-- extracted wording on approve, so Ivan can tighten a line without retyping the provenance.
create or replace function public.operator_resolve_learned_fact(
  p_gate text, p_fact_id uuid, p_decision text, p_text text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'extensions'
as $function$
declare f public.learned_facts%rowtype;
begin
  if not operator_gate_ok(p_gate) then
    return jsonb_build_object('ok', false, 'error', 'bad_gate');
  end if;
  if p_decision not in ('approve','reject','retire') then
    return jsonb_build_object('ok', false, 'error', 'bad_decision');
  end if;

  select * into f from public.learned_facts where id = p_fact_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_decision = 'reject' then
    update public.learned_facts
       set status = 'rejected', resolved_at = now(), resolved_by = 'operator'
     where id = p_fact_id;
    return jsonb_build_object('ok', true, 'note', 'Rejected. It will not reach the drafter.');
  end if;

  if p_decision = 'retire' then
    update public.learned_facts
       set status = 'superseded', resolved_at = now(), resolved_by = 'operator'
     where id = p_fact_id;
    return jsonb_build_object('ok', true, 'note', 'Retired from the drafter.');
  end if;

  -- approve: the newest statement on a topic wins, so older approved rows on that topic retire.
  update public.learned_facts
     set status = 'superseded', superseded_by = p_fact_id, resolved_at = now(),
         resolved_by = 'recency'
   where client_id = f.client_id
     and topic = f.topic
     and status = 'approved'
     and id <> p_fact_id
     and source_sent_at <= f.source_sent_at;

  update public.learned_facts
     set status = 'approved',
         fact_text = coalesce(nullif(btrim(p_text), ''), fact_text),
         resolved_at = now(), resolved_by = 'operator'
   where id = p_fact_id;

  return jsonb_build_object('ok', true, 'note', 'Approved. The drafter uses it from the next run.');
end;
$function$;

grant execute on function public.operator_resolve_learned_fact(text, uuid, text, text) to authenticated;

-- What the drafter actually injected into this draft. Deterministic input log, NOT a model
-- self-report: a model asked "which sources did you use" confabulates; logging the inputs cannot.
alter table public.outreach_messages
  add column if not exists draft_evidence jsonb;

comment on column public.outreach_messages.draft_evidence is
  'Inputs the drafter injected for this draft (facts row version, learned facts, exemplar pairs, store fact, anchor, scan finding, voice row versions). Rendered as the Evidence collapsible in Client Ops.';
CREATE OR REPLACE FUNCTION public.operator_client_pending_drafts(p_gate text, p_client_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
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
      -- Answerability gate: advisory only. Present => the drafter answered something RISE FACTS
      -- does not cover, so the card shows a warning band and an optional Ask Mattan button.
      'context_gap',   m.context_gap,
      -- Deterministic log of what the drafter injected. Rendered as the Evidence collapsible.
      'draft_evidence', m.draft_evidence,
      -- The conversation to open when escalating. LinkedIn profile URL is what we hold on the row;
      -- unipile_chat_id is a Unipile id and does NOT resolve to a linkedin.com thread URL.
      'chat_url',      p.linkedin_url,
      -- So the button can read "Asked Mattan" instead of queueing a second identical card.
      'escalated',     exists (
        select 1 from ops_drafts od
        where od.kind = 'escalation'
          and od.context->>'prospect_id' = p.id::text
          and od.sent_at is null
      ),
      'inbound', (
        select jsonb_build_object('text', im.message_text,
                                  'at', coalesce(im.sent_at, im.created_at))
        from outreach_messages im
        where im.prospect_id = p.id and im.direction = 'inbound'
          and coalesce(im.is_reaction, false) = false
        order by coalesce(im.sent_at, im.created_at) desc
        limit 1
      ),
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
$function$
;
