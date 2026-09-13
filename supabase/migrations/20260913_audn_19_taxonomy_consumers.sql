-- Audience-learning 19: versioned client taxonomy and canonical consumers.
alter table public.audn_post_classifications add column if not exists content_scope text not null default 'own';
alter table public.audn_post_classifications add column if not exists author_name text;
alter table public.audn_post_classifications add column if not exists roster_role text;
alter table public.audn_post_classifications add column if not exists classifier_version text not null default 'deterministic-keywords-v1';
alter table public.audn_post_classifications add column if not exists evidence jsonb not null default '{}'::jsonb;

insert into public.audn_taxonomy_versions(client_id,taxonomy_version,dimension,labels,source_refs,approved_at) values
('ivan','ivan-subjects-20260913-v1','subject',
 '["founder_content","editorial_quality","lead_magnets","sales_followup","content_operations","ai_workflows","measurement","founder_decisions"]',
 '[{"slug":"author-voice","version":33},{"slug":"icp-outreach-scoring","version":17},{"slug":"forbidden-language","version":26}]',null),
('risedtc','risedtc-subjects-20260913-v1','subject',
 '["profit_economics","paid_media","creative_testing","retention","offer_pricing","agency_risk_model","founder_decisions","growth_constraints"]',
 '[{"slug":"rise-dtc-author-voice","version":29},{"slug":"rise-icp-engager-scoring","version":2},{"slug":"rise-dtc-qa","version":21}]',null),
('arch','arch-subjects-20260913-v1','subject',
 '["creator_selection","creator_economics","campaign_operations","measurement_attribution","creative_briefing","channel_strategy","game_app_launches","founder_decisions"]',
 '[{"slug":"arch-author-voice","version":5},{"slug":"arch-icp-engager-scoring","version":17},{"slug":"arch-qa","version":12}]',null)
on conflict(client_id,taxonomy_version,dimension) do update set labels=excluded.labels,source_refs=excluded.source_refs;

insert into public.audn_taxonomy_versions(client_id,taxonomy_version,dimension,labels,source_refs) 
select c.client_id,c.taxonomy_version,d.dimension,d.labels,s.source_refs from
(values
 ('ivan','ivan-subjects-20260913-v1'),('risedtc','risedtc-subjects-20260913-v1'),('arch','arch-subjects-20260913-v1')
) c(client_id,taxonomy_version)
join public.audn_taxonomy_versions s on s.client_id=c.client_id and s.taxonomy_version=c.taxonomy_version and s.dimension='subject'
cross join (values
 ('purpose','["educate","challenge","prove","invite","story","unknown"]'::jsonb),
 ('hook','["question","contrarian","number","story","how_to","observation","unknown"]'::jsonb),
 ('format','["text","image","video","carousel","article","unknown"]'::jsonb)
) d(dimension,labels) on conflict(client_id,taxonomy_version,dimension) do update set labels=excluded.labels,source_refs=excluded.source_refs;

create or replace function public.audn_taxonomy_version(p_client_id text)
returns text language sql stable set search_path=public as $$
select coalesce(
 (select case when nullif(r.platform->'measurement'->'editorial'->>'taxonomy_version','') is not null
   and jsonb_typeof(r.platform->'measurement'->'editorial'->'brief'->'subjects')='array'
   then r.platform->'measurement'->'editorial'->>'taxonomy_version' end from client_registry r where r.client_id=p_client_id),
 (select taxonomy_version from audn_taxonomy_versions where client_id=p_client_id and dimension='subject' order by created_at desc limit 1),
 'unknown');
$$;

