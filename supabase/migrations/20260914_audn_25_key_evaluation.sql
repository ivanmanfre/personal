CREATE OR REPLACE FUNCTION public.audn_canonical_post_key(p_client_id text, p_raw_id text)
RETURNS text LANGUAGE sql STABLE SET search_path TO 'public' AS $function$
WITH exact_sources AS MATERIALIZED (
 SELECT o.social_id canonical_post_id,o.posted_at published_at,
   CASE WHEN public.audn_urn_kind(o.social_id)='activity' THEN public.audn_urn_digits(o.social_id) END activity_digits,
   'own_posts'::text source_table
 FROM public.own_posts o WHERE p_client_id='ivan' AND o.social_id=p_raw_id
 UNION ALL
 SELECT m.social_id,m.published_at,
   coalesce(CASE WHEN public.audn_urn_kind(m.social_id)='activity' THEN public.audn_urn_digits(m.social_id) END,
     substring(m.post_url,'activity[:-]([0-9]{10,})')),
   'client_post_metrics'::text
 FROM public.client_post_metrics m WHERE m.client_id=p_client_id AND m.social_id=p_raw_id
), exact_i AS MATERIALIZED (
 SELECT canonical_post_id,
   CASE WHEN count(DISTINCT coalesce(published_at::text,'<null>'))>1
          OR count(DISTINCT activity_digits)>1 OR count(DISTINCT source_table)>1
        THEN 'conflict' ELSE 'resolved' END identity_status
 FROM exact_sources GROUP BY canonical_post_id
), alias_i AS (
 SELECT CASE WHEN count(*)=1 THEN min(canonical_post_id) END id
 FROM public.audn_canonical_post_identity_v
 WHERE client_id=p_client_id AND identity_status='resolved'
   AND activity_digits=public.audn_urn_digits(p_raw_id)
)
SELECT CASE WHEN EXISTS(SELECT 1 FROM exact_i) THEN
 (SELECT canonical_post_id FROM exact_i WHERE identity_status='resolved')
 WHEN public.audn_urn_kind(p_raw_id) IS NULL THEN (SELECT id FROM alias_i) ELSE NULL END;
$function$;
