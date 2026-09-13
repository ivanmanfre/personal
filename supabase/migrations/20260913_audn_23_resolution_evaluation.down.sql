CREATE OR REPLACE VIEW public.audn_post_owner_resolution_v WITH (security_invoker=true) AS
 WITH raw_ids AS (
         SELECT DISTINCT post_engagers.post_social_id
           FROM post_engagers
          WHERE (post_engagers.post_social_id IS NOT NULL)
        ), candidates AS (
         SELECT r_1.post_social_id,
            i.client_id,
            i.canonical_post_id
           FROM (raw_ids r_1
             JOIN audn_canonical_post_identity_v i ON (((i.identity_status = 'resolved'::text) AND ((i.canonical_post_id = r_1.post_social_id) OR ((audn_urn_kind(r_1.post_social_id) IS NULL) AND (i.activity_digits = audn_urn_digits(r_1.post_social_id)))))))
        ), g AS (
         SELECT candidates.post_social_id,
            (count(*))::integer AS candidate_count,
            min(candidates.client_id) AS client_id,
            min(candidates.canonical_post_id) AS canonical_post_id,
            jsonb_agg(jsonb_build_object('client_id', candidates.client_id, 'canonical_post_id', candidates.canonical_post_id) ORDER BY candidates.client_id, candidates.canonical_post_id) AS candidates
           FROM candidates
          GROUP BY candidates.post_social_id
        )
 SELECT r.post_social_id,
        CASE
            WHEN (g.candidate_count = 1) THEN g.client_id
            ELSE NULL::text
        END AS client_id,
        CASE
            WHEN (g.candidate_count = 1) THEN g.canonical_post_id
            ELSE NULL::text
        END AS canonical_post_id,
    COALESCE(g.candidate_count, 0) AS candidate_count,
        CASE
            WHEN (g.candidate_count = 1) THEN 'resolved'::text
            WHEN (g.candidate_count > 1) THEN 'ambiguous'::text
            ELSE 'unresolved'::text
        END AS resolution_status,
    COALESCE(g.candidates, '[]'::jsonb) AS candidates
   FROM (raw_ids r
     LEFT JOIN g USING (post_social_id));

CREATE OR REPLACE VIEW public.audn_identity_resolution_v WITH (security_invoker=true) AS
 WITH candidates AS (
         SELECT s.id AS raw_snapshot_id,
            s.client_id,
            s.post_social_id AS raw_post_social_id,
            s.cycle_id,
            s.captured_at,
            s.target_age_days AS declared_target_age_days,
            s.actual_age_days AS declared_actual_age_days,
            s.impressions,
            s.reactions,
            s.comments,
            s.shares,
            s.source,
            s.coverage,
            audn_urn_kind(s.post_social_id) AS raw_urn_kind,
            audn_urn_digits(s.post_social_id) AS raw_urn_digits,
            exact_i.canonical_post_id AS exact_id,
            alias_i.candidate_count AS alias_candidate_count,
            alias_i.canonical_post_id AS alias_id,
            alias_i.published_at AS alias_published_at,
            exact_i.published_at AS exact_published_at,
            exact_i.identity_status AS exact_identity_status
           FROM ((audn_post_metric_snapshots s
             LEFT JOIN audn_canonical_post_identity_v exact_i ON (((exact_i.client_id = s.client_id) AND (exact_i.identity_post_social_id = s.post_social_id))))
             LEFT JOIN LATERAL ( SELECT (count(*))::integer AS candidate_count,
                    min(i.canonical_post_id) AS canonical_post_id,
                    min(i.published_at) AS published_at
                   FROM audn_canonical_post_identity_v i
                  WHERE ((i.client_id = s.client_id) AND (audn_urn_kind(s.post_social_id) IS NULL) AND (audn_urn_digits(s.post_social_id) IS NOT NULL) AND (i.activity_digits = audn_urn_digits(s.post_social_id)) AND (i.identity_status = 'resolved'::text))) alias_i ON (true))
        )
 SELECT raw_snapshot_id,
    client_id,
    raw_post_social_id,
    cycle_id,
    captured_at,
    declared_target_age_days,
    declared_actual_age_days,
    impressions,
    reactions,
    comments,
    shares,
    source,
    coverage,
    raw_urn_kind,
    raw_urn_digits,
    exact_id,
    alias_candidate_count,
    alias_id,
    alias_published_at,
    exact_published_at,
    exact_identity_status,
        CASE
            WHEN ((exact_id IS NOT NULL) AND (exact_identity_status = 'resolved'::text)) THEN exact_id
            WHEN ((raw_urn_kind IS NULL) AND (alias_candidate_count = 1)) THEN alias_id
            ELSE NULL::text
        END AS canonical_post_id,
        CASE
            WHEN ((exact_id IS NOT NULL) AND (exact_identity_status = 'conflict'::text)) THEN 'ambiguous'::text
            WHEN (exact_id IS NOT NULL) THEN 'exact'::text
            WHEN (raw_urn_kind IS NOT NULL) THEN 'unresolved'::text
            WHEN (alias_candidate_count = 1) THEN 'resolved_activity'::text
            WHEN (alias_candidate_count > 1) THEN 'ambiguous'::text
            ELSE 'unresolved'::text
        END AS resolution_status,
    COALESCE(
        CASE
            WHEN (exact_identity_status = 'resolved'::text) THEN exact_published_at
            ELSE NULL::timestamp with time zone
        END,
        CASE
            WHEN (alias_candidate_count = 1) THEN alias_published_at
            ELSE NULL::timestamp with time zone
        END) AS published_at,
        CASE
            WHEN ((exact_id IS NOT NULL) AND (exact_identity_status = 'conflict'::text)) THEN 'conflicting_identity_rows'::text
            WHEN (exact_id IS NOT NULL) THEN NULL::text
            WHEN (raw_urn_kind IS NOT NULL) THEN 'typed_urn_requires_exact_identity'::text
            WHEN (alias_candidate_count > 1) THEN 'multiple_activity_candidates'::text
            WHEN (alias_candidate_count = 0) THEN 'no_identity_candidate'::text
            ELSE NULL::text
        END AS unresolved_reason
   FROM candidates c;
