-- content_prompts was never in the realtime publication, so the dashboard's
-- postgres_changes subscription (and the external-change banner) received no events.
-- Applied to prod 2026-07-02 via MCP (migration content_prompts_realtime_publication).
-- Idempotent: re-apply is a no-op instead of erroring.
do $$
begin
  alter publication supabase_realtime add table public.content_prompts;
exception when duplicate_object then
  null;
end $$;
