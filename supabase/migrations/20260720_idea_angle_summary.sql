-- Angle summary cache for the Posts board Idea list.
-- A tight Haiku-generated headline (5-9 words) for each scored idea, so the
-- Angle column reads at a glance instead of clipping the raw scored topic.
-- Backfilled + cached by the idea-angle-summary edge function (service role);
-- null until first summarized. Idempotent.
alter table public.lm_idea_candidates
  add column if not exists angle_summary text;

comment on column public.lm_idea_candidates.angle_summary is
  'Haiku-generated tight angle headline for the Posts board Idea list. Backfilled/cached by the idea-angle-summary edge fn; null until summarized.';
