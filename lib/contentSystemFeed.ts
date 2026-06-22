// Pure mapper: a scan's content_system payload -> a FeedSpec for LinkedInFeedMockup.
// MVP renders every sample post as a TEXT post (the proof is the copy in the founder's voice).
// Body falls back to the hook so the feed still renders before n8n body-generation ships.
import type { FeedSpec, FeedPostSpec } from './linkedinFeedSpec';
import type { ContentSystem } from './scanTypes';

export function buildFeedSpecFromContentSystem(
  cs: ContentSystem,
  opts?: { companyName?: string; max?: number }
): FeedSpec {
  const max = opts?.max ?? 5;
  const name = cs.founder?.name?.trim() || opts?.companyName?.trim() || 'You';
  const headline =
    cs.founder?.headline?.trim() || cs.audience_estimate?.value?.trim() || 'Founder';

  const posts: FeedPostSpec[] = (cs.sample_output?.posts ?? [])
    .slice(0, max)
    .map((p): FeedPostSpec | null => {
      const body = (p.body && p.body.trim()) || (p.hook && p.hook.trim()) || '';
      if (!body) return null;
      return { type: 'text', body };
    })
    .filter((p): p is FeedPostSpec => p !== null);

  return { profile: { name, headline, avatarUrl: '' }, posts };
}
