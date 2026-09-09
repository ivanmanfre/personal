-- ============================================================================
-- Audience-learning client experience — 07 / the authorized board payload.
-- goal-run audience-learning-03-client-experience-2026-09-09, board UI seat.
-- Worklist: W15 (board section), W23 (decisions), W24 (per-post evidence),
--           W36 (recommendations), D2 (payload boundary), D4 (asset intake).
--
-- Depends on: 20260910_audn_01..06 (the Run 02 interfaces). Reads ONLY the views
-- named in Run 02's INTERFACES.md, plus four pre-existing board tables
-- (client_boards, client_board_sessions, client_ideas, client_board_actions) and
-- client_registry.platform. NOTHING HERE WRITES except the one audit row
-- client_board_audience_decide inserts into client_board_actions.
--
-- SECURITY POSTURE — copied verbatim from the sibling board read
-- 20260826_client_board_funnel_signals.sql, which is the shape every live board
-- RPC already carries:
--   * the two public wrappers are SECURITY DEFINER, `set search_path`, and gated
--     on either client_boards.token (v1, the anon + token surface) or the sha256
--     of a client_board_sessions token (v2, the signed-in surface). anon EXECUTE
--     is REQUIRED on the wrappers, because the client board is an anon surface.
--   * the inner function is NOT security definer, is revoked from public / anon /
--     authenticated, and is granted to service_role only. CREATE OR REPLACE
--     re-grants EXECUTE to PUBLIC and Supabase's default privileges hand it to
--     anon + authenticated, so the revokes at the foot of this file are load
--     bearing, not decoration.
--   * client id is resolved from client_boards.client_id of the MATCHED row. It
--     is never parsed out of the slug, and no caller may pass one (CONTRACTS §4).
--
-- FEATURE FLAG. audn_board_payload returns SQL NULL unless
-- client_registry.platform->'measurement'->'features'->>'competitor_section' is
-- exactly 'true' for that client. Until Run 04 flips a flag, every live board
-- gets `{"ok": true, "audience": null}` and the section does not render at all —
-- never a placeholder, never staged sample data (CONTRACTS §4).
--
-- NULLS STAY NULL (measurement contract rule 8). A post with no snapshot has a
-- null metric, not a zero; a post with no engager rows has null people, not
-- zero; a post outside the matched-age set is labelled observed-age and carries
-- a null rank. `excluded_operator` is a genuine count over a known set and is
-- allowed to be 0.
--
-- CUTOFF. Every read is bounded by audn_cutoff() so a fixture replay is
-- reproducible (`set audn.cutoff = '...'`); in production it is now().
-- ============================================================================

-- ---------------------------------------------------------------------------
-- audn_board_payload — the whole client-visible audience object, in the frozen
-- CONTRACTS §2.1 shape. One argument, the resolved client id.
-- ---------------------------------------------------------------------------
create or replace function public.audn_board_payload(p_client_id text)
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $fn$
declare
  v_cutoff            timestamptz := public.audn_cutoff();
  v_plat              jsonb;
  v_meas              jsonb;
  v_posts             jsonb  := '[]'::jsonb;
  v_median            jsonb  := '[]'::jsonb;
  v_recs              jsonb  := '[]'::jsonb;
  v_assets            jsonb  := '[]'::jsonb;
  v_asset_recs        jsonb  := '[]'::jsonb;   -- rec ids covered by an approved asset
  v_links             jsonb  := '{}'::jsonb;   -- recommendation_id -> link_state
  v_snapshots_as_of   timestamptz;
  v_engagers_as_of    timestamptz;
  v_reviewed_at       timestamptz;
  v_n_posts           int := 0;
  v_n_recs            int := 0;
  v_n_matched         int := 0;
  v_n_people          int := 0;
  v_n_known           int := 0;
  v_state             text;
  v_stale_after       int := 14;