create or replace function public.audn_classify_subject(p_client_id text,p_text text)
returns text language plpgsql stable set search_path=public as $$
declare ed jsonb; rules jsonb; subjects jsonb; hit text;
begin
 select r.platform->'measurement'->'editorial' into ed from client_registry r where r.client_id=p_client_id;
 rules:=ed->'subject_rules';subjects:=ed->'brief'->'subjects';
 if jsonb_typeof(rules)='object' and rules<>'{}'::jsonb and jsonb_typeof(subjects)='array' then
   select s.subject into hit from jsonb_array_elements_text(subjects) with ordinality s(subject,ordinal)
   where rules ? s.subject and jsonb_typeof(rules->s.subject)='array' and exists(
     select 1 from jsonb_array_elements_text(rules->s.subject)kw where nullif(btrim(kw),'') is not null
       and strpos(lower(coalesce(p_text,'')),lower(kw))>0)
   order by s.ordinal limit 1;
   return coalesce(hit,'unknown');
 end if;
 return case p_client_id
 when 'ivan' then case
  when lower(coalesce(p_text,'')) ~ 'lead magnet|guide|checklist|playbook' then 'lead_magnets'
  when lower(coalesce(p_text,'')) ~ 'hook|draft|writing|editorial|ai slop|content quality' then 'editorial_quality'
  when lower(coalesce(p_text,'')) ~ 'follow.?up|reply|\mdm\M|outreach|sales call' then 'sales_followup'
  when lower(coalesce(p_text,'')) ~ 'workflow|automation|agent|claude|chatgpt|\mai\M' then 'ai_workflows'
  when lower(coalesce(p_text,'')) ~ 'percentile|baseline|measure|impression|engagement|conversion' then 'measurement'
  when lower(coalesce(p_text,'')) ~ 'process|pipeline|system|operation|calendar' then 'content_operations'
  when lower(coalesce(p_text,'')) ~ '\mi decided\M|my decision|why i|founder' then 'founder_decisions'
  when lower(coalesce(p_text,'')) ~ 'linkedin|post|content' then 'founder_content' else 'unknown' end
 when 'risedtc' then case
  when lower(coalesce(p_text,'')) ~ 'profit|margin|contribution|cash flow|p&l|economics' then 'profit_economics'
  when lower(coalesce(p_text,'')) ~ 'meta|facebook ads|google ads|paid media|roas|cpm|cac' then 'paid_media'
  when lower(coalesce(p_text,'')) ~ 'creative test|ad creative|creative iteration|ugc|thumbstop' then 'creative_testing'
  when lower(coalesce(p_text,'')) ~ 'retention|repeat purchase|ltv|churn|email|sms' then 'retention'
  when lower(coalesce(p_text,'')) ~ 'offer|pricing|discount|aov|bundle' then 'offer_pricing'
  when lower(coalesce(p_text,'')) ~ 'rev.?share|risk.?sharing|agency fee|performance agency' then 'agency_risk_model'
  when lower(coalesce(p_text,'')) ~ '\mi decided\M|founder decision|we decided' then 'founder_decisions'
  when lower(coalesce(p_text,'')) ~ 'plateau|constraint|bottleneck|scale|growth' then 'growth_constraints' else 'unknown' end
 when 'arch' then case
  when lower(coalesce(p_text,'')) ~ 'select.*creator|creator selection|vet.*creator|influencer selection' then 'creator_selection'
  when lower(coalesce(p_text,'')) ~ 'creator.*cpm|creator.*cost|influencer.*cost|rate card|creator economics' then 'creator_economics'
  when lower(coalesce(p_text,'')) ~ 'campaign oper|manage.*creator|creator pipeline|outreach.*creator' then 'campaign_operations'
  when lower(coalesce(p_text,'')) ~ 'attribution|incremental|measure|tracking|roi|roas' then 'measurement_attribution'
  when lower(coalesce(p_text,'')) ~ 'creative brief|briefing|creator brief|content brief' then 'creative_briefing'
  when lower(coalesce(p_text,'')) ~ 'tiktok|youtube|instagram|channel|platform mix' then 'channel_strategy'
  when lower(coalesce(p_text,'')) ~ 'game launch|app launch|mobile game|gaming|game developer' then 'game_app_launches'
  when lower(coalesce(p_text,'')) ~ '\mi decided\M|founder decision|we decided' then 'founder_decisions' else 'unknown' end
 else 'unknown' end;
end;
$$;

