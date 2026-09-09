-- ============================================================================
-- Audience-learning client experience — 08 / recommendation → published post.
-- goal-run audience-learning-03-client-experience-2026-09-09, adapters seat.
-- Worklist: W14 (recommendation identity + decision record, NO NEW TABLE), D3.
--
-- Depends on: 20260910_audn_01 (audn_cutoff, audn_urn_digits) and
--             20260910_audn_03 (audn_post_identity_v).
-- Reads, when they exist: client_ideas, client_board_actions, carousel_drafts,
--             scheduled_posts, lm_idea_candidates, lm_idea_review_decisions.
-- WRITES NOTHING. There is no insert, update, delete or DDL on any source table
-- anywhere in this file.
--
-- WHY A FUNCTION AND NOT A PLAIN VIEW.
-- A CREATE VIEW binds every table it names at creation time, so a plain view
-- would refuse to install anywhere one of the six optional source tables is
-- absent — including the board seat's PGlite harness, which mocks four board
-- tables and not the idea/publish chain. The body below is PL/pgSQL, so each
-- table is probed with to_regclass at CALL time and a missing one degrades to a
-- stated 'unknown' instead of taking migration 07's board payload down with it.
-- This is the same defensive posture 07 already uses to call THIS view.
--
-- D3 IDENTITY. A recommendation is not a new row type. It is a row in the
-- client's existing idea store:
--   clients -> client_ideas  source_label 'Audience review',
--                            source_ref   'audn-rec:<uuid>',
--                            meta.audn    {recommendation_id, ...}
--   Ivan    -> lm_idea_candidates  source 'audience_review',
--                            source_ref   'audn-rec:<uuid>',
--                            raw_context  carrying the same object
--
-- recommendation_id IS THE BARE UUID, not the prefixed source_ref. CONTRACTS D3
-- writes the two separately (`source_ref = 'audn-rec:<uuid>'` and
-- `meta.audn = {recommendation_id, ...}`), and migration 07 keys its link
-- lookup on `coalesce(meta->'audn'->>'recommendation_id',
-- replace(source_ref,'audn-rec:',''))`. Emitting the prefixed form here would
-- silently miss every join in 07 and leave the board on 'unknown' forever, so
-- the bare id is the key and the prefixed form is carried beside it as
-- recommendation_ref.
--
-- LINK STATE. The ladder is recommended -> idea -> drafted -> published.
--   published   a published post resolves at the end of the chain
--   drafted     a draft row exists for the idea, no published post resolves
--   idea        the idea row exists, no draft
--   recommended a decision is on record for a ref that has NO idea row (an
--               orphan: the idea was deleted, or the decision arrived first)
--   unknown     the chain cannot be evaluated because one of its tables is
--               absent. Reported rather than guessed: with only part of the
--               chain readable, a recommendation that is in fact PUBLISHED
--               reads as 'idea', and a state that can be wrong in the
--               optimistic direction is worse than an admitted unknown.
--
-- THE CLIENT PUBLISH CHAIN IS carousel_drafts -> scheduled_posts.
-- carousel_drafts has no social-id column (checked against R1
-- inventory/schemas.json: 45 columns, none of them a published social id).
-- The real link is the one 'Scheduled Post Publisher' (0Ym6bP7gEmskPJZn) writes:
-- the kickoff inserts the draft, the publisher stores the draft id in
-- scheduled_posts.clickup_task_id and stamps unipile_social_id on the row when
-- the post goes live. So: client_ideas.id -> carousel_drafts.client_idea_id ->
-- carousel_drafts.id::text = scheduled_posts.clickup_task_id ->
-- scheduled_posts.unipile_social_id -> audn_post_identity_v.post_social_id,
-- matched on audn_urn_digits() so an activity/ugcPost/share spelling difference
-- cannot break the join.
--
-- Ivan has a shorter path that does not need the publisher at all:
-- ivan_post_outcome_spine already carries lm_idea_candidate_id, which
-- audn_post_identity_v exposes as idea_id. That is tried first and the draft
-- chain is the fallback.
--
-- DECISIONS. Clients: the LATEST client_board_actions row for the ref with an
-- action in (audn_accept, audn_reject, audn_defer), scoped to the same client.
-- Ivan: the LATEST lm_idea_review_decisions row for the candidate
-- (approve -> accepted, reject -> rejected, defer -> deferred); with no decision
-- row and status 'reviewing', the candidate is deferred by existing state and
-- decision_source says so rather than pretending a row exists. A decision is
-- never inferred from client_ideas.status or from anything downstream.
--
-- CUTOFF. Every read is bounded by audn_cutoff(), so a fixture replay is
-- reproducible and a row written after the frozen cutoff is invisible.
-- ============================================================================

