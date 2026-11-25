select cron.schedule('swishdm-qualified-post-dms','*/5 * * * *',$job$
 select net.http_post(
   url:='https://bjbvqvzbzczjbatgmccb.supabase.co/functions/v1/swishdm-post-dms',
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||
      (select decrypted_secret from vault.decrypted_secrets where name='SUPABASE_SERVICE_ROLE_KEY')),
   body:='{}'::jsonb,timeout_milliseconds:=100000)
 where exists(select 1 from public.swishdm_dm_candidates());
$job$);
