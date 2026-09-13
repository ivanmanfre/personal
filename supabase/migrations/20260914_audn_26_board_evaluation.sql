CREATE OR REPLACE FUNCTION public.audn_board_payload(p_client_id text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with b as materialized (select public.audn_board_payload_v15(p_client_id) payload),
standing as (
 select distinct on(canonical_post_id) canonical_post_id,target_age_days,standing_pct,eligible_n,status
 from public.audn_metric_standing_v where client_id=p_client_id and metric='engagement_count'
 order by canonical_post_id,eligible_n desc,target_age_days
)
select case when b.payload is null then null else b.payload || jsonb_build_object(
 'measurement',public.audn_measurement_payload(p_client_id),
 'posts',coalesce((select jsonb_agg(p || jsonb_build_object('rank',coalesce(p->'rank','{}') || jsonb_build_object(
   'standing_pct',s.standing_pct,'standing_status',s.status,'standing_basis','midpoint_empirical')) order by ord)
   from jsonb_array_elements(coalesce(b.payload->'posts','[]')) with ordinality x(p,ord)
   left join standing s on s.canonical_post_id=p->>'post_social_id'),'[]')) end from b;
$function$;
