-- Task 6: content_prompts.category column + one-time backfill.
--
-- Backfill mirrors the categorize() if-chain at
-- components/dashboard/PromptLibraryPanel.tsx (branch order preserved so
-- precedence matches the client-side fallback exactly). Additive + idempotent:
-- each UPDATE is guarded by `category is null` so re-running is a no-op, and
-- any slug that falls through every branch stays NULL (renders as "Other" in
-- the dashboard, same as categorize()'s default return).

alter table public.content_prompts add column if not exists category text;

-- if (slug.startsWith('style-')) return 'Carousel layouts';
update public.content_prompts
set category = 'Carousel layouts'
where category is null and slug like 'style-%';

-- if (slug.startsWith('image-style-')) return 'Single-image styles';
update public.content_prompts
set category = 'Single-image styles'
where category is null and slug like 'image-style-%';

-- if (slug.startsWith('carousel-')) return 'Carousel pipeline';
update public.content_prompts
set category = 'Carousel pipeline'
where category is null and slug like 'carousel-%';

-- if (slug.startsWith('lm-') || slug === 'build-assessment') return 'Lead magnets';
update public.content_prompts
set category = 'Lead magnets'
where category is null and (slug like 'lm-%' or slug = 'build-assessment');

-- if (slug.startsWith('outreach') || slug.includes('comment-') || slug === 'connection-note-templates'
--     || slug === 'icp-outreach-scoring' || slug === 'icp-filter-criteria'
--     || slug === 'anti-ai-patterns-outreach-playbook' || slug === 'self-comment-templates'
--     || slug === 'trigger-research-synthesis-prompt' || slug === 'linkedin-comment-drafter') return 'Outreach';
update public.content_prompts
set category = 'Outreach'
where category is null and (
  slug like 'outreach%'
  or slug like '%comment-%'
  or slug in (
    'connection-note-templates',
    'icp-outreach-scoring',
    'icp-filter-criteria',
    'anti-ai-patterns-outreach-playbook',
    'self-comment-templates',
    'trigger-research-synthesis-prompt',
    'linkedin-comment-drafter'
  )
);

-- if (slug.startsWith('upwork')) return 'Upwork / sales';
update public.content_prompts
set category = 'Upwork / sales'
where category is null and slug like 'upwork%';

-- if (slug.startsWith('topic-') || slug === 'topic-suggestion-generation') return 'Topic / curation';
update public.content_prompts
set category = 'Topic / curation'
where category is null and (slug like 'topic-%' or slug = 'topic-suggestion-generation');

-- if (slug.includes('infographic')) return 'Infographic';
update public.content_prompts
set category = 'Infographic'
where category is null and slug like '%infographic%';

-- if (slug.includes('newsletter')) return 'Newsletter';
update public.content_prompts
set category = 'Newsletter'
where category is null and slug like '%newsletter%';

-- if (slug === 'editorial' || slug === 'editorial-lm') return 'Editorial';
update public.content_prompts
set category = 'Editorial'
where category is null and slug in ('editorial', 'editorial-lm');

-- if (slug === 'hook' || slug === 'post-generation' || slug === 'content-briefing' || slug === 'qa'
--     || slug === 'qa-banned-patterns' || slug === 'ig-caption') return 'Post pipeline';
update public.content_prompts
set category = 'Post pipeline'
where category is null and slug in (
  'hook', 'post-generation', 'content-briefing', 'qa', 'qa-banned-patterns', 'ig-caption'
);

-- if (slug === 'author-voice' || slug === 'forbidden-language' || slug === 'brand-positioning'
--     || slug === 'brand-visual') return 'Brand & voice';
update public.content_prompts
set category = 'Brand & voice'
where category is null and slug in (
  'author-voice', 'forbidden-language', 'brand-positioning', 'brand-visual'
);

-- if (slug.includes('clip') || slug.includes('signal-clusters') || slug === 'kyle-call-intelligence-extractor'
--     || slug === 'weekly-output-audit-panel-prompts' || slug.includes('stat-card-spec')
--     || slug.includes('before-after-spec')) return 'Analytics & misc';
update public.content_prompts
set category = 'Analytics & misc'
where category is null and (
  slug like '%clip%'
  or slug like '%signal-clusters%'
  or slug = 'kyle-call-intelligence-extractor'
  or slug = 'weekly-output-audit-panel-prompts'
  or slug like '%stat-card-spec%'
  or slug like '%before-after-spec%'
);

-- if (slug === 'blueprint-generator-system-prompt') return 'Sales / proposals';
update public.content_prompts
set category = 'Sales / proposals'
where category is null and slug = 'blueprint-generator-system-prompt';

-- else return 'Other'; -- unmatched rows stay NULL; dashboard renders "Other" via categorize() fallback
