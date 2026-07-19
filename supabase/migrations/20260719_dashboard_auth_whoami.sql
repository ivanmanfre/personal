-- Dashboard auth infrastructure (goal-run dashboard-interiors-auth-2026-07-19).
-- Applied live 2026-07-19 via Management API under the recorded grant.
-- Role probe used by the login flow verification.
create or replace function public.whoami() returns text language sql stable as $fn$
  select coalesce(auth.role(), 'none')
$fn$;
grant execute on function public.whoami() to anon, authenticated;