begin
  if coalesce(btrim(p_client_id), '') = '' then
    return null;
  end if;

  select cr.platform into v_plat
    from public.client_registry cr
   where cr.client_id = p_client_id
   limit 1;

  if v_plat is null or jsonb_typeof(v_plat) <> 'object' then
    return null;                      -- no manifest row -> state 'unavailable'
  end if;
  v_meas := case when jsonb_typeof(v_plat -> 'measurement') = 'object'
                 then v_plat -> 'measurement' else '{}'::jsonb end;
  if coalesce(v_meas -> 'features' ->> 'competitor_section', 'false') <> 'true' then
    return null;                      -- flag off -> state 'unavailable'
  end if;

  -- ---- freshness ---------------------------------------------------------
  select max(s.captured_at) into v_snapshots_as_of
    from public.audn_post_metric_snapshots s
   where s.client_id = p_client_id and s.captured_at <= v_cutoff;

  select max(e.last_observed_at) into v_engagers_as_of
    from public.audn_interaction_events_v e
   where e.client_id = p_client_id and e.last_observed_at <= v_cutoff;

  -- ---- posts -------------------------------------------------------------
  -- One row per published post, each carrying its latest snapshot, its
  -- matched-age rank when one exists, its relevant-engager counts as PEOPLE
  -- (never events), and the number of recorded bookings it ASSISTED.
  with p as (
    select id.post_social_id, id.published_at, id.format, id.topic
      from public.audn_post_identity_v id
     where id.client_id = p_client_id
       and (id.published_at is null or id.published_at <= v_cutoff)
  ),
  snap as (
    select distinct on (s.post_social_id)
           s.post_social_id, s.captured_at,
           s.impressions, s.reactions, s.comments, s.shares
      from public.audn_snapshot_eligibility_v s
     where s.client_id = p_client_id and s.captured_at <= v_cutoff
     order by s.post_social_id, s.captured_at desc
  ),
  cov as (
    select c.post_social_id, c.status
      from public.audn_post_collection_coverage c
     where c.client_id = p_client_id
  ),
  ppl as (
    -- distinct PEOPLE per post: one person reacting and commenting is one person
    select e.post_social_id, e.person_key
      from public.audn_interaction_events_v e
     where e.client_id = p_client_id
       and e.first_observed_at <= v_cutoff
     group by 1, 2
  ),
  op as (
    select x.person_key
      from public.audn_excluded_person_v x
     where x.client_id = p_client_id and x.exclusion_kind = 'operator'
  ),
  lab as (
    select l.person_key, l.label
      from public.audn_person_label_v l
     where l.client_id = p_client_id
  ),
  engag as (
    select ppl.post_social_id,
           count(*) filter (where op.person_key is null)::int                       as people,
           count(*) filter (where op.person_key is null and lab.label = 'positive')::int   as positive,
           count(*) filter (where op.person_key is null and lab.label = 'borderline')::int as borderline,
           count(*) filter (where op.person_key is null
                              and coalesce(lab.label, 'unknown') = 'unknown')::int  as unknown_n,
           count(*) filter (where op.person_key is not null)::int                   as excluded_operator
      from ppl
      left join op  on op.person_key  = ppl.person_key
      left join lab on lab.person_key = ppl.person_key
     group by 1
  ),
  rk as (
    -- one comparison per post: the best-supported target age (largest eligible
    -- denominator), earliest age as the tie-break, so the choice is deterministic
    select distinct on (r.post_social_id)
           r.post_social_id, r.target_age_days, r.rank, r.eligible_n
      from public.audn_matched_age_rank_v r
     where r.client_id = p_client_id
     order by r.post_social_id, r.eligible_n desc, r.target_age_days asc
  ),
  ast as (
    select a.post_social_id, count(distinct a.outcome_id)::int as n
      from public.audn_outcome_assists_v a
     where a.client_id = p_client_id
     group by 1
  ),
  built as (
    select
      p.post_social_id,
      jsonb_build_object(
        'post_social_id', p.post_social_id,
        'published_at',   to_jsonb(p.published_at),
        'format',         p.format,
        'topic',          p.topic,
        'raw', jsonb_build_object(
          'impressions', snap.impressions,
          'reactions',   snap.reactions,
          'comments',    snap.comments,
          'shares',      snap.shares,
          'captured_at', to_jsonb(snap.captured_at),
          -- a coverage row is the authority; with none, a stored snapshot IS the
          -- evidence that the metric was collected, and its absence is the
          -- stated not_collected default
          'coverage', case
            when cov.status = 'collected'      then 'collected'
            when cov.status = 'not_collected'  then 'not_collected'
            when cov.status is not null        then 'unknown'
            when snap.captured_at is not null  then 'collected'
            else 'not_collected' end
        ),
        'rank', jsonb_build_object(
          'basis', case
            when rk.rank is not null          then 'matched_age'
            when snap.captured_at is not null then 'observed_age'
            else 'none' end,
          'rank',            rk.rank,
          'eligible_n',      rk.eligible_n,
          'target_age_days', rk.target_age_days
        ),
        'engagers', jsonb_build_object(
          'people',            engag.people,
          'positive',          engag.positive,
          'borderline',        engag.borderline,
          'unknown',           engag.unknown_n,
          'excluded_operator', coalesce(engag.excluded_operator, 0),
          -- a coverage row is the authority (any status other than the two
          -- payload values, e.g. 'not_eligible', reads as unknown); with no
          -- coverage row, observed people ARE the evidence of collection and
          -- their absence is the stated not_collected default
          'coverage', case
            when cov.status = 'collected'     then 'collected'
            when cov.status = 'not_collected' then 'not_collected'
            when cov.status is not null       then 'unknown'
            when engag.people is not null     then 'collected'
            else 'not_collected' end
        ),
        'assisted_outcomes', coalesce(ast.n, 0)
      ) as obj,
      (rk.rank is not null)                as matched,
      coalesce(engag.people, 0)            as n_people,
      coalesce(engag.positive, 0)
        + coalesce(engag.borderline, 0)    as n_known
    from p
    left join snap  on snap.post_social_id  = p.post_social_id
    left join cov   on cov.post_social_id   = p.post_social_id
    left join engag on engag.post_social_id = p.post_social_id
    left join rk    on rk.post_social_id    = p.post_social_id
    left join ast   on ast.post_social_id   = p.post_social_id
  )
  select coalesce(jsonb_agg(b.obj order by b.obj ->> 'published_at' desc nulls last,
                                     b.post_social_id), '[]'::jsonb),
         count(*)::int,
         count(*) filter (where b.matched)::int,
         coalesce(sum(b.n_people), 0)::int,
         coalesce(sum(b.n_known), 0)::int
    into v_posts, v_n_posts, v_n_matched, v_n_people, v_n_known
    from built b;

  -- ---- absolute monthly median trend -------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object(
           'month',            to_jsonb(m.month),
           'target_age_days',  m.target_age_days,
           'median_reactions', m.median_reactions,
           'n',                m.n,
           'basis',            m.basis) order by m.month, m.target_age_days), '[]'::jsonb)
    into v_median
    from public.audn_monthly_median_v m
   where m.client_id = p_client_id;

  -- ---- assets (D4) -------------------------------------------------------
  -- Approved and non-private ONLY. An asset awaiting approval, or one the client
  -- marked private, is never in a payload — not even as a count.
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'asset_id',        a ->> 'asset_id',
      'source',          a ->> 'source',
      'factual_context', a ->> 'factual_context',
      'confidentiality', a ->> 'confidentiality')), '[]'::jsonb),
    coalesce(jsonb_agg(coalesce(a -> 'linked_recommendation_ids', '[]'::jsonb)), '[]'::jsonb)
    into v_assets, v_asset_recs
    from jsonb_array_elements(
           case when jsonb_typeof(v_meas -> 'assets') = 'array'
                then v_meas -> 'assets' else '[]'::jsonb end) a
   where (a ->> 'usage_approval') = 'true'
     and coalesce(a ->> 'confidentiality', '') <> 'private';

  -- flatten [[id,id],[id]] -> [id,id,id]
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_asset_recs
    from jsonb_array_elements(v_asset_recs) grp
    cross join lateral jsonb_array_elements_text(
      case when jsonb_typeof(grp) = 'array' then grp else '[]'::jsonb end) as x;

  -- ---- recommendation -> published-post linkage (W14, migration 08) ------
  -- audn_recommendation_links_v belongs to the adapters seat and may not exist
  -- yet. Guarded on to_regclass AND on its own shape, so a missing or differently
  -- shaped view degrades to link_state 'unknown' instead of taking the board
  -- section down.
  if to_regclass('public.audn_recommendation_links_v') is not null then
    begin
      execute 'select coalesce(jsonb_object_agg(v.recommendation_id, v.link_state), ''{}''::jsonb)
                 from public.audn_recommendation_links_v v
                where v.client_id = $1 and v.recommendation_id is not null'
        into v_links using p_client_id;
    exception when others then
      v_links := '{}'::jsonb;
    end;
  end if;

  -- ---- recommendations (D3: no new table) --------------------------------
  -- A recommendation IS a row in the client's existing idea store, identified by
  -- source_ref 'audn-rec:<uuid>' with its evidence under meta->'audn'. Its
  -- decision is the latest client_board_actions row on the same ref. Neither
  -- client_ideas.status nor anything downstream is read as a decision.
  if to_regclass('public.client_ideas') is not null then
    with ideas as (
      select ci.source_ref,
             coalesce(ci.meta -> 'audn', '{}'::jsonb) as a,
             ci.created_at
        from public.client_ideas ci
       where ci.client_id = p_client_id
         and ci.source_ref like 'audn-rec:%'
         and ci.created_at <= v_cutoff
    ),
    dec as (
      select distinct on (act.ref)
             act.ref, act.action, act.payload, act.created_at
        from public.client_board_actions act
       where act.client_id = p_client_id
         and act.action in ('audn_accept', 'audn_reject', 'audn_defer')
         and act.ref like 'audn-rec:%'
         and act.created_at <= v_cutoff
       order by act.ref, act.created_at desc
    ),
    rec as (
      select
        coalesce(nullif(i.a ->> 'recommendation_id', ''),
                 replace(i.source_ref, 'audn-rec:', ''))                as rid,
        i.source_ref,
        i.a,
        i.created_at,
        dec.action, dec.payload, dec.created_at as decided_at
      from ideas i
      left join dec on dec.ref = i.source_ref
    )
    select coalesce(jsonb_agg(jsonb_build_object(
             'recommendation_id', r.rid,
             'what_changed',      r.a ->> 'what_changed',
             'why_it_matters',    coalesce(r.a ->> 'buyer_rationale', r.a ->> 'why_it_matters'),
             'evidence', jsonb_build_object(
               'source_ids',   coalesce(r.a -> 'source_ids',   '[]'::jsonb),
               'source_dates', coalesce(r.a -> 'source_dates', '[]'::jsonb),
               'sample_n',     (r.a -> 'sample_n'),
               'unknowns',     (r.a -> 'unknowns')
             ),
             'could_publish',  coalesce(r.a ->> 'what_to_publish', r.a ->> 'could_publish'),
             'proof_needed',   r.a ->> 'proof_needed',
             'asset_required', coalesce(r.a -> 'asset_required', 'null'::jsonb),
             'asset_state', case
               when v_asset_recs ? r.rid                                then 'approved'
               when r.a ->> 'asset_state' = 'requested'                 then 'requested'
               when jsonb_typeof(r.a -> 'asset_required') = 'boolean'
                    and (r.a ->> 'asset_required') = 'true'             then 'missing'
               when jsonb_typeof(r.a -> 'asset_required') = 'string'
                    and coalesce(r.a ->> 'asset_required', '') <> ''    then 'missing'
               else 'none' end,
             'decision', jsonb_build_object(
               'state', case r.action
                 when 'audn_accept' then 'accepted'
                 when 'audn_reject' then 'rejected'
                 when 'audn_defer'  then 'deferred'
                 else null end,
               'reason',     r.payload ->> 'reason',
               'decided_at', to_jsonb(r.decided_at)
             ),
             'link_state', coalesce(v_links ->> r.rid, 'unknown')
           ) order by r.created_at desc, r.rid), '[]'::jsonb),
           count(*)::int,
           max(nullif(r.a ->> 'reviewed_at', '')::timestamptz)
      into v_recs, v_n_recs, v_reviewed_at
      from rec r;
  end if;

  -- ---- state (CONTRACTS §2.1) --------------------------------------------
  -- Precedence, evaluated top down and recorded here because §2.1 lists the
  -- rules without one: empty, then unknown, then incomplete_history, then stale,
  -- else normal. 'unavailable' is never produced here — it is the NULL return
  -- above, which the wrapper turns into audience: null and the component renders
  -- nothing at all.
  if v_n_posts = 0 and v_n_recs = 0 then
    v_state := 'empty';
  elsif v_n_people > 0 and v_n_known = 0 then
    v_state := 'unknown';
  elsif v_snapshots_as_of is null or (v_n_posts > 0 and v_n_matched = 0) then
    v_state := 'incomplete_history';
  elsif greatest(coalesce(v_snapshots_as_of, '-infinity'::timestamptz),
                 coalesce(v_engagers_as_of,  '-infinity'::timestamptz))
        < v_cutoff - make_interval(days => v_stale_after) then
    v_state := 'stale';
  else
    v_state := 'normal';
  end if;

  return jsonb_build_object(
    'client_id',          p_client_id,
    'capability_version', coalesce((v_meas ->> 'capability_version')::int, 1),
    'reviewed_at',        to_jsonb(v_reviewed_at),
    'review_cadence',     coalesce(v_meas ->> 'review_cadence', 'weekly'),
    'state',              v_state,
    'freshness', jsonb_build_object(
      'snapshots_as_of',  to_jsonb(v_snapshots_as_of),
      'engagers_as_of',   to_jsonb(v_engagers_as_of),
      'stale_after_days', v_stale_after
    ),
    'posts',            v_posts,
    'monthly_median',   v_median,
    'recommendations',  v_recs,
    'assets',           v_assets
  );