create or replace function public.audn_classify_purpose(p_text text) returns text language sql immutable as $$
select case when lower(coalesce(p_text,'')) ~ 'how to|steps|here.s how|guide|checklist' then 'educate'
 when lower(coalesce(p_text,'')) ~ 'wrong|stop|unpopular|disagree|myth' then 'challenge'
 when lower(coalesce(p_text,'')) ~ '[0-9]+%|result|grew|increased|decreased' then 'prove'
 when lower(coalesce(p_text,'')) ~ 'comment|dm me|book|download|join' then 'invite'
 when lower(coalesce(p_text,'')) ~ '\bi (was|did|learned|remember)|last year|years ago' then 'story' else 'unknown' end;
$$;
create or replace function public.audn_classify_hook(p_text text) returns text language sql immutable as $$
with x as (select left(split_part(coalesce(p_text,''),E'\n',1)||E'\n'||split_part(coalesce(p_text,''),E'\n',2),240) opener)
select case when ltrim(opener) ~ '^.{0,160}\?' then 'question'
 when lower(opener) ~ 'unpopular|wrong|stop|nobody tells|myth' then 'contrarian'
 when ltrim(opener) ~ '^[0-9$€£]|^[^\n]{0,80}[0-9]+%' then 'number'
 when lower(opener) ~ 'how to|steps|checklist' then 'how_to'
 when lower(opener) ~ '\mi (was|did|learned|remember)\M|last year|years ago' then 'story'
 when lower(ltrim(opener)) ~ '^(i think|i noticed|most |every |the )' then 'observation' else 'unknown' end from x;
$$;
create or replace function public.audn_normalize_format(p_format text) returns text language sql immutable as $$
select case lower(coalesce(p_format,'')) when 'document' then 'carousel' when 'carousel' then 'carousel'
 when 'video' then 'video' when 'image' then 'image' when 'article' then 'article' when 'text' then 'text' else 'unknown' end;
$$;

-- Resolve source rows to canonical identity and reduce duplicates before any
-- classifier or percentile consumer sees them. Exceptions remain queryable.
create or replace view public.audn_classification_source_resolution_v with(security_invoker=true) as
with src as (
 select 'ivan'::text client_id,o.social_id raw_content_id,o.post_text body,
   case when nullif(btrim(o.post_text),'') is not null then 'body' else 'empty' end text_source,
   o.post_type raw_format,o.posted_at source_at,'own_posts_scored'::text source_table
 from public.own_posts_scored o
 union all
 select m.client_id,m.social_id,
   coalesce(nullif(btrim(m.meta->>'text'),''),nullif(btrim(m.title),''),''),
   case when nullif(btrim(m.meta->>'text'),'') is not null then 'body'
        when nullif(btrim(m.title),'') is not null then 'title_fallback' else 'empty' end,
   m.meta->>'format',m.published_at,'client_post_metrics'
 from public.client_post_metrics m
), resolved as (
 select s.*,public.audn_canonical_post_key(s.client_id,s.raw_content_id) canonical_post_id from src s
), ranked as (
 select r.*,count(*) over(partition by client_id,canonical_post_id)::int source_row_count,
   row_number() over(partition by client_id,canonical_post_id order by
     (text_source='body') desc,(nullif(btrim(body),'') is not null) desc,source_at desc nulls last,
     source_table,raw_content_id,body,raw_format)::int source_order
 from resolved r where canonical_post_id is not null
)
select *,case when source_order=1 then 'selected' else 'duplicate_source_row' end resolution_status from ranked
union all
select r.*,1,1,'unresolved_or_conflicted_identity' from resolved r where canonical_post_id is null;

create or replace view public.audn_classification_source_exceptions_v with(security_invoker=true) as
select * from public.audn_classification_source_resolution_v
where resolution_status<>'selected' or source_row_count>1;

