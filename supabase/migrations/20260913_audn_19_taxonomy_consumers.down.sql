drop function if exists public.audn_benchmark_payload(text,int);
alter function public.audn_benchmark_payload_v15(text,int) rename to audn_benchmark_payload;
drop function if exists public.audn_themes_payload(text,int);
drop view if exists public.audn_topic_people_v;
drop view if exists public.audn_repeatable_classification_v;
drop view if exists public.audn_classification_source_exceptions_v;
drop view if exists public.audn_classification_source_resolution_v;
drop view if exists public.audn_repeatable_competitor_classification_v;
drop function if exists public.audn_normalize_format(text);
drop function if exists public.audn_classify_hook(text);
drop function if exists public.audn_classify_purpose(text);
drop function if exists public.audn_classify_subject(text,text);
drop function if exists public.audn_taxonomy_version(text);
-- audn_themes_payload is restored by replaying migration12.
