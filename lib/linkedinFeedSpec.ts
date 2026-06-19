// Spec + normalization for the LinkedIn-feed mockup. Pure data — no React.

export interface ProfileSpec {
  name: string;
  headline: string;
  avatarUrl: string;
}

export interface TextPostSpec {
  type: 'text';
  body: string;
  reactions?: number;
  comments?: number;
}

export interface ImagePostSpec {
  type: 'image';
  body: string;
  imageUrl: string;
  reactions?: number;
  comments?: number;
}

export type FeedPostSpec = TextPostSpec | ImagePostSpec;

export interface LmCardSpec {
  coverUrl: string;
  title: string;
  /** LinkedIn "document" page-count badge. Defaults to 8. */
  pages?: number;
}

export interface FeedSpec {
  profile: ProfileSpec;
  posts: FeedPostSpec[];
  lmCard?: LmCardSpec;
}

export type RenderMode = 'tease' | 'full';

export interface NormalizedLmCard {
  coverUrl: string;
  title: string;
  pages: number;
}

export interface NormalizedFeed {
  profile: ProfileSpec;
  posts: FeedPostSpec[];
  /** null in tease mode (LM held for the call); populated in full mode when supplied. */
  lmCard: NormalizedLmCard | null;
}

const DEFAULT_LM_PAGES = 8;

/**
 * Validate a FeedSpec and resolve it for a render mode.
 * - 'tease' → lmCard always null (held back for the call)
 * - 'full'  → lmCard included (pages defaulted) when supplied
 * Throws on structurally invalid specs so a bad scrape fails loud, not silently blank.
 */
export function normalizeFeedSpec(spec: FeedSpec, mode: RenderMode = 'tease'): NormalizedFeed {
  if (!spec.profile || !spec.profile.name.trim()) {
    throw new Error('normalizeFeedSpec: profile.name is required');
  }
  if (!Array.isArray(spec.posts) || spec.posts.length === 0) {
    throw new Error('normalizeFeedSpec: at least one post is required');
  }
  for (const post of spec.posts) {
    if (!post.body || !post.body.trim()) {
      throw new Error('normalizeFeedSpec: every post needs a non-empty body');
    }
    if (post.type === 'image' && !post.imageUrl) {
      throw new Error('normalizeFeedSpec: image posts need an imageUrl');
    }
  }

  let lmCard: NormalizedLmCard | null = null;
  if (mode === 'full' && spec.lmCard) {
    lmCard = {
      coverUrl: spec.lmCard.coverUrl,
      title: spec.lmCard.title,
      pages: spec.lmCard.pages ?? DEFAULT_LM_PAGES,
    };
  }

  return { profile: spec.profile, posts: spec.posts, lmCard };
}