create or replace view public.audn_repeatable_classification_v with(security_invoker=true) as
select s.client_id,s.canonical_post_id,
 public.audn_taxonomy_version(s.client_id) taxonomy_version,
 public.audn_classify_subject(s.client_id,s.body) subject,public.audn_classify_purpose(s.body) purpose,
 public.audn_classify_hook(s.body) hook,public.audn_normalize_format(s.raw_format) format,
 s.source_at,'deterministic-keywords-v1'::text classifier_version,
 jsonb_build_object('text_present',nullif(btrim(s.body),'') is not null,'text_source',s.text_source,
   'raw_format',s.raw_format,'source_table',s.source_table,'source_row_count',s.source_row_count) evidence
from public.audn_classification_source_resolution_v s where s.resolution_status='selected';

-- Competitor classification is descriptive only. Roster role and rationale remain
-- attached to each author; performance baselines continue to be calculated per
-- author by audn_benchmark_payload_v15 and are never pooled by subject.
create or replace view public.audn_repeatable_competitor_classification_v with(security_invoker=true) as
with src as (
 select 'ivan'::text client_id,coalesce(p.id::text,p.linkedin_post_url) content_id,
   p.competitor_name author_name,p.post_text body,p.post_type raw_format,p.post_date source_at,
   null::text source_role
 from public.competitor_posts p
 union all
 select p.client_id,coalesce(p.id::text,p.linkedin_post_url),p.competitor_name,p.post_text,p.post_type,p.post_date,
   p.competitor_role
 from public.audn_competitor_posts p
), roster as (
 select r.client_id,x->>'account' account,x->>'role' roster_role,x->>'reason' roster_reason
 from public.client_registry r cross join lateral jsonb_array_elements(coalesce(r.platform->'measurement'->'roster','[]')) x
)
select s.client_id,s.content_id canonical_post_id,s.author_name,
 case when r.candidate_count=1 then r.roster_role else 'unknown' end roster_role,
 case when r.candidate_count=1 then r.roster_reason end roster_reason,
 coalesce(r.candidate_count,0)::int roster_match_count,
 public.audn_taxonomy_version(s.client_id) taxonomy_version,
 public.audn_classify_subject(s.client_id,s.body) subject,public.audn_classify_purpose(s.body) purpose,
 public.audn_classify_hook(s.body) hook,public.audn_normalize_format(s.raw_format) format,
 s.source_at,'deterministic-keywords-v1'::text classifier_version,
 jsonb_build_object('text_present',nullif(btrim(s.body),'') is not null,'raw_format',s.raw_format,
   'roster_reason',r.roster_reason) evidence
from src s left join lateral (
 select count(*)::int candidate_count,min(r.roster_role) roster_role,min(r.roster_reason) roster_reason
 from roster r where r.client_id=s.client_id
   and r.roster_role in ('direct_competitor','buyer_voice','format_reference','warm_anchor')
   and nullif(btrim(r.roster_reason),'') is not null
   and lower(btrim(split_part(r.account,' (',1)))=lower(btrim(s.author_name))
) r on true where s.content_id is not null;

-- Keep the legacy topic consumer shape, but resolve every interaction to one
-- canonical post and use the versioned subject as its topic.
create or replace view public.audn_topic_people_v with(security_invoker=true) as
with resolved as (
 select e.*,coalesce(exact_i.canonical_post_id,alias_i.canonical_post_id) canonical_post_id
 from public.audn_interaction_events_v e
 left join public.audn_canonical_post_identity_v exact_i on exact_i.client_id=e.client_id
   and exact_i.canonical_post_id=e.post_social_id and exact_i.identity_status='resolved'
 left join lateral (
   select case when count(*)=1 then min(i.canonical_post_id) end canonical_post_id
   from public.audn_canonical_post_identity_v i
   where i.client_id=e.client_id and public.audn_urn_kind(e.post_social_id) is null
     and i.activity_digits=public.audn_urn_digits(e.post_social_id) and i.identity_status='resolved'
 ) alias_i on exact_i.canonical_post_id is null
)
select e.client_id,c.subject topic,count(distinct e.person_key)::int people,count(*)::int events,
 count(distinct e.canonical_post_id)::int posts
