-- ============================================================================
-- Audience-learning 10 / recommendation publish (approval in the middle).
-- goal-run audience-learning-06-recommendation-writer-2026-09-11, orchestrator.
-- Run 06 CONTRACTS §2.2 (B2..B5). NOT applied anywhere by this run.
--
-- The weekly writer PROPOSES into ops_drafts (kind 'audn_recommendation').
-- Ivan approves in ivan-inbox › Strategy. This RPC is the ONLY path from a
-- proposal to the client's idea store, where migration 07's board payload reads
-- it (D3: client_ideas source_ref 'audn-rec:<uuid>' / lm_idea_candidates
-- source 'audience_review'). It writes exactly one idea row, stamps the
-- proposal, and is idempotent on the proposal id.
--
-- DDL on ops_drafts: the kind CHECK (ivan-inbox db/046) gains
-- 'audn_recommendation' and that kind joins the null-channel list. Nothing else
-- about the table changes. No new table.
-- ============================================================================

alter table public.ops_drafts drop constraint if exists ops_drafts_kind_check;
alter table public.ops_drafts add constraint ops_drafts_kind_check
  check (kind = any (array[
    'escalation'::text, 'update'::text, 'newsjack'::text, 'weekly_report'::text,
    'comment_reply'::text, 'comment_outbound'::text, 'booking'::text,
    'precall_email'::text, 'manual_invite'::text, 'task'::text,
    'leads_ballot'::text, 'audn_recommendation'::text]));

alter table public.ops_drafts drop constraint if exists ops_drafts_slack_channel_required;
alter table public.ops_drafts add constraint ops_drafts_slack_channel_required
  check ((kind = any (array[
    'newsjack'::text, 'weekly_report'::text, 'comment_reply'::text,
    'comment_outbound'::text, 'precall_email'::text, 'manual_invite'::text,
    'task'::text, 'leads_ballot'::text, 'audn_recommendation'::text]))
    or slack_channel is not null);

create or replace function public.audn_recommendation_publish(
  p_client_id text, p_proposal_id uuid, p_text_overrides jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_row      public.ops_drafts%rowtype;
  v_ref      text;
  v_a        jsonb;
  v_ov       jsonb := '{}'::jsonb;
  v_k        text;
  v_v        text;
  v_title    text;
  v_id       uuid;
  v_table    text;
  v_now      timestamptz := now();
begin
  if coalesce(btrim(p_client_id), '') = '' or p_proposal_id is null then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  v_ref := 'audn-rec:' || p_proposal_id::text;

  select * into v_row from public.ops_drafts
   where id = p_proposal_id and client_id = p_client_id and kind = 'audn_recommendation';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- ---- idempotent on the proposal id -------------------------------------
  if p_client_id = 'ivan' then
    v_table := 'lm_idea_candidates';
    select id into v_id from public.lm_idea_candidates
     where source = 'audience_review' and source_ref = v_ref limit 1;
  else
    v_table := 'client_ideas';
    perform 1 from public.client_registry where client_id = p_client_id;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'unknown_client');
    end if;
    select id into v_id from public.client_ideas
     where client_id = p_client_id and source_ref = v_ref limit 1;
  end if;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'already', true, 'table', v_table, 'id', v_id, 'ref', v_ref);
  end if;

  -- ---- the audn object, with the operator's text overrides ---------------
  v_a := coalesce(v_row.context -> 'audn', '{}'::jsonb);
  if jsonb_typeof(v_a) <> 'object' then v_a := '{}'::jsonb; end if;
  for v_k in select unnest(array['what_changed', 'why_it_matters', 'could_publish', 'proof_needed', 'title']) loop
    if p_text_overrides is not null and jsonb_typeof(p_text_overrides -> v_k) = 'string' then
      v_v := btrim(p_text_overrides ->> v_k);
      if length(v_v) between 1 and 2000 then
        v_a := v_a || jsonb_build_object(v_k, v_v);
        v_ov := v_ov || jsonb_build_object(v_k, v_v);
      end if;
    end if;
  end loop;
  if coalesce(v_a ->> 'what_changed', '') = '' then
    return jsonb_build_object('ok', false, 'error', 'no_text');
  end if;
  v_a := v_a || jsonb_build_object(
    'recommendation_id', p_proposal_id::text,
    'buyer_rationale',   coalesce(v_a ->> 'why_it_matters', ''),
    'what_to_publish',   coalesce(v_a ->> 'could_publish', ''),
    'source_ids',        coalesce(v_a -> 'evidence' -> 'source_ids',   '[]'::jsonb),
    'source_dates',      coalesce(v_a -> 'evidence' -> 'source_dates', '[]'::jsonb),
    'sample_n',          coalesce(v_a -> 'evidence' -> 'sample_n',     'null'::jsonb),
    'unknowns',          coalesce(v_a -> 'evidence' -> 'unknowns',     'null'::jsonb),
    'reviewed_at',       to_jsonb(v_now),
    'proposal_id',       p_proposal_id::text,
    'prompt',            coalesce(v_row.context ->> 'prompt', ''),
    'source_rows',       coalesce(v_row.context -> 'source_rows', '[]'::jsonb));
  v_title := left(coalesce(nullif(v_a ->> 'title', ''), v_a ->> 'what_changed'), 80);

  -- ---- exactly one idea row ------------------------------------------------
  if p_client_id = 'ivan' then
    v_id := gen_random_uuid();
    insert into public.lm_idea_candidates
      (id, source, source_ref, status, raw_topic, normalized_topic, raw_context,
       evidence, content_type, ingested_at, created_at)
    values
      (v_id, 'audience_review', v_ref, 'pending',
       v_a ->> 'what_changed', coalesce(v_a ->> 'could_publish', v_a ->> 'what_changed'),
       v_a::text, coalesce(v_row.context -> 'source_rows', '[]'::jsonb), 'post', v_now, v_now);
  else
    v_id := gen_random_uuid();
    insert into public.client_ideas
      (id, client_id, hook, title, source_label, source_ref, pillar, format, status,
       idea, created_at, meta)
    values
      (v_id, p_client_id, v_a ->> 'what_changed', v_title, 'Audience review', v_ref,
       nullif(v_a ->> 'pillar', ''), nullif(v_a ->> 'format', ''), 'staged',
       v_a, v_now, jsonb_build_object('audn', v_a));
  end if;

  -- ---- stamp the proposal (published = approved + sent into the store) ----
  update public.ops_drafts
     set approved_at = v_now,
         sent_at     = v_now,
         context     = coalesce(context, '{}'::jsonb) || jsonb_build_object('published',
                         jsonb_build_object('table', v_table, 'id', v_id, 'ref', v_ref,
                                            'at', v_now, 'overrides', v_ov))
   where id = p_proposal_id;

  return jsonb_build_object('ok', true, 'already', false, 'table', v_table, 'id', v_id, 'ref', v_ref);
end;
$fn$;

comment on function public.audn_recommendation_publish(text, uuid, jsonb) is
  'Run 06: Ivan''s approve of an audience recommendation proposal (ops_drafts kind audn_recommendation). Writes ONE idea row (client_ideas / lm_idea_candidates, D3 shape), stamps the proposal, idempotent on the proposal id. Called from ivan-inbox as authenticated.';

revoke all on function public.audn_recommendation_publish(text, uuid, jsonb) from public, anon;
grant execute on function public.audn_recommendation_publish(text, uuid, jsonb) to authenticated, service_role;
