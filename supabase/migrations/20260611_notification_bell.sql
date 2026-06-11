-- notification_state: singleton row driving the unread badge.
create table if not exists public.notification_state (
  id int primary key default 1,
  last_opened_at timestamptz not null default now(),
  constraint notification_state_singleton check (id = 1)
);
insert into public.notification_state (id) values (1) on conflict (id) do nothing;
alter table public.notification_state enable row level security;
drop policy if exists notification_state_read on public.notification_state;
create policy notification_state_read on public.notification_state for select using (true);
drop policy if exists notification_state_update on public.notification_state;
create policy notification_state_update on public.notification_state for update using (true) with check (true);

-- get_pending_actions: normalized feed of everything needing Ivan.
-- Each UNION branch = one v1 source. Column names verified against live DB 2026-06-11.
create or replace function public.get_pending_actions()
returns table (
  category text, item_key text, title text, subtitle text,
  severity text, deeplink text, created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select 'skill_draft', 'skill_draft:'||sd.id::text,
         sd.skill_name, left(coalesce(sd.rationale,''),100),
         'tier3', '?section=ops&sub=skills', sd.created_at
  from skill_drafts sd
  where sd.status='pending' and sd.kind <> 'prune_candidate'
  union all
  select 'memory_proposal','memory_proposal:'||cm.id::text,
         'Memory cleanup — '||coalesce(cm.client_id,'tier'),
         'Pending prune proposals','tier3',
         '?section=knowledge&sub=brain', cm.updated_at
  from claude_memory cm
  where cm.file_path like '%\_compaction-review.md'
  union all
  select 'scheduled_check','scheduled_check:'||scs.id::text,
         scs.title, coalesce(scs.detail,''),'tier1',
         '?section=ops&sub=checks', (scs.due_date)::timestamptz
  from scheduled_checks_status scs
  where scs.state='due'
  union all
  select 'stuck_automation','stuck_automation:'||dws.workflow_id,
         dws.workflow_name, left(coalesce(dws.last_error_message,'error'),100),
         'tier1','?section=ops&sub=scheduled-ops', dws.last_execution_at
  from dashboard_workflow_stats dws
  where dws.last_execution_status='error'
    and dws.error_acknowledged = false and dws.is_active = true
  union all
  select 'stuck_automation','overdue:'||sjr.job_key,
         sjr.label, 'Overdue — no run within expected interval','tier1',
         '?section=ops&sub=scheduled-ops', sjr.last_synced_at
  from scheduled_job_registry sjr
  where sjr.enabled = true and sjr.last_synced_at is not null
    and sjr.last_synced_at < now() - ((coalesce(sjr.expected_interval_minutes,60)
          + coalesce(sjr.grace_minutes,0)) * interval '1 minute')
  union all
  select 'carousel_review','carousel_review:'||cd.id::text,
         coalesce(cd.title, cd.topic, 'Untitled post'),'Post awaiting review',
         'tier2','?section=content&sub=posts', cd.created_at
  from carousel_drafts cd where cd.status='review'
  union all
  select 'lm_review','lm_review:'||lm.id::text,
         coalesce(lm.topic, lm.slug, 'Untitled LM'),'Lead magnet awaiting review',
         'tier2','?section=content&sub=lead-magnets', lm.created_at
  from lm_drafts_v2 lm where lm.status='lm_review'
  union all
  select 'prospect_reply','prospect_reply:'||op.id::text,
         coalesce(op.name,'Unknown prospect'), coalesce(op.company,''),
         'tier1','?section=reach&otab=inbox', coalesce(op.last_reply_at, op.updated_at)
  from outreach_prospects op
  where op.needs_manual_reply = true and op.blacklisted is not true
  union all
  select 'paid_intake','paid_intake:'||pa.id::text,
         coalesce(pa.name, pa.email, 'Paid assessment'),'Day-2 deliverable pending',
         'tier1','?section=clients', pa.paid_at
  from paid_assessments pa
  where pa.status='paid' and pa.day2_completed_at is null and pa.is_test is not true
  union all
  select 'upwork_proposal','upwork_proposal:'||up.id::text,
         'Upwork proposal'||coalesce(' ('||up.rate_amount::text||' '||up.rate_type||')',''),
         'Awaiting your approval','tier3','?section=reach&otab=upwork', up.created_at
  from upwork_proposals up where up.status='pending_approval'
  union all
  select 'call_clip','call_clip:'||vs.id::text,
         coalesce(vs.title, vs.hook_line, 'Call clip'),'Clip awaiting review',
         'tier2','?section=content&sub=clips', vs.created_at
  from video_shorts vs
  where vs.source_type='call_recording' and vs.status='pending'
  union all
  select 'crm_action_due','crm_action_due:'||c.id::text,
         coalesce(c.name,'Contact'), coalesce(c.next_action,'Action due'),
         'tier2','?section=clients', (c.next_action_due)::timestamptz
  from contacts c
  where c.next_action_due is not null and c.next_action_due <= current_date
    and c.merged_into is null
  union all
  select 'dashboard_task','dashboard_task:'||dt.id::text,
         coalesce(dt.title,'Task'), coalesce(dt.status,''),
         'tier3','?section=ops&sub=tasks', dt.created_at
  from dashboard_tasks dt where dt.status in ('pending','open');
$$;
grant execute on function public.get_pending_actions() to anon, authenticated;