create or replace function public.audn_recommendation_links()
returns table (
  client_id                text,
  recommendation_id        text,
  recommendation_ref       text,
  idea_table               text,
  idea_id                  uuid,
  idea_status              text,
  draft_id                 uuid,
  published_post_social_id text,
  link_state               text,
  decision                 text,
  decision_reason          text,
  decided_at               timestamptz,
  decision_source          text
)
language plpgsql
stable
set search_path to 'public'
as $fn$
declare
  v_cutoff    timestamptz := public.audn_cutoff();
  v_ideas     boolean := to_regclass('public.client_ideas')            is not null;
  v_actions   boolean := to_regclass('public.client_board_actions')    is not null;
  v_drafts    boolean := to_regclass('public.carousel_drafts')         is not null;
  v_sched     boolean := to_regclass('public.scheduled_posts')         is not null;
  v_lm        boolean := to_regclass('public.lm_idea_candidates')      is not null;
  v_lmdec     boolean := to_regclass('public.lm_idea_review_decisions') is not null;
  -- the client chain is readable only END TO END: idea -> draft -> published
  v_chain     boolean := v_drafts and v_sched;
begin
  -- ------------------------------------------------------------------ clients
  if v_ideas then
    return query execute format($q$
      with idea as (
        select ci.client_id::text                                        as client_id,
               coalesce(nullif(ci.meta -> 'audn' ->> 'recommendation_id', ''),
                        replace(ci.source_ref, 'audn-rec:', ''))         as rec_id,
               ci.source_ref::text                                       as rec_ref,
               ci.id                                                     as idea_id,
               ci.status::text                                           as idea_status
          from public.client_ideas ci
         where ci.source_ref like 'audn-rec:%%'
           and coalesce(ci.client_id, '') <> ''
           and (ci.created_at is null or ci.created_at <= %1$L::timestamptz)
      ),
      drafted as (
        select i.*, %2$s as draft_id from idea i
      ),
      pub as (
        select d.*, %3$s as published_post_social_id from drafted d
      )
      select p.client_id,
             p.rec_id,
             p.rec_ref,
             'client_ideas'::text,
             p.idea_id,
             p.idea_status,
             p.draft_id,
             p.published_post_social_id,
             case
               when not %4$L::boolean                       then 'unknown'
               when p.published_post_social_id is not null  then 'published'
               when p.draft_id is not null                  then 'drafted'
               else 'idea'
             end::text,
             dec.state, dec.reason, dec.decided_at, dec.src
        from pub p
        left join lateral %5$s dec on true
    $q$,
      v_cutoff,
      case when v_drafts then
        $s$(select cd.id
              from public.carousel_drafts cd
             where cd.client_idea_id = i.idea_id
             order by cd.scheduled_at desc nulls last, cd.id
             limit 1)$s$
      else 'null::uuid' end,
      case when v_chain then
        $s$(select pi.post_social_id
              from public.scheduled_posts sp
              join public.audn_post_identity_v pi
                on pi.client_id = d.client_id
               and public.audn_urn_digits(pi.post_social_id)
                 = public.audn_urn_digits(sp.unipile_social_id)
             where d.draft_id is not null
               and sp.clickup_task_id = d.draft_id::text
               and sp.unipile_social_id is not null
             order by pi.published_at desc nulls last, pi.post_social_id
             limit 1)$s$
      else 'null::text' end,
      v_chain,
      case when v_actions then
        format($s$(select case a.action
                            when 'audn_accept' then 'accepted'
                            when 'audn_reject' then 'rejected'
                            when 'audn_defer'  then 'deferred'
                          end::text                       as state,
                          a.payload ->> 'reason'          as reason,
                          a.created_at                    as decided_at,
                          'client_board_actions'::text    as src
                     from public.client_board_actions a
                    where a.ref = p.rec_ref
                      and a.client_id = p.client_id
                      and a.action in ('audn_accept','audn_reject','audn_defer')
                      and a.created_at <= %1$L::timestamptz
                    order by a.created_at desc
                    limit 1)$s$, v_cutoff)
      else '(select null::text as state, null::text as reason,
                    null::timestamptz as decided_at, null::text as src)' end
    );
  end if;

  -- --------------------------------------------- orphan decisions (clients)
  -- A decision on record whose idea row does not exist. Never dropped: a
  -- recorded client answer that points at nothing is exactly the thing an
  -- audit needs to see, so it surfaces at the bottom of the ladder.
  if v_actions then
    return query execute format($q$
      with latest as (
        select distinct on (a.client_id, a.ref)
               a.client_id::text as client_id, a.ref::text as ref,
               a.action, a.payload, a.created_at
          from public.client_board_actions a
         where a.ref like 'audn-rec:%%'
           and coalesce(a.client_id, '') <> ''
           and a.action in ('audn_accept','audn_reject','audn_defer')
           and a.created_at <= %1$L::timestamptz
         order by a.client_id, a.ref, a.created_at desc
      )
      select l.client_id,
             replace(l.ref, 'audn-rec:', ''),
             l.ref,
             null::text, null::uuid, null::text, null::uuid, null::text,
             %2$L::text,
             case l.action
               when 'audn_accept' then 'accepted'
               when 'audn_reject' then 'rejected'
               when 'audn_defer'  then 'deferred'
             end::text,
             l.payload ->> 'reason',
             l.created_at,
             'client_board_actions'::text
        from latest l
       where %3$s
    $q$,
      v_cutoff,
      case when v_ideas then 'recommended' else 'unknown' end,
      case when v_ideas then
        $s$not exists (select 1 from public.client_ideas ci
                        where ci.source_ref = l.ref and ci.client_id = l.client_id)$s$
      else 'true' end
    );
  end if;

  -- --------------------------------------------------------------------- Ivan
  if v_lm then
    return query execute format($q$
      with cand as (
        select 'ivan'::text                                              as client_id,
               coalesce(nullif(lic.source_ref, ''), '')                  as rec_ref,
               replace(coalesce(lic.source_ref, ''), 'audn-rec:', '')    as rec_id,
               lic.id                                                    as idea_id,
               lic.status::text                                          as idea_status,
               lic.promoted_draft_id                                     as draft_id
          from public.lm_idea_candidates lic
         where lic.source = 'audience_review'
           and lic.source_ref like 'audn-rec:%%'
           and (lic.created_at is null or lic.created_at <= %1$L::timestamptz)
      ),
      pub as (
        select c.*,
               coalesce(
                 (select pi.post_social_id
                    from public.audn_post_identity_v pi
                   where pi.client_id = 'ivan' and pi.idea_id = c.idea_id
                   order by pi.published_at desc nulls last, pi.post_social_id
                   limit 1),
                 %2$s
               ) as published_post_social_id
          from cand c
      )
      select p.client_id, p.rec_id, p.rec_ref,
             'lm_idea_candidates'::text, p.idea_id, p.idea_status, p.draft_id,
             p.published_post_social_id,
             case
               when p.published_post_social_id is not null then 'published'
               when p.draft_id is not null                 then 'drafted'
               else 'idea'
             end::text,
             coalesce(dec.state, case when p.idea_status = 'reviewing' then 'deferred' end)::text,
             dec.reason,
             dec.decided_at,
             coalesce(dec.src,
                      case when p.idea_status = 'reviewing'
                           then 'lm_idea_candidates.status' end)::text
        from pub p
        left join lateral %3$s dec on true
    $q$,
      v_cutoff,
      case when v_sched then
        $s$(select pi2.post_social_id
              from public.scheduled_posts sp
              join public.audn_post_identity_v pi2
                on pi2.client_id = 'ivan'
               and public.audn_urn_digits(pi2.post_social_id)
                 = public.audn_urn_digits(sp.unipile_social_id)
             where c.draft_id is not null
               and sp.clickup_task_id = c.draft_id::text
               and sp.unipile_social_id is not null
             order by pi2.published_at desc nulls last, pi2.post_social_id
             limit 1)$s$
      else 'null::text' end,
      case when v_lmdec then
        format($s$(select case lower(d.decision)
                            when 'approve' then 'accepted'
                            when 'reject'  then 'rejected'
                            when 'defer'   then 'deferred'
                          end::text                              as state,
                          d.reason                               as reason,
                          d.decided_at                           as decided_at,
                          'lm_idea_review_decisions'::text       as src
                     from public.lm_idea_review_decisions d
                    where d.candidate_id = p.idea_id
                      and d.decided_at <= %1$L::timestamptz
                    order by d.decided_at desc
                    limit 1)$s$, v_cutoff)
      else '(select null::text as state, null::text as reason,
                    null::timestamptz as decided_at, null::text as src)' end
    );
  end if;

  return;
