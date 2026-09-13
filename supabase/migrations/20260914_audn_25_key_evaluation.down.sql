CREATE OR REPLACE FUNCTION public.audn_canonical_post_key(p_client_id text, p_raw_id text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
with exact_i as (select canonical_post_id,identity_status from audn_canonical_post_identity_v
 where client_id=p_client_id and canonical_post_id=p_raw_id),
alias_i as (select case when count(*)=1 then min(canonical_post_id) end id
 from audn_canonical_post_identity_v where client_id=p_client_id and identity_status='resolved'
 and activity_digits=audn_urn_digits(p_raw_id))
select case when exists(select 1 from exact_i) then
 (select canonical_post_id from exact_i where identity_status='resolved')
 when audn_urn_kind(p_raw_id) is null then (select id from alias_i) else null end;
$function$
