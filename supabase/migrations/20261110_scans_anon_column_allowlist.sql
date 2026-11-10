-- 2026-11-10: the public (anon) key may read only the 21 columns the public scan pages request.
-- Before this, anon held table-level SELECT (and unused write privileges) on public.scans, so the key that ships in the
-- page bundle could read email, prospect_token, every raw_* column and the rest for every complete row.
-- Applied to production on 2026-11-10. Idempotent: safe to run again, and it must run after any table re-creation or
-- schema-wide grant to anon. Role authenticated, the row policies, functions and views are not touched.
-- Guard script: scripts/assert-scans-anon-columns.py
-- Rollback: grant select on public.scans to anon;

begin;

revoke all on table public.scans from anon;

grant select (
  id, company_slug, domain, status, created_at, completed_at,
  company_name, company_size, revenue_range, domain_age_years, email_infra, logo_url,
  anthropic_verified, openai_verified, automation_score, automation_grade,
  top_gap_title, top_gap_summary, report_url, report_json, matched_offer
) on public.scans to anon;

-- Fail the migration unless anon's EFFECTIVE privileges (PUBLIC and inherited roles included) are exactly the allowlist.
do $$
declare
  allow text[] := array[
    'id','company_slug','domain','status','created_at','completed_at',
    'company_name','company_size','revenue_range','domain_age_years','email_infra','logo_url',
    'anthropic_verified','openai_verified','automation_score','automation_grade',
    'top_gap_title','top_gap_summary','report_url','report_json','matched_offer'];
  readable text[];
begin
  select coalesce(array_agg(a.attname::text order by a.attname), '{}')
    into readable
    from pg_attribute a
   where a.attrelid = 'public.scans'::regclass and a.attnum > 0 and not a.attisdropped
     and has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT');
  if not (readable <@ allow and allow <@ readable) then
    raise exception 'scans anon allowlist mismatch: anon can read %', readable;
  end if;
  -- has_any_column_privilege is true for a table-level OR any column-level grant, including one reached through PUBLIC
  if has_any_column_privilege('anon', 'public.scans', 'INSERT')
     or has_any_column_privilege('anon', 'public.scans', 'UPDATE')
     or has_table_privilege('anon', 'public.scans', 'DELETE')
     or has_table_privilege('anon', 'public.scans', 'TRUNCATE') then
    raise exception 'anon still holds a write privilege on public.scans';
  end if;
end $$;

commit;

notify pgrst, 'reload schema';
