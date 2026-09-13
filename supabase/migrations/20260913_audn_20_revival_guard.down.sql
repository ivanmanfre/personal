drop trigger if exists audn_idea_revival_guard on public.lm_idea_candidates;
drop function if exists public.audn_guard_idea_revival();
-- Preserve correction ledger and original evidence for audit/history.