end;
$fn$;

comment on function public.audn_board_payload(text) is
  'The client-visible audience object in the frozen run-03 CONTRACTS 2.1 shape, built only from the audn_* interface views plus client_ideas / client_board_actions / client_registry.platform. Returns NULL when the client has no manifest row or measurement.features.competitor_section is not true. Not security definer; granted to service_role only. Callers go through client_board_audience / _v2.';

-- ---------------------------------------------------------------------------
-- audn_board_payload_fixture_v — replay handle for the shared PGlite harness.
-- The harness dumps VIEWS, not function calls, so the fixture cases read the
-- payload through this view. It references only client_registry, which the
-- harness always creates, so adding this migration to a replay of the Run 02
-- cases cannot break them.
-- ---------------------------------------------------------------------------
create or replace view public.audn_board_payload_fixture_v
with (security_invoker = true) as
select cr.client_id,
       public.audn_board_payload(cr.client_id) as payload
  from public.client_registry cr
 where nullif(btrim(cr.client_id), '') is not null;

comment on view public.audn_board_payload_fixture_v is
  'One row per client_registry client with audn_board_payload(client_id). Fixture/replay handle only; the client board never reads it.';

-- ---------------------------------------------------------------------------
-- client_board_audience(p_slug, p_token) — the anon + token wrapper.
-- ---------------------------------------------------------------------------
create or replace function public.client_board_audience(p_slug text, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','extensions'
as $fn$
declare v_board public.client_boards%rowtype;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if coalesce(btrim(v_board.client_id), '') = '' then
    return jsonb_build_object('ok', true, 'audience', null);
  end if;
  return jsonb_build_object('ok', true, 'audience', public.audn_board_payload(v_board.client_id));
end;
$fn$;

-- ---------------------------------------------------------------------------
-- client_board_audience_v2(p_slug, p_session) — the signed-in wrapper.
-- ---------------------------------------------------------------------------
create or replace function public.client_board_audience_v2(p_slug text, p_session text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $fn$
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
  if coalesce(btrim(v_board.client_id), '') = '' then
    return jsonb_build_object('ok', true, 'audience', null);
  end if;
  return jsonb_build_object('ok', true, 'audience', public.audn_board_payload(v_board.client_id));
end;
$fn$;

-- ---------------------------------------------------------------------------
-- client_board_audience_decide(_v2) — record accepted / rejected / deferred.
--
-- Writes EXACTLY ONE row into client_board_actions and nothing else. It does not
-- touch client_ideas.status, carousel_drafts, scheduled_posts, any schedule, or
-- any outreach object (CONTRACTS §4). A reason is required: an override without
-- a recorded reason is the thing the measurement contract's editorial-decision
-- record exists to prevent.
-- ---------------------------------------------------------------------------
create or replace function public._audn_decide(p_slug text, p_client_id text, p_ref text,
                                               p_decision text, p_reason text)
returns jsonb
language plpgsql
set search_path to 'public'
as $fn$
declare v_action text; v_reason text;
begin
  v_action := case lower(coalesce(p_decision, ''))
                when 'accept' then 'audn_accept'
                when 'reject' then 'audn_reject'
                when 'defer'  then 'audn_defer'
                else null end;
  if v_action is null then return jsonb_build_object('ok', false, 'error', 'bad_decision'); end if;
  v_reason := btrim(regexp_replace(coalesce(p_reason, ''), E'[\r\n]+', ' ', 'g'));
  if length(v_reason) < 3 or length(v_reason) > 600 then
    return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
  if coalesce(p_ref, '') not like 'audn-rec:%' then
    return jsonb_build_object('ok', false, 'error', 'bad_ref'); end if;
  -- the recommendation must belong to THIS board's client
  if to_regclass('public.client_ideas') is null then
    return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  perform 1 from public.client_ideas ci
    where ci.client_id = p_client_id and ci.source_ref = p_ref;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  insert into public.client_board_actions (board_slug, client_id, action, ref, payload)
  values (p_slug, p_client_id, v_action, p_ref,
          jsonb_build_object('reason', v_reason, 'by', 'board'));
  return jsonb_build_object('ok', true, 'decision', lower(p_decision));
end;
$fn$;

create or replace function public.client_board_audience_decide(p_slug text, p_token text, p_ref text,
                                                               p_decision text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $fn$
declare v_board public.client_boards%rowtype;
begin
  select * into v_board from public.client_boards
   where slug = p_slug and token = p_token and (expires_at is null or expires_at > now());
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if coalesce(btrim(v_board.client_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public._audn_decide(p_slug, v_board.client_id, p_ref, p_decision, p_reason);
end;
$fn$;

create or replace function public.client_board_audience_decide_v2(p_slug text, p_session text, p_ref text,
                                                                  p_decision text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $fn$
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
  if coalesce(btrim(v_board.client_id), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  return public._audn_decide(p_slug, v_board.client_id, p_ref, p_decision, p_reason);
end;
$fn$;

-- ---------------------------------------------------------------------------
-- GRANTS. Same posture as client_board_funnel_signals (2026-08-26):
-- wrappers reachable by anon (the board is an anon + token surface), inner
-- functions pulled back to service_role.
-- ---------------------------------------------------------------------------
revoke all on function public.audn_board_payload(text) from public, anon, authenticated;
revoke all on function public._audn_decide(text,text,text,text,text) from public, anon, authenticated;
revoke all on table public.audn_board_payload_fixture_v from public, anon, authenticated;
revoke all on function public.client_board_audience(text,text) from public;
revoke all on function public.client_board_audience_v2(text,text) from public;
revoke all on function public.client_board_audience_decide(text,text,text,text,text) from public;
revoke all on function public.client_board_audience_decide_v2(text,text,text,text,text) from public;
grant execute on function public.audn_board_payload(text) to service_role;
grant execute on function public._audn_decide(text,text,text,text,text) to service_role;
grant select on table public.audn_board_payload_fixture_v to service_role;
grant execute on function public.client_board_audience(text,text) to anon, authenticated, service_role;
grant execute on function public.client_board_audience_v2(text,text) to anon, authenticated, service_role;
grant execute on function public.client_board_audience_decide(text,text,text,text,text) to anon, authenticated, service_role;
grant execute on function public.client_board_audience_decide_v2(text,text,text,text,text) to anon, authenticated, service_role;