from resolved e join public.audn_repeatable_classification_v c
 on c.client_id=e.client_id and c.canonical_post_id=e.canonical_post_id
group by 1,2;

-- Replace raw-ID theme aggregation with canonical, matched-age classifications.
create or replace function public.audn_themes_payload(p_client_id text,p_days int default 180)
returns jsonb language sql stable security definer set search_path='public' as $$
with params as (select public.audn_cutoff() cutoff,greatest(p_days,30) days),
c as (
 select x.* from public.audn_repeatable_classification_v x cross join params p
 where x.client_id=p_client_id and x.source_at is not null
   and x.source_at between p.cutoff-make_interval(days=>p.days) and p.cutoff
), source_detail as (
 select c.*,d.body,d.url from c left join lateral (
   select q.body,q.url from (
     select o.post_text body,o.linkedin_url url,o.posted_at at
     from public.own_posts_scored o where c.client_id='ivan' and o.social_id=c.canonical_post_id
     union all
     select coalesce(nullif(btrim(m.meta->>'text'),''),nullif(btrim(m.title),''),''),m.post_url,m.published_at
     from public.client_post_metrics m where m.client_id=c.client_id
       and public.audn_canonical_post_key(m.client_id,m.social_id)=c.canonical_post_id
   ) q order by q.at desc nulls last limit 1
 ) d on true
), m as (
 select s.* from public.audn_selected_snapshot_v s cross join params p
 where s.client_id=p_client_id and s.captured_at<=p.cutoff
   and s.published_at between p.cutoff-make_interval(days=>p.days) and p.cutoff
), j as (
 select c.*,m.target_age_days,m.impressions,
   case when m.reactions>=0 and m.comments>=0 then m.reactions+m.comments end engagement_count
 from c left join m on m.client_id=c.client_id and m.canonical_post_id=c.canonical_post_id
), dimensions as (
 select 'subject' dimension,subject value,target_age_days,canonical_post_id,impressions,engagement_count from j union all
 select 'purpose',purpose,target_age_days,canonical_post_id,impressions,engagement_count from j union all
 select 'hook',hook,target_age_days,canonical_post_id,impressions,engagement_count from j union all
 select 'format',format,target_age_days,canonical_post_id,impressions,engagement_count from j
), g as (
 select dimension,value,target_age_days,count(distinct canonical_post_id)::int n,
   count(distinct canonical_post_id) filter(where impressions is not null)::int impression_n,
   count(distinct canonical_post_id) filter(where engagement_count is not null)::int engagement_n,
   percentile_cont(.5) within group(order by impressions) filter(where impressions is not null) median_imp,
   percentile_cont(.5) within group(order by engagement_count) filter(where engagement_count is not null) median_eng
 from dimensions group by 1,2,3
), preferred as (
 select distinct on(c.canonical_post_id) c.*,m.target_age_days,m.impressions,
   case when m.reactions>=0 and m.comments>=0 then m.reactions+m.comments end engagement_count
 from source_detail c left join m on m.client_id=c.client_id and m.canonical_post_id=c.canonical_post_id and m.target_age_days=14
 order by c.canonical_post_id,m.target_age_days desc nulls last
), ranked as (
 select p.*,row_number() over(partition by subject order by impressions desc nulls last,source_at desc,canonical_post_id desc) rn
 from preferred p
), legacy as (
 select subject theme,count(*)::int n,
   percentile_cont(.5) within group(order by impressions) filter(where impressions is not null) median_imp,
   percentile_cont(.5) within group(order by engagement_count) filter(where engagement_count is not null) median_eng,
   max(impressions) best_imp,null::int people,null::int fit,
   jsonb_object_agg(purpose,purpose_n) angles,
   (select jsonb_agg(jsonb_build_object('canonical_post_id',r2.canonical_post_id,'at',r2.source_at,
      'imp',r2.impressions,'eng',r2.engagement_count,'url',r2.url,'text',left(coalesce(r2.body,''),200),
      'angle',r2.purpose,'people',null,'fit',null,'target_age_days',r2.target_age_days) order by r2.rn)
    from ranked r2 where r2.subject=x.subject and r2.rn<=3) posts
 from (select r.*,count(*) over(partition by subject,purpose)::int purpose_n from ranked r) x
 group by subject
), canonical as (
 select dimension,jsonb_agg(jsonb_build_object('value',value,'subject',case when dimension='subject' then value end,
   'purpose',case when dimension='purpose' then value end,'hook',case when dimension='hook' then value end,
   'format',case when dimension='format' then value end,'target_age_days',target_age_days,'n',n,
   'impression_n',impression_n,'engagement_n',engagement_n,'median_imp',median_imp,'median_eng',median_eng)
   order by n desc,value,target_age_days) rows from g group by dimension
)
select jsonb_build_object('ok',true,'client_id',p_client_id,'days',greatest(p_days,30),'read_at',public.audn_cutoff(),
 'posts_total',(select count(distinct canonical_post_id) from c),'unknown_subject',(select count(*) from c where subject='unknown'),
 'untagged',(select count(*) from c where subject='unknown'),
 'legacy_target_age_days',14,
 'taxonomy_versions',(select coalesce(jsonb_agg(distinct taxonomy_version),'[]') from c),
 'themes',(select coalesce(jsonb_agg(to_jsonb(legacy) order by best_imp desc nulls last,theme),'[]') from legacy),
 'canonical',(select coalesce(jsonb_object_agg(dimension,rows),'{}') from canonical),
 'source_time_unknown',(select count(*) from public.audn_repeatable_classification_v where client_id=p_client_id and source_at is null));
