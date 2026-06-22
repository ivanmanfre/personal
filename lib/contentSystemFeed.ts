// Pure mapper: a scan's content_system payload -> a FeedSpec for LinkedInFeedMockup.
// Routes by format: posts with image_url become image posts, others remain text posts.
// Body falls back to the hook so the feed still renders before n8n body-generation ships.
import type { FeedSpec, FeedPostSpec, LmCardSpec } from './linkedinFeedSpec';
import type { ContentSystem } from './scanTypes';

export function buildFeedSpecFromContentSystem(
  cs: ContentSystem,
  opts?: { companyName?: string; max?: number }
): FeedSpec {
  const max = opts?.max ?? 5;
  const name = cs.founder?.name?.trim() || opts?.companyName?.trim() || 'You';
  const headline =
    cs.founder?.headline?.trim() || cs.audience_estimate?.value?.trim() || 'Founder';

  const lm = cs.sample_output?.lm;
  const lmCard: LmCardSpec | undefined = lm?.cover_url
    ? { coverUrl: lm.cover_url, title: lm.title, pages: lm.pages }
    : undefined;

  const posts: FeedPostSpec[] = (cs.sample_output?.posts ?? [])
    // The lead-magnet post is shown as the LM document card, not also as a text
    // post — drop it from the feed when the card is present (else the LM shows twice).
    .filter((p) => !(lmCard && /lead.?magnet/i.test(p.format || '')))
    .slice(0, max)
    .map((p): FeedPostSpec | null => {
      const body = (p.body && p.body.trim()) || (p.hook && p.hook.trim()) || '';
      if (!body) return null;
      if (p.image_url) return { type: 'image', body, imageUrl: p.image_url };
      return { type: 'text', body };
    })
    .filter((p): p is FeedPostSpec => p !== null);

  return { profile: { name, headline, avatarUrl: '' }, posts, ...(lmCard ? { lmCard } : {}) };
}