end;
$fn$;

comment on function public.audn_recommendation_links() is
  'One row per audience-learning recommendation (D3): the client_ideas / lm_idea_candidates row that IS the recommendation, the draft it became, the published post it reached, and the decision on record. PL/pgSQL so each optional source table is probed with to_regclass at call time; a chain that cannot be read end to end reports link_state unknown instead of an optimistic guess. Reads only; writes nothing.';

-- ---------------------------------------------------------------------------
-- The query contract Run 03 consumers (and migration 07) name.
-- security_invoker = true: the caller's RLS decides what they see, exactly as
-- every Run 02 view does. A security-definer read here would hand any role that
-- can select the view every client's recommendations.
-- ---------------------------------------------------------------------------
create or replace view public.audn_recommendation_links_v
with (security_invoker = true) as
select client_id, recommendation_id, recommendation_ref, idea_table, idea_id,
       idea_status, draft_id, published_post_social_id, link_state,
       decision, decision_reason, decided_at, decision_source
  from public.audn_recommendation_links();

comment on view public.audn_recommendation_links_v is
  'recommendation -> idea -> draft -> published post, with the decision on record. Grain: one row per recommendation per client. recommendation_id is the BARE uuid (the key migration 07 joins on); recommendation_ref carries the audn-rec: prefixed source_ref. link_state in (recommended, idea, drafted, published, unknown).';