$$;
revoke all on function public.audn_themes_payload(text,int) from public,anon;
grant execute on function public.audn_themes_payload(text,int) to authenticated,service_role;

-- Preserve competitor roster/author calculations from 15, while overriding its
-- raw own-post fields with canonical measurement and classifications.
alter function public.audn_benchmark_payload(text,int) rename to audn_benchmark_payload_v15;
create or replace function public.audn_benchmark_payload(p_client_id text,p_days int default 90)
returns jsonb language sql stable security definer set search_path='public' as $$
with base as (select public.audn_benchmark_payload_v15(p_client_id,p_days) payload),
roster as (
 select x->>'account' account,x->>'role' role,x->>'reason' roster_reason
 from public.client_registry r cross join lateral jsonb_array_elements(coalesce(r.platform->'measurement'->'roster','[]')) x
 where r.client_id=p_client_id and x->>'role' in ('direct_competitor','buyer_voice','format_reference','warm_anchor')
   and nullif(btrim(x->>'reason'),'') is not null
), src as (
 select p.competitor_name who,p.post_date at,p.post_type media,p.likes_count likes,p.comments_count comments,
   p.linkedin_post_url url,p.post_text body,p.suggested_angle angle,p.why_it_worked why
 from public.competitor_posts p where p_client_id='ivan' and coalesce(p.competitor_role,'')<>'killed'
 union all
 select p.competitor_name,p.post_date,p.post_type,p.likes_count,p.comments_count,p.linkedin_post_url,p.post_text,
   p.suggested_angle,p.why_it_worked
 from public.audn_competitor_posts p where p_client_id<>'ivan' and p.client_id=p_client_id and coalesce(p.competitor_role,'')<>'killed'
), reviewed as (
 select s.*,r.role,r.roster_reason,(s.likes+s.comments)::numeric eng
 from src s join lateral (
   select min(x.role) role,min(x.roster_reason) roster_reason
   from roster x where lower(btrim(split_part(x.account,' (',1)))=lower(btrim(s.who))
   having count(*)=1
 ) r on true
 where s.at between public.audn_cutoff()-make_interval(days=>greatest(p_days,7)) and public.audn_cutoff()
   and s.likes is not null and s.likes>=0 and s.comments is not null and s.comments>=0
), author_base as (
 select who,count(eng)::int author_n,percentile_cont(.5) within group(order by eng) author_med
 from reviewed group by who
), scored as (
 select r.*,b.author_n,b.author_med,
   case when b.author_n>=8 and b.author_med>0 then round((r.eng/b.author_med)::numeric,2) end lift,
   case when b.author_n>=8 then round(100.0*((select count(*) from reviewed x where x.who=r.who and x.eng<r.eng)
      +.5*(select count(*) from reviewed x where x.who=r.who and x.eng=r.eng))/b.author_n) end author_pct
 from reviewed r join author_base b using(who)
), outliers as (
 select * from scored where author_n>=8 and lift is not null and eng>0 order by lift desc,at desc,url desc limit 12
)
select base.payload || jsonb_build_object(
 'canonical_measurement',public.audn_measurement_payload(p_client_id),
 'own_dist',(select coalesce(jsonb_object_agg(target_age_days||':'||metric,jsonb_build_object('n',eligible_n,'missing_n',missing_n,'p50',p50,'p75',p75,'p90',p90,'status',status)),'{}')
   from (select distinct target_age_days,metric,eligible_n,missing_n,p50,p75,p90,
          case when eligible_n>=20 then 'supported' else 'below_floor' end status
         from public.audn_metric_standing_v where client_id=p_client_id) x),
 'own_recent',(select coalesce(jsonb_agg(jsonb_build_object('canonical_post_id',c.canonical_post_id,'published_at',c.source_at,
   'subject',c.subject,'purpose',c.purpose,'hook',c.hook,'format',c.format,'taxonomy_version',c.taxonomy_version)
   order by c.source_at desc),'[]') from (select * from public.audn_repeatable_classification_v where client_id=p_client_id and source_at between public.audn_cutoff()-make_interval(days=>greatest(p_days,30)) and public.audn_cutoff() order by source_at desc limit 14)c),
 'source_classifications',(select coalesce(jsonb_agg(to_jsonb(x) order by author_name,roster_role,subject,purpose,hook,format),'[]') from (
   select author_name,roster_role,roster_reason,subject,purpose,hook,format,taxonomy_version,
     count(distinct canonical_post_id)::int n,min(source_at) observed_from,max(source_at) observed_to
   from public.audn_repeatable_competitor_classification_v
   where client_id=p_client_id and source_at between public.audn_cutoff()-make_interval(days=>greatest(p_days,30)) and public.audn_cutoff()
     and roster_match_count=1 and roster_role in ('direct_competitor','buyer_voice','format_reference','warm_anchor')
     and nullif(btrim(roster_reason),'') is not null
   group by author_name,roster_role,roster_reason,subject,purpose,hook,format,taxonomy_version
 ) x),
 'source_classification_excluded_count',(select count(distinct canonical_post_id) from public.audn_repeatable_competitor_classification_v
   where client_id=p_client_id and source_at between public.audn_cutoff()-make_interval(days=>greatest(p_days,30)) and public.audn_cutoff()
     and not(roster_match_count=1 and roster_role in ('direct_competitor','buyer_voice','format_reference','warm_anchor') and nullif(btrim(roster_reason),'') is not null)),
 'source_classification_unknown_time',(select count(*) from public.audn_repeatable_competitor_classification_v where client_id=p_client_id and source_at is null)
 ,'outliers',(select coalesce(jsonb_agg(jsonb_build_object('who',who,'role',role,'roster_reason',roster_reason,'at',at,
    'media',case lower(coalesce(media,'')) when 'document' then 'carousel' when 'carousel' then 'carousel' when 'video' then 'video' when 'image' then 'image' when 'article' then 'article' else 'text' end,
    'eng',eng,'likes',likes,'comments',comments,'url',url,'text',left(coalesce(body,''),220),'angle',angle,'why',why,
    'author_med',author_med,'author_n',author_n,'lift',lift,'author_pct',author_pct) order by lift desc,at desc,url desc),'[]') from outliers)
) from base;
$$;
revoke all on function public.audn_benchmark_payload(text,int) from public,anon;
grant execute on function public.audn_benchmark_payload(text,int) to authenticated,service_role;
