-- Down for 20260911_audn_10_recommendation_publish. OFFLINE-ONLY (harness); the
-- production restore is a deliberate act under a grant. The two CHECKs are put
-- back NOT VALID: the schema returns to the 046 shape for every NEW row, while
-- existing proposal rows (kind 'audn_recommendation') are left in place rather
-- than deleted by a schema step. Deleting proposals is an operator act.
drop function if exists public.audn_recommendation_publish(text, uuid, jsonb);

alter table public.ops_drafts drop constraint if exists ops_drafts_kind_check;
alter table public.ops_drafts add constraint ops_drafts_kind_check
  check (kind = any (array[
    'escalation'::text, 'update'::text, 'newsjack'::text, 'weekly_report'::text,
    'comment_reply'::text, 'comment_outbound'::text, 'booking'::text,
    'precall_email'::text, 'manual_invite'::text, 'task'::text,
    'leads_ballot'::text])) not valid;

alter table public.ops_drafts drop constraint if exists ops_drafts_slack_channel_required;
alter table public.ops_drafts add constraint ops_drafts_slack_channel_required
  check ((kind = any (array[
    'newsjack'::text, 'weekly_report'::text, 'comment_reply'::text,
    'comment_outbound'::text, 'precall_email'::text, 'manual_invite'::text,
    'task'::text, 'leads_ballot'::text]))
    or slack_channel is not null) not valid;
